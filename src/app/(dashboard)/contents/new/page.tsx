import React from "react";
import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { createProject } from "@/lib/actions/project";
import { verifyWorkspaceMembership } from "@/lib/actions/generation";
import { Loader2, Sparkles } from "lucide-react";

export default async function NewProjectPage() {
  console.log("NewProjectPage: Initializing project creation session...");
  const supabase = await createClient();

  // 1. 유효한 브랜드 목록 조회
  const { data: brands, error } = await supabase
    .from("brands")
    .select("id, is_default")
    .is("deleted_at", null);

  if (error) {
    throw new Error(`브랜드 확인 중 오류 발생: ${error.message}`);
  }

  let activeBrands = brands;

  // 브랜드가 전혀 없는 경우 백그라운드 자동 생성
  if (!activeBrands || activeBrands.length === 0) {
    const { workspaceId } = await verifyWorkspaceMembership();
    const adminSupabase = createAdminClient();
    const { data: newBrand, error: brandErr } = await adminSupabase
      .from("brands")
      .insert({
        workspace_id: workspaceId,
        name: "기본 브랜드",
        industry: "마케팅",
        description: "기본 마케팅 브랜드 프로필",
        is_default: true,
      })
      .select("id, is_default")
      .single();

    if (brandErr || !newBrand) {
      throw new Error(`기본 브랜드 생성 실패: ${brandErr?.message || "알 수 없는 오류"}`);
    }

    // voice_profiles도 함께 생성
    await adminSupabase.from("voice_profiles").insert({
      brand_id: newBrand.id,
      style_description: "일반적이고 친근한 톤",
      tones: [],
      rules: [],
      prohibited_words: [],
    });

    activeBrands = [newBrand];
  }

  // 2. 기본 브랜드 선택
  const defaultBrand = activeBrands.find((b: any) => b.is_default === true) || activeBrands[0];

  // 3. 신규 빈 프로젝트 세션 발급
  let newProject;
  try {
    newProject = await createProject(defaultBrand.id);
  } catch (err: any) {
    throw new Error(`새 프로젝트 생성 실패: ${err.message}`);
  }

  // 4. 발급된 프로젝트 ID의 셋업 페이지로 즉시 강제 리다이렉트
  redirect(`/contents/${newProject.id}/setup`);

  // 혹시 리다이렉트 수행 지연 중 노출될 프리미엄 대기 화면
  return (
    <div className="flex flex-col items-center justify-center p-24 space-y-4 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/50 dark:border-zinc-800/50 shadow-sm max-w-lg mx-auto mt-12">
      <div className="relative flex items-center justify-center">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
        <Sparkles className="h-4 w-4 text-primary absolute animate-bounce" />
      </div>
      <div className="text-center space-y-1.5">
        <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">새 기획 세션 발급 중</h3>
        <p className="text-[11px] text-zinc-400">
          브랜드 정보와 마케팅 플랫폼 매핑 세션을 초기화하고 있습니다. 잠시만 기다려 주세요.
        </p>
      </div>
    </div>
  );
}
