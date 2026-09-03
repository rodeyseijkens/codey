export type ReviewHunkSpan = {
  additionCount: number;
  additionStart: number;
  deletionCount: number;
  deletionStart: number;
};

export type ReviewLineRange = readonly [number, number];

export type ReviewGapPosition = "before" | "trailing";

export interface ReviewGapHunk extends ReviewHunkSpan {
  additionLineIndex: number;
  collapsedBefore: number;
  deletionLineIndex: number;
}

export type ReviewGapSource = {
  additionLines: readonly string[];
  deletionLines: readonly string[];
  hunks: readonly ReviewGapHunk[];
  isPartial: boolean;
};

export type ReviewGapAddress = {
  hunkIndex: number;
  lineCount: number;
  newRange: ReviewLineRange;
  oldRange: ReviewLineRange;
  position: ReviewGapPosition;
};

export function reviewGapId(
  position: ReviewGapPosition,
  hunkIndex: number,
): string {
  return `${position}:${hunkIndex}`;
}

export function reviewLeadingGap(
  source: ReviewGapSource,
  hunkIndex: number,
): ReviewGapAddress | undefined {
  const hunk = source.hunks[hunkIndex];
  if (!hunk || hunk.collapsedBefore <= 0) {
    return;
  }

  const oldEnd = hunk.deletionStart - (hunk.deletionCount > 0 ? 1 : 0);
  const newEnd = hunk.additionStart - (hunk.additionCount > 0 ? 1 : 0);
  const oldStart = oldEnd - hunk.collapsedBefore + 1;
  const newStart = newEnd - hunk.collapsedBefore + 1;
  if (oldStart <= 0 || newStart <= 0) {
    return;
  }

  return {
    hunkIndex,
    lineCount: hunk.collapsedBefore,
    newRange: [newStart, newEnd],
    oldRange: [oldStart, oldEnd],
    position: "before",
  };
}

export function reviewTrailingGap(
  source: ReviewGapSource,
): ReviewGapAddress | undefined {
  const hunkIndex = source.hunks.length - 1;
  const hunk = source.hunks[hunkIndex];
  if (!hunk || source.isPartial) {
    return;
  }

  const oldCount =
    source.deletionLines.length - (hunk.deletionLineIndex + hunk.deletionCount);
  const newCount =
    source.additionLines.length - (hunk.additionLineIndex + hunk.additionCount);
  if (oldCount !== newCount || oldCount <= 0) {
    return;
  }

  const oldStart = hunk.deletionStart + hunk.deletionCount;
  const newStart = hunk.additionStart + hunk.additionCount;
  return {
    hunkIndex,
    lineCount: oldCount,
    newRange: [newStart, newStart + newCount - 1],
    oldRange: [oldStart, oldStart + oldCount - 1],
    position: "trailing",
  };
}
