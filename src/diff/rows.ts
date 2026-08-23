import type { FileDiffMetadata, Hunk } from "@pierre/diffs";
import { formatHunkHeader } from "../ui/hunk-diff/core/hunkHeader";
import type {
  ReviewGapAddress,
  ReviewGapHunk,
  ReviewGapSource,
} from "../ui/hunk-diff/core/review/expansion";
import {
  reviewLeadingGap,
  reviewTrailingGap,
} from "../ui/hunk-diff/core/review/expansion";

export interface CanonicalDiffRow {
  hunkIndex: number;
  kind: "add" | "del" | "context" | "header" | "gap";
  newLine?: number;
  oldLine?: number;
  text: string;
}

function normalizeDiffLine(line: string | undefined): string {
  if (!line) {
    return "";
  }
  if (line.endsWith("\n")) {
    return line.slice(0, -1);
  }
  return line;
}

function toGapSource(metadata: FileDiffMetadata): ReviewGapSource {
  return {
    additionLines: metadata.additionLines,
    deletionLines: metadata.deletionLines,
    hunks: metadata.hunks as unknown as readonly ReviewGapHunk[],
    isPartial: metadata.isPartial,
  };
}

function appendHunkRows(
  rows: CanonicalDiffRow[],
  metadata: FileDiffMetadata,
  hunkIndex: number,
  hunk: Hunk
): void {
  const gapSource = toGapSource(metadata);
  const leadingGap: ReviewGapAddress | undefined = reviewLeadingGap(
    gapSource,
    hunkIndex
  );
  if (leadingGap) {
    rows.push({
      hunkIndex,
      kind: "gap",
      text: `${leadingGap.lineCount} unchanged lines`,
    });
  }

  rows.push({
    hunkIndex,
    kind: "header",
    text: normalizeDiffLine(formatHunkHeader(hunk)),
  });

  let { deletionLineIndex, additionLineIndex } = hunk;
  let { deletionStart: oldLine, additionStart: newLine } = hunk;

  for (const content of hunk.hunkContent) {
    if (content.type === "context") {
      for (let offset = 0; offset < content.lines; offset += 1) {
        rows.push({
          hunkIndex,
          kind: "context",
          newLine: newLine + offset,
          oldLine: oldLine + offset,
          text: normalizeDiffLine(
            metadata.deletionLines[deletionLineIndex + offset]
          ),
        });
      }
      deletionLineIndex += content.lines;
      additionLineIndex += content.lines;
      oldLine += content.lines;
      newLine += content.lines;
      continue;
    }

    for (let offset = 0; offset < content.deletions; offset += 1) {
      rows.push({
        hunkIndex,
        kind: "del",
        oldLine: oldLine + offset,
        text: normalizeDiffLine(
          metadata.deletionLines[deletionLineIndex + offset]
        ),
      });
    }
    for (let offset = 0; offset < content.additions; offset += 1) {
      rows.push({
        hunkIndex,
        kind: "add",
        newLine: newLine + offset,
        text: normalizeDiffLine(
          metadata.additionLines[additionLineIndex + offset]
        ),
      });
    }
    deletionLineIndex += content.deletions;
    additionLineIndex += content.additions;
    oldLine += content.deletions;
    newLine += content.additions;
  }
}

export function buildCanonicalDiffRows(
  metadata: FileDiffMetadata
): CanonicalDiffRow[] {
  const rows: CanonicalDiffRow[] = [];
  const gapSource = toGapSource(metadata);

  metadata.hunks.forEach((hunk, hunkIndex) => {
    appendHunkRows(rows, metadata, hunkIndex, hunk);
  });

  const trailingGap = reviewTrailingGap(gapSource);
  if (trailingGap) {
    rows.push({
      hunkIndex: Math.max(0, metadata.hunks.length - 1),
      kind: "gap",
      text: `${trailingGap.lineCount} unchanged lines`,
    });
  }

  return rows;
}

export function canonicalHunkOffsets(
  rows: readonly CanonicalDiffRow[]
): number[] {
  const offsets: number[] = [];
  let lastHunk = -1;
  rows.forEach((row, index) => {
    if (
      row.hunkIndex === lastHunk ||
      row.kind === "header" ||
      row.kind === "gap"
    ) {
      return;
    }
    offsets.push(index);
    lastHunk = row.hunkIndex;
  });
  return offsets;
}

export function canonicalRowLabel(row: CanonicalDiffRow): string {
  if (row.kind === "add") {
    return `+${row.newLine ?? "?"}`;
  }
  if (row.kind === "del") {
    return `-${row.oldLine ?? "?"}`;
  }
  if (row.kind === "context") {
    return `${row.newLine ?? "?"}`;
  }
  return "";
}
