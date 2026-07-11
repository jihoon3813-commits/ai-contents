import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayout";

interface WorkspaceRaw {
  id: string;
  name: string;
  slug: string;
}

interface MemberQueryRow {
  workspace_id: string;
  workspaces: WorkspaceRaw | WorkspaceRaw[] | null;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // 1. 사용자 세션 검증
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. 프로필 정보 조회
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, avatar_url, onboarding_completed, is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profile && !profile.onboarding_completed) {
    redirect("/onboarding/brand");
  }

  // 3. 소속 워크스페이스 및 역할 관계 조회
  const { data: members } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(id, name, slug)")
    .eq("user_id", user.id);

  // 4. 조인 쿼리 결과에서 워크스페이스 배열 정리
  const workspaces = (members || []).map((m: any) => ({
    id: m.workspaces.id,
    name: m.workspaces.name,
    slug: m.workspaces.slug,
  }));

  // 4. 활성 워크스페이스의 브랜드 개수 및 기본 브랜드 명칭 페치
  let brandCount = 0;
  let defaultBrandName = "";

  if (workspaces.length > 0) {
    const activeWs = workspaces[0];
    const { data: brandList } = await supabase
      .from("brands")
      .select("name, is_default")
      .eq("workspace_id", activeWs.id)
      .is("deleted_at", null);

    if (brandList) {
      brandCount = brandList.length;
      const defaultBrand = brandList.find((b: any) => b.is_default);
      if (defaultBrand) {
        defaultBrandName = defaultBrand.name;
      }
    }
  }

  return (
    <DashboardLayoutClient
      userEmail={user.email || ""}
      profile={profile}
      workspaces={workspaces}
      brandCount={brandCount}
      defaultBrandName={defaultBrandName}
    >
      {children}
    </DashboardLayoutClient>
  );
}
