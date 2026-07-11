import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SamplesClient from "./SamplesClient";

interface SamplesPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function SamplesPage({ params }: SamplesPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. 사용자 로그인 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. 브랜드 정보 로드
  const { data: brand } = await supabase
    .from("brands")
    .select("name, workspace_id")
    .eq("id", id)
    .maybeSingle();

  if (!brand) {
    redirect("/brands");
  }

  // 3. 소속 워크스페이스 역할 확인 (VIEWER 권한 통제용)
  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("user_id", user.id)
    .eq("workspace_id", brand.workspace_id)
    .limit(1)
    .maybeSingle();

  const userRole = member?.role || "VIEWER";

  // 4. 해당 브랜드의 작성글 샘플 히스토리 로드
  const { data: samples, error } = await supabase
    .from("brand_samples")
    .select("*")
    .eq("brand_id", id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("작성 샘플 로드 에러:", error.message);
  }

  return (
    <div className="space-y-6">
      <SamplesClient
        brandId={id}
        brandName={brand.name}
        initialSamples={samples || []}
        userRole={userRole}
      />
    </div>
  );
}
