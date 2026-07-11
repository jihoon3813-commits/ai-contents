import React from "react";
import { getProjects, getActivePlatforms } from "@/lib/actions/project";
import { createClient } from "@/lib/supabase/server";
import ContentsListClient from "./ContentsListClient";

export const metadata = {
  title: "콘텐츠 프로젝트 관리 - 안티그래비티",
  description: "안티그래비티 멀티플랫폼 콘텐츠 생성 프로젝트 관리 대시보드",
};

export default async function ContentsPage() {
  const supabase = await createClient();

  // 1. 브랜드 목록 조회
  const { data: brands, error: bError } = await supabase
    .from("brands")
    .select("id, name")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (bError) {
    throw new Error(`브랜드 로드 실패: ${bError.message}`);
  }

  // 2. 플랫폼 목록 조회
  const platforms = await getActivePlatforms();

  // 3. 프로젝트 목록 조회
  const projects = await getProjects();

  return (
    <ContentsListClient
      initialProjects={projects}
      brands={brands || []}
      platforms={platforms || []}
    />
  );
}
