"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import {
  connectWordPressAccount,
  connectBloggerAccount,
  disconnectAccount,
  getBloggerAuthUrl,
} from "@/lib/actions/publication";
import {
  Globe,
  Link2,
  Unlink,
  ExternalLink,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface Platform {
  id: string;
  code: string;
  name: string;
}

interface PlatformAccount {
  id: string;
  platform_id: string;
  account_name: string;
  site_url: string;
  connection_status: string;
  last_verified_at: string;
  platforms: Platform;
}

export default function IntegrationsSettingsPage() {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnectingWp, setIsConnectingWp] = useState(false);
  const [isConnectingBlogger, setIsConnectingBlogger] = useState(false);

  // 무료 플랜 검사 통계
  const [currentUsage, setCurrentUsage] = useState(0);
  const [maxLimit, setMaxLimit] = useState(1);
  const [planCode, setPlanCode] = useState("FREE");

  // 워드프레스 폼 상태
  const [wpUrl, setWpUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpAppPassword, setWpAppPassword] = useState("");
  const [wpAccountName, setWpAccountName] = useState("");

  // Blogger 폼 상태 (수동 인증 코드 입력용)
  const [bloggerCode, setBloggerCode] = useState("");

  const toast = useToast();
  const supabase = createClient();

  // 계정 목록 및 제한 정보 페치
  async function loadData() {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. 워크스페이스 멤버 정보 조회 -> 워크스페이스 플랜
      const { data: member } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(plan_code)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (member && (member as any).workspaces) {
        const pCode = (member as any).workspaces.plan_code || "FREE";
        setPlanCode(pCode);
        setMaxLimit(pCode === "FREE" ? 1 : 9999);
      }

      // 2. 플랫폼 정보 조회
      const { data: platList } = await supabase.from("platforms").select("id, code, name");
      if (platList) {
        setPlatforms(platList);
      }

      // 3. 연동 계정 리스트 조회
      const { data: accList, error } = await supabase
        .from("platform_accounts")
        .select(`
          *,
          platforms:platform_id (
            id,
            code,
            name
          )
        `);

      if (error) {
        toast.error("연동 계정 목록을 불러오지 못했습니다.");
      } else if (accList) {
        setAccounts(accList as any[]);
        setCurrentUsage(accList.length);
      }
    } catch {
      toast.error("데이터 로드 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // 워드프레스 추가 핸들러
  const handleConnectWp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wpUrl || !wpUsername || !wpAppPassword) {
      toast.error("필수 입력값을 입력해 주세요.");
      return;
    }

    if (currentUsage >= maxLimit) {
      toast.error(`무료 플랜에서는 최대 ${maxLimit}개의 계정만 연동할 수 있습니다. 상위 플랜으로 업그레이드하세요.`);
      return;
    }

    setIsConnectingWp(true);
    const toastId = toast.loading("워드프레스 인증 자격 증명 검증 중...");

    try {
      await connectWordPressAccount(wpUrl, wpUsername, wpAppPassword, wpAccountName);
      toast.dismiss(toastId);
      toast.success("워드프레스 계정이 성공적으로 연동되었습니다.");
      // 폼 비우기
      setWpUrl("");
      setWpUsername("");
      setWpAppPassword("");
      setWpAccountName("");
      loadData();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "워드프레스 계정 연동에 실패했습니다.");
    } finally {
      setIsConnectingWp(false);
    }
  };

  // 구글 Blogger 연동 핸들러
  const handleBloggerAuthRedirect = async () => {
    try {
      const authUrl = await getBloggerAuthUrl();
      window.open(authUrl, "_blank");
      toast.success("Google OAuth 2.0 인증 동의 탭을 새 창으로 열었습니다. 코드를 수신한 뒤 입력해 주세요.");
    } catch (err: any) {
      toast.error(`인증 URL 획득 실패: ${err.message}`);
    }
  };

  const handleConnectBloggerWithCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bloggerCode.trim()) {
      toast.error("Google OAuth 인가 코드(Code)를 입력해 주세요.");
      return;
    }

    if (currentUsage >= maxLimit) {
      toast.error(`무료 플랜에서는 최대 ${maxLimit}개의 계정만 연동할 수 있습니다.`);
      return;
    }

    setIsConnectingBlogger(true);
    const toastId = toast.loading("Blogger Google OAuth 토큰 교환 및 검증 중...");

    try {
      await connectBloggerAccount(bloggerCode.trim());
      toast.dismiss(toastId);
      toast.success("Blogger 계정이 성공적으로 연동되었습니다.");
      setBloggerCode("");
      loadData();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "Blogger 계정 연동에 실패했습니다.");
    } finally {
      setIsConnectingBlogger(false);
    }
  };

  // 계정 삭제 핸들러
  const handleDeleteAccount = async (accountId: string, accountName: string) => {
    if (!confirm(`[${accountName}] 계정 연동을 해제하시겠습니까?`)) return;

    const toastId = toast.loading("계정 연동 해제 중...");
    try {
      await disconnectAccount(accountId);
      toast.dismiss(toastId);
      toast.success("계정 연동이 해제되었습니다.");
      loadData();
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(err.message || "연동 해제 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="space-y-8">
      {/* 타이틀 및 헤더 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-700 dark:from-zinc-50 dark:to-zinc-300 bg-clip-text text-transparent">
          외부 플랫폼 연동 관리
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1.5">
          콘텐츠를 즉시 발행할 외부 CMS 플랫폼 계정(워드프레스, 구글 Blogger)을 연동하고 편집합니다.
        </p>
      </div>

      {/* 플랜 사용량 제한 배너 */}
      <div className="p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 text-primary rounded-lg">
            <Link2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">Workspace Plan: {planCode}</p>
            <p className="text-sm font-bold text-zinc-700 dark:text-zinc-200 mt-0.5">
              연동 가능한 외부 채널 계정 한도
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-primary">
            {currentUsage} <span className="text-zinc-400 font-normal">/ {planCode === "FREE" ? "1개" : "무제한"}</span>
          </p>
          {planCode === "FREE" && currentUsage >= 1 && (
            <p className="text-[10px] text-amber-500 font-bold mt-0.5">
              ★ 무료 플랜 제한 도달
            </p>
          )}
        </div>
      </div>

      {/* 1. 연동 완료된 계정 리스트 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-zinc-700 dark:text-zinc-300">연동된 채널 목록</h2>
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 transition text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            title="새로고침"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-center bg-zinc-50/50 dark:bg-zinc-900/10">
            <AlertTriangle className="h-8 w-8 text-zinc-400 mb-2" />
            <p className="text-xs font-semibold text-zinc-500">연동된 외부 계정이 없습니다.</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">아래의 워드프레스나 Blogger 카드를 통해 연동해 주세요.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/40 dark:border-zinc-700/40">
                      {acc.platforms?.name || "CMS"}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        acc.connection_status === "CONNECTED"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : acc.connection_status === "EXPIRED"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          acc.connection_status === "CONNECTED" ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                      />
                      {acc.connection_status}
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-zinc-800 dark:text-zinc-200 mt-2.5 truncate">
                    {acc.account_name}
                  </h3>
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 truncate flex items-center gap-1">
                    <Globe className="h-3 w-3 flex-shrink-0" />
                    {acc.site_url}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/80 pt-3 mt-4">
                  <span className="text-[9px] text-zinc-400">
                    인증: {new Date(acc.last_verified_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDeleteAccount(acc.id, acc.account_name)}
                    className="p-1 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
                    title="연동 해제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800" />

      {/* 2. 신규 계정 추가 카드들 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 워드프레스 추가 폼 */}
        <div className="p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-black text-sm text-zinc-700 dark:text-zinc-300">
              WP
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">WordPress 연결</h3>
              <p className="text-[10px] text-zinc-400">Application Password 인증이 활성화되어 있어야 합니다.</p>
            </div>
          </div>

          <form onSubmit={handleConnectWp} className="space-y-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">
                사이트 루트 주소 (필수)
              </label>
              <input
                type="text"
                value={wpUrl}
                onChange={(e) => setWpUrl(e.target.value)}
                placeholder="예: https://myblog.com"
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary text-zinc-800 dark:text-zinc-100"
                disabled={currentUsage >= maxLimit}
              />
            </div>
            <div className="grid gap-3 grid-cols-2">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">
                  관리자 아이디 (ID)
                </label>
                <input
                  type="text"
                  value={wpUsername}
                  onChange={(e) => setWpUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary text-zinc-800 dark:text-zinc-100"
                  disabled={currentUsage >= maxLimit}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">
                  애플리케이션 비밀번호
                </label>
                <input
                  type="password"
                  value={wpAppPassword}
                  onChange={(e) => setWpAppPassword(e.target.value)}
                  placeholder="abcd efgh ijkl mnop"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary text-zinc-800 dark:text-zinc-100"
                  disabled={currentUsage >= maxLimit}
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">
                계정 별칭 (선택)
              </label>
              <input
                type="text"
                value={wpAccountName}
                onChange={(e) => setWpAccountName(e.target.value)}
                placeholder="예: 내 기술 블로그"
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary text-zinc-800 dark:text-zinc-100"
                disabled={currentUsage >= maxLimit}
              />
            </div>

            <button
              type="submit"
              disabled={isConnectingWp || currentUsage >= maxLimit}
              className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-primary hover:bg-primary/95 text-white disabled:opacity-50 transition cursor-pointer"
            >
              {isConnectingWp ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              WordPress 계정 연결
            </button>
          </form>
        </div>

        {/* Blogger 추가 폼 */}
        <div className="p-5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-black text-sm">
              B
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">Google Blogger 연결</h3>
              <p className="text-[10px] text-zinc-400">Google OAuth 2.0으로 블로그 관리 권한을 획득합니다.</p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-[11px] text-zinc-500 leading-relaxed">
                구글 로그인 동의창을 통해 blogger 권한 승인 후, Redirect 된 주소 내의 
                <strong className="text-primary mx-0.5">code=</strong> 값을 복사해서 아래 입력창에 넣어 주세요.
              </p>
              <button
                onClick={handleBloggerAuthRedirect}
                disabled={currentUsage >= maxLimit}
                className="w-full mt-2 flex items-center justify-center gap-1 px-3 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-850 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-300 transition cursor-pointer"
              >
                Google OAuth 동의창 열기
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>

            <form onSubmit={handleConnectBloggerWithCode} className="space-y-3 pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">
                  인가 코드 (OAuth Code) 입력
                </label>
                <input
                  type="text"
                  value={bloggerCode}
                  onChange={(e) => setBloggerCode(e.target.value)}
                  placeholder="예: 4/0Afu... (테스트/E2E 시 'mock-code' 입력)"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary text-zinc-800 dark:text-zinc-100"
                  disabled={currentUsage >= maxLimit}
                />
              </div>

              <button
                type="submit"
                disabled={isConnectingBlogger || currentUsage >= maxLimit}
                className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50 transition cursor-pointer"
              >
                {isConnectingBlogger ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Blogger 계정 연결
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
