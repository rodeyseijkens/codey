import type { ReactNode } from "react";
import { act, useCallback, useEffect, useRef, useState } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { testRender } from "@opentui/react/test-utils";

import { measureCommentCardHeight } from "../src/ui/diff-viewer/annotations/CommentCard";
import { DiffBody } from "../src/ui/diff-viewer/diff-body";
import {
  createDiffViewerFilesFromPatch,
  toInternalDiffFile,
} from "../src/ui/diff-viewer/model";
import { findMaxLineNumber } from "../src/ui/diff-viewer/render/codeColumns";
import { buildStackRows } from "../src/ui/diff-viewer/render/pierre";
import { measureRenderedRowHeight } from "../src/ui/diff-viewer/render/renderRows";
import type { DiffNote, DiffViewerFile } from "../src/ui/diff-viewer/types";
import { resolveTheme } from "../src/ui/theme/resolve";
import { describe, expect, test } from "bun:test";

const WIDTH = 78;

function patchOf(lines: string[], oldCount: number, newCount: number): string {
  return [
    "diff --git a/f.ts b/f.ts",
    "index 123..456 100644",
    "--- a/f.ts",
    "+++ b/f.ts",
    `@@ -1,${oldCount} +1,${newCount} @@`,
    ...lines,
    "",
  ].join("\n");
}

type ScrollboxShape = { scrollHeight: number; scrollTop: number };

function findScrollboxAncestor(
  node: { getChildren?: () => unknown[] } | null,
): ScrollboxShape | null {
  const maybe = node as unknown as ScrollboxShape;
  if (
    node &&
    typeof maybe.scrollTop === "number" &&
    typeof maybe.scrollHeight === "number"
  ) {
    return maybe;
  }
  for (const child of node?.getChildren?.() ?? []) {
    const found = findScrollboxAncestor(
      child as { getChildren?: () => unknown[] },
    );
    if (found) {
      return found;
    }
  }
  return null;
}

function Harness({
  file,
  notes = [],
  wrapLines = true,
}: {
  file: DiffViewerFile;
  notes?: DiffNote[];
  wrapLines?: boolean;
}) {
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const attachScrollbox = useCallback((el: ScrollBoxRenderable | null) => {
    scrollRef.current = el;
  }, []);
  const [metrics, setMetrics] = useState({ scrollTop: 0, viewportHeight: 0 });
  useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll === null) {
      return;
    }
    const { slider } = scroll.verticalScrollBar;
    const { viewport } = scroll;
    const sync = () => {
      const { height } = viewport;
      const { scrollTop } = scroll;
      setMetrics((prev) =>
        prev.scrollTop === scrollTop && prev.viewportHeight === height
          ? prev
          : { scrollTop, viewportHeight: height },
      );
    };
    sync();
    slider.on("change", sync);
    return () => {
      slider.off("change", sync);
    };
  }, []);
  return (
    <scrollbox height={20} ref={attachScrollbox} width={80}>
      <DiffBody
        file={file}
        layout="stack"
        notes={notes}
        scrollTop={metrics.scrollTop}
        viewportHeight={
          metrics.viewportHeight > 0 ? metrics.viewportHeight : 10
        }
        width={WIDTH}
        wrapLines={wrapLines}
      />
    </scrollbox>
  );
}

async function renderHarness(node: ReactNode, width = 100, height = 24) {
  const setup = await testRender(node, { height, width });
  await act(async () => {
    await setup.renderOnce();
  });
  return setup;
}

const theme = resolveTheme("github-dark-default", null);

/** Replicate DiffBody.layoutMetrics measurement for the given file + notes. */
function measuredTotal(file: DiffViewerFile, notes: DiffNote[]) {
  const internal = toInternalDiffFile(file);
  const canonicalRows = file.canonicalRows ?? [];
  const plan = buildStackRows(internal, null, theme, 4);
  const digits = String(findMaxLineNumber(internal)).length;
  const guideByLayout = new Map<number, "old" | "new">();
  for (const note of notes) {
    const start = note.guideStartRow ?? note.anchorRow;
    for (let index = start; index < note.anchorRow; index += 1) {
      const canonical = canonicalRows[index];
      if (!canonical) {
        continue;
      }
      const layoutIndex = plan.canonicalToLayout[index] ?? -1;
      if (layoutIndex < 0 || guideByLayout.has(layoutIndex)) {
        continue;
      }
      guideByLayout.set(layoutIndex, canonical.kind === "add" ? "new" : "old");
    }
  }
  let total = 0;
  plan.rows.forEach((row, index) => {
    total += measureRenderedRowHeight(
      row,
      WIDTH,
      digits,
      true,
      true,
      true,
      theme,
      false,
      guideByLayout.get(index),
    );
  });
  for (const note of notes) {
    const anchorSide =
      canonicalRows[note.anchorRow]?.kind === "add" ? "new" : "old";
    const start = note.guideStartRow ?? note.anchorRow;
    const rangeRows = canonicalRows.slice(start, note.anchorRow + 1);
    const oldLines = rangeRows
      .map((r) => r?.oldLine)
      .filter((l): l is number => l !== undefined);
    const newLines = rangeRows
      .map((r) => r?.newLine)
      .filter((l): l is number => l !== undefined);
    total += measureCommentCardHeight({
      anchorSide: anchorSide as "old" | "new",
      annotation: {
        editable: true,
        id: note.id,
        newRange:
          newLines.length > 0
            ? [Math.min(...newLines), Math.max(...newLines)]
            : undefined,
        oldRange:
          oldLines.length > 0
            ? [Math.min(...oldLines), Math.max(...oldLines)]
            : undefined,
        source: note.editing ? "user-draft" : "user",
        summary: note.text,
      },
      layout: "stack",
      width: WIDTH,
    });
  }
  return total;
}

async function driftOf(file: DiffViewerFile, notes: DiffNote[]) {
  const expected = measuredTotal(file, notes);
  const setup = await renderHarness(<Harness file={file} notes={notes} />);
  try {
    const sb = findScrollboxAncestor(setup.renderer.root);
    if (!sb) {
      throw new Error("expected scrollbox");
    }
    return { actual: sb.scrollHeight, expected };
  } finally {
    await act(() => setup.renderer.destroy());
  }
}

/**
 * Regression tests: measured row/card heights must match what actually renders,
 * because windowed rendering uses the measurements for spacer boxes, scrollHeight,
 * and the scrollTop→row mapping. Reproduces the two drift defects found in review:
 * comment cards omitting the title row (and modeling drafts as wrapped text), and
 * note-guide columns narrowing rendered wrap width without narrowing measurement.
 */
describe("diff geometry: measured heights match rendered heights", () => {
  test("baseline: wrapped rows, no notes", async () => {
    const lines = Array.from(
      { length: 40 },
      (_, index) => ` ${"x".repeat(50)} ${index} ${"y".repeat(50)}`,
    );
    const [file] = createDiffViewerFilesFromPatch(
      patchOf(lines, 40, 40),
      "ctl",
    );
    if (!file) {
      throw new Error("expected file");
    }
    const { expected, actual } = await driftOf(file, []);
    expect(actual - expected).toBe(0);
  });

  test("plain note card includes its title row", async () => {
    const lines = [
      ...Array.from({ length: 30 }, (_, index) => ` ctx ${index}`),
      "+added",
      ...Array.from({ length: 30 }, (_, index) => ` ctx b${index}`),
    ];
    const [file] = createDiffViewerFilesFromPatch(
      patchOf(lines, 60, 61),
      "card",
    );
    if (!file) {
      throw new Error("expected file");
    }
    const notes: DiffNote[] = [{ anchorRow: 31, id: "n1", text: "note" }];
    const { expected, actual } = await driftOf(file, notes);
    expect(actual - expected).toBe(0);
  });

  test("note guide on wrapped add row does not shift geometry", async () => {
    const lines = [
      ...Array.from({ length: 30 }, (_, index) => ` ctx ${index}`),
      `+${"a".repeat(71)}`,
      "+second add",
      ...Array.from({ length: 30 }, (_, index) => ` ctx b${index}`),
    ];
    const [file] = createDiffViewerFilesFromPatch(
      patchOf(lines, 60, 62),
      "guide",
    );
    if (!file) {
      throw new Error("expected file");
    }
    const notes: DiffNote[] = [
      { anchorRow: 32, guideStartRow: 31, id: "n1", text: "note" },
    ];
    const { expected, actual } = await driftOf(file, notes);
    expect(actual - expected).toBe(0);
  });

  test("editing draft card is measured at its fixed rendered height (1-line)", async () => {
    const lines = [
      ...Array.from({ length: 30 }, (_, index) => ` ctx ${index}`),
      "+added",
      ...Array.from({ length: 30 }, (_, index) => ` ctx b${index}`),
    ];
    const [file] = createDiffViewerFilesFromPatch(
      patchOf(lines, 60, 61),
      "draft",
    );
    if (!file) {
      throw new Error("expected file");
    }
    const notes: DiffNote[] = [
      {
        anchorRow: 31,
        editing: true,
        id: "draft",
        onInput: () => undefined,
        onSave: () => undefined,
        text: "hello",
      },
    ];
    const { expected, actual } = await driftOf(file, notes);
    expect(actual - expected).toBe(0);
  });

  test("editing draft card is measured at its fixed rendered height (3-line)", async () => {
    const lines = [
      ...Array.from({ length: 30 }, (_, index) => ` ctx ${index}`),
      "+added",
      ...Array.from({ length: 30 }, (_, index) => ` ctx b${index}`),
    ];
    const [file] = createDiffViewerFilesFromPatch(
      patchOf(lines, 60, 61),
      "draft3",
    );
    if (!file) {
      throw new Error("expected file");
    }
    const notes: DiffNote[] = [
      {
        anchorRow: 31,
        editing: true,
        id: "draft",
        onInput: () => undefined,
        onSave: () => undefined,
        text: "hello\nworld\nthird",
      },
    ];
    const { expected, actual } = await driftOf(file, notes);
    expect(actual - expected).toBe(0);
  });

  test("unmounted card outside the window spacers at its true height", async () => {
    const lines = [
      ...Array.from({ length: 30 }, (_, index) => ` ctx ${index}`),
      "+added",
      ...Array.from({ length: 30 }, (_, index) => ` ctx b${index}`),
    ];
    const [file] = createDiffViewerFilesFromPatch(patchOf(lines, 60, 61), "v5");
    if (!file) {
      throw new Error("expected file");
    }
    const notes: DiffNote[] = [{ anchorRow: 61, id: "n1", text: "note" }];
    const { expected, actual } = await driftOf(file, notes);
    expect(actual - expected).toBe(0);
  });
});
