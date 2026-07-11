"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { generateBrief, approveBrief } from "@/lib/actions/generation";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  FileText,
  User,
  AlertCircle,
  Lightbulb,
  ShieldAlert,
  Compass,
  ChevronRight,
  Loader2,
  Lock,
} from "lucide-react";

interface BriefClientProps {
  project: any;
  initialBrief: any;
}

export default function BriefClient({ project, initialBrief }: BriefClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [brief, setBrief] = useState(initialBrief);
  const [isGenerating, startGenerating] = useTransition();
  const [isApproving, startApproving] = useTransition();

  // 브리프 생성 핸들러
  const handleGenerate = () => {
    startGenerating(async () => {
      try {
        const result = await generateBrief(project.id);
        setBrief(result);
        toast.success("AI 기획 브리프가 성공적으로 작성되었습니다.");
      } catch (err: any) {
        toast.error(`브리프 생성 실패: ${err.message}`);
      }
    });
  };

  // 브리프 승인 및 개요 단계 전이 핸들러
  const handleApprove = () => {
    startApproving(async () => {
      try {
        await approveBrief(project.id);
        toast.success("기획 브리프가 승인되었습니다. 다음 개요 단계로 이동합니다.");
        router.push(`/contents/${project.id}/outline`);
        router.refresh();
      } catch (err: any) {
        toast.error(`브리프 승인 실패: ${err.message}`);
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 상단 내비게이션 바 */}
      <div className="flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50 pb-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/contents/${project.id}`}
            className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              AI 콘텐츠 생성 엔진
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-medium">
              기획 마법사 데이터를 토대로 AI가 타겟 전략을 구체화합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 단계 인디케이터 (Stepper) */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200/40 dark:border-zinc-850">
        <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 text-xs font-bold text-purple-600 dark:text-purple-400 shadow-sm border border-zinc-200/20">
          <Sparkles className="h-3.5 w-3.5" />
          <span>STEP 1. 기획 브리프</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400">
          <FileText className="h-3.5 w-3.5" />
          <span>STEP 2. 목차 개요</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400">
          <Compass className="h-3.5 w-3.5" />
          <span>STEP 3. 플랫폼 본문</span>
        </div>
      </div>

      {/* 메인 콘텐츠 영역 */}
      {!brief ? (
        // 브리프 미생성 대기 상태
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-3xl p-12 text-center shadow-sm space-y-6">
          <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto border border-purple-500/20">
            <Sparkles className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">AI 기획 브리프를 분석해 볼까요?</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              확정된 {project.title} 기획 주제와 수집된 사실 정보를 바탕으로 타겟 독자 맞춤 검색의도, 강점 소구 포인트, 핵심 메시지를 도출합니다.
            </p>
          </div>
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white disabled:bg-zinc-300 dark:disabled:bg-zinc-850 disabled:text-zinc-500 rounded-2xl text-xs font-bold transition-all shadow-md shadow-purple-600/10 hover:shadow-purple-600/20 border border-transparent disabled:border-zinc-200 dark:disabled:border-zinc-800"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                브리프 기획 분석 중...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                기획 브리프 분석 생성하기
              </>
            )}
          </button>
        </div>
      ) : (
        // 브리프 수립 완료 뷰
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 좌측: 기획 핵심 명세 */}
            <div className="md:col-span-2 space-y-6">
              {/* 핵심 요약 */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  1. 브리프 핵심 기획 내용
                </h3>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-bold block">독자 타겟 페르소나</span>
                    <div className="flex items-start gap-2 bg-zinc-50 dark:bg-zinc-950/20 p-3 rounded-xl border border-zinc-150 dark:border-zinc-850">
                      <User className="h-4 w-4 text-purple-500 shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 leading-normal">
                        {brief.target_audience || "미지정"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-bold block">독자가 안고 있는 문제 (Pain Point)</span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-350 leading-relaxed font-semibold">
                      {brief.audience_problem}
                    </p>
                  </div>

                  <div className="space-y-1 border-t border-zinc-100 dark:border-zinc-850 pt-3">
                    <span className="text-[10px] text-zinc-400 font-bold block">검색 의도 (Search Intent)</span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-350 leading-relaxed">
                      {brief.search_intent}
                    </p>
                  </div>

                  <div className="space-y-1 border-t border-zinc-100 dark:border-zinc-850 pt-3">
                    <span className="text-[10px] text-zinc-400 font-bold block">답변 및 해결 방안 (Core Answer)</span>
                    <p className="text-xs text-zinc-700 dark:text-zinc-350 leading-relaxed font-medium">
                      {brief.core_answer}
                    </p>
                  </div>

                  <div className="space-y-1 border-t border-zinc-100 dark:border-zinc-850 pt-3">
                    <span className="text-[10px] text-zinc-400 font-bold block">핵심 전달 메시지</span>
                    <p className="text-xs text-purple-600 dark:text-purple-400 font-extrabold leading-relaxed">
                      {brief.core_message}
                    </p>
                  </div>
                </div>
              </div>

              {/* 지지 증거 및 사실 요약 */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
                  2. 수집된 E-E-A-T 사실 정보 요약
                </h3>
                <ul className="space-y-2">
                  {(brief.facts_summary || []).map((fact: string, idx: number) => (
                    <li key={idx} className="flex gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                      <span className="text-purple-500 font-bold shrink-0">•</span>
                      <span>{fact}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 우측: 제한 사항 및 CTA 액션바 */}
            <div className="space-y-6">
              {/* 가이드라인 / 규칙 제한 */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-3">
                <h3 className="text-xs font-extrabold text-red-500 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-1">
                  <ShieldAlert className="h-4 w-4" />
                  글쓰기 제한 및 금지사항
                </h3>
                <ul className="space-y-2">
                  {(brief.restrictions || []).map((rest: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5 text-xs text-zinc-500">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span>{rest}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* 추천 액션 메시지 */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-3">
                <h3 className="text-xs font-extrabold text-emerald-600 dark:text-emerald-450 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-1">
                  <Lightbulb className="h-4 w-4" />
                  제안된 본문 내 CTA 설계안
                </h3>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-semibold">
                  {brief.proposed_cta}
                </p>
              </div>

              {/* 브리프 승인 패널 */}
              <div className="bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200/60 dark:border-zinc-850 rounded-2xl p-6 space-y-4">
                <div className="space-y-1">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">브리프 검토 상태</span>
                  <p className="text-[10px] text-zinc-500">
                    {brief.approved_at ? (
                      <span className="text-emerald-600 dark:text-emerald-450 font-bold flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        승인 시간: {new Date(brief.approved_at).toLocaleString()}
                      </span>
                    ) : (
                      "상기 타겟 방향성이 적절한지 승인을 기다리는 중입니다."
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                  {brief.approved_at ? (
                    <Link
                      href={`/contents/${project.id}/outline`}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-900 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white rounded-xl text-xs font-bold transition-all"
                    >
                      승인 완료: 목차 개요로 이동
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <>
                      <button
                        onClick={handleApprove}
                        disabled={isApproving}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-300 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/10"
                      >
                        {isApproving ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                            브리프 확정 승인 중...
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            브리프 승인하고 개요로 이동
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-xl text-xs font-bold text-zinc-500 transition-all"
                      >
                        {isGenerating ? "분석 중..." : "AI 기획 브리프 다시 쓰기"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
