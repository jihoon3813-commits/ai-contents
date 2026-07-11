"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { brandSchema, type BrandInput } from "@/lib/schemas/brand";
import { Loader2, ArrowLeft, Sparkles, AlertCircle } from "lucide-react";
import Link from "next/link";

interface BrandFormProps {
  initialData?: Partial<BrandInput>;
  onSubmit: (data: BrandInput) => Promise<void>;
  isLoading: boolean;
  title: string;
}

export default function BrandForm({
  initialData,
  onSubmit,
  isLoading,
  title,
}: BrandFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BrandInput>({
    resolver: zodResolver(brandSchema),
    defaultValues: {
      name: initialData?.name || "",
      industry: initialData?.industry || "",
      description: initialData?.description || "",
      tagline: initialData?.tagline || "",
      website_url: initialData?.website_url || "",
      target_audience: initialData?.target_audience || "",
      customer_problems: initialData?.customer_problems || "",
      products_services: initialData?.products_services || "",
      core_values: initialData?.core_values || "",
      default_cta: initialData?.default_cta || "",
      legal_notice: initialData?.legal_notice || "",
      is_default: initialData?.is_default || false,
    },
  });

  return (
    <div className="max-w-3xl mx-auto bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-150 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/20 flex items-center justify-between">
        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          {title}
        </h2>
        <Link
          href="/brands"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          목록으로 돌아가기
        </Link>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6" noValidate>
        {/* 1. 기본 브랜드 정보 */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-primary tracking-wider uppercase border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
            기본 정보
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                브랜드 이름 <span className="text-rose-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                placeholder="예: AI콘텐츠봇"
                disabled={isLoading}
                {...register("name")}
                className={`mt-1 appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm dark:bg-zinc-950 ${
                  errors.name ? "border-rose-300 focus:ring-rose-500" : "border-zinc-300 dark:border-zinc-800"
                }`}
              />
              {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>}
            </div>

            <div>
              <label htmlFor="industry" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                대표 업종 <span className="text-rose-500">*</span>
              </label>
              <input
                id="industry"
                type="text"
                placeholder="예: IT 소프트웨어 / 서비스"
                disabled={isLoading}
                {...register("industry")}
                className={`mt-1 appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm dark:bg-zinc-950 ${
                  errors.industry ? "border-rose-300 focus:ring-rose-500" : "border-zinc-300 dark:border-zinc-800"
                }`}
              />
              {errors.industry && <p className="mt-1 text-xs text-rose-500">{errors.industry.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tagline" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                브랜드 슬로건
              </label>
              <input
                id="tagline"
                type="text"
                placeholder="예: 글쓰기의 중력을 벗어나다"
                disabled={isLoading}
                {...register("tagline")}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm dark:bg-zinc-950"
              />
            </div>

            <div>
              <label htmlFor="website_url" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                공식 홈페이지 주소
              </label>
              <input
                id="website_url"
                type="text"
                placeholder="예: www.antigravity.ai"
                disabled={isLoading}
                {...register("website_url")}
                className={`mt-1 appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm dark:bg-zinc-950 ${
                  errors.website_url ? "border-rose-300 focus:ring-rose-500" : "border-zinc-300 dark:border-zinc-800"
                }`}
              />
              {errors.website_url && <p className="mt-1 text-xs text-rose-500">{errors.website_url.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
              브랜드 소개 (상세 요약)
            </label>
            <textarea
              id="description"
              rows={3}
              placeholder="회사의 사명, 서비스의 취지, 핵심 타겟에게 호소하고자 하는 내용을 기록해 주세요."
              disabled={isLoading}
              {...register("description")}
              className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm dark:bg-zinc-950"
            />
          </div>
        </div>

        {/* 2. AI 마케팅 타겟 및 가치 상세 */}
        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-bold text-primary tracking-wider uppercase border-b border-zinc-100 dark:border-zinc-800 pb-1.5">
            마케팅 가치 설정 (AI 글쓰기 참고용)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="target_audience" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                주요 타겟 오디언스 (Target Customer)
              </label>
              <textarea
                id="target_audience"
                rows={2}
                placeholder="예: 20~30대 실무 마케터, 1인 쇼핑몰 창업주"
                disabled={isLoading}
                {...register("target_audience")}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm dark:bg-zinc-950"
              />
            </div>

            <div>
              <label htmlFor="customer_problems" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                고객이 겪는 문제점 (Customer Pain Point)
              </label>
              <textarea
                id="customer_problems"
                rows={2}
                placeholder="예: 글을 쓰는 것에 매번 많은 시간이 소요됨, 플랫폼별 최적화 공식을 모름"
                disabled={isLoading}
                {...register("customer_problems")}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm dark:bg-zinc-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="products_services" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                제공 제품 / 서비스 소개
              </label>
              <textarea
                id="products_services"
                rows={2}
                placeholder="예: AI가 알아서 네이버 블로그 포스팅, 워드프레스 맞춤형 원고를 생산해주는 툴"
                disabled={isLoading}
                {...register("products_services")}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm dark:bg-zinc-950"
              />
            </div>

            <div>
              <label htmlFor="core_values" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                브랜드 핵심 가치 (Core Value)
              </label>
              <textarea
                id="core_values"
                rows={2}
                placeholder="예: 95%의 포스팅 작성 시간 단축, 사람이 직접 쓴 것과 구별 불가한 자연스러움"
                disabled={isLoading}
                {...register("core_values")}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm dark:bg-zinc-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="default_cta" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                기본 CTA 문구 (행동 유도 구문)
              </label>
              <input
                id="default_cta"
                type="text"
                placeholder="예: 지금 무료 체험 가입하고 콘텐츠 제작 시간을 10배 아끼세요!"
                disabled={isLoading}
                {...register("default_cta")}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm dark:bg-zinc-950"
              />
            </div>

            <div>
              <label htmlFor="legal_notice" className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                필수 고지사항 및 제약문구 (Legal / Disclaimer)
              </label>
              <input
                id="legal_notice"
                type="text"
                placeholder="예: *본 서비스에서 생성되는 콘텐츠는 자사 AI 봇 기반이며 외부 저작권을 침해하지 않습니다."
                disabled={isLoading}
                {...register("legal_notice")}
                className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm dark:bg-zinc-950"
              />
            </div>
          </div>
        </div>

        {/* 3. 기본값 여부 선택 */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="is_default"
                type="checkbox"
                disabled={isLoading}
                {...register("is_default")}
                className="focus:ring-primary h-4 w-4 text-primary border-zinc-300 dark:border-zinc-800 rounded cursor-pointer"
              />
            </div>
            <div className="ml-3 text-xs">
              <label htmlFor="is_default" className="font-bold text-zinc-700 dark:text-zinc-300 cursor-pointer">
                이 워크스페이스의 기본(Default) 브랜드로 설정
              </label>
              <p className="text-zinc-400 dark:text-zinc-500 mt-0.5">
                체크할 경우, 글 작성을 시작할 때 이 브랜드의 정보가 기본값으로 먼저 대입됩니다. 기존 기본 브랜드는 자동으로 해제됩니다.
              </p>
            </div>
          </div>
        </div>

        {/* 4. 액션 버튼바 */}
        <div className="flex justify-end gap-3 pt-5 border-t border-zinc-150 dark:border-zinc-800">
          <Link
            href="/brands"
            className="py-2 px-4 border border-zinc-300 dark:border-zinc-800 rounded-xl shadow-sm text-sm font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-colors"
          >
            취소
          </Link>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex justify-center items-center py-2 px-6 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95 transition-all disabled:opacity-70 cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                저장 중...
              </>
            ) : (
              "브랜드 정보 저장"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
