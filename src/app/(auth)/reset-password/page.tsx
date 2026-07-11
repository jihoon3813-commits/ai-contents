"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resetPasswordSchema, type ResetPasswordInput } from "@/lib/schemas/auth";
import { useToast } from "@/components/ui/toast";
import { Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      passwordConfirm: "",
    },
  });

  const onSubmit = async (data: ResetPasswordInput) => {
    setIsLoading(true);
    const loadingId = toast.loading("비밀번호 변경 중...");

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      toast.dismiss(loadingId);

      if (error) {
        toast.error(`비밀번호 변경 실패: ${error.message}`);
      } else {
        toast.success("비밀번호가 성공적으로 변경되었습니다. 대시보드로 이동합니다.");
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.dismiss(loadingId);
      toast.error("비밀번호 변경 중 예상치 못한 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-2xl shadow-lg shadow-primary/20">
            AG
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
          새 비밀번호 설정
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          새로운 비밀번호를 입력해 주십시오. (최소 8자 이상)
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow-xl border border-zinc-200/50 dark:border-zinc-800/50 sm:rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                새 비밀번호
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  disabled={isLoading}
                  {...register("password")}
                  className={`appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm dark:bg-zinc-950 ${
                    errors.password
                      ? "border-rose-300 focus:ring-rose-500"
                      : "border-zinc-300 dark:border-zinc-800"
                  }`}
                />
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-500" id="password-error">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="passwordConfirm"
                className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                새 비밀번호 확인
              </label>
              <div className="mt-1">
                <input
                  id="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  disabled={isLoading}
                  {...register("passwordConfirm")}
                  className={`appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm dark:bg-zinc-950 ${
                    errors.passwordConfirm
                      ? "border-rose-300 focus:ring-rose-500"
                      : "border-zinc-300 dark:border-zinc-800"
                  }`}
                />
              </div>
              {errors.passwordConfirm && (
                <p className="mt-1 text-xs text-rose-500" id="passwordConfirm-error">
                  {errors.passwordConfirm.message}
                </p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "비밀번호 변경 완료"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
