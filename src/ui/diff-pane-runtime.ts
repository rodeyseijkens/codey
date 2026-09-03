import type { ScrollBoxRenderable } from "@opentui/core";

import { getStore } from "../state/store";
import type { CanonicalDiffRow } from "./hunk-diff";

type DiffPaneHandle = {
  getRows: () => readonly CanonicalDiffRow[];
  getScrollBox: () => ScrollBoxRenderable | null;
};

let currentHandle: DiffPaneHandle | null = null;

export function registerDiffPaneHandle(handle: DiffPaneHandle): () => void {
  currentHandle = handle;
  return () => {
    if (currentHandle === handle) {
      currentHandle = null;
    }
  };
}

function get(): DiffPaneHandle | null {
  return currentHandle;
}

function isChange(row: CanonicalDiffRow | undefined): boolean {
  return !!row && (row.kind === "add" || row.kind === "del");
}

export function moveCursor(direction: -1 | 1): void {
  const h = get();
  if (!h) {
    return;
  }
  const rows = h.getRows();
  if (rows.length === 0) {
    return;
  }
  const store = getStore();
  const state = store.getState();
  const next = state.cursorRow + direction;
  store.set({ cursorRow: Math.max(0, Math.min(next, rows.length - 1)) });
}

export function pageScroll(direction: -1 | 1): void {
  const h = get();
  if (!h) {
    return;
  }
  const scrollRef = h.getScrollBox();
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
      scrollRef.scrollTop + delta,
    ),
  );
}

export function halfPageScroll(direction: -1 | 1): void {
  const h = get();
  if (!h) {
    return;
  }
  const rows = h.getRows();
  if (rows.length === 0) {
    return;
  }
  const scrollRef = h.getScrollBox();
  const store = getStore();
  const state = store.getState();
  const viewportHeight = scrollRef?.viewport.height ?? 0;
  if (scrollRef && viewportHeight > 0) {
    const delta = direction * (viewportHeight / 2);
    scrollRef.scrollTop = Math.max(
      0,
      Math.min(
        scrollRef.scrollHeight - viewportHeight,
        scrollRef.scrollTop + delta,
      ),
    );
  }
  store.set({
    cursorRow: Math.max(
      0,
      Math.min(
        rows.length - 1,
        state.cursorRow + Math.floor(viewportHeight / 2) * direction,
      ),
    ),
  });
}

function jumpNextHunk(
  rows: readonly CanonicalDiffRow[],
  cursorRow: number,
  store: ReturnType<typeof getStore>,
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

function jumpPrevHunk(
  rows: readonly CanonicalDiffRow[],
  cursorRow: number,
  store: ReturnType<typeof getStore>,
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

export function jumpHunk(cmd: "next-hunk" | "prev-hunk"): void {
  const h = get();
  if (!h) {
    return;
  }
  const rows = h.getRows();
  if (rows.length === 0) {
    return;
  }
  const store = getStore();
  const { cursorRow } = store.getState();

  if (cmd === "next-hunk") {
    jumpNextHunk(rows, cursorRow, store);
  } else {
    jumpPrevHunk(rows, cursorRow, store);
  }
}
