export type { ReviewHunkSpan } from "../../../patch/gap";
export type ReviewSide = "old" | "new";

export type ReviewHunkContentBlock = {
  additions?: number;
  deletions?: number;
  lines?: number;
  type: "context" | "change";
};

export type ReviewHunkOrigins = {
  additionLineIndex: number;
  deletionLineIndex: number;
};

export type RebasedReviewHunk<T> = {
  additionEndIndex: number;
  deletionEndIndex: number;
  hunk: T;
};

interface RebasableHunk extends ReviewHunkOrigins {
  hunkContent: readonly ReviewHunkContentBlock[];
}

export function rebaseReviewHunk<T extends RebasableHunk>(
  hunk: T,
  origins: ReviewHunkOrigins,
): RebasedReviewHunk<T> {
  let { deletionLineIndex, additionLineIndex } = origins;
  const hunkContent = hunk.hunkContent.map((content) => {
    const rebased = { ...content, additionLineIndex, deletionLineIndex };
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
    additionEndIndex: additionLineIndex,
    deletionEndIndex: deletionLineIndex,
    hunk: { ...hunk, ...origins, hunkContent } as T,
  };
}

export function normalizedReviewSourceLines(sourceText: string): string[] {
  const normalized = sourceText.replaceAll("\r\n", "\n");
  const trimmed = normalized.endsWith("\n")
    ? normalized.slice(0, -1)
    : normalized;
  return trimmed.length === 0 ? [] : trimmed.split("\n");
}
