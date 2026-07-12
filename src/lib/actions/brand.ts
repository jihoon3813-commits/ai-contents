"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  brandSchema,
  voiceProfileSchema,
  brandSampleSchema,
  type BrandInput,
  type VoiceProfileInput,
} from "@/lib/schemas/brand";
import { analyzeText } from "@/lib/utils/analyzer";

// 헬퍼: 현재 로그인한 사용자의 워크스페이스 정보 및 권한 검증
async function verifyWorkspaceMembership(requiredRoles: string[] = ["OWNER", "ADMIN", "EDITOR"]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    try {
      const { convexAuthNextjsToken } = await import("@convex-dev/auth/nextjs/server");
      const token = await convexAuthNextjsToken();
      if (token) {
        const { fetchQuery } = await import("convex/nextjs");
        const { api } = await import("../../../convex/_generated/api");
        const profile = await fetchQuery(api.profiles.get, {}, { token });
        if (profile) {
          const workspaces = await fetchQuery(api.workspaces.getMyWorkspaces, {}, { token });
          if (workspaces.length > 0) {
            const activeWs = workspaces[0];
            if (!requiredRoles.includes(activeWs.role)) {
              throw new Error("해당 작업을 수행할 권한이 없습니다.");
            }
            return { userId: profile.userId, workspaceId: activeWs.id, userRole: activeWs.role };
          }
        }
      }
    } catch (convexAuthErr) {
      console.error("verifyWorkspaceMembership Convex Auth Fallback Error:", convexAuthErr);
    }
    throw new Error("인증되지 않은 사용자입니다.");
  }

  // 첫 번째 소속 워크스페이스 정보 로드
  let { data: member, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error || !member) {
    try {
      const { createAdminClient } = await import("@/lib/supabase/server");
      const adminSupabase = createAdminClient();
      const userName = user.user_metadata?.name || user.email?.split("@")[0] || "사용자";
      
      // 1) 프로필 확인 및 생성
      const { data: profile } = await adminSupabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      
      if (!profile) {
        await adminSupabase.from("profiles").insert({
          id: user.id,
          name: userName,
          timezone: "Asia/Seoul",
          language: "ko",
          onboarding_completed: false,
          is_admin: false,
        });
      }

      // 2) 워크스페이스 생성 및 ID 조회
      const slug = `ws-${user.id.slice(0, 8)}-${Math.random().toString(36).substring(2, 6)}`;
      const { data: newWs, error: wsError } = await adminSupabase
        .from("workspaces")
        .insert({
          name: `${userName}의 워크스페이스`,
          slug,
          owner_id: user.id,
          plan_code: "FREE",
          status: "ACTIVE",
          settings: {},
        })
        .select("id")
        .single();

      if (wsError || !newWs) {
        throw new Error(wsError?.message || "워크스페이스 생성 실패");
      }

      // 3) 워크스페이스 멤버 추가
      await adminSupabase.from("workspace_members").insert({
        workspace_id: newWs.id,
        user_id: user.id,
        role: "OWNER",
        status: "ACTIVE",
      });

      // 4) 구독 추가
      await adminSupabase.from("subscriptions").insert({
        workspace_id: newWs.id,
        plan_code: "FREE",
        status: "ACTIVE",
        current_period_start: new Date().toISOString(),
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        limits: { words_limit: 10000, images_limit: 20 },
      });

      // 다시 한 번 멤버 조회
      const retryResult = await supabase
        .from("workspace_members")
        .select("workspace_id, role")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (retryResult.data) {
        member = retryResult.data;
      } else {
        throw new Error("워크스페이스 멤버십 재로드 실패");
      }
    } catch (createErr: any) {
      console.error("verifyWorkspaceMembership Auto-Create Error:", createErr);
      throw new Error("워크스페이스 멤버십이 존재하지 않으며, 자동 생성에 실패했습니다.");
    }
  }

  if (!requiredRoles.includes(member.role)) {
    throw new Error("해당 작업을 수행할 권한이 없습니다.");
  }

  return { userId: user.id, workspaceId: member.workspace_id, userRole: member.role };
}

// 1. 브랜드 생성
export async function createBrand(input: BrandInput) {
  const { userId, workspaceId } = await verifyWorkspaceMembership();
  
  // Zod 검증
  const parsed = brandSchema.parse(input);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .insert({
      workspace_id: workspaceId,
      name: parsed.name,
      industry: parsed.industry,
      description: parsed.description,
      tagline: parsed.tagline,
      website_url: parsed.website_url,
      target_audience: parsed.target_audience,
      customer_problems: parsed.customer_problems,
      products_services: parsed.products_services,
      core_values: parsed.core_values,
      default_cta: parsed.default_cta,
      legal_notice: parsed.legal_notice,
      is_default: parsed.is_default,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`브랜드 생성 실패: ${error.message}`);
  }

  // 신규 브랜드용 빈 보이스 프로필 자동 바인딩
  const { error: voiceError } = await supabase.from("brand_voice_profiles").insert({
    brand_id: data.id,
    formal_level: 3,
    sentence_length: 3,
    expertise_level: 3,
    emotional_level: 3,
    sales_level: 3,
    humor_level: 3,
    emoji_level: 3,
    question_level: 3,
    honorific_style: "HONORIFIC",
  });

  if (voiceError) {
    console.error("보이스 프로필 자동 생성 실패:", voiceError.message);
  }

  revalidatePath("/brands");
  return data;
}

// 2. 브랜드 정보 수정
export async function updateBrand(brandId: string, input: BrandInput) {
  const { userId } = await verifyWorkspaceMembership();
  const parsed = brandSchema.parse(input);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brands")
    .update({
      name: parsed.name,
      industry: parsed.industry,
      description: parsed.description,
      tagline: parsed.tagline,
      website_url: parsed.website_url,
      target_audience: parsed.target_audience,
      customer_problems: parsed.customer_problems,
      products_services: parsed.products_services,
      core_values: parsed.core_values,
      default_cta: parsed.default_cta,
      legal_notice: parsed.legal_notice,
      is_default: parsed.is_default,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", brandId)
    .select()
    .single();

  if (error) {
    throw new Error(`브랜드 수정 실패: ${error.message}`);
  }

  revalidatePath("/brands");
  revalidatePath(`/brands/${brandId}`);
  return data;
}

// 3. 브랜드 복제 (보이스 프로필 포함)
export async function duplicateBrand(brandId: string) {
  const { userId, workspaceId } = await verifyWorkspaceMembership();

  const supabase = await createClient();
  
  // 3-1. 원본 브랜드 로드
  const { data: sourceBrand, error: brandLoadError } = await supabase
    .from("brands")
    .select("*")
    .eq("id", brandId)
    .single();

  if (brandLoadError || !sourceBrand) {
    throw new Error("원본 브랜드를 찾을 수 없습니다.");
  }

  // 3-2. 브랜드 추가 생성
  const { data: newBrand, error: brandInsertError } = await supabase
    .from("brands")
    .insert({
      workspace_id: workspaceId,
      name: `${sourceBrand.name} 복사본`,
      industry: sourceBrand.industry,
      description: sourceBrand.description,
      tagline: sourceBrand.tagline,
      website_url: sourceBrand.website_url,
      target_audience: sourceBrand.target_audience,
      customer_problems: sourceBrand.customer_problems,
      products_services: sourceBrand.products_services,
      core_values: sourceBrand.core_values,
      default_cta: sourceBrand.default_cta,
      legal_notice: sourceBrand.legal_notice,
      is_default: false, // 복사본은 기본 브랜드로 지정하지 않음
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (brandInsertError) {
    throw new Error(`브랜드 복제 실패: ${brandInsertError.message}`);
  }

  // 3-3. 원본 보이스 프로필 로드
  const { data: sourceVoice } = await supabase
    .from("brand_voice_profiles")
    .select("*")
    .eq("brand_id", brandId)
    .maybeSingle();

  // 3-4. 보이스 프로필도 복사하여 신규 바인딩
  const { error: voiceInsertError } = await supabase.from("brand_voice_profiles").insert({
    brand_id: newBrand.id,
    formal_level: sourceVoice?.formal_level ?? 3,
    sentence_length: sourceVoice?.sentence_length ?? 3,
    expertise_level: sourceVoice?.expertise_level ?? 3,
    emotional_level: sourceVoice?.emotional_level ?? 3,
    sales_level: sourceVoice?.sales_level ?? 3,
    humor_level: sourceVoice?.humor_level ?? 3,
    emoji_level: sourceVoice?.emoji_level ?? 3,
    question_level: sourceVoice?.question_level ?? 3,
    honorific_style: sourceVoice?.honorific_style ?? "HONORIFIC",
    preferred_phrases: sourceVoice?.preferred_phrases ?? "",
    forbidden_phrases: sourceVoice?.forbidden_phrases ?? "",
    proprietary_terms: sourceVoice?.proprietary_terms ?? "",
    intro_style: sourceVoice?.intro_style ?? "",
    closing_style: sourceVoice?.closing_style ?? "",
    cta_style: sourceVoice?.cta_style ?? "",
    analysis_summary: sourceVoice?.analysis_summary ?? "",
  });

  if (voiceInsertError) {
    console.error("보이스 프로필 복제 실패:", voiceInsertError.message);
  }

  revalidatePath("/brands");
  return newBrand;
}

// 4. 브랜드 소프트 삭제 (deleted_at 설정)
export async function deleteBrandSoft(brandId: string) {
  await verifyWorkspaceMembership();

  const supabase = await createClient();
  const { error } = await supabase
    .from("brands")
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq("id", brandId);

  if (error) {
    throw new Error(`브랜드 삭제 실패: ${error.message}`);
  }

  revalidatePath("/brands");
}

// 5. 기본 브랜드 강제 지정
export async function setDefaultBrand(brandId: string) {
  await verifyWorkspaceMembership();

  const supabase = await createClient();
  // 트리거(plpgsql)가 동일 워크스페이스의 다른 기본 지정을 해제해 줌
  const { error } = await supabase
    .from("brands")
    .update({
      is_default: true,
    })
    .eq("id", brandId);

  if (error) {
    throw new Error(`기본 브랜드 지정 실패: ${error.message}`);
  }

  revalidatePath("/brands");
}

// 6. 보이스 프로필 업데이트
export async function updateVoiceProfile(brandId: string, input: VoiceProfileInput) {
  await verifyWorkspaceMembership();
  const parsed = voiceProfileSchema.parse(input);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_voice_profiles")
    .update({
      formal_level: parsed.formal_level,
      sentence_length: parsed.sentence_length,
      expertise_level: parsed.expertise_level,
      emotional_level: parsed.emotional_level,
      sales_level: parsed.sales_level,
      humor_level: parsed.humor_level,
      emoji_level: parsed.emoji_level,
      question_level: parsed.question_level,
      honorific_style: parsed.honorific_style,
      preferred_phrases: parsed.preferred_phrases,
      forbidden_phrases: parsed.forbidden_phrases,
      proprietary_terms: parsed.proprietary_terms,
      intro_style: parsed.intro_style,
      closing_style: parsed.closing_style,
      cta_style: parsed.cta_style,
      analysis_summary: parsed.analysis_summary,
      updated_at: new Date().toISOString(),
    })
    .eq("brand_id", brandId)
    .select()
    .single();

  if (error) {
    throw new Error(`보이스 프로필 저장 실패: ${error.message}`);
  }

  revalidatePath(`/brands/${brandId}/voice`);
  return data;
}

// 7. 샘플 등록 및 Mock 정량 문체 분석 실행
export async function createSampleAndAnalyze(brandId: string, input: any) {
  const { userId, workspaceId } = await verifyWorkspaceMembership();
  
  // Zod 검증
  const parsed = brandSampleSchema.parse(input);

  // 로컬 Mock 분석 유틸을 통한 실시간 지표 연산
  const analysisResult = analyzeText(parsed.raw_text);

  const supabase = await createClient();
  const { data: newSample, error: sampleError } = await supabase
    .from("brand_samples")
    .insert({
      workspace_id: workspaceId,
      brand_id: brandId,
      title: parsed.title,
      source_type: parsed.source_type,
      source_url: parsed.source_url,
      raw_text: parsed.raw_text,
      file_path: parsed.file_path,
      character_count: parsed.raw_text.length,
      analysis_status: "COMPLETED",
      analysis_result: analysisResult,
      created_by: userId,
    })
    .select()
    .single();

  if (sampleError) {
    throw new Error(`샘플 등록 실패: ${sampleError.message}`);
  }

  // 해당 브랜드의 모든 샘플을 가져와서 평균 요약을 산출하고 보이스 프로필에 권장 슬라이더 값을 추천 계산
  const { data: allSamples } = await supabase
    .from("brand_samples")
    .select("analysis_result")
    .eq("brand_id", brandId);

  if (allSamples && allSamples.length > 0) {
    let totalFormal = 0;
    let totalLength = 0;
    let totalEmoji = 0;
    let totalQuestion = 0;

    allSamples.forEach((s: any) => {
      const res = s.analysis_result;
      // 1. formal_level 추천 (존댓말 비율 기반: 80% 이상 -> 5, 60% -> 4, 40% -> 3, 20% -> 2, 미만 -> 1)
      const f = Math.max(1, Math.min(5, Math.ceil((res.honorific_ratio || 50) / 20)));
      // 2. sentence_length 추천 (평균 문장 길이 기반: 60자 이상 -> 5, 45자 -> 4, 30자 -> 3, 15자 -> 2, 미만 -> 1)
      const l = Math.max(1, Math.min(5, Math.ceil((res.avg_sentence_length || 30) / 15)));
      // 3. emoji_level 추천 (이모지 개수 기반: 5개 이상 -> 5, 3개 -> 4, 2개 -> 3, 1개 -> 2, 0개 -> 1)
      const e = Math.max(1, Math.min(5, (res.emoji_count || 0) + 1));
      // 4. question_level 추천 (질문 비율 기반: 40% 이상 -> 5, 30% -> 4, 20% -> 3, 10% -> 2, 0% -> 1)
      const q = Math.max(1, Math.min(5, Math.ceil((res.question_ratio || 0) / 10) + 1));

      totalFormal += f;
      totalLength += l;
      totalEmoji += e;
      totalQuestion += q;
    });

    const count = allSamples.length;
    const recommendedFormal = Math.round(totalFormal / count);
    const recommendedLength = Math.round(totalLength / count);
    const recommendedEmoji = Math.round(totalEmoji / count);
    const recommendedQuestion = Math.round(totalQuestion / count);

    // 슬라이더 프로필 요약 자동 구성
    const summaryText = `샘플 분석 완료: 등록된 ${count}개의 예문을 분석한 결과, 공식성 ${recommendedFormal}단계, 문장길이 ${recommendedLength}단계, 이모지 ${recommendedEmoji}단계, 질문빈도 ${recommendedQuestion}단계의 어조 성향을 추천합니다.`;

    await supabase
      .from("brand_voice_profiles")
      .update({
        analysis_summary: summaryText,
        // 사용자 승인 전이므로 슬라이더에 직접 반영하지 않고 summary 정보만 갱신
      })
      .eq("brand_id", brandId);
  }

  revalidatePath(`/brands/${brandId}/samples`);
  revalidatePath(`/brands/${brandId}/voice`);
  return newSample;
}

// 8. 샘플 삭제
export async function deleteBrandSample(brandId: string, sampleId: string) {
  await verifyWorkspaceMembership();

  const supabase = await createClient();
  const { error } = await supabase.from("brand_samples").delete().eq("id", sampleId);

  if (error) {
    throw new Error(`샘플 삭제 실패: ${error.message}`);
  }

  revalidatePath(`/brands/${brandId}/samples`);
}

// 9. 보이스 프로필 최종 승인
export async function approveVoiceProfile(brandId: string) {
  await verifyWorkspaceMembership();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("brand_voice_profiles")
    .update({
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("brand_id", brandId)
    .select()
    .single();

  if (error) {
    throw new Error(`보이스 프로필 승인 실패: ${error.message}`);
  }

  revalidatePath(`/brands/${brandId}/voice`);
  return data;
}

// 10. DOCX 파일에서 텍스트 추출 (서버사이드 mammoth 파싱)
export async function extractTextFromDocx(base64Data: string): Promise<string> {
  await verifyWorkspaceMembership();
  
  try {
    const mammoth = require("mammoth");
    const buffer = Buffer.from(base64Data, "base64");
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
  } catch (err: any) {
    throw new Error(`DOCX 파일 텍스트 추출 실패: ${err.message}`);
  }
}
