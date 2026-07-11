import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import VoiceProfileForm from "./VoiceProfileForm";

interface VoicePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function VoicePage({ params }: VoicePageProps) {
  const { id } = await params;
  const supabase = await createClient();

  // 1. 사용자 로그인 인증 확인
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. 브랜드 로드
  const { data: brand } = await supabase
    .from("brands")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  if (!brand) {
    redirect("/brands");
  }

  // 3. 보이스 프로필 로드
  let { data: voiceProfile } = await supabase
    .from("brand_voice_profiles")
    .select("*")
    .eq("brand_id", id)
    .maybeSingle();

  // 만약 비정상적인 문제로 프로필이 생성되지 않은 경우, 즉시 동적 자동 생성 시도
  if (!voiceProfile) {
    const { data: newProfile, error: insertError } = await supabase
      .from("brand_voice_profiles")
      .insert({
        brand_id: id,
        formal_level: 3,
        sentence_length: 3,
        expertise_level: 3,
        emotional_level: 3,
        sales_level: 3,
        humor_level: 3,
        emoji_level: 3,
        question_level: 3,
        honorific_style: "HONORIFIC",
      })
      .select()
      .single();

    if (insertError) {
      console.error("보이스 프로필 동적 생성 에러:", insertError.message);
      redirect("/brands");
    }
    voiceProfile = newProfile;
  }

  return (
    <div className="space-y-6">
      <VoiceProfileForm
        brandId={id}
        brandName={brand.name}
        initialData={voiceProfile}
      />
    </div>
  );
}
