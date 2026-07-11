"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { getJobStatus, cancelJob } from "@/lib/actions/generation";
import {
  Loader2,
  Sparkles,
  StopCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Info,
  Layers,
  FileText,
  Compass,
} from "lucide-react";

interface GeneratingClientProps {
  project: any;
}

export default function GeneratingClient({ project }: GeneratingClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [jobStatus, setJobStatus] = useState<string>("QUEUED");
  const [jobId, setJobId] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [completedSections, setCompletedSections] = useState<number>(0);
  const [totalSections, setTotalSections] = useState<number>(0);
  const [contents, setContents] = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);

  const [isCancelling, startCancelling] = useTransition();

  const isFinishedRef = React.useRef(false);

  // 브라우저 전역 완료 플래그 초기화
  useEffect(() => {
    if (typeof window !== "undefined") {
      const win = window as any;
      if (!win.__generatingFinished) {
        win.__generatingFinished = {};
      }
    }
  }, []);

  // 1. 사전 프리패치 유즈이펙트 (결과 화면 전환 최적화)
  useEffect(() => {
    router.prefetch(`/contents/${project.id}/result`);
  }, [project.id, router]);

  // 2. 2초 간격 폴링 유즈이펙트
  useEffect(() => {
    const checkGlobalFinished = () => {
      if (typeof window !== "undefined") {
        return !!(window as any).__generatingFinished?.[project.id];
      }
      return false;
    };

    if (isFinishedRef.current || checkGlobalFinished()) return;
    let timer: NodeJS.Timeout;

    const poll = async () => {
      if (isFinishedRef.current || checkGlobalFinished()) return;
      try {
        const status = await getJobStatus(project.id);
        
        if (isFinishedRef.current || checkGlobalFinished()) return;

        setJobStatus(status.jobStatus);
        setJobId(status.jobId);
        setProgressPercent(status.progressPercent);
        setCompletedSections(status.completedSections);
        setTotalSections(status.totalSections);
        setContents(status.contents);
        setSections(status.sections);

        // 완료 시 결과 창으로 리다이렉트
        if (status.jobStatus === "COMPLETED") {
          isFinishedRef.current = true;
          if (typeof window !== "undefined") {
            const win = window as any;
            if (!win.__generatingFinished) win.__generatingFinished = {};
            win.__generatingFinished[project.id] = true;
            toast.success("AI 콘텐츠 본문 및 SEO 기획안 생성이 완료되었습니다!");
            setTimeout(() => {
              window.location.href = `/contents/${project.id}/result`;
            }, 50);
            router.push(`/contents/${project.id}/result`);
            return;
          }
        }

        // 실패 시 결과 창으로 이동해서 실패 부분만 개별 복구할 수 있게 유도
        if (status.jobStatus === "FAILED") {
          isFinishedRef.current = true;
          if (typeof window !== "undefined") {
            const win = window as any;
            if (!win.__generatingFinished) win.__generatingFinished = {};
            win.__generatingFinished[project.id] = true;
            toast.error("원고 생성 진행 중 오류가 발생했습니다. 실패한 섹션을 검토해 주세요.");
            setTimeout(() => {
              window.location.href = `/contents/${project.id}/result`;
            }, 50);
            router.push(`/contents/${project.id}/result`);
            return;
          }
        }

        // 취소된 경우 개요 화면으로
        if (status.jobStatus === "CANCELLED") {
          isFinishedRef.current = true;
          if (typeof window !== "undefined") {
            const win = window as any;
            if (!win.__generatingFinished) win.__generatingFinished = {};
            win.__generatingFinished[project.id] = true;
            toast.error("콘텐츠 생성이 취소되었습니다.");
            setTimeout(() => {
              window.location.href = `/contents/${project.id}/outline`;
            }, 50);
            router.push(`/contents/${project.id}/outline`);
            return;
          }
        }

        // 다음 주기 폴링 예약
        timer = setTimeout(poll, 2000);
      } catch (err: any) {
        console.error("폴링 조회 오류:", err.message);
        if (!isFinishedRef.current && !checkGlobalFinished()) {
          timer = setTimeout(poll, 3000); // 오류 시 조금 더 넓은 주기로 재시도
        }
      }
    };

    poll();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [project.id, router, toast]);

  // 작업 취소 트리거
  const handleCancel = () => {
    if (!jobId) return;
    if (confirm("정말로 콘텐츠 생성을 취소하시겠습니까? 현재까지 진행된 단락들만 임시 저장됩니다.")) {
      startCancelling(async () => {
        try {
          await cancelJob(jobId);
          toast.success("생성 취소 명령이 성공적으로 전송되었습니다.");
          router.push(`/contents/${project.id}/outline`);
        } catch (err: any) {
          toast.error(`취소 실패: ${err.message}`);
        }
      });
    }
  };

  // 플랫폼 한글 매핑 헬퍼
  const getPlatformLabel = (platformId: string) => {
    // ID 기준으로 매칭 흉내 (보통 layout에 저장된 platforms 데이터 연계 가능)
    if (platformId.startsWith("p1")) return "워드프레스";
    if (platformId.startsWith("p2")) return "Blogger";
    if (platformId.startsWith("p3")) return "티스토리";
    if (platformId.startsWith("p4")) return "네이버 블로그";
    if (platformId.startsWith("p5")) return "인스타그램";
    return "소셜 플랫폼";
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* 상단 레이아웃 */}
      <div className="text-center space-y-2 pb-2">
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-purple-600 dark:text-purple-400" />
          플랫폼별 콘텐츠 초안 생성 중
        </h1>
        <p className="text-xs text-zinc-500 font-medium">
          AI가 채널 가이드라인 규칙에 맞춰 문단별 원고를 순차 집필하고 있습니다.
        </p>
      </div>

      {/* Stepper */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200/40 dark:border-zinc-850">
        <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-zinc-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-zinc-350" />
          <span>브리프 수립</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-zinc-400">
          <CheckCircle2 className="h-3.5 w-3.5 text-zinc-350" />
          <span>목차 개요</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white dark:bg-zinc-800 text-xs font-bold text-purple-600 dark:text-purple-400 shadow-sm border border-zinc-200/20 animate-pulse">
          <Sparkles className="h-3.5 w-3.5" />
          <span>본문 작성 중</span>
        </div>
      </div>

      {/* 실시간 진행률 게이지 카드 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-extrabold text-purple-600 dark:text-purple-400">전체 생성 진행도</span>
            <span className="font-bold text-zinc-700 dark:text-zinc-300">
              {progressPercent}% ({completedSections} / {totalSections} 단락 완료)
            </span>
          </div>

          {/* 게이지바 */}
          <div className="w-full bg-zinc-100 dark:bg-zinc-950/40 h-2.5 rounded-full overflow-hidden border border-zinc-200/20">
            <div
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* 안내 배지 */}
        <div className="bg-purple-550/5 dark:bg-purple-950/10 border border-purple-500/10 rounded-xl p-3.5 flex items-start gap-2.5">
          <Info className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300">백그라운드 백그라운드 구동 중</h4>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-semibold">
              본 작업은 백그라운드 스레드에서 돌아갑니다. 다른 페이지로 이동하거나 브라우저 탭을 닫아도 콘텐츠 생성은 완전히 안전하게 완료됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* 플랫폼별 진행 상세 목록 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
          채널별 진행 상태 리포트
        </h3>

        <div className="space-y-3">
          {contents.map((c) => (
            <div
              key={c.id}
              className="flex justify-between items-center p-3 border border-zinc-150 dark:border-zinc-850 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {getPlatformLabel(c.platform_id)}
                </span>
                {c.character_count > 0 && (
                  <span className="text-[9px] font-semibold text-zinc-400">
                    ({c.character_count.toLocaleString()}자 작성됨)
                  </span>
                )}
              </div>

              {/* 상태 뱃지 */}
              <div>
                {c.generation_status === "QUEUED" && (
                  <span className="text-[10px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">대기 중</span>
                )}
                {c.generation_status === "PROCESSING" && (
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-md animate-pulse">본문 기술 중</span>
                )}
                {c.generation_status === "COMPLETED" && (
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md">작성 완료</span>
                )}
                {c.generation_status === "FAILED" && (
                  <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-md">생성 보류/실패</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 생성 상세 소제목 목록 로그 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
          실시간 집필 단락 로그
        </h3>
        
        <div className="max-h-40 overflow-y-auto space-y-2 pr-1 text-[11px] font-medium text-zinc-500 scrollbar-thin">
          {sections.map((sec, idx) => (
            <div key={sec.id} className="flex justify-between items-center py-1 border-b border-zinc-100/50 dark:border-zinc-850 pb-1">
              <span className="truncate max-w-[280px]">
                {idx + 1}. {sec.heading}
              </span>
              <div>
                {sec.generation_status === "QUEUED" && <span className="text-zinc-400">대기</span>}
                {sec.generation_status === "PROCESSING" && <span className="text-purple-600 dark:text-purple-400 font-bold animate-pulse">집필 중...</span>}
                {sec.generation_status === "COMPLETED" && <span className="text-emerald-500 font-semibold">완료</span>}
                {sec.generation_status === "FAILED" && <span className="text-red-500 font-semibold">보류</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 하단 취소 버튼 */}
      {jobId && (jobStatus === "QUEUED" || jobStatus === "PROCESSING") && (
        <button
          onClick={handleCancel}
          disabled={isCancelling}
          className="w-full inline-flex items-center justify-center gap-1.5 py-3 border border-red-200 hover:bg-red-500/5 hover:border-red-300 disabled:opacity-50 text-red-600 rounded-xl text-xs font-bold transition-all bg-white dark:bg-zinc-900"
        >
          <StopCircle className="h-4 w-4" />
          {isCancelling ? "작업 취소 명령 전송 중..." : "AI 본문 생성 중단 (취소)"}
        </button>
      )}
    </div>
  );
}
