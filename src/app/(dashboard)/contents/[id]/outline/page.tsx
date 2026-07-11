import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/actions/project";
import OutlineClient from "./OutlineClient";

interface OutlinePageProps {
  params: Promise<{ id: string }>;
}

export default async function OutlinePage({ params }: OutlinePageProps) {
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

  // 2. 공통 개요 로드 (platform_id IS NULL)
  const { data: outline } = await supabase
    .from("content_outlines")
    .select("*")
    .eq("project_id", projectId)
    .is("platform_id", null)
    .maybeSingle();

  // 3. 개요 상세 아이템 로드
  let items: any[] = [];
  if (outline) {
    const { data: oItems } = await supabase
      .from("outline_items")
      .select("*")
      .eq("outline_id", outline.id)
      .order("sort_order", { ascending: true });
    items = oItems || [];
  }

  return (
    <OutlineClient
      project={project}
      initialOutline={outline || null}
      initialItems={items}
    />
  );
}
