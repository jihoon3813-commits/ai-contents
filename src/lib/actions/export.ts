"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { verifyWorkspaceMembership } from "./generation";
import {
  validateFileSecurity,
  stripMetadata,
} from "@/lib/utils/image-sanitizer";
import {
  htmlToTxt,
  htmlToMarkdown,
  jsonToCsv,
} from "@/lib/utils/export-converters";
import JSZip from "jszip";

// ==========================================
// 1. 이미지 자산 업로드 (uploadAsset)
// ==========================================
export async function uploadAsset(
  platformContentId: string,
  sectionId: string | null,
  formData: FormData,
  imagePlanId?: string
) {
  console.log(">>> SERVER uploadAsset start: contentId =", platformContentId);
  const fs = require("fs");
  const path = require("path");
  fs.appendFileSync(
    path.join(process.cwd(), "server-debug.log"),
    `[${new Date().toISOString()}] SERVER uploadAsset start: contentId = ${platformContentId}\n`
  );
  try {
    const supabase = await createClient();
    const { userId, workspaceId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

    // 1) 플랫폼 콘텐츠 정보 조회
    const { data: content, error: fetchErr } = await supabase
      .from("platform_contents")
      .select("id, project_id, workspace_id")
      .eq("id", platformContentId)
      .single();

    if (fetchErr || !content) {
      throw new Error("대상 콘텐츠 정보를 조회할 수 없습니다.");
    }

    // 타 워크스페이스 조작 금지
    if (content.workspace_id !== workspaceId) {
      throw new Error("해당 워크스페이스의 자산을 업로드할 수 없습니다.");
    }

    const file = formData.get("file") as File;
    if (!file) {
      throw new Error("업로드할 파일이 존재하지 않습니다.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // 2) 파일 단위 보안 검증 (SVG 차단, 실행 파일 차단, 매직 바이트 검출)
    const securityCheck = validateFileSecurity(buffer, file.name);
    if (!securityCheck.allowed) {
      throw new Error(securityCheck.reason || "보안 검증을 통과하지 못했습니다.");
    }

    // 10MB 크기 제한 검사
    if (buffer.length > 10 * 1024 * 1024) {
      throw new Error("파일 크기는 10MB를 초과할 수 없습니다.");
    }

    // 3) 프로젝트별 이미지 자산 최대 개수(30개) 제한 검증
    const { data: countData, error: countErr } = await supabase
      .from("assets")
      .select("id")
      .eq("project_id", content.project_id);

    if (countErr) {
      throw new Error("자산 한도 검사 중 오류가 발생했습니다.");
    }

    const count = countData ? countData.length : 0;
    if (count >= 30) {
      throw new Error("프로젝트당 최대 이미지 자산 개수(30개)를 초과할 수 없습니다.");
    }

    // 4) EXIF 메타데이터 제거
    const sanitizedBuffer = stripMetadata(buffer);

    // 5) 스토리지 업로드 경로 설정 (파일명 UUID화)
    const assetId = crypto.randomUUID();
    const storagePath = `workspaces/${workspaceId}/projects/${content.project_id}/assets/${assetId}.webp`;

    const { error: uploadErr } = await supabase.storage
      .from("assets")
      .upload(storagePath, sanitizedBuffer, {
        contentType: "image/webp",
        upsert: true,
      });

    if (uploadErr) {
      throw new Error(`스토리지 업로드 실패: ${uploadErr.message}`);
    }

    // 6) assets 테이블 레코드 생성
    const { data: asset, error: insertErr } = await supabase
      .from("assets")
      .insert({
        id: assetId,
        workspace_id: workspaceId,
        project_id: content.project_id,
        platform_content_id: platformContentId,
        section_id: sectionId || null,
        asset_type: "IMAGE",
        source_type: imagePlanId ? "PLANNED" : "UPLOAD",
        original_filename: file.name,
        storage_path: storagePath,
        mime_type: "image/webp",
        file_size: sanitizedBuffer.length,
        status: "UPLOADED",
        copyright_status: "UNKNOWN",
        sort_order: (count || 0) + 1,
        created_by: userId,
      })
      .select()
      .single();

    if (insertErr || !asset) {
      // 롤백 성격으로 스토리지 업로드 파일 소거
      await supabase.storage.from("assets").remove([storagePath]);
      throw new Error(`데이터베이스 자산 정보 등록 실패: ${insertErr?.message}`);
    }

    // 7) 만약 이미지 기획안 ID가 연동 전달되었다면 매핑 관계 수립
    if (imagePlanId) {
      await supabase
        .from("image_plans")
        .update({
          linked_asset_id: asset.id,
          status: "UPLOADED",
          updated_at: new Date().toISOString(),
        })
        .eq("id", imagePlanId);
    }

    revalidatePath(`/contents/${content.project_id}/platform/${platformContentId}/edit`);
    fs.appendFileSync(
      path.join(process.cwd(), "server-debug.log"),
      `[${new Date().toISOString()}] SERVER uploadAsset success: assetId = ${asset.id}\n`
    );
    return asset;
  } catch (err: any) {
    const fs = require("fs");
    const path = require("path");
    fs.appendFileSync(
      path.join(process.cwd(), "server-error.log"),
      `[${new Date().toISOString()}] uploadAsset ERROR: ${err.message}\n${err.stack}\n\n`
    );
    throw err;
  }
}

// ==========================================
// 2. 이미지 자산 메타데이터 수정 (updateAsset)
// ==========================================
export async function updateAsset(
  assetId: string,
  payload: {
    alt_text?: string;
    caption?: string;
    source_url?: string;
    copyright_status?: "OWNED" | "LICENSED" | "AI_GENERATED" | "UNKNOWN" | "RESTRICTED";
    section_id?: string | null;
  }
) {
  const supabase = await createClient();
  const { workspaceId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  // 1) 기존 자산 조회 및 격리 검증
  const { data: asset, error: fetchErr } = await supabase
    .from("assets")
    .select("workspace_id, project_id, platform_content_id")
    .eq("id", assetId)
    .single();

  if (fetchErr || !asset) {
    throw new Error("수정하려는 이미지 자산을 찾을 수 없습니다.");
  }

  if (asset.workspace_id !== workspaceId) {
    throw new Error("해당 워크스페이스의 자산을 변경할 권한이 없습니다.");
  }

  // 2) 업데이트
  const { data: updated, error: updateErr } = await supabase
    .from("assets")
    .update({
      alt_text: payload.alt_text,
      caption: payload.caption,
      source_url: payload.source_url,
      copyright_status: payload.copyright_status,
      section_id: payload.section_id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId)
    .select()
    .single();

  if (updateErr) {
    throw new Error(`자산 정보 수정 실패: ${updateErr.message}`);
  }

  // 3) 섹션 연결 정보가 수정된 경우, 매핑된 이미지 기획안의 section_id도 일체 싱크
  await supabase
    .from("image_plans")
    .update({ section_id: payload.section_id })
    .eq("linked_asset_id", assetId);

  revalidatePath(`/contents/${asset.project_id}/platform/${asset.platform_content_id}/edit`);
  return updated;
}

// ==========================================
// 3. 이미지 자산 제거 (deleteAsset)
// ==========================================
export async function deleteAsset(assetId: string) {
  const supabase = await createClient();
  const { workspaceId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  // 1) 격리 점검
  const { data: asset, error: fetchErr } = await supabase
    .from("assets")
    .select("workspace_id, storage_path, project_id, platform_content_id")
    .eq("id", assetId)
    .single();

  if (fetchErr || !asset) {
    throw new Error("삭제하려는 이미지 자산을 찾을 수 없습니다.");
  }

  if (asset.workspace_id !== workspaceId) {
    throw new Error("해당 워크스페이스의 자산을 삭제할 권한이 없습니다.");
  }

  // 2) 스토리지 내 원본 물리 파일 삭제
  await supabase.storage.from("assets").remove([asset.storage_path]);

  // 3) 이미지 기획안 연결 해제
  await supabase
    .from("image_plans")
    .update({
      linked_asset_id: null,
      status: "PENDING",
      updated_at: new Date().toISOString(),
    })
    .eq("linked_asset_id", assetId);

  // 4) assets 테이블 레코드 삭제
  const { error: deleteErr } = await supabase
    .from("assets")
    .delete()
    .eq("id", assetId);

  if (deleteErr) {
    throw new Error(`자산 정보 삭제 실패: ${deleteErr.message}`);
  }

  revalidatePath(`/contents/${asset.project_id}/platform/${asset.platform_content_id}/edit`);
  return { success: true };
}

// ==========================================
// 4. 이미지 순서 정렬 변경 (reorderAssets)
// ==========================================
export async function reorderAssets(
  assetIds: string[],
  platformContentId: string
) {
  const supabase = await createClient();
  const { workspaceId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  // 1) 플랫폼 콘텐츠 정보 조회
  const { data: content, error: fetchErr } = await supabase
    .from("platform_contents")
    .select("id, project_id, workspace_id")
    .eq("id", platformContentId)
    .single();

  if (fetchErr || !content) {
    throw new Error("대상 콘텐츠 정보를 조회할 수 없습니다.");
  }

  if (content.workspace_id !== workspaceId) {
    throw new Error("접근 권한이 없습니다.");
  }

  // 2) 순차 업데이트 수행
  for (let i = 0; i < assetIds.length; i++) {
    await supabase
      .from("assets")
      .update({ sort_order: i + 1 })
      .eq("id", assetIds[i])
      .eq("workspace_id", workspaceId);
  }

  revalidatePath(`/contents/${content.project_id}/platform/${platformContentId}/edit`);
  return { success: true };
}

// ==========================================
// 5. 이미지 기획안 항목과 실제 자산 수동 매핑 (linkAssetToImagePlan)
// ==========================================
export async function linkAssetToImagePlan(
  imagePlanId: string,
  assetId: string | null
) {
  const supabase = await createClient();
  const { workspaceId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR"]);

  // 1) 이미지 기획안 존재 여부 검사
  const { data: plan, error: planErr } = await supabase
    .from("image_plans")
    .select("id, project_id, platform_content_id, section_id")
    .eq("id", imagePlanId)
    .single();

  if (planErr || !plan) {
    throw new Error("연결할 이미지 기획 정보를 찾을 수 없습니다.");
  }

  // 2) 자산이 주어졌다면 검증
  if (assetId) {
    const { data: asset, error: assetErr } = await supabase
      .from("assets")
      .select("workspace_id")
      .eq("id", assetId)
      .single();

    if (assetErr || !asset) {
      throw new Error("연결할 이미지 자산 정보를 찾을 수 없습니다.");
    }

    if (asset.workspace_id !== workspaceId) {
      throw new Error("해당 이미지 자산에 접근 권한이 없습니다.");
    }
  }

  // 3) 기획안 정보 갱신
  const { error: updateErr } = await supabase
    .from("image_plans")
    .update({
      linked_asset_id: assetId,
      status: assetId ? "UPLOADED" : "PENDING",
      updated_at: new Date().toISOString(),
    })
    .eq("id", imagePlanId);

  if (updateErr) {
    throw new Error(`이미지 매핑 갱신 실패: ${updateErr.message}`);
  }

  // 4) 자산 레코드의 section_id 도 싱크로 연동
  if (assetId) {
    await supabase
      .from("assets")
      .update({ section_id: plan.section_id })
      .eq("id", assetId);
  }

  revalidatePath(`/contents/${plan.project_id}/platform/${plan.platform_content_id}/edit`);
  return { success: true };
}

// ==========================================
// 6. 단일 포맷 텍스트 파일 내보내기 (exportContent)
// ==========================================
export async function exportContent(
  platformContentId: string,
  format: "HTML" | "TXT" | "MD" | "JSON" | "CSV"
) {
  const supabase = await createClient();
  const { userId, workspaceId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);

  // 1) 원고 본문 및 정보 로드
  const { data: content, error: fetchErr } = await supabase
    .from("platform_contents")
    .select("*, platforms(code)")
    .eq("id", platformContentId)
    .single();

  if (fetchErr || !content) {
    throw new Error("내보낼 콘텐츠 정보를 찾을 수 없습니다.");
  }

  if (content.workspace_id !== workspaceId) {
    throw new Error("이 콘텐츠에 다운로드 권한이 없습니다.");
  }

  const contentStatus = content.status || "NEEDS_REVIEW";
  let bodyHtml = content.body_html || "";
  let bodyText = content.body_text || "";

  // 2) 승인되지 않은 검토 단계인 경우 워터마크 추가
  if (contentStatus === "NEEDS_REVIEW") {
    const watermark = "[DRAFT - FOR REVIEW ONLY]";
    bodyText = `${watermark}\n\n${bodyText}`;
    bodyHtml = `<div style="background:#fff3cd; color:#856404; padding:12px; border:1px solid #ffeeba; margin-bottom:15px; text-align:center; font-weight:bold; font-size:14px; border-radius:8px;">${watermark}</div>\n\n${bodyHtml}`;
  }

  let finalContent = "";
  let fileExtension = "txt";
  let mimeType = "text/plain";

  // 3) 포맷별 변환 적용
  switch (format) {
    case "HTML":
      finalContent = bodyHtml;
      fileExtension = "html";
      mimeType = "text/html";
      break;

    case "TXT":
      finalContent = htmlToTxt(bodyHtml);
      if (contentStatus === "NEEDS_REVIEW") {
        finalContent = `[DRAFT - FOR REVIEW ONLY]\n\n${finalContent}`;
      }
      fileExtension = "txt";
      mimeType = "text/plain";
      break;

    case "MD":
      finalContent = htmlToMarkdown(bodyHtml);
      if (contentStatus === "NEEDS_REVIEW") {
        finalContent = `<!-- [DRAFT - FOR REVIEW ONLY] -->\n\n${finalContent}`;
      }
      fileExtension = "md";
      mimeType = "text/markdown";
      break;

    case "JSON":
      // 이미지 기획 내역 로드 병합
      const { data: plans } = await supabase
        .from("image_plans")
        .select("*")
        .eq("platform_content_id", platformContentId);

      finalContent = JSON.stringify({
        metadata: {
          title: content.title,
          seo_title: content.seo_title,
          meta_description: content.meta_description,
          slug: content.slug,
          excerpt: content.excerpt,
          hashtags: content.hashtags,
          status: content.status,
          word_count: content.word_count,
        },
        body: {
          html: bodyHtml,
          text: bodyText,
        },
        image_plans: plans || [],
      }, null, 2);
      fileExtension = "json";
      mimeType = "application/json";
      break;

    case "CSV":
      // 인스타그램용 캐러셀 슬라이드 포맷 CSV 변환
      const { data: carouselPlans } = await supabase
        .from("image_plans")
        .select("sequence_number, role, description, overlay_text, alt_text, caption")
        .eq("platform_content_id", platformContentId)
        .order("sequence_number");

      finalContent = jsonToCsv(carouselPlans || []);
      fileExtension = "csv";
      mimeType = "text/csv";
      break;

    default:
      throw new Error("지원하지 않는 다운로드 포맷입니다.");
  }

  // 4) 다운로드 감사 로그 적재
  await supabase.from("export_logs").insert({
    user_id: userId,
    platform_content_id: platformContentId,
    export_format: format,
    file_size: Buffer.byteLength(finalContent, "utf-8"),
  });

  const platformCode = content.platforms?.code?.toLowerCase() || "doc";
  const sanitizedTitle = (content.title || "content")
    .replace(/[^a-zA-Z0-9가-힣]/g, "_")
    .substring(0, 30);

  return {
    content: finalContent,
    filename: `${platformCode}_${sanitizedTitle}.${fileExtension}`,
    mimeType,
  };
}

// ==========================================
// 7. 프로젝트 단위 통합 ZIP 아카이브 내보내기 (exportProjectZip)
// ==========================================
export async function exportProjectZip(projectId: string) {
  const supabase = await createClient();
  const { userId, workspaceId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);

  // 1) 프로젝트 조회
  const { data: project, error: projErr } = await supabase
    .from("content_projects")
    .select("*, content_briefs(*)")
    .eq("id", projectId)
    .single();

  if (projErr || !project) {
    throw new Error("대상 프로젝트를 찾을 수 없습니다.");
  }

  // 2) 프로젝트 산하의 모든 플랫폼 원고 및 소속 이미지, 검증 팩트 로드
  const { data: contents } = await supabase
    .from("platform_contents")
    .select("*, platforms(code)")
    .eq("project_id", projectId);

  const { data: projectAssets } = await supabase
    .from("assets")
    .select("*")
    .eq("project_id", projectId);

  const { data: facts } = await supabase
    .from("content_facts")
    .select("id, fact_text, fact_type, verification_status")
    .eq("project_id", projectId);

  const { data: plans } = await supabase
    .from("image_plans")
    .select("*")
    .eq("project_id", projectId);

  // 3) JSZip 인스턴스 생성 및 폴더 맵 구축
  const zip = new JSZip();
  const projectDir = zip.folder(project.title.replace(/[^a-zA-Z0-9가-힣]/g, "_"));
  if (!projectDir) {
    throw new Error("ZIP 디렉토리를 생성할 수 없습니다.");
  }

  // Summary 파일 적재
  const summary = {
    project_id: project.id,
    title: project.title,
    keyword: project.keyword,
    brief: project.content_briefs || null,
    created_at: project.created_at,
  };
  projectDir.file("project-summary.json", JSON.stringify(summary, null, 2));

  // 4) 플랫폼별 콘텐츠 포맷팅하여 분류 삽입
  if (contents) {
    for (const c of contents) {
      const platformCode = c.platforms?.code || "GENERIC";
      const pFolder = projectDir.folder(platformCode.toLowerCase());
      if (!pFolder) continue;

      const contentStatus = c.status || "NEEDS_REVIEW";
      let pBodyHtml = c.body_html || "";
      let pBodyText = c.body_text || "";

      if (contentStatus === "NEEDS_REVIEW") {
        const mark = "[DRAFT - FOR REVIEW ONLY]";
        pBodyText = `${mark}\n\n${pBodyText}`;
        pBodyHtml = `<div style="background:#fff3cd; color:#856404; padding:10px; border:1px solid #ffeeba; margin-bottom:10px; text-align:center; font-weight:bold;">${mark}</div>\n\n${pBodyHtml}`;
      }

      // 플랫폼별 시나리오 이식
      if (platformCode === "NAVER_BLOG") {
        pFolder.file("content.txt", htmlToTxt(pBodyHtml));
        pFolder.file("block-guide.txt", `블로그 제목: ${c.title || ""}\n\n[네이버 블로그 에디터 정렬 배치순서 가이드]\n본문 블록을 나누어 삽입하시고, 각 파라그래프 하단에 매핑된 이미지를 순차 적용해 주세요.\n\n해시태그: ${(c.hashtags || []).join(", ")}`);
        pFolder.file("hashtags.txt", (c.hashtags || []).join("\n"));
        
        const platformPlans = (plans || []).filter((p) => p.platform_content_id === c.id);
        pFolder.file("image-plan.csv", jsonToCsv(platformPlans));
      } else if (platformCode === "INSTAGRAM") {
        pFolder.file("caption.txt", `${pBodyText}\n\n${(c.hashtags || []).map((t: string) => `#${t}`).join(" ")}`);
        pFolder.file("hashtags.txt", (c.hashtags || []).join("\n"));
        
        const platformPlans = (plans || []).filter((p) => p.platform_content_id === c.id);
        pFolder.file("carousel.csv", jsonToCsv(platformPlans));
      } else if (platformCode === "WORDPRESS" || platformCode === "TISTORY") {
        pFolder.file("content.html", pBodyHtml);
        pFolder.file("content.md", htmlToMarkdown(pBodyHtml));
        
        const metadata = {
          title: c.title,
          seo_title: c.seo_title,
          meta_description: c.meta_description,
          slug: c.slug,
          excerpt: c.excerpt,
          tags: c.tags || c.hashtags || [],
        };
        pFolder.file("metadata.json", JSON.stringify(metadata, null, 2));

        const platformPlans = (plans || []).filter((p) => p.platform_content_id === c.id);
        pFolder.file("image-plan.csv", jsonToCsv(platformPlans));
      } else {
        pFolder.file("content.txt", htmlToTxt(pBodyHtml));
        pFolder.file("content.html", pBodyHtml);
      }
    }
  }

  // 5) 출처 팩트 리스트 추가
  if (facts && facts.length > 0) {
    const sFolder = projectDir.folder("sources");
    if (sFolder) {
      sFolder.file("facts.csv", jsonToCsv(facts));
    }
  }

  // 6) 업로드 완료된 실제 물리 이미지 파일 다운로드 병합
  if (projectAssets && projectAssets.length > 0) {
    const imgFolder = projectDir.folder("images");
    if (imgFolder) {
      for (const asset of projectAssets) {
        try {
          const { data: fileData, error: dlErr } = await supabase.storage
            .from("assets")
            .download(asset.storage_path);

          if (!dlErr && fileData) {
            const arrayBuffer = await fileData.arrayBuffer();
            // webp 이름으로 압축 파일 내에 수납
            imgFolder.file(`${asset.id}.webp`, Buffer.from(arrayBuffer));
          }
        } catch (e) {
          console.error(`Asset ZIP 병합 중 스토리지 다운로드 누락 오류: ${asset.storage_path}`, e);
        }
      }
    }
  }

  // 7) ZIP 아카이브 base64 생성 및 감사 로그 적재
  const base64Content = await zip.generateAsync({ type: "base64" });

  if (contents && contents.length > 0) {
    await supabase.from("export_logs").insert({
      user_id: userId,
      platform_content_id: contents[0].id,
      export_format: "ZIP",
      file_size: Math.round((base64Content.length * 3) / 4), // Approx bytes from base64
    });
  }

  const sanitizedProjTitle = project.title
    .replace(/[^a-zA-Z0-9가-힣]/g, "_")
    .substring(0, 30);

  return {
    base64: base64Content,
    filename: `project_${sanitizedProjTitle}_export.zip`,
  };
}

// ==========================================
// 8. 스토리지 자산 임시 서명 다운로드 URL 취득 (generateSignedDownloadUrl)
// ==========================================
export async function generateSignedDownloadUrl(assetId: string) {
  const supabase = await createClient();
  const { workspaceId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);

  // 1) 자산 조회 및 권한 격리 검증
  const { data: asset, error: fetchErr } = await supabase
    .from("assets")
    .select("workspace_id, storage_path")
    .eq("id", assetId)
    .single();

  if (fetchErr || !asset) {
    throw new Error("해당 이미지 자산 정보를 찾을 수 없습니다.");
  }

  if (asset.workspace_id !== workspaceId) {
    throw new Error("이 이미지 자산에 다운로드 권한이 없습니다.");
  }

  // 2) 60초 만료 한도로 서명된 임시 URL 생성
  const { data: signed, error: signErr } = await supabase.storage
    .from("assets")
    .createSignedUrl(asset.storage_path, 60);

  if (signErr || !signed) {
    throw new Error(`임시 서명 다운로드 URL 생성 실패: ${signErr?.message}`);
  }

  return { url: signed.signedUrl };
}

// ==========================================
export async function listAssets(platformContentId: string) {
  console.log(">>> SERVER listAssets called: contentId =", platformContentId);
  const fs = require("fs");
  const path = require("path");
  fs.appendFileSync(
    path.join(process.cwd(), "server-debug.log"),
    `[${new Date().toISOString()}] SERVER listAssets start: contentId = ${platformContentId}\n`
  );
  const supabase = await createClient();
  const { workspaceId } = await verifyWorkspaceMembership(["OWNER", "ADMIN", "EDITOR", "VIEWER"]);

  const { data: assetsList, error } = await supabase
    .from("assets")
    .select("*")
    .eq("platform_content_id", platformContentId)
    .order("sort_order", { ascending: true });

  if (error) {
    fs.appendFileSync(
      path.join(process.cwd(), "server-debug.log"),
      `[${new Date().toISOString()}] SERVER listAssets error: ${error.message}\n`
    );
    throw new Error(`자산 조회 실패: ${error.message}`);
  }
  fs.appendFileSync(
    path.join(process.cwd(), "server-debug.log"),
    `[${new Date().toISOString()}] SERVER listAssets success: count = ${assetsList?.length || 0}\n`
  );
  return assetsList || [];
}
