export interface AnalysisResult {
  char_count: number;
  avg_sentence_length: number;
  avg_paragraph_length: number;
  honorific_ratio: number; // 0 ~ 100
  question_ratio: number;  // 0 ~ 100
  exclamation_count: number;
  emoji_count: number;
  conjunction_counts: Record<string, number>;
  common_endings: string[];
  repeated_phrases: string[];
}

/**
 * 텍스트 샘플을 정량 분석하여 문체 특성 객체를 반환합니다.
 * @param text 분석할 대상 문자열
 * @returns 정량 분석 결과 객체
 */
export function analyzeText(text: string): AnalysisResult {
  if (!text || text.trim().length === 0) {
    return {
      char_count: 0,
      avg_sentence_length: 0,
      avg_paragraph_length: 0,
      honorific_ratio: 50,
      question_ratio: 0,
      exclamation_count: 0,
      emoji_count: 0,
      conjunction_counts: {},
      common_endings: [],
      repeated_phrases: [],
    };
  }

  const charCount = text.length;

  // 1. 문장 분절 및 평균 길이 계산
  // 마침표(.), 물음표(?), 느낌표(!), 줄바꿈(\n)을 문장 종결 기준으로 삼음
  const sentences = text
    .split(/[.?!]+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const sentenceCount = sentences.length || 1;
  const avgSentenceLength = Math.round(charCount / sentenceCount);

  // 2. 문단 분절 및 평균 길이 계산
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const paragraphCount = paragraphs.length || 1;
  const avgParagraphLength = Math.round(charCount / paragraphCount);

  // 3. 존댓말 사용 비율 측정
  // 한국어 종결어미 빈도 체크 (어절/문장 끝자리 검증 보완)
  const honorificPatterns = /(습니다|습니까|해요|요|입니다|합니다|하네요|대요|죠|네요|구요|세요)(?=[.!?\s]|$)/g;
  const casualPatterns = /((?<![니이])다|했어|지|잖아)(?=[.!?\s]|$)/g;

  const honorificCount = (text.match(honorificPatterns) || []).length;
  const casualCount = (text.match(casualPatterns) || []).length;
  
  let honorificRatio = 50; // 기본 중립값
  if (honorificCount + casualCount > 0) {
    honorificRatio = Math.round((honorificCount / (honorificCount + casualCount)) * 100);
  }

  // 4. 문장 속 기호 비율 계측
  const questionMarkCount = (text.match(/\?/g) || []).length;
  const exclamationCount = (text.match(/!/g) || []).length;
  const questionRatio = Math.round((questionMarkCount / sentenceCount) * 100);

  // 5. 이모지 개수 (유니코드 패턴)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{1F600}-\u{1F64F}]|[\u{2700}-\u{27BF}]/gu;
  const emojiCount = (text.match(emojiRegex) || []).length;

  // 6. 자주 사용하는 접속사 등장 빈도
  const targetConjunctions = ["그리고", "하지만", "그러나", "그래서", "또한", "한편", "게다가", "즉"];
  const conjunctionCounts: Record<string, number> = {};
  targetConjunctions.forEach((conj) => {
    const regex = new RegExp(conj, "g");
    const count = (text.match(regex) || []).length;
    if (count > 0) {
      conjunctionCounts[conj] = count;
    }
  });

  // 7. 자주 사용하는 문장 종결 어미 어구 추출
  // 문장들 중 가장 끝 2~3글자 단어를 조사하여 빈도수 계산
  const endingsMap: Record<string, number> = {};
  sentences.forEach((s) => {
    if (s.length >= 2) {
      const lastWord = s.substring(s.length - 3);
      endingsMap[lastWord] = (endingsMap[lastWord] || 0) + 1;
    }
  });
  const commonEndings = Object.entries(endingsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([ending]) => ending);

  // 8. 반복되는 어휘 구절 추출 (2어절 이상의 중복 단어 조합)
  const words = text
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1);
  
  const phraseMap: Record<string, number> = {};
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    phraseMap[phrase] = (phraseMap[phrase] || 0) + 1;
  }
  const repeatedPhrases = Object.entries(phraseMap)
    .filter(([_, count]) => count >= 2) // 2회 이상 반복 시 추출
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([phrase]) => phrase);

  return {
    char_count: charCount,
    avg_sentence_length: avgSentenceLength,
    avg_paragraph_length: avgParagraphLength,
    honorific_ratio: honorificRatio,
    question_ratio: Math.min(questionRatio, 100),
    exclamation_count: exclamationCount,
    emoji_count: emojiCount,
    conjunction_counts: conjunctionCounts,
    common_endings: commonEndings,
    repeated_phrases: repeatedPhrases,
  };
}
