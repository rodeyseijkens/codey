import { isHerdrPlugin, sendToAgent } from "../../herdr";
import { copyText, formatCommentsAsMarkdown } from "../../lib/clipboard";
import { treeKey } from "../../lib/tree";
import type { Scope, SidebarView } from "../../types";
import { DIFF_MODES, SIDEBAR_VIEWS, TOAST_KINDS } from "../../types";
import { type AppState, getStore, rowKey } from "../store";
import {
  applySelection,
  repairSelection,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "./core";

export function selectNext(): void {
  const store = getStore();
  const rows = store.sidebarRows();
  const sel = store.getState().selection;
  if (rows.length === 0) {
    return;
  }
  if (!sel) {
    applySelection(store, rows[0] ?? null);
    return;
  }
  const idx = rows.findIndex((r) => rowKey(r) === rowKey(sel));
  const next = rows[(idx + 1) % rows.length];
  applySelection(store, next ?? null);
}

export function selectPrev(): void {
  const store = getStore();
  const rows = store.sidebarRows();
  const sel = store.getState().selection;
  if (rows.length === 0) {
    return;
  }
  if (!sel) {
    applySelection(store, rows.at(-1) ?? null);
    return;
  }
  const idx = rows.findIndex((r) => rowKey(r) === rowKey(sel));
  const prev = rows[(idx - 1 + rows.length) % rows.length];
  applySelection(store, prev ?? null);
}

export function selectFile(scope: Scope, index: number): void {
  const store = getStore();
  const cs = store.changeset(scope);
  if (!cs || index < 0 || index >= cs.files.length) {
    return;
  }
  applySelection(store, { index, kind: "file", scope });
}

export function selectDir(scope: Scope, path: string): void {
  const store = getStore();
  applySelection(store, { kind: "dir", path, scope });
}

export function selectSection(scope: Scope): void {
  const store = getStore();
  applySelection(store, { kind: "section", scope });
}

export function toggleSelectedRow(): void {
  const store = getStore();
  const sel = store.getState().selection;
  if (!sel) {
    return;
  }
  if (sel.kind === "section") {
    toggleCollapse(sel.scope);
  } else if (sel.kind === "dir") {
    toggleTreeFolder(sel.scope, sel.path);
  }
}

export function toggleFocus(): void {
  const store = getStore();
  const state = store.getState();
  if (!state.sidebarVisible) {
    store.set({ focus: "diff" });
    return;
  }
  const order: AppState["focus"][] = ["sidebar", "diff", "commits"];
  const next = order[(order.indexOf(state.focus) + 1) % order.length];
  store.set({ focus: next });
}

export function focusPrev(): void {
  const store = getStore();
  const state = store.getState();
  if (!state.sidebarVisible) {
    store.set({ focus: "diff" });
    return;
  }
  const order: AppState["focus"][] = ["sidebar", "commits", "diff"];
  const next = order[(order.indexOf(state.focus) + 1) % order.length];
  store.set({ focus: next });
}

export function focusSidebar(): void {
  const store = getStore();
  store.set({ focus: "sidebar", sidebarVisible: true });
}

export function focusDiff(): void {
  const store = getStore();
  store.set({ focus: "diff" });
}

export function focusCommits(): void {
  const store = getStore();
  store.set({ focus: "commits", sidebarVisible: true });
}

export function toggleSidebar(): void {
  const store = getStore();
  const state = store.getState();
  if (state.sidebarVisible) {
    store.set({ focus: "diff", sidebarVisible: false });
  } else {
    store.set({
      focus: state.commitView && !state.selection ? "commits" : "sidebar",
      sidebarVisible: true,
    });
  }
}

export function toggleCollapse(scope: Scope): void {
  const store = getStore();
  const collapsed = { ...store.getState().collapsed };
  collapsed[scope] = !collapsed[scope];
  store.set({ collapsed });
  repairSelection(store);
}

export function toggleTreeFolder(scope: Scope, dirPath: string): void {
  const store = getStore();
  const collapsedTree = { ...store.getState().collapsedTree };
  collapsedTree[treeKey(scope, dirPath)] =
    !collapsedTree[treeKey(scope, dirPath)];
  store.set({ collapsedTree });
  repairSelection(store);
}

export function toggleSidebarView(): void {
  const store = getStore();
  const next: SidebarView =
    store.getState().sidebarView === SIDEBAR_VIEWS.tree
      ? SIDEBAR_VIEWS.list
      : SIDEBAR_VIEWS.tree;
  store.set({ sidebarView: next });
  repairSelection(store);
}

export function resizeSidebar(delta: number): void {
  const store = getStore();
  const w = Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.min(SIDEBAR_MAX_WIDTH, store.getState().sidebarWidth + delta),
  );
  store.set({ sidebarWidth: w });
}

export function cycleLayout(): void {
  const store = getStore();
  const modes = DIFF_MODES;
  const current = store.getState().layoutMode;
  const idx = modes.indexOf(current);
  const next = modes[(idx + 1) % modes.length];
  store.set({ layoutMode: next });
}

export async function sendComments(): Promise<void> {
  const store = getStore();
  const { comments } = store.getState();
  if (comments.length === 0) {
    store.showToast(TOAST_KINDS.info, "no comments to send");
    return;
  }
  if (isHerdrPlugin()) {
    try {
      await sendToAgent(comments);
      store.set({ comments: [] });
      store.showToast(
        TOAST_KINDS.success,
        `sent ${comments.length} comment(s) to agent`,
      );
      return;
    } catch (err) {
      store.showToast(
        "error",
        `agent send failed: ${err instanceof Error ? err.message : String(err)} — keeping comments`,
      );
      return;
    }
  }
  const md = formatCommentsAsMarkdown("codey review", comments);
  const result = await copyText(md);
  if (result.ok) {
    store.set({ comments: [] });
    store.showToast(
      "success",
      `copied ${comments.length} comment(s) to clipboard`,
    );
  } else {
    store.showToast(
      "error",
      `clipboard failed: ${result.error} — keeping comments`,
    );
  }
}

export async function copySelection(): Promise<void> {
  const store = getStore();
  const sel = store.selectedFile();
  if (!sel) {
    store.showToast(TOAST_KINDS.info, "nothing selected");
    return;
  }
  const result = await copyText(sel.file.diff);
  if (result.ok) {
    store.showToast(TOAST_KINDS.success, "copied diff to clipboard");
  } else {
    store.showToast(TOAST_KINDS.error, `clipboard failed: ${result.error}`);
  }
}
