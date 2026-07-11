"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  setDefaultBrand,
  duplicateBrand,
  deleteBrandSoft,
} from "@/lib/actions/brand";
import {
  Globe,
  Trash2,
  Copy,
  CheckCircle,
  Volume2,
  FileText,
  Edit,
  Star,
  ExternalLink,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";

interface Brand {
  id: string;
  name: string;
  industry: string;
  tagline: string | null;
  website_url: string | null;
  description: string | null;
  is_default: boolean;
}

interface BrandsListClientProps {
  initialBrands: Brand[];
  userRole: string;
}

export default function BrandsListClient({
  initialBrands,
  userRole,
}: BrandsListClientProps) {
  const [brands, setBrands] = useState<Brand[]>(initialBrands);
  const [isPending, startTransition] = useTransition();
  const [actionId, setActionId] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  const isReadOnly = userRole === "VIEWER";

  const handleSetDefault = async (brandId: string) => {
    if (isReadOnly) {
      toast.error("뷰어 권한은 기본 브랜드를 설정할 수 없습니다.");
      return;
    }

    setActionId(brandId);
    const loadingId = toast.loading("기본 브랜드를 설정하고 있습니다...");
    
    try {
      await setDefaultBrand(brandId);
      
      // 로컬 상태 즉시 반영
      setBrands((prev) =>
        prev.map((b) => ({
          ...b,
          is_default: b.id === brandId,
        }))
      );

      toast.dismiss(loadingId);
      toast.success("기본 브랜드가 성공적으로 변경되었습니다.");
      router.refresh();
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`설정 실패: ${err.message}`);
    } finally {
      setActionId(null);
    }
  };

  const handleDuplicate = async (brandId: string) => {
    if (isReadOnly) {
      toast.error("뷰어 권한은 브랜드를 복제할 수 없습니다.");
      return;
    }

    setActionId(brandId);
    const loadingId = toast.loading("브랜드를 복제하고 있습니다...");

    try {
      const duplicated = await duplicateBrand(brandId);
      
      // 로컬 목록에 추가
      setBrands((prev) => [duplicated, ...prev]);

      toast.dismiss(loadingId);
      toast.success("브랜드가 복제되었습니다.");
      router.refresh();
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`복제 실패: ${err.message}`);
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (brandId: string, brandName: string) => {
    if (isReadOnly) {
      toast.error("뷰어 권한은 브랜드를 삭제할 수 없습니다.");
      return;
    }

    if (!confirm(`'${brandName}' 브랜드를 삭제하시겠습니까?`)) {
      return;
    }

    setActionId(brandId);
    const loadingId = toast.loading("브랜드를 삭제하는 중입니다...");

    try {
      await deleteBrandSoft(brandId);
      
      // 로컬 목록에서 필터 제거
      setBrands((prev) => prev.filter((b) => b.id !== brandId));

      toast.dismiss(loadingId);
      toast.success("브랜드가 소프트 삭제되었습니다.");
      router.refresh();
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`삭제 실패: ${err.message}`);
    } finally {
      setActionId(null);
    }
  };

  if (brands.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-12 rounded-2xl text-center space-y-4 shadow-sm">
        <div className="h-14 w-14 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/40 dark:border-zinc-800/40 flex items-center justify-center text-zinc-400 mx-auto">
          <Sparkles className="h-6 w-6 text-zinc-400" />
        </div>
        <div className="space-y-1 max-w-sm mx-auto">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            등록된 브랜드가 없습니다
          </h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
            마케팅 글을 생성할 때 참고할 브랜드를 먼저 등록해 보세요. <br />
            온보딩 단계를 건너뛰셨거나 새로운 브랜드를 추가하려면 아래 버튼을 클릭하십시오.
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/brands/new"
            className="inline-flex justify-center items-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-xs font-semibold text-white bg-primary hover:bg-primary/95 transition-colors cursor-pointer"
          >
            첫 브랜드 프로필 추가
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {brands.map((brand) => {
        const isActionLoading = actionId === brand.id;
        return (
          <div
            key={brand.id}
            className={`relative bg-white dark:bg-zinc-900 border rounded-2xl shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden ${
              brand.is_default
                ? "border-primary/50 ring-1 ring-primary/20 dark:border-primary/40"
                : "border-zinc-200/60 dark:border-zinc-800/60"
            }`}
          >
            {/* 상단 정보영역 */}
            <div className="p-6 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-200 truncate">
                      {brand.name}
                    </h3>
                    {brand.is_default && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-primary/10 text-primary uppercase">
                        <Star className="h-2.5 w-2.5 fill-current" />
                        기본
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                    업종: {brand.industry}
                  </p>
                </div>

                {/* 링크 / 웹사이트 아이콘 */}
                {brand.website_url && (
                  <a
                    href={brand.website_url.startsWith("http") ? brand.website_url : `https://${brand.website_url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-lg border border-zinc-150 dark:border-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                    title="웹사이트 바로가기"
                  >
                    <Globe className="h-4 w-4" />
                  </a>
                )}
              </div>

              {/* 브랜드 설명/슬로건 */}
              <div className="space-y-1">
                {brand.tagline && (
                  <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 italic">
                    &ldquo;{brand.tagline}&rdquo;
                  </p>
                )}
                <p className="text-xs text-zinc-400 dark:text-zinc-500 line-clamp-3 leading-relaxed">
                  {brand.description || "등록된 브랜드 상세 설명이 없습니다."}
                </p>
              </div>
            </div>

            {/* 중간 탭 메뉴 단축키 */}
            <div className="grid grid-cols-2 border-t border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/20 text-center">
              <Link
                href={`/brands/${brand.id}/voice`}
                className="flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-primary dark:hover:text-primary-foreground border-r border-zinc-100 dark:border-zinc-800/80 transition-colors"
              >
                <Volume2 className="h-3.5 w-3.5" />
                보이스(어조) 설정
              </Link>
              <Link
                href={`/brands/${brand.id}/samples`}
                className="flex items-center justify-center gap-1.5 py-3 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-primary dark:hover:text-primary-foreground transition-colors"
              >
                <FileText className="h-3.5 w-3.5" />
                작성글 샘플 분석
              </Link>
            </div>

            {/* 하단 제어 버튼바 */}
            <div className="px-6 py-4 flex justify-between items-center bg-zinc-50/20 dark:bg-zinc-950/10">
              <div>
                {!brand.is_default && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(brand.id)}
                    disabled={isReadOnly || isActionLoading}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-primary transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isReadOnly ? <Lock className="h-3 w-3" /> : <CheckCircle className="h-3.5 w-3.5" />}
                    기본값 지정
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href={`/brands/${brand.id}/edit`}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                >
                  <Edit className="h-3 w-3" />
                  수정
                </Link>

                <button
                  type="button"
                  onClick={() => handleDuplicate(brand.id)}
                  disabled={isReadOnly || isActionLoading}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors disabled:opacity-50 cursor-pointer"
                  title="브랜드 정보 복제"
                >
                  {isActionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
                  복제
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(brand.id, brand.name)}
                  disabled={isReadOnly || isActionLoading}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 hover:text-rose-600 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  삭제
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
