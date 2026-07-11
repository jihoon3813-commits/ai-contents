import React from "react";
import { createClient } from "@/lib/supabase/server";
import { FileText, Type, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user?.id || "")
    .maybeSingle();

  const userName = profile?.name || user?.email?.split("@")[0] || "사용자";

  // 활성 워크스페이스의 브랜드 조회
  const { data: member } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user?.id || "")
    .limit(1)
    .maybeSingle();

  let brandCount = 0;
  let defaultBrand: any = null;

  if (member?.workspace_id) {
    const { data: brandList } = await supabase
      .from("brands")
      .select("*")
      .eq("workspace_id", member.workspace_id)
      .is("deleted_at", null);

    if (brandList) {
      brandCount = brandList.length;
      defaultBrand = brandList.find((b: any) => b.is_default) || brandList[0] || null;
    }
  }

  // 대시보드 요약 지표 (Mock 및 기본값)
  const stats = [
    {
      name: "이번 달 생성 콘텐츠",
      value: "0개",
      description: "한도: 20개 / 월",
      icon: FileText,
      color: "text-blue-500 bg-blue-50 dark:bg-blue-950/30",
    },
    {
      name: "사용 글자 수",
      value: "0자",
      description: "한도: 10,000자 / 월",
      icon: Type,
      color: "text-violet-500 bg-violet-50 dark:bg-violet-950/30",
    },
    {
      name: "검토 필요 콘텐츠",
      value: "0개",
      description: "생성 완료 후 미승인 상태",
      icon: Clock,
      color: "text-amber-500 bg-amber-50 dark:bg-amber-950/30",
    },
    {
      name: "연결된 플랫폼 수",
      value: "0개",
      description: "워드프레스, Blogger 등",
      icon: AlertTriangle,
      color: "text-zinc-500 bg-zinc-50 dark:bg-zinc-800/40",
    },
  ];

  return (
    <div className="space-y-8">
      {/* 웰컴 배너 */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary to-violet-600 p-8 text-white shadow-lg">
        <div className="relative z-10 max-w-xl space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            안녕하세요, {userName}님!
          </h1>
          <p className="text-sm sm:text-base opacity-90 leading-relaxed">
            안티그래비티 대시보드에 오신 것을 환영합니다. <br />
            이곳에서 브랜드를 정의하고 플랫폼 최적화된 마케팅 글을 빠르고 쉽게 작성해 보세요.
          </p>
          <div className="pt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-white text-primary hover:bg-zinc-50 shadow-sm transition-all"
            >
              콘텐츠 제작 시작하기
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        {/* 장식용 블러 서클 */}
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
      </div>

      {/* 브랜드 상태 배너/카드 */}
      {brandCount === 0 ? (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-amber-800 dark:text-amber-400">등록된 브랜드가 없습니다</h3>
            <p className="text-xs text-amber-700/80 dark:text-amber-500/80">
              인공지능 마케팅 문구를 생성하려면 브랜드 정보 등록이 필요합니다. 첫 번째 브랜드를 즉시 등록해 보세요.
            </p>
          </div>
          <Link
            href="/brands/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all text-center self-start sm:self-auto"
          >
            첫 브랜드 등록하기
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        defaultBrand && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-6 rounded-2xl shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">기본 브랜드</span>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{defaultBrand.name}</h3>
              </div>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                업종: {defaultBrand.industry} {defaultBrand.tagline && `| ${defaultBrand.tagline}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={`/brands/${defaultBrand.id}/voice`}
                className="py-1.5 px-3 border border-zinc-200 dark:border-zinc-850 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              >
                보이스 슬라이더 설정
              </Link>
              <Link
                href={`/brands/${defaultBrand.id}/samples`}
                className="py-1.5 px-3 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-xs font-semibold hover:bg-zinc-850 dark:hover:bg-zinc-200 transition-colors"
              >
                예문 등록 및 어조 분석
              </Link>
            </div>
          </div>
        )
      )}

      {/* 요약 통계 그리드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.name}
              className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-6 rounded-2xl shadow-sm space-y-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                  {stat.name}
                </span>
                <div className={`p-2 rounded-lg ${stat.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {stat.value}
                </p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                  {stat.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* 빈 상태 대시보드 안내 */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-8 rounded-2xl text-center space-y-4 shadow-sm">
        <div className="h-12 w-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/40 dark:border-zinc-800/40 flex items-center justify-center text-zinc-400 mx-auto">
          <FileText className="h-6 w-6" />
        </div>
        <div className="space-y-1 max-w-sm mx-auto">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
            등록된 콘텐츠가 없습니다
          </h3>
          <p className="text-xs text-zinc-400 dark:text-zinc-500 leading-relaxed">
            아직 생성된 콘텐츠 프로젝트가 없습니다. <br />
            좌측 상단의 워크스페이스에서 브랜드와 문체를 정의하고 첫 글을 완성해 보세요!
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/dashboard"
            className="inline-flex justify-center items-center py-2 px-4 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-sm text-sm font-semibold text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            둘러보기
          </Link>
        </div>
      </div>
    </div>
  );
}
