"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { brandSchema, type BrandInput } from "@/lib/schemas/brand";
import { useToast } from "@/components/ui/toast";
import { Loader2, ArrowRight, ArrowLeft, Target, Briefcase, Sparkles } from "lucide-react";

export default function OnboardingBrandPage() {
  const [step, setStep] = useState(1);
  const [goals, setGoals] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const completeOnboarding = useMutation(api.profiles.completeOnboarding);

  const goalOptions = [
    { id: "SEARCH_TRAFFIC", name: "검색 유입 극대화", desc: "검색엔진 SEO 점수 기반 상위 노출용 글 제작" },
    { id: "ADSENSE_APPROVAL", name: "애드센스 승인", desc: "애드센스 광고 승인을 돕는 전문성 높은 글" },
    { id: "ADSENSE_REVENUE", name: "광고 수익형 블로그", desc: "수익성 높은 정보성 포스팅 생산" },
    { id: "PRODUCT_SALES", name: "상품 홍보 및 판매", desc: "제품 구매를 유도하는 리뷰 및 설득 카피" },
    { id: "SNS_ENGAGEMENT", name: "SNS 채널 성장", desc: "인스타그램 캡션 및 해시태그 기반 인게이지먼트" },
    { id: "AGENCY_PROD", name: "대행사 전문 원고", desc: "클라이언트 브랜드별 대량 글 작성 대응" },
  ];

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BrandInput>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: "",
      industry: "",
      description: "",
      tagline: "",
      website_url: "",
      target_audience: "",
      customer_problems: "",
      products_services: "",
      core_values: "",
      default_cta: "",
      legal_notice: "",
      is_default: true,
    },
  });

  const toggleGoal = (id: string) => {
    setGoals((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleCompleteOnboarding = async (brandData?: BrandInput) => {
    setIsLoading(true);
    const loadingId = toast.loading("온보딩 설정을 완료하고 있습니다...");

    try {
      // Convex mutation 호출
      await completeOnboarding({
        goals,
        brandData: brandData
          ? {
              name: brandData.name,
              industry: brandData.industry || undefined,
              description: brandData.description || undefined,
              target_audience: brandData.target_audience || undefined,
            }
          : undefined,
      });

      toast.dismiss(loadingId);
      toast.success("온보딩이 완료되었습니다. 대시보드로 이동합니다!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`온보딩 완료 실패: ${err.message || "알 수 없는 오류"}`);
      setIsLoading(false);
    }
  };

  const onBrandSubmit = async (data: BrandInput) => {
    await handleCompleteOnboarding(data);
  };

  const handleSkip = async () => {
    await handleCompleteOnboarding();
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-12 w-12 rounded-xl bg-primary items-center justify-center text-primary-foreground font-black text-2xl shadow-lg shadow-primary/20">
          AI
        </div>
        <h2 className="mt-6 text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
          초기 온보딩 설정
        </h2>
        <p className="mt-2 text-sm text-zinc-500">
          사용자 맞춤형 AI 결과 도출을 위한 2단계 초기 설정을 완료해 주세요.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white dark:bg-zinc-900 py-8 px-6 shadow-xl border border-zinc-200/50 dark:border-zinc-800/50 sm:rounded-2xl sm:px-10">
          {/* 단계 표시기 */}
          <div className="flex justify-between items-center mb-8 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <span className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase">
              {step === 1 ? "1단계 / 2단계" : "2단계 / 2단계"}
            </span>
            <div className="flex gap-1.5">
              <span className={`h-2 w-8 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-zinc-200"}`} />
              <span className={`h-2 w-8 rounded-full transition-colors ${step === 2 ? "bg-primary" : "bg-zinc-200"}`} />
            </div>
          </div>

          {/* STEP 1: 이용 목적 선택 */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  콘텐츠를 작성하는 목적이 무엇인가요?
                </h3>
                <p className="text-xs text-zinc-400">
                  선택하신 정보에 맞추어 플랫폼별 글자 수 및 노출 키워드 가중치가 맞춤화됩니다. (복수 선택 가능)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {goalOptions.map((opt) => {
                  const isSelected = goals.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleGoal(opt.id)}
                      className={`flex flex-col items-start text-left p-4 rounded-xl border transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                      }`}
                    >
                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200">{opt.name}</span>
                      <span className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={goals.length === 0}
                  className="flex items-center gap-2 py-2 px-5 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  다음 단계
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: 기본 브랜드 등록 */}
          {step === 2 && (
            <form onSubmit={handleSubmit(onBrandSubmit)} className="space-y-6" noValidate>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-primary" />
                  첫 번째 브랜드 프로필 정보
                </h3>
                <p className="text-xs text-zinc-400">
                  AI가 글을 지어낼 때 참고할 브랜드 정체성입니다. 나중에 언제든지 변경할 수 있으며 지금 생략할 수도 있습니다.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      브랜드 이름 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="name"
                      type="text"
                      placeholder="예: AI콘텐츠봇"
                      disabled={isLoading}
                      {...register("name")}
                      className={`mt-1 appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm dark:bg-zinc-950 ${
                        errors.name ? "border-rose-300 focus:ring-rose-500" : "border-zinc-300 dark:border-zinc-800"
                      }`}
                    />
                    {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
                  </div>

                  <div>
                    <label htmlFor="industry" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      대표 업종 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="industry"
                      type="text"
                      placeholder="예: IT 소프트웨어 / 마케팅"
                      disabled={isLoading}
                      {...register("industry")}
                      className={`mt-1 appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm dark:bg-zinc-950 ${
                        errors.industry ? "border-rose-300 focus:ring-rose-500" : "border-zinc-300 dark:border-zinc-800"
                      }`}
                    />
                    {errors.industry && <p className="mt-1 text-xs text-rose-500">{errors.industry.message}</p>}
                  </div>
                </div>

                <div>
                  <label htmlFor="tagline" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    브랜드 슬로건 (한 줄 소개)
                  </label>
                  <input
                    id="tagline"
                    type="text"
                    placeholder="예: 콘텐츠 제작의 새로운 지평을 엽니다."
                    disabled={isLoading}
                    {...register("tagline")}
                    className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm dark:bg-zinc-950"
                  />
                </div>

                <div>
                  <label htmlFor="website_url" className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    홈페이지 주소 (URL)
                  </label>
                  <input
                    id="website_url"
                    type="text"
                    placeholder="예: www.antigravity.ai"
                    disabled={isLoading}
                    {...register("website_url")}
                    className={`mt-1 appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm dark:bg-zinc-950 ${
                      errors.website_url ? "border-rose-300 focus:ring-rose-500" : "border-zinc-300 dark:border-zinc-800"
                    }`}
                  />
                  {errors.website_url && <p className="mt-1 text-xs text-rose-500">{errors.website_url.message}</p>}
                </div>
              </div>

              <div className="flex justify-between items-center pt-5 border-t border-zinc-150 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  disabled={isLoading}
                  className="flex items-center gap-1 py-2 px-3 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  이전으로
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSkip}
                    disabled={isLoading}
                    className="py-2 px-4 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm text-sm font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all cursor-pointer"
                  >
                    건너뛰기
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex items-center gap-2 py-2 px-5 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95 transition-all cursor-pointer"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        시작하기
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
