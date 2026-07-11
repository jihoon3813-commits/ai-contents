"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { updateBrand } from "@/lib/actions/brand";
import BrandForm from "@/components/brands/BrandForm";
import type { BrandInput } from "@/lib/schemas/brand";

interface EditBrandFormProps {
  brandId: string;
  initialData: Partial<BrandInput>;
}

export default function EditBrandForm({
  brandId,
  initialData,
}: EditBrandFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (data: BrandInput) => {
    setIsLoading(true);
    const loadingId = toast.loading("브랜드 프로필을 수정하고 있습니다...");

    try {
      await updateBrand(brandId, data);
      toast.dismiss(loadingId);
      toast.success("브랜드 프로필이 변경되었습니다!");
      router.push("/brands");
      router.refresh();
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`브랜드 수정 실패: ${err.message}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="py-2">
      <BrandForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        initialData={initialData}
        title="브랜드 프로필 정보 수정"
      />
    </div>
  );
}
