"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signupSchema, type SignupInput } from "@/lib/schemas/auth";
import { useToast } from "@/components/ui/toast";
import { Loader2, ArrowRight } from "lucide-react";

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      email: "",
      password: "",
      passwordConfirm: "",
      name: "",
      termsAccepted: false,
      privacyAccepted: false,
      marketingAccepted: false,
    },
  });

  const onSubmit = async (data: SignupInput) => {
    setIsLoading(true);
    const loadingId = toast.loading("회원가입 처리 중...");

    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
          },
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      toast.dismiss(loadingId);

      if (error) {
        let message = error.message;
        if (error.message.includes("User already registered")) {
          message = "이미 등록된 이메일 주소입니다.";
        }
        toast.error(message);
      } else {
        toast.success("회원가입이 완료되었습니다. 이메일을 확인해 주세요!");
        setIsSuccess(true);
      }
    } catch {
      toast.dismiss(loadingId);
      toast.error("회원가입 처리 중 예상치 못한 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-zinc-50 dark:bg-zinc-950">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow-xl border border-zinc-200/50 dark:border-zinc-800/50 sm:rounded-2xl sm:px-10 text-center space-y-4">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">이메일 인증 필요</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              입력하신 이메일 주소로 인증 링크를 발송했습니다. <br />
              이메일 안의 링크를 클릭하시면 회원가입이 완료되고 로그인할 수 있습니다.
            </p>
            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex justify-center items-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95"
              >
                로그인 화면으로 가기
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-2xl shadow-lg shadow-primary/20">
            AG
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
          신규 회원가입
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          안티그래비티와 함께 고품질 AI 콘텐츠를 제작하세요.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow-xl border border-zinc-200/50 dark:border-zinc-800/50 sm:rounded-2xl sm:px-10">
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                이름
              </label>
              <div className="mt-1">
                <input
                  id="name"
                  type="text"
                  disabled={isLoading}
                  {...register("name")}
                  className={`appearance-none block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all sm:text-sm dark:bg-zinc-950 ${
                    errors.name
                      ? "border-rose-300 focus:ring-rose-500"
                      : "border-zinc-300 dark:border-zinc-800"
                  }`}
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-xs text-rose-500" id="name-error">
                  {errors.name.message}
                </p>
              )}
            </div>

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
                <p className="mt-1 text-xs text-rose-500" id="email-error">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
              >
                비밀번호
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
                비밀번호 확인
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

            <div className="space-y-2.5 pt-2 border-t border-zinc-150 dark:border-zinc-800">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="termsAccepted"
                    type="checkbox"
                    disabled={isLoading}
                    {...register("termsAccepted")}
                    className="h-4 w-4 text-primary focus:ring-primary border-zinc-300 dark:border-zinc-800 rounded cursor-pointer"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="termsAccepted" className="font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    (필수) <Link href="/terms" className="text-primary hover:underline">서비스 이용약관</Link> 동의
                  </label>
                  {errors.termsAccepted && (
                    <p className="text-xs text-rose-500 mt-0.5">{errors.termsAccepted.message}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="privacyAccepted"
                    type="checkbox"
                    disabled={isLoading}
                    {...register("privacyAccepted")}
                    className="h-4 w-4 text-primary focus:ring-primary border-zinc-300 dark:border-zinc-800 rounded cursor-pointer"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="privacyAccepted" className="font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    (필수) <Link href="/privacy" className="text-primary hover:underline">개인정보 처리방침</Link> 동의
                  </label>
                  {errors.privacyAccepted && (
                    <p className="text-xs text-rose-500 mt-0.5">{errors.privacyAccepted.message}</p>
                  )}
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="marketingAccepted"
                    type="checkbox"
                    disabled={isLoading}
                    {...register("marketingAccepted")}
                    className="h-4 w-4 text-primary focus:ring-primary border-zinc-300 dark:border-zinc-800 rounded cursor-pointer"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="marketingAccepted" className="font-medium text-zinc-700 dark:text-zinc-300 cursor-pointer">
                    (선택) 마케팅 정보 수신 동의
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-primary hover:bg-primary/95 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    회원가입 완료
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              이미 계정이 있으신가요?{" "}
              <Link href="/login" className="font-semibold text-primary hover:underline">
                로그인하기
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
