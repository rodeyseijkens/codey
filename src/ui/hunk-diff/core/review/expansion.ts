import type { ReviewHunkSpan } from "./geometry";
import type {
  ReviewFileChangeKind,
  ReviewLineRange,
  ReviewSide,
} from "./types";

export type ReviewGapPosition = "before" | "trailing";

export interface ReviewGapHunk extends ReviewHunkSpan {
  collapsedBefore: number;
  additionLineIndex: number;
  deletionLineIndex: number;
}

export interface ReviewGapSource {
  hunks: readonly ReviewGapHunk[];
  additionLines: readonly string[];
  deletionLines: readonly string[];
  isPartial: boolean;
}

export interface ReviewGapAddress {
  position: ReviewGapPosition;
  hunkIndex: number;
  oldRange: ReviewLineRange;
  newRange: ReviewLineRange;
  lineCount: number;
}

export function reviewGapId(position: ReviewGapPosition, hunkIndex: number) {
  return `${position}:${hunkIndex}`;
}

export function reviewLeadingGap(
  source: ReviewGapSource,
  hunkIndex: number,
): ReviewGapAddress | undefined {
  const hunk = source.hunks[hunkIndex];
  if (!hunk || hunk.collapsedBefore <= 0) {
    return undefined;
  }

  const oldEnd = hunk.deletionStart - (hunk.deletionCount > 0 ? 1 : 0);
  const newEnd = hunk.additionStart - (hunk.additionCount > 0 ? 1 : 0);
  const oldStart = oldEnd - hunk.collapsedBefore + 1;
  const newStart = newEnd - hunk.collapsedBefore + 1;
  if (oldStart <= 0 || newStart <= 0) {
    return undefined;
  }

  return {
    position: "before",
    hunkIndex,
    oldRange: [oldStart, oldEnd],
    newRange: [newStart, newEnd],
    lineCount: hunk.collapsedBefore,
  };
}

export function reviewTrailingGap(
  source: ReviewGapSource,
): ReviewGapAddress | undefined {
  const hunkIndex = source.hunks.length - 1;
  const hunk = source.hunks[hunkIndex];
  if (!hunk || source.isPartial) {
    return undefined;
  }

  const oldCount =
    source.deletionLines.length - (hunk.deletionLineIndex + hunk.deletionCount);
  const newCount =
    source.additionLines.length - (hunk.additionLineIndex + hunk.additionCount);
  if (oldCount !== newCount || oldCount <= 0) {
    return undefined;
  }

  const oldStart = hunk.deletionStart + hunk.deletionCount;
  const newStart = hunk.additionStart + hunk.additionCount;
  return {
    position: "trailing",
    hunkIndex,
    oldRange: [oldStart, oldStart + oldCount - 1],
    newRange: [newStart, newStart + newCount - 1],
    lineCount: oldCount,
  };
}

export function reviewExpansionSide(
  changeKind: ReviewFileChangeKind,
): ReviewSide {
  return changeKind === "deleted" ? "old" : "new";
}
