import { TOAST_KINDS } from "../../types";
import {
  type AppState,
  type AppStore,
  commitRowKey,
  getStore,
  rowKey,
  type Selection,
  type SidebarRow,
} from "../store";

export const SIDEBAR_MIN_WIDTH = 16;
export const SIDEBAR_MAX_WIDTH = 80;
export const SIDEBAR_RESIZE_STEP = 4;

export function toastError(
  store: AppStore,
  action: string,
  err: unknown,
): void {
  store.showToast(
    TOAST_KINDS.error,
    `${action} failed: ${err instanceof Error ? err.message : String(err)}`,
  );
}

function preserveSelection(
  store: AppStore,
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

export async function refresh(): Promise<void> {
  const store = getStore();
  const { load: loadFn } = store.getState();
  store.set({ loading: true });
  try {
    const { changesets, branch, conflictNotice } = await loadFn();
    const prevSel = store.getState().selection;
    store.set({
      anchorRow: null,
      branch,
      changesets,
      conflictNotice,
      cursorRow: 0,
      loading: false,
    });
    const nextSel = preserveSelection(store, prevSel);
    if (nextSel) {
      applySelection(store, nextSel);
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

function repairCommitCursor(store: AppStore, prev: string): void {
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

export function applySelection(store: AppStore, row: SidebarRow | null): void {
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

export function repairSelection(store: AppStore): void {
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
