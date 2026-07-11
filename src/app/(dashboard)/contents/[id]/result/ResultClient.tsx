"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { retrySection } from "@/lib/actions/generation";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  FileText,
  Compass,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Tag,
  Image as ImageIcon,
  ExternalLink,
  ChevronRight,
} from "lucide-react";

interface ResultClientProps {
  project: any;
  contents: any[];
  initialImagePlans: any[];
}

export default function ResultClient({ project, contents, initialImagePlans }: ResultClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<string>(contents[0]?.id || "");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [retryingSectionId, setRetryingSectionId] = useState<string | null>(null);
  const [isRetrying, startRetrying] = useTransition();

  // 클립보드 복사 헬퍼
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast.success(`${label}이 클립보드에 복사되었습니다.`);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // 개별 실패 섹션 재시도 트리거
  const handleRetrySection = (sectionId: string) => {
    setRetryingSectionId(sectionId);
    startRetrying(async () => {
      try {
        await retrySection(sectionId);
        toast.success("해당 단락 본문 재생성 및 결합에 성공했습니다.");
        router.refresh();
      } catch (err: any) {
        toast.error(`단락 재생성 실패: ${err.message}`);
      } finally {
        setRetryingSectionId(null);
      }
    });
  };

  const activeContent = contents.find((c) => c.id === activeTab);
  const filteredImagePlans = initialImagePlans.filter((ip) => ip.platform_content_id === activeTab);

  if (contents.length === 0) {
    return (
      <div className="max-w-md mx-auto text-center space-y-4 pt-12">
        <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold">생성된 플랫폼 콘텐츠가 없습니다.</h2>
        <Link href={`/contents/${project.id}/outline`} className="text-xs text-purple-600 font-bold hover:underline">
          개요 승인 화면으로 이동
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 상단바 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200/50 dark:border-zinc-800/50 pb-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/contents/${project.id}`}
            className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              AI 콘텐츠 생성 결과
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-medium">
              플랫폼 규격에 맞추어 개별 설계된 완성 초안 기획 리포트입니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/contents/${project.id}/outline`}
            className="px-4 py-2 border border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all"
          >
            목차 개요 다시 편집하기
          </Link>
          <button
            onClick={() => {
              toast.success("프로젝트 초안 최종 확정 완료!");
              router.push(`/contents/${project.id}`);
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-550 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/10"
          >
            초안 검토 완료 및 종료
          </button>
        </div>
      </div>

      {/* 플랫폼 탭 선택바 */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-150 dark:border-zinc-800/40 pb-2">
        {contents.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveTab(c.id)}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all ${
              activeTab === c.id
                ? "bg-purple-600 border-purple-650 text-white shadow-sm"
                : "border-zinc-200 dark:border-zinc-850 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950"
            }`}
          >
            {c.platform_name}
            <span className="text-[9px] opacity-70 ml-1.5 font-semibold">
              ({c.generation_status === "COMPLETED" ? `${c.character_count?.toLocaleString()}자` : "대기/실패"})
            </span>
          </button>
        ))}
      </div>

      {/* 탭 본문 내용 */}
      {activeContent && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측 2개 컬럼: 원고 내용 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 원고 본문 */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-5">
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <h2 className="text-base font-bold text-zinc-850 dark:text-zinc-100">
                  {activeContent.title || "지정된 본문 제목이 없습니다"}
                </h2>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/contents/${project.id}/platform/${activeContent.id}/edit`}
                    className="p-2 border border-purple-200 dark:border-purple-900 bg-purple-500/5 hover:bg-purple-500/10 text-purple-600 rounded-lg transition-all flex items-center gap-1 text-[10px] font-bold"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    상세 본문 직접 편집하기
                  </Link>
                  <button
                    onClick={() => handleCopy(activeContent.body_text || "", "원고 전체 본문")}
                    className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 hover:text-zinc-600 transition-all flex items-center gap-1 text-[10px] font-bold"
                    title="본문 전체 복사"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    본문 전체 복사
                  </button>
                </div>
              </div>

              {/* 단락별(섹션별) 렌더러 및 개별 복구 */}
              <div className="space-y-6 prose dark:prose-invert max-w-none text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-normal">
                {activeContent.sections && activeContent.sections.length > 0 ? (
                  activeContent.sections.map((sec: any) => (
                    <div key={sec.id} className="group relative border-l-2 border-transparent hover:border-purple-500/30 pl-4 py-1 transition-all">
                      
                      {/* 상태에 따른 분기 렌더 */}
                      {sec.generation_status === "PROCESSING" || (isRetrying && retryingSectionId === sec.id) ? (
                        <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                          <span className="text-[10px] font-bold text-purple-600">AI가 문단 본문을 재생성하여 수리하는 중...</span>
                        </div>
                      ) : sec.generation_status === "FAILED" ? (
                        <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl space-y-2">
                          <div className="flex items-center gap-1.5 text-red-600">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span className="text-[10px] font-extrabold">이 단락 생성을 보류했거나 실패했습니다.</span>
                          </div>
                          <p className="text-[10px] text-zinc-500 leading-normal">
                            네트워크 순의적 일시 정체 또는 AI 규격 위반(경험 사칭 등) 사유로 저장되지 않았을 수 있습니다. 아래 재생성 버튼을 통해 원격 본문 복구를 시도할 수 있습니다.
                          </p>
                          <button
                            onClick={() => handleRetrySection(sec.id)}
                            disabled={isRetrying}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-[10px] font-extrabold transition-all"
                          >
                            <RefreshCw className="h-3 w-3 animate-spin-slow" />
                            이 단락 재생성 복구하기
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <h4 className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 my-0">
                              {sec.heading}
                            </h4>
                            <button
                              onClick={() => handleCopy(sec.body_text || "", "단락 텍스트")}
                              className="opacity-0 group-hover:opacity-100 p-1 border border-zinc-200 dark:border-zinc-800 rounded-md hover:bg-zinc-150 text-zinc-400 hover:text-zinc-600 transition-all"
                              title="이 단락만 복사"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                          <div
                            dangerouslySetInnerHTML={{ __html: sec.body_html || "" }}
                            className="rich-html-body"
                          />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-zinc-400 text-center">아직 본문 단락이 작성되지 않았습니다.</p>
                )}
              </div>
            </div>

            {/* 이미지 계획안 */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-1">
                <ImageIcon className="h-4 w-4" />
                추천 이미지 기획 구성안 ({filteredImagePlans.length})
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredImagePlans.map((ip) => (
                  <div
                    key={ip.id}
                    className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 space-y-3 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-extrabold text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-lg">
                        #{ip.sequence_number} 위치
                      </span>
                      <span className="text-[10px] font-bold text-zinc-500">비율: {ip.aspect_ratio}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-400 font-bold block">이미지 역할</span>
                      <p className="font-bold text-zinc-700 dark:text-zinc-300">{ip.role}</p>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-400 font-bold block">화면 구성 및 설명</span>
                      <p className="text-[11px] text-zinc-500 leading-normal">{ip.description}</p>
                    </div>

                    {ip.overlay_text && (
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-400 font-bold block">오버레이 텍스트 문구</span>
                        <p className="font-extrabold text-[11px] text-indigo-600">{ip.overlay_text}</p>
                      </div>
                    )}

                    <div className="space-y-1 border-t border-zinc-200/50 dark:border-zinc-800/50 pt-2 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] text-zinc-400 font-bold">생성 프롬프트</span>
                        <button
                          onClick={() => handleCopy(ip.prompt || "", "이미지 프롬프트")}
                          className="p-1 border border-zinc-200 dark:border-zinc-850 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-all"
                          title="프롬프트 복사"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="text-[9px] bg-zinc-100 dark:bg-zinc-950 p-2 rounded border border-zinc-200/50 break-words font-mono text-zinc-500">
                        {ip.prompt}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 우측 1개 컬럼: SEO 및 해시태그 메타데이터 */}
          <div className="space-y-6">
            {/* SEO 최적화 메타데이터 */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-1.5">
                <Compass className="h-4 w-4" />
                SEO 최적화 정보
              </h3>

              <div className="space-y-4 text-xs">
                {/* SEO 제목 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-400 font-bold block">SEO 최적화 제목</span>
                    <button
                      onClick={() => handleCopy(activeContent.seo_title || "", "SEO 제목")}
                      className="p-1 text-zinc-400 hover:text-zinc-600"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200 leading-normal bg-zinc-50 dark:bg-zinc-950/20 p-2.5 rounded-lg border border-zinc-150">
                    {activeContent.seo_title || "미제공"}
                  </p>
                </div>

                {/* 메타 설명 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-400 font-bold block">SEO 메타 설명 (Meta Description)</span>
                    <button
                      onClick={() => handleCopy(activeContent.meta_description || "", "메타 설명")}
                      className="p-1 text-zinc-400 hover:text-zinc-600"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-50 dark:bg-zinc-950/20 p-2.5 rounded-lg border border-zinc-150">
                    {activeContent.meta_description || "미제공"}
                  </p>
                </div>

                {/* 주소 슬러그 */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-zinc-400 font-bold block">권장 고유 주소 (Slug)</span>
                    <button
                      onClick={() => handleCopy(activeContent.slug || "", "주소 슬러그")}
                      className="p-1 text-zinc-400 hover:text-zinc-600"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-zinc-600 bg-zinc-50 dark:bg-zinc-950/20 p-2.5 rounded-lg border border-zinc-150">
                    {activeContent.slug || "미제공"}
                  </p>
                </div>

                {/* 요약 텍스트 */}
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 font-bold block">원고 짧은 요약 (Excerpt)</span>
                  <p className="text-[11px] text-zinc-500 leading-normal">
                    {activeContent.excerpt || "미제공"}
                  </p>
                </div>
              </div>
            </div>

            {/* 태그 및 해시태그 */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-1">
                <Tag className="h-4 w-4 text-emerald-500" />
                해시태그 및 분류 태그
              </h3>

              <div className="space-y-4 text-xs">
                {/* 해시태그 */}
                {activeContent.hashtags && activeContent.hashtags.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-zinc-400 font-bold block">인스타그램용 해시태그</span>
                    <div className="flex flex-wrap gap-1">
                      {activeContent.hashtags.map((h: string) => (
                        <span
                          key={h}
                          onClick={() => handleCopy(`#${h}`, "해시태그")}
                          className="bg-purple-500/5 text-purple-600 dark:text-purple-400 border border-purple-500/10 text-[10px] font-semibold px-2 py-0.5 rounded cursor-pointer hover:bg-purple-500/10"
                        >
                          #{h}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 태그 */}
                {activeContent.tags && activeContent.tags.length > 0 && (
                  <div className="space-y-1.5 border-t border-zinc-100 dark:border-zinc-850 pt-3">
                    <span className="text-[10px] text-zinc-400 font-bold block">분류 태그셋</span>
                    <div className="flex flex-wrap gap-1">
                      {activeContent.tags.map((t: string) => (
                        <span
                          key={t}
                          className="bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-[10px] font-semibold px-2 py-0.5 rounded"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
