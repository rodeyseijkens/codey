import { isHerdrPlugin, sendToAgent } from "../herdr/bridge";
import { copyText, formatCommentsAsMarkdown } from "../lib/clipboard";
import { treeKey } from "../lib/tree";
import { getCommitFileDiff, gitLog } from "../loaders/git-log";
import type { FileDiff, LoaderMode, Scope } from "../types";
import {
  deleteFiles,
  restoreWorktreeFiles,
  stageFiles,
  unstageFiles,
} from "../vcs/git";
import {
  type AppState,
  type AppStore,
  getStore,
  type PendingStage,
  rowKey,
  type Selection,
  type SidebarRow,
  type SidebarView,
} from "./store";

export interface RuntimeConfig {
  load: () => Promise<{
    changesets: import("../types.js").Changeset[];
    branch: string | null;
    conflictNotice: string | null;
  }>;
  loaderMode: LoaderMode;
  repoRoot: string;
  stagingEnabled: boolean;
}

let runtime: RuntimeConfig | null = null;

export function configureRuntime(cfg: RuntimeConfig): void {
  runtime = cfg;
  const store = getStore();
  store.set({
    loaderMode: cfg.loaderMode,
    repoRoot: cfg.repoRoot,
    stagingEnabled: cfg.stagingEnabled,
  });
}

export function getRuntime(): RuntimeConfig {
  if (!runtime) {
    throw new Error("runtime not configured");
  }
  return runtime;
}

function preserveSelection(
  store: AppStore,
  prevSel: Selection | null
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
            store.changeset(r.scope)?.files[r.index]?.path === path
        );
        if (byPath) {
          return byPath;
        }
      }
    } else if (prevSel.kind === "dir") {
      const byPath = rows.find(
        (r) => r.kind === "dir" && r.path === prevSel.path
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
  const rt = getRuntime();
  store.set({ loading: true });
  try {
    const { changesets, branch, conflictNotice } = await rt.load();
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
    await loadCommits();
  } catch (err) {
    store.set({
      fatalError: err instanceof Error ? err.message : String(err),
      loading: false,
    });
  }
}

function applySelection(store: AppStore, row: SidebarRow | null): void {
  if (!row) {
    store.set({ anchorRow: null, cursorRow: 0, selection: null });
    return;
  }
  const patch: Partial<AppState> = {
    anchorRow: null,
    cursorRow: 0,
    focus: "sidebar",
    selection: row,
  };
  if (row.kind === "file") {
    patch.lastFile = { index: row.index, scope: row.scope };
  }
  store.set(patch);
}

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
  store.set({
    focus: store.getState().focus === "sidebar" ? "diff" : "sidebar",
  });
}

export function toggleSidebar(): void {
  const store = getStore();
  store.set({ sidebarVisible: !store.getState().sidebarVisible });
}

export function toggleCollapse(scope: Scope): void {
  const store = getStore();
  const collapsed = { ...store.getState().collapsed };
  collapsed[scope] = !collapsed[scope];
  store.set({ collapsed });
  repairSelection(store);
}

function repairSelection(store: AppStore): void {
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
    store.getState().sidebarView === "tree" ? "list" : "tree";
  store.set({ sidebarView: next });
  repairSelection(store);
}

export function resizeSidebar(delta: number): void {
  const store = getStore();
  const w = Math.max(16, Math.min(80, store.getState().sidebarWidth + delta));
  store.set({ sidebarWidth: w });
}

export function cycleLayout(): void {
  const store = getStore();
  const modes: Array<"split" | "stack" | "auto"> = ["split", "stack", "auto"];
  const current = store.getState().layoutMode;
  const idx = modes.indexOf(current);
  const next = modes[(idx + 1) % modes.length];
  store.set({ layoutMode: next });
}

function buildPendingStage(
  scope: Scope,
  paths: string[],
  bulk: boolean
): PendingStage | null {
  const store = getStore();
  const count = store.pendingCommentCount(scope, paths);
  if (count === 0) {
    return null;
  }
  return { bulk, commentCount: count, paths, scope };
}

function selectionPaths(
  store: AppStore
): { paths: string[]; scope: Scope } | null {
  const sel = store.getState().selection;
  if (!sel) {
    return null;
  }
  const cs = store.changeset(sel.scope);
  if (!cs) {
    return null;
  }
  if (sel.kind === "file") {
    const file = cs.files[sel.index];
    return file ? { paths: [file.path], scope: sel.scope } : null;
  }
  if (sel.kind === "dir") {
    const prefix = `${sel.path}/`;
    const paths = cs.files
      .filter((f) => f.path === sel.path || f.path.startsWith(prefix))
      .map((f) => f.path);
    return { paths, scope: sel.scope };
  }
  return { paths: cs.files.map((f) => f.path), scope: sel.scope };
}

export async function stageSelected(): Promise<void> {
  const store = getStore();
  const rt = getRuntime();
  if (!rt.stagingEnabled) {
    store.showToast("warn", "staging is disabled in this mode");
    return;
  }
  const target = selectionPaths(store);
  if (!target || target.paths.length === 0) {
    return;
  }
  const bulk = target.paths.length > 1;
  const pending = buildPendingStage(target.scope, target.paths, bulk);
  if (pending) {
    store.set({ pendingStage: pending });
    store.showToast(
      "warn",
      `${pending.commentCount} comment(s) will be cleared — press again to confirm`
    );
    return;
  }
  try {
    await stageFiles(rt.repoRoot, target.paths);
    store.showToast(
      "success",
      bulk
        ? `staged ${target.paths.length} file(s)`
        : `staged ${target.paths[0]}`
    );
    await refresh();
  } catch (err) {
    store.showToast(
      "error",
      `stage failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function stageAll(): Promise<void> {
  const store = getStore();
  const rt = getRuntime();
  if (!rt.stagingEnabled) {
    store.showToast("warn", "staging is disabled in this mode");
    return;
  }
  const changes = store.changeset("changes");
  if (!changes || changes.files.length === 0) {
    store.showToast("info", "no changes to stage");
    return;
  }
  const paths = changes.files.map((f) => f.path);
  const pending = buildPendingStage("changes", paths, true);
  if (pending) {
    store.set({ pendingStage: pending });
    store.showToast(
      "warn",
      `${pending.commentCount} comment(s) will be cleared — press again to confirm`
    );
    return;
  }
  try {
    await stageFiles(rt.repoRoot, paths);
    store.showToast("success", `staged ${paths.length} file(s)`);
    await refresh();
  } catch (err) {
    store.showToast(
      "error",
      `stage-all failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function unstageSelected(): Promise<void> {
  const store = getStore();
  const rt = getRuntime();
  if (!rt.stagingEnabled) {
    store.showToast("warn", "staging is disabled in this mode");
    return;
  }
  const target = selectionPaths(store);
  if (!target || target.paths.length === 0) {
    return;
  }
  if (target.scope === "changes") {
    store.set({
      overlay: {
        bulk: target.paths.length > 1,
        kind: "confirm-discard",
        paths: target.paths,
        scope: target.scope,
      },
    });
    return;
  }
  const bulk = target.paths.length > 1;
  try {
    await unstageFiles(rt.repoRoot, target.paths);
    store.showToast(
      "success",
      bulk
        ? `unstaged ${target.paths.length} file(s)`
        : `unstaged ${target.paths[0]}`
    );
    await refresh();
  } catch (err) {
    store.showToast(
      "error",
      `unstage failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function discardPaths(scope: Scope, paths: string[]): Promise<void> {
  const store = getStore();
  const rt = getRuntime();
  const cs = store.changeset(scope);
  const untracked = new Set(
    (cs?.files ?? [])
      .filter((f) => paths.includes(f.path) && f.status === "added")
      .map((f) => f.path)
  );
  const tracked = paths.filter((p) => !untracked.has(p));
  if (tracked.length > 0) {
    await restoreWorktreeFiles(rt.repoRoot, tracked);
  }
  if (untracked.size > 0) {
    await deleteFiles(rt.repoRoot, [...untracked]);
  }
}

export async function confirmDiscard(): Promise<void> {
  const store = getStore();
  const { overlay } = store.getState();
  if (overlay?.kind !== "confirm-discard") {
    return;
  }
  const { bulk, paths, scope } = overlay;
  store.set({ overlay: null });
  try {
    await discardPaths(scope, paths);
    store.clearCommentsFor(scope, paths);
    store.showToast(
      "success",
      bulk
        ? `discarded changes in ${paths.length} file(s)`
        : `discarded changes in ${paths[0] ?? ""}`
    );
    await refresh();
  } catch (err) {
    store.showToast(
      "error",
      `discard failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function unstageAll(): Promise<void> {
  const store = getStore();
  const rt = getRuntime();
  if (!rt.stagingEnabled) {
    store.showToast("warn", "staging is disabled in this mode");
    return;
  }
  const changes = store.changeset("changes");
  if (changes && changes.files.length > 0) {
    const paths = changes.files.map((f) => f.path);
    try {
      await discardPaths("changes", paths);
      store.clearCommentsFor("changes", paths);
      store.showToast(
        "success",
        `discarded changes in ${paths.length} file(s)`
      );
      await refresh();
    } catch (err) {
      store.showToast(
        "error",
        `discard-all failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    return;
  }
  const staged = store.changeset("staged");
  if (!staged || staged.files.length === 0) {
    store.showToast("info", "no staged files");
    return;
  }
  const paths = staged.files.map((f) => f.path);
  try {
    await unstageFiles(rt.repoRoot, paths);
    store.showToast("success", `unstaged ${paths.length} file(s)`);
    await refresh();
  } catch (err) {
    store.showToast(
      "error",
      `unstage-all failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function confirmPendingStage(): Promise<void> {
  const store = getStore();
  const pending = store.getState().pendingStage;
  if (!pending) {
    return;
  }
  const rt = getRuntime();
  try {
    await stageFiles(rt.repoRoot, pending.paths);
    store.clearCommentsFor(pending.scope, pending.paths);
    store.set({ pendingStage: null });
    store.showToast(
      "success",
      `staged ${pending.paths.length} file(s), cleared ${pending.commentCount} comment(s)`
    );
    await refresh();
  } catch (err) {
    store.showToast(
      "error",
      `stage failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export function cancelPendingStage(): void {
  const store = getStore();
  store.set({ pendingStage: null });
  store.showToast("info", "cancelled");
}

export async function sendComments(): Promise<void> {
  const store = getStore();
  const { comments } = store.getState();
  if (comments.length === 0) {
    store.showToast("info", "no comments to send");
    return;
  }
  if (isHerdrPlugin()) {
    try {
      await sendToAgent(comments);
      store.set({ comments: [] });
      store.showToast("success", `sent ${comments.length} comment(s) to agent`);
      return;
    } catch (err) {
      store.showToast(
        "error",
        `agent send failed: ${err instanceof Error ? err.message : String(err)} — keeping comments`
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
      `copied ${comments.length} comment(s) to clipboard`
    );
  } else {
    store.showToast(
      "error",
      `clipboard failed: ${result.error} — keeping comments`
    );
  }
}

export async function copySelection(): Promise<void> {
  const store = getStore();
  const sel = store.selectedFile();
  if (!sel) {
    store.showToast("info", "nothing selected");
    return;
  }
  const result = await copyText(sel.file.diff);
  if (result.ok) {
    store.showToast("success", "copied diff to clipboard");
  } else {
    store.showToast("error", `clipboard failed: ${result.error}`);
  }
}

export function openHelp(): void {
  const store = getStore();
  store.set({ commentDraft: null, overlay: { kind: "help" } });
}

export function closeOverlay(): void {
  const store = getStore();
  store.set({ overlay: null });
}

export async function loadCommits(): Promise<void> {
  const store = getStore();
  let rt: RuntimeConfig;
  try {
    rt = getRuntime();
  } catch {
    return;
  }
  if (!rt.repoRoot || store.getState().commitLoading) {
    return;
  }
  store.set({ commitEntries: [], commitLoading: true, commitOffset: 0 });
  try {
    const { commits, hasMore } = await gitLog(rt.repoRoot, 0, 10);
    store.set({
      commitEntries: commits,
      commitHasMore: hasMore,
      commitLoading: false,
    });
  } catch {
    store.set({
      commitEntries: [],
      commitHasMore: false,
      commitLoading: false,
    });
  }
}

export async function loadMoreCommits(): Promise<void> {
  const store = getStore();
  let rt: RuntimeConfig;
  try {
    rt = getRuntime();
  } catch {
    return;
  }
  if (!rt.repoRoot) {
    return;
  }
  const state = store.getState();
  if (state.commitLoading || !state.commitHasMore) {
    return;
  }
  store.set({ commitLoading: true });
  try {
    const { commits, hasMore } = await gitLog(
      rt.repoRoot,
      state.commitOffset + 10,
      10
    );
    store.set({
      commitEntries: [...state.commitEntries, ...commits],
      commitHasMore: hasMore,
      commitLoading: false,
      commitOffset: state.commitOffset + 10,
    });
  } catch {
    store.set({ commitLoading: false });
  }
}

export function toggleCommitExpand(hash: string): void {
  const store = getStore();
  const expanded = { ...store.getState().collapsed };
  expanded[hash] = !expanded[hash];
  store.set({ collapsed: expanded });
}

export async function selectCommitFile(
  hash: string,
  filePath: string
): Promise<void> {
  const store = getStore();
  let rt: RuntimeConfig;
  try {
    rt = getRuntime();
  } catch {
    return;
  }
  if (!rt.repoRoot) {
    return;
  }
  const entry = store.getState().commitEntries.find((c) => c.hash === hash);
  if (!entry) {
    return;
  }

  let diff = entry.diffByPath[filePath];
  if (!diff) {
    try {
      diff = await getCommitFileDiff(rt.repoRoot, hash, filePath);
      const updated = store.getState().commitEntries.map((c) => {
        if (c.hash !== hash) {
          return c;
        }
        return {
          ...c,
          diffByPath: { ...c.diffByPath, [filePath]: diff ?? "" },
        };
      });
      store.set({ commitEntries: updated });
    } catch {
      store.showToast("error", `failed to load diff for ${filePath}`);
      return;
    }
  }

  const file: FileDiff = {
    additions: 0,
    deletions: 0,
    diff: diff ?? "",
    isBinary: false,
    path: filePath,
    status: "modified",
    tooLarge: false,
  };
  store.set({ commitView: { file, hash } });
}

export function clearCommitView(): void {
  const store = getStore();
  store.set({ commitView: null });
}
