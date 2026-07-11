import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProject, getProjectPlatforms, getProjectExperience } from "@/lib/actions/project";
import { createClient } from "@/lib/supabase/server";
import {
  ArrowLeft,
  Settings2,
  FileText,
  Layers,
  Sparkles,
  Volume2,
  Image as ImageIcon,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Globe,
  Tag,
  Clock,
  Compass,
  Briefcase,
  User,
} from "lucide-react";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

const GOAL_LABELS: Record<string, string> = {
  SEARCH_TRAFFIC: "검색 트래픽 확보",
  ADSENSE_APPROVAL: "애드센스 승인",
  ADSENSE_REVENUE: "애드센스 수익화",
  LEAD_GENERATION: "잠재고객 리드 획득",
  PRODUCT_SALES: "제품/서비스 판매",
  BRAND_AWARENESS: "브랜드 인식 제고",
  ENGAGEMENT: "독자 인게이지먼트",
  STORE_VISIT: "오프라인 매장 유도",
  AFFILIATE_CLICK: "제휴 링크 유도",
  EDUCATION: "정보 교육용",
};

const TYPE_LABELS: Record<string, string> = {
  INFORMATIONAL: "정보제공형",
  REVIEW: "상품리뷰형",
  EXPERIENCE: "체험수기형",
  COMPARISON: "비교분석형",
  HOW_TO: "가이드/방법론",
  CHECKLIST: "체크리스트형",
  FAQ: "FAQ/Q&A형",
  CASE_STUDY: "사례분석형",
  PRODUCT_INTRO: "제품소개형",
  LOCAL_GUIDE: "로컬가이드",
  PROMOTIONAL: "프로모션형",
  STORYTELLING: "스토리텔링",
  NEWS_ANALYSIS: "트렌드분석",
};

const STATUS_LABELS: Record<string, { label: string; style: string }> = {
  SETUP: { label: "기획 구성 중", style: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" },
  OUTLINE_READY: { label: "개요 검토 대기", style: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" },
  GENERATING: { label: "AI 콘텐츠 생성 중", style: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20" },
  NEEDS_REVIEW: { label: "본문 검토 대기", style: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  APPROVED: { label: "최종 승인됨", style: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  PUBLISH_READY: { label: "발행 준비 완료", style: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" },
  PUBLISHED: { label: "발행 완료", style: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20" },
  ARCHIVED: { label: "보관됨", style: "bg-zinc-150 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700" },
};

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;

  const supabase = await createClient();

  // 1. 프로젝트 기본조회
  let project;
  try {
    project = await getProject(projectId);
  } catch (err) {
    redirect("/contents");
  }

  // 만약 아직 SETUP 단계라면 바로 마법사 화면으로 튕김
  if (project.status === "SETUP") {
    redirect(`/contents/${project.id}/setup`);
  }

  // 2. 관련 브랜드 명칭 조회
  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", project.brand_id)
    .maybeSingle();

  // 3. 매핑된 플랫폼 목록 조회
  const mappedPlatforms = await getProjectPlatforms(projectId);

  // 4. 경험 데이터 조회
  const experience = await getProjectExperience(projectId);

  const statusConfig = STATUS_LABELS[project.status] || { label: project.status, style: "bg-zinc-100 text-zinc-650" };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 상단 액션바 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-200/50 dark:border-zinc-800/50 pb-4">
        <div className="flex items-center gap-2">
          <Link
            href="/contents"
            className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              기획 프로젝트 상세 요약
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              기획 확정안의 종합 명세 리포트입니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <Link
            href={`/contents/${project.id}/setup`}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all"
          >
            <Settings2 className="h-4 w-4 text-zinc-400" />
            기획 수정하기
          </Link>
          <Link
            href={`/contents/${project.id}/brief`}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 dark:bg-purple-700 dark:hover:bg-purple-600 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-purple-600/10 hover:shadow-purple-600/20"
          >
            <Sparkles className="h-4 w-4 text-white" />
            AI 콘텐츠 생성하기
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 기획 핵심 상태 요약 (1개 컬럼) */}
        <div className="lg:col-span-1 space-y-5">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
              기획 요약 상태
            </h3>

            <div className="space-y-4">
              {/* 기획 프로젝트 이름 */}
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block">기획 프로젝트명</span>
                <span className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">{project.title}</span>
              </div>

              {/* 진행 상태 */}
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block font-semibold">진행 상태</span>
                <span className={`inline-flex items-center border text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${statusConfig.style}`}>
                  {statusConfig.label}
                </span>
              </div>

              {/* 대상 브랜드 */}
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block">대상 브랜드</span>
                <span className="text-xs font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-md inline-block">
                  {brand?.name || "알 수 없음"}
                </span>
              </div>

              {/* 기획 카테고리 */}
              {project.category && (
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 font-bold block">기획 분류군</span>
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">{project.category}</span>
                </div>
              )}

              {/* 기획 목적 및 유형 */}
              <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-850 pt-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">콘텐츠 목적</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{GOAL_LABELS[project.content_goal] || project.content_goal}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400">원고 구성 유형</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{TYPE_LABELS[project.content_type] || project.content_type}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 발행 채널별 구성 명세 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2 flex items-center gap-1">
              <Compass className="h-4 w-4" />
              배경 채널 기획 ({mappedPlatforms.length})
            </h3>

            <div className="space-y-4">
              {mappedPlatforms.map((mp: any) => (
                <div key={mp.id} className="p-3 bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-150 dark:border-zinc-850 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200">{mp.platform_name}</span>
                    <span className="text-[9px] font-semibold bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.5 rounded">
                      {mp.platform_category}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-400 space-y-1">
                    <p>• 목표 글자수: {mp.target_character_count?.toLocaleString()} 자</p>
                    <p>• 요구 이미지수: {mp.requested_image_count} 장</p>
                    {mp.platform_settings?.title_candidates_count && (
                      <p>• 제목 후보: {mp.platform_settings.title_candidates_count}개 | 소제목: {mp.platform_settings.subheadings_count}개</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 우측: 주제/키워드 및 경험 세부 기획 (2개 컬럼) */}
        <div className="lg:col-span-2 space-y-5">
          {/* 주제 및 키워드 기획 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
              주제 및 키워드 구성 기획
            </h3>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-400 font-bold block">상세 주제</span>
                <p className="text-xs text-zinc-700 dark:text-zinc-350 leading-relaxed font-semibold">
                  {project.topic}
                </p>
              </div>

              {/* 핵심 키워드 */}
              <div className="space-y-1 border-t border-zinc-100 dark:border-zinc-850 pt-2.5">
                <span className="text-[10px] text-zinc-400 font-bold block">핵심 타겟 키워드</span>
                <span className="text-xs font-bold text-zinc-850 dark:text-zinc-100 flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
                  {project.primary_keyword}
                </span>
              </div>

              {/* 서브 키워드셋 */}
              {project.secondary_keywords && project.secondary_keywords.length > 0 && (
                <div className="space-y-1.5 border-t border-zinc-100 dark:border-zinc-850 pt-2.5">
                  <span className="text-[10px] text-zinc-400 font-bold block">보조 키워드셋</span>
                  <div className="flex flex-wrap gap-1.5">
                    {project.secondary_keywords.map((kw: string) => (
                      <span key={kw} className="bg-zinc-100 dark:bg-zinc-800 text-zinc-650 dark:text-zinc-300 text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-zinc-200/40 dark:border-zinc-700/50">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 배제 키워드셋 */}
              {project.excluded_keywords && project.excluded_keywords.length > 0 && (
                <div className="space-y-1.5 border-t border-zinc-100 dark:border-zinc-850 pt-2.5">
                  <span className="text-[10px] text-zinc-400 font-bold block">배제(검색 제외) 키워드셋</span>
                  <div className="flex flex-wrap gap-1.5">
                    {project.excluded_keywords.map((kw: string) => (
                      <span key={kw} className="bg-red-500/5 text-red-500 text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-red-500/10">
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* 금지 표현 */}
              {project.forbidden_phrases && project.forbidden_phrases.length > 0 && (
                <div className="space-y-1.5 border-t border-zinc-100 dark:border-zinc-850 pt-2.5">
                  <span className="text-[10px] text-zinc-400 font-bold block">사용 금지 어구</span>
                  <div className="flex flex-wrap gap-1.5">
                    {project.forbidden_phrases.map((phrase: string) => (
                      <span key={phrase} className="bg-amber-500/5 text-amber-500 text-[10px] font-semibold px-2 py-0.5 rounded-lg border border-amber-500/10">
                        {phrase}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-850 pt-3">
                {/* 지역명 */}
                {project.region_name && (
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold block">관련 지역</span>
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">{project.region_name}</span>
                  </div>
                )}
                {/* 제품명 */}
                {project.product_name && (
                  <div>
                    <span className="text-[10px] text-zinc-400 font-bold block">주요 상품명</span>
                    <span className="text-xs text-zinc-700 dark:text-zinc-300 font-medium">{project.product_name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 경험 기획 리포트 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
              실제 사용자 경험(Experience) 기획 리포트
            </h3>

            {!experience || !experience.has_direct_experience ? (
              <div className="p-8 text-center bg-zinc-50 dark:bg-zinc-950/20 border border-zinc-200 dark:border-zinc-850 rounded-xl space-y-1">
                <AlertTriangle className="h-5 w-5 text-zinc-400 mx-auto" />
                <p className="text-xs text-zinc-500 font-bold">체험 경험이 등록되지 않은 기획서입니다</p>
                <p className="text-[10px] text-zinc-400">일반 정보 요약 수집형 템플릿에 따라 객관적인 형태로 원고가 생성됩니다.</p>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                {/* 기획 서약 여부 */}
                <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 border border-emerald-500/20 rounded-xl flex items-center gap-1.5 font-bold text-[10px]">
                  <CheckCircle className="h-4 w-4 shrink-0" />
                  실체험 사실 서약 완료됨 ({new Date(experience.updated_at).toLocaleDateString()})
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-50 dark:bg-zinc-950/20 p-4 border border-zinc-150 dark:border-zinc-850 rounded-xl">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">체험 사용 기간</span>
                    <span className="font-bold text-zinc-700 dark:text-zinc-350">{experience.usage_period || "미지정"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">결제 가격</span>
                    <span className="font-bold text-zinc-700 dark:text-zinc-350">{experience.price_info || "미지정"}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 block">체험 발생 시기</span>
                    <span className="font-bold text-zinc-700 dark:text-zinc-350">
                      {experience.experienced_at ? new Date(experience.experienced_at).toLocaleDateString() : "미지정"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 동기 */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-400 font-bold block">사용 계기 및 동기</span>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-normal">{experience.motivation}</p>
                  </div>
                  {/* 사용 전 고충 */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-400 font-bold block">기존 문제점 및 고충</span>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-normal">{experience.problem_before}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-850 pt-3">
                  {/* 장점 */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-450 font-bold block">체감 핵심 장점</span>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-normal">{experience.advantages}</p>
                  </div>
                  {/* 단점 */}
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-red-500 font-bold block">체감 리얼 단점</span>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-normal">{experience.disadvantages}</p>
                  </div>
                </div>

                {/* 실제 에피소드 */}
                <div className="space-y-0.5 border-t border-zinc-100 dark:border-zinc-850 pt-3">
                  <span className="text-[10px] text-zinc-400 font-bold block">스토리 에피소드 실화</span>
                  <p className="text-zinc-700 dark:text-zinc-300 leading-normal">{experience.real_episode}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
