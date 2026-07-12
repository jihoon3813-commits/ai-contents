"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { useToast } from "@/components/ui/toast";
import { Loader2, ArrowRight } from "lucide-react";

function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { signIn } = useAuthActions();

  const nextParam = searchParams.get("next") ?? "/dashboard";
  const errorParam = searchParams.get("error");

  useEffect(() => {
    if (errorParam) {
      if (errorParam === "auth-callback-failed") {
        toast.error("인증에 실패하였습니다. 다시 시도해 주세요.");
      } else {
        const msg = searchParams.get("msg");
        const cookiesParam = searchParams.get("cookies");
        const convexUrlParam = searchParams.get("convexUrl");
        const convexSiteUrlParam = searchParams.get("convexSiteUrl");
        const jwtPayloadParam = searchParams.get("jwtPayload");
        toast.error(`로그인 해제 또는 실패 (${errorParam}): ${msg || "상세 정보 없음"} (쿠키목록: ${cookiesParam || "없음"}) (서버Convex주소: ${convexUrlParam || "없음"} / 서버Site주소: ${convexSiteUrlParam || "없음"}) (JWT페이로드: ${jwtPayloadParam || "없음"})`);
      }
    }
  }, [errorParam, searchParams, toast]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    const loadingId = toast.loading("로그인 중입니다...");

    try {
      await signIn("password", {
        email: data.email,
        password: data.password,
        flow: "signIn",
      });

      toast.dismiss(loadingId);
      toast.success("로그인에 성공했습니다. 대시보드로 이동합니다.");
      router.push(nextParam);
      router.refresh();
    } catch (err: any) {
      toast.dismiss(loadingId);
      let message = "이메일 또는 비밀번호를 확인해 주세요.";
      const errMsg = err.message || "";
      if (errMsg.includes("Invalid password") || errMsg.includes("User not found")) {
        message = "이메일 또는 비밀번호가 일치하지 않습니다.";
      } else if (errMsg.includes("unverified")) {
        message = "이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.";
      }
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    const loadingId = toast.loading("Google 로그인 창을 여는 중...");

    try {
      await signIn("google", {
        redirectTo: `${window.location.origin}/dashboard`,
      });
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`Google 로그인 실패: ${err.message || "알 수 없는 오류"}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 py-8 px-4 shadow-xl border border-zinc-200/50 dark:border-zinc-800/50 sm:rounded-2xl sm:px-10">
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

        <div>
          <div className="flex justify-between items-center">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-zinc-700 dark:text-zinc-300"
            >
              비밀번호
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-primary hover:underline"
            >
              비밀번호 분실
            </Link>
          </div>
          <div className="mt-1">
            <input
              id="password"
              type="password"
              autoComplete="current-password"
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
            <p className="mt-1.5 text-xs text-rose-500" id="password-error">
              {errors.password.message}
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
              <>
                로그인
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </form>

      <div className="mt-6">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="px-2 bg-white dark:bg-zinc-900 text-zinc-500">
              또는 소셜 로그인
            </span>
          </div>
        </div>

        <div className="mt-6">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="w-full flex justify-center items-center gap-2.5 py-2.5 px-4 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm text-sm font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Google 계정으로 로그인
          </button>
        </div>
      </div>

      <div className="mt-8 text-center space-y-2">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          아직 계정이 없으신가요?{" "}
          <Link href="/signup" className="font-semibold text-primary hover:underline">
            무료 회원가입
          </Link>
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          관리자이신가요?{" "}
          <Link href="/admin" className="font-medium text-zinc-500 dark:text-zinc-400 hover:underline">
            어드민 바로가기
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex-1 flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-2xl shadow-lg shadow-primary/20">
            AI
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
          AI 컨텐츠 봇 시작하기
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          멀티플랫폼 AI 콘텐츠 제작 SaaS
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={<div className="text-center py-4">로딩 중...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
