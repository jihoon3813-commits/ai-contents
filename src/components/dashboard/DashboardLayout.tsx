"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  LayoutDashboard,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Briefcase,
  Sparkles,
  FileText,
  Link2,
  Shield,
} from "lucide-react";

interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  userEmail: string;
  profile: {
    name: string;
    avatar_url: string | null;
    is_admin?: boolean;
  } | null;
  workspaces: WorkspaceInfo[];
  brandCount: number;
  defaultBrandName: string;
}

export default function DashboardLayoutClient({
  children,
  userEmail,
  profile,
  workspaces,
  brandCount,
  defaultBrandName,
}: DashboardLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();

  const { signOut } = useAuthActions();
  const userName = profile?.name || userEmail.split("@")[0];
  const activeWorkspace = workspaces[0] || { name: "워크스페이스 없음", slug: "" };

  const handleLogout = async () => {
    const loadingId = toast.loading("로그아웃 중...");
    try {
      // 1. Convex 로그아웃 실행
      await signOut();

      // 2. Supabase 로그아웃 안전하게 실행
      try {
        if (supabase && supabase.auth && typeof supabase.auth.signOut === "function") {
          await supabase.auth.signOut();
        }
      } catch (sbErr) {
        console.error("Supabase signOut error:", sbErr);
      }

      toast.dismiss(loadingId);
      toast.success("로그아웃되었습니다.");
      router.push("/login");
      router.refresh();
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`로그아웃 실패: ${err.message || "오류 발생"}`);
    }
  };

  const navItems = [
    { name: "대시보드", href: "/dashboard", icon: LayoutDashboard },
    { name: "브랜드 관리", href: "/brands", icon: Sparkles, count: brandCount },
    { name: "콘텐츠 기획", href: "/contents", icon: FileText },
    { name: "연동 설정", href: "/settings/integrations", icon: Link2 },
    { name: "프로필 설정", href: "/settings/profile", icon: User },
    { name: "워크스페이스 설정", href: "/settings/workspace", icon: Settings },
  ];

  if (profile?.is_admin) {
    navItems.push({ name: "관리자 페이지", href: "/admin", icon: Shield });
  }

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      {/* 1. 데스크톱 사이드바 (md 이상에서 노출) */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-zinc-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-900">
        <div className="flex-1 flex flex-col min-h-0">
          {/* 로고 영역 */}
          <div className="flex items-center h-16 px-6 border-b border-zinc-200/50 dark:border-zinc-800/50">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-lg shadow-md shadow-primary/20 mr-3">
              AI
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
              AI 컨텐츠 봇
            </span>
          </div>

          {/* 워크스페이스 스위처 역할 (현재 활성 워크스페이스 표시) */}
          <div className="px-4 py-4 border-b border-zinc-200/50 dark:border-zinc-800/50">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/40 dark:border-zinc-800/40">
              <Briefcase className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium leading-none">Active Workspace</p>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate mt-0.5">
                  {activeWorkspace.name}
                </p>
                {defaultBrandName && (
                  <p className="text-[10px] text-primary font-bold mt-1 truncate flex items-center gap-0.5">
                    ★ {defaultBrandName}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 메뉴 링크 목록 */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.href === "/dashboard" 
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
                    isActive
                      ? "bg-primary text-white shadow-md shadow-primary/10"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <div className="flex items-center">
                    <Icon className="mr-3 h-4 w-4 flex-shrink-0" />
                    {item.name}
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isActive 
                        ? "bg-white/20 text-white" 
                        : "bg-zinc-100 dark:bg-zinc-850 text-zinc-600 dark:text-zinc-400 border border-zinc-200/35 dark:border-zinc-700/35"
                    }`}>
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* 하단 사용자 정보 및 로그아웃 */}
          <div className="p-4 border-t border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-50/50 dark:bg-zinc-900/50">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                {userName.substring(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 truncate">{userName}</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 truncate">{userEmail}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl border border-transparent hover:border-rose-200/30 dark:hover:border-rose-900/30 transition-all cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* 2. 메인 콘텐츠 영역 */}
      <div className="flex-1 flex flex-col md:pl-64">
        {/* 상단 헤더 */}
        <header className="sticky top-0 z-10 flex-shrink-0 flex h-16 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200/50 dark:border-zinc-800/50 px-4 sm:px-6 justify-between items-center">
          {/* 모바일 햄버거 토글 */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:outline-none"
            aria-label="메뉴 열기"
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* 경로Breadcrumbs 역할 */}
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">AI 컨텐츠 봇</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>
              {pathname === "/dashboard"
                ? "대시보드"
                : pathname === "/settings/profile"
                ? "프로필 설정"
                : pathname === "/settings/workspace"
                ? "워크스페이스 설정"
                : pathname === "/settings/integrations"
                ? "연동 설정"
                : pathname === "/admin"
                ? "관리자 페이지"
                : "설정"}
            </span>
          </div>

          {/* 모바일 화면용 워크스페이스 표시 */}
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
              {activeWorkspace.name}
            </span>
          </div>
        </header>

        {/* 페이지 콘텐츠 */}
        <main className="flex-1 overflow-y-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">{children}</div>
        </main>
      </div>

      {/* 3. 모바일 사이드바 모달 서랍형 (Mobile Drawer) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden" role="dialog" aria-modal="true">
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 bg-zinc-900/60 dark:bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* 서랍 내용 */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800">
            {/* 닫기 버튼 */}
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                aria-label="메뉴 닫기"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>

            {/* 모바일 로고 영역 */}
            <div className="flex items-center h-16 px-6 border-b border-zinc-200 dark:border-zinc-800">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-base shadow-md mr-3">
                AI
              </div>
              <span className="font-bold text-base bg-gradient-to-r from-zinc-900 to-zinc-600 dark:from-zinc-100 dark:to-zinc-400 bg-clip-text text-transparent">
                AI 컨텐츠 봇
              </span>
            </div>

            {/* 모바일 워크스페이스 표시 */}
            <div className="px-4 py-4 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/40">
                <Briefcase className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium leading-none">Workspace</p>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate mt-0.5">
                    {activeWorkspace.name}
                  </p>
                  {defaultBrandName && (
                    <p className="text-[10px] text-primary font-bold mt-1 truncate">
                      ★ {defaultBrandName}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* 모바일 링크 메뉴 */}
            <nav className="flex-grow px-3 py-4 space-y-1.5 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === "/dashboard" 
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
                      isActive
                        ? "bg-primary text-white shadow-md"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    <div className="flex items-center">
                      <Icon className="mr-3 h-4 w-4" />
                      {item.name}
                    </div>
                    {item.count !== undefined && item.count > 0 && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive 
                          ? "bg-white/20 text-white" 
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                      }`}>
                        {item.count}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* 모바일 사용자 푸터 */}
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  {userName.substring(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200 truncate">{userName}</p>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 truncate">{userEmail}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" />
                로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
