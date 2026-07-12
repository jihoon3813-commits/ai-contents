import React from "react";
import { getProject, getActivePlatforms } from "@/lib/actions/project";
import { createClient } from "@/lib/supabase/server";
import SetupWizardClient from "./SetupWizardClient";

interface SetupPageProps {
  params: Promise<{ id: string }>;
}

export default async function SetupPage({ params }: SetupPageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  const supabase = await createClient();

  // 1. 프로젝트 상세 로드 (권한 검증 포함됨)
  const project = await getProject(projectId);

  // 2. 브랜드 목록 조회 (Deleted 제외)
  const { data: brands, error } = await supabase
    .from("brands")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`브랜드 로드 실패: ${error.message}`);
  }

  // 3. 플랫폼 목록 조회
  const platforms = await getActivePlatforms();

  // 4. 기존 작성 경험 데이터 로드
  const { data: experience } = await supabase
    .from("content_experiences")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  // 5. 어드민 등록 API 키 유효성 체크
  let isAiKeyConfigured = false;
  try {
    const { fetchQuery } = await import("convex/nextjs");
    const { api } = await import("@/../convex/_generated/api");
    const { convexAuthNextjsToken } = await import("@convex-dev/auth/nextjs/server");
    const token = await convexAuthNextjsToken();
    if (token) {
      const key = await fetchQuery(api.admin.getSystemSetting, { key: "AI_API_KEY" }, { token });
      if (key && key.startsWith("AIzaSy")) {
        isAiKeyConfigured = true;
      }
    }
  } catch (err) {
    console.error("Failed to verify Gemini API Key configuration:", err);
  }

  return (
    <SetupWizardClient
      project={project}
      brands={brands || []}
      platforms={platforms || []}
      initialExperience={experience || null}
      isAiKeyConfigured={isAiKeyConfigured}
    />
  );
}
