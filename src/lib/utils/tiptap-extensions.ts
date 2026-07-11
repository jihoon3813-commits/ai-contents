import { Node, mergeAttributes } from "@tiptap/core";

export const ImagePlaceholder = Node.create({
  name: "imagePlaceholder",
  group: "block",
  atom: true, // 에디터 내부에서 내부 텍스트 입력을 차단하고 단일 블록으로 거동

  addAttributes() {
    return {
      id: { default: null },
      sequenceNumber: { default: 1 },
      aspectRatio: { default: "16:9" },
      role: { default: "" },
      description: { default: "" },
      prompt: { default: "" },
      overlayText: { default: "" },
    };
  },

  parseHTML() {
    return [
      {
        tag: "div[data-type='image-placeholder']",
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) return {};
          return {
            id: dom.getAttribute("data-id"),
            sequenceNumber: parseInt(dom.getAttribute("data-seq") || "1", 10),
            aspectRatio: dom.getAttribute("data-ratio") || "16:9",
            role: dom.getAttribute("data-role") || "",
            description: dom.getAttribute("data-desc") || "",
            prompt: dom.getAttribute("data-prompt") || "",
            overlayText: dom.getAttribute("data-overlay") || "",
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes;
    return [
      "div",
      mergeAttributes(attrs, {
        "data-type": "image-placeholder",
        "data-id": attrs.id,
        "data-seq": attrs.sequenceNumber,
        "data-ratio": attrs.aspectRatio,
        "data-role": attrs.role,
        "data-desc": attrs.description,
        "data-prompt": attrs.prompt,
        "data-overlay": attrs.overlayText,
        class:
          "image-placeholder-block p-4 border border-dashed border-purple-400 dark:border-purple-800 rounded-2xl my-5 bg-purple-50/30 dark:bg-purple-950/10 select-none",
      }),
      [
        "div",
        { class: "flex justify-between items-center text-[10px] font-extrabold text-purple-600 dark:text-purple-400 mb-1" },
        ["span", {}, `📷 추천 이미지 #${attrs.sequenceNumber} (${attrs.aspectRatio})`],
        ["span", { class: "bg-purple-100 dark:bg-purple-900/50 px-2 py-0.5 rounded-lg text-[9px]" }, attrs.role || "삽입 위치"],
      ],
      [
        "div",
        { class: "space-y-1" },
        ["p", { class: "text-[11px] text-zinc-600 dark:text-zinc-400 my-0 font-medium leading-normal" }, attrs.description || "설명 없음"],
        attrs.overlayText
          ? ["p", { class: "text-[10px] text-indigo-600 dark:text-indigo-400 my-0 font-bold" }, `오버레이 문구: "${attrs.overlayText}"`]
          : ["span", { class: "hidden" }],
      ],
    ];
  },
});
