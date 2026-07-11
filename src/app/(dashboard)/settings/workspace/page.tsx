"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { generateSlug } from "@/lib/utils/slug";
import { Loader2, Save, ShieldAlert, KeyRound, Settings } from "lucide-react";

interface WorkspaceFormData {
  name: string;
  slug: string;
}

interface SubscriptionInfo {
  plan_code: string;
  status: string;
  limits: {
    words_limit?: number;
    images_limit?: number;
  };
}

export default function WorkspaceSettingsPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("VIEWER");
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);

  const toast = useToast();
  const supabase = createClient();

  const isOwner = userRole === "OWNER";

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<WorkspaceFormData>({
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const nameVal = watch("name");

  // 이름이 바뀔 때 OWNER라면 slug 자동 완성 유도
  useEffect(() => {
    if (isOwner && nameVal) {
      const generated = generateSlug(nameVal);
      // 고유번호 붙기 전의 템플릿 제안 (사용자가 수정할 수 있도록)
      setValue("slug", generated, { shouldValidate: true });
    }
  }, [nameVal, isOwner, setValue]);

  useEffect(() => {
    async function loadWorkspaceData() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
 
        if (user) {
          // 1. 유저의 첫 번째 워크스페이스 멤버십 정보 조회
          const { data: members, error: memberError } = await supabase
            .from("workspace_members")
            .select("workspace_id, role, workspaces(id, name, slug)")
            .eq("user_id", user.id)
            .limit(1);
 
          if (memberError || !members || members.length === 0) {
            toast.error("소속된 워크스페이스를 조회할 수 없습니다.");
            setIsLoading(false);
            return;
          }
 
          const member = members[0];
          const wsRaw = member.workspaces;
          const ws = (Array.isArray(wsRaw) ? wsRaw[0] : wsRaw) as unknown as { id: string; name: string; slug: string };
          
          if (!ws) {
            toast.error("소속된 워크스페이스 상세 정보를 찾을 수 없습니다.");
            setIsLoading(false);
            return;
          }

          setWorkspaceId(ws.id);
          setUserRole(member.role);
 
          reset({
            name: ws.name || "",
            slug: ws.slug || "",
          });
 
          // 2. 워크스페이스 구독 정보 조회
          const { data: subs } = await supabase
            .from("subscriptions")
            .select("plan_code, status, limits")
            .eq("workspace_id", ws.id)
            .maybeSingle();
 
          if (subs) {
            setSubscription(subs as unknown as SubscriptionInfo);
          }
        }
      } catch {
        toast.error("워크스페이스 로드 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    }
 
    loadWorkspaceData();
  }, [supabase, reset]);

  const onSubmit = async (data: WorkspaceFormData) => {
    if (!workspaceId || !isOwner) return;

    setIsSaving(true);
    const loadingId = toast.loading("워크스페이스 정보를 수정하고 있습니다...");

    try {
      const { error } = await supabase
        .from("workspaces")
        .update({
          name: data.name,
          slug: generateSlug(data.slug), // slugification 한 번 더 보장
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspaceId);

      toast.dismiss(loadingId);

      if (error) {
        toast.error(`정보 수정 실패: ${error.message}`);
      } else {
        toast.success("워크스페이스 정보가 성공적으로 변경되었습니다.");
      }
    } catch {
      toast.dismiss(loadingId);
      toast.error("워크스페이스 저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-sm text-zinc-500">워크스페이스 설정을 로드하는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* 타이틀 헤더 */}
      <div className="flex items-center gap-3 border-b border-zinc-200/50 dark:border-zinc-800/50 pb-5">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
          <Settings className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">워크스페이스 설정</h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            소속된 워크스페이스의 기본 정보 및 구독 플랜 정보를 관리합니다.
          </p>
        </div>
      </div>

      {/* 역할 경고 배너 */}
      {!isOwner && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 text-amber-800 dark:text-amber-300">
          <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">수정 권한 제한</p>
            <p className="opacity-90 leading-relaxed mt-0.5">
              현재 회원님의 권한은 <span className="font-bold underline">{userRole}</span>입니다. <br />
              워크스페이스 명칭 및 Slug 변경은 소유자(<span className="font-bold">OWNER</span>) 권한을 지닌 사용자만 수정할 수 있습니다.
            </p>
          </div>
        </div>
      )}

      {/* 워크스페이스 정보 양식 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
            >
              워크스페이스 이름
            </label>
            <div className="mt-1">
              <input
                id="name"
                type="text"
                disabled={isSaving || !isOwner}
                {...register("name", { required: "워크스페이스 이름은 필수 항목입니다." })}
                className={`appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm dark:bg-zinc-950 disabled:opacity-60 disabled:cursor-not-allowed ${
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

          <div>
            <label
              htmlFor="slug"
              className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
            >
              워크스페이스 Slug (경로 고유 아이디)
            </label>
            <div className="mt-1">
              <input
                id="slug"
                type="text"
                disabled={isSaving || !isOwner}
                {...register("slug", { required: "Slug는 필수 항목입니다." })}
                className={`appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm dark:bg-zinc-950 disabled:opacity-60 disabled:cursor-not-allowed ${
                  errors.slug
                    ? "border-rose-300 focus:ring-rose-500"
                    : "border-zinc-300 dark:border-zinc-800"
                }`}
              />
            </div>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1.5">
              Slug는 워크스페이스를 대표하는 고유 URL 주소용 아이디입니다. 영문 소문자, 숫자, 한글, 하이픈(-)만 가능합니다.
            </p>
            {errors.slug && (
              <p className="mt-1 text-xs text-rose-500">{errors.slug.message}</p>
            )}
          </div>

          {isOwner && (
            <div className="flex justify-end pt-4 border-t border-zinc-150 dark:border-zinc-800">
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
                    워크스페이스 정보 저장
                  </>
                )}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* 구독 및 이용 한도 정보 카드 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
          <div className="p-2 rounded-lg bg-zinc-100 dark:bg-zinc-850 text-zinc-600 dark:text-zinc-300">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">이용 중인 플랜 정보</h3>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">현재 적용된 구독 권한 및 글/이미지 한도 정보입니다.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/40">
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">가입된 플랜</p>
            <p className="text-lg font-bold text-primary mt-1.5">{subscription?.plan_code || "FREE"}</p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/40">
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">생성 한도 (단어 수)</p>
            <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mt-1.5">
              {subscription?.limits.words_limit?.toLocaleString() || "10,000"}자 / 월
            </p>
          </div>
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/40">
            <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500">이미지 생성 제한</p>
            <p className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mt-1.5">
              {subscription?.limits.images_limit?.toLocaleString() || "20"}개 / 월
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
