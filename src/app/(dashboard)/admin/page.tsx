import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminDashboardData } from "@/lib/actions/admin";
import AdminClient from "./AdminClient";

export const metadata = {
  title: "안티그래비티 | 관리자 콘솔",
  description: "시스템 관리자 대시보드",
};

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // 1. 사용자 세션 획득
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. 어드민 여부 검증
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile || !profile.is_admin) {
    // 권한 없을 시 403 Forbidden 화면 출력
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] border border-dashed border-red-500/20 bg-red-500/5 rounded-3xl p-8 text-center space-y-3">
        <h1 className="text-xl font-black text-rose-600">403 Forbidden</h1>
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
          이 구역은 시스템 어드민 관리자만 접근할 수 있습니다.
        </p>
        <p className="text-xs text-zinc-400">자세한 사항은 개발팀에 문의하십시오.</p>
      </div>
    );
  }

  // 3. 어드민 종합 데이터 로딩
  const initialData = await getAdminDashboardData();

  return (
    <AdminClient initialData={initialData as any} />
  );
}
