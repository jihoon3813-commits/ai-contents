"use client";

import React, { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { createSampleAndAnalyze, deleteBrandSample, extractTextFromDocx } from "@/lib/actions/brand";
import {
  FileText,
  Upload,
  Sparkles,
  ArrowLeft,
  Trash2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Calendar,
  CheckCircle,
  FileCheck,
  Type,
  Lock,
} from "lucide-react";
import Link from "next/link";

interface Sample {
  id: string;
  title: string;
  source_type: "PASTED" | "FILE";
  raw_text: string;
  character_count: number;
  created_at: string;
  analysis_result: {
    char_count: number;
    avg_sentence_length: number;
    avg_paragraph_length: number;
    honorific_ratio: number;
    question_ratio: number;
    exclamation_count: number;
    emoji_count: number;
    conjunction_counts: Record<string, number>;
    common_endings: string[];
    repeated_phrases: string[];
  };
}

interface SamplesClientProps {
  brandId: string;
  brandName: string;
  initialSamples: Sample[];
  userRole: string;
}

export default function SamplesClient({
  brandId,
  brandName,
  initialSamples,
  userRole,
}: SamplesClientProps) {
  const [samples, setSamples] = useState<Sample[]>(initialSamples);
  const [activeSampleId, setActiveSampleId] = useState<string | null>(null);
  
  // 입력 폼 상태
  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<"PASTED" | "FILE">("PASTED");
  const [rawText, setRawText] = useState("");
  const [fileName, setFileName] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const router = useRouter();

  const isReadOnly = userRole === "VIEWER";

  // 파일 선택 감지 처리
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    if (!title) {
      // 파일명을 기본 제목으로 설정
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    const fileExtension = file.name.split(".").pop()?.toLowerCase();
    
    // 용량 제한 검증 (2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error("파일 업로드 한도는 최대 2MB입니다.");
      resetFile();
      return;
    }

    const loadingId = toast.loading("파일 텍스트 추출 중...");
    setIsLoading(true);

    try {
      if (fileExtension === "txt") {
        const reader = new FileReader();
        reader.onload = (event) => {
          const text = event.target?.result as string;
          if (text.length < 50) {
            toast.error("분석을 위해 최소 50자 이상의 본문이 필요합니다.");
            setIsLoading(false);
            toast.dismiss(loadingId);
            return;
          }
          setRawText(text);
          toast.dismiss(loadingId);
          toast.success("TXT 텍스트 추출 완료!");
          setIsLoading(false);
        };
        reader.readAsText(file, "utf-8");
      } else if (fileExtension === "docx") {
        // Docx 파싱 -> arrayBuffer 읽어서 서버 액션 전송
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result as ArrayBuffer;
            const base64Data = Buffer.from(arrayBuffer).toString("base64");
            
            // 서버에 mammoth 파싱 요청
            const text = await extractTextFromDocx(base64Data);
            if (text.length < 50) {
              toast.error("분석을 위해 최소 50자 이상의 본문이 필요합니다.");
              setIsLoading(false);
              toast.dismiss(loadingId);
              return;
            }
            setRawText(text);
            toast.dismiss(loadingId);
            toast.success("DOCX 문서 본문 추출 성공!");
          } catch (err: any) {
            toast.dismiss(loadingId);
            toast.error(`문서 변환 에러: ${err.message}`);
          } finally {
            setIsLoading(false);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        toast.dismiss(loadingId);
        toast.error("허용되지 않는 파일 포맷입니다. (.txt 또는 .docx만 지원)");
        resetFile();
        setIsLoading(false);
      }
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`파일 로드 에러: ${err.message}`);
      setIsLoading(false);
    }
  };

  const resetFile = () => {
    setFileName("");
    setRawText("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // 분석 실행 등록 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      toast.error("뷰어 권한은 예문을 등록할 수 없습니다.");
      return;
    }

    if (!title.trim()) {
      toast.error("예문 제목을 입력해 주세요.");
      return;
    }

    if (rawText.trim().length < 50) {
      toast.error("정량 분석을 위해서는 최소 50자 이상의 텍스트가 필요합니다.");
      return;
    }

    setIsLoading(true);
    const loadingId = toast.loading("어조 분석 모델을 가동하고 있습니다...");

    try {
      const payload = {
        title: title.trim(),
        source_type: sourceType,
        raw_text: rawText.trim(),
        file_path: fileName || undefined,
      };

      const newSample = await createSampleAndAnalyze(brandId, payload);
      
      setSamples((prev) => [newSample, ...prev]);
      
      // 입력 폼 초기화
      setTitle("");
      setRawText("");
      resetFile();

      toast.dismiss(loadingId);
      toast.success("예문 분석 및 보이스 추천값 산출이 완료되었습니다! 보이스 설정 탭을 확인해 보세요.");
      router.refresh();
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`분석 등록 실패: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 예문 삭제
  const handleDeleteSample = async (sampleId: string, sampleTitle: string) => {
    if (isReadOnly) {
      toast.error("뷰어 권한은 예문을 삭제할 수 없습니다.");
      return;
    }

    if (!confirm(`'${sampleTitle}' 분석 본문을 영구 삭제하시겠습니까?`)) {
      return;
    }

    setIsLoading(true);
    const loadingId = toast.loading("예문을 삭제하고 있습니다...");

    try {
      await deleteBrandSample(brandId, sampleId);
      setSamples((prev) => prev.filter((s) => s.id !== sampleId));
      if (activeSampleId === sampleId) setActiveSampleId(null);

      toast.dismiss(loadingId);
      toast.success("예문 분석 내역이 삭제되었습니다.");
      router.refresh();
    } catch (err: any) {
      toast.dismiss(loadingId);
      toast.error(`삭제 실패: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setActiveSampleId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 1. 상단 타이틀 */}
      <div className="flex items-center gap-2 pb-1">
        <Link
          href="/brands"
          className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-zinc-500" />
        </Link>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
            <FileText className="h-5 w-5 text-primary" />
            과거 작성글 분석 (어조 분석 샘플)
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            브랜드 &ldquo;{brandName}&rdquo;의 과거 포스팅 글을 업로드하여 정량적 문체와 권장 슬라이더 지표를 산출합니다.
          </p>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-850">
        <Link
          href={`/brands/${brandId}/voice`}
          className="pb-3 px-4 text-xs font-bold border-b-2 border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-all"
        >
          보이스(어조) 설정
        </Link>
        <Link
          href={`/brands/${brandId}/samples`}
          className="pb-3 px-4 text-xs font-bold border-b-2 border-primary text-primary transition-all"
        >
          작성글 샘플 분석
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 2. 등록 영역 (좌측 1개 컬럼) */}
        <div className="lg:col-span-1 bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-6 rounded-2xl shadow-sm space-y-5 self-start">
          <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 border-b border-zinc-100 dark:border-zinc-850 pb-2">
            새 작성 예문 분석 등록
          </h3>

          {isReadOnly ? (
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800/40 text-center space-y-2">
              <Lock className="h-5 w-5 text-zinc-400 mx-auto" />
              <p className="text-xs text-zinc-500 font-bold">읽기 전용 모드</p>
              <p className="text-[10px] text-zinc-400">뷰어 권한은 신규 작성 샘플을 추가하거나 분석할 수 없습니다.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  예문 제목
                </label>
                <input
                  type="text"
                  placeholder="예: IT 제품 소개글 원고"
                  disabled={isLoading}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-xs dark:bg-zinc-950"
                />
              </div>

              {/* 소스 타입 탭 */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  입력 방식 선택
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => { setSourceType("PASTED"); resetFile(); }}
                    className={`py-1.5 rounded-lg border text-center text-xs font-semibold ${
                      sourceType === "PASTED"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 text-zinc-500"
                    }`}
                  >
                    직접 텍스트 붙여넣기
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSourceType("FILE"); setRawText(""); }}
                    className={`py-1.5 rounded-lg border text-center text-xs font-semibold ${
                      sourceType === "FILE"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 text-zinc-500"
                    }`}
                  >
                    문서 파일 업로드
                  </button>
                </div>
              </div>

              {/* PASTED 방식 */}
              {sourceType === "PASTED" && (
                <div>
                  <div className="flex justify-between items-center">
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      원고 텍스트 본문 (글자수: {rawText.length}자)
                    </label>
                  </div>
                  <textarea
                    rows={8}
                    placeholder="여기에 과거에 직접 작성하셨던 고품질 글(최소 50자 이상)을 복사해서 붙여넣어 주세요. 텍스트가 풍부할수록 문체 분석 정확도가 증가합니다."
                    disabled={isLoading}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    className="mt-1 appearance-none block w-full px-3 py-2 border border-zinc-300 dark:border-zinc-800 rounded-lg shadow-sm placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent text-xs dark:bg-zinc-950 leading-relaxed"
                  />
                </div>
              )}

              {/* FILE 방식 */}
              {sourceType === "FILE" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      텍스트 추출 문서 파일 (.txt, .docx)
                    </label>
                    <div
                      onClick={() => !isLoading && fileInputRef.current?.click()}
                      className="mt-1 border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-primary dark:hover:border-primary/60 rounded-xl p-6 text-center cursor-pointer transition-colors bg-zinc-50/20 dark:bg-zinc-950/10"
                    >
                      <Upload className="h-6 w-6 text-zinc-400 mx-auto mb-2" />
                      <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                        {fileName || "문서 파일 선택"}
                      </p>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        Drag & Drop 또는 이곳을 클릭 (최대 2MB)
                      </p>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      disabled={isLoading}
                      onChange={handleFileChange}
                      accept=".txt,.docx"
                      className="hidden"
                    />
                  </div>

                  {rawText && (
                    <div className="space-y-1">
                      <p className="text-[10px] text-primary font-bold flex items-center gap-0.5">
                        <FileCheck className="h-3 w-3" />
                        문서 텍스트 추출 완료 ({rawText.length}자)
                      </p>
                      <textarea
                        rows={5}
                        readOnly
                        value={rawText}
                        className="w-full p-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-50 dark:bg-zinc-950 text-[10px] text-zinc-500 leading-relaxed outline-none"
                      />
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || rawText.trim().length < 50}
                className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-xl shadow-sm text-xs font-semibold text-white bg-primary hover:bg-primary/95 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    파싱 분석 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    문체 분석 가동
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* 3. 분석 보고서 목록 (우측 2개 컬럼) */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
            문체 분석 히스토리 ({samples.length}개 예문)
          </h3>

          {samples.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 p-12 rounded-2xl text-center space-y-3">
              <FileText className="h-10 w-10 text-zinc-300 mx-auto" />
              <p className="text-xs text-zinc-500 font-bold">등록된 예문 샘플이 없습니다</p>
              <p className="text-[10px] text-zinc-400">좌측 입력란을 통해 첫 번째 과거 글을 업로드하여 스타일을 분석해 보세요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {samples.map((sample) => {
                const isExpanded = activeSampleId === sample.id;
                const result = sample.analysis_result;
                return (
                  <div
                    key={sample.id}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/50 rounded-2xl shadow-sm overflow-hidden"
                  >
                    {/* 아코디언 헤더 */}
                    <div
                      onClick={() => toggleExpand(sample.id)}
                      className="p-5 flex justify-between items-center cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-950/20 transition-colors"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 truncate">
                            {sample.title}
                          </h4>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                            sample.source_type === "FILE"
                              ? "bg-violet-500/10 text-violet-600 dark:text-violet-400"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                          }`}>
                            {sample.source_type === "FILE" ? "파일분석" : "붙여넣기"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-400 font-medium">
                          <span className="flex items-center gap-0.5">
                            <Calendar className="h-3 w-3" />
                            {new Date(sample.created_at).toLocaleDateString()}
                          </span>
                          <span>|</span>
                          <span className="flex items-center gap-0.5">
                            <Type className="h-3 w-3" />
                            {sample.character_count} 자
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSample(sample.id, sample.title);
                          }}
                          disabled={isReadOnly || isLoading}
                          className="p-1.5 text-zinc-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors disabled:opacity-30 cursor-pointer"
                          title="분석 내역 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-zinc-400" />
                        )}
                      </div>
                    </div>

                    {/* 아코디언 본문 (정량 보고서) */}
                    {isExpanded && result && (
                      <div className="px-5 pb-6 border-t border-zinc-100 dark:border-zinc-800/80 pt-5 bg-zinc-50/20 dark:bg-zinc-950/10 space-y-5">
                        {/* 4대 문체 분석 링/프로그래스 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-850 text-center space-y-1">
                            <p className="text-[10px] text-zinc-400 font-bold">존댓말 비율</p>
                            <p className="text-lg font-black text-primary">{result.honorific_ratio}%</p>
                            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                              <div className="bg-primary h-full transition-all" style={{ width: `${result.honorific_ratio}%` }} />
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-850 text-center space-y-1">
                            <p className="text-[10px] text-zinc-400 font-bold">의문문 비율</p>
                            <p className="text-lg font-black text-emerald-500">{result.question_ratio}%</p>
                            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full transition-all" style={{ width: `${result.question_ratio}%` }} />
                            </div>
                          </div>

                          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-850 text-center space-y-1">
                            <p className="text-[10px] text-zinc-400 font-bold">느낌표 개수</p>
                            <p className="text-lg font-black text-amber-500">{result.exclamation_count}개</p>
                            <p className="text-[9px] text-zinc-400 mt-0.5">문장 내 강도</p>
                          </div>

                          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-850 text-center space-y-1">
                            <p className="text-[10px] text-zinc-400 font-bold">이모지 감지</p>
                            <p className="text-lg font-black text-violet-500">{result.emoji_count}개</p>
                            <p className="text-[9px] text-zinc-400 mt-0.5">SNS 활용 성향</p>
                          </div>
                        </div>

                        {/* 통계 구획 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* 평균 문장 및 문단 길이 */}
                          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-850 space-y-2 text-xs">
                            <h5 className="font-bold text-zinc-700 dark:text-zinc-300">구조 정보 요약</h5>
                            <div className="flex justify-between items-center text-zinc-500">
                              <span>평균 문장 길이:</span>
                              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{result.avg_sentence_length}자</span>
                            </div>
                            <div className="flex justify-between items-center text-zinc-500">
                              <span>평균 문단 길이:</span>
                              <span className="font-semibold text-zinc-700 dark:text-zinc-300">{result.avg_paragraph_length}자</span>
                            </div>
                          </div>

                          {/* 자주 사용하는 접속사 배지 */}
                          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-850 space-y-2 text-xs">
                            <h5 className="font-bold text-zinc-700 dark:text-zinc-300">자주 사용한 접속사</h5>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.keys(result.conjunction_counts || {}).length === 0 ? (
                                <span className="text-[10px] text-zinc-400">특정 접속사 빈도 낮음</span>
                              ) : (
                                Object.entries(result.conjunction_counts).map(([conj, count]) => (
                                  <span
                                    key={conj}
                                    className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200/40"
                                  >
                                    {conj} ({count}회)
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 하단: 종결어미 및 반복 구문 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <h5 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5 text-primary" />
                              주요 종결 어투 (마지막 어절)
                            </h5>
                            <div className="flex flex-wrap gap-1.5">
                              {(result.common_endings || []).map((ending, idx) => (
                                <span
                                  key={ending}
                                  className="text-[10px] font-bold bg-primary/5 text-primary px-2.5 py-0.5 rounded-lg border border-primary/10"
                                >
                                  {idx + 1}위: ~{ending}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <h5 className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                              <CheckCircle className="h-3.5 w-3.5 text-primary" />
                              자주 반복되는 어절 구문
                            </h5>
                            <div className="flex flex-wrap gap-1.5">
                              {(result.repeated_phrases || []).length === 0 ? (
                                <span className="text-[10px] text-zinc-400">중복 어절 패턴 없음</span>
                              ) : (
                                (result.repeated_phrases || []).map((phrase) => (
                                  <span
                                    key={phrase}
                                    className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-lg"
                                  >
                                    &ldquo;{phrase}&rdquo;
                                  </span>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {/* 예문 본문 전문 보기 */}
                        <div className="space-y-1.5">
                          <h5 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">제출 텍스트 원문</h5>
                          <p className="p-3.5 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-950 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed max-h-40 overflow-y-auto select-all whitespace-pre-wrap">
                            {sample.raw_text}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
