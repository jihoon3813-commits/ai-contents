"use client";

import React, { useState } from "react";
import { useToast } from "@/components/ui/toast";
import {
  toggleAdminStatus,
  updateWorkspacePlan,
  resolveErrorLog,
} from "@/lib/actions/admin";
import {
  Users,
  Briefcase,
  AlertOctagon,
  Terminal,
  CheckCircle,
  Clock,
  Shield,
  Loader2,
  RefreshCw,
} from "lucide-react";

interface Profile {
  id: string;
  name: string;
  avatar_url: string;
  timezone: string;
  language: string;
  is_admin: boolean;
  created_at: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  plan_code: string;
  created_at: string;
}

interface ErrorLog {
  id: string;
  workspace_id: string | null;
  user_id: string | null;
  feature: string;
  error_type: string;
  message: string;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

interface PromptTemplate {
  id: string;
  code: string;
  title: string;
  template_text: string;
}

interface AdminClientProps {
  initialData: {
    profiles: Profile[];
    workspaces: Workspace[];
    errorLogs: ErrorLog[];
    promptTemplates: PromptTemplate[];
  };
}

export default function AdminClient({ initialData }: AdminClientProps) {
  const [data, setData] = useState(initialData);
  const [activeTab, setActiveTab] = useState<"users" | "workspaces" | "errors" | "prompts">("users");
  const [isProcessing, setIsProcessing] = useState(false);

  const toast = useToast();

  // 대시보드 강제 리로드 액션
  const handleReload = async () => {
    setIsProcessing(true);
    const toastId = toast.loading("최신 데이터를 조회하는 중...");
    try {
      const { getAdminDashboardData } = await import("@/lib/actions/admin");
      const fresh = await getAdminDashboardData();
      setData(fresh as any);
      toast.dismiss(toastId);
      toast.success("데이터가 동기화되었습니다.");
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error(`조회 실패: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 사용자 어드민 등급 변경 토글
  const handleToggleAdmin = async (userId: string, currentVal: boolean) => {
    setIsProcessing(true);
    const targetVal = !currentVal;
    try {
      await toggleAdminStatus(userId, targetVal);
      toast.success(`관리자 권한이 성공적으로 ${targetVal ? "부여" : "회수"}되었습니다.`);
      // 로컬 스태이트 업데이트
      setData((prev) => ({
        ...prev,
        profiles: prev.profiles.map((p) => (p.id === userId ? { ...p, is_admin: targetVal } : p)),
      }));
    } catch (err: any) {
      toast.error(err.message || "작업을 완료할 수 없습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 구독 등급 수동 조율
  const handlePlanChange = async (workspaceId: string, planCode: string) => {
    setIsProcessing(true);
    try {
      await updateWorkspacePlan(workspaceId, planCode);
      toast.success(`워크스페이스 구독 등급이 [${planCode}]로 설정되었습니다.`);
      setData((prev) => ({
        ...prev,
        workspaces: prev.workspaces.map((w) => (w.id === workspaceId ? { ...w, plan_code: planCode } : w)),
      }));
    } catch (err: any) {
      toast.error(err.message || "구독 수정에 실패했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  // 장애 조치 완료
  const handleResolveError = async (logId: string) => {
    setIsProcessing(true);
    try {
      await resolveErrorLog(logId);
      toast.success("해당 시스템 장애 상태가 해결 완료로 조치되었습니다.");
      setData((prev) => ({
        ...prev,
        errorLogs: prev.errorLogs.map((e) =>
          e.id === logId ? { ...e, resolved: true, resolved_at: new Date().toISOString() } : e
        ),
      }));
    } catch (err: any) {
      toast.error(err.message || "장애 해소 처리에 실패했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 타이틀 영역 */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-zinc-950 to-zinc-700 dark:from-zinc-50 dark:to-zinc-300 bg-clip-text text-transparent">
            시스템 관리자 대시보드
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            전체 사용자, 워크스페이스 요금제 통제, AI 엔진 장애 감사, 시스템 템플릿 모니터링을 관장합니다.
          </p>
        </div>
        <button
          onClick={handleReload}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 text-xs font-bold text-zinc-600 dark:text-zinc-300 disabled:opacity-50 cursor-pointer"
        >
          {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          동기화
        </button>
      </div>

      {/* 대시보드 통계 카드 요약 */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <div className="p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <p className="text-[10px] text-zinc-400 font-bold">전체 가입자</p>
          <p className="text-xl font-black text-zinc-800 dark:text-zinc-150 mt-1">{data.profiles.length}명</p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <p className="text-[10px] text-zinc-400 font-bold">생성된 워크스페이스</p>
          <p className="text-xl font-black text-zinc-800 dark:text-zinc-150 mt-1">{data.workspaces.length}개</p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <p className="text-[10px] text-zinc-400 font-bold">미해결 장애/실패</p>
          <p className="text-xl font-black text-rose-600 mt-1">
            {data.errorLogs.filter((e) => !e.resolved).length}건
          </p>
        </div>
        <div className="p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <p className="text-[10px] text-zinc-400 font-bold">시스템 프롬프트</p>
          <p className="text-xl font-black text-purple-600 mt-1">{data.promptTemplates.length}개</p>
        </div>
      </div>

      {/* 탭 헤더 */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <button
          onClick={() => setActiveTab("users")}
          className={`pb-3 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "users"
              ? "border-b-2 border-primary text-primary"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          <Users className="h-4 w-4" />
          가입 사용자 관리
        </button>
        <button
          onClick={() => setActiveTab("workspaces")}
          className={`pb-3 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "workspaces"
              ? "border-b-2 border-primary text-primary"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          <Briefcase className="h-4 w-4" />
          워크스페이스 플랜
        </button>
        <button
          onClick={() => setActiveTab("errors")}
          className={`pb-3 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "errors"
              ? "border-b-2 border-primary text-primary"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          <AlertOctagon className="h-4 w-4" />
          장애 감사 모니터링
        </button>
        <button
          onClick={() => setActiveTab("prompts")}
          className={`pb-3 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            activeTab === "prompts"
              ? "border-b-2 border-primary text-primary"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          <Terminal className="h-4 w-4" />
          프롬프트 템플릿
        </button>
      </div>

      {/* 탭 상세 콘텐츠 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800 rounded-2xl p-6 shadow-sm min-h-[400px]">
        {/* 1. 사용자 관리 */}
        {activeTab === "users" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">가입 계정 명부</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-bold">
                    <th className="py-2.5">사용자명</th>
                    <th className="py-2.5">고유 ID (UUID)</th>
                    <th className="py-2.5">로컬 시간대</th>
                    <th className="py-2.5 text-center">관리자 임명</th>
                    <th className="py-2.5 text-right">가입 시각</th>
                  </tr>
                </thead>
                <tbody>
                  {data.profiles.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800/60 text-zinc-700 dark:text-zinc-350">
                      <td className="py-3 font-bold">{p.name}</td>
                      <td className="py-3 font-mono text-[10px] text-zinc-400">{p.id}</td>
                      <td className="py-3">{p.timezone}</td>
                      <td className="py-3 text-center">
                        <button
                          onClick={() => handleToggleAdmin(p.id, p.is_admin)}
                          className={`px-2 py-1 rounded text-[10px] font-black transition cursor-pointer ${
                            p.is_admin
                              ? "bg-purple-600/10 text-purple-600 border border-purple-500/25"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600"
                          }`}
                        >
                          {p.is_admin ? "ADMIN" : "일반"}
                        </button>
                      </td>
                      <td className="py-3 text-right text-[10px] text-zinc-400">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. 워크스페이스 플랜 */}
        {activeTab === "workspaces" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">워크스페이스 구독 조정</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-bold">
                    <th className="py-2.5">워크스페이스 이름</th>
                    <th className="py-2.5">슬러그 (Slug)</th>
                    <th className="py-2.5">구독 등급 변경</th>
                    <th className="py-2.5 text-right">개설 시각</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workspaces.map((w) => (
                    <tr key={w.id} className="border-b border-zinc-100 dark:border-zinc-800/60 text-zinc-700 dark:text-zinc-350">
                      <td className="py-3 font-bold">{w.name}</td>
                      <td className="py-3 font-mono text-[10px] text-zinc-400">{w.slug}</td>
                      <td className="py-3">
                        <select
                          value={w.plan_code}
                          onChange={(e) => handlePlanChange(w.id, e.target.value)}
                          className="px-2 py-1 text-xs rounded border border-zinc-250 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="FREE">FREE 플랜</option>
                          <option value="ENTERPRISE">ENTERPRISE 플랜</option>
                        </select>
                      </td>
                      <td className="py-3 text-right text-[10px] text-zinc-400">
                        {new Date(w.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. 장애 감사 모니터링 */}
        {activeTab === "errors" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">시스템 에러 로그 내역</h3>
            {data.errorLogs.length === 0 ? (
              <p className="text-xs text-zinc-400 italic">감사 대상 에러 로그가 존재하지 않습니다.</p>
            ) : (
              <div className="space-y-3">
                {data.errorLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800 bg-white dark:bg-zinc-950/20 space-y-2 flex flex-col justify-between md:flex-row md:items-start"
                  >
                    <div className="space-y-1 md:max-w-2xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-550 dark:text-zinc-400 border border-zinc-200/50">
                          {log.feature}
                        </span>
                        <span className="text-[9px] font-bold text-zinc-400">
                          {log.error_type}
                        </span>
                        <span
                          className={`text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                            log.resolved
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {log.resolved ? (
                            <>
                              <CheckCircle className="h-2.5 w-2.5" />
                              조치 완료
                            </>
                          ) : (
                            <>
                              <Clock className="h-2.5 w-2.5" />
                              대기 중
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-[11.5px] font-bold text-zinc-800 dark:text-zinc-250 leading-relaxed pt-1">
                        {log.message}
                      </p>
                      <p className="text-[9px] text-zinc-400">
                        발생: {new Date(log.created_at).toLocaleString()}
                        {log.resolved_at && ` | 조치: ${new Date(log.resolved_at).toLocaleString()}`}
                      </p>
                    </div>

                    {!log.resolved && (
                      <button
                        onClick={() => handleResolveError(log.id)}
                        className="mt-3 md:mt-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-550 text-white font-black text-[10.5px] rounded-lg shadow-sm cursor-pointer"
                      >
                        조치 처리 완료
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 4. 프롬프트 템플릿 */}
        {activeTab === "prompts" && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-zinc-700 dark:text-zinc-300 mb-2">프롬프트 템플릿 현황 조회</h3>
            <div className="space-y-6">
              {data.promptTemplates.map((pt) => (
                <div key={pt.id} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-purple-600 dark:text-purple-400">
                      [{pt.code}]
                    </span>
                    <h4 className="font-bold text-sm text-zinc-800 dark:text-zinc-200">
                      {pt.title}
                    </h4>
                  </div>
                  <pre className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-600 dark:text-zinc-450 font-mono overflow-x-auto leading-relaxed max-h-[220px]">
                    {pt.template_text}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
