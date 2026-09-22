import type { CanonicalDiffRow } from "./rows";

export type LineRange = [number, number];

export type LineSide = "old" | "new";

/** Min/max source line numbers touched by a canonical row range, per side. */
export function lineRangeForRows(
  rows: readonly CanonicalDiffRow[],
  startRow: number,
  endRow: number,
  side: LineSide,
): LineRange | undefined {
  const lines: number[] = [];
  const last = Math.min(endRow, rows.length - 1);
  for (let index = Math.max(0, startRow); index <= last; index += 1) {
    const row = rows[index];
    const line = side === "old" ? row?.oldLine : row?.newLine;
    if (line !== undefined) {
      lines.push(line);
    }
  }
  if (lines.length === 0) {
    return;
  }
  return [Math.min(...lines), Math.max(...lines)];
}

function formatGithubStyleRange(prefix: "L" | "R", range: LineRange): string {
  return range[0] === range[1]
    ? `${prefix}${range[0]}`
    : `${prefix}${range[0]}–${prefix}${range[1]}`;
}

/** GitHub-style range label, e.g. `L2–L4 → R2–R4`; empty when both sides are missing. */
export function formatLineRangeLabel(
  oldRange: LineRange | undefined,
  newRange: LineRange | undefined,
): string {
  const parts: string[] = [];
  if (oldRange) {
    parts.push(formatGithubStyleRange("L", oldRange));
  }
  if (newRange) {
    parts.push(formatGithubStyleRange("R", newRange));
  }
  return parts.join(" → ");
}
