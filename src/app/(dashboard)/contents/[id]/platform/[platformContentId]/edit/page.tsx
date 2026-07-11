import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/actions/project";
import EditClient from "./EditClient";

interface EditPageProps {
  params: Promise<{
    id: string;
    platformContentId: string;
  }>;
}

export default async function EditPage({ params }: EditPageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;
  const platformContentId = resolvedParams.platformContentId;

  const supabase = await createClient();

  // 1. 프로젝트 및 권한 체크
  let project;
  try {
    project = await getProject(projectId);
  } catch (err) {
    redirect("/contents");
  }

  // 2. 플랫폼 콘텐츠 단건 조회
  const { data: content, error: contentErr } = await supabase
    .from("platform_contents")
    .select(`
      *,
      platform:platforms (
        id,
        code,
        name,
        category
      )
    `)
    .eq("id", platformContentId)
    .single();

  if (contentErr || !content) {
    redirect(`/contents/${projectId}/result`);
  }

  // 3. 해당 채널의 모든 세부 문단 섹션 로드 (정렬순)
  const { data: sections } = await supabase
    .from("content_sections")
    .select("*")
    .eq("platform_content_id", platformContentId)
    .order("sort_order", { ascending: true });

  // 4. 이미지 기획 데이터 로드
  const { data: imagePlans } = await supabase
    .from("image_plans")
    .select("*")
    .eq("platform_content_id", platformContentId)
    .order("sequence_number", { ascending: true });

  // 5. 전체 플랫폼 목록 로드 (네비게이션용)
  const { data: siblingContents } = await supabase
    .from("platform_contents")
    .select("id, platform_id, platform:platforms(name, code)")
    .eq("project_id", projectId);

  const parsedSiblings = (siblingContents || []).map((s: any) => ({
    id: s.id,
    platformId: s.platform_id,
    name: s.platform?.name || "기타 채널",
    code: s.platform?.code || "UNKNOWN",
  }));

  return (
    <EditClient
      project={project}
      initialContent={content}
      initialSections={sections || []}
      imagePlans={imagePlans || []}
      siblingContents={parsedSiblings}
    />
  );
}
