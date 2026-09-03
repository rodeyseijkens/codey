import {
  buildCanonicalDiffRows,
  type CanonicalDiffRow,
  canonicalHunkOffsets,
  canonicalRowLabel,
  createDiffViewerFilesFromPatch,
} from "../src/ui/diff-viewer";
import { describe, expect, test } from "bun:test";

function rowAt(rows: CanonicalDiffRow[], index: number): CanonicalDiffRow {
  const row = rows[index];
  if (row === undefined) {
    throw new Error(`row ${index} missing`);
  }
  return row;
}

const DIFF = `diff --git a/foo.ts b/foo.ts
index 123..456 100644
--- a/foo.ts
+++ b/foo.ts
@@ -1,3 +1,3 @@
-const a = 1;
 const b = 2;
+const c = 3;
@@ -10,2 +10,2 @@
 function x() {}
 function y() {}
`;

function rowsOf(diff: string): CanonicalDiffRow[] {
  const [file] = createDiffViewerFilesFromPatch(diff, "test");
  if (!file) {
    throw new Error("expected one file");
  }
  return buildCanonicalDiffRows(file);
}

describe("buildCanonicalDiffRows", () => {
  test("includes hunk headers, change lines, and collapsed gaps", () => {
    const rows = rowsOf(DIFF);
    expect(rows).toHaveLength(8);
    expect(rows.map((r) => r.kind)).toEqual([
      "header",
      "del",
      "context",
      "add",
      "gap",
      "header",
      "context",
      "context",
    ]);
  });

  test("does not treat ---/+++ file headers as diff rows", () => {
    const rows = rowsOf(DIFF);
    expect(rows.map((r) => r.text)).not.toContain("-- a/foo.ts");
    expect(rows.map((r) => r.text)).not.toContain("++ b/foo.ts");
  });

  test("assigns sequential hunk indices", () => {
    const rows = rowsOf(DIFF);
    expect(rows.map((r) => r.hunkIndex)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
  });

  test("tracks old/new line numbers", () => {
    const rows = rowsOf(DIFF);
    const del = rowAt(rows, 1);
    const context = rowAt(rows, 2);
    const add = rowAt(rows, 3);
    expect(del.kind).toBe("del");
    expect(del.oldLine).toBe(1);
    expect(context.kind).toBe("context");
    expect(context.newLine).toBe(1);
    expect(context.oldLine).toBe(2);
    expect(add.kind).toBe("add");
    expect(add.newLine).toBe(2);
  });
});

describe("canonicalRowLabel", () => {
  test("labels add rows with new line number", () => {
    const rows = rowsOf(DIFF);
    expect(canonicalRowLabel(rowAt(rows, 3))).toBe("+2");
  });

  test("labels del rows with old line number", () => {
    const rows = rowsOf(DIFF);
    expect(canonicalRowLabel(rowAt(rows, 1))).toBe("-1");
  });

  test("labels context rows with new line number", () => {
    const rows = rowsOf(DIFF);
    expect(canonicalRowLabel(rowAt(rows, 2))).toBe("1");
  });

  test("labels headers and gaps as empty", () => {
    const rows = rowsOf(DIFF);
    expect(canonicalRowLabel(rowAt(rows, 0))).toBe("");
    expect(canonicalRowLabel(rowAt(rows, 4))).toBe("");
  });
});

describe("canonicalHunkOffsets", () => {
  test("returns the first visible code row of each hunk", () => {
    const rows = rowsOf(DIFF);
    expect(canonicalHunkOffsets(rows)).toEqual([1, 6]);
  });
});
