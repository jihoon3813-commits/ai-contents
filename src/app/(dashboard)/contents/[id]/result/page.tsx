import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/actions/project";
import ResultClient from "./ResultClient";

interface ResultPageProps {
  params: Promise<{ id: string }>;
}

export default async function ResultPage({ params }: ResultPageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  const supabase = await createClient();

  // 1. 프로젝트 및 권한 체크
  let project;
  try {
    project = await getProject(projectId);
  } catch (err) {
    redirect("/contents");
  }

  // 2. 플랫폼별 생성 결과 및 플랫폼 마스터 정보 조인
  const { data: contents } = await supabase
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
    .eq("project_id", projectId);

  const parsedContents = (contents || []).map((c: any) => ({
    ...c,
    platform_code: c.platform?.code || "UNKNOWN",
    platform_name: c.platform?.name === "WordPress" ? "워드프레스" : (c.platform?.name || "기타 채널"),
    platform_category: c.platform?.category || "SNS",
  }));

  // 3. 각 플랫폼별 섹션 로드
  const contentsWithSections = await Promise.all(
    parsedContents.map(async (c) => {
      const { data: secs } = await supabase
        .from("content_sections")
        .select("*")
        .eq("platform_content_id", c.id)
        .order("sort_order", { ascending: true });
      return {
        ...c,
        sections: secs || [],
      };
    })
  );

  // 4. 이미지 계획 로드
  const { data: imagePlans } = await supabase
    .from("image_plans")
    .select("*")
    .eq("project_id", projectId)
    .order("sequence_number", { ascending: true });

  return (
    <ResultClient
      project={project}
      contents={contentsWithSections}
      initialImagePlans={imagePlans || []}
    />
  );
}
