"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { Loader2, Save, User } from "lucide-react";

interface ProfileFormData {
  name: string;
  timezone: string;
  language: string;
}

export default function ProfileSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  const toast = useToast();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileFormData>({
    defaultValues: {
      name: "",
      timezone: "Asia/Seoul",
      language: "ko",
    },
  });

  // 컴포넌트 마운트 시 프로필 데이터 패치
  useEffect(() => {
    async function loadProfile() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          setUserId(user.id);

          const { data: profile, error } = await supabase
            .from("profiles")
            .select("name, timezone, language")
            .eq("id", user.id)
            .maybeSingle();

          if (error) {
            toast.error("프로필 데이터를 불러오지 못했습니다.");
          } else if (profile) {
            reset({
              name: profile.name || "",
              timezone: profile.timezone || "Asia/Seoul",
              language: profile.language || "ko",
            });
          }
        }
      } catch {
        toast.error("프로필 로드 중 예상치 못한 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }

    loadProfile();
  }, [supabase, reset, toast]);

  const onSubmit = async (data: ProfileFormData) => {
    if (!userId) return;

    setIsSaving(true);
    const loadingId = toast.loading("프로필을 업데이트하고 있습니다...");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          name: data.name,
          timezone: data.timezone,
          language: data.language,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      toast.dismiss(loadingId);

      if (error) {
        toast.error(`프로필 업데이트 실패: ${error.message}`);
      } else {
        toast.success("프로필 정보가 저장되었습니다.");
      }
    } catch {
      toast.dismiss(loadingId);
      toast.error("프로필 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-zinc-500">프로필 정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-zinc-200/50 dark:border-zinc-800/50 pb-5">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
          <User className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">프로필 설정</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            사용자 이름, 시간대, 기본 사용 언어 등 개인 정보를 관리합니다.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
            >
              사용자 이름 (닉네임)
            </label>
            <div className="mt-1">
              <input
                id="name"
                type="text"
                disabled={isSaving}
                {...register("name", { required: "이름은 필수 입력 항목입니다." })}
                className={`appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm dark:bg-zinc-950 ${
                  errors.name
                    ? "border-rose-300 focus:ring-rose-500"
                    : "border-zinc-300 dark:border-zinc-800"
                }`}
              />
            </div>
            {errors.name && (
              <p className="mt-1 text-xs text-rose-500">{errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="timezone"
                className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                시간대 설정 (Timezone)
              </label>
              <div className="mt-1">
                <select
                  id="timezone"
                  disabled={isSaving}
                  {...register("timezone")}
                  className="block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-zinc-950 sm:text-sm transition-all"
                >
                  <option value="Asia/Seoul">Asia/Seoul (KST - 서울)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST - 도쿄)</option>
                  <option value="America/New_York">America/New_York (EST - 뉴욕)</option>
                  <option value="UTC">UTC (세계 협정시)</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="language"
                className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                기본 언어 (Language)
              </label>
              <div className="mt-1">
                <select
                  id="language"
                  disabled={isSaving}
                  {...register("language")}
                  className="block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent dark:bg-zinc-950 sm:text-sm transition-all"
                >
                  <option value="ko">한국어 (Korean)</option>
                  <option value="en">English (영어)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  프로필 저장
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
