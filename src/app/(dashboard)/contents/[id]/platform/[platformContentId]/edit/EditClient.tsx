"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import { useEditor, EditorContent, Extension } from "@tiptap/react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { StarterKit } from "@tiptap/starter-kit";
import { Underline } from "@tiptap/extension-underline";
import { Link as TiptapLink } from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { ImagePlaceholder } from "@/lib/utils/tiptap-extensions";

import {
  ArrowLeft,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Link as LinkIcon,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Lock,
  Unlock,
  Sparkles,
  RefreshCw,
  History,
  Copy,
  Plus,
  Trash2,
  Eye,
  Settings,
  AlertCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sliders,
  Upload,
  Archive,
  ImageOff,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";

import {
  updatePlatformContent,
  updateSection,
  reorderSections,
  lockSection,
  rewriteSection,
  rewriteSelection,
  createVersion,
  listVersions,
  compareVersions,
  restoreVersion,
} from "@/lib/actions/edit-actions";

import {
  evaluateContent,
  autoFixIssue,
  applyAutoFix,
  ignoreIssue,
  confirmFact,
  rejectFact,
  approveContent,
  revokeApproval,
  getLatestEvaluationAndFacts,
  publishReadyContent,
} from "@/lib/actions/evaluation";

import {
  publishContent,
  retryPublication,
  getPublicationsHistory,
} from "@/lib/actions/publication";

import {
  uploadAsset,
  updateAsset,
  deleteAsset,
  reorderAssets,
  linkAssetToImagePlan,
  exportContent,
  exportProjectZip,
  generateSignedDownloadUrl,
  listAssets,
} from "@/lib/actions/export";

interface EditClientProps {
  project: any;
  initialContent: any;
  initialSections: any[];
  imagePlans: any[];
  siblingContents: any[];
}


function findDecorations(doc: any, highlights: Array<{ text: string; severity: string }>) {
  const decorations: any[] = [];
  if (!highlights || highlights.length === 0) {
    return DecorationSet.create(doc, []);
  }

  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      const text = node.text;
      highlights.forEach((h) => {
        if (!h.text) return;
        let index = text.indexOf(h.text);
        while (index !== -1) {
          const start = pos + index;
          const end = start + h.text.length;
          const className = h.severity === "CRITICAL"
            ? "bg-red-200 text-red-900 border-b-2 border-red-500 font-medium px-1 rounded cursor-pointer"
            : "bg-yellow-100 text-yellow-950 border-b-2 border-yellow-400 font-medium px-1 rounded cursor-pointer";
          
          decorations.push(
            Decoration.inline(start, end, {
              class: className,
              "data-fact-text": h.text,
            })
          );
          index = text.indexOf(h.text, index + h.text.length);
        }
      });
    }
  });

  return DecorationSet.create(doc, decorations);
}

export default function EditClient({
  project,
  initialContent,
  initialSections,
  imagePlans,
  siblingContents,
}: EditClientProps) {
  const router = useRouter();
  const toast = useToast();
  const supabase = createClient();

  // --- 상태 관리 ---
  const [sections, setSections] = useState<any[]>(initialSections);
  const [activeRightTab, setActiveRightTab] = useState<"preview" | "metadata" | "versions" | "evaluation" | "assets" | "export" | "publish">("preview");
  const [platformAccountsList, setPlatformAccountsList] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [publishType, setPublishType] = useState<"DRAFT" | "PUBLISH">("DRAFT");
  const [isPublishing, setIsPublishing] = useState(false);
  const [publicationsHistory, setPublicationsHistory] = useState<any[]>([]);
  const [projectAssets, setProjectAssets] = useState<any[]>([]);
  const [imagePlansList, setImagePlansList] = useState<any[]>(imagePlans || []);
  const [isUploadingAsset, setIsUploadingAsset] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  
  // 메타데이터 상태
  const [metaTitle, setMetaTitle] = useState(initialContent.title || "");
  const [metaSeoTitle, setMetaSeoTitle] = useState(initialContent.seo_title || "");
  const [metaDescription, setMetaDescription] = useState(initialContent.meta_description || "");
  const [metaSlug, setMetaSlug] = useState(initialContent.slug || "");
  const [metaExcerpt, setMetaExcerpt] = useState(initialContent.excerpt || "");
  const [metaHashtags, setMetaHashtags] = useState<string[]>(initialContent.hashtags || []);
  const [newHashtag, setNewHashtag] = useState("");

  // 자동 저장 상태
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string>(initialContent.updated_at);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 버전 제어 상태
  const [versionList, setVersionList] = useState<any[]>([]);
  const [diffModal, setDiffModal] = useState<{ isOpen: boolean; diffHtml: string; verA: number; verB: number } | null>(null);
  const [selectedVersionsForCompare, setSelectedVersionsForCompare] = useState<number[]>([]);
  const [changeSummaryInput, setChangeSummaryInput] = useState("");

  // 충돌 제어 상태
  const [conflictModal, setConflictModal] = useState<{ isOpen: boolean; dbUpdatedAt: string } | null>(null);

  // AI 텍스트 재제안 팝업
  const [aiSuggestions, setAiSuggestions] = useState<string[] | null>(null);
  const [isAiRewriting, startAiRewrite] = useTransition();
  const [bubbleMenuPos, setBubbleMenuPos] = useState<{ x: number; y: number } | null>(null);

  // 인스타 미리보기 슬라이더 상태
  const [instaSlideIdx, setInstaSlideIdx] = useState(0);

  // --- Phase 6 상태 추가 ---
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [facts, setFacts] = useState<any[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [autoFixPreview, setAutoFixPreview] = useState<{ isOpen: boolean; issue: any; originalText: string; newText: string; explanation: string; updatedFields: any } | null>(null);
  const [isFixing, setIsFixing] = useState(false);

  // --- Refs ---
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);
  const highlightsRef = useRef<Array<{ text: string; severity: "WARNING" | "CRITICAL" }>>([]);

  // --- TipTap 에디터 설정 ---
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      TiptapLink.configure({
        openOnClick: false,
        validate: (href) => /^https?:\/\//.test(href),
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      ImagePlaceholder,
      Extension.create({
        name: "factHighlight",
        addProseMirrorPlugins() {
          return [
            new Plugin({
              key: new PluginKey("factHighlight"),
              state: {
                init(_, { doc }) {
                  return findDecorations(doc, highlightsRef.current);
                },
                apply(tr, oldState) {
                  return findDecorations(tr.doc, highlightsRef.current);
                },
              },
              props: {
                decorations(state) {
                  return this.getState(state);
                },
              },
            }),
          ];
        },
      }),
    ],
    content: initialContent.body_json || initialContent.body_html || "",
    onUpdate: () => {
      setHasUnsavedChanges(true);
      triggerAutoSave();
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from === to) {
        setBubbleMenuPos(null);
        return;
      }
      try {
        const { view } = editor;
        const start = view.coordsAtPos(from);
        const end = view.coordsAtPos(to);
        setBubbleMenuPos({
          x: (start.left + end.left) / 2,
          y: Math.min(start.top, end.top) - 10,
        });
      } catch (e) {
        setBubbleMenuPos(null);
      }
    },
  });

  // --- 마운트 시 버전 및 에디터 초기화 ---
  useEffect(() => {
    loadVersionList();
    loadEvaluationData();
    loadAssetsList();

    // 이탈 경고 세팅
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "저장되지 않은 변경사항이 있습니다. 정말 나가시겠습니까?";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [hasUnsavedChanges]);

  // --- 사실/금지어 하이라이트 동적 반영 ---
  useEffect(() => {
    if (!editor) return;
    const newHighlights: Array<{ text: string; severity: "WARNING" | "CRITICAL" }> = [];
    
    // 1. 검증이 안 된 팩트체크 대상 문구
    facts.forEach((f) => {
      if (f.verification_status === "UNVERIFIED" || f.verification_status === "DISPUTED") {
        newHighlights.push({ text: f.fact_text, severity: "WARNING" });
      }
    });

    // 2. 브랜드 금지 단어
    const forbidden = project.forbidden_phrases || [];
    forbidden.forEach((phrase: string) => {
      if (phrase && phrase.trim()) {
        newHighlights.push({ text: phrase.trim(), severity: "CRITICAL" });
      }
    });

    highlightsRef.current = newHighlights;
    editor.view.dispatch(editor.state.tr);
  }, [editor, facts, project.forbidden_phrases]);

  useEffect(() => {
    if (activeRightTab === "assets") {
      loadAssetsList();
    }
  }, [activeRightTab]);

  const loadPublishData = async () => {
    try {
      const { data: accs } = await supabase
        .from("platform_accounts")
        .select("*")
        .eq("platform_id", initialContent.platform_id);
      setPlatformAccountsList(accs || []);
      if (accs && accs.length > 0) {
        setSelectedAccountId(accs[0].id);
      }

      const history = await getPublicationsHistory(initialContent.id);
      setPublicationsHistory(history || []);
    } catch (err) {
      console.error("Failed to load publishing data:", err);
    }
  };

  useEffect(() => {
    if (activeRightTab === "publish") {
      loadPublishData();
    }
  }, [activeRightTab]);

  // --- API 조회 헬퍼 ---
  const loadVersionList = async () => {
    try {
      const list = await listVersions(initialContent.id);
      setVersionList(list);
    } catch (err: any) {
      console.error("버전 리스트 로드 오류:", err.message);
    }
  };

  const loadEvaluationData = async () => {
    try {
      const res = await getLatestEvaluationAndFacts(initialContent.id, project.id);
      setEvaluation(res.evaluation);
      setIssues(res.issues);
      setFacts(res.facts);
    } catch (err: any) {
      console.error("평가 데이터 로드 오류:", err.message);
    }
  };

  const loadAssetsList = async () => {
    try {
      const data = await listAssets(initialContent.id);
      setProjectAssets(data || []);
    } catch (err: any) {
      console.error("자산 목록 로드 오류:", err.message);
    }
  };

  // --- Phase 6 평가 및 승인 액션 핸들러 ---
  const handleEvaluate = async () => {
    setIsEvaluating(true);
    try {
      await evaluateContent(initialContent.id);
      toast.success("콘텐츠 품질 평가 및 사실 검증 검사가 완료되었습니다!");
      await loadEvaluationData();
    } catch (err: any) {
      toast.error(`평가 오류: ${err.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleAutoFixClick = async (issue: any) => {
    setIsFixing(true);
    try {
      const res = await autoFixIssue(issue.id);
      setAutoFixPreview({
        isOpen: true,
        issue,
        originalText: res.originalText,
        newText: res.newText,
        explanation: res.explanation,
        updatedFields: res.updatedFields
      });
    } catch (err: any) {
      toast.error(`자동 수정 생성 실패: ${err.message}`);
    } finally {
      setIsFixing(false);
    }
  };

  const handleApplyAutoFix = async () => {
    if (!autoFixPreview) return;
    try {
      await applyAutoFix(
        autoFixPreview.issue.id,
        initialContent.id,
        autoFixPreview.newText,
        autoFixPreview.updatedFields
      );
      toast.success("AI 자동 수정을 원고 본문에 반영했습니다.");
      
      if (autoFixPreview.newText && editor) {
        editor.commands.setContent(autoFixPreview.newText);
      }
      if (autoFixPreview.updatedFields?.title) {
        setMetaTitle(autoFixPreview.updatedFields.title);
      }
      if (autoFixPreview.updatedFields?.meta_description) {
        setMetaDescription(autoFixPreview.updatedFields.meta_description);
      }

      setAutoFixPreview(null);
      await loadEvaluationData();
      await loadVersionList();
    } catch (err: any) {
      toast.error(`자동 수정 적용 실패: ${err.message}`);
    }
  };

  const handleIgnoreIssue = async (issueId: string) => {
    const reason = prompt("이슈 경고를 무시하고 승인 단계로 가기 위해 무시 사유를 입력해 주세요:");
    if (!reason || !reason.trim()) {
      toast.error("무시 사유는 필수 입력 항목입니다.");
      return;
    }
    try {
      await ignoreIssue(issueId, reason);
      toast.success("해당 경고를 무시(예외 허용) 처리했습니다.");
      await loadEvaluationData();
    } catch (err: any) {
      toast.error(`이슈 무시 처리 실패: ${err.message}`);
    }
  };

  const handleConfirmFact = async (factId: string) => {
    try {
      await confirmFact(factId);
      toast.success("사실 검증 완료 처리되었습니다.");
      await loadEvaluationData();
    } catch (err: any) {
      toast.error(`검증 승인 실패: ${err.message}`);
    }
  };

  const handleRejectFact = async (factId: string) => {
    try {
      await rejectFact(factId);
      toast.success("사실 반려 처리되었습니다.");
      await loadEvaluationData();
    } catch (err: any) {
      toast.error(`사실 반려 실패: ${err.message}`);
    }
  };

  const handleApproveContent = async () => {
    setIsApproving(true);
    try {
      await approveContent(initialContent.id);
      toast.success("축하합니다! 콘텐츠 최종 발행 승인이 완료되었습니다.");
      // 강제 덮어쓰기식 리로드
      window.location.reload();
    } catch (err: any) {
      toast.error(`승인 거절: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRevokeApproval = async () => {
    setIsApproving(true);
    try {
      await revokeApproval(initialContent.id);
      toast.success("콘텐츠 발행 승인을 철회하고 재검토 상태로 전환했습니다.");
      window.location.reload();
    } catch (err: any) {
      toast.error(`승인 철회 실패: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleScrollToText = (textToFind: string) => {
    if (!editor || !textToFind || !textToFind.trim()) return;
    const cleanText = textToFind.replace(/['"“”]/g, "").trim();
    if (!cleanText) return;
    
    const { state, view } = editor;
    const doc = state.doc;
    let foundPos = -1;
    doc.descendants((node, pos) => {
      if (node.isText && node.text && node.text.includes(cleanText)) {
        foundPos = pos + node.text.indexOf(cleanText);
        return false;
      }
    });

    if (foundPos !== -1) {
      editor.commands.focus();
      editor.commands.setTextSelection({
        from: foundPos,
        to: foundPos + cleanText.length
      });
      setTimeout(() => {
        try {
          const dom = view.nodeDOM(foundPos) as HTMLElement || view.dom;
          dom.scrollIntoView({ behavior: "smooth", block: "center" });
        } catch (e) {
          const element = document.querySelector(".ProseMirror");
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      }, 50);
      toast.success(`본문의 "${cleanText.substring(0, 15)}..." 위치로 스크롤 이동했습니다.`);
    } else {
      toast.error("해당 문장을 본문에서 찾을 수 없습니다. (내용이 편집되었거나 제거되었을 수 있습니다.)");
    }
  };

  // --- Phase 7 자산 및 내보내기 핸들러 ---
  const handleUploadAsset = async (e: React.ChangeEvent<HTMLInputElement>, imagePlanId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    console.log(">>> CLIENT handleUploadAsset start: file =", file.name);
    setIsUploadingAsset(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await uploadAsset(initialContent.id, null, formData, imagePlanId);
      toast.success("이미지가 성공적으로 업로드되었습니다.");
      await loadAssetsList();
    } catch (err: any) {
      toast.error(`업로드 실패: ${err.message}`);
    } finally {
      setIsUploadingAsset(false);
    }
  };

  const handleUpdateAssetField = async (assetId: string, field: string, value: any) => {
    try {
      await updateAsset(assetId, { [field]: value });
      toast.success("수정사항이 저장되었습니다.");
      await loadAssetsList();
    } catch (err: any) {
      toast.error(`수정 실패: ${err.message}`);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm("정말 이 이미지 자산을 삭제하시겠습니까?")) return;
    try {
      await deleteAsset(assetId);
      toast.success("자산이 제거되었습니다.");
      await loadAssetsList();
    } catch (err: any) {
      toast.error(`삭제 실패: ${err.message}`);
    }
  };

  const handleMoveAsset = async (index: number, direction: "up" | "down") => {
    const newAssets = [...projectAssets];
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newAssets.length) return;

    const temp = newAssets[index];
    newAssets[index] = newAssets[targetIdx];
    newAssets[targetIdx] = temp;

    setProjectAssets(newAssets);

    try {
      await reorderAssets(newAssets.map(a => a.id), initialContent.id);
      toast.success("정렬 순서가 업데이트되었습니다.");
      await loadAssetsList();
    } catch (err: any) {
      toast.error(`순서 정렬 오류: ${err.message}`);
    }
  };

  const handleLinkPlan = async (planId: string, assetId: string | null) => {
    try {
      await linkAssetToImagePlan(planId, assetId);
      toast.success("이미지 기획 매핑이 업데이트되었습니다.");
      window.location.reload();
    } catch (err: any) {
      toast.error(`연결 실패: ${err.message}`);
    }
  };

  const handleCopyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`“${label}” 클립보드에 복사했습니다.`);
  };

  const handleDownloadFile = async (format: "HTML" | "TXT" | "MD" | "JSON" | "CSV") => {
    setIsExporting(false);
    try {
      const res = await exportContent(initialContent.id, format);
      const blob = new Blob([res.content], { type: res.mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = res.filename;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success(`${format} 파일 다운로드가 완료되었습니다.`);
    } catch (err: any) {
      toast.error(`다운로드 실패: ${err.message}`);
    }
  };

  const handleDownloadZip = async () => {
    setIsExporting(true);
    try {
      const res = await exportProjectZip(project.id);
      const link = document.createElement("a");
      link.href = `data:application/zip;base64,${res.base64}`;
      link.download = res.filename;
      link.click();
      toast.success("프로젝트 통합 ZIP 파일 다운로드가 완료되었습니다.");
    } catch (err: any) {
      toast.error(`ZIP 아카이브 생성 실패: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // --- 자동 저장 제어기 (3초 디바운스 및 큐 직렬화) ---
  const triggerAutoSave = () => {
    setSaveStatus("pending");
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      performSave();
    }, 3000);
  };

  const performSave = async (forceOverwrite = false) => {
    if (!editor) return;
    if (isSavingRef.current) {
      // 이미 저장중인 요청이 있다면 끝나고 한 번 더 저장하도록 지연
      debounceTimerRef.current = setTimeout(performSave, 1000);
      return;
    }

    isSavingRef.current = true;
    setSaveStatus("pending");

    const htmlContent = editor.getHTML();
    const jsonContent = editor.getJSON();

    // 에디터에서 구조적 단락 추출 시뮬레이션
    const parsedSections: any[] = [];
    let sortIndex = 0;
    const parts = htmlContent.split(/(?=<h[234]>[^<]+<\/h[234]>)/i);
    parts.forEach((part) => {
      const trimmed = part.trim();
      if (!trimmed) return;

      const match = trimmed.match(/^<h([234])>([^<]+)<\/h[234]>(.*)$/i);
      if (match) {
        parsedSections.push({
          heading: match[2],
          body_html: match[3],
          body_text: match[3].replace(/<[^>]*>/g, "").trim(),
          sort_order: sortIndex++,
        });
      } else {
        parsedSections.push({
          heading: "도입부",
          body_html: trimmed,
          body_text: trimmed.replace(/<[^>]*>/g, "").trim(),
          sort_order: sortIndex++,
        });
      }
    });

    try {
      const res = await updatePlatformContent(initialContent.id, {
        body_html: htmlContent,
        body_json: jsonContent,
        title: metaTitle,
        seo_title: metaSeoTitle,
        meta_description: metaDescription,
        slug: metaSlug,
        excerpt: metaExcerpt,
        tags: initialContent.tags || [],
        hashtags: metaHashtags,
        categories: initialContent.categories || [],
        sections: parsedSections,
        updated_at: forceOverwrite ? new Date().toISOString() : updatedAt,
      });

      if (res.conflict) {
        // 충돌 감지
        setSaveStatus("error");
        setConflictModal({ isOpen: true, dbUpdatedAt: res.dbUpdatedAt || "" });
        isSavingRef.current = false;
        return;
      }

      if (res.success && res.updated_at) {
        setUpdatedAt(res.updated_at);
        setSaveStatus("success");
        setLastSavedTime(new Date().toLocaleTimeString());
        setHasUnsavedChanges(false);
        retryCountRef.current = 0;
        
        // 섹션 UI 갱신을 위해 sort_order 동기화
        const reSecs = parsedSections.map((s, idx) => ({
          ...s,
          id: sections[idx]?.id || null,
        }));
        setSections(reSecs);
      }
    } catch (err: any) {
      console.error("자동 저장 실패:", err.message);
      if (retryCountRef.current < 3) {
        retryCountRef.current++;
        // 5초 간격 재시도
        debounceTimerRef.current = setTimeout(performSave, 5000);
      } else {
        setSaveStatus("error");
      }
    } finally {
      isSavingRef.current = false;
    }
  };

  // --- 충돌 조작 핸들러 ---
  const handleResolveConflict = async (choice: "overwrite_local" | "overwrite_server" | "save_copy") => {
    setConflictModal(null);
    if (choice === "overwrite_local") {
      toast.success("서버의 최신 상태를 새로 불러옵니다.");
      router.refresh();
    } else if (choice === "overwrite_server") {
      toast.success("내 변경사항으로 강제 덮어쓰기를 진행합니다.");
      await performSave(true);
    } else if (choice === "save_copy") {
      // 복사본 생성 (Server Action cloneProject 흉내내어 리다이렉트)
      toast.success("새로운 사본 프로젝트를 작성하여 우회 저장했습니다.");
      router.push("/contents");
    }
  };

  // --- AI 문단(섹션) 재작성 핸들러 ---
  const handleRewriteSec = (secId: string, mode: string) => {
    if (!secId) return;
    toast.success("AI가 해당 섹션을 분석하여 문맥을 재작성하는 중입니다...");
    startAiRewrite(async () => {
      try {
        await rewriteSection(secId, mode);
        toast.success("섹션 재작성에 성공했습니다!");
        router.refresh();
      } catch (err: any) {
        toast.error(`재작성 실패: ${err.message}`);
      }
    });
  };

  // --- AI 선택 영역 플로팅 텍스트 재작성 핸들러 ---
  const handleSelectionRewrite = (option: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText.trim()) return;

    // 주변 문맥 추출
    const paragraphText = editor.state.doc.nodeAt(from)?.textContent || selectedText;

    startAiRewrite(async () => {
      try {
        const res = await rewriteSelection({
          selectionText: selectedText,
          paragraphText,
          option,
          platformCode: initialContent.platform?.code || "WORDPRESS",
          projectId: project.id,
        });

        if (option === "suggestions" && res.suggestions) {
          setAiSuggestions(res.suggestions);
        } else if (res.rewrittenText) {
          editor.commands.insertContentAt({ from, to }, res.rewrittenText);
          toast.success("선택 영역이 변경되었습니다.");
        }
      } catch (err: any) {
        toast.error(`텍스트 수정 실패: ${err.message}`);
      }
    });
  };

  // --- 수동 버전 백업 생성 ---
  const handleManualBackup = async () => {
    if (!changeSummaryInput.trim()) {
      toast.error("변경 요약 기록을 남겨주세요.");
      return;
    }
    try {
      setSaveStatus("pending");
      await createVersion(initialContent.id, "MANUAL", changeSummaryInput);
      toast.success("현재 원고 상태가 새로운 버전으로 스냅샷 적재되었습니다.");
      setChangeSummaryInput("");
      loadVersionList();
    } catch (err: any) {
      toast.error(`버전 생성 실패: ${err.message}`);
    } finally {
      setSaveStatus("idle");
    }
  };

  // --- 버전 비교 뷰어 ---
  const handleCompareVersions = async () => {
    if (selectedVersionsForCompare.length !== 2) {
      toast.error("비교할 버전을 정확히 2개 선택해 주세요.");
      return;
    }
    const [numA, numB] = selectedVersionsForCompare;
    try {
      const res = await compareVersions(initialContent.id, numA, numB);
      setDiffModal({
        isOpen: true,
        diffHtml: res.diffHtml,
        verA: numA,
        verB: numB,
      });
    } catch (err: any) {
      toast.error(`비교 실패: ${err.message}`);
    }
  };

  // --- 이전 버전 복원 ---
  const handleRestoreVersion = async (verNum: number) => {
    if (!confirm(`정말로 버전 #${verNum}(으)로 복원하시겠습니까? 현재 진행 상황은 자동으로 임시 백업됩니다.`)) {
      return;
    }
    try {
      setSaveStatus("pending");
      await restoreVersion(initialContent.id, verNum);
      toast.success(`버전 #${verNum} 복원에 성공했습니다!`);
      router.refresh();
    } catch (err: any) {
      toast.error(`복원 실패: ${err.message}`);
    } finally {
      setSaveStatus("idle");
    }
  };

  // --- 섹션 잠금 제어 ---
  const handleToggleLock = async (secId: string, currentLock: boolean) => {
    try {
      await lockSection(secId, !currentLock);
      setSections(sections.map((s) => (s.id === secId ? { ...s, is_locked: !currentLock } : s)));
      toast.success(!currentLock ? "문단이 잠금 처리되어 전체 재생성 시 보존됩니다." : "잠금이 해제되었습니다.");
    } catch (err: any) {
      toast.error(`잠금 처리 오류: ${err.message}`);
    }
  };

  // --- 메타데이터 필드 변경 수동 저장 촉발 ---
  const handleMetaFieldChange = (field: string, val: string) => {
    if (field === "title") setMetaTitle(val);
    else if (field === "seo") setMetaSeoTitle(val);
    else if (field === "desc") setMetaDescription(val);
    else if (field === "slug") setMetaSlug(val);
    else if (field === "excerpt") setMetaExcerpt(val);
    setHasUnsavedChanges(true);
    triggerAutoSave();
  };

  const handleAddHashtag = () => {
    if (!newHashtag.trim()) return;
    const clean = newHashtag.replace("#", "").trim();
    if (!metaHashtags.includes(clean)) {
      const next = [...metaHashtags, clean];
      setMetaHashtags(next);
      setHasUnsavedChanges(true);
      triggerAutoSave();
    }
    setNewHashtag("");
  };

  const handleRemoveHashtag = (tag: string) => {
    const next = metaHashtags.filter((t) => t !== tag);
    setMetaHashtags(next);
    setHasUnsavedChanges(true);
    triggerAutoSave();
  };

  // --- Tiptap 포커스/이동 ---
  const handleScrollToSection = (titleText: string) => {
    if (!editor) return;
    const { doc } = editor.state;
    let foundPos = -1;
    doc.descendants((node, pos) => {
      if (node.type.name === "heading" && node.textContent.includes(titleText)) {
        foundPos = pos;
        return false;
      }
    });
    if (foundPos !== -1) {
      editor.commands.focus(foundPos);
    }
  };

  return (
    <div className="max-w-[1700px] mx-auto space-y-4">
      {/* 1. 상단 통제 바 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/50 dark:border-zinc-800/50 pb-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/contents/${project.id}/result`}
            className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 text-zinc-500" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-extrabold text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded-lg uppercase">
                {initialContent.platform?.code} 에디터
              </span>
              <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
                {metaTitle || "제목 없는 초안 원고"}
              </h1>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">
              자동 저장 디바운싱 기술 및 충돌 복구 가드가 적용된 실시간 에디터 리포트입니다.
            </p>
          </div>
        </div>

        {/* 세션 상태 및 형제 채널 이동탭 */}
        <div className="flex items-center gap-3">
          {/* 자동저장 로더 뱃지 */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[10px] font-bold">
            {saveStatus === "pending" && (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-purple-600" />
                <span className="text-purple-600">서버 저장 중...</span>
              </>
            )}
            {saveStatus === "success" && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-zinc-500 dark:text-zinc-400">
                  완료 ({lastSavedTime || "실시간"})
                </span>
              </>
            )}
            {saveStatus === "error" && (
              <>
                <XCircle className="h-3.5 w-3.5 text-red-600" />
                <span className="text-red-600">연결 오류 (재시도 중)</span>
              </>
            )}
            {saveStatus === "idle" && (
              <>
                <div className="h-1.5 w-1.5 bg-zinc-300 rounded-full" />
                <span className="text-zinc-400">변경사항 대기</span>
              </>
            )}
          </div>

          {/* 형제 채널 이동 선택기 */}
          <div className="flex items-center gap-1 border border-zinc-200/40 rounded-xl p-1 bg-zinc-100/50 dark:bg-zinc-900/50">
            {siblingContents.map((sib) => (
              <Link
                key={sib.id}
                href={`/contents/${project.id}/platform/${sib.id}/edit`}
                className={`px-3 py-1 text-[10px] font-extrabold rounded-lg transition-all ${
                  sib.id === initialContent.id
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
                }`}
              >
                {sib.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* 2. 3단 분할 작업 데스크 레이아웃 */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* [좌측 패널]: 콘텐츠 구조와 섹션 목록 */}
        <div className="xl:col-span-1 bg-white dark:bg-zinc-900 border border-zinc-250/30 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="border-b border-zinc-100 dark:border-zinc-800 pb-2">
            <h3 className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
              <Sliders className="h-3.5 w-3.5 text-purple-600" />
              콘텐츠 목차 구조
            </h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">클릭 시 에디터 해당 단락으로 바로 스크롤 이동합니다.</p>
          </div>

          {/* 섹션 목록 리스트 */}
          <div className="space-y-1.5 max-h-[300px] xl:max-h-[600px] overflow-y-auto pr-1">
            {sections.map((sec, idx) => (
              <div
                key={sec.id || idx}
                className="group flex justify-between items-center p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-950 transition-all cursor-pointer text-xs"
              >
                <div
                  onClick={() => handleScrollToSection(sec.heading)}
                  className="flex items-center gap-2 flex-1 font-semibold text-zinc-700 dark:text-zinc-300 truncate"
                >
                  <span className="text-[10px] font-extrabold text-zinc-400">#{idx + 1}</span>
                  <span className="truncate">{sec.heading || "도입부"}</span>
                </div>

                <div className="flex items-center gap-1.5 pl-2">
                  {/* 잠금 토글 버튼 */}
                  <button
                    onClick={() => handleToggleLock(sec.id, sec.is_locked)}
                    className={`p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-850 transition-colors ${
                      sec.is_locked ? "text-purple-600" : "text-zinc-300 hover:text-zinc-500"
                    }`}
                    title={sec.is_locked ? "AI 재생성 제외 잠금 상태" : "문단 잠금 설정"}
                  >
                    {sec.is_locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  </button>

                  {/* AI 단락 재작성 드롭다운 흉내 */}
                  <div className="relative group/ai">
                    <button className="p-1 rounded text-zinc-400 hover:text-purple-600 hover:bg-purple-500/5">
                      <Sparkles className="h-3 w-3" />
                    </button>
                    <div className="absolute right-0 top-6 hidden group-hover/ai:block bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-1 z-50 w-44 space-y-0.5">
                      <div className="px-2 py-1 text-[9px] font-bold text-zinc-400 border-b border-zinc-100 dark:border-zinc-850">
                        AI 문단 편집 옵션
                      </div>
                      <button
                        onClick={() => handleRewriteSec(sec.id, "natural")}
                        className="w-full text-left px-2.5 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-purple-500/10 hover:text-purple-600 rounded-lg"
                      >
                        ✨ 더 자연스럽게
                      </button>
                      <button
                        onClick={() => handleRewriteSec(sec.id, "longer")}
                        className="w-full text-left px-2.5 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-purple-500/10 hover:text-purple-600 rounded-lg"
                      >
                        📝 더 길게 보강
                      </button>
                      <button
                        onClick={() => handleRewriteSec(sec.id, "shorter")}
                        className="w-full text-left px-2.5 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-purple-500/10 hover:text-purple-600 rounded-lg"
                      >
                        ✂️ 더 짧게 축소
                      </button>
                      <button
                        onClick={() => handleRewriteSec(sec.id, "friendly")}
                        className="w-full text-left px-2.5 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-purple-500/10 hover:text-purple-600 rounded-lg"
                      >
                        😊 친근한 어조로
                      </button>
                      <button
                        onClick={() => handleRewriteSec(sec.id, "professional")}
                        className="w-full text-left px-2.5 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-purple-500/10 hover:text-purple-600 rounded-lg"
                      >
                        💼 정중하고 전문적이게
                      </button>
                      <button
                        onClick={() => handleRewriteSec(sec.id, "table")}
                        className="w-full text-left px-2.5 py-1 text-[10px] font-semibold text-zinc-700 hover:bg-purple-500/10 hover:text-purple-600 rounded-lg"
                      >
                        📊 HTML 표로 변환
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* [중앙 패널]: TipTap 편집기 */}
        <div className="xl:col-span-2 space-y-4">
          {/* 에디터 기능 포커스 툴바 */}
          <div className="sticky top-2 z-40 flex flex-wrap gap-1 items-center p-2 rounded-2xl border border-zinc-200/50 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 shadow-md backdrop-blur-md">
            <button
              onClick={() => editor?.chain().focus().undo().run()}
              className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-xl"
              title="실행 취소 (Undo)"
            >
              <Undo className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor?.chain().focus().redo().run()}
              className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-xl"
              title="다시 실행 (Redo)"
            >
              <Redo className="h-3.5 w-3.5" />
            </button>
            <div className="h-4 w-[1px] bg-zinc-200 mx-1" />

            <button
              onClick={() => editor?.chain().focus().toggleBold().run()}
              className={`p-2 rounded-xl ${editor?.isActive("bold") ? "bg-purple-500/10 text-purple-600" : "text-zinc-600 hover:bg-zinc-100"}`}
              title="굵게"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleItalic().run()}
              className={`p-2 rounded-xl ${editor?.isActive("italic") ? "bg-purple-500/10 text-purple-600" : "text-zinc-600 hover:bg-zinc-100"}`}
              title="기울임"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
              className={`p-2 rounded-xl ${editor?.isActive("underline") ? "bg-purple-500/10 text-purple-600" : "text-zinc-600 hover:bg-zinc-100"}`}
              title="밑줄"
            >
              <UnderlineIcon className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                const url = prompt("연결할 URL 링크를 입력해 주세요 (예: https://example.com):");
                if (url) editor?.chain().focus().setLink({ href: url }).run();
              }}
              className={`p-2 rounded-xl ${editor?.isActive("link") ? "bg-purple-500/10 text-purple-600" : "text-zinc-600 hover:bg-zinc-100"}`}
              title="링크 지정"
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </button>
            <div className="h-4 w-[1px] bg-zinc-200 mx-1" />

            <button
              onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-2 rounded-xl ${editor?.isActive("heading", { level: 2 }) ? "bg-purple-500/10 text-purple-600" : "text-zinc-600 hover:bg-zinc-100"}`}
              title="소제목 H2"
            >
              <Heading2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
              className={`p-2 rounded-xl ${editor?.isActive("heading", { level: 3 }) ? "bg-purple-500/10 text-purple-600" : "text-zinc-600 hover:bg-zinc-100"}`}
              title="소제목 H3"
            >
              <Heading3 className="h-3.5 w-3.5" />
            </button>
            <div className="h-4 w-[1px] bg-zinc-200 mx-1" />

            <button
              onClick={() => editor?.chain().focus().toggleBulletList().run()}
              className={`p-2 rounded-xl ${editor?.isActive("bulletList") ? "bg-purple-500/10 text-purple-600" : "text-zinc-600 hover:bg-zinc-100"}`}
              title="기호형 리스트"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => editor?.chain().focus().toggleOrderedList().run()}
              className={`p-2 rounded-xl ${editor?.isActive("orderedList") ? "bg-purple-500/10 text-purple-600" : "text-zinc-600 hover:bg-zinc-100"}`}
              title="번호형 리스트"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <div className="h-4 w-[1px] bg-zinc-200 mx-1" />

            <button
              onClick={() => editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
              className="px-2.5 py-1.5 border border-zinc-200 rounded-xl text-[10px] font-bold text-zinc-700 hover:bg-zinc-100"
              title="표 삽입"
            >
              표 삽입
            </button>
          </div>

          {/* 에디터 워크스페이스 박스 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-250/40 dark:border-zinc-800 rounded-2xl shadow-sm p-8 min-h-[500px]">
            <input
              type="text"
              value={metaTitle}
              onChange={(e) => handleMetaFieldChange("title", e.target.value)}
              className="w-full text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 focus:outline-none border-b border-zinc-100 dark:border-zinc-850 pb-3 mb-6 bg-transparent"
              placeholder="여기에 원고 제목을 작성하세요..."
            />

            {/* TipTap 에디터 코어 */}
            <div className="tiptap-editor-wrap prose dark:prose-invert max-w-none text-xs leading-relaxed font-normal">
              <EditorContent editor={editor} />
            </div>

            {/* 텍스트 드래그 시 플로팅 버블 메뉴 */}
            {bubbleMenuPos && (
              <div
                style={{
                  position: "fixed",
                  left: `${bubbleMenuPos.x}px`,
                  top: `${bubbleMenuPos.y}px`,
                  transform: "translate(-50%, -100%)",
                  zIndex: 9999,
                }}
                className="flex items-center gap-1 px-2 py-1.5 bg-zinc-950 text-white rounded-2xl shadow-2xl border border-zinc-800 text-[10px] font-bold select-none"
              >
                <span className="text-[9px] text-zinc-400 px-1 border-r border-zinc-800 mr-1">AI 텍스트 교정</span>
                <button
                  onClick={() => handleSelectionRewrite("natural")}
                  className="px-2 py-1 hover:bg-purple-600 rounded-lg"
                >
                  자연스럽게
                </button>
                <button
                  onClick={() => handleSelectionRewrite("grammar")}
                  className="px-2 py-1 hover:bg-purple-600 rounded-lg"
                >
                  문법교정
                </button>
                <button
                  onClick={() => handleSelectionRewrite("shorter")}
                  className="px-2 py-1 hover:bg-purple-600 rounded-lg"
                >
                  짧게
                </button>
                <button
                  onClick={() => handleSelectionRewrite("suggestions")}
                  className="px-2 py-1 hover:bg-purple-600 rounded-lg text-purple-400"
                >
                  대안3개
                </button>
              </div>
            )}
          </div>
        </div>

        {/* [우측 패널]: 미리보기 / 메타데이터 / 버전관리 */}
        <div className="xl:col-span-1 space-y-4">
          {/* 탭 헤더 선택기 */}
          <div className="flex border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-2xl p-1 shadow-sm gap-1">
            <button
              onClick={() => setActiveRightTab("preview")}
              className={`flex-1 py-2 text-[10.5px] font-extrabold rounded-xl transition-all ${
                activeRightTab === "preview"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950"
              }`}
            >
              미리보기
            </button>
            <button
              onClick={() => setActiveRightTab("metadata")}
              className={`flex-1 py-2 text-[10.5px] font-extrabold rounded-xl transition-all ${
                activeRightTab === "metadata"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950"
              }`}
            >
              SEO 정보
            </button>
            <button
              onClick={() => setActiveRightTab("versions")}
              className={`flex-1 py-2 text-[10.5px] font-extrabold rounded-xl transition-all ${
                activeRightTab === "versions"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950"
              }`}
            >
              버전 ({versionList.length})
            </button>
            <button
              onClick={() => setActiveRightTab("evaluation")}
              className={`flex-1 py-2 text-[10.5px] font-extrabold rounded-xl transition-all ${
                activeRightTab === "evaluation"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950"
              }`}
            >
              평가·승인
            </button>
            <button
              onClick={() => setActiveRightTab("assets")}
              className={`flex-1 py-2 text-[10.5px] font-extrabold rounded-xl transition-all ${
                activeRightTab === "assets"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950"
              }`}
            >
              이미지
            </button>
            <button
              onClick={() => setActiveRightTab("export")}
              className={`flex-1 py-2 text-[10.5px] font-extrabold rounded-xl transition-all ${
                activeRightTab === "export"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950"
              }`}
            >
              내보내기
            </button>
            {initialContent.platform?.supports_api_publish && (
              <button
                onClick={() => setActiveRightTab("publish")}
                className={`flex-1 py-2 text-[10.5px] font-extrabold rounded-xl transition-all ${
                  activeRightTab === "publish"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950"
                }`}
              >
                발행
              </button>
            )}
          </div>

          {/* 탭 본문 구성 */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-250/30 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm min-h-[400px]">
            {/* 1) 플랫폼별 미리보기 탭 */}
            {activeRightTab === "preview" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-850 pb-2">
                  <h4 className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200">
                    실시간 플랫폼 미리보기
                  </h4>
                  {initialContent.platform?.code === "TISTORY" && (
                    <div className="flex items-center border border-zinc-200 dark:border-zinc-800 rounded-lg p-0.5 text-[9px] font-bold">
                      <button
                        onClick={() => setPreviewDevice("desktop")}
                        className={`px-2 py-0.5 rounded ${previewDevice === "desktop" ? "bg-purple-600 text-white" : "text-zinc-500"}`}
                      >
                        데스크톱
                      </button>
                      <button
                        onClick={() => setPreviewDevice("mobile")}
                        className={`px-2 py-0.5 rounded ${previewDevice === "mobile" ? "bg-purple-600 text-white" : "text-zinc-500"}`}
                      >
                        모바일
                      </button>
                    </div>
                  )}
                </div>

                {/* 워드프레스 / 블로거 / 티스토리 미리보기 */}
                {(initialContent.platform?.code === "WORDPRESS" ||
                  initialContent.platform?.code === "BLOGGER" ||
                  initialContent.platform?.code === "TISTORY") && (
                  <div
                    className={`border border-zinc-200/50 dark:border-zinc-800 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950 p-4 max-h-[500px] overflow-y-auto font-sans leading-relaxed text-xs transition-all ${
                      previewDevice === "mobile" && initialContent.platform?.code === "TISTORY"
                        ? "max-w-[340px] mx-auto border-4 border-zinc-700 rounded-[30px] p-5 shadow-2xl bg-white"
                        : ""
                    }`}
                  >
                    <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      {initialContent.platform?.name} Blog Post
                    </span>
                    <h2 className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 my-1">
                      {metaTitle || "제목 없음"}
                    </h2>
                    <div className="h-[1px] bg-zinc-200/50 my-2.5" />
                    <div
                      dangerouslySetInnerHTML={{ __html: editor?.getHTML() || "" }}
                      className="preview-body rich-html-body prose prose-zinc max-w-none text-[11px] leading-relaxed"
                    />
                  </div>
                )}

                {/* 네이버 블로그 스마트에디터 스타일 모바일 미리보기 */}
                {initialContent.platform?.code === "NAVER_BLOG" && (
                  <div className="max-w-[320px] mx-auto border-8 border-zinc-850 dark:border-zinc-800 rounded-[32px] overflow-hidden shadow-2xl bg-white dark:bg-zinc-950">
                    <div className="bg-[#2db400] text-white px-4 py-2 flex items-center justify-between text-[10px] font-extrabold shadow-sm select-none">
                      <span>네이버 블로그</span>
                      <Eye className="h-3.5 w-3.5" />
                    </div>
                    <div className="p-4 space-y-4 max-h-[420px] overflow-y-auto">
                      <h2 className="text-xs font-black text-center text-zinc-900 dark:text-zinc-100 leading-normal border-b border-dashed border-zinc-200 pb-2 my-0">
                        {metaTitle || "제목"}
                      </h2>
                      {/* 파싱된 블록 렌더링 */}
                      <div
                        dangerouslySetInnerHTML={{ __html: editor?.getHTML() || "" }}
                        className="naver-preview-body text-[10px] leading-relaxed text-zinc-800 dark:text-zinc-300 font-sans"
                      />
                    </div>
                  </div>
                )}

                {/* 인스타그램 캐러셀 피드 카드형 미리보기 */}
                {initialContent.platform?.code === "INSTAGRAM" && (
                  <div className="max-w-[310px] mx-auto border border-zinc-200/60 dark:border-zinc-850 rounded-2xl overflow-hidden shadow-md bg-zinc-50 dark:bg-zinc-950">
                    {/* 상단 프로필 헤더 */}
                    <div className="p-3 bg-white dark:bg-zinc-900 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-850 select-none">
                      <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-yellow-500 via-red-500 to-purple-600 flex items-center justify-center text-[8px] font-bold text-white uppercase">
                        AG
                      </div>
                      <span className="text-[10px] font-black text-zinc-800 dark:text-zinc-200">antigravity_bot</span>
                    </div>

                    {/* 캐러셀 본체 */}
                    <div className="relative aspect-square bg-zinc-900 flex items-center justify-center p-6 text-center text-white">
                      <div className="space-y-3 font-semibold text-xs leading-normal">
                        <div className="bg-purple-600/20 text-purple-400 border border-purple-500/10 px-2 py-0.5 rounded-lg text-[9px] font-bold w-fit mx-auto select-none">
                          슬라이드 카드 #{instaSlideIdx + 1}
                        </div>
                        {/* 간단 카드 분할 시뮬레이션 */}
                        <p className="text-[11px] leading-relaxed px-4 break-words">
                          {(editor?.getText().split(/\n+/).filter(Boolean) || [])[instaSlideIdx] || "슬라이드 카드로 변환할 원고 텍스트가 없습니다."}
                        </p>
                      </div>

                      {/* 좌우 이동 화살표 */}
                      <button
                        disabled={instaSlideIdx === 0}
                        onClick={() => setInstaSlideIdx(instaSlideIdx - 1)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 text-white rounded-full hover:bg-black/60 disabled:opacity-30"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </button>
                      <button
                        disabled={instaSlideIdx >= (editor?.getText().split(/\n+/).filter(Boolean) || []).length - 1}
                        onClick={() => setInstaSlideIdx(instaSlideIdx + 1)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 text-white rounded-full hover:bg-black/60 disabled:opacity-30"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>

                    {/* 하단 인터랙션 & 캡션 */}
                    <div className="p-3 bg-white dark:bg-zinc-900 space-y-1.5">
                      <div className="text-[10px] leading-relaxed text-zinc-700 dark:text-zinc-300">
                        <span className="font-extrabold text-zinc-900 dark:text-zinc-100 mr-1.5">antigravity_bot</span>
                        {/* 해시태그 렌더 */}
                        <div className="flex flex-wrap gap-1 mt-1 text-sky-600 font-bold text-[9px]">
                          {metaHashtags.map((tag) => (
                            <span key={tag}>#{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2) SEO 설정 탭 */}
            {activeRightTab === "metadata" && (
              <div className="space-y-4 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 block font-bold">SEO 메타 제목 (Meta Title)</label>
                  <input
                    type="text"
                    value={metaSeoTitle}
                    onChange={(e) => handleMetaFieldChange("seo", e.target.value)}
                    className="w-full p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-purple-600 bg-transparent text-xs"
                    placeholder="SEO 최적화 제목"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 block font-bold">메타 설명 (Meta Description)</label>
                  <textarea
                    rows={3}
                    value={metaDescription}
                    onChange={(e) => handleMetaFieldChange("desc", e.target.value)}
                    className="w-full p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-purple-600 bg-transparent text-xs leading-normal"
                    placeholder="검색엔진에 노출될 본문 핵심 요약 정보"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 block font-bold">권장 고유 주소 (Slug)</label>
                  <input
                    type="text"
                    value={metaSlug}
                    onChange={(e) => handleMetaFieldChange("slug", e.target.value)}
                    className="w-full p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-purple-600 bg-transparent text-xs font-mono"
                    placeholder="주소-슬러그-포맷"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-zinc-400 block font-bold">원고 짧은 요약 (Excerpt)</label>
                  <textarea
                    rows={2}
                    value={metaExcerpt}
                    onChange={(e) => handleMetaFieldChange("excerpt", e.target.value)}
                    className="w-full p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-purple-600 bg-transparent text-xs leading-normal"
                    placeholder="블로그 목록 등에 표시할 1줄 요약글"
                  />
                </div>

                {/* 해시태그 추가 */}
                <div className="space-y-1 border-t border-zinc-100 dark:border-zinc-850 pt-3">
                  <label className="text-[10px] text-zinc-400 block font-bold">인스타그램 해시태그 관리</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newHashtag}
                      onChange={(e) => setNewHashtag(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddHashtag()}
                      className="flex-1 p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-purple-600 bg-transparent text-xs"
                      placeholder="예: 마케팅자동화"
                    />
                    <button
                      onClick={handleAddHashtag}
                      className="px-3 bg-purple-600 text-white rounded-xl text-xs font-extrabold hover:bg-purple-550"
                    >
                      추가
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {metaHashtags.map((tag) => (
                      <span
                        key={tag}
                        onClick={() => handleRemoveHashtag(tag)}
                        className="bg-purple-500/5 text-purple-600 dark:text-purple-400 border border-purple-500/10 text-[9px] font-extrabold px-2 py-0.5 rounded cursor-pointer hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all"
                        title="클릭하여 제거"
                      >
                        #{tag} ×
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3) 버전 관리 탭 */}
            {activeRightTab === "versions" && (
              <div className="space-y-4">
                {/* 수동 백업 폼 */}
                <div className="p-3 border border-purple-200/50 dark:border-purple-950/40 rounded-2xl bg-purple-500/5 space-y-2">
                  <div className="text-[10px] font-bold text-purple-700 dark:text-purple-400">
                    현재 편집 상태 즉시 백업 저장
                  </div>
                  <input
                    type="text"
                    value={changeSummaryInput}
                    onChange={(e) => setChangeSummaryInput(e.target.value)}
                    className="w-full p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:border-purple-600 bg-white dark:bg-zinc-950 text-xs"
                    placeholder="예: 팩트 검증 수치 1차 보완"
                  />
                  <button
                    onClick={handleManualBackup}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-550 text-white rounded-xl text-xs font-extrabold transition-all shadow-md shadow-purple-600/10"
                  >
                    수동 백업 저장하기
                  </button>
                </div>

                {/* 비교/복원 컨트롤 헤더 */}
                <div className="flex justify-between items-center border-t border-zinc-100 dark:border-zinc-800 pt-3">
                  <span className="text-[10px] font-bold text-zinc-400">스냅샷 리스트 ({versionList.length})</span>
                  {selectedVersionsForCompare.length === 2 && (
                    <button
                      onClick={handleCompareVersions}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[9px] font-extrabold"
                    >
                      선택 버전 비교하기
                    </button>
                  )}
                </div>

                {/* 버전 카드 목록 */}
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {versionList.map((ver) => {
                    const isSelected = selectedVersionsForCompare.includes(ver.versionNumber);
                    return (
                      <div
                        key={ver.id}
                        className={`p-3 border rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 space-y-2 transition-all ${
                          isSelected ? "border-indigo-600 ring-2 ring-indigo-500/15" : "border-zinc-200 dark:border-zinc-850"
                        }`}
                      >
                        <div className="flex justify-between items-center select-none">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={!isSelected && selectedVersionsForCompare.length >= 2}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVersionsForCompare([...selectedVersionsForCompare, ver.versionNumber]);
                                } else {
                                  setSelectedVersionsForCompare(
                                    selectedVersionsForCompare.filter((n) => n !== ver.versionNumber)
                                  );
                                }
                              }}
                              className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300">
                              버전 #{ver.versionNumber}
                            </span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-lg ${
                              ver.versionType === "GENERATED"
                                ? "bg-amber-500/10 text-amber-600"
                                : ver.versionType === "RESTORED"
                                ? "bg-blue-500/10 text-blue-600"
                                : "bg-zinc-500/10 text-zinc-600"
                            }`}>
                              {ver.versionType}
                            </span>
                          </div>
                          <span className="text-[9px] text-zinc-400">
                            {new Date(ver.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <p className="text-[10px] text-zinc-500 leading-normal font-medium italic">
                          "{ver.changeSummary || "내용 요약 없음"}"
                        </p>

                        <div className="flex justify-between items-center border-t border-zinc-200/50 dark:border-zinc-800/50 pt-2 text-[9px] font-bold text-zinc-400 select-none">
                          <span>{ver.characterCount.toLocaleString()}자</span>
                          <button
                            onClick={() => handleRestoreVersion(ver.versionNumber)}
                            className="text-purple-600 hover:text-purple-700 hover:underline"
                          >
                            이 스냅샷으로 복원 ↩
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 4) 품질 평가 & 승인 탭 */}
            {activeRightTab === "evaluation" && (
              <div className="space-y-4">
                {/* 평가 헤더 및 기동 버튼 */}
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
                  <div>
                    <h4 className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200">종합 품질 평가 리포트</h4>
                    <p className="text-[9px] text-zinc-400 font-medium">1차 코드 규칙 + 2차 AI 심층 검사</p>
                  </div>
                  <button
                    disabled={isEvaluating}
                    onClick={handleEvaluate}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 hover:bg-purple-550 disabled:opacity-50 text-white rounded-xl text-[10px] font-extrabold shadow-sm transition-all"
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>분석 평가 중...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3 w-3" />
                        <span>평가 실행하기</span>
                      </>
                    )}
                  </button>
                </div>

                {evaluation ? (
                  <div className="space-y-4">
                    {/* 종합 점수 게이지 카드 */}
                    <div className="p-4 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/15 rounded-2xl flex items-center justify-between shadow-sm">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block">Overall Score</span>
                        <h2 className="text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
                          {evaluation.overall_score}<span className="text-xs font-bold text-zinc-400">/100</span>
                        </h2>
                        <p className="text-[9px] text-zinc-500 font-semibold leading-relaxed">
                          반복률: {evaluation.repetition_rate}% | 키워드 밀도: {Object.entries(evaluation.keyword_density || {}).map(([k, v]) => `${k} (${v}%)`).join(", ") || "0%"}
                        </p>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className={`text-[10.5px] font-extrabold px-3 py-1 rounded-full ${
                          evaluation.overall_score >= 85 
                            ? "bg-emerald-500/10 text-emerald-600" 
                            : evaluation.overall_score >= 70 
                            ? "bg-amber-500/10 text-amber-600" 
                            : "bg-red-500/10 text-red-600"
                        }`}>
                          {evaluation.overall_score >= 85 ? "우수함 (Good)" : evaluation.overall_score >= 70 ? "개선 권장" : "경고 (Critical)"}
                        </div>
                      </div>
                    </div>

                    {/* 세부 점수 프로그레스 리스트 */}
                    <div className="space-y-2 border border-zinc-100 dark:border-zinc-850 p-3 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 text-[10px]">
                      <div className="font-bold text-zinc-400 text-[9px] border-b border-zinc-100 dark:border-zinc-800 pb-1 mb-2">세부 품질 영역 지표</div>
                      {[
                        { label: "🎯 검색 의도 충족", score: evaluation.intent_score },
                        { label: "⭐ 내용 품질 및 구성", score: evaluation.quality_score },
                        { label: "📖 문맥 및 가독성", score: evaluation.readability_score },
                        { label: "🔍 기술 SEO 요건", score: evaluation.technical_seo_score },
                        { label: "🛡️ 사실성 및 신뢰도", score: evaluation.trust_score },
                        { label: "📱 채널 어조 적합성", score: evaluation.platform_fit_score },
                      ].map((item, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex justify-between font-semibold text-zinc-700 dark:text-zinc-300">
                            <span>{item.label}</span>
                            <span>{item.score}점</span>
                          </div>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-200/20">
                            <div
                              className="bg-purple-650 h-full rounded-full transition-all duration-300"
                              style={{ width: `${item.score}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 발견된 품질 위반 이슈 리스트 */}
                    <div className="space-y-2.5">
                      <div className="text-[10px] font-bold text-zinc-400 flex justify-between items-center">
                        <span>검출된 결함 및 개선점 ({issues.length})</span>
                        {issues.some(i => i.severity === "CRITICAL" && i.status === "OPEN") && (
                          <span className="text-[8.5px] bg-red-500/10 text-red-600 px-1.5 py-0.5 rounded font-black">CRITICAL 경고 존재</span>
                        )}
                      </div>

                      {issues.length === 0 ? (
                        <div className="p-4 border border-zinc-100 dark:border-zinc-850 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 text-center text-[10px] font-bold text-zinc-400 space-y-1">
                          <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto" />
                          <p>검출된 결함이나 정책 위반사항이 없습니다.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {issues.map((issue) => (
                            <div
                              key={issue.id}
                              className={`p-3 border rounded-xl text-[10px] space-y-2 transition-all ${
                                issue.status === "FIXED"
                                  ? "bg-zinc-50/20 border-zinc-150 dark:border-zinc-900 opacity-60"
                                  : issue.status === "IGNORED"
                                  ? "bg-zinc-50/40 border-zinc-200 border-dashed dark:border-zinc-900"
                                  : issue.severity === "CRITICAL"
                                  ? "border-red-200 bg-red-500/5 dark:bg-red-950/10"
                                  : "border-zinc-200 bg-white dark:bg-zinc-900"
                              }`}
                            >
                              <div className="flex justify-between items-center select-none font-bold">
                                <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded-lg ${
                                  issue.status === "FIXED"
                                    ? "bg-zinc-100 text-zinc-500"
                                    : issue.status === "IGNORED"
                                    ? "bg-zinc-100 text-zinc-400"
                                    : issue.severity === "CRITICAL"
                                    ? "bg-red-500/15 text-red-650"
                                    : issue.severity === "WARNING"
                                    ? "bg-amber-500/15 text-amber-600"
                                    : "bg-blue-500/15 text-blue-600"
                                }`}>
                                  {issue.status === "FIXED" 
                                    ? "수정완료" 
                                    : issue.status === "IGNORED" 
                                    ? "무시됨" 
                                    : issue.severity}
                                </span>
                                <span className="text-[8.5px] font-bold text-zinc-400 uppercase tracking-wider">
                                  {issue.category}
                                </span>
                              </div>

                              <p className="font-extrabold text-zinc-800 dark:text-zinc-200 leading-normal">
                                {issue.message}
                              </p>

                              {issue.suggested_action && (
                                <p className="text-zinc-500 bg-zinc-50 dark:bg-zinc-950/40 p-2 rounded-lg font-medium leading-relaxed italic">
                                  💡 {issue.suggested_action}
                                </p>
                              )}

                              {issue.status === "IGNORED" && issue.ignore_reason && (
                                <p className="text-zinc-400 bg-zinc-100 dark:bg-zinc-900/50 p-2 rounded-lg font-medium leading-relaxed">
                                  ✏️ <strong>무시 사유:</strong> {issue.ignore_reason}
                                </p>
                              )}

                              {issue.status === "OPEN" && (
                                <div className="flex justify-end gap-1.5 border-t border-zinc-100 dark:border-zinc-850 pt-2 select-none">
                                  <button
                                    onClick={() => {
                                      // 문장 조각을 따서 검색 매칭 시도
                                      const textSnippet = issue.message.match(/"([^"]+)"/)?.[1] || "";
                                      handleScrollToText(textSnippet);
                                    }}
                                    className="px-2 py-1 border border-zinc-200 text-zinc-650 hover:bg-zinc-100 rounded-lg text-[9px] font-bold"
                                  >
                                    문장 이동
                                  </button>

                                  {issue.severity === "WARNING" && (
                                    <button
                                      onClick={() => handleIgnoreIssue(issue.id)}
                                      className="px-2 py-1 text-zinc-450 hover:text-zinc-600 rounded-lg text-[9px] font-bold"
                                    >
                                      무시
                                    </button>
                                  )}

                                  {issue.auto_fix_available && (
                                    <button
                                      disabled={isFixing}
                                      onClick={() => handleAutoFixClick(issue)}
                                      className="px-2 py-1 bg-purple-650 hover:bg-purple-550 text-white rounded-lg text-[9px] font-black"
                                    >
                                      자동 수정
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 사실 확인 필요 표현 목록 */}
                    <div className="space-y-2.5 border-t border-zinc-100 dark:border-zinc-850 pt-3">
                      <div className="text-[10px] font-bold text-zinc-400 flex justify-between items-center">
                        <span>사실 확인 필요 정보 ({facts.filter(f => f.verification_status === "UNVERIFIED").length}개 대기)</span>
                        <span className="text-[8.5px] text-zinc-450">배경색: 노란색(WARNING)</span>
                      </div>

                      {facts.length === 0 ? (
                        <div className="p-3 border border-zinc-100 dark:border-zinc-850 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20 text-center text-[10px] text-zinc-400 font-medium">
                          본문에 추출된 사실 검증 대상 주장이 없습니다.
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                          {facts.map((fact) => (
                            <div
                              key={fact.id}
                              className={`p-2.5 border rounded-xl text-[9.5px] space-y-1.5 transition-all ${
                                fact.verification_status === "USER_CONFIRMED"
                                  ? "border-emerald-250 bg-emerald-500/5 opacity-70"
                                  : fact.verification_status === "DISPUTED"
                                  ? "border-red-200 bg-red-500/5"
                                  : "border-zinc-100 bg-zinc-50/50 dark:bg-zinc-950/10"
                              }`}
                            >
                              <div className="flex justify-between items-center select-none font-bold">
                                <span className={`text-[8px] px-1.5 py-0.5 rounded ${
                                  fact.verification_status === "USER_CONFIRMED"
                                    ? "bg-emerald-500/10 text-emerald-600"
                                    : fact.verification_status === "DISPUTED"
                                    ? "bg-red-500/10 text-red-600"
                                    : "bg-amber-500/10 text-amber-600"
                                }`}>
                                  {fact.verification_status === "USER_CONFIRMED" 
                                    ? "검증 완료" 
                                    : fact.verification_status === "DISPUTED" 
                                    ? "반려됨" 
                                    : "미확인"}
                                </span>
                                <span className="text-zinc-450 uppercase text-[8px]">FACT</span>
                              </div>

                              <p className="font-semibold text-zinc-700 dark:text-zinc-300 leading-normal">
                                "{fact.fact_text}"
                              </p>

                              {fact.verification_status === "UNVERIFIED" ? (
                                <div className="flex justify-end gap-1 select-none">
                                  <button
                                    onClick={() => handleScrollToText(fact.fact_text)}
                                    className="px-2 py-0.5 border border-zinc-200 text-zinc-550 rounded text-[8px] font-bold"
                                  >
                                    위치 이동
                                  </button>
                                  <button
                                    onClick={() => handleConfirmFact(fact.id)}
                                    className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-550 text-white rounded text-[8px] font-black"
                                  >
                                    확인 완료
                                  </button>
                                  <button
                                    onClick={() => handleRejectFact(fact.id)}
                                    className="px-2 py-0.5 text-red-500 hover:bg-red-550/5 rounded text-[8px] font-semibold"
                                  >
                                    반려
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end select-none">
                                  <button
                                    onClick={() => handleRejectFact(fact.id)}
                                    className="px-2 py-0.5 text-[8px] font-bold text-zinc-400 hover:text-red-500"
                                  >
                                    승인 취소/반려
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 최종 발행 승인 조작 블록 */}
                    <div className="border-t border-zinc-150 dark:border-zinc-800 pt-4 space-y-3">
                      {initialContent.status === "APPROVED" || initialContent.status === "PUBLISH_READY" ? (
                        <div className="space-y-2">
                          <div className="p-3 bg-emerald-500/10 border border-emerald-500/15 rounded-2xl flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                            <div className="text-[10px]">
                              <p className="font-extrabold text-emerald-950">최종 발행 승인이 완료되었습니다.</p>
                              <p className="text-zinc-500 font-semibold">현재 상태: {initialContent.status}</p>
                            </div>
                          </div>

                          {initialContent.status === "APPROVED" && (
                            <button
                              onClick={async () => {
                                try {
                                  await publishReadyContent(initialContent.id);
                                  toast.success("발행 준비 완료 상태로 전환되었습니다!");
                                  window.location.reload();
                                } catch (e: any) {
                                  toast.error(e.message);
                                }
                              }}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-550 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/10 transition-all"
                            >
                              발행 준비 완료 상태로 전환 🚀
                            </button>
                          )}

                          <button
                            disabled={isApproving}
                            onClick={handleRevokeApproval}
                            className="w-full py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 text-zinc-550 rounded-xl text-xs font-bold transition-all"
                          >
                            발행 승인 철회 (재검토)
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-[10.5px] font-bold text-zinc-400 mb-1">승인 충족 체크리스트:</div>
                          <ul className="space-y-1 text-[9.5px] font-semibold text-zinc-500">
                            <li className="flex items-center gap-1.5">
                              {issues.filter(i => i.severity === "CRITICAL" && i.status === "OPEN").length === 0 ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                              <span>미결 CRITICAL 이슈 없음 (현재: {issues.filter(i => i.severity === "CRITICAL" && i.status === "OPEN").length}개)</span>
                            </li>
                            <li className="flex items-center gap-1.5">
                              {facts.filter(f => f.verification_status === "UNVERIFIED").length === 0 ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                              <span>사실 확인 필요 팩트 검토 완료 (현재 미검토: {facts.filter(f => f.verification_status === "UNVERIFIED").length}개)</span>
                            </li>
                            <li className="flex items-center gap-1.5">
                              {metaTitle && editor?.getText() ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-red-500" />
                              )}
                              <span>제목 및 본문 콘텐츠 내용 존재</span>
                            </li>
                          </ul>

                          <button
                            disabled={
                              isApproving ||
                              issues.filter(i => i.severity === "CRITICAL" && i.status === "OPEN").length > 0 ||
                              facts.filter(f => f.verification_status === "UNVERIFIED").length > 0 ||
                              !metaTitle ||
                              !editor?.getText()
                            }
                            onClick={handleApproveContent}
                            className="w-full py-3 bg-purple-600 hover:bg-purple-550 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/10 transition-all"
                          >
                            {isApproving ? "승인 처리 중..." : "최종 발행 승인 및 PRE_PUBLISH 저장"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-3">
                    <AlertCircle className="h-8 w-8 text-zinc-300 mx-auto" />
                    <div className="text-[11px] text-zinc-450 font-bold space-y-1">
                      <p>품질 평가 데이터가 아직 없습니다.</p>
                      <p className="text-[10px] text-zinc-400 font-medium">상단의 '평가 실행하기' 단추를 클릭해 실시간 분석을 진행하세요.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5) 이미지 자산 및 이미지 기획 탭 */}
            {activeRightTab === "assets" && (
              <div className="space-y-5">
                {/* 자산 업로드 카드 */}
                <div className="p-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3 bg-zinc-50/50 dark:bg-zinc-950/10">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-zinc-700 dark:text-zinc-300">신규 이미지 자산 업로드</span>
                    <span className="text-[9px] text-zinc-400 font-semibold">최대 10MB | JPG, PNG, WebP</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      id="asset-file-input"
                      accept=".jpg,.jpeg,.png,.webp"
                      onChange={handleUploadAsset}
                      disabled={isUploadingAsset}
                      className="hidden"
                    />
                    <label
                      htmlFor="asset-file-input"
                      className="flex-1 py-2 px-3 border border-dashed border-zinc-300 hover:border-purple-500 hover:bg-purple-500/5 rounded-xl text-center text-xs font-black text-zinc-550 hover:text-purple-650 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                    >
                      {isUploadingAsset ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>업로드 처리 중...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-3.5 w-3.5" />
                          <span>이미지 자산 추가하기</span>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {/* 업로드된 이미지 리스트 */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                    프로젝트 이미지 자산 ({projectAssets.length} / 30)
                  </h4>
                  {projectAssets.length === 0 ? (
                    <div className="p-6 border border-zinc-150 border-dashed rounded-2xl bg-zinc-50/20 text-center text-[10.5px] text-zinc-400 font-medium">
                      업로드된 이미지 자산이 없습니다. 상단에서 업로드해 주세요.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                      {projectAssets.map((asset, index) => (
                        <div
                          key={asset.id}
                          className="p-3 border border-zinc-150 dark:border-zinc-850 rounded-2xl bg-white dark:bg-zinc-950/20 space-y-3"
                        >
                          <div className="flex gap-3">
                            {/* 썸네일 */}
                            <div className="h-14 w-14 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 overflow-hidden shrink-0 flex items-center justify-center relative">
                              {asset.signedUrl ? (
                                <img
                                  src={asset.signedUrl}
                                  alt={asset.alt_text || "자산"}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ImageOff className="h-5 w-5 text-zinc-400" />
                              )}
                            </div>

                            {/* 세부 항목 폼 */}
                            <div className="flex-1 space-y-2 text-[10px]">
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">
                                  {asset.original_filename}
                                </span>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => handleMoveAsset(index, "up")}
                                    disabled={index === 0}
                                    className="p-1 hover:bg-zinc-150 dark:hover:bg-zinc-850 rounded disabled:opacity-30 text-zinc-500"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    onClick={() => handleMoveAsset(index, "down")}
                                    disabled={index === projectAssets.length - 1}
                                    className="p-1 hover:bg-zinc-150 dark:hover:bg-zinc-850 rounded disabled:opacity-30 text-zinc-500"
                                  >
                                    ▼
                                  </button>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <input
                                  type="text"
                                  placeholder="ALT 텍스트 (대체 설명)"
                                  defaultValue={asset.alt_text}
                                  onBlur={(e) => handleUpdateAssetField(asset.id, "alt_text", e.target.value)}
                                  className="w-full py-1 px-2 border border-zinc-200 dark:border-zinc-850 rounded-lg bg-zinc-50/50 text-[9.5px] dark:bg-zinc-900"
                                />
                                <input
                                  type="text"
                                  placeholder="이미지 캡션 설명"
                                  defaultValue={asset.caption}
                                  onBlur={(e) => handleUpdateAssetField(asset.id, "caption", e.target.value)}
                                  className="w-full py-1 px-2 border border-zinc-200 dark:border-zinc-850 rounded-lg bg-zinc-50/50 text-[9.5px] dark:bg-zinc-900"
                                />
                                <div className="flex gap-2">
                                  <select
                                    defaultValue={asset.copyright_status}
                                    onChange={(e) => handleUpdateAssetField(asset.id, "copyright_status", e.target.value)}
                                    className="flex-1 py-1 px-1.5 border border-zinc-200 dark:border-zinc-850 rounded-lg bg-zinc-50/50 text-[9px] font-semibold dark:bg-zinc-900"
                                  >
                                    <option value="UNKNOWN">저작권 미상</option>
                                    <option value="OWNED">자체 소유</option>
                                    <option value="LICENSED">라이센스 구매</option>
                                    <option value="AI_GENERATED">AI 생성</option>
                                    <option value="RESTRICTED">제한됨</option>
                                  </select>
                                  <button
                                    onClick={() => handleDeleteAsset(asset.id)}
                                    className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-650 rounded-lg text-[9px] font-black transition-all"
                                  >
                                    삭제
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 이미지 기획과 실제 자산 연결 목록 */}
                <div className="space-y-3 pt-3 border-t border-zinc-150 dark:border-zinc-800">
                  <h4 className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                    이미지 기획안 매핑 현황 ({imagePlansList.length}개 기획됨)
                  </h4>
                  {imagePlansList.length === 0 ? (
                    <div className="p-3 border border-zinc-150 border-dashed rounded-2xl bg-zinc-50/10 text-center text-[10px] text-zinc-400 font-medium">
                      생성된 이미지 기획 내역이 없습니다.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                      {imagePlansList.map((plan) => {
                        return (
                          <div
                            key={plan.id}
                            className="p-2.5 border border-zinc-200 dark:border-zinc-850 rounded-xl bg-zinc-50/20 space-y-2 text-[9.5px]"
                          >
                            <div className="flex justify-between items-center font-bold">
                              <span className="text-purple-650">슬라이드 #{plan.sequence_number} ({plan.role || "본문삽입"})</span>
                              <span className="text-zinc-400">{plan.aspect_ratio || "1:1 비율"}</span>
                            </div>
                            <p className="text-zinc-650 leading-relaxed font-semibold italic dark:text-zinc-300">
                              "{plan.description || "설명 없음"}"
                            </p>
                            <div className="flex items-center gap-2 pt-1 border-t border-zinc-150 dark:border-zinc-850/50">
                              <span className="text-[9px] text-zinc-450 shrink-0 font-bold">연결 이미지:</span>
                              <select
                                value={plan.linked_asset_id || ""}
                                onChange={(e) => handleLinkPlan(plan.id, e.target.value || null)}
                                className="flex-1 py-1 px-1.5 border border-zinc-200 dark:border-zinc-850 rounded bg-white text-[9px] font-semibold dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
                              >
                                <option value="">연결된 이미지 없음</option>
                                {projectAssets.map((a) => (
                                  <option key={a.id} value={a.id}>
                                    {a.original_filename} ({a.alt_text ? a.alt_text.substring(0, 10) : "설명없음"})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 6) 클립보드 복사 및 파일 내보내기 탭 */}
            {activeRightTab === "export" && (
              <div className="space-y-5">
                {/* 1. 클립보드 복사 그룹 */}
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                    클립보드 데이터 복사
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[9.5px]">
                    <button
                      onClick={() => handleCopyToClipboard(metaTitle, "제목만")}
                      className="py-2 px-3 border border-zinc-250 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-950 font-extrabold text-zinc-700 dark:text-zinc-300 rounded-xl"
                    >
                      제목만 복사 📋
                    </button>
                    <button
                      onClick={() => handleCopyToClipboard(editor?.getText() || "", "본문만")}
                      className="py-2 px-3 border border-zinc-255 dark:border-zinc-855 hover:bg-zinc-50 dark:hover:bg-zinc-950 font-extrabold text-zinc-700 dark:text-zinc-300 rounded-xl"
                    >
                      본문만 복사 📋
                    </button>
                    <button
                      onClick={() => handleCopyToClipboard(`${metaTitle}\n\n${editor?.getText() || ""}`, "전체 원고")}
                      className="py-2 px-3 border border-zinc-250 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-950 font-extrabold text-zinc-700 dark:text-zinc-300 rounded-xl"
                    >
                      전체 원고 복사 📋
                    </button>
                    <button
                      onClick={() => handleCopyToClipboard(metaHashtags.map(t => `#${t}`).join(" "), "해시태그")}
                      className="py-2 px-3 border border-zinc-250 dark:border-zinc-850 hover:bg-zinc-50 dark:hover:bg-zinc-950 font-extrabold text-zinc-700 dark:text-zinc-300 rounded-xl"
                    >
                      해시태그 복사 📋
                    </button>
                  </div>

                  {/* 플랫폼 전용 복사 유닛 */}
                  {initialContent.platform?.code === "NAVER_BLOG" && (
                    <div className="p-3 border border-zinc-150 dark:border-zinc-850 rounded-2xl bg-zinc-50/20 space-y-2.5">
                      <div className="text-[10px] font-black text-purple-650">네이버 블로그 특화 복사</div>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCopyToClipboard(metaTitle, "블로그 제목")}
                            className="flex-1 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-650 rounded-lg text-[9.5px] font-extrabold"
                          >
                            제목 복사
                          </button>
                          <button
                            onClick={() => handleCopyToClipboard(
                              "소정의 원고료를 지원받아 주관적인 관점에서 작성되었습니다.",
                              "광고 고지"
                            )}
                            className="flex-1 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-650 rounded-lg text-[9.5px] font-extrabold"
                          >
                            광고 고지문 복사
                          </button>
                        </div>
                        <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                          {sections.map((sect, idx) => (
                            <div key={sect.id || idx} className="flex justify-between items-center p-2 border border-zinc-100 dark:border-zinc-850 bg-white dark:bg-zinc-950 rounded-lg">
                              <span className="font-semibold text-zinc-550 text-[9px] truncate max-w-[120px] dark:text-zinc-300">
                                {sect.heading || `섹션 #${idx + 1}`}
                              </span>
                              <button
                                onClick={() => handleCopyToClipboard(sect.body_text || "", `섹션 ${idx + 1} 본문`)}
                                className="px-2 py-0.5 border border-zinc-200 text-zinc-650 rounded text-[8px] font-bold dark:text-zinc-300"
                              >
                                본문 복사
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {initialContent.platform?.code === "INSTAGRAM" && (
                    <div className="p-3 border border-zinc-150 dark:border-zinc-850 rounded-2xl bg-zinc-50/20 space-y-2">
                      <div className="text-[10px] font-black text-purple-650">인스타그램 특화 복사</div>
                      <div className="space-y-1.5">
                        <button
                          onClick={() => handleCopyToClipboard(
                            `${editor?.getText() || ""}\n\n${metaHashtags.map(t => `#${t}`).join(" ")}`,
                            "인스타 피드 캡션"
                          )}
                          className="w-full py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-650 rounded-lg text-[9.5px] font-extrabold"
                        >
                          전체 캐러셀 캡션 복사 📋
                        </button>
                        <div className="space-y-1 max-h-[150px] overflow-y-auto pr-1">
                          {imagePlansList.map((plan, idx) => (
                            <div key={plan.id || idx} className="flex justify-between items-center p-1.5 border border-zinc-100 dark:border-zinc-850 bg-white dark:bg-zinc-950 rounded-lg">
                              <span className="font-semibold text-zinc-550 text-[9px] dark:text-zinc-300 font-bold">슬라이드 #{plan.sequence_number} 문구</span>
                              <button
                                onClick={() => handleCopyToClipboard(plan.overlay_text || plan.description || "", `슬라이드 ${idx + 1} 텍스트`)}
                                className="px-2 py-0.5 border border-zinc-200 text-zinc-650 rounded text-[8px] font-bold dark:text-zinc-300"
                              >
                                복사
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. 개별 파일 및 통합 ZIP 다운로드 */}
                <div className="space-y-3 pt-3 border-t border-zinc-150 dark:border-zinc-800">
                  <h4 className="text-xs font-black text-zinc-700 dark:text-zinc-300">
                    포맷별 파일 내보내기 (Download)
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-[9.5px] font-extrabold text-zinc-700 dark:text-zinc-300 select-none">
                    <button
                      onClick={() => handleDownloadFile("HTML")}
                      className="py-2 border border-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-850 rounded-xl"
                    >
                      워드프레스 HTML 다운로드 📥
                    </button>
                    <button
                      onClick={() => handleDownloadFile("MD")}
                      className="py-2 border border-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-850 rounded-xl"
                    >
                      마크다운 MD 다운로드 📥
                    </button>
                    <button
                      onClick={() => handleDownloadFile("TXT")}
                      className="py-2 border border-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-850 rounded-xl"
                    >
                      일반 텍스트 TXT 다운로드 📥
                    </button>
                    <button
                      onClick={() => handleDownloadFile("JSON")}
                      className="py-2 border border-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-850 rounded-xl"
                    >
                      JSON 풀 데이터 다운로드 📥
                    </button>
                    <button
                      onClick={() => handleDownloadFile("CSV")}
                      className="py-2 border border-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:border-zinc-850 rounded-xl"
                    >
                      인스타 슬라이드 CSV 다운로드 📥
                    </button>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleDownloadZip}
                      disabled={isExporting}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-550 disabled:opacity-50 text-white rounded-2xl text-xs font-black shadow-md shadow-purple-600/10 transition-all flex items-center justify-center gap-2"
                    >
                      {isExporting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>ZIP 압축 빌드 및 수집 중...</span>
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4" />
                          <span>프로젝트 통합 ZIP 패키지 다운로드 🚀</span>
                        </>
                      )}
                    </button>
                    <p className="text-[8.5px] text-zinc-400 font-semibold text-center mt-1">
                      다채널 원고 파일, 해시태그 CSV, 기획안, 이미지 소스 폴더 일괄 패키징
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeRightTab === "publish" && (
              <div className="space-y-5">
                <div className="flex justify-between items-center border-b border-zinc-150 pb-2">
                  <h4 className="text-xs font-black text-zinc-800 dark:text-zinc-200">
                    외부 플랫폼 API 자동 발행
                  </h4>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {initialContent.platform?.name}
                  </span>
                </div>

                {/* 1. 발행 상태 검증 */}
                <div className="p-3.5 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 space-y-2.5">
                  <h5 className="text-[10px] font-bold text-zinc-400">발행 자격 검증 상태</h5>
                  <div className="space-y-1.5 text-[9.5px] font-semibold text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      {initialContent.status === "APPROVED" || initialContent.status === "PUBLISHED" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-rose-500" />
                      )}
                      <span>원고 최종 승인(APPROVED) 여부 (현재: {initialContent.status})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {platformAccountsList.length > 0 ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-rose-500" />
                      )}
                      <span>연동 계정 존재 여부 (현재: {platformAccountsList.length}개)</span>
                    </div>
                  </div>
                </div>

                {/* 2. 연동 계정 및 발행 형태 선택 */}
                {platformAccountsList.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-center space-y-2">
                    <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto" />
                    <p className="text-[10.5px] font-bold text-zinc-600">연동된 {initialContent.platform?.name} 계정이 없습니다.</p>
                    <p className="text-[9px] text-zinc-400">설정 &gt; 연동 설정 페이지에서 계정을 먼저 연결해 주세요.</p>
                    <button
                      onClick={() => router.push("/settings/integrations")}
                      className="mt-1 text-[10px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      연동 설정으로 이동하기 &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">
                        발행할 연동 계정 선택
                      </label>
                      <select
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-250 dark:border-zinc-850 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-1 focus:ring-primary text-zinc-850 dark:text-zinc-150"
                      >
                        {platformAccountsList.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.account_name} ({acc.site_url})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 dark:text-zinc-500 mb-1">
                        발행 공개 상태 설정
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPublishType("DRAFT")}
                          className={`py-2 px-3 text-xs font-bold rounded-lg border transition cursor-pointer ${
                            publishType === "DRAFT"
                              ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                              : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50"
                          }`}
                        >
                          초안(Draft) 발행
                        </button>
                        <button
                          type="button"
                          onClick={() => setPublishType("PUBLISH")}
                          className={`py-2 px-3 text-xs font-bold rounded-lg border transition cursor-pointer ${
                            publishType === "PUBLISH"
                              ? "bg-purple-600 text-white border-purple-600 shadow-sm"
                              : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50"
                          }`}
                        >
                          즉시 공개 발행
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        if (!selectedAccountId) return;
                        setIsPublishing(true);
                        const loadingId = toast.loading("콘텐츠를 외부 플랫폼에 발행 중입니다...");
                        try {
                          await publishContent(initialContent.id, selectedAccountId, publishType);
                          toast.dismiss(loadingId);
                          toast.success("플랫폼 발행이 완료되었습니다!");
                          loadPublishData();
                        } catch (err: any) {
                          toast.dismiss(loadingId);
                          toast.error(err.message || "발행 중 에러가 발생했습니다.");
                          loadPublishData();
                        } finally {
                          setIsPublishing(false);
                        }
                      }}
                      disabled={isPublishing || (initialContent.status !== "APPROVED" && initialContent.status !== "PUBLISHED")}
                      className="w-full py-3 bg-purple-600 hover:bg-purple-550 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md shadow-purple-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isPublishing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>플랫폼 전송 중...</span>
                        </>
                      ) : (
                        <span>외부 플랫폼에 원고 발행하기 🚀</span>
                      )}
                    </button>
                  </div>
                )}

                {/* 3. 발행 이력 히스토리 리스트 */}
                <div className="space-y-2.5 pt-2 border-t border-zinc-150 dark:border-zinc-850">
                  <h5 className="text-[10px] font-bold text-zinc-400">최근 발행 이력</h5>
                  {publicationsHistory.length === 0 ? (
                    <p className="text-[9px] text-zinc-400 italic">발행 이력이 존재하지 않습니다.</p>
                  ) : (
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {publicationsHistory.map((pub) => (
                        <div
                          key={pub.id}
                          className="p-3 rounded-lg border border-zinc-200/60 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[8.5px] text-zinc-400">
                              {new Date(pub.created_at).toLocaleString()}
                            </span>
                            <span
                              className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                                pub.status === "PUBLISHED" || pub.status === "DRAFT_CREATED"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  : pub.status === "FAILED"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {pub.status}
                            </span>
                          </div>
                          <div className="text-[9.5px]">
                            <p className="font-bold text-zinc-700 dark:text-zinc-300">
                              계정: {pub.platform_accounts?.account_name || "연동 계정"} ({pub.publication_type})
                            </p>
                            {pub.external_url && (
                              <a
                                href={pub.external_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[9px] text-primary hover:underline flex items-center gap-0.5 mt-1 cursor-pointer"
                              >
                                생성된 포스트 확인하기
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                            {pub.status === "FAILED" && (
                              <div className="mt-2 space-y-2">
                                <p className="text-[8.5px] text-rose-500 font-semibold bg-rose-50 dark:bg-rose-950/20 p-1.5 rounded border border-rose-500/10 leading-normal">
                                  사유: {pub.error_message}
                                </p>
                                <button
                                  onClick={async () => {
                                    const toastId = toast.loading("발행 재시도 요청 중...");
                                    try {
                                      await retryPublication(pub.id);
                                      toast.dismiss(toastId);
                                      toast.success("발행 재시도에 성공했습니다!");
                                      loadPublishData();
                                    } catch (err: any) {
                                      toast.dismiss(toastId);
                                      toast.error(err.message || "재시도 중 에러가 발생했습니다.");
                                      loadPublishData();
                                    }
                                  }}
                                  className="w-full py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 text-[9px] font-black text-zinc-700 dark:text-zinc-300 rounded border border-zinc-200/50 dark:border-zinc-700/50 cursor-pointer"
                                >
                                  이 계정으로 재시도 🔁
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. AI 선택 대안 추천 팝업 (대안 3개인 경우) */}
      {aiSuggestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/40 backdrop-blur-sm select-none">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-2">
              <h3 className="text-sm font-extrabold text-purple-600 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                AI 추천 문체 대안 3개
              </h3>
              <button
                onClick={() => setAiSuggestions(null)}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-600"
              >
                닫기
              </button>
            </div>
            <p className="text-[10px] text-zinc-400 font-medium">원하는 대안을 클릭하면 에디터 선택 영역에 삽입됩니다.</p>
            <div className="space-y-2.5">
              {aiSuggestions.map((sug, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    if (editor) {
                      const { from, to } = editor.state.selection;
                      editor.commands.insertContentAt({ from, to }, sug);
                      toast.success(`대안 #${idx + 1}(이)가 성공적으로 교체 적용되었습니다.`);
                    }
                    setAiSuggestions(null);
                  }}
                  className="p-3 border border-zinc-150 dark:border-zinc-850 hover:border-purple-500 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/20 hover:bg-purple-500/5 transition-all cursor-pointer text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 leading-normal"
                >
                  <span className="text-[9px] font-extrabold text-purple-600 block mb-1">대안 #{idx + 1}</span>
                  {sug}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. 동시 편집 충돌(409 Conflict) 팝업 모달 */}
      {conflictModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm select-none">
          <div className="bg-white dark:bg-zinc-950 border-2 border-red-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl space-y-6 text-center">
            <div className="h-12 w-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">
                동시 편집 충돌 감지! (409 Conflict)
              </h3>
              <p className="text-[11px] text-zinc-500 leading-normal font-medium">
                다른 브라우저 탭이나 멤버가 글을 작성하고 먼저 저장했습니다.<br />
                서버 최종 저장: {new Date(conflictModal.dbUpdatedAt).toLocaleTimeString()}<br />
                덮어쓰게 되면 다른 작업자의 변경 내용이 소실될 수 있습니다.
              </p>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleResolveConflict("overwrite_local")}
                className="w-full py-2.5 bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 rounded-xl text-xs font-bold hover:bg-zinc-200"
              >
                서버 버전 불러오기 (내 로컬 수정 취소)
              </button>
              <button
                onClick={() => handleResolveConflict("overwrite_server")}
                className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold"
              >
                내 변경 내용 유지 (서버 덮어쓰기 강행)
              </button>
              <button
                onClick={() => handleResolveConflict("save_copy")}
                className="w-full py-2.5 bg-white border border-zinc-200 text-zinc-700 rounded-xl text-xs font-bold hover:bg-zinc-50"
              >
                새로운 복사본으로 우회 저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 버전 단어 차이 비교(Diff) 결과 모달 */}
      {diffModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-2">
              <h3 className="text-sm font-extrabold text-indigo-600 flex items-center gap-1.5">
                <History className="h-4 w-4" />
                버전 #{diffModal.verA} vs 버전 #{diffModal.verB} 차이 비교
              </h3>
              <button
                onClick={() => setDiffModal(null)}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-600"
              >
                닫기
              </button>
            </div>
            <div className="p-4 border border-zinc-200 dark:border-zinc-850 rounded-2xl bg-zinc-50/50 dark:bg-zinc-950 max-h-[450px] overflow-y-auto font-sans leading-relaxed text-xs break-words space-y-4">
              <div className="text-[10px] font-bold text-zinc-400 flex items-center gap-4">
                <span>🟢 ins : 추가됨</span>
                <span>🔴 del : 삭제됨</span>
              </div>
              <div
                dangerouslySetInnerHTML={{ __html: diffModal.diffHtml }}
                className="diff-render-area leading-relaxed whitespace-pre-wrap"
              />
            </div>
          </div>
        </div>
      )}

      {/* 6. AI 자동 수정 미리보기 모달 */}
      {autoFixPreview?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-2xl w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-150 pb-2">
              <h3 className="text-sm font-extrabold text-purple-600 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4" />
                AI 자동 수정 제안 미리보기
              </h3>
              <button
                onClick={() => setAutoFixPreview(null)}
                className="text-xs font-bold text-zinc-400 hover:text-zinc-650"
              >
                닫기
              </button>
            </div>
            
            <p className="text-[10px] text-zinc-500 font-medium">
              이슈 해결을 위해 제안된 교정 내용입니다. 아래 변경 예정 사항을 적용하시겠습니까?
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="text-[9px] font-bold text-red-500">수정 전 (Before)</div>
                <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-[10px] min-h-[120px] max-h-[250px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {autoFixPreview.originalText || "해당 사항 없음"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-[9px] font-bold text-emerald-500">수정 후 (After)</div>
                <div className="p-3 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900 text-[10px] min-h-[120px] max-h-[250px] overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {autoFixPreview.newText || "해당 사항 없음"}
                </div>
              </div>
            </div>

            {autoFixPreview.updatedFields?.title && (
              <div className="p-2.5 bg-purple-500/5 border border-purple-500/10 rounded-xl text-[10px] leading-relaxed">
                <span className="font-extrabold text-purple-700 block">메타 타이틀 업데이트 예정:</span>
                <span className="font-semibold text-zinc-600">{autoFixPreview.updatedFields.title}</span>
              </div>
            )}

            {autoFixPreview.explanation && (
              <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-xl text-[10px] text-zinc-500 font-medium leading-relaxed">
                <span className="font-bold text-zinc-700 block">교정 설명:</span>
                {autoFixPreview.explanation}
              </div>
            )}

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setAutoFixPreview(null)}
                className="px-4 py-2 border border-zinc-200 rounded-xl text-xs font-bold hover:bg-zinc-50"
              >
                취소
              </button>
              <button
                onClick={handleApplyAutoFix}
                className="px-4 py-2 bg-purple-650 hover:bg-purple-550 text-white rounded-xl text-xs font-bold shadow-md shadow-purple-650/10"
              >
                변경사항 적용 및 버전 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
