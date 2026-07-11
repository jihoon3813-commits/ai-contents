"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import {
  generateCommonOutline,
  updateOutline,
  approveOutline,
  generatePlatformContents,
} from "@/lib/actions/generation";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  FileText,
  Compass,
  Loader2,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  ChevronRight,
  ListOrdered,
  Heading2,
  HelpCircle,
  Check,
} from "lucide-react";

interface OutlineClientProps {
  project: any;
  initialOutline: any;
  initialItems: any[];
}

export default function OutlineClient({ project, initialOutline, initialItems }: OutlineClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [outline, setOutline] = useState(initialOutline);
  const [items, setItems] = useState<any[]>(initialItems);
  const [selectedTitle, setSelectedTitle] = useState(initialOutline?.selected_title || "");

  // 신규 소제목 추가를 위한 임시 폼 상태
  const [newItemTitle, setNewItemTitle] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemType, setNewItemType] = useState<"INTRO" | "HEADING" | "FAQ" | "CONCLUSION" | "CTA">("HEADING");

  const [isGenerating, startGenerating] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isApproving, startApproving] = useTransition();
  const [isStartingBody, startStartingBody] = useTransition();

  // AI 공통 개요 생성/재생성 핸들러
  const handleGenerateOutline = () => {
    startGenerating(async () => {
      try {
        const result = await generateCommonOutline(project.id);
        setOutline(result.outline);
        setItems(result.items);
        setSelectedTitle(result.outline.selected_title);
        toast.success("AI가 목차 개요 및 소제목 후보군을 수립했습니다.");
      } catch (err: any) {
        toast.error(`개요 생성 실패: ${err.message}`);
      }
    });
  };

  // 목차 순서 변경 (위로 이동)
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    // sort_order 보정
    newItems.forEach((item, idx) => {
      item.sort_order = idx + 1;
    });
    setItems(newItems);
  };

  // 목차 순서 변경 (아래로 이동)
  const handleMoveDown = (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    // sort_order 보정
    newItems.forEach((item, idx) => {
      item.sort_order = idx + 1;
    });
    setItems(newItems);
  };

  // 목차 항목 인라인 값 수정
  const handleItemFieldChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: value,
    };
    setItems(newItems);
  };

  // 목차 항목 제거
  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, idx) => idx !== index);
    newItems.forEach((item, idx) => {
      item.sort_order = idx + 1;
    });
    setItems(newItems);
  };

  // 신규 항목 추가
  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    const newItem = {
      item_type: newItemType,
      heading_level: newItemType === "HEADING" ? 2 : 3,
      title: newItemTitle,
      description: newItemDesc,
      sort_order: items.length + 1,
      is_locked: false,
    };

    setItems([...items, newItem]);
    setNewItemTitle("");
    setNewItemDesc("");
    toast.success("목차 항목이 리스트 하단에 추가되었습니다.");
  };

  // 개요 임시 저장
  const handleSaveOutline = () => {
    if (!outline) return;
    startSaving(async () => {
      try {
        const result = await updateOutline(outline.id, selectedTitle, items);
        setOutline(result.outline);
        setItems(result.items);
        toast.success("개요 변경 사항이 임시 저장되었습니다.");
      } catch (err: any) {
        toast.error(`저장 실패: ${err.message}`);
      }
    });
  };

  // 개요 승인 처리
  const handleApproveOutline = () => {
    if (!outline) return;
    startApproving(async () => {
      try {
        // 백그라운드 데이터와 싱크 맞춘 후 승인 진행하기 위해 자동 임시 저장 먼저 기동
        const saveRes = await updateOutline(outline.id, selectedTitle, items);
        const result = await approveOutline(outline.id);
        setOutline(result);
        setItems(saveRes.items);
        toast.success("개요가 최종 승인되었습니다. 이제 본문 생성을 개시할 수 있습니다.");
      } catch (err: any) {
        toast.error(`승인 실패: ${err.message}`);
      }
    });
  };

  // 본문 생성 Job 시작
  const handleStartBodyGeneration = () => {
    startStartingBody(async () => {
      try {
        const { jobId } = await generatePlatformContents(project.id);
        toast.success("AI 다채널 본문 비동기 생성이 예약되었습니다.");
        router.push(`/contents/${project.id}/generating`);
      } catch (err: any) {
        toast.error(`본문 생성 시작 실패: ${err.message}`);
      }
    });
  };

  const isApproved = outline?.status === "APPROVED";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 상단 액션바 */}
      <div className="flex items-center justify-between border-b border-zinc-200/50 dark:border-zinc-800/50 pb-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/contents/${project.id}/brief`}
            className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-500" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              AI 콘텐츠 생성 엔진
            </h1>
            <p className="text-xs text-zinc-500 mt-1 font-medium">
              공통 아웃라인 소제목을 편집하여 채널별 원고 기둥을 조립합니다.
            </p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200/40 dark:border-zinc-850">
        <Link
          href={`/contents/${project.id}/brief`}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-500 hover:bg-white/50 dark:hover:bg-zinc-800/50 transition-all"
        >
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          <span>STEP 1. 기획 브리프</span>
        </Link>
        <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white dark:bg-zinc-800 text-xs font-bold text-purple-600 dark:text-purple-400 shadow-sm border border-zinc-200/20">
          <Sparkles className="h-3.5 w-3.5" />
          <span>STEP 2. 목차 개요</span>
        </div>
        <div className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-zinc-400">
          <Compass className="h-3.5 w-3.5" />
          <span>STEP 3. 플랫폼 본문</span>
        </div>
      </div>

      {/* 목차 미구성 시 가이드 화면 */}
      {!outline ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-3xl p-12 text-center shadow-sm space-y-6">
          <div className="w-16 h-16 bg-purple-500/10 rounded-2xl flex items-center justify-center mx-auto border border-purple-500/20">
            <ListOrdered className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">소제목 목차 개요를 빌드해 보세요</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              수립된 기획 브리프의 핵심 주제와 팩트들을 논리적으로 배열하여 소주제 아웃라인을 설계합니다.
            </p>
          </div>
          <button
            onClick={handleGenerateOutline}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white disabled:bg-zinc-300 rounded-2xl text-xs font-bold transition-all shadow-md shadow-purple-600/10"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-zinc-550" />
                공통 아웃라인 빌딩 중...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                AI 목차 개요 생성하기
              </>
            )}
          </button>
        </div>
      ) : (
        // 목차 구성 본 판넬
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 좌측: 목차 리스트 수동 정형 및 편집 */}
          <div className="lg:col-span-2 space-y-5">
            {/* 타이틀 후보군 및 타이틀 선택 인풋 */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
                제목 설정
              </h3>

              {/* 현재 제목 직접 편집 */}
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-400 font-bold">최종 결정 원고 제목</label>
                <input
                  type="text"
                  value={selectedTitle}
                  onChange={(e) => setSelectedTitle(e.target.value)}
                  className="w-full text-xs font-bold text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-1 focus:ring-purple-500 bg-transparent"
                  placeholder="원고 제목을 입력하세요."
                />
              </div>

              {/* 후보 추천군 제공 */}
              {outline.title_candidates && outline.title_candidates.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[10px] text-zinc-400 font-bold block">AI가 제안한 제목 추천 후보군 (클릭 시 자동 대입)</span>
                  <div className="space-y-1.5">
                    {outline.title_candidates.map((cand: string, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedTitle(cand)}
                        className="w-full text-left text-xs bg-zinc-50 hover:bg-purple-50/50 dark:bg-zinc-950/20 dark:hover:bg-purple-950/20 border border-zinc-150 dark:border-zinc-850 hover:border-purple-200 rounded-xl p-3 transition-all flex items-center justify-between group font-medium"
                      >
                        <span className="text-zinc-700 dark:text-zinc-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                          {cand}
                        </span>
                        {selectedTitle === cand && (
                          <Check className="h-4 w-4 text-purple-600 shrink-0 ml-2" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 목차 상세 아이템들 */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-2">
                <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider">
                  상세 단락 목차 리스트 ({items.length})
                </h3>
                <span className="text-[10px] text-zinc-400 font-medium">아래 화살표로 논리 순서를 조율하세요.</span>
              </div>

              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 flex items-start justify-between gap-3"
                  >
                    {/* 타입 배지 및 순서 */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-extrabold text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-lg shrink-0">
                        {item.item_type}
                      </span>
                      <span className="text-xs text-zinc-400 font-bold">#{idx + 1}</span>
                    </div>

                    {/* 인라인 입력창 */}
                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => handleItemFieldChange(idx, "title", e.target.value)}
                        className="w-full text-xs font-bold text-zinc-800 dark:text-zinc-200 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-purple-500 focus:outline-none pb-0.5"
                        placeholder="단락 제목을 입력하세요."
                      />
                      <input
                        type="text"
                        value={item.description || ""}
                        onChange={(e) => handleItemFieldChange(idx, "description", e.target.value)}
                        className="w-full text-[11px] text-zinc-500 dark:text-zinc-400 bg-transparent border-b border-transparent hover:border-zinc-200 focus:border-purple-500 focus:outline-none"
                        placeholder="AI 원고 작성 가이드 지시사항을 적어주세요."
                      />
                    </div>

                    {/* 제어 스위치 모음 */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* 잠금 여부 */}
                      <button
                        onClick={() => handleItemFieldChange(idx, "is_locked", !item.is_locked)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          item.is_locked
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-500"
                            : "border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-zinc-600"
                        }`}
                        title={item.is_locked ? "잠김 (목차 고정)" : "열림 (AI 재생성 대상)"}
                      >
                        {item.is_locked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                      </button>

                      {/* 순서 조정 */}
                      <button
                        onClick={() => handleMoveUp(idx)}
                        disabled={idx === 0}
                        className="p-1 border border-zinc-250 dark:border-zinc-800 rounded-lg disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      >
                        <ArrowUp className="h-3.5 w-3.5 text-zinc-550" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(idx)}
                        disabled={idx === items.length - 1}
                        className="p-1 border border-zinc-250 dark:border-zinc-800 rounded-lg disabled:opacity-30 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                      >
                        <ArrowDown className="h-3.5 w-3.5 text-zinc-550" />
                      </button>

                      {/* 삭제 */}
                      <button
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 border border-red-500/10 hover:bg-red-500/10 rounded-lg text-red-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 신규 목차 수동 추가 폼 */}
              <form onSubmit={handleAddItem} className="pt-4 border-t border-zinc-100 dark:border-zinc-850 grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    value={newItemTitle}
                    onChange={(e) => setNewItemTitle(e.target.value)}
                    placeholder="소제목 제목 추가..."
                    className="w-full text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 bg-transparent focus:outline-none focus:ring-1 focus:ring-purple-500 text-zinc-800 dark:text-zinc-200"
                  />
                </div>
                <div>
                  <select
                    value={newItemType}
                    onChange={(e) => setNewItemType(e.target.value as any)}
                    className="w-full text-xs border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 bg-transparent focus:outline-none bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200"
                  >
                    <option value="HEADING">본문 문단 (HEADING)</option>
                    <option value="FAQ">자주 묻는 질문 (FAQ)</option>
                    <option value="INTRO">인쇄물 도입부 (INTRO)</option>
                    <option value="CONCLUSION">결론 문구 (CONCLUSION)</option>
                    <option value="CTA">마케팅 제안 (CTA)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-zinc-850 hover:bg-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white text-xs font-bold rounded-xl transition-all"
                >
                  <Plus className="h-3.5 w-3.5" />
                  항목 추가
                </button>
              </form>
            </div>
          </div>

          {/* 우측: 개요 승인 및 본문 생성 트리거 */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-xs font-extrabold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-2">
                개요 제어 패널
              </h3>

              <div className="space-y-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-zinc-400 font-bold block">개요 진행 및 승인 상태</span>
                  <p className="text-xs">
                    {isApproved ? (
                      <span className="text-emerald-600 dark:text-emerald-450 font-bold flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" />
                        개요 최종 승인 완료
                      </span>
                    ) : (
                      <span className="text-amber-500 font-bold flex items-center gap-1">
                        <HelpCircle className="h-4 w-4" />
                        목차 검토 및 승인 대기
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                  {/* 임시저장 */}
                  <button
                    onClick={handleSaveOutline}
                    disabled={isSaving}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all border border-zinc-200/55"
                  >
                    {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "목차 임시 저장"}
                  </button>

                  {/* 승인하기 */}
                  <button
                    onClick={handleApproveOutline}
                    disabled={isApproving}
                    className={`w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      isApproved
                        ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 cursor-default"
                        : "bg-purple-600 hover:bg-purple-550 text-white shadow-md shadow-purple-600/10"
                    }`}
                  >
                    {isApproving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isApproved ? (
                      <>
                        <Check className="h-4 w-4" />
                        승인 완료됨
                      </>
                    ) : (
                      "개요 검토 완료 (최종 승인)"
                    )}
                  </button>

                  {/* 플랫폼 본문 생성 시작 (승인되지 않았으면 비활성화) */}
                  <div className="pt-4 border-t border-zinc-100 dark:border-zinc-850 space-y-2">
                    <span className="text-[10px] text-zinc-400 font-bold block">플랫폼별 콘텐츠 3종 생성</span>
                    <button
                      onClick={handleStartBodyGeneration}
                      disabled={!isApproved || isStartingBody}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white disabled:bg-zinc-200 dark:disabled:bg-zinc-850 disabled:from-zinc-200 disabled:to-zinc-200 disabled:text-zinc-400 dark:disabled:text-zinc-600 rounded-xl text-xs font-bold transition-all shadow-md disabled:shadow-none"
                    >
                      {isStartingBody ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-550 mr-1" />
                          본문 생성 요청 전송 중...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          AI 다채널 본문 생성 시작
                        </>
                      )}
                    </button>
                    {!isApproved && (
                      <p className="text-[9px] text-amber-500 leading-normal flex items-start gap-1 font-semibold">
                        <Lock className="h-3.5 w-3.5 shrink-0" />
                        개요 최종 승인을 완료한 후에 본문 생성 기능을 작동할 수 있습니다.
                      </p>
                    )}
                  </div>

                  {/* AI 리빌드 */}
                  <button
                    onClick={handleGenerateOutline}
                    disabled={isGenerating}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-dashed border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-xl text-xs text-zinc-500 transition-all pt-3 mt-2"
                  >
                    {isGenerating ? "재생성 중..." : "AI 목차 개요 다시 수립"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
