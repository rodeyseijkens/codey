export type { ReviewHunkSpan } from "../../../../diff/gap";
export type ReviewSide = "old" | "new";

export interface ReviewHunkContentBlock {
  type: "context" | "change";
  lines?: number;
  additions?: number;
  deletions?: number;
}

export interface ReviewHunkOrigins {
  deletionLineIndex: number;
  additionLineIndex: number;
}

export interface RebasedReviewHunk<T> {
  hunk: T;
  deletionEndIndex: number;
  additionEndIndex: number;
}

interface RebasableHunk extends ReviewHunkOrigins {
  hunkContent: readonly ReviewHunkContentBlock[];
}

export function rebaseReviewHunk<T extends RebasableHunk>(
  hunk: T,
  origins: ReviewHunkOrigins,
): RebasedReviewHunk<T> {
  let deletionLineIndex = origins.deletionLineIndex;
  let additionLineIndex = origins.additionLineIndex;
  const hunkContent = hunk.hunkContent.map((content) => {
    const rebased = { ...content, deletionLineIndex, additionLineIndex };
    if (content.type === "context") {
      deletionLineIndex += content.lines ?? 0;
      additionLineIndex += content.lines ?? 0;
    } else {
      deletionLineIndex += content.deletions ?? 0;
      additionLineIndex += content.additions ?? 0;
    }
    return rebased;
  });

  return {
    hunk: { ...hunk, ...origins, hunkContent } as T,
    deletionEndIndex: deletionLineIndex,
    additionEndIndex: additionLineIndex,
  };
}

export function normalizedReviewSourceLines(sourceText: string): string[] {
  const normalized = sourceText.replaceAll("\r\n", "\n");
  const trimmed = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized;
  return trimmed.length === 0 ? [] : trimmed.split("\n");
}
