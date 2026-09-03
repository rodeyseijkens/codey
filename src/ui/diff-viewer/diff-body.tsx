import { useEffect, useMemo } from "react";

import { resolveTheme } from "../theme/resolve";
import {
  CommentCard,
  measureCommentCardHeight,
} from "./annotations/CommentCard";
import { toInternalDiffFile } from "./model";
import { findMaxLineNumber } from "./render/codeColumns";
import { buildSplitRows, buildStackRows } from "./render/pierre";
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
import { buildCanonicalDiffRows, type CanonicalDiffRow } from "./rows";
import type { DiffBodyProps, DiffNote } from "./types";

function cursorSideFor(cursor: CanonicalDiffRow): "old" | "new" {
  return cursor.kind === "add" ? "new" : "old";
}

function splitLineMatchesCursor(
  row: Extract<
    ReturnType<typeof buildSplitRows>[number],
    { type: "split-line" }
  >,
  cursor: CanonicalDiffRow,
): boolean {
  if (cursor.kind === "add") {
    return row.right.lineNumber === cursor.newLine;
  }
  if (cursor.kind === "del") {
    return row.left.lineNumber === cursor.oldLine;
  }
  return (
    row.left.lineNumber === cursor.oldLine ||
    row.right.lineNumber === cursor.newLine
  );
}

function stackLineMatchesCursor(
  row: Extract<
    ReturnType<typeof buildStackRows>[number],
    { type: "stack-line" }
  >,
  cursor: CanonicalDiffRow,
): boolean {
  if (cursor.kind === "add") {
    return row.cell.newLineNumber === cursor.newLine;
  }
  if (cursor.kind === "del") {
    return row.cell.oldLineNumber === cursor.oldLine;
  }
  return (
    row.cell.oldLineNumber === cursor.oldLine ||
    row.cell.newLineNumber === cursor.newLine
  );
}

/** Resolve one canonical row to its rendered layout row index. */
function resolveLayoutRow(
  cursor: CanonicalDiffRow,
  canonicalRows: readonly CanonicalDiffRow[],
  canonicalIndex: number,
  rows: ReturnType<typeof buildStackRows>,
): number {
  if (cursor.kind === "header") {
    return rows.findIndex(
      (row) => row.type === "hunk-header" && row.hunkIndex === cursor.hunkIndex,
    );
  }
  if (cursor.kind === "gap") {
    // Gap rows are 1:1 with the canonical list in the same order.
    let ordinal = 0;
    for (let i = 0; i < canonicalIndex; i += 1) {
      const row = canonicalRows[i];
      if (row?.kind === "gap") {
        ordinal += 1;
      }
    }
    let seen = 0;
    return rows.findIndex((row) => {
      if (row.type !== "collapsed") {
        return false;
      }
      if (seen === ordinal) {
        return true;
      }
      seen += 1;
      return false;
    });
  }

  const headerIndex = rows.findIndex(
    (row) => row.type === "hunk-header" && row.hunkIndex === cursor.hunkIndex,
  );
  if (headerIndex < 0) {
    return -1;
  }
  for (let index = headerIndex; index < rows.length; index += 1) {
    const row = rows[index];
    if (row === undefined || row.hunkIndex !== cursor.hunkIndex) {
      break;
    }
    if (row.type === "split-line" && splitLineMatchesCursor(row, cursor)) {
      return index;
    }
    if (row.type === "stack-line" && stackLineMatchesCursor(row, cursor)) {
      return index;
    }
  }
  return -1;
}

function buildRowsForLayout(
  internalFile: ReturnType<typeof toInternalDiffFile>,
  layout: "split" | "stack",
  highlighted: ReturnType<typeof useHighlightedDiff>,
  theme: ReturnType<typeof resolveTheme>,
  tabWidth: number,
): ReturnType<typeof buildStackRows> {
  if (layout === "split") {
    return buildSplitRows(internalFile, highlighted, theme, tabWidth);
  }
  return buildStackRows(internalFile, highlighted, theme, tabWidth);
}

type PlannedBodyRow =
  | { kind: "diff"; row: ReturnType<typeof buildStackRows>[number] }
  | {
      kind: "note";
      note: DiffNote;
      noteCount: number;
      noteIndex: number;
    };

/** Anchor notes to layout rows and interleave them after their anchored diff row. */
function buildPlannedRows(
  rows: ReturnType<typeof buildStackRows>,
  canonicalRows: readonly CanonicalDiffRow[],
  notes: readonly DiffNote[],
): PlannedBodyRow[] {
  const notesByLayoutIndex = new Map<number, DiffNote[]>();
  for (const note of notes) {
    const canonical = canonicalRows[note.anchorRow];
    if (!canonical) {
      continue;
    }
    const layoutIndex = resolveLayoutRow(
      canonical,
      canonicalRows,
      note.anchorRow,
      rows,
    );
    if (layoutIndex < 0) {
      continue;
    }
    const group = notesByLayoutIndex.get(layoutIndex) ?? [];
    group.push(note);
    notesByLayoutIndex.set(layoutIndex, group);
  }

  const planned: PlannedBodyRow[] = [];
  rows.forEach((row, index) => {
    planned.push({ kind: "diff", row });
    const group = notesByLayoutIndex.get(index);
    group?.forEach((note, noteIndex) => {
      planned.push({ kind: "note", note, noteCount: group.length, noteIndex });
    });
  });
  return planned;
}

/** Guide side for each layout row covered by a note range (excluding anchors). */
function buildGuideSideByLayoutRow(
  rows: ReturnType<typeof buildStackRows>,
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
      const layoutIndex = resolveLayoutRow(
        canonical,
        canonicalRows,
        index,
        rows,
      );
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
  rows: ReturnType<typeof buildStackRows>,
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
      const layoutIndex = resolveLayoutRow(
        canonical,
        canonicalRows,
        index,
        rows,
      );
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
}: DiffBodyProps) {
  const resolvedTheme = resolveTheme(theme, null);
  const internalFile = useMemo(
    () => (file ? toInternalDiffFile(file) : undefined),
    [file],
  );
  const resolvedHighlighted = useHighlightedDiff({
    file: internalFile,
    shouldLoadHighlight: highlight,
    theme: resolvedTheme,
  });
  const rows = useMemo(
    () =>
      internalFile
        ? buildRowsForLayout(
            internalFile,
            layout,
            resolvedHighlighted,
            resolvedTheme,
            tabWidth,
          )
        : [],
    [internalFile, layout, resolvedHighlighted, resolvedTheme, tabWidth],
  );
  const canonicalRows = useMemo(
    () => (file ? buildCanonicalDiffRows(file) : []),
    [file],
  );
  const cursor = useMemo(
    () => (cursorRow === undefined ? undefined : canonicalRows[cursorRow]),
    [cursorRow, canonicalRows],
  );
  const resolvedCursorRow = useMemo(
    () =>
      cursor && cursorRow !== undefined
        ? resolveLayoutRow(cursor, canonicalRows, cursorRow, rows)
        : -1,
    [cursor, cursorRow, canonicalRows, rows],
  );
  const anchor = useMemo(
    () => (anchorRow === undefined ? undefined : canonicalRows[anchorRow]),
    [anchorRow, canonicalRows],
  );
  const resolvedAnchorRow = useMemo(
    () =>
      anchor !== undefined && anchorRow !== undefined
        ? resolveLayoutRow(anchor, canonicalRows, anchorRow, rows)
        : -1,
    [anchor, anchorRow, canonicalRows, rows],
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
    () => buildPlannedRows(rows, canonicalRows, notes),
    [rows, canonicalRows, notes],
  );
  const guideSideByLayoutRow = useMemo(
    () => buildGuideSideByLayoutRow(rows, canonicalRows, notes),
    [rows, canonicalRows, notes],
  );
  const commentMarkedLayoutRows = useMemo(
    () => buildCommentMarkedLayoutRows(rows, canonicalRows, notes),
    [rows, canonicalRows, notes],
  );

  const layoutToCanonical = useMemo(() => {
    const map = new Map<number, number>();
    for (let i = 0; i < canonicalRows.length; i += 1) {
      const cr = canonicalRows[i];
      if (!cr) {
        continue;
      }
      const layoutIndex = resolveLayoutRow(cr, canonicalRows, i, rows);
      if (layoutIndex >= 0) {
        map.set(layoutIndex, i);
      }
    }
    return map;
  }, [canonicalRows, rows]);

  const lineNumberDigits = useMemo(
    () => String(internalFile ? findMaxLineNumber(internalFile) : 1).length,
    [internalFile],
  );

  const cursorOffset = useMemo(() => {
    if (resolvedCursorRow < 0) {
      return;
    }
    let offset = 0;
    for (const planned of plannedRows) {
      if (planned.kind === "diff") {
        const { row } = planned;
        if (row === rows[resolvedCursorRow]) {
          return offset;
        }
        offset += measureRenderedRowHeight(
          row,
          width,
          lineNumberDigits,
          showLineNumbers,
          showHunkHeaders,
          wrapLines,
          resolvedTheme,
          gutterSign,
        );
      } else {
        offset += measureCommentCardHeight({
          anchorSide: noteAnchorSide(planned.note, canonicalRows),
          annotation: noteToAnnotation(planned.note, canonicalRows),
          layout,
          width,
        });
      }
    }
    return offset;
  }, [
    plannedRows,
    resolvedCursorRow,
    rows,
    width,
    lineNumberDigits,
    showLineNumbers,
    showHunkHeaders,
    wrapLines,
    resolvedTheme,
    canonicalRows,
    layout,
    gutterSign,
  ]);

  useEffect(() => {
    if (cursorOffset !== undefined) {
      onCursorOffsetResolved?.(cursorOffset);
    }
  }, [cursorOffset, onCursorOffsetResolved]);

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
      {plannedRows.map((planned) => {
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
        const { row } = planned;
        const rowIndex = rows.indexOf(row);
        return (
          <box
            key={row.key}
            onMouseDown={() => {
              const ci = layoutToCanonical.get(rowIndex);
              if (ci !== undefined) {
                onRowMouseDown?.(ci);
              }
            }}
            style={{ flexDirection: "column", width: "100%" }}
          >
            <DiffRowView
              codeHorizontalOffset={horizontalOffset}
              commentMarked={commentMarkedLayoutRows.has(rowIndex)}
              cursorHighlight={
                rowIndex === resolvedCursorRow ? cursorHighlight : undefined
              }
              lineHighlights={lineHighlights}
              lineNumberDigits={lineNumberDigits}
              noteGuideSide={guideSideByLayoutRow.get(rowIndex)}
              row={row}
              selected={
                row.hunkIndex === selectedHunkIndex ||
                rowIndex === resolvedCursorRow
              }
              showHunkHeaders={showHunkHeaders}
              showLineNumbers={showLineNumbers}
              showSign={gutterSign}
              theme={resolvedTheme}
              visualSelect={visualSelectLayoutRows.has(rowIndex)}
              width={width}
              wrapLines={wrapLines}
            />
          </box>
        );
      })}
    </box>
  );
}
