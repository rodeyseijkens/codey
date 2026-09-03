import { useEffect, useMemo, useRef, useState } from "react";
import type { ScrollBoxRenderable } from "@opentui/core";
import { useTerminalDimensions } from "@opentui/react";
import { getFiletypeFromFileName } from "@pierre/diffs";

import { focusDiff } from "../state/actions/navigation";
import {
  cancelCommentDraft,
  deleteComment,
  saveCommentDraft,
  updateCommentDraft,
} from "../state/comment-actions";
import { getStore, useAppState } from "../state/store";
import { LAYOUT_MODES } from "../types";
import { useColors } from "./color-context";
import { registerDiffPaneHandle } from "./diff-pane-runtime";
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

function resolveViewMode(
  layoutMode: string,
  termWidth: number,
): "split" | "stack" {
  if (layoutMode === LAYOUT_MODES.split) {
    return LAYOUT_MODES.split;
  }
  if (layoutMode === LAYOUT_MODES.stack) {
    return LAYOUT_MODES.stack;
  }
  return termWidth >= SPLIT_VIEW_MIN_WIDTH
    ? LAYOUT_MODES.split
    : LAYOUT_MODES.stack;
}

/** Minimum terminal width below which split layout falls back to stacked. */
const SPLIT_VIEW_MIN_WIDTH = 160;

/** Minimum lines of context kept above/below the cursor when scrolling. */
const SCROLLOFF = 5;

/** Build whole-line paint marks for one comment's canonical row range. */
function commentMarksForRange(
  rows: readonly CanonicalDiffRow[],
  startRow: number,
  endRow: number,
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

/** Build character-range paint marks for diff search match rows. */
function searchMarksForRows(
  rows: readonly CanonicalDiffRow[],
  matchIndices: readonly number[],
  query: string,
): ValidatedLineHighlight[] {
  const marks: ValidatedLineHighlight[] = [];
  const lowerQuery = query.toLowerCase();
  for (const index of matchIndices) {
    const row = rows[index];
    if (!row) {
      continue;
    }
    const lowerText = row.text.toLowerCase();
    let searchFrom = 0;
    while (searchFrom < row.text.length) {
      const pos = lowerText.indexOf(lowerQuery, searchFrom);
      if (pos < 0) {
        break;
      }
      const end = pos + query.length;
      if (row.kind === "add" && row.newLine !== undefined) {
        marks.push({
          end,
          line: row.newLine,
          side: "new",
          start: pos,
          tone: "match",
        });
      } else if (row.kind === "del" && row.oldLine !== undefined) {
        marks.push({
          end,
          line: row.oldLine,
          side: "old",
          start: pos,
          tone: "match",
        });
      } else if (row.kind === "context") {
        if (row.oldLine !== undefined) {
          marks.push({
            end,
            line: row.oldLine,
            side: "old",
            start: pos,
            tone: "match",
          });
        }
        if (row.newLine !== undefined) {
          marks.push({
            end,
            line: row.newLine,
            side: "new",
            start: pos,
            tone: "match",
          });
        }
      }
      searchFrom = end + 1;
    }
  }
  return marks;
}

function diffSearchCounter(
  diffSearch: NonNullable<ReturnType<typeof useAppState>["diffSearch"]>,
  C: ReturnType<typeof useColors>["ui"],
) {
  const { index, matches, query } = diffSearch;
  if (matches.length > 0) {
    return (
      <text style={{ fg: C.accent, marginLeft: 1 }}>
        {`${index + 1}/${matches.length}`}
      </text>
    );
  }
  if (query.length > 0) {
    return <text style={{ fg: C.red, marginLeft: 1 }}>0/0</text>;
  }
  return null;
}

export function DiffPane() {
  const state = useAppState();
  const { diffSearch } = state;
  const store = getStore();
  const dims = useTerminalDimensions();
  const { ui: C } = useColors();
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const [cursorOffset, setCursorOffset] = useState(0);
  const [forceScrollToTop, setForceScrollToTop] = useState(false);
  const [pendingFirstChange, setPendingFirstChange] = useState<number | null>(
    null,
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
    [file?.diff, file?.path],
  );
  const [hunkFile] = hunkFiles;
  const internalFile = useMemo(
    () => (hunkFile ? toInternalDiffFile(hunkFile) : undefined),
    [hunkFile],
  );
  const rows = useMemo(
    () => (hunkFile ? buildCanonicalDiffRows(hunkFile) : []),
    [hunkFile],
  );

  const comments = useMemo(() => {
    if (!sel) {
      return [];
    }
    return state.comments.filter(
      (c) => c.scope === sel.scope && c.path === sel.file.path,
    );
  }, [state.comments, sel]);

  const notes = useMemo(() => {
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
    if (!internalFile) {
      return;
    }
    const marks: ValidatedLineHighlight[] = [];
    for (const c of comments) {
      marks.push(...commentMarksForRange(rows, c.startRow, c.endRow));
    }
    if (diffSearch && diffSearch.matches.length > 0 && diffSearch.query) {
      marks.push(
        ...searchMarksForRows(rows, diffSearch.matches, diffSearch.query),
      );
    }
    if (marks.length === 0) {
      return;
    }
    return buildLineHighlightPaintIndex({ file: internalFile, marks });
  }, [internalFile, comments, rows, diffSearch]);

  const MIN_CONTENT_WIDTH = 10;

  const viewMode = resolveViewMode(state.layoutMode, dims.width);
  const contentWidth = Math.max(
    MIN_CONTENT_WIDTH,
    dims.width - (state.sidebarVisible ? state.sidebarWidth + 2 : 0),
  );

  useEffect(() => {
    const off = registerDiffPaneHandle({
      getRows: () => rows,
      getScrollBox: () => scrollRef.current,
    });
    return off;
  }, [rows]);

  useEffect(() => {
    if (file?.path !== prevFilePathRef.current) {
      prevFilePathRef.current = file?.path;
      const firstChange = rows.findIndex(
        (row) => row.kind === "add" || row.kind === "del",
      );
      if (firstChange >= 0) {
        setPendingFirstChange(firstChange);
        store.set({ cursorRow: firstChange });
      } else {
        setPendingFirstChange(null);
      }
      if (store.getState().diffSearch) {
        store.set({ diffSearch: null });
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
        cursorOffset - viewportHeight + 1 + SCROLLOFF,
      );
    }
  }, [cursorOffset, forceScrollToTop, state.focus]);

  if (!(sel && file)) {
    return (
      <box
        style={{
          alignItems: "center",
          backgroundColor: C.bg,
          flexDirection: "column",
          flexGrow: 1,
          gap: 1,
          justifyContent: "center",
        }}
      >
        <ascii-font
          color={C.faint}
          font="block"
          selectable={false}
          text="CODEY"
        />
        <text style={{ fg: C.faint }}>No file selected — j/k to navigate</text>
      </box>
    );
  }

  if (file.ignored) {
    return (
      <box
        style={{
          alignItems: "center",
          backgroundColor: C.bg,
          flexGrow: 1,
          justifyContent: "center",
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
          alignItems: "center",
          backgroundColor: C.bg,
          flexGrow: 1,
          justifyContent: "center",
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
          alignItems: "center",
          backgroundColor: C.bg,
          flexGrow: 1,
          justifyContent: "center",
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
          alignItems: "center",
          backgroundColor: C.bg,
          flexGrow: 1,
          justifyContent: "center",
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
          anchorRow={state.anchorRow ?? undefined}
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
          onRowMouseDown={(index) => {
            getStore().set({ cursorRow: index });
          }}
          showHunkHeaders={false}
          showLineNumbers={state.lineNumbers}
          tabWidth={state.tabWidth}
          theme={state.theme}
          width={contentWidth}
          wrapLines={state.wrapLines}
        />
      </scrollbox>
      {state.diffSearch ? (
        <box
          style={{
            backgroundColor: C.selection,
            minWidth: 30,
            overflow: "hidden",
            paddingLeft: 1,
            paddingRight: 1,
            position: "absolute",
            right: 0,
            top: 0,
          }}
        >
          <box style={{ flexDirection: "row", overflow: "hidden" }}>
            <text style={{ fg: C.fg, flexGrow: 1, overflow: "hidden" }}>
              {`\uf422 ${state.diffSearch.query}${state.diffSearch.open ? "\u258c" : ""}`}
            </text>
            {diffSearchCounter(state.diffSearch, C)}
          </box>
        </box>
      ) : null}
    </box>
  );
}
