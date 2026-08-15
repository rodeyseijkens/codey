import { cleanLastNewline } from "@pierre/diffs";
import { formatHunkHeader } from "../core/hunkHeader";
import { reviewLeadingGap, reviewTrailingGap } from "../core/review/expansion";
import { toInternalDiffFile } from "./model";
import type { HunkDiffFileInput } from "./types";

/** Normalize one raw diff/metadata line by stripping its trailing newline. */
function normalizeDiffLine(line: string | undefined): string {
  return cleanLastNewline(line ?? "");
}

/**
 * Canonical row model for one diff file, mirroring the row sequence
 * `buildStackRows` produces (gaps, hunk headers, then change lines) without
 * requiring a resolved theme or syntax highlighting.
 *
 * Row indices are stable across split/stack layouts and are the coordinates
 * hosts use for cursors, comment anchors, and hunk jumps.
 */
export interface CanonicalDiffRow {
  hunkIndex: number;
  kind: "add" | "del" | "context" | "header" | "gap";
  newLine?: number;
  oldLine?: number;
  text: string;
}

function appendHunkRows(
  rows: CanonicalDiffRow[],
  metadata: ReturnType<typeof toInternalDiffFile>["metadata"],
  hunkIndex: number,
  hunk: NonNullable<
    ReturnType<typeof toInternalDiffFile>["metadata"]["hunks"][number]
  >
): void {
  const { deletionLines, additionLines } = metadata;
  const leadingGap = reviewLeadingGap(metadata, hunkIndex);
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
          text: normalizeDiffLine(deletionLines[deletionLineIndex + offset]),
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
        text: normalizeDiffLine(deletionLines[deletionLineIndex + offset]),
      });
    }
    for (let offset = 0; offset < content.additions; offset += 1) {
      rows.push({
        hunkIndex,
        kind: "add",
        newLine: newLine + offset,
        text: normalizeDiffLine(additionLines[additionLineIndex + offset]),
      });
    }
    deletionLineIndex += content.deletions;
    additionLineIndex += content.additions;
    oldLine += content.deletions;
    newLine += content.additions;
  }
}

export function buildCanonicalDiffRows(
  input: HunkDiffFileInput
): CanonicalDiffRow[] {
  const { metadata } = toInternalDiffFile(input);
  const rows: CanonicalDiffRow[] = [];

  metadata.hunks.forEach((hunk, hunkIndex) => {
    appendHunkRows(rows, metadata, hunkIndex, hunk);
  });

  const trailingGap = reviewTrailingGap(metadata);
  if (trailingGap) {
    const { hunks } = metadata;
    rows.push({
      hunkIndex: Math.max(0, hunks.length - 1),
      kind: "gap",
      text: `${trailingGap.lineCount} unchanged lines`,
    });
  }

  return rows;
}

/** First visible code row of each hunk, used for hunk jumps. */
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

/** Short side-prefixed label for one canonical row, e.g. "+12", "-3", "7". */
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
