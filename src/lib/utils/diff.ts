export interface DiffChange {
  value: string;
  added?: boolean;
  removed?: boolean;
}

/**
 * 두 문자열을 단어 및 공백 단위로 쪼개 LCS 알고리즘으로 다른 부분을 연산합니다.
 */
export function diffWords(oldStr: string, newStr: string): DiffChange[] {
  // 공백, 줄바꿈 단위로 쪼개어 단어를 유지하며 단어 조각 배열 생성
  const oldWords = oldStr.split(/(\s+)/).filter(Boolean);
  const newWords = newStr.split(/(\s+)/).filter(Boolean);

  const n = oldWords.length;
  const m = newWords.length;

  // LCS 용 DP 테이블 초기화
  const dp: number[][] = Array(n + 1)
    .fill(0)
    .map(() => Array(m + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffChange[] = [];
  let i = n, j = m;

  // 역추적(Backtracking)하여 변경점 도출
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ value: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ value: newWords[j - 1], added: true });
      j--;
    } else {
      result.unshift({ value: oldWords[i - 1], removed: true });
      i--;
    }
  }

  // 동일 성격(added/removed/plain)의 인접 데이터 결합 (Clean 렌더링 목적)
  const merged: DiffChange[] = [];
  for (const change of result) {
    const last = merged[merged.length - 1];
    if (
      last &&
      ((last.added && change.added) ||
        (last.removed && change.removed) ||
        (!last.added && !last.removed && !change.added && !change.removed))
    ) {
      last.value += change.value;
    } else {
      merged.push({ ...change });
    }
  }

  return merged;
}

/**
 * 두 버전 텍스트를 대조하여 추가/삭제 하이라이트 태그가 삽입된 HTML 문자열을 만듭니다.
 */
export function renderDiffHtml(oldStr: string, newStr: string): string {
  const diffs = diffWords(oldStr || "", newStr || "");
  return diffs
    .map((part) => {
      if (part.added) {
        return `<ins class="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 no-underline px-0.5 rounded font-semibold">${part.value}</ins>`;
      }
      if (part.removed) {
        return `<del class="bg-red-100 dark:bg-red-950/40 text-red-800 dark:text-red-300 line-through px-0.5 rounded">${part.value}</del>`;
      }
      return part.value;
    })
    .join("");
}
