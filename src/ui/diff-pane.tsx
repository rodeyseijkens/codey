import type { KeyEvent, ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { getFiletypeFromFileName } from "@pierre/diffs";
import { useEffect, useMemo, useRef, useState } from "react";
import { keyEventToChord } from "../keymap/chords";
import type { CommandId } from "../keymap/commands";
import { lookupCommand, type ResolvedKeymap } from "../keymap/index";
import { focusDiff } from "../state/actions";
import {
  cancelCommentDraft,
  deleteComment,
  saveCommentDraft,
  updateCommentDraft,
} from "../state/comment-actions";
import { getStore, useAppState } from "../state/store";
import { useColors } from "./color-context";
import {
  buildCanonicalDiffRows,
  type CanonicalDiffRow,
  createHunkDiffFilesFromPatch,
  HunkDiffBody,
  type HunkDiffNote,
} from "./hunk-diff/opentui";

import { toInternalDiffFile } from "./hunk-diff/opentui/model";
import { buildLineHighlightPaintIndex } from "./hunk-diff/ui/diff/lineHighlightPaint";
import type { ValidatedLineHighlight } from "./hunk-diff/ui/highlights/validate";
import { useKeymap } from "./keymap-context";

function resolveViewMode(
  layoutMode: string,
  termWidth: number
): "split" | "stack" {
  if (layoutMode === "split") {
    return "split";
  }
  if (layoutMode === "stack") {
    return "stack";
  }
  return termWidth >= 160 ? "split" : "stack";
}

/** Minimum lines of context kept above/below the cursor when scrolling. */
const SCROLLOFF = 5;

function isChange(row: CanonicalDiffRow | undefined): boolean {
  return !!row && (row.kind === "add" || row.kind === "del");
}

function jumpToChange(
  store: ReturnType<typeof getStore>,
  rows: readonly CanonicalDiffRow[],
  cmd: CommandId,
  cursorRow: number
): void {
  if (cmd === "next-hunk") {
    jumpToNextChange(store, rows, cursorRow);
  } else {
    jumpToPrevChange(store, rows, cursorRow);
  }
}

function jumpToNextChange(
  store: ReturnType<typeof getStore>,
  rows: readonly CanonicalDiffRow[],
  cursorRow: number
): void {
  let i = cursorRow + 1;
  if (isChange(rows[cursorRow])) {
    while (i < rows.length && isChange(rows[i])) {
      i += 1;
    }
  }
  while (i < rows.length) {
    if (isChange(rows[i])) {
      store.set({ cursorRow: i });
      return;
    }
    i += 1;
  }
}

function jumpToPrevChange(
  store: ReturnType<typeof getStore>,
  rows: readonly CanonicalDiffRow[],
  cursorRow: number
): void {
  let i = cursorRow - 1;
  if (isChange(rows[cursorRow])) {
    while (i >= 0 && isChange(rows[i])) {
      i -= 1;
    }
  }
  while (i >= 0) {
    if (isChange(rows[i])) {
      let blockStart = i;
      while (blockStart > 0 && isChange(rows[blockStart - 1])) {
        blockStart -= 1;
      }
      store.set({ cursorRow: blockStart });
      return;
    }
    i -= 1;
  }
}

/** Build whole-line paint marks for one comment's canonical row range. */
function commentMarksForRange(
  rows: readonly CanonicalDiffRow[],
  startRow: number,
  endRow: number
): ValidatedLineHighlight[] {
  const marks: ValidatedLineHighlight[] = [];
  const start = Math.max(0, startRow);
  const end = Math.min(endRow, rows.length - 1);
  for (let index = start; index <= end; index += 1) {
    const row = rows[index];
    if (!row) {
      continue;
    }
    if (row.kind === "add" && row.newLine !== undefined) {
      marks.push({
        end: Number.MAX_SAFE_INTEGER,
        line: row.newLine,
        side: "new",
        start: 0,
        tone: "info",
      });
    } else if (row.kind === "del" && row.oldLine !== undefined) {
      marks.push({
        end: Number.MAX_SAFE_INTEGER,
        line: row.oldLine,
        side: "old",
        start: 0,
        tone: "info",
      });
    } else if (row.kind === "context") {
      if (row.oldLine !== undefined) {
        marks.push({
          end: Number.MAX_SAFE_INTEGER,
          line: row.oldLine,
          side: "old",
          start: 0,
          tone: "info",
        });
      }
      if (row.newLine !== undefined) {
        marks.push({
          end: Number.MAX_SAFE_INTEGER,
          line: row.newLine,
          side: "new",
          start: 0,
          tone: "info",
        });
      }
    }
  }
  return marks;
}

function resolveDiffPaneKey(key: string): CommandId | undefined {
  if (key === "up") {
    return "select-prev";
  }
  if (key === "down") {
    return "select-next";
  }
  if (key === "pageup") {
    return "page-up";
  }
  if (key === "pagedown") {
    return "page-down";
  }
}

function applyPageScroll(
  scrollRef: ScrollBoxRenderable | null,
  direction: -1 | 1
) {
  if (!scrollRef) {
    return;
  }
  const viewportHeight = scrollRef.viewport.height;
  if (viewportHeight <= 0) {
    return;
  }
  const delta = direction * viewportHeight;
  scrollRef.scrollTop = Math.max(
    0,
    Math.min(
      scrollRef.scrollHeight - viewportHeight,
      scrollRef.scrollTop + delta
    )
  );
}

function applyHalfPageScroll(
  scrollRef: ScrollBoxRenderable | null,
  store: ReturnType<typeof getStore>,
  rowCount: number,
  cursorRow: number,
  direction: -1 | 1
) {
  const viewportHeight = scrollRef?.viewport.height ?? 0;
  if (scrollRef && viewportHeight > 0) {
    const delta = direction * (viewportHeight / 2);
    scrollRef.scrollTop = Math.max(
      0,
      Math.min(
        scrollRef.scrollHeight - viewportHeight,
        scrollRef.scrollTop + delta
      )
    );
  }
  store.set({
    cursorRow: Math.max(
      0,
      Math.min(
        rowCount - 1,
        cursorRow + Math.floor(viewportHeight / 2) * direction
      )
    ),
  });
}

export function handleDiffPaneKey(
  e: KeyEvent,
  store: ReturnType<typeof getStore>,
  keymap: ResolvedKeymap,
  rows: readonly CanonicalDiffRow[],
  scrollRef: ScrollBoxRenderable | null = null
): void {
  const s = store.getState();
  if (s.focus !== "diff" || s.overlay || s.commentDraft) {
    return;
  }
  const chord = keyEventToChord(e);
  if (!chord) {
    return;
  }
  const cmd = lookupCommand(keymap, chord);
  const rowCount = rows.length;
  if (rowCount === 0) {
    return;
  }

  let effectiveCmd = cmd;
  if (!effectiveCmd) {
    effectiveCmd = resolveDiffPaneKey(chord.key);
  }
  if (!effectiveCmd) {
    return;
  }

  if (effectiveCmd === "page-up") {
    applyPageScroll(scrollRef, -1);
    return;
  }
  if (effectiveCmd === "page-down") {
    applyPageScroll(scrollRef, 1);
    return;
  }
  if (effectiveCmd === "page-cursor-half-up") {
    applyHalfPageScroll(scrollRef, store, rowCount, s.cursorRow, -1);
    return;
  }
  if (effectiveCmd === "page-cursor-half-down") {
    applyHalfPageScroll(scrollRef, store, rowCount, s.cursorRow, 1);
    return;
  }

  if (effectiveCmd === "select-next") {
    store.set({ cursorRow: Math.min(s.cursorRow + 1, rowCount - 1) });
    return;
  }
  if (effectiveCmd === "select-prev") {
    store.set({ cursorRow: Math.max(s.cursorRow - 1, 0) });
    return;
  }
  if (effectiveCmd === "next-hunk" || effectiveCmd === "prev-hunk") {
    jumpToChange(store, rows, effectiveCmd, s.cursorRow);
  }
}

export function DiffPane() {
  const state = useAppState();
  const keymap = useKeymap();
  const store = getStore();
  const dims = useTerminalDimensions();
  const { ui: C } = useColors();
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const [cursorOffset, setCursorOffset] = useState(0);
  const [forceScrollToTop, setForceScrollToTop] = useState(false);
  const [pendingFirstChange, setPendingFirstChange] = useState<number | null>(
    null
  );
  const prevFilePathRef = useRef<string | undefined>(undefined);

  const sel = store.selectedFile();
  const file = sel?.file;

  const hunkFiles = useMemo(
    () =>
      file?.diff
        ? createHunkDiffFilesFromPatch(file.diff, file.path).map((f) => ({
            ...f,
            language: getFiletypeFromFileName(file.path),
          }))
        : [],
    [file?.diff, file?.path]
  );
  const [hunkFile] = hunkFiles;
  const internalFile = useMemo(
    () => (hunkFile ? toInternalDiffFile(hunkFile) : undefined),
    [hunkFile]
  );
  const rows = useMemo(
    () => (hunkFile ? buildCanonicalDiffRows(hunkFile) : []),
    [hunkFile]
  );

  const comments = useMemo(() => {
    if (!sel) {
      return [];
    }
    return state.comments.filter(
      (c) => c.scope === sel.scope && c.path === sel.file.path
    );
  }, [state.comments, sel]);

  const notes = useMemo<HunkDiffNote[]>(() => {
    const draft = state.commentDraft;
    const list: HunkDiffNote[] = comments.map((comment) => {
      const editing = draft?.mode === "edit" && draft.commentId === comment.id;
      return {
        anchorRow: comment.endRow,
        editing,
        guideStartRow: comment.startRow,
        id: comment.id,
        onCancel: editing ? cancelCommentDraft : undefined,
        onDelete: editing ? undefined : () => deleteComment(comment.id),
        onInput: editing ? updateCommentDraft : undefined,
        onSave: editing ? saveCommentDraft : undefined,
        text: editing ? (draft?.text ?? comment.text) : comment.text,
      };
    });
    if (draft?.mode === "add") {
      list.push({
        anchorRow: draft.endRow,
        editing: true,
        guideStartRow: draft.startRow,
        id: "draft",
        onCancel: cancelCommentDraft,
        onInput: updateCommentDraft,
        onSave: saveCommentDraft,
        text: draft.text,
      });
    }
    return list;
  }, [comments, state.commentDraft]);

  const lineHighlights = useMemo(() => {
    if (!internalFile || comments.length === 0) {
      return;
    }
    const marks = comments.flatMap((c) =>
      commentMarksForRange(rows, c.startRow, c.endRow)
    );
    return buildLineHighlightPaintIndex({ file: internalFile, marks });
  }, [internalFile, comments, rows]);

  const viewMode = resolveViewMode(state.layoutMode, dims.width);
  const contentWidth = Math.max(
    10,
    dims.width - (state.sidebarVisible ? state.sidebarWidth : 0)
  );

  useKeyboard((e) => {
    handleDiffPaneKey(e, store, keymap, rows, scrollRef.current);
  });

  useEffect(() => {
    if (file?.path !== prevFilePathRef.current) {
      prevFilePathRef.current = file?.path;
      const firstChange = rows.findIndex(
        (row) => row.kind === "add" || row.kind === "del"
      );
      if (firstChange >= 0) {
        setPendingFirstChange(firstChange);
        store.set({ cursorRow: firstChange });
      } else {
        setPendingFirstChange(null);
      }
    }
  }, [file?.path, rows, store]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll === null) {
      return;
    }
    const viewportHeight = scroll.viewport.height;
    if (viewportHeight <= 0) {
      return;
    }
    if (forceScrollToTop) {
      scroll.scrollTop = Math.max(0, cursorOffset - SCROLLOFF);
      setForceScrollToTop(false);
      return;
    }
    if (state.focus !== "diff") {
      return;
    }
    const bottom = scroll.scrollTop + viewportHeight - 1;
    if (cursorOffset - SCROLLOFF < scroll.scrollTop) {
      scroll.scrollTop = Math.max(0, cursorOffset - SCROLLOFF);
    } else if (cursorOffset + SCROLLOFF > bottom) {
      scroll.scrollTop = Math.max(
        0,
        cursorOffset - viewportHeight + 1 + SCROLLOFF
      );
    }
  }, [cursorOffset, forceScrollToTop, state.focus]);

  if (!(sel && file)) {
    return (
      <box
        style={{
          backgroundColor: C.bg,
          flexGrow: 1,
          paddingLeft: 2,
        }}
      >
        <text style={{ fg: C.faint }}>No file selected — j/k to navigate</text>
      </box>
    );
  }

  if (file.ignored) {
    return (
      <box
        style={{
          backgroundColor: C.bg,
          flexGrow: 1,
          paddingLeft: 2,
        }}
      >
        <text style={{ fg: C.faint }}>Ignored file — no diff loaded</text>
      </box>
    );
  }

  if (file.isBinary) {
    return (
      <box
        style={{
          backgroundColor: C.bg,
          flexGrow: 1,
          paddingLeft: 2,
        }}
      >
        <text style={{ fg: C.faint }}>Binary file — no diff</text>
      </box>
    );
  }

  if (file.tooLarge) {
    return (
      <box
        style={{
          backgroundColor: C.bg,
          flexGrow: 1,
          paddingLeft: 2,
        }}
      >
        <text style={{ fg: C.yellow }}>
          File too large to diff (&gt;2 MB or 50k lines)
        </text>
      </box>
    );
  }

  if (!(file.diff && hunkFile)) {
    return (
      <box
        style={{
          backgroundColor: C.bg,
          flexGrow: 1,
          paddingLeft: 2,
        }}
      >
        <text style={{ fg: C.faint }}>No diff content</text>
      </box>
    );
  }

  return (
    <box
      onMouseDown={(e) => {
        if (e.button === 0) {
          focusDiff();
        }
      }}
      style={{
        backgroundColor: C.bg,
        border: ["top"],
        borderColor: state.focus === "diff" ? C.accent : C.bg,
        borderStyle: "single",
        flexDirection: "column",
      }}
    >
      <box
        style={{
          backgroundColor: C.panel,
          flexDirection: "row",
          height: 1,
          paddingLeft: 2,
          paddingRight: 2,
        }}
      >
        <text style={{ fg: C.accent, flexGrow: 1, overflow: "hidden" }}>
          {file.oldPath && file.oldPath !== file.path
            ? `${file.oldPath} -> ${file.path}`
            : file.path}
        </text>
        <text style={{ fg: C.faint, marginLeft: 1 }}>
          {rows.length} lines · {viewMode}
        </text>
      </box>
      <scrollbox
        focused={false}
        height="100%"
        ref={(el: ScrollBoxRenderable) => {
          scrollRef.current = el;
        }}
        scrollY={true}
        viewportCulling={false}
        width="100%"
      >
        <HunkDiffBody
          cursorRow={state.cursorRow}
          file={hunkFile}
          gutterSign={state.gutterSign}
          layout={viewMode}
          lineHighlights={lineHighlights}
          notes={notes}
          onCursorOffsetResolved={(offset) => {
            setCursorOffset(offset);
            if (pendingFirstChange !== null) {
              setPendingFirstChange(null);
              setForceScrollToTop(true);
            }
          }}
          showHunkHeaders={false}
          showLineNumbers={state.lineNumbers}
          tabWidth={state.tabWidth}
          theme={state.theme}
          width={contentWidth}
          wrapLines={state.wrapLines}
        />
      </scrollbox>
    </box>
  );
}
