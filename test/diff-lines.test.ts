import { describe, expect, test } from "bun:test";
import type { DiffRow } from "../src/lib/diff-lines";
import {
  changeGroupOffsets,
  parseDiffRows,
  rowLabel,
} from "../src/lib/diff-lines";

function rowAt(rows: DiffRow[], index: number): DiffRow {
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

describe("parseDiffRows", () => {
  test("skips diff metadata lines before the first hunk", () => {
    const rows = parseDiffRows(DIFF);
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.type)).toEqual([
      "del",
      "context",
      "add",
      "context",
      "context",
    ]);
  });

  test("does not treat ---/+++ file headers as diff rows", () => {
    const rows = parseDiffRows(DIFF);
    expect(rows.map((r) => r.text)).not.toContain("-- a/foo.ts");
    expect(rows.map((r) => r.text)).not.toContain("++ b/foo.ts");
  });

  test("assigns sequential hunk indices", () => {
    const rows = parseDiffRows(DIFF);
    expect(rows.map((r) => r.hunkIndex)).toEqual([0, 0, 0, 1, 1]);
  });

  test("tracks old/new line numbers", () => {
    const rows = parseDiffRows(DIFF);
    const del = rowAt(rows, 0);
    const context = rowAt(rows, 1);
    const add = rowAt(rows, 2);
    expect(del.type).toBe("del");
    expect(del.oldLine).toBe(1);
    expect(context.type).toBe("context");
    expect(context.newLine).toBe(1);
    expect(context.oldLine).toBe(2);
    expect(add.type).toBe("add");
    expect(add.newLine).toBe(2);
  });
});

describe("rowLabel", () => {
  test("labels add rows with new line number", () => {
    const rows = parseDiffRows(DIFF);
    expect(rowLabel(rowAt(rows, 2))).toBe("+2");
  });

  test("labels del rows with old line number", () => {
    const rows = parseDiffRows(DIFF);
    expect(rowLabel(rowAt(rows, 0))).toBe("-1");
  });

  test("labels context rows with new line number", () => {
    const rows = parseDiffRows(DIFF);
    expect(rowLabel(rowAt(rows, 1))).toBe("1");
  });
});

describe("changeGroupOffsets", () => {
  test("returns the first change of each group separated by more than 3 context lines", () => {
    const diff = `diff --git a/f.ts b/f.ts
--- a/f.ts
+++ b/f.ts
@@ -1,20 +1,20 @@
 line1
 line2
-line3
+CHANGED3
 line4
 line5
 line6
 line7
 line8
 line9
 line10
 line11
 line12
-line13
+CHANGED13
 line14
 line15
 line16
 line17
 line18
 line19
 line20
`;
    const rows = parseDiffRows(diff);
    expect(changeGroupOffsets(rows)).toEqual([2, 13]);
  });

  test("merges changes within 3 context lines into one group", () => {
    const diff = `diff --git a/f.ts b/f.ts
--- a/f.ts
+++ b/f.ts
@@ -1,10 +1,10 @@
 line1
-line2
+CHANGED2
 line3
 line4
-line5
+CHANGED5
 line6
 line7
 line8
 line9
 line10
`;
    const rows = parseDiffRows(diff);
    expect(changeGroupOffsets(rows)).toEqual([1]);
  });

  test("returns empty for a diff with no changes", () => {
    expect(changeGroupOffsets([])).toEqual([]);
  });
});
