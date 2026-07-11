import React from "react";
import { redirect } from "next/navigation";
import { getProject } from "@/lib/actions/project";
import GeneratingClient from "./GeneratingClient";

interface GeneratingPageProps {
  params: Promise<{ id: string }>;
}

export default async function GeneratingPage({ params }: GeneratingPageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  // 1. 프로젝트 및 권한 검증
  let project;
  try {
    project = await getProject(projectId);
  } catch (err) {
    redirect("/contents");
  }

  return (
    <GeneratingClient project={project} />
  );
}
