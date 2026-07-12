"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/schemas/auth";
import { useToast } from "@/components/ui/toast";
import { Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const toast = useToast();
  const { signIn } = useAuthActions();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true);
    const loadingId = toast.loading("비밀번호 재설정 링크 발송 중...");

    try {
      await signIn("password", {
        email: data.email,
        flow: "reset",
      });

      toast.dismiss(loadingId);
      toast.success("비밀번호 재설정 링크가 이메일로 발송되었습니다.");
      setIsSuccess(true);
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`링크 발송 실패: ${err.message || "알 수 없는 오류"}`);
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
          비밀번호 찾기
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          가입한 이메일 주소를 입력해 주시면 비밀번호를 재설정할 수 있는 링크를 보내드립니다.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow-xl border border-zinc-200/50 dark:border-zinc-800/50 sm:rounded-2xl sm:px-10">
          {isSuccess ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-zinc-700 dark:text-zinc-300">
                인증 링크가 메일함으로 성공적으로 발송되었습니다. 수신된 이메일의 가이드를 확인하여 비밀번호 재설정을 완료해 주세요.
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95 transition-all"
                >
                  로그인 화면으로 돌아가기
                </Link>
              </div>
            </div>
          ) : (
            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
                >
                  이메일 주소
                </label>
                <div className="mt-1">
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    disabled={isLoading}
                    {...register("email")}
                    className={`appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm dark:bg-zinc-950 ${
                      errors.email
                        ? "border-rose-300 focus:ring-rose-500"
                        : "border-zinc-300 dark:border-zinc-800"
                    }`}
                  />
                </div>
                {errors.email && (
                  <p className="mt-1.5 text-xs text-rose-500" id="email-error">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "비밀번호 재설정 이메일 받기"
                  )}
                </button>
                <Link
                  href="/login"
                  className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm text-sm font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  로그인으로 돌아가기
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
