"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
  step5Schema,
  step6Schema,
  PLATFORM_DEFAULTS,
  CONTENT_GOALS,
  CONTENT_TYPES,
  IMAGE_STYLES,
  type Step1Input,
  type Step2Input,
  type Step3Input,
  type Step4Input,
  type Step5Input,
  type Step6Input,
} from "@/lib/schemas/project";
import { saveProjectStep, finalizeProjectSetup } from "@/lib/actions/project";
import {
  ArrowLeft,
  Settings2,
  FileText,
  HelpCircle,
  Volume2,
  Image as ImageIcon,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  CloudCheck,
  CloudLightning,
  RefreshCw,
  AlertTriangle,
  Star,
  Info,
  Sparkles,
  Layers,
} from "lucide-react";

const PLATFORM_COLORS: Record<string, string> = {
  WORDPRESS: "bg-sky-550/10 text-sky-600 dark:text-sky-400",
  BLOGGER: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  TISTORY: "bg-amber-600/10 text-amber-700 dark:text-amber-500",
  NAVER_BLOG: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  INSTAGRAM: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
};

// 배지 및 번역 맵
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

const IMAGE_STYLE_LABELS: Record<string, string> = {
  PHOTO_REALISTIC: "극실사 사진",
  LIFESTYLE: "라이프스타일",
  EDITORIAL: "에디토리얼/잡지화보",
  MINIMAL: "미니멀리즘",
  INFOGRAPHIC: "인포그래픽",
  ILLUSTRATION: "일러스트레이션",
  PRODUCT_FOCUSED: "제품 중심 연출",
  USER_PHOTO: "일반 사용자 사진느낌",
};

interface SetupWizardClientProps {
  project: any;
  brands: { id: string; name: string }[];
  platforms: { id: string; code: string; name: string }[];
  initialExperience: any;
}

export default function SetupWizardClient({
  project,
  brands,
  platforms,
  initialExperience,
}: SetupWizardClientProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  // 단계 관리 (1 ~ 6)
  const [step, setStep] = useState<number>(project.current_step || 1);
  // 자동 저장 상태 배지 관리 ("saved" | "saving" | "changed")
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "changed">("saved");
  // 경험 경고 모달 상태
  const [showWarningModal, setShowWarningModal] = useState(false);

  // 3초 디바운스 자동 저장 타이머 레프
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // --- 각 스텝별 데이터 폼 초기 설정 ---

  // STEP 1 Form
  const f1 = useForm<Step1Input>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      brand_id: project.brand_id || brands[0]?.id || "",
      content_goal: (project.content_goal || "SEARCH_TRAFFIC") as any,
      platforms: (project.wizard_data?.step1?.platforms || []) as any,
      category: project.category || project.wizard_data?.step1?.category || "",
      content_type: (project.content_type || "INFORMATIONAL") as any,
      target_audience: project.target_audience || project.wizard_data?.step1?.target_audience || "",
      audience_stage: project.audience_stage || project.wizard_data?.step1?.audience_stage || "",
    },
  });

  // STEP 2 Form
  const f2 = useForm<Step2Input>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      title: project.title || "새 콘텐츠 기획안",
      topic: project.topic || "",
      primary_keyword: project.primary_keyword || "",
      secondary_keywords: project.secondary_keywords || [],
      excluded_keywords: project.excluded_keywords || [],
      region_name: project.region_name || "",
      product_name: project.product_name || "",
      required_points: project.required_points || "",
      forbidden_phrases: project.forbidden_phrases || [],
      source_notes: project.source_notes || "",
    },
  });

  // STEP 3 Form
  const f3 = useForm<Step3Input>({
    resolver: zodResolver(step3Schema),
    defaultValues: {
      has_direct_experience: initialExperience?.has_direct_experience ?? false,
      usage_period: initialExperience?.usage_period ?? "",
      motivation: initialExperience?.motivation ?? "",
      problem_before: initialExperience?.problem_before ?? "",
      change_after: initialExperience?.change_after ?? "",
      advantages: initialExperience?.advantages ?? "",
      disadvantages: initialExperience?.disadvantages ?? "",
      recommended_for: initialExperience?.recommended_for ?? "",
      not_recommended_for: initialExperience?.not_recommended_for ?? "",
      real_episode: initialExperience?.real_episode ?? "",
      price_info: initialExperience?.price_info ?? "",
      experienced_at: initialExperience?.experienced_at ? new Date(initialExperience.experienced_at).toISOString().split("T")[0] : "",
      additional_notes: initialExperience?.additional_notes ?? "",
      confirmed_by_user: initialExperience?.confirmed_by_user ?? false,
    },
  });

  // STEP 4 Form
  const f4 = useForm<Step4Input>({
    resolver: zodResolver(step4Schema),
    defaultValues: {
      target_character_count: project.target_character_count || 1000,
      title_candidates_count: project.wizard_data?.step4?.title_candidates_count ?? 5,
      subheadings_count: project.wizard_data?.step4?.subheadings_count ?? 5,
      requested_image_count: project.requested_image_count || 0,
      faq_count: project.wizard_data?.step4?.faq_count ?? 0,
      has_toc: project.wizard_data?.step4?.has_toc ?? false,
      has_table: project.wizard_data?.step4?.has_table ?? false,
      has_list: project.wizard_data?.step4?.has_list ?? false,
      has_summary_box: project.wizard_data?.step4?.has_summary_box ?? false,
      has_cta: project.wizard_data?.step4?.has_cta ?? false,
      has_sources: project.wizard_data?.step4?.has_sources ?? false,
      has_conclusion: project.wizard_data?.step4?.has_conclusion ?? true,
    },
  });

  // STEP 5 Form
  const f5 = useForm<Step5Input>({
    resolver: zodResolver(step5Schema),
    defaultValues: {
      use_brand_voice: project.wizard_data?.step5?.use_brand_voice ?? true,
      formal: project.wizard_data?.step5?.formal ?? 0,
      friendly: project.wizard_data?.step5?.friendly ?? 0,
      honest: project.wizard_data?.step5?.honest ?? 0,
      plain: project.wizard_data?.step5?.plain ?? 0,
      luxury: project.wizard_data?.step5?.luxury ?? 0,
      witty: project.wizard_data?.step5?.witty ?? 0,
      consultant: project.wizard_data?.step5?.consultant ?? 0,
      reviewer: project.wizard_data?.step5?.reviewer ?? 0,
      journalist: project.wizard_data?.step5?.journalist ?? 0,
    },
  });

  // STEP 6 Form
  const f6 = useForm<Step6Input>({
    resolver: zodResolver(step6Schema),
    defaultValues: {
      image_count: project.wizard_data?.step6?.image_count ?? 0,
      style: (project.wizard_data?.step6?.style || "PHOTO_REALISTIC") as any,
      aspect_ratio: project.wizard_data?.step6?.aspect_ratio ?? "16:9",
      text_overlay: project.wizard_data?.step6?.text_overlay ?? "",
      include_logo: project.wizard_data?.step6?.include_logo ?? false,
      use_uploaded: project.wizard_data?.step6?.use_uploaded ?? false,
      generate_ai: project.wizard_data?.step6?.generate_ai ?? false,
      prepare_personally: project.wizard_data?.step6?.prepare_personally ?? false,
    },
  });

  // --- 플랫폼 다중 선택 변경 시, STEP 4 추천값 동적 자동 보정 기능 ---
  const selectedPlatforms = f1.watch("platforms") || [];
  useEffect(() => {
    if (selectedPlatforms.length > 0) {
      // 선택된 채널 중 첫 번째 채널을 대표 추천 규칙으로 삼음
      const primaryCode = selectedPlatforms[0];
      const defaults = PLATFORM_DEFAULTS[primaryCode];
      if (defaults) {
        f4.setValue("target_character_count", defaults.target_character_count);
        f4.setValue("requested_image_count", defaults.requested_image_count);
        f4.setValue("title_candidates_count", defaults.title_candidates_count);
        f4.setValue("subheadings_count", defaults.subheadings_count);
        f4.setValue("faq_count", defaults.faq_count);
        f4.setValue("has_toc", defaults.has_toc);

        f6.setValue("image_count", defaults.requested_image_count);
      }
    }
  }, [selectedPlatforms.join(",")]);

  // --- 3초 디바운스 백그라운드 자동 저장 ---
  const watchStep1 = f1.watch();
  const watchStep2 = f2.watch();
  const watchStep3 = f3.watch();
  const watchStep4 = f4.watch();
  const watchStep5 = f5.watch();
  const watchStep6 = f6.watch();

  const getFormInstance = () => {
    if (step === 1) return f1;
    if (step === 2) return f2;
    if (step === 3) return f3;
    if (step === 4) return f4;
    if (step === 5) return f5;
    return f6;
  };

  useEffect(() => {
    // 마운트 직후 혹은 저장 직후에는 제외
    if (saveStatus === "saving" || saveStatus === "saved") {
      setSaveStatus("changed");
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      const currentForm = getFormInstance();
      // 백그라운드 자동 저장은 사용자 불편이 없도록 '유효성 검사 성공 시'에만 DB에 동기화
      const isValid = await currentForm.trigger();
      if (isValid) {
        setSaveStatus("saving");
        try {
          const values = currentForm.getValues();
          await saveProjectStep(project.id, step, values);
          setSaveStatus("saved");
        } catch (err) {
          setSaveStatus("changed");
        }
      }
    }, 3000);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [
    JSON.stringify(watchStep1),
    JSON.stringify(watchStep2),
    JSON.stringify(watchStep3),
    JSON.stringify(watchStep4),
    JSON.stringify(watchStep5),
    JSON.stringify(watchStep6),
  ]);

  // --- 단계 이동 제어 및 수동 데이터 보존 조작 ---

  const handleNext = async () => {
    const currentForm = getFormInstance();
    const isValid = await currentForm.trigger();

    if (!isValid) {
      toast.error("입력한 양식 정보에 유효하지 않은 값이 포함되어 있습니다. 빨간색 안내 메시지를 확인해 주세요.");
      return;
    }

    // 경험형 경고 모달 사전 체크 분기 (STEP 3에서 다음으로 갈 때)
    if (step === 3) {
      const isReviewOrExp = f1.getValues("content_type") === "REVIEW" || f1.getValues("content_type") === "EXPERIENCE";
      const hasNoExp = !f3.getValues("has_direct_experience");

      if (isReviewOrExp && hasNoExp) {
        setShowWarningModal(true);
        return;
      }
    }

    setSaveStatus("saving");
    try {
      const values = currentForm.getValues();
      await saveProjectStep(project.id, step, values);
      setSaveStatus("saved");
      setStep((s) => Math.min(s + 1, 6));
    } catch (err: any) {
      setSaveStatus("changed");
      toast.error(`기획 저장 실패: ${err.message}`);
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 1));
  };

  // 문체 가중치 믹서 합산 게이지
  const customWeightsSum =
    (watchStep5.formal ?? 0) +
    (watchStep5.friendly ?? 0) +
    (watchStep5.honest ?? 0) +
    (watchStep5.plain ?? 0) +
    (watchStep5.luxury ?? 0) +
    (watchStep5.witty ?? 0) +
    (watchStep5.consultant ?? 0) +
    (watchStep5.reviewer ?? 0) +
    (watchStep5.journalist ?? 0);

  // --- 최종 기획 확정 완료 핸들러 ---
  const handleFinalize = async () => {
    const isValid = await f6.trigger();
    if (!isValid) {
      toast.error("마지막 이미지 기획 설정 양식에 오류가 있습니다.");
      return;
    }

    // 최종 확정 전 다시 한번 경험형 경증 체크
    const isReviewOrExp = f1.getValues("content_type") === "REVIEW" || f1.getValues("content_type") === "EXPERIENCE";
    const hasNoExp = !f3.getValues("has_direct_experience");

    if (isReviewOrExp && hasNoExp) {
      setShowWarningModal(true);
      return;
    }

    setSaveStatus("saving");
    try {
      // 6단계 저장
      await saveProjectStep(project.id, 6, f6.getValues());
      // 최종 기획 상태 변경 (SETUP -> OUTLINE_READY)
      await finalizeProjectSetup(project.id);
      setSaveStatus("saved");
      toast.success("기획 조율이 성공적으로 완료되었습니다! 이제 개요가 자동으로 대기 상태에 돌입합니다.");
      router.push("/contents");
    } catch (err: any) {
      setSaveStatus("changed");
      toast.error(`기획 최종 제출 실패: ${err.message}`);
    }
  };

  // --- 경고 모달 처리 옵션 ---

  // 옵션 1: 경험 쓰기 (모달 닫고 스텝 3 유지)
  const handleWarningKeepExperience = () => {
    setShowWarningModal(false);
    setStep(3);
  };

  // 옵션 2: 정보형으로 변경 후 바로 진행
  const handleWarningConvertToInformational = async () => {
    setShowWarningModal(false);
    f1.setValue("content_type", "INFORMATIONAL");
    // 기입 상태 즉시 저장 동기화
    setSaveStatus("saving");
    try {
      await saveProjectStep(project.id, 1, f1.getValues());
      // 스텝이 6에서 발생한 것이라면 최종제출 시키고, 스텝 3에서 발생했다면 스텝 4로 넘김
      if (step === 6) {
        await saveProjectStep(project.id, 6, f6.getValues());
        await finalizeProjectSetup(project.id);
        setSaveStatus("saved");
        toast.success("기획 형태가 '정보제공형'으로 변경 및 최종 확정 완료되었습니다.");
        router.push("/contents");
      } else {
        await saveProjectStep(project.id, 3, f3.getValues());
        setSaveStatus("saved");
        setStep(4);
      }
    } catch (err: any) {
      setSaveStatus("changed");
      toast.error(`정보형 변경 저장 오류: ${err.message}`);
    }
  };

  // 옵션 3: 단정하지 않는 정보글 모드로 강제 진행
  const handleWarningForceProceed = async () => {
    setShowWarningModal(false);
    setSaveStatus("saving");
    try {
      if (step === 6) {
        await saveProjectStep(project.id, 6, f6.getValues());
        await finalizeProjectSetup(project.id);
        setSaveStatus("saved");
        toast.success("단정하지 않는 문체의 일반 정보 수집형 기획안으로 확정 완료되었습니다.");
        router.push("/contents");
      } else {
        await saveProjectStep(project.id, 3, f3.getValues());
        setSaveStatus("saved");
        setStep(4);
      }
    } catch (err: any) {
      setSaveStatus("changed");
      toast.error(`강제 기획 저장 실패: ${err.message}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 상단 기획 네비게이터 및 클라우드 동기화 뱃지 */}
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
              콘텐츠 생성 기획 마법사
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
              프로젝트: {f2.watch("title") || "새 콘텐츠 기획안"}
            </p>
          </div>
        </div>

        {/* 클라우드 동기화 상태 뱃지 */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          {saveStatus === "saved" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CloudCheck className="h-3 w-3" />
              자동 저장됨
            </span>
          )}
          {saveStatus === "saving" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <RefreshCw className="h-3 w-3 animate-spin" />
              클라우드에 전송 중...
            </span>
          )}
          {saveStatus === "changed" && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <CloudLightning className="h-3 w-3" />
              변경됨 (입력 대기)
            </span>
          )}
        </div>
      </div>

      {/* 6단계 프로그레스 스텝 지시계 */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs font-semibold">
        {[
          { num: 1, name: "기본 설정" },
          { num: 2, name: "주제/키워드" },
          { num: 3, name: "사용자 경험" },
          { num: 4, name: "콘텐츠 구성" },
          { num: 5, name: "문체 설정" },
          { num: 6, name: "이미지 설정" },
        ].map((s) => {
          const isActive = step === s.num;
          const isCompleted = step > s.num;
          return (
            <div
              key={s.num}
              className={`p-2.5 border rounded-xl flex flex-col items-center justify-center gap-1 transition-all ${
                isActive
                  ? "border-primary bg-primary/5 text-primary dark:border-primary/40"
                  : isCompleted
                  ? "border-zinc-200 dark:border-zinc-800 text-zinc-600 bg-zinc-50/50 dark:bg-zinc-950/20"
                  : "border-zinc-200/50 dark:border-zinc-850/50 text-zinc-400 opacity-60"
              }`}
            >
              <span className={`text-[10px] flex items-center justify-center h-4 w-4 rounded-full font-bold ${
                isActive ? "bg-primary text-white" : isCompleted ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-400"
              }`}>
                {s.num}
              </span>
              <span className="text-[10px] truncate max-w-full">{s.name}</span>
            </div>
          );
        })}
      </div>

      {/* 단계별 메인 폼 본문 영역 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-3xl p-6 shadow-sm space-y-6">
        
        {/* ================= STEP 1 FORM ================= */}
        {step === 1 && (
          <form className="space-y-5">
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <Settings2 className="h-4 w-4 text-primary" />
              STEP 1: 마케팅 채널 및 기획 목적 기본 구성
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 브랜드 선택 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  대상 브랜드
                </label>
                <select
                  {...f1.register("brand_id")}
                  className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
                {f1.formState.errors.brand_id && (
                  <p className="text-[10px] text-red-500 font-semibold">{f1.formState.errors.brand_id.message}</p>
                )}
              </div>

              {/* 콘텐츠 마케팅 목적 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  원고 마케팅 목적
                </label>
                <select
                  {...f1.register("content_goal")}
                  className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                >
                  {CONTENT_GOALS.map((goal) => (
                    <option key={goal} value={goal}>
                      {GOAL_LABELS[goal]}
                    </option>
                  ))}
                </select>
                {f1.formState.errors.content_goal && (
                  <p className="text-[10px] text-red-500 font-semibold">{f1.formState.errors.content_goal.message}</p>
                )}
              </div>
            </div>

            {/* 발행 채널 다중 선택 (인터랙티브 카드 그리드 디자인) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                발행 플랫폼 복수 선택 (최소 1개)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-1.5">
                {platforms.map((plat) => {
                  const isChecked = selectedPlatforms.includes(plat.code as any);
                  return (
                    <label
                      key={plat.id}
                      className={`relative border p-4 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer transition-all shadow-sm ${
                        isChecked
                          ? "border-primary bg-primary/5 text-primary dark:border-primary/40"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 text-zinc-600"
                      }`}
                    >
                      <input
                        type="checkbox"
                        value={plat.code}
                        checked={isChecked}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const currentVal = f1.getValues("platforms") || [];
                          if (checked) {
                            f1.setValue("platforms", [...currentVal, plat.code as any]);
                          } else {
                            f1.setValue("platforms", currentVal.filter((c) => c !== plat.code));
                          }
                          f1.trigger("platforms");
                        }}
                        className="sr-only"
                      />
                      <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider mb-2 ${
                        PLATFORM_COLORS[plat.code] || "bg-zinc-100 text-zinc-600"
                      }`}>
                        {plat.name}
                      </span>
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        {plat.code === "WORDPRESS" || plat.code === "TISTORY" || plat.code === "BLOGGER" ? "CMS / 블로그" : plat.code === "NAVER_BLOG" ? "네이버 블로그" : "인스타그램 SNS"}
                      </span>
                      {isChecked && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle className="h-3.5 w-3.5 text-primary fill-white dark:fill-zinc-900" />
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
              {f1.formState.errors.platforms && (
                <p className="text-[10px] text-red-500 font-semibold">{f1.formState.errors.platforms.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* 카테고리 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  기획 카테고리 (예: IT 제품후기, 맛집 홍보)
                </label>
                <input
                  type="text"
                  placeholder="예: IT 가이드"
                  {...f1.register("category")}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
                {f1.formState.errors.category && (
                  <p className="text-[10px] text-red-500 font-semibold">{f1.formState.errors.category.message}</p>
                )}
              </div>

              {/* 콘텐츠 유형 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  원고 구성 유형 (템플릿 타입)
                </label>
                <select
                  {...f1.register("content_type")}
                  className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                >
                  {CONTENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
                {f1.formState.errors.content_type && (
                  <p className="text-[10px] text-red-500 font-semibold">{f1.formState.errors.content_type.message}</p>
                )}
              </div>

              {/* 예상 독자 및 단계 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  목표 예상 독자층
                </label>
                <input
                  type="text"
                  placeholder="예: 30대 재테크에 관심 많은 직장인"
                  {...f1.register("target_audience")}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
                {f1.formState.errors.target_audience && (
                  <p className="text-[10px] text-red-500 font-semibold">{f1.formState.errors.target_audience.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                독자 인지 단계 (소비자 구매 여정 여부)
              </label>
              <input
                type="text"
                placeholder="예: 문제 인지 단계, 정보 비교 탐색 단계, 최종 구매 결정 단계"
                {...f1.register("audience_stage")}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
              />
              {f1.formState.errors.audience_stage && (
                <p className="text-[10px] text-red-500 font-semibold">{f1.formState.errors.audience_stage.message}</p>
              )}
            </div>
          </form>
        )}

        {/* ================= STEP 2 FORM ================= */}
        {step === 2 && (
          <form className="space-y-5">
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <FileText className="h-4 w-4 text-primary" />
              STEP 2: 기획안 주제 및 타겟 키워드 셋팅
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* 기획 프로젝트명 */}
              <div className="md:col-span-2 space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  기획안 이름 (프로젝트 구분을 위한 명칭)
                </label>
                <input
                  type="text"
                  placeholder="예: 갤럭시 버즈 프로 실체험 리뷰 원고"
                  {...f2.register("title")}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
                {f2.formState.errors.title && (
                  <p className="text-[10px] text-red-500 font-semibold">{f2.formState.errors.title.message}</p>
                )}
              </div>

              {/* 핵심 키워드 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  포스팅 핵심 타겟 키워드 (1개)
                </label>
                <input
                  type="text"
                  placeholder="예: 갤럭시 버즈 프로 리뷰"
                  {...f2.register("primary_keyword")}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
                {f2.formState.errors.primary_keyword && (
                  <p className="text-[10px] text-red-500 font-semibold">{f2.formState.errors.primary_keyword.message}</p>
                )}
              </div>
            </div>

            {/* 상세 기획 주제 */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                원고의 명확한 전달 주제 설명
              </label>
              <textarea
                placeholder="예: 갤럭시 버즈 프로의 3달간의 실사용 경험을 기반으로, 노이즈 캔슬링 강점과 단점(배터리 용량)을 타 사 제품과 실용적으로 비교해 기술함."
                rows={3}
                {...f2.register("topic")}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
              />
              {f2.formState.errors.topic && (
                <p className="text-[10px] text-red-500 font-semibold">{f2.formState.errors.topic.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* 보조 키워드 리스트 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                  서브 키워드셋 (쉼표로 구분)
                </label>
                <input
                  type="text"
                  placeholder="예: 갤럭시 버즈, 무선 이어폰 추천"
                  onChange={(e) => {
                    const words = e.target.value.split(",").map((w) => w.trim()).filter(Boolean);
                    f2.setValue("secondary_keywords", words);
                  }}
                  defaultValue={f2.getValues("secondary_keywords")?.join(", ")}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* 제외 키워드 리스트 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  배제 키워드셋 (쉼표로 구분)
                </label>
                <input
                  type="text"
                  placeholder="예: 짝퉁 갤럭시, 가짜 제품"
                  onChange={(e) => {
                    const words = e.target.value.split(",").map((w) => w.trim()).filter(Boolean);
                    f2.setValue("excluded_keywords", words);
                  }}
                  defaultValue={f2.getValues("excluded_keywords")?.join(", ")}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* 금지 표현 리스트 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  사용 금지 문구 (쉼표로 구분)
                </label>
                <input
                  type="text"
                  placeholder="예: 100% 만족 보장, 무조건 구매"
                  onChange={(e) => {
                    const words = e.target.value.split(",").map((w) => w.trim()).filter(Boolean);
                    f2.setValue("forbidden_phrases", words);
                  }}
                  defaultValue={f2.getValues("forbidden_phrases")?.join(", ")}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 지역명 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  포스팅 관련 로컬 지역명 (해당 시 기재)
                </label>
                <input
                  type="text"
                  placeholder="예: 서울 강남역, 부산 해운대"
                  {...f2.register("region_name")}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* 제품명 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  포스팅 중심 상품/서비스명 (해당 시 기재)
                </label>
                <input
                  type="text"
                  placeholder="예: 갤럭시 버즈 프로 SM-R190"
                  {...f2.register("product_name")}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* 반드시 포함할 내용 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  반드시 원고 본문에 인용/강조해야 할 소구점
                </label>
                <textarea
                  placeholder="예: 1. ANC(액티브 노이즈 캔슬링) 대화 감지 기능 탑재 강조할 것. 2. 음질 수준 우수함 부각."
                  rows={3}
                  {...f2.register("required_points")}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>

              {/* 사용자 메모 / 참고 URL */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  참고 자료 링크 URL 주소 혹은 사용자 메모
                </label>
                <textarea
                  placeholder="예: 참고 사양 정보: https://samsung.com/galaxy-buds-pro-specs"
                  rows={3}
                  {...f2.register("source_notes")}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </form>
        )}

        {/* ================= STEP 3 FORM ================= */}
        {step === 3 && (
          <form className="space-y-5">
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <Sparkles className="h-4 w-4 text-primary" />
              STEP 3: 실제 경험 정보 기획 (리뷰 및 체험수기 원본성)
            </h2>

            {/* 직접 경험 여부 토글 카드 */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                중요: 본 포스팅 주제에 대해 직접 결제/사용/방문한 리얼 경험이 포함됩니까?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1.5">
                <label
                  className={`border p-4 rounded-2xl flex items-center gap-3 cursor-pointer transition-all shadow-sm ${
                    f3.watch("has_direct_experience") === true
                      ? "border-primary bg-primary/5 text-primary dark:border-primary/40"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 text-zinc-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="has_direct_experience"
                    checked={f3.watch("has_direct_experience") === true}
                    onChange={() => {
                      f3.setValue("has_direct_experience", true);
                      f3.trigger("has_direct_experience");
                    }}
                    className="h-4 w-4 text-primary focus:ring-primary border-zinc-300"
                  />
                  <div>
                    <p className="text-xs font-bold">네, 직접 경험한 생생한 실화가 있습니다.</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">사용자 경험 기획 단계 입력을 활성화합니다. (추천)</p>
                  </div>
                </label>

                <label
                  className={`border p-4 rounded-2xl flex items-center gap-3 cursor-pointer transition-all shadow-sm ${
                    f3.watch("has_direct_experience") === false
                      ? "border-primary bg-primary/5 text-primary dark:border-primary/40"
                      : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 text-zinc-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="has_direct_experience"
                    checked={f3.watch("has_direct_experience") === false}
                    onChange={() => {
                      f3.setValue("has_direct_experience", false);
                      f3.setValue("confirmed_by_user", false);
                      f3.trigger("has_direct_experience");
                    }}
                    className="h-4 w-4 text-primary focus:ring-primary border-zinc-300"
                  />
                  <div>
                    <p className="text-xs font-bold">아니오, 일반적인 정보 수집 위주의 원고입니다.</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">경험 단계 항목은 필수가 아니며, 가볍게 건너뜁니다.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* 직접 경험이 활성화된 경우에만 렌더링 */}
            {f3.watch("has_direct_experience") && (
              <div className="space-y-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 사용 기간 */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      실제 사용 기간 (예: 3달간, 2주)
                    </label>
                    <input
                      type="text"
                      placeholder="예: 3개월간 사용"
                      {...f3.register("usage_period")}
                      className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  {/* 결제 및 방문 가격 */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      지출 비용 및 가격 정보 (예: 내돈내산 19만원)
                    </label>
                    <input
                      type="text"
                      placeholder="예: 쿠팡에서 18만 5천원에 구입"
                      {...f3.register("price_info")}
                      className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  {/* 날짜 */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      경험하거나 방문한 날짜
                    </label>
                    <input
                      type="date"
                      {...f3.register("experienced_at")}
                      className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 동기 */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      구매 혹은 서비스 이용 동기 (계기)
                    </label>
                    <textarea
                      placeholder="예: 기존 유선 이어폰의 줄 꼬임과 카페에서 작업 시 주변 소음이 심하여 ANC 무선 이어폰 구매 결정"
                      rows={2}
                      {...f3.register("motivation")}
                      className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  {/* 사용 전 문제 */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      사용하기 전에 겪었던 고충과 문제점
                    </label>
                    <textarea
                      placeholder="예: 출퇴근길 지하철 소음 때문에 음악 소리가 묻히고 귀가 너무 쉽게 피로해짐"
                      rows={2}
                      {...f3.register("problem_before")}
                      className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 장점 */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-emerald-600 dark:text-emerald-450">
                      직접 경험하며 체감한 핵심 장점
                    </label>
                    <textarea
                      placeholder="예: 주변 지하철 소리가 90% 이상 묻히는 압도적인 노이즈 캔슬링 차단 능력 및 맑은 통화 품질"
                      rows={2}
                      {...f3.register("advantages")}
                      className="mt-1 appearance-none block w-full px-3 py-2 border border-emerald-300 dark:border-emerald-900/50 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-transparent"
                    />
                  </div>

                  {/* 단점 */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-red-500">
                      직접 경험하며 발견한 리얼 단점 (비평)
                    </label>
                    <textarea
                      placeholder="예: 이어버드 크기가 제법 커서 귓구멍이 작은 경우 2시간 이상 연속 착용 시 귀 통증이 발생함"
                      rows={2}
                      {...f3.register("disadvantages")}
                      className="mt-1 appearance-none block w-full px-3 py-2 border border-red-300 dark:border-red-950/50 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-red-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 추천 대상 */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      이런 사람에게 적극 추천합니다
                    </label>
                    <textarea
                      placeholder="예: 대중교통 이용 빈도가 매우 높고, 통근 시간 정적을 즐기거나 외부 소음을 차단하고 집중해야 하는 프리랜서 마케터"
                      rows={2}
                      {...f3.register("recommended_for")}
                      className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  {/* 비추천 대상 */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      이런 사람에겐 추천하지 않습니다
                    </label>
                    <textarea
                      placeholder="예: 귀구멍이 작아 커널형 이어폰을 평소 혐오하는 편이거나 무선 음질에 극도로 예민한 오디오 마니아층"
                      rows={2}
                      {...f3.register("not_recommended_for")}
                      className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                {/* 실제 에피소드 및 서약 */}
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    생동감을 부여하는 리얼 사건/에피소드 서술
                  </label>
                  <textarea
                    placeholder="예: 강남역 출퇴근 시간 지옥철에서 ANC를 켜자마자 고요 속에서 저만 클래식 음악을 듣는 듯한 환상적인 경험을 했습니다."
                    rows={2}
                    {...f3.register("real_episode")}
                    className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800/80 flex items-start gap-3 mt-4">
                  <input
                    type="checkbox"
                    id="confirmed_by_user"
                    {...f3.register("confirmed_by_user")}
                    className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary mt-0.5"
                  />
                  <label htmlFor="confirmed_by_user" className="text-[11px] font-bold text-zinc-600 dark:text-zinc-350 cursor-pointer">
                    위 서술한 내용은 실체험 기반의 진실한 개인적 경험 및 팩트 정보임을 서약합니다. (동의 시에만 다음 단계 이동이 허용됩니다.)
                  </label>
                </div>
                {f3.formState.errors.confirmed_by_user && (
                  <p className="text-[10px] text-red-500 font-semibold">{f3.formState.errors.confirmed_by_user.message}</p>
                )}
              </div>
            )}
          </form>
        )}

        {/* ================= STEP 4 FORM ================= */}
        {step === 4 && (
          <form className="space-y-5">
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <Layers className="h-4 w-4 text-primary" />
              STEP 4: 발행 양식 및 본문 레이아웃 구조 설계
            </h2>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 flex items-start gap-2.5">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal">
                선택된 플랫폼의 AI 권장값에 따라 기본 레이아웃 구성이 사전 연동되었습니다. 필요 시 목표 분량 및 이미지 수를 커스텀 조율할 수 있습니다.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 목표 글자 수 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  목표 텍스트 분량 (글자 수 기준)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={100}
                    max={50000}
                    step={100}
                    {...f4.register("target_character_count", { valueAsNumber: true })}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-xs font-extrabold text-zinc-850 dark:text-zinc-200 min-w-[70px] text-right">
                    {f4.watch("target_character_count")?.toLocaleString()} 자
                  </span>
                </div>
                {f4.formState.errors.target_character_count && (
                  <p className="text-[10px] text-red-500 font-semibold">{f4.formState.errors.target_character_count.message}</p>
                )}
              </div>

              {/* 요청 이미지 수 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  원고 삽입 이미지 요구량 (장수 기준)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={1}
                    {...f4.register("requested_image_count", { valueAsNumber: true })}
                    className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                  />
                  <span className="text-xs font-extrabold text-zinc-850 dark:text-zinc-200 min-w-[70px] text-right">
                    {f4.watch("requested_image_count")} 장
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              {/* 제목 안 후보 갯수 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  AI 제안 제목 후보 갯수
                </label>
                <input
                  type="number"
                  {...f4.register("title_candidates_count", { valueAsNumber: true })}
                  className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none"
                />
              </div>

              {/* 소제목 갯수 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  기본 구성 Heading(소제목) 갯수
                </label>
                <input
                  type="number"
                  {...f4.register("subheadings_count", { valueAsNumber: true })}
                  className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none"
                />
              </div>

              {/* FAQ 갯수 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  글 마지막 FAQ 삽입 개수
                </label>
                <input
                  type="number"
                  {...f4.register("faq_count", { valueAsNumber: true })}
                  className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none"
                />
              </div>
            </div>

            {/* 구조 요소 토글 체크박스 그룹 */}
            <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
                레이아웃 내 필수 삽입 블록 요소 지정
              </label>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: "has_toc" as const, label: "자동 목차 블록 (TOC)" },
                  { key: "has_table" as const, label: "비교 분석 요약 표 (Table)" },
                  { key: "has_list" as const, label: "리스트 항목 나열 (List)" },
                  { key: "has_summary_box" as const, label: "핵심 요약 박스 (Summary)" },
                  { key: "has_cta" as const, label: "CTA 유도 버튼/배지" },
                  { key: "has_sources" as const, label: "참고 출처 인용 표시" },
                  { key: "has_conclusion" as const, label: "끝맺음 결론 도출" },
                ].map((item) => (
                  <label
                    key={item.key}
                    className={`border p-3.5 rounded-xl flex items-center gap-2.5 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors shadow-sm ${
                      f4.watch(item.key) ? "border-primary/45 bg-primary/5 text-primary" : "border-zinc-200 dark:border-zinc-800 text-zinc-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={f4.watch(item.key)}
                      onChange={(e) => {
                        f4.setValue(item.key, e.target.checked);
                        f4.trigger(item.key);
                      }}
                      className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
                    />
                    <span className="text-[11px] font-bold">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </form>
        )}

        {/* ================= STEP 5 FORM ================= */}
        {step === 5 && (
          <form className="space-y-5">
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <Volume2 className="h-4 w-4 text-primary" />
              STEP 5: 원고 AI 작성을 위한 미세 문체 설정
            </h2>

            {/* 브랜드 보이스 계승 여부 */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-850 rounded-2xl flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">브랜드 기본 보이스 계승</p>
                <p className="text-[10px] text-zinc-400">
                  활성화 시, Phase 2에서 설정 및 승인 완료한 브랜드 기본 보이스 8대 척도를 계승하여 원고가 기획됩니다.
                </p>
              </div>
              <input
                type="checkbox"
                checked={f5.watch("use_brand_voice")}
                onChange={(e) => {
                  f5.setValue("use_brand_voice", e.target.checked);
                  f5.trigger("use_brand_voice");
                }}
                className="h-5 w-5 rounded border-zinc-300 text-primary focus:ring-primary"
              />
            </div>

            {/* 브랜드 보이스 해제 시에만 가중치 슬라이더 표시 */}
            {!f5.watch("use_brand_voice") && (
              <div className="space-y-5 animate-fadeIn">
                <div className="flex justify-between items-center bg-amber-500/10 text-amber-600 dark:text-amber-400 px-4 py-2 border border-amber-500/20 rounded-xl">
                  <span className="text-xs font-bold flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    문체별 가중치 조율 (커스텀 믹싱)
                  </span>
                  <span className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${customWeightsSum === 100 ? "bg-emerald-500 text-white" : "bg-red-500 text-white animate-pulse"}`}>
                    가중치 합계: {customWeightsSum} % (목표 100%)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { key: "formal" as const, name: "공식적 / 발표체" },
                    { key: "friendly" as const, name: "친근함 / 구어체" },
                    { key: "honest" as const, name: "솔직함 / 주관식" },
                    { key: "plain" as const, name: "담백함 / 객관식" },
                    { key: "luxury" as const, name: "고급스러움 / 품위체" },
                    { key: "witty" as const, name: "유쾌함 / 트렌디체" },
                    { key: "consultant" as const, name: "전문가형 / 상담체" },
                    { key: "reviewer" as const, name: "소비자형 / 후기체" },
                    { key: "journalist" as const, name: "기자형 / 기사보도체" },
                  ].map((slider) => (
                    <div key={slider.key} className="space-y-2 border border-zinc-100 dark:border-zinc-800 p-3.5 rounded-xl shadow-xs">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-zinc-700 dark:text-zinc-300">{slider.name}</span>
                        <span className="text-primary font-extrabold">{f5.watch(slider.key)} %</span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={5}
                        {...f5.register(slider.key, { valueAsNumber: true })}
                        className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                      />
                    </div>
                  ))}
                </div>
                {f5.formState.errors.formal && (
                  <p className="text-xs text-red-500 font-bold">{f5.formState.errors.formal.message}</p>
                )}
              </div>
            )}
          </form>
        )}

        {/* ================= STEP 6 FORM ================= */}
        {step === 6 && (
          <form className="space-y-6">
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              STEP 6: AI 이미지 생성 및 최종 입력 기획안 검토
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* 이미지 개수 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  필요 이미지 갯수
                </label>
                <input
                  type="number"
                  {...f6.register("image_count", { valueAsNumber: true })}
                  className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none"
                />
              </div>

              {/* 이미지 스타일 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  요청 이미지 테마 스타일
                </label>
                <select
                  {...f6.register("style")}
                  className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent"
                >
                  {IMAGE_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {IMAGE_STYLE_LABELS[style]}
                    </option>
                  ))}
                </select>
              </div>

              {/* 종횡비 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  기본 이미지 화면 비율
                </label>
                <select
                  {...f6.register("aspect_ratio")}
                  className="mt-1 block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="16:9">16:9 와이드 (가로형 블로그)</option>
                  <option value="1:1">1:1 스퀘어 (정사각형 소셜용)</option>
                  <option value="4:3">4:3 스탠다드</option>
                  <option value="9:16">9:16 버티컬 (세로형 스토리)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                이미지 준비 및 획득 방식 선택 (중복 가능)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { key: "generate_ai" as const, label: "AI 이미지 모델 자동 생성 가동" },
                  { key: "use_uploaded" as const, label: "사용자 실촬영 업로드 이미지 병합" },
                  { key: "prepare_personally" as const, label: "발행 전 직접 수동 준비 예정" },
                ].map((item) => (
                  <label
                    key={item.key}
                    className={`border p-3 rounded-xl flex items-center gap-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors shadow-sm ${
                      f6.watch(item.key) ? "border-primary/45 bg-primary/5 text-primary" : "border-zinc-200 dark:border-zinc-800 text-zinc-600"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={f6.watch(item.key)}
                      onChange={(e) => {
                        f6.setValue(item.key, e.target.checked);
                        f6.trigger(item.key);
                      }}
                      className="h-4 w-4 rounded border-zinc-300 text-primary"
                    />
                    <span className="text-[10px] font-bold">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 이미지 텍스트 오버레이 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  카드 뉴스 / 썸네일 오버레이 텍스트 문구
                </label>
                <input
                  type="text"
                  placeholder="예: 갤럭시 버즈 프로 솔직 리뷰"
                  {...f6.register("text_overlay")}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg text-xs dark:bg-zinc-950 focus:outline-none"
                />
              </div>

              {/* 로고 포함 */}
              <div className="pt-7 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="include_logo"
                  {...f6.register("include_logo")}
                  className="h-5 w-5 rounded border-zinc-300 text-primary focus:ring-primary"
                />
                <label htmlFor="include_logo" className="text-xs font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                  생성 이미지 좌측 상단에 브랜드 로고 워터마크 표시 요청
                </label>
              </div>
            </div>

            {/* 최종 기획 종합 검토 패널 */}
            <div className="border border-zinc-200/60 dark:border-zinc-800/80 rounded-2xl p-6 bg-zinc-50/50 dark:bg-zinc-950/20 space-y-4">
              <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-150 dark:border-zinc-850 pb-2">
                최종 기획 종합 검토 요약본
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <p className="text-zinc-500"><strong>기획 제목:</strong> {f2.getValues("title") || "새 콘텐츠 기획안"}</p>
                  <p className="text-zinc-500">
                    <strong>선택 브랜드:</strong> {brands.find((b) => b.id === f1.getValues("brand_id"))?.name || "선택 안됨"}
                  </p>
                  <p className="text-zinc-500"><strong>기획 목적:</strong> {GOAL_LABELS[f1.getValues("content_goal")] || f1.getValues("content_goal")}</p>
                  <p className="text-zinc-500"><strong>원고 유형:</strong> {TYPE_LABELS[f1.getValues("content_type")] || f1.getValues("content_type")}</p>
                </div>
                <div className="space-y-1.5">
                  <p className="text-zinc-500"><strong>타겟 채널:</strong> {f1.getValues("platforms")?.join(", ") || "지정 안됨"}</p>
                  <p className="text-zinc-500"><strong>핵심 키워드:</strong> {f2.getValues("primary_keyword")}</p>
                  <p className="text-zinc-500"><strong>목표 글자수:</strong> {f4.getValues("target_character_count")?.toLocaleString()} 자</p>
                  <p className="text-zinc-500">
                    <strong>경험 여부:</strong> {f3.getValues("has_direct_experience") ? "네, 리얼 경험 정보 포함됨" : "아니오, 일반 정보 기사형"}
                  </p>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* ================= 하단 제어 조작 단추그룹 ================= */}
        <div className="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800 pt-5">
          <button
            type="button"
            onClick={handleBack}
            disabled={step === 1 || isPending}
            className="inline-flex items-center gap-1 px-4 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft className="h-4 w-4" />
            이전 단계로
          </button>

          {step < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-4 py-2 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-sm"
            >
              다음 단계로
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalize}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/95 transition-all shadow-md"
            >
              <CheckCircle className="h-4 w-4" />
              최종 기획안 확정
            </button>
          )}
        </div>
      </div>

      {/* ================= 경험형 검증 경증 안내 모달 (Warning Modal) ================= */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/80 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-5 mx-4">
            <div className="flex items-center gap-2 text-red-500">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-sm font-bold">경험형 콘텐츠 검증 경고</h3>
            </div>
            
            <div className="space-y-2">
              <p className="text-xs text-zinc-650 dark:text-zinc-350 leading-relaxed font-semibold">
                선택하신 기획 원고 형태는 <span className="text-red-500">리뷰형/체험수기형</span>입니다. 그러나 직접 사용해 본 사실적 경험 여부 지표가 비활성화되어 있습니다.
              </p>
              <p className="text-[11px] text-zinc-400 leading-normal">
                검색 노출 최적화를 위한 구글 E-E-A-T 및 네이버 스마트블록 검색엔진은 경험 없는 리뷰글을 오남용 글로 오판할 수 있습니다. 어떻게 변경해 진행할까요?
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              {/* 옵션 1: 스텝 3에서 직접 경험 작성하기 */}
              <button
                onClick={handleWarningKeepExperience}
                className="w-full text-left p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-950 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                <div>
                  <p>1. 내돈내산 직접 경험 정보 입력하기</p>
                  <p className="text-[9px] text-zinc-400 mt-0.5 font-normal">경험 항목 입력 스크린(STEP 3)으로 되돌아가 작성합니다.</p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </button>

              {/* 옵션 2: 정보제공형으로 강제 유형 변경 */}
              <button
                onClick={handleWarningConvertToInformational}
                className="w-full text-left p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-950 flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                <div>
                  <p>2. 정보제공형(INFORMATIONAL) 콘텐츠로 자동 변경</p>
                  <p className="text-[9px] text-zinc-400 mt-0.5 font-normal">직접 경험 여부가 필요 없는 객관적 정보제공 글로 기획을 변경해 계속 진행합니다.</p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-400" />
              </button>

              {/* 옵션 3: 단정하지 않는 가벼운 정보글로 강제 강행 */}
              <button
                onClick={handleWarningForceProceed}
                className="w-full text-left p-3 border border-red-200 dark:border-red-950/50 bg-red-500/5 hover:bg-red-500/10 rounded-xl flex items-center justify-between text-xs font-bold text-red-600 dark:text-red-400 transition-colors"
              >
                <div>
                  <p>3. 단정하지 않는 단순 정보글로 강제 계속 진행</p>
                  <p className="text-[9px] text-red-500/80 mt-0.5 font-normal">경험을 직접 단정하지 않고 인용 형식으로 작성하는 글로 설정하여 강행 처리합니다.</p>
                </div>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
