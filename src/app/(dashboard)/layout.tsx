import React from "react";
import { redirect } from "next/navigation";
import { fetchQuery, fetchMutation } from "convex/nextjs";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "../../../convex/_generated/api";
import DashboardLayoutClient from "@/components/dashboard/DashboardLayout";

function isRedirectError(err: any) {
  return err && (err.digest?.startsWith("NEXT_REDIRECT") || err.message === "NEXT_REDIRECT");
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const token = await convexAuthNextjsToken();

    if (!token) {
      redirect("/login?error=no_token_layout");
    }

    // 1. 프로필 정보 조회 (없으면 자동 생성)
    let profile;
    try {
      profile = await fetchQuery(api.profiles.get, {}, { token });
      if (!profile) {
        profile = await fetchMutation(
          api.profiles.ensureProfileExists,
          { name: "사용자" },
          { token }
        );
      }
    } catch (err: any) {
      if (isRedirectError(err)) throw err;
      console.error("DashboardLayout Profile Fetch Error:", err);
      redirect(`/login?error=profile_fetch_failed&msg=${encodeURIComponent(err.message || "Unknown error")}`);
    }

    if (!profile) {
      redirect("/login?error=profile_not_created");
    }

    if (!profile.onboarding_completed) {
      redirect("/onboarding/brand");
    }

    // 2. 소속 워크스페이스 목록 조회
    let workspaces = [];
    try {
      workspaces = await fetchQuery(api.workspaces.getMyWorkspaces, {}, { token });
    } catch (err: any) {
      if (isRedirectError(err)) throw err;
      console.error("DashboardLayout Workspace Fetch Error:", err);
      redirect(`/login?error=workspace_fetch_failed&msg=${encodeURIComponent(err.message || "Unknown error")}`);
    }

    // 3. 활성 워크스페이스의 브랜드 개수 및 기본 브랜드 명칭 페치
    let brandCount = 0;
    let defaultBrandName = "";

    if (workspaces.length > 0) {
      const activeWs = workspaces[0];
      const brandList = await fetchQuery(
        api.brands.getMyBrands,
        { workspaceId: activeWs.id },
        { token }
      );

      if (brandList) {
        brandCount = brandList.length;
        const defaultBrand = brandList.find((b: any) => b.is_default);
        if (defaultBrand) {
          defaultBrandName = defaultBrand.name;
        }
      }
    }

    const formattedProfile = {
      name: profile.name,
      avatar_url: profile.avatar_url ?? null,
      is_admin: profile.is_admin,
    };

    return (
      <DashboardLayoutClient
        userEmail={profile.name}
        profile={formattedProfile}
        workspaces={workspaces}
        brandCount={brandCount}
        defaultBrandName={defaultBrandName}
      >
        {children}
      </DashboardLayoutClient>
    );
  } catch (err: any) {
    if (isRedirectError(err)) throw err;
    console.error("DashboardLayout CRITICAL Error:", err);
    redirect(`/login?error=critical_layout_error&msg=${encodeURIComponent(err.message || "Unknown error")}`);
  }
}
