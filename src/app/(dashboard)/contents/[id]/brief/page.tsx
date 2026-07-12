import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/actions/project";
import BriefClient from "./BriefClient";

interface BriefPageProps {
  params: Promise<{ id: string }>;
}

export default async function BriefPage({ params }: BriefPageProps) {
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

  // 2. 기존 브리프 조회
  const { data: brief } = await supabase
    .from("content_briefs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  const mergedBrief = brief ? {
    ...brief,
    target_audience: project.target_audience
  } : null;

  return (
    <BriefClient
      project={project}
      initialBrief={mergedBrief}
    />
  );
}
