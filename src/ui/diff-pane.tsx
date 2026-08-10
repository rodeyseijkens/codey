import type { DiffRenderable, KeyEvent, SyntaxStyle } from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/react";
import { useEffect, useRef } from "react";
import { keyEventToChord } from "../keymap/chords";
import type { CommandId } from "../keymap/commands";
import { lookupCommand, type ResolvedKeymap } from "../keymap/index";
import {
  changeGroupOffsets,
  type DiffRow,
  parseDiffRows,
} from "../lib/diff-lines";
import type { AppStore } from "../state/store";
import { getStore, useAppState } from "../state/store";
import { useColors } from "./color-context";
import type { UiColors } from "./colors";
import { useKeymap } from "./keymap-context";

const EXT_LANG: Record<string, string> = {
  bash: "shellscript",
  c: "c",
  cjs: "javascript",
  cpp: "cpp",
  css: "css",
  go: "go",
  h: "c",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  jsonc: "jsonc",
  jsx: "jsx",
  md: "markdown",
  mjs: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "shellscript",
  sql: "sql",
  toml: "toml",
  ts: "typescript",
  tsx: "typescriptreact",
  yaml: "yaml",
  yml: "yaml",
  zig: "zig",
};

export function filetypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANG[ext] ?? "text";
}

function resolveViewMode(
  layoutMode: string,
  termWidth: number
): "split" | "unified" {
  if (layoutMode === "split") {
    return "split";
  }
  if (layoutMode === "stack") {
    return "unified";
  }
  return termWidth >= 160 ? "split" : "unified";
}

interface DiffInternals {
  clearHighlightLines?: (start: number, end: number) => void;
  highlightLines?: (start: number, end: number, color: string) => void;
  leftCodeRenderable?: { scrollY: number; height: number };
  rightCodeRenderable?: { scrollY: number; height: number };
}

function jumpToHunk(
  store: AppStore,
  rows: DiffRow[],
  cmd: CommandId,
  cursorRow: number,
  rowCount: number
): void {
  const offsets = changeGroupOffsets(rows);
  if (cmd === "next-hunk") {
    const next = offsets.find((o) => o > cursorRow);
    if (next !== undefined) {
      store.set({ cursorRow: Math.min(next, rowCount - 1) });
    }
    return;
  }
  const prev = [...offsets].reverse().find((o) => o < cursorRow);
  store.set({ cursorRow: prev === undefined ? 0 : Math.max(prev, 0) });
}

function applyHighlights(
  diff: DiffInternals | null,
  store: AppStore,
  rowCount: number,
  viewMode: "split" | "unified",
  C: UiColors
): void {
  if (!diff || rowCount === 0) {
    return;
  }
  diff.clearHighlightLines?.(0, rowCount - 1);
  const sel = store.selectedFile();
  if (sel) {
    for (const c of store.commentsFor(sel.scope, sel.file.path)) {
      diff.highlightLines?.(
        c.startRow,
        Math.min(c.endRow, rowCount - 1),
        C.comment
      );
    }
  }
  const cursor = store.getState().cursorRow;
  if (cursor >= 0 && cursor < rowCount) {
    diff.highlightLines?.(cursor, cursor, C.cursor);
  }
  const code =
    viewMode === "unified" ? diff.leftCodeRenderable : diff.rightCodeRenderable;
  if (code && typeof code.scrollY === "number") {
    const visible = code.height || 20;
    if (cursor < code.scrollY + 2) {
      code.scrollY = Math.max(0, cursor - 2);
    } else if (cursor > code.scrollY + visible - 3) {
      code.scrollY = Math.max(0, cursor - visible + 3);
    }
  }
}

function handleDiffPaneKey(
  e: KeyEvent,
  store: AppStore,
  keymap: ResolvedKeymap
): void {
  const s = store.getState();
  if (s.focus !== "diff" || s.overlay) {
    return;
  }
  const chord = keyEventToChord(e);
  if (!chord) {
    return;
  }
  const cmd = lookupCommand(keymap, chord);
  const current = store.selectedFile();
  const rows = current?.file.diff ? parseDiffRows(current.file.diff) : [];
  const rowCount = rows.length;
  if (rowCount === 0) {
    return;
  }

  let effectiveCmd = cmd;
  if (!effectiveCmd) {
    if (chord.key === "up") {
      effectiveCmd = "select-prev";
    } else if (chord.key === "down") {
      effectiveCmd = "select-next";
    }
  }
  if (!effectiveCmd) {
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
    jumpToHunk(store, rows, effectiveCmd, s.cursorRow, rowCount);
  }
}

export function DiffPane(props: { syntaxStyle?: SyntaxStyle }) {
  const state = useAppState();
  const keymap = useKeymap();
  const store = getStore();
  const diffRef = useRef<DiffRenderable | null>(null);
  const dims = useTerminalDimensions();
  const { ui: C } = useColors();

  const sel = store.selectedFile();
  const file = sel?.file;
  const rows = file?.diff ? parseDiffRows(file.diff) : [];

  const viewMode = resolveViewMode(state.layoutMode, dims.width);

  useKeyboard((e) => {
    handleDiffPaneKey(e, store, keymap);
  });

  useEffect(() => {
    applyHighlights(
      diffRef.current as unknown as DiffInternals | null,
      store,
      rows.length,
      viewMode,
      C
    );
  });

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

  if (!file.diff) {
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
      <diff
        addedBg={C.diffAddedBg}
        addedSignColor={C.green}
        contextBg={C.bg}
        diff={file.diff}
        fg={C.fg}
        filetype={filetypeFor(file.path)}
        ref={(el: DiffRenderable) => {
          diffRef.current = el;
        }}
        removedBg={C.diffRemovedBg}
        removedSignColor={C.red}
        showLineNumbers={state.lineNumbers}
        style={{ flexGrow: 1 }}
        syncScroll={true}
        syntaxStyle={props.syntaxStyle}
        view={viewMode}
      />
    </box>
  );
}
