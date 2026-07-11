"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { updateVoiceProfile, approveVoiceProfile } from "@/lib/actions/brand";
import { voiceProfileSchema, type VoiceProfileInput } from "@/lib/schemas/brand";
import {
  Volume2,
  Sparkles,
  ArrowLeft,
  Loader2,
  CheckCircle,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  Info,
} from "lucide-react";
import Link from "next/link";

interface VoiceProfileFormProps {
  brandId: string;
  brandName: string;
  initialData: Partial<VoiceProfileInput> & { approved_at?: string | null };
}

export default function VoiceProfileForm({
  brandId,
  brandName,
  initialData,
}: VoiceProfileFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VoiceProfileInput>({
    resolver: zodResolver(voiceProfileSchema),
    defaultValues: {
      formal_level: initialData.formal_level ?? 3,
      sentence_length: initialData.sentence_length ?? 3,
      expertise_level: initialData.expertise_level ?? 3,
      emotional_level: initialData.emotional_level ?? 3,
      sales_level: initialData.sales_level ?? 3,
      humor_level: initialData.humor_level ?? 3,
      emoji_level: initialData.emoji_level ?? 3,
      question_level: initialData.question_level ?? 3,
      honorific_style: initialData.honorific_style ?? "HONORIFIC",
      preferred_phrases: initialData.preferred_phrases ?? "",
      forbidden_phrases: initialData.forbidden_phrases ?? "",
      proprietary_terms: initialData.proprietary_terms ?? "",
      intro_style: initialData.intro_style ?? "",
      closing_style: initialData.closing_style ?? "",
      cta_style: initialData.cta_style ?? "",
      analysis_summary: initialData.analysis_summary ?? "",
    },
  });

  const currentValues = watch();

  const handleSave = async (data: VoiceProfileInput) => {
    setIsLoading(true);
    const loadingId = toast.loading("보이스 프로필을 저장하고 있습니다...");

    try {
      await updateVoiceProfile(brandId, data);
      toast.dismiss(loadingId);
      toast.success("보이스 프로필이 저장되었습니다.");
      router.refresh();
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`저장 실패: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // AI 권장 분석 요약본에서 정수 지표들을 추출하여 슬라이더 값으로 자동 이식 및 승인
  const handleApproveAIRecommendation = async () => {
    const summary = currentValues.analysis_summary;
    if (!summary) return;

    const loadingId = toast.loading("AI 추천 어조를 승인하고 설정에 대입합니다...");
    setIsLoading(true);

    try {
      // 정규식을 통한 슬라이더 권장값 파싱
      const formalMatch = summary.match(/공식성 (\d)단계/);
      const lengthMatch = summary.match(/문장길이 (\d)단계/);
      const emojiMatch = summary.match(/이모지 (\d)단계/);
      const questionMatch = summary.match(/질문빈도 (\d)단계/);

      if (formalMatch) setValue("formal_level", parseInt(formalMatch[1], 10));
      if (lengthMatch) setValue("sentence_length", parseInt(lengthMatch[1], 10));
      if (emojiMatch) setValue("emoji_level", parseInt(emojiMatch[1], 10));
      if (questionMatch) setValue("question_level", parseInt(questionMatch[1], 10));

      // 승인 서버액션 동시 호출
      await approveVoiceProfile(brandId);

      toast.dismiss(loadingId);
      toast.success("AI 추천 문체가 슬라이더에 대입되었으며 최종 승인 처리되었습니다!");
      router.refresh();
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`승인 처리 실패: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const sliders = [
    {
      key: "formal_level" as const,
      name: "공격식 수준 (Formal)",
      minDesc: "완전 편안함 (친근하게 대화)",
      maxDesc: "아주 격식있음 (공식 발표문조)",
    },
    {
      key: "sentence_length" as const,
      name: "문장 길이 (Sentence)",
      minDesc: "매우 짧고 간결함 (단문)",
      maxDesc: "긴 흐름 및 만연체 선호",
    },
    {
      key: "expertise_level" as const,
      name: "전문성 수준 (Expertise)",
      minDesc: "쉬운 대중적 어조",
      maxDesc: "전문 기술 용어 적극 사용",
    },
    {
      key: "emotional_level" as const,
      name: "감성 수준 (Emotional)",
      minDesc: "이성적 / 논리적 / 팩트중심",
      maxDesc: "감성적 / 정서적 공감",
    },
    {
      key: "sales_level" as const,
      name: "홍보/판촉 강도 (Sales)",
      minDesc: "순수 정보성 (중립적 설명)",
      maxDesc: "강한 세일즈 카피 (행동 촉구)",
    },
    {
      key: "humor_level" as const,
      name: "위트/유머 수준 (Humor)",
      minDesc: "아주 진중함",
      maxDesc: "트렌디한 농담 / 드립 사용",
    },
    {
      key: "emoji_level" as const,
      name: "이모지 빈도 (Emoji)",
      minDesc: "전혀 안씀",
      maxDesc: "어절마다 이모지 다수 배치",
    },
    {
      key: "question_level" as const,
      name: "질문형 빈도 (Question)",
      minDesc: "단정적인 마침표 종결",
      maxDesc: "독자에게 호기심 유도 질문 많음",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 타이틀 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-1">
        <div className="flex items-center gap-2">
          <Link
            href="/brands"
            className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Volume2 className="h-5 w-5 text-primary" />
              어조 설정 (보이스 프로필)
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              브랜드 &ldquo;{brandName}&rdquo;의 성향 지표를 수동으로 조율하거나 과거 작성글 분석 결과로 세팅합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-850">
        <Link
          href={`/brands/${brandId}/voice`}
          className="pb-3 px-4 text-xs font-bold border-b-2 border-primary text-primary transition-all"
        >
          보이스(어조) 설정
        </Link>
        <Link
          href={`/brands/${brandId}/samples`}
          className="pb-3 px-4 text-xs font-bold border-b-2 border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all"
        >
          작성글 샘플 분석
        </Link>
      </div>

      {/* AI 추천 권장안 알림 */}
      {currentValues.analysis_summary && (
        <div className={`p-6 rounded-2xl border ${
          initialData.approved_at 
            ? "bg-zinc-50 dark:bg-zinc-950/20 border-zinc-200/60 dark:border-zinc-800/80" 
            : "bg-primary/5 border-primary/30 ring-1 ring-primary/5"
        } flex flex-col md:flex-row gap-5 items-start justify-between`}>
          <div className="space-y-2 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                initialData.approved_at 
                  ? "bg-zinc-250 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                  : "bg-primary text-white"
              }`}>
                {initialData.approved_at ? "승인 완료됨" : "AI 추천 권장안 대기"}
              </span>
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                작성글 샘플 분석 요약
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {currentValues.analysis_summary}
            </p>
            {initialData.approved_at && (
              <p className="text-[10px] text-zinc-400 font-semibold flex items-center gap-0.5">
                <CheckCircle className="h-3 w-3 text-emerald-500" />
                마지막 승인 일시: {new Date(initialData.approved_at).toLocaleString()}
              </p>
            )}
          </div>
          {!initialData.approved_at && (
            <button
              type="button"
              onClick={handleApproveAIRecommendation}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-4 border border-transparent rounded-xl shadow-sm text-xs font-bold text-white bg-primary hover:bg-primary/95 transition-all self-stretch md:self-auto cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI 권장 어조 승인 및 적용
            </button>
          )}
        </div>
      )}

      {/* 보이스 폼 */}
      <form onSubmit={handleSubmit(handleSave)} className="grid grid-cols-1 lg:grid-cols-3 gap-6" noValidate>
        {/* 좌측 2개 컬럼: 8가지 슬라이더 */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-6 rounded-2xl shadow-sm space-y-6">
          <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-100 dark:border-zinc-850 pb-2">
            8대 문체 척도 슬라이더 (1~5 단계)
          </h3>

          <div className="space-y-6">
            {sliders.map((slider) => {
              const val = currentValues[slider.key] as number;
              return (
                <div key={slider.key} className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">
                      {slider.name}
                    </span>
                    <span className="font-black text-primary px-2 py-0.5 rounded bg-primary/10">
                      {val} 단계
                    </span>
                  </div>
                  
                  {/* 슬라이더 컨트롤 */}
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] text-zinc-400 w-1/4 truncate text-left">
                      {slider.minDesc}
                    </span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      step={1}
                      disabled={isLoading}
                      {...register(slider.key, { valueAsNumber: true })}
                      className="w-2/4 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-[10px] text-zinc-400 w-1/4 truncate text-right">
                      {slider.maxDesc}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 우측 1개 컬럼: 어미 종류 및 상투적 문구 제어 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-6 rounded-2xl shadow-sm space-y-6 flex flex-col justify-between">
          <div className="space-y-5">
            <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-100 dark:border-zinc-850 pb-2">
              용어 및 인트로/아웃트로 지정
            </h3>

            {/* 존댓말 스타일 */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                종결 스타일 (종결 어미)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "HONORIFIC", label: "존댓말 (~요/습니다)" },
                  { id: "CASUAL", label: "반말 (~다/어)" },
                  { id: "NEUTRAL", label: "중립 / 혼용" },
                ].map((style) => (
                  <label
                    key={style.id}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center cursor-pointer transition-all ${
                      currentValues.honorific_style === style.id
                        ? "border-primary bg-primary/5 font-bold"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950"
                    }`}
                  >
                    <input
                      type="radio"
                      value={style.id}
                      disabled={isLoading}
                      {...register("honorific_style")}
                      className="sr-only"
                    />
                    <span className="text-[10px] text-zinc-700 dark:text-zinc-300">{style.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 선호 단어 / 금지 단어 / 브랜드 용어 */}
            <div className="space-y-3">
              <div>
                <label htmlFor="preferred_phrases" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  선호 어휘 / 카피 키워드 (쉼표 구분)
                </label>
                <input
                  id="preferred_phrases"
                  type="text"
                  placeholder="예: 스마트한, 합리적인, 간단히"
                  disabled={isLoading}
                  {...register("preferred_phrases")}
                  className="mt-1 appearance-none block w-full px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-xs dark:bg-zinc-950"
                />
              </div>

              <div>
                <label htmlFor="forbidden_phrases" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  금지 표현 / 기피 키워드 (쉼표 구분)
                </label>
                <input
                  id="forbidden_phrases"
                  type="text"
                  placeholder="예: 대박, 엄청난, 즉시환불"
                  disabled={isLoading}
                  {...register("forbidden_phrases")}
                  className="mt-1 appearance-none block w-full px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-xs dark:bg-zinc-950"
                />
              </div>

              <div>
                <label htmlFor="proprietary_terms" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  고유 고유명사 / 전용 명칭 (쉼표 구분)
                </label>
                <input
                  id="proprietary_terms"
                  type="text"
                  placeholder="예: AI콘텐츠봇, 콘텐츠비서"
                  disabled={isLoading}
                  {...register("proprietary_terms")}
                  className="mt-1 appearance-none block w-full px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-xs dark:bg-zinc-950"
                />
              </div>
            </div>

            {/* 도입/결말부 템플릿 */}
            <div className="space-y-3">
              <div>
                <label htmlFor="intro_style" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  첫인사 / 도입부 상투구
                </label>
                <input
                  id="intro_style"
                  type="text"
                  placeholder="예: 안녕하세요, AI콘텐츠봇입니다!"
                  disabled={isLoading}
                  {...register("intro_style")}
                  className="mt-1 appearance-none block w-full px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-xs dark:bg-zinc-950"
                />
              </div>

              <div>
                <label htmlFor="closing_style" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  끝인사 / 종결 상투구
                </label>
                <input
                  id="closing_style"
                  type="text"
                  placeholder="예: 더 나은 내일로 보답하겠습니다. 감사합니다."
                  disabled={isLoading}
                  {...register("closing_style")}
                  className="mt-1 appearance-none block w-full px-2.5 py-1.5 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-xs dark:bg-zinc-950"
                />
              </div>
            </div>
          </div>

          {/* 저장 버튼 */}
          <div className="pt-4 border-t border-zinc-150 dark:border-zinc-800">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  저장 중...
                </>
              ) : (
                "보이스 정보 저장"
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
