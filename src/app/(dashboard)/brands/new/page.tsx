"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { createBrand } from "@/lib/actions/brand";
import BrandForm from "@/components/brands/BrandForm";
import type { BrandInput } from "@/lib/schemas/brand";

export default function NewBrandPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (data: BrandInput) => {
    setIsLoading(true);
    const loadingId = toast.loading("새 브랜드를 생성하고 있습니다...");

    try {
      await createBrand(data);
      toast.dismiss(loadingId);
      toast.success("브랜드 프로필이 정상 등록되었습니다!");
      router.push("/brands");
      router.refresh();
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`브랜드 생성 실패: ${err.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="py-2">
      <BrandForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        title="새 브랜드 프로필 추가"
      />
    </div>
  );
}
