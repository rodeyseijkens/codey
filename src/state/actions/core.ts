import { type FileDiff, type Scope, TOAST_KINDS } from "../../types";
import { createDiffViewerFilesFromPatch } from "../../ui/diff-viewer/model";
import {
  type AppState,
  commitRowKey,
  getStore,
  rowKey,
  type Selection,
  type SidebarRow,
  type Store,
} from "../store";

export const SIDEBAR_MIN_WIDTH = 16;
export const SIDEBAR_MAX_WIDTH = 80;
export const SIDEBAR_RESIZE_STEP = 4;

export function toastError(store: Store, action: string, err: unknown): void {
  store.showToast(
    TOAST_KINDS.error,
    `${action} failed: ${err instanceof Error ? err.message : String(err)}`,
  );
}

function preserveSelection(
  store: Store,
  prevSel: Selection | null,
): Selection | null {
  if (prevSel) {
    const rows = store.sidebarRows();
    const key = rowKey(prevSel);
    const same = rows.find((r) => rowKey(r) === key);
    if (same) {
      return same;
    }
    if (prevSel.kind === "file") {
      const path = store.changeset(prevSel.scope)?.files[prevSel.index]?.path;
      if (path) {
        const byPath = rows.find(
          (r) =>
            r.kind === "file" &&
            store.changeset(r.scope)?.files[r.index]?.path === path,
        );
        if (byPath) {
          return byPath;
        }
      }
    } else if (prevSel.kind === "dir") {
      const byPath = rows.find(
        (r) => r.kind === "dir" && r.path === prevSel.path,
      );
      if (byPath) {
        return byPath;
      }
    }
  }
  const rows = store.sidebarRows();
  return rows.find((r) => r.kind === "file") ?? rows[0] ?? null;
}

/** True when the previously displayed file is still the given selection. */
function isSameFileSelection(
  store: Store,
  prevFile: { file: FileDiff; scope: Scope } | null,
  sel: Selection,
): boolean {
  if (!prevFile || sel.kind !== "file") {
    return false;
  }
  const file = store.changeset(sel.scope)?.files[sel.index];
  return (
    prevFile.scope === sel.scope &&
    file !== undefined &&
    file.path === prevFile.file.path
  );
}

/** Canonical diff row count of the selected file, for clamping the cursor. */
function selectedFileRowCount(store: Store, sel: Selection): number {
  if (sel.kind !== "file") {
    return 0;
  }
  const file = store.changeset(sel.scope)?.files[sel.index];
  if (!file) {
    return 0;
  }
  const [hunk] = createDiffViewerFilesFromPatch(file.diff, file.path);
  return hunk?.canonicalRows?.length ?? 0;
}

/** Scroll state to restore after a refresh, or null when switching files. */
function preservedScroll(
  store: Store,
  prevFile: { file: FileDiff; scope: Scope } | null,
  prevCursor: number,
  prevAnchor: number | null,
  sel: Selection,
): { anchorRow: number | null; cursorRow: number } | null {
  if (!isSameFileSelection(store, prevFile, sel)) {
    return null;
  }
  const max = Math.max(0, selectedFileRowCount(store, sel) - 1);
  return {
    anchorRow: prevAnchor === null ? null : Math.min(prevAnchor, max),
    cursorRow: Math.min(prevCursor, max),
  };
}

export async function refresh(): Promise<void> {
  const store = getStore();
  const { load: loadFn } = store.getState();
  const prevState = store.getState();
  const prevSel = prevState.selection;
  const prevCursor = prevState.cursorRow;
  const prevAnchor = prevState.anchorRow;
  const prevFile = store.selectedFile();
  store.set({ loading: true });
  try {
    const { changesets, branch, conflictNotice } = await loadFn();
    store.set({
      branch,
      changesets,
      conflictNotice,
      loading: false,
    });
    const nextSel = preserveSelection(store, prevSel);
    if (nextSel) {
      applySelection(store, nextSel);
      const scroll = preservedScroll(
        store,
        prevFile,
        prevCursor,
        prevAnchor,
        nextSel,
      );
      if (scroll) {
        store.set(scroll);
      }
    }
    const prevCommitCursor = store.getState().commitCursor;
    const { loadCommits } = await import("./commits");
    await loadCommits();
    if (prevCommitCursor !== null) {
      repairCommitCursor(store, prevCommitCursor);
    }
  } catch (err) {
    store.set({
      fatalError: err instanceof Error ? err.message : String(err),
      loading: false,
    });
  }
}

function repairCommitCursor(store: Store, prev: string): void {
  const rows = store.commitRows();
  if (!rows[0]) {
    store.set({ commitCursor: null });
    return;
  }
  const key = rows.some((r) => commitRowKey(r) === prev)
    ? prev
    : commitRowKey(rows[0]);
  store.set({ commitCursor: key });
}

export function applySelection(store: Store, row: SidebarRow | null): void {
  if (!row) {
    store.set({ anchorRow: null, cursorRow: 0, selection: null });
    return;
  }
  const patch: Partial<AppState> = {
    anchorRow: null,
    cursorRow: 0,
    selection: row,
  };
  if (row.kind === "file") {
    patch.lastFile = { index: row.index, scope: row.scope };
  }
  store.set(patch);
}

export function repairSelection(store: Store): void {
  const sel = store.getState().selection;
  if (!sel) {
    return;
  }
  const rows = store.sidebarRows();
  if (rows.some((r) => rowKey(r) === rowKey(sel))) {
    return;
  }
  const fallback = rows.find((r) => r.kind === "file") ?? rows[0] ?? null;
  applySelection(store, fallback);
}
