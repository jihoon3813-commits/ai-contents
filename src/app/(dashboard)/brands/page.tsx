import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BrandsListClient from "./BrandsListClient";
import { Plus, Briefcase, Sparkles } from "lucide-react";

export default async function BrandsPage() {
  const supabase = await createClient();

  // 1. 사용자 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. 활성 워크스페이스 로드
  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!member) {
    redirect("/onboarding/brand");
  }

  // 3. 소프트 삭제되지 않은 브랜드 목록 조회
  const { data: brands, error } = await supabase
    .from("brands")
    .select("*")
    .eq("workspace_id", member.workspace_id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("브랜드 로드 에러:", error.message);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200/50 dark:border-zinc-800/50 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            브랜드 프로필 관리
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            회사나 채널의 브랜드 정체성과 전용 보이스 톤(어조)을 설계하고 관리합니다.
          </p>
        </div>
        <Link
          href="/brands/new"
          className="inline-flex items-center justify-center gap-2 py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          새 브랜드 추가
        </Link>
      </div>

      <BrandsListClient 
        initialBrands={brands || []} 
        userRole={member.role}
      />
    </div>
  );
}
