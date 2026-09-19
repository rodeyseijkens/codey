import { useEffect, useMemo } from "react";

import { resolveTheme } from "../theme/resolve";
import {
  CommentCard,
  measureCommentCardHeight,
} from "./annotations/CommentCard";
import {
  buildCanonicalDiffRows,
  type CanonicalDiffRow,
  toInternalDiffFile,
} from "./model";
import { findMaxLineNumber } from "./render/codeColumns";
import {
  buildSplitRows,
  buildStackRows,
  type DiffRow,
  type DiffRowPlan,
} from "./render/pierre";
import {
  type CursorHighlight,
  DiffRowView,
  diffMessage,
  fitText,
  measureRenderedRowHeight,
} from "./render/renderRows";
import { DEFAULT_TAB_WIDTH } from "./render/tabWidth";
import type { AgentAnnotation } from "./render/types";
import { useHighlightedDiff } from "./render/useHighlightedDiff";
import type { DiffBodyProps, DiffNote } from "./types";
import {
  buildRowOffsets,
  computeRowWindow,
  DEFAULT_WINDOW_OVERSCAN,
  type RowOffsets,
} from "./window";

const EMPTY_ROWS: DiffRow[] = [];
const EMPTY_PLAN: DiffRowPlan = {
  canonicalToLayout: [],
  layoutToCanonical: [],
  rows: [],
};

function cursorSideFor(cursor: CanonicalDiffRow): "old" | "new" {
  return cursor.kind === "add" ? "new" : "old";
}

function buildRowsForLayout(
  internalFile: ReturnType<typeof toInternalDiffFile>,
  layout: "split" | "stack",
  highlighted: ReturnType<typeof useHighlightedDiff>,
  theme: ReturnType<typeof resolveTheme>,
  tabWidth: number,
): DiffRowPlan {
  if (layout === "split") {
    return buildSplitRows(internalFile, highlighted, theme, tabWidth);
  }
  return buildStackRows(internalFile, highlighted, theme, tabWidth);
}

type PlannedBodyRow =
  | { kind: "diff"; row: DiffRow; layoutIndex: number }
  | {
      kind: "note";
      note: DiffNote;
      noteCount: number;
      noteIndex: number;
    };

/** Anchor notes to layout rows and interleave them after their anchored diff row. */
function buildPlannedRows(
  plan: DiffRowPlan,
  canonicalRows: readonly CanonicalDiffRow[],
  notes: readonly DiffNote[],
): PlannedBodyRow[] {
  const { canonicalToLayout, rows } = plan;
  const notesByLayoutIndex = new Map<number, DiffNote[]>();
  for (const note of notes) {
    const canonical = canonicalRows[note.anchorRow];
    if (!canonical) {
      continue;
    }
    const layoutIndex = canonicalToLayout[note.anchorRow] ?? -1;
    if (layoutIndex < 0) {
      continue;
    }
    const group = notesByLayoutIndex.get(layoutIndex) ?? [];
    group.push(note);
    notesByLayoutIndex.set(layoutIndex, group);
  }

  const planned: PlannedBodyRow[] = [];
  rows.forEach((row, index) => {
    planned.push({ kind: "diff", layoutIndex: index, row });
    const group = notesByLayoutIndex.get(index);
    group?.forEach((note, noteIndex) => {
      planned.push({ kind: "note", note, noteCount: group.length, noteIndex });
    });
  });
  return planned;
}

/** Guide side for each layout row covered by a note range (excluding anchors). */
function buildGuideSideByLayoutRow(
  plan: DiffRowPlan,
  canonicalRows: readonly CanonicalDiffRow[],
  notes: readonly DiffNote[],
): Map<number, "old" | "new"> {
  const map = new Map<number, "old" | "new">();
  for (const note of notes) {
    const start = note.guideStartRow ?? note.anchorRow;
    for (let index = start; index < note.anchorRow; index += 1) {
      const canonical = canonicalRows[index];
      if (!canonical) {
        continue;
      }
      const layoutIndex = plan.canonicalToLayout[index] ?? -1;
      if (layoutIndex < 0 || map.has(layoutIndex)) {
        continue;
      }
      map.set(layoutIndex, canonical.kind === "add" ? "new" : "old");
    }
  }
  return map;
}

/** Set of layout row indices that fall inside a note range (including the anchor). */
function buildCommentMarkedLayoutRows(
  plan: DiffRowPlan,
  canonicalRows: readonly CanonicalDiffRow[],
  notes: readonly DiffNote[],
): Set<number> {
  const set = new Set<number>();
  for (const note of notes) {
    const start = note.guideStartRow ?? note.anchorRow;
    for (let index = start; index <= note.anchorRow; index += 1) {
      const canonical = canonicalRows[index];
      if (!canonical) {
        continue;
      }
      const layoutIndex = plan.canonicalToLayout[index] ?? -1;
      if (layoutIndex >= 0) {
        set.add(layoutIndex);
      }
    }
  }
  return set;
}

function lineRangeForRows(
  rows: readonly CanonicalDiffRow[],
  startRow: number,
  endRow: number,
  side: "old" | "new",
): [number, number] | undefined {
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

function noteToAnnotation(
  note: DiffNote,
  rows: readonly CanonicalDiffRow[],
): AgentAnnotation {
  const start = note.guideStartRow ?? note.anchorRow;
  return {
    editable: true,
    id: note.id,
    newRange: lineRangeForRows(rows, start, note.anchorRow, "new"),
    oldRange: lineRangeForRows(rows, start, note.anchorRow, "old"),
    source: note.editing ? "user-draft" : "user",
    summary: note.text,
  };
}

function noteAnchorSide(
  note: DiffNote,
  rows: readonly CanonicalDiffRow[],
): "old" | "new" {
  const row = rows[note.anchorRow];
  if (row?.kind === "add") {
    return "new";
  }
  return "old";
}

/** Render one diff file body with inline notes, without owning navigation or app chrome. */
export function DiffBody({
  file,
  internalFile: internalFileProp,
  layout = "split",
  width,
  theme = "github-dark-default",
  showLineNumbers = true,
  showHunkHeaders = true,
  gutterSign = false,
  tabWidth = DEFAULT_TAB_WIDTH,
  wrapLines = false,
  horizontalOffset = 0,
  highlight = true,
  selectedHunkIndex = 0,
  cursorRow,
  anchorRow,
  lineHighlights,
  onCursorOffsetResolved,
  onRowMouseDown,
  notes = [],
  scrollTop = 0,
  viewportHeight,
  overscan = DEFAULT_WINDOW_OVERSCAN,
}: DiffBodyProps) {
  const resolvedTheme = resolveTheme(theme, null);
  const internalFile = useMemo(
    () => internalFileProp ?? (file ? toInternalDiffFile(file) : undefined),
    [internalFileProp, file],
  );
  const resolvedHighlighted = useHighlightedDiff({
    file: internalFile,
    shouldLoadHighlight: highlight,
    theme: resolvedTheme,
  });
  const plan = useMemo(
    () =>
      internalFile
        ? buildRowsForLayout(
            internalFile,
            layout,
            resolvedHighlighted,
            resolvedTheme,
            tabWidth,
          )
        : EMPTY_PLAN,
    [internalFile, layout, resolvedHighlighted, resolvedTheme, tabWidth],
  );
  const rows = plan.rows.length > 0 ? plan.rows : EMPTY_ROWS;
  const canonicalRows = useMemo(
    () => (file ? (file.canonicalRows ?? buildCanonicalDiffRows(file)) : []),
    [file],
  );
  const cursor = useMemo(
    () => (cursorRow === undefined ? undefined : canonicalRows[cursorRow]),
    [cursorRow, canonicalRows],
  );
  const resolvedCursorRow = useMemo(
    () =>
      cursorRow === undefined ? -1 : (plan.canonicalToLayout[cursorRow] ?? -1),
    [cursorRow, plan],
  );
  const resolvedAnchorRow = useMemo(
    () =>
      anchorRow === undefined ? -1 : (plan.canonicalToLayout[anchorRow] ?? -1),
    [anchorRow, plan],
  );
  const visualSelectLayoutRows = useMemo(() => {
    if (resolvedAnchorRow < 0 || resolvedCursorRow < 0) {
      return new Set<number>();
    }
    const min = Math.min(resolvedAnchorRow, resolvedCursorRow);
    const max = Math.max(resolvedAnchorRow, resolvedCursorRow);
    const set = new Set<number>();
    for (let i = min; i <= max; i += 1) {
      set.add(i);
    }
    return set;
  }, [resolvedAnchorRow, resolvedCursorRow]);
  const plannedRows = useMemo(
    () => buildPlannedRows(plan, canonicalRows, notes),
    [plan, canonicalRows, notes],
  );
  const guideSideByLayoutRow = useMemo(
    () => buildGuideSideByLayoutRow(plan, canonicalRows, notes),
    [plan, canonicalRows, notes],
  );
  const commentMarkedLayoutRows = useMemo(
    () => buildCommentMarkedLayoutRows(plan, canonicalRows, notes),
    [plan, canonicalRows, notes],
  );

  const lineNumberDigits = useMemo(
    () => String(internalFile ? findMaxLineNumber(internalFile) : 1).length,
    [internalFile],
  );

  /**
   * Measure every planned row once per row-plan/geometry change. The offsets double as
   * exact cursor offsets and window slice bounds, so the walk stays O(rows) with cheap
   * constant work per row while only the visible window is mounted.
   */
  const layoutMetrics = useMemo(() => {
    const heights: number[] = [];
    const plannedIndexOfLayout = new Map<number, number>();
    plannedRows.forEach((planned, plannedIndex) => {
      if (planned.kind === "diff") {
        heights.push(
          measureRenderedRowHeight(
            planned.row,
            width,
            lineNumberDigits,
            showLineNumbers,
            showHunkHeaders,
            wrapLines,
            resolvedTheme,
            gutterSign,
            guideSideByLayoutRow.get(planned.layoutIndex),
          ),
        );
        if (!plannedIndexOfLayout.has(planned.layoutIndex)) {
          plannedIndexOfLayout.set(planned.layoutIndex, plannedIndex);
        }
      } else {
        heights.push(
          measureCommentCardHeight({
            anchorSide: noteAnchorSide(planned.note, canonicalRows),
            annotation: noteToAnnotation(planned.note, canonicalRows),
            layout,
            width,
          }),
        );
      }
    });
    const offsets: RowOffsets = buildRowOffsets(heights);
    return { offsets, plannedIndexOfLayout };
  }, [
    plannedRows,
    width,
    lineNumberDigits,
    showLineNumbers,
    showHunkHeaders,
    wrapLines,
    resolvedTheme,
    canonicalRows,
    layout,
    guideSideByLayoutRow,
    gutterSign,
  ]);

  const cursorPlannedIndex =
    resolvedCursorRow >= 0
      ? layoutMetrics.plannedIndexOfLayout.get(resolvedCursorRow)
      : undefined;

  const cursorOffset = useMemo(() => {
    if (cursorPlannedIndex === undefined) {
      return;
    }
    return layoutMetrics.offsets.prefix[cursorPlannedIndex];
  }, [layoutMetrics, cursorPlannedIndex]);

  useEffect(() => {
    if (cursorOffset !== undefined) {
      onCursorOffsetResolved?.(cursorOffset);
    }
  }, [cursorOffset, onCursorOffsetResolved]);

  const rowWindow = useMemo(() => {
    if ((viewportHeight ?? 0) <= 0) {
      return;
    }
    return computeRowWindow(
      layoutMetrics.offsets.prefix,
      scrollTop,
      viewportHeight ?? 0,
      overscan,
      cursorPlannedIndex,
    );
  }, [layoutMetrics, scrollTop, viewportHeight, overscan, cursorPlannedIndex]);

  const visiblePlannedRows = rowWindow
    ? plannedRows.slice(rowWindow.start, rowWindow.end)
    : plannedRows;

  const cursorHighlight: CursorHighlight | undefined = useMemo(
    () =>
      cursor && resolvedCursorRow >= 0
        ? {
            side: cursorSideFor(cursor),
            stableKey: `row:${rows[resolvedCursorRow]?.key ?? ""}`,
            style: "row",
          }
        : undefined,
    [cursor, resolvedCursorRow, rows],
  );

  if (!internalFile) {
    return (
      <box style={{ paddingLeft: 1, paddingRight: 1, width: "100%" }}>
        <text fg={resolvedTheme.muted}>
          {fitText("No file selected.", Math.max(1, width - 2))}
        </text>
      </box>
    );
  }

  if (internalFile.metadata.hunks.length === 0) {
    return (
      <box
        style={{
          paddingBottom: 1,
          paddingLeft: 1,
          paddingRight: 1,
          width: "100%",
        }}
      >
        <text fg={resolvedTheme.muted}>
          {fitText(diffMessage(internalFile), Math.max(1, width - 2))}
        </text>
      </box>
    );
  }

  return (
    <box style={{ flexDirection: "column", width: "100%" }}>
      {rowWindow && rowWindow.topOffset > 0 ? (
        <box style={{ height: rowWindow.topOffset, width: "100%" }} />
      ) : null}
      {visiblePlannedRows.map((planned) => {
        if (planned.kind === "note") {
          return (
            <CommentCard
              anchorSide={noteAnchorSide(planned.note, canonicalRows)}
              annotation={noteToAnnotation(planned.note, canonicalRows)}
              draft={
                planned.note.editing
                  ? {
                      body: planned.note.text,
                      focused: true,
                      onCancel: () => planned.note.onCancel?.(),
                      onInput: (value) => planned.note.onInput?.(value),
                      onSave: () => planned.note.onSave?.(planned.note.text),
                    }
                  : undefined
              }
              file={internalFile}
              key={`note:${planned.note.id}`}
              layout={layout}
              noteCount={planned.noteCount}
              noteIndex={planned.noteIndex}
              onDelete={planned.note.onDelete}
              theme={resolvedTheme}
              width={width}
            />
          );
        }
        const { layoutIndex, row } = planned;
        return (
          <box
            key={row.key}
            onMouseDown={() => {
              const ci = plan.layoutToCanonical[layoutIndex];
              if (ci !== undefined) {
                onRowMouseDown?.(ci);
              }
            }}
            style={{ flexDirection: "column", width: "100%" }}
          >
            <DiffRowView
              codeHorizontalOffset={horizontalOffset}
              commentMarked={commentMarkedLayoutRows.has(layoutIndex)}
              cursorHighlight={
                layoutIndex === resolvedCursorRow ? cursorHighlight : undefined
              }
              lineHighlights={lineHighlights}
              lineNumberDigits={lineNumberDigits}
              noteGuideSide={guideSideByLayoutRow.get(layoutIndex)}
              row={row}
              selected={
                row.hunkIndex === selectedHunkIndex ||
                layoutIndex === resolvedCursorRow
              }
              showHunkHeaders={showHunkHeaders}
              showLineNumbers={showLineNumbers}
              showSign={gutterSign}
              theme={resolvedTheme}
              visualSelect={visualSelectLayoutRows.has(layoutIndex)}
              width={width}
              wrapLines={wrapLines}
            />
          </box>
        );
      })}
      {rowWindow && rowWindow.bottomSpacer > 0 ? (
        <box style={{ height: rowWindow.bottomSpacer, width: "100%" }} />
      ) : null}
    </box>
  );
}
