import { formatCommentsAsMarkdown } from "../src/lib/clipboard";
import {
  formatLineRangeLabel,
  lineRangeForRows,
} from "../src/patch/line-range";
import type { CanonicalDiffRow } from "../src/patch/rows";
import { describe, expect, test } from "bun:test";

const rows: CanonicalDiffRow[] = [
  { hunkIndex: 0, kind: "del", oldLine: 2, text: "old a" },
  { hunkIndex: 0, kind: "del", oldLine: 3, text: "old b" },
  { hunkIndex: 0, kind: "add", newLine: 2, text: "new a" },
  { hunkIndex: 0, kind: "add", newLine: 3, text: "new b" },
  { hunkIndex: 0, kind: "context", newLine: 4, oldLine: 4, text: "ctx" },
];

describe("formatLineRangeLabel", () => {
  test("joins old and new ranges in GitHub style", () => {
    expect(formatLineRangeLabel([2, 4], [2, 4])).toBe("L2–L4 → R2–R4");
  });

  test("collapses a single-line range", () => {
    expect(formatLineRangeLabel([2, 2], [2, 2])).toBe("L2 → R2");
  });

  test("omits a missing side", () => {
    expect(formatLineRangeLabel(undefined, [2, 4])).toBe("R2–R4");
    expect(formatLineRangeLabel([2, 4], undefined)).toBe("L2–L4");
  });

  test("is empty when both sides are missing", () => {
    expect(formatLineRangeLabel(undefined, undefined)).toBe("");
  });
});

describe("lineRangeForRows", () => {
  test("collects min/max source lines per side", () => {
    expect(lineRangeForRows(rows, 0, 1, "old")).toEqual([2, 3]);
    expect(lineRangeForRows(rows, 2, 3, "new")).toEqual([2, 3]);
  });

  test("returns undefined when the side has no lines", () => {
    expect(lineRangeForRows(rows, 2, 3, "old")).toBeUndefined();
  });
});

describe("formatCommentsAsMarkdown", () => {
  test("uses the same range label as the inline comment card", () => {
    const md = formatCommentsAsMarkdown("codey review", [
      {
        context: "",
        endRow: 3,
        newRange: [2, 4],
        oldRange: [2, 4],
        path: "src/main.ts",
        scope: "changes",
        startRow: 1,
        text: "Extract this into a helper.",
      },
    ]);
    expect(md).toContain("- **L2–L4 → R2–R4**");
    expect(md).not.toContain("lines 1-3");
  });

  test("falls back to row indices when no ranges are available", () => {
    const md = formatCommentsAsMarkdown("codey review", [
      {
        context: "",
        endRow: 3,
        path: "src/main.ts",
        scope: "changes",
        startRow: 1,
        text: "note",
      },
    ]);
    expect(md).toContain("- **lines 1-3**");
  });
});
