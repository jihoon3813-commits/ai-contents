import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import EditBrandForm from "./EditBrandForm";

interface EditBrandPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditBrandPage({ params }: EditBrandPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. 사용자 로그인 검증
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. 브랜드 데이터 로드
  const { data: brand, error } = await supabase
    .from("brands")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !brand) {
    redirect("/brands");
  }

  // 3. Zod 스키마 구조에 매핑될 초기 데이터 정리
  const initialData = {
    name: brand.name,
    industry: brand.industry,
    description: brand.description || "",
    tagline: brand.tagline || "",
    website_url: brand.website_url || "",
    target_audience: brand.target_audience || "",
    customer_problems: brand.customer_problems || "",
    products_services: brand.products_services || "",
    core_values: brand.core_values || "",
    default_cta: brand.default_cta || "",
    legal_notice: brand.legal_notice || "",
    is_default: brand.is_default,
  };

  return (
    <div className="space-y-6">
      <EditBrandForm brandId={id} initialData={initialData} />
    </div>
  );
}
