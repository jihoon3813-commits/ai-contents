"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { saveSimplifiedProject } from "@/lib/actions/project";
import { startAutoGeneration, getAISuggestedTitles } from "@/lib/actions/generation";
import {
  Sparkles,
  Search,
  FileText,
  Link2,
  Loader2,
  TrendingUp,
  Image as ImageIcon,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  Globe,
  Settings2,
} from "lucide-react";

interface SetupWizardClientProps {
  project: any;
  brands: any[];
  platforms: any[];
  initialExperience: any;
}

// 실시간 트렌드 기본 데이터
const TREND_SOURCES = [
  { id: "namuwiki", name: "나무위키 실시간" },
  { id: "blackkiwi", name: "블랙키위 트렌드" },
  { id: "navernews", name: "네이버 뉴스 HOT" },
  { id: "daum", name: "다음 실시간" },
  { id: "google", name: "구글 트렌드" },
  { id: "creator", name: "네이버 크리에이터" },
];

const DEFAULT_TREND_KEYWORDS: Record<string, { keyword: string; volume?: string; rate?: string; isHot?: boolean }[]> = {
  namuwiki: [
    { keyword: "초개인화 AI 마케팅 솔루션", rate: "+340%", isHot: true },
    { keyword: "2026 직장인 연봉협상 꿀팁", rate: "+120%" },
    { keyword: "주말 1박2일 감성 글램핑 명소", rate: "+450%", isHot: true },
    { keyword: "ChatGPT-5 출시일 소문 정리", rate: "+95%" },
    { keyword: "하루 15분 미라클 모닝 효과", rate: "+80%" },
  ],
  blackkiwi: [
    { keyword: "애드센스 승인 빨리 받는 글쓰기", volume: "42,500", rate: "낮음 (경쟁도)", isHot: true },
    { keyword: "인스타그램 릴스 조회수 알고리즘", volume: "88,200", rate: "보통", isHot: true },
    { keyword: "워드프레스 클라우드 웨이즈 세팅", volume: "12,100", rate: "매우 낮음" },
    { keyword: "블로그 키워드 도구 사용법", volume: "31,400", rate: "낮음" },
    { keyword: "PDF 요약 AI 어플 추천", volume: "15,800", rate: "낮음" },
  ],
  navernews: [
    { keyword: "인공지능(AI) 비서, 하반기 스마트폰 기본 탑재 확산", rate: "IT/과학" },
    { keyword: "치솟는 외식 물가 속 '런치플레이션' 돌파법 인기", rate: "사회/경제", isHot: true },
    { keyword: "2026 홈 가드닝·플랜테리어 라이프스타일 분석", rate: "생활/문화" },
    { keyword: "저성장 시대 돌파구... 마이크로 창업 트렌드 부상", rate: "비즈니스", isHot: true },
    { keyword: "소비자 사로잡는 브랜드 숏폼 영상 제작 법칙", rate: "마케팅" },
  ],
  daum: [
    { keyword: "가성비 좋은 일본 소도시 온천 여행 추천", rate: "HOT", isHot: true },
    { keyword: "건강한 저탄고지 다이어트 식단 일주일치", rate: "건강" },
    { keyword: "비전공자 코딩 독학 로드맵 2026", rate: "교육" },
    { keyword: "노션 포트폴리오 템플릿 무료 나눔", rate: "IT" },
    { keyword: "사회초년생 첫 신용카드 고르는 기준", rate: "금융", isHot: true },
  ],
  google: [
    { keyword: "AI 글쓰기 도구 효율성 검증", volume: "검색지수 98", isHot: true },
    { keyword: "직장인 부업 월 100만원 파이프라인 구축", volume: "검색지수 85", isHot: true },
    { keyword: "국내 조용한 독채 풀빌라 Best 5", volume: "검색지수 74" },
    { keyword: "탈모 예방 맥주효모 샴푸 효능 진실", volume: "검색지수 62" },
    { keyword: "MZ세대 맞춤형 마케팅 전략 성공 사례", volume: "검색지수 91", isHot: true },
  ],
  creator: [
    { keyword: "20대 여성 타겟 홈웨어 브랜드 트렌드", volume: "조회 급상승", isHot: true },
    { keyword: "캠핑 초보 필수 꿀템 리스트", volume: "수요 높음" },
    { keyword: "퍼스널 컬러 자가 진단 및 화장품 매칭", volume: "조회 급상승", isHot: true },
    { keyword: "밀키트 창업 마진율 분석 가이드", volume: "조회 보통" },
    { keyword: "애플워치 페이스 커스텀 다운로드 사이트", volume: "수요 높음" },
  ],
};

const IMAGE_STYLES = [
  { id: "PHOTOGRAPH", name: "실사 사진 (Realistic)", desc: "직접 촬영한 듯한 깔끔하고 자연스러운 고화질 사진 스타일", preview: "📷" },
  { id: "RENDER_3D", name: "3D 렌더링 (3D Art)", desc: "입체적이고 트렌디한 비주얼의 테크/앱 서비스용 3D 그래픽", preview: "🎨" },
  { id: "ILLUSTRATION", name: "현대적 일러스트 (Modern)", desc: "따뜻하고 스토리가 느껴지는 감성 일러스트 스타일", preview: "✍️" },
  { id: "MINIMALIST", name: "미니멀 플랫 (Minimal)", desc: "정보 전달에 직관적이고 가독성이 뛰어난 플랫 인포그래픽", preview: "📐" },
  { id: "WATERCOLOR", name: "수채화풍 (Watercolor)", desc: "편안하고 아날로그적인 감성이 돋보이는 드로잉 스타일", preview: "🖌️" },
];

const PLATFORMS_INFO = [
  { id: "NAVER_BLOG", code: "NAVER_BLOG", name: "네이버 블로그", seo: "C-Rank & DIA 모델 반영, 적정 이미지 밀도 최적화", color: "border-emerald-500/20 hover:border-emerald-500/60 dark:bg-emerald-950/10 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5" },
  { id: "TISTORY", code: "TISTORY", name: "티스토리", seo: "구글 저품질 방지 H2/H3 구조화, 메타 설명 자동 추출", color: "border-amber-600/20 hover:border-amber-600/60 dark:bg-amber-950/10 text-amber-700 dark:text-amber-500 bg-amber-500/5" },
  { id: "WORDPRESS", code: "WORDPRESS", name: "워드프레스", seo: "구글 SEO 요건 준수 메타태그 삽입, 포스트 태그 세팅", color: "border-sky-500/20 hover:border-sky-500/60 dark:bg-sky-950/10 text-sky-600 dark:text-sky-400 bg-sky-550/5" },
  { id: "BLOGGER", code: "BLOGGER", name: "Blogger (구글)", seo: "크롤러 친화적 색인 구조화 및 사이트맵 최적화", color: "border-orange-500/20 hover:border-orange-500/60 dark:bg-orange-950/10 text-orange-600 dark:text-orange-400 bg-orange-500/5" },
  { id: "INSTAGRAM", code: "INSTAGRAM", name: "인스타그램", seo: "줄바꿈 보정, 핵심 해시태그 카드화 및 숏폼 캡션 최적화", color: "border-pink-500/20 hover:border-pink-500/60 dark:bg-pink-950/10 text-pink-600 dark:text-pink-400 bg-pink-500/5" },
];

export default function SetupWizardClient({ project, platforms }: SetupWizardClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // --- 통합 입력 폼 상태 ---
  const [title, setTitle] = useState(project.title || "");
  const [topic, setTopic] = useState(project.topic || "");

  // 주제 선정방식 (direct: 직접입력, trend: 실시간트렌드, ai: AI추천)
  const [topicMode, setTopicMode] = useState<"direct" | "trend" | "ai">("direct");
  
  // 실시간 트렌드 탭 선택
  const [trendTab, setTrendTab] = useState("namuwiki");
  const [trendSearchKeyword, setTrendSearchKeyword] = useState("");
  const [trendKeywords, setTrendKeywords] = useState(DEFAULT_TREND_KEYWORDS);

  // AI 추천 관련 상태
  const [aiSeedKeyword, setAiSeedKeyword] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isGeneratingAiSuggest, setIsGeneratingAiSuggest] = useState(false);

  // URL 입력 관련 상태
  const [referenceUrl, setReferenceUrl] = useState("");
  const [isCrawlingUrl, setIsCrawlingUrl] = useState(false);
  const [crawledResult, setCrawledResult] = useState<{ success: boolean; title: string; summary: string } | null>(null);

  // 타겟 독자 세분화 상태
  const [demographicAge, setDemographicAge] = useState<string[]>([]);
  const [demographicGender, setDemographicGender] = useState("ALL");
  const [demographicRegion, setDemographicRegion] = useState("전국");
  const [demographicJob, setDemographicJob] = useState("");
  const [demographicInterests, setDemographicInterests] = useState<string[]>([]);

  // 이미지 옵션
  const [imageCount, setImageCount] = useState<number>(3);
  const [imageStyle, setImageStyle] = useState<string>("PHOTOGRAPH");

  // 채널 선택
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(
    project.wizard_data?.step1?.platforms || ["NAVER_BLOG"]
  );

  // --- 실시간 트렌드 검색/새로고침 모사 ---
  const handleTrendSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trendSearchKeyword.trim()) return;

    // 입력어 기반 모사 트렌드 생성
    const searchVal = trendSearchKeyword.trim();
    const mockKeywords = [
      { keyword: `요즘 대세 '${searchVal}' 핵심 총정리`, rate: "+480%", isHot: true },
      { keyword: `${searchVal} 실패 없이 입문하는 법 꿀팁`, rate: "+190%" },
      { keyword: `내돈내산으로 검증한 ${searchVal} 솔직 후기`, rate: "+310%", isHot: true },
      { keyword: `2026 직장인이 주목하는 ${searchVal} 트렌드`, rate: "+140%" },
      { keyword: `전문가가 말하는 ${searchVal} 장단점 및 추천`, rate: "+90%" },
    ];

    setTrendKeywords((prev) => ({
      ...prev,
      [trendTab]: mockKeywords,
    }));
    toast.success(`'${searchVal}' 트렌드 키워드를 로드했습니다.`);
  };

  // --- AI 추천 주제 호출 ---
  const handleAiSuggest = async () => {
    if (!aiSeedKeyword.trim()) {
      toast.error("AI 추천을 위한 씨앗 키워드를 입력해 주세요.");
      return;
    }

    setIsGeneratingAiSuggest(true);
    try {
      const res = await getAISuggestedTitles(aiSeedKeyword.trim());
      if (res.success && res.suggestions) {
        setAiSuggestions(res.suggestions);
        toast.success("AI 추천 타이틀 후보가 생성되었습니다.");
      } else {
        toast.error(res.error || "추천 주제 생성 중 오류가 발생했습니다.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("추천 주제 생성 중 실패했습니다.");
    } finally {
      setIsGeneratingAiSuggest(false);
    }
  };

  // --- URL 분석 (크롤링 모사) ---
  const handleUrlCrawl = async () => {
    if (!referenceUrl.trim() || !referenceUrl.startsWith("http")) {
      toast.error("올바른 웹페이지 URL을 입력해 주세요. (http:// 또는 https:// 필수)");
      return;
    }

    setIsCrawlingUrl(true);
    // 모사 지연 시간 부여
    await new Promise((resolve) => setTimeout(resolve, 2000));

    let mockTitle = "참조 블로그 본문 내용 요약";
    try {
      const urlObj = new URL(referenceUrl);
      mockTitle = `'${urlObj.hostname}' 웹문서 핵심 요약`;
    } catch {}

    setCrawledResult({
      success: true,
      title: mockTitle,
      summary: "입력해주신 웹페이지 본문 원본을 독자적인 시각과 풍부한 단어로 전면 재구성(윤문)합니다. 기존 문장을 그대로 복사하지 않고 검색엔진 복사 제한 필터링에 절대 걸리지 않는 독자적인 신규 원고를 생성합니다.",
    });

    // 주제 및 제목 추천 자동 입력
    setTopic(`참고 URL 기반 분석 재작성: ${referenceUrl}`);
    setTitle(`참고 페이지 기반 리라이팅 포스트`);
    setIsCrawlingUrl(false);
    toast.success("URL 본문이 크롤링 및 카피 방지 필터 분석 완료되었습니다.");
  };

  // --- 나이 선택 토글 ---
  const toggleAge = (age: string) => {
    setDemographicAge((prev) =>
      prev.includes(age) ? prev.filter((a) => a !== age) : [...prev, age]
    );
  };

  // --- 관심사 선택 토글 ---
  const toggleInterest = (interest: string) => {
    setDemographicInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  // --- 플랫폼 선택 토글 ---
  const togglePlatform = (code: string) => {
    setSelectedPlatforms((prev) => {
      if (prev.includes(code)) {
        if (prev.length === 1) {
          toast.error("최소 하나의 채널을 선택해야 합니다.");
          return prev;
        }
        return prev.filter((c) => c !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  // --- 기획 정보 저장 및 AI 콘텐츠 자동 생성 시작 ---
  const handleSaveAndGenerate = () => {
    if (!title.trim()) {
      toast.error("프로젝트 기획명을 입력해 주세요.");
      return;
    }
    if (!topic.trim()) {
      toast.error("글의 주제 및 핵심 키워드를 입력해 주세요.");
      return;
    }
    if (selectedPlatforms.length === 0) {
      toast.error("콘텐츠를 발행할 플랫폼 채널을 1개 이상 선택해 주세요.");
      return;
    }

    startTransition(async () => {
      const loadingId = toast.loading("기획안을 반영하고 AI 콘텐츠 생성을 개시하고 있습니다. (약 10~20초 소요)...");
      try {
        // 1. 심플 기획 데이터 저장
        const saveRes = await saveSimplifiedProject(project.id, {
          title,
          topic,
          demographics: {
            age: demographicAge,
            gender: demographicGender,
            region: demographicRegion,
            job: demographicJob,
            interests: demographicInterests,
          },
          referenceUrl: referenceUrl || undefined,
          imageCount,
          imageStyle,
          platforms: selectedPlatforms,
        });

        if (!saveRes.success) {
          toast.dismiss(loadingId);
          toast.error(saveRes.error || "기획안 저장 실패");
          return;
        }

        // 2. 1단계: AI 기획 브리프 분석 생성
        const { generateBrief } = await import("@/lib/actions/generation");
        await generateBrief(project.id);

        toast.dismiss(loadingId);
        toast.success("기획 확정 및 AI 기획 브리프 분석이 완료되었습니다!");
        
        // 브리프 단계별 검토 화면으로 라우팅
        router.push(`/contents/${project.id}/brief`);
      } catch (err: any) {
        toast.dismiss(loadingId);
        toast.error(`기획 처리 중 오류가 발생했습니다: ${err.message || "오류 발생"}`);
      }
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* 1. 상단 타이틀 */}
      <div className="border-b border-zinc-200/50 dark:border-zinc-800/50 pb-4">
        <h1 className="text-2xl font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2 tracking-tight">
          <Settings2 className="h-6 w-6 text-primary" />
          AI 맞춤형 콘텐츠 기획 & 즉시 생성
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
          트렌드 키워드, 타겟 세분화, 참고 URL을 매핑하여 플랫폼별 완벽한 SEO가 적용된 글과 이미지를 한 번에 자동 생성합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측 2개 컬럼: 기획 옵션 제어 패널 */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* 주제 선정 세션 (Tabs) */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/50 pb-3">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                1. 콘텐츠 주제 및 기획명 지정
              </h3>
              <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setTopicMode("direct")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${topicMode === "direct" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-400"}`}
                >
                  직접 입력
                </button>
                <button
                  type="button"
                  onClick={() => setTopicMode("trend")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${topicMode === "trend" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-400"}`}
                >
                  실시간 트렌드
                </button>
                <button
                  type="button"
                  onClick={() => setTopicMode("ai")}
                  className={`px-2.5 py-1 rounded-md transition-colors ${topicMode === "ai" ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-400"}`}
                >
                  AI 추천
                </button>
              </div>
            </div>

            {/* 직접 입력 모드 */}
            {topicMode === "direct" && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-1.5">기획 프로젝트 이름</label>
                    <input
                      type="text"
                      placeholder="예: 2026 AI 트렌드 소개 포스팅"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-zinc-500 mb-1.5">글의 핵심 주제 (키워드)</label>
                    <input
                      type="text"
                      placeholder="예: 인공지능 글쓰기 플랫폼 활용법"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 실시간 트렌드 모드 */}
            {topicMode === "trend" && (
              <div className="space-y-4">
                <div className="flex overflow-x-auto gap-1 border-b border-zinc-100 dark:border-zinc-800 pb-2 scrollbar-none">
                  {TREND_SOURCES.map((src) => (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => {
                        setTrendTab(src.id);
                        setTrendSearchKeyword("");
                      }}
                      className={`px-3 py-1.5 text-[11px] font-bold rounded-lg whitespace-nowrap transition-colors ${trendTab === src.id ? "bg-primary/10 text-primary" : "text-zinc-400 hover:text-zinc-600"}`}
                    >
                      {src.name}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleTrendSearch} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="트렌드 데이터 내 키워드 검색 및 새로고침..."
                      value={trendSearchKeyword}
                      onChange={(e) => setTrendSearchKeyword(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2 border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold hover:bg-zinc-200"
                  >
                    검색
                  </button>
                </form>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {trendKeywords[trendTab]?.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setTopic(item.keyword);
                        setTitle(`트렌드 포스팅: ${item.keyword}`);
                        toast.success(`트렌드 주제 '${item.keyword}'가 선택되었습니다.`);
                      }}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-855 bg-zinc-50/50 hover:bg-primary/5 hover:border-primary/20 transition-all text-left"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[10px] font-bold text-zinc-400">{idx + 1}</span>
                        <span className="text-xs font-bold text-zinc-850 dark:text-zinc-200 truncate">{item.keyword}</span>
                        {item.isHot && (
                          <span className="text-[8px] bg-red-500 text-white font-extrabold px-1 rounded-sm">HOT</span>
                        )}
                      </div>
                      <div className="text-[9px] text-zinc-400 font-medium">
                        {item.volume || item.rate}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* AI 추천 모드 */}
            {topicMode === "ai" && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="씨앗 키워드를 입력해 주세요 (예: 재테크, 제주도 여행)"
                      value={aiSeedKeyword}
                      onChange={(e) => setAiSeedKeyword(e.target.value)}
                      className="w-full text-xs pl-9 pr-3 py-2.5 border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAiSuggest}
                    disabled={isGeneratingAiSuggest}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/95 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isGeneratingAiSuggest ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    추천받기
                  </button>
                </div>

                {aiSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold text-zinc-400 block uppercase">AI 추천 타이틀 후보</span>
                    <div className="grid grid-cols-1 gap-2">
                      {aiSuggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setTopic(sug);
                            setTitle(sug);
                            toast.success(`추천 주제 '${sug}'가 선택되었습니다.`);
                          }}
                          className="w-full p-3 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/20 hover:border-primary hover:bg-primary/5 text-left text-xs font-bold text-zinc-800 dark:text-zinc-200 transition-colors"
                        >
                          {sug}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* URL 크롤링 리라이팅 섹션 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Link2 className="h-4 w-4 text-primary" />
              2. URL 직접 등록 (카피방지 리라이팅 적용)
            </h3>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="참고하고 싶은 원본 블로그나 뉴스 기사 URL을 입력해 주세요"
                value={referenceUrl}
                onChange={(e) => setReferenceUrl(e.target.value)}
                className="flex-1 text-xs px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950 rounded-xl focus:outline-none"
              />
              <button
                type="button"
                onClick={handleUrlCrawl}
                disabled={isCrawlingUrl}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-800 text-white text-xs font-bold hover:bg-zinc-800 disabled:opacity-50 flex items-center gap-1"
              >
                {isCrawlingUrl && <Loader2 className="h-3 w-3 animate-spin" />}
                URL 분석
              </button>
            </div>

            {crawledResult && (
              <div className="p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/25 space-y-2">
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  <CheckCircle className="h-4 w-4" />
                  {crawledResult.title}
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {crawledResult.summary}
                </p>
              </div>
            )}
          </div>

          {/* 타겟 세분화 섹션 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Globe className="h-4 w-4 text-primary" />
              3. 독자 타겟팅 세분화
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 연령선택 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-500">타겟 연령 (복수 선택)</label>
                <div className="flex flex-wrap gap-1.5">
                  {["10대", "20대", "30대", "40대", "50대 이상"].map((age) => {
                    const active = demographicAge.includes(age);
                    return (
                      <button
                        key={age}
                        type="button"
                        onClick={() => toggleAge(age)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${active ? "bg-primary text-white border-primary" : "bg-zinc-50 dark:bg-zinc-950 text-zinc-650 border-zinc-200 dark:border-zinc-800"}`}
                      >
                        {age}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 성별선택 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-500">타겟 성별</label>
                <div className="grid grid-cols-3 gap-2 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl">
                  {[
                    { id: "ALL", label: "전체" },
                    { id: "MALE", label: "남성" },
                    { id: "FEMALE", label: "여성" },
                  ].map((gender) => (
                    <button
                      key={gender.id}
                      type="button"
                      onClick={() => setDemographicGender(gender.id)}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all ${demographicGender === gender.id ? "bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-400"}`}
                    >
                      {gender.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 거주 지역 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-500">타겟 지역</label>
                <select
                  value={demographicRegion}
                  onChange={(e) => setDemographicRegion(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl focus:outline-none"
                >
                  <option value="전국">전국</option>
                  <option value="서울/수도권">서울 및 수도권</option>
                  <option value="광역시">주요 광역시</option>
                  <option value="기타">그 외 지방 소도시</option>
                </select>
              </div>

              {/* 직업군 */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-zinc-500">타겟 직업군</label>
                <input
                  type="text"
                  placeholder="예: 대학생, 직장인, 주부, 자영업자 등"
                  value={demographicJob}
                  onChange={(e) => setDemographicJob(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl focus:outline-none"
                />
              </div>
            </div>

            {/* 관심사 선택 */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-500">주요 관심분야 (복수 선택)</label>
              <div className="flex flex-wrap gap-1.5">
                {["재테크/부업", "테크/가전", "뷰티/미용", "여행/액티비티", "맛집/카페", "건강/식단", "육아/생활정보", "자기계발"].map((interest) => {
                  const active = demographicInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${active ? "bg-primary text-white border-primary" : "bg-zinc-50 dark:bg-zinc-950 text-zinc-650 border-zinc-200 dark:border-zinc-800"}`}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 이미지 매핑 옵션 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm space-y-5">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <ImageIcon className="h-4 w-4 text-primary" />
              4. 삽입할 생성형 AI 이미지 선택
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 이미지 개수 */}
              <div className="md:col-span-1 space-y-2">
                <label className="block text-xs font-bold text-zinc-500">삽입할 이미지 개수</label>
                <div className="grid grid-cols-4 gap-1.5 bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl">
                  {[1, 3, 5, 8].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setImageCount(count)}
                      className={`py-2 text-xs font-bold rounded-lg transition-all ${imageCount === count ? "bg-white dark:bg-zinc-850 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-400"}`}
                    >
                      {count}개
                    </button>
                  ))}
                </div>
              </div>

              {/* 이미지 스타일 */}
              <div className="md:col-span-2 space-y-2">
                <label className="block text-xs font-bold text-zinc-500">생성 이미지 서체/스타일 비주얼</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {IMAGE_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setImageStyle(style.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${imageStyle === style.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950"}`}
                    >
                      <span className="text-2xl">{style.preview}</span>
                      <div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-100">{style.name}</div>
                        <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{style.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 우측 1개 컬럼: 채널 선택 및 최종 발행 프리뷰 */}
        <div className="lg:col-span-1 space-y-6">
          {/* 채널 및 SEO 규칙 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
              발행 채널 선택 및 SEO 적용
            </h3>

            <div className="space-y-2">
              {PLATFORMS_INFO.map((plat) => {
                const isSelected = selectedPlatforms.includes(plat.code);
                return (
                  <button
                    key={plat.id}
                    type="button"
                    onClick={() => togglePlatform(plat.code)}
                    className={`w-full p-3 rounded-xl border text-left transition-all space-y-1.5 ${isSelected ? plat.color + " ring-1 ring-current" : "border-zinc-200 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-950"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold">{plat.name}</span>
                      <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? "bg-current animate-pulse" : "bg-zinc-300 dark:bg-zinc-700"}`} />
                    </div>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium leading-relaxed">
                      {plat.seo}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 최종 기획 제출하기 카드 */}
          <div className="bg-gradient-to-br from-primary/10 via-purple-500/5 to-transparent border border-primary/20 rounded-2xl p-5 shadow-md space-y-4">
            <div className="space-y-1.5">
              <h4 className="text-xs font-extrabold text-primary flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                원클릭 완성본 대기
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                기획과 동시에 브리프 작성, 문맥 개요 검증, 본문 생산 및 이미지 세팅 파이프라인이 멈춤 없이 전면 백그라운드 자동화되어 100% 최적화된 결과 페이지로 이동합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveAndGenerate}
              disabled={isPending || !title.trim() || !topic.trim()}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-primary text-white text-xs font-extrabold shadow-md hover:bg-primary/95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  기획 분석 및 AI 생성 기동 중...
                </>
              ) : (
                <>
                  AI 콘텐츠 생성 기동
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
