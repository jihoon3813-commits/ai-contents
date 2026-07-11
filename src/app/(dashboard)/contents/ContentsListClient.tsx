"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  duplicateProject,
  deleteProjectSoft,
  toggleArchiveProject,
} from "@/lib/actions/project";
import {
  FileText,
  Search,
  Plus,
  Sparkles,
  Layers,
  Calendar,
  Settings2,
  Trash2,
  Copy,
  Archive,
  ArrowUpRight,
  HelpCircle,
  Eye,
  CheckCircle,
  Clock,
  Loader2,
  Lock,
} from "lucide-react";

// 배지 및 라벨 딕셔너리
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
  GENERATING: { label: "AI 콘텐츠 생성 중", style: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20 animate-pulse" },
  NEEDS_REVIEW: { label: "본문 검토 대기", style: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20" },
  APPROVED: { label: "최종 승인됨", style: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  PUBLISH_READY: { label: "발행 준비 완료", style: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20" },
  PUBLISHED: { label: "발행 발행완료", style: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20" },
  ARCHIVED: { label: "보관 문서", style: "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700" },
};

const PLATFORM_COLORS: Record<string, string> = {
  WORDPRESS: "bg-sky-550/10 text-sky-600 dark:text-sky-400",
  BLOGGER: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  TISTORY: "bg-amber-600/10 text-amber-700 dark:text-amber-500",
  NAVER_BLOG: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  INSTAGRAM: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
};

interface Project {
  id: string;
  brand_id: string;
  brand_name: string;
  title: string;
  topic: string;
  category: string | null;
  content_goal: string;
  content_type: string;
  status: string;
  current_step: number;
  updated_at: string;
  platforms: { code: string; name: string }[];
}

interface ContentsListClientProps {
  initialProjects: Project[];
  brands: { id: string; name: string }[];
  platforms: { id: string; code: string; name: string }[];
}

export default function ContentsListClient({
  initialProjects,
  brands,
  platforms,
}: ContentsListClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // 필터 및 검색어 상태
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [goalFilter, setGoalFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  // 프론트엔드 단 필터링 연산
  const filteredProjects = initialProjects.filter((p) => {
    // 1. 검색어 필터 (제목 + 주제)
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = p.title.toLowerCase().includes(q);
      const matchTopic = p.topic.toLowerCase().includes(q);
      if (!matchTitle && !matchTopic) return false;
    }
    // 2. 브랜드 필터
    if (brandFilter !== "all" && p.brand_id !== brandFilter) {
      return false;
    }
    // 3. 플랫폼 필터
    if (platformFilter !== "all") {
      const hasPlat = p.platforms.some((plat) => plat.code === platformFilter);
      if (!hasPlat) return false;
    }
    // 4. 상태 필터
    if (statusFilter !== "all" && p.status !== statusFilter) {
      return false;
    }
    // 5. 콘텐츠 목적 필터
    if (goalFilter !== "all" && p.content_goal !== goalFilter) {
      return false;
    }
    // 6. 콘텐츠 유형 필터
    if (typeFilter !== "all" && p.content_type !== typeFilter) {
      return false;
    }
    return true;
  });

  // 프로젝트 복제 기능
  const handleDuplicate = (id: string, title: string) => {
    startTransition(async () => {
      try {
        const duplicated = await duplicateProject(id);
        toast.success(`'${title}' 기획안을 성공적으로 복제했습니다.`);
        router.push(`/contents/${duplicated.id}/setup`);
      } catch (err: any) {
        toast.error(`기획안 복제 실패: ${err.message}`);
      }
    });
  };

  // 프로젝트 보관 처리
  const handleToggleArchive = (id: string, title: string, currentStatus: string) => {
    startTransition(async () => {
      try {
        const nextState = currentStatus === "ARCHIVED" ? "해제" : "보관";
        await toggleArchiveProject(id, currentStatus);
        toast.success(`'${title}' 기획안을 보관 ${nextState} 처리했습니다.`);
        router.refresh();
      } catch (err: any) {
        toast.error(`보관 처리 실패: ${err.message}`);
      }
    });
  };

  // 프로젝트 삭제 기능
  const handleDelete = (id: string, title: string) => {
    if (!confirm(`'${title}' 기획안을 영구히 삭제하시겠습니까? (복구할 수 없습니다.)`)) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteProjectSoft(id);
        toast.success(`'${title}' 기획안이 삭제되었습니다.`);
        router.refresh();
      } catch (err: any) {
        toast.error(`삭제 실패: ${err.message}`);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 1. 상단 타이틀 및 신규 생성 단추 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            콘텐츠 기획 프로젝트
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            플랫폼별 원고를 생산하기 위해 다채널 콘텐츠 구성을 설계하고 사용자 경험을 설계하는 프로젝트 보관함입니다.
          </p>
        </div>

        <Link
          href="/contents/new"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold shadow-md hover:bg-primary/95 transition-all self-start sm:self-center"
        >
          <Plus className="h-4 w-4" />
          새 기획 프로젝트 작성
        </Link>
      </div>

      {/* 2. 필터 대시 패널 (글래스모피즘 박스) */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-100 dark:border-zinc-800/50 pb-2">
          <Settings2 className="h-4 w-4 text-zinc-400" />
          필터링 및 기획 검색 조건 설정
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {/* 검색어 */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="제목, 주제로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="appearance-none block w-full pl-8 pr-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg placeholder-zinc-400 text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* 브랜드 필터 */}
          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="block w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          >
            <option value="all">모든 브랜드 전체</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* 플랫폼 필터 */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="block w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          >
            <option value="all">모든 발행 플랫폼</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>

          {/* 진행 상태 필터 */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="block w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          >
            <option value="all">모든 진행 상태</option>
            {Object.entries(STATUS_LABELS).map(([code, meta]) => (
              <option key={code} value={code}>
                {meta.label}
              </option>
            ))}
          </select>

          {/* 마케팅 목적 필터 */}
          <select
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}
            className="block w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          >
            <option value="all">모든 마케팅 목적</option>
            {Object.entries(GOAL_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>

          {/* 콘텐츠 유형 필터 */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="block w-full px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
          >
            <option value="all">모든 콘텐츠 유형</option>
            {Object.entries(TYPE_LABELS).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. 기획 목록 카드 그리드 */}
      {isPending ? (
        <div className="flex flex-col items-center justify-center p-24 space-y-3 bg-zinc-50 dark:bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-250 dark:border-zinc-800">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-xs text-zinc-500 font-bold">기획 보관함을 동기화하고 있습니다...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-20 rounded-2xl text-center space-y-4 shadow-sm">
          <div className="h-14 w-14 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 flex items-center justify-center mx-auto shadow-sm">
            <Sparkles className="h-6 w-6 text-zinc-400" />
          </div>
          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">일치하는 기획서가 없습니다</h3>
            <p className="text-[11px] text-zinc-400 leading-normal">
              필터 조건을 재조율하거나 우측 상단의 새 기획 프로젝트 버튼을 눌러 첫 번째 플랫폼 콘텐츠 구성을 설계해 보세요.
            </p>
          </div>
          {search || brandFilter !== "all" || platformFilter !== "all" || statusFilter !== "all" || goalFilter !== "all" || typeFilter !== "all" ? (
            <button
              onClick={() => {
                setSearch("");
                setBrandFilter("all");
                setPlatformFilter("all");
                setStatusFilter("all");
                setGoalFilter("all");
                setTypeFilter("all");
              }}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-[11px] font-bold rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-950 text-zinc-600 dark:text-zinc-300"
            >
              모든 필터 초기화
            </button>
          ) : null}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredProjects.map((p) => {
            const statusConfig = STATUS_LABELS[p.status] || { label: p.status, style: "bg-zinc-100 text-zinc-600" };
            return (
              <div
                key={p.id}
                className={`relative group bg-white dark:bg-zinc-900 border rounded-2xl shadow-sm overflow-hidden flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  p.status === "ARCHIVED" ? "opacity-75 border-zinc-200/40 dark:border-zinc-800/40 bg-zinc-50/30" : "border-zinc-200/60 dark:border-zinc-800/60"
                }`}
              >
                {/* 상단 텍스트 및 태그 구역 */}
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start gap-2">
                    {/* 상태 라벨 */}
                    <span className={`inline-flex items-center border text-[9px] font-extrabold px-2 py-0.5 rounded-full ${statusConfig.style}`}>
                      {statusConfig.label}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(p.updated_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* 브랜드 */}
                  <div className="flex items-center gap-1.5">
                    <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-0.5 rounded-md">
                      {p.brand_name}
                    </span>
                    {p.category && (
                      <span className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                        {p.category}
                      </span>
                    )}
                  </div>

                  {/* 기획명 */}
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 line-clamp-1 group-hover:text-primary transition-colors">
                      {p.title}
                    </h3>
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 line-clamp-2 leading-relaxed">
                      주제: {p.topic || "(작성된 세부 주제 없음)"}
                    </p>
                  </div>

                  {/* 목적 / 유형 뱃지 */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="border border-zinc-150 dark:border-zinc-800 text-[10px] text-zinc-500 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <Layers className="h-3 w-3" />
                      {TYPE_LABELS[p.content_type] || p.content_type}
                    </span>
                    <span className="border border-zinc-150 dark:border-zinc-800 text-[10px] text-zinc-500 px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <HelpCircle className="h-3 w-3" />
                      {GOAL_LABELS[p.content_goal] || p.content_goal}
                    </span>
                  </div>

                  {/* 발행할 채널 목록 */}
                  <div className="space-y-1.5 border-t border-zinc-100 dark:border-zinc-800/80 pt-3">
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">발행 채널 ({p.platforms.length}개)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {p.platforms.length === 0 ? (
                        <span className="text-[10px] text-zinc-400 italic">지정된 채널 없음</span>
                      ) : (
                        p.platforms.map((plat) => (
                          <span
                            key={plat.code}
                            className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                              PLATFORM_COLORS[plat.code] || "bg-zinc-100 text-zinc-600"
                            }`}
                          >
                            {plat.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 하단 제어 컨트롤 메뉴 */}
                <div className="border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/20 grid grid-cols-2 text-center text-xs">
                  {/* 열기 / 셋업이동 */}
                  {p.status === "SETUP" ? (
                    <Link
                      href={`/contents/${p.id}/setup`}
                      className="flex items-center justify-center gap-1.5 py-3 font-bold text-primary hover:bg-zinc-100/50 dark:hover:bg-zinc-900/30 border-r border-zinc-100 dark:border-zinc-800/80 transition-colors"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      기획 구성 (스텝 {p.current_step}/6)
                    </Link>
                  ) : (
                    <Link
                      href={`/contents/${p.id}`}
                      className="flex items-center justify-center gap-1.5 py-3 font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/30 border-r border-zinc-100 dark:border-zinc-800/80 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      기획 요약 보기
                    </Link>
                  )}

                  {/* 세부 관리 옵션 패널 (복제 / 보관 / 삭제 정렬) */}
                  <div className="flex items-center justify-around px-2">
                    <button
                      onClick={() => handleDuplicate(p.id, p.title)}
                      className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                      title="기획안 복제"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleArchive(p.id, p.title, p.status)}
                      className={`p-2 transition-colors ${
                        p.status === "ARCHIVED" ? "text-primary hover:text-primary-foreground" : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      }`}
                      title={p.status === "ARCHIVED" ? "보관 해제" : "기획안 보관"}
                    >
                      <Archive className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.title)}
                      className="p-2 text-zinc-400 hover:text-red-500 transition-colors"
                      title="영구 삭제"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
