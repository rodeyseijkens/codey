import { isHerdrPlugin, sendToAgent } from "../herdr";
import { copyText, formatCommentsAsMarkdown } from "../lib/clipboard";
import { treeKey } from "../lib/tree";
import {
  getBranchAheadBehind,
  getCommitFileDiff,
  gitLog,
} from "../loaders/git-log";
import { compileIgnorePatterns } from "../loaders/ignore";
import type { FileDiff, Scope } from "../types";
import {
  deleteFiles,
  GitError,
  gitThrow,
  resetCommit,
  restoreWorktreeFiles,
  stageFiles,
  unstageFiles,
} from "../vcs/git";
import {
  type AppState,
  type AppStore,
  type CommitRow,
  commitRowKey,
  getStore,
  type PendingStage,
  rowKey,
  type Selection,
  type SidebarRow,
  type SidebarView,
} from "./store";

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

function applySelection(store: AppStore, row: SidebarRow | null): void {
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
  const { stagingEnabled } = store.getState();
  if (!stagingEnabled) {
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
    const { repoRoot } = store.getState();
    if (!repoRoot) {
      return;
    }
    await stageFiles(repoRoot, target.paths);
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
  const { stagingEnabled } = store.getState();
  if (!stagingEnabled) {
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
    const { repoRoot } = store.getState();
    if (!repoRoot) {
      return;
    }
    await stageFiles(repoRoot, paths);
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
  const { stagingEnabled } = store.getState();
  if (!stagingEnabled) {
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
    const { repoRoot } = store.getState();
    if (!repoRoot) {
      return;
    }
    await unstageFiles(repoRoot, target.paths);
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
  const { repoRoot } = store.getState();
  if (!repoRoot) {
    return;
  }
  const cs = store.changeset(scope);
  const untracked = new Set(
    (cs?.files ?? [])
      .filter((f) => paths.includes(f.path) && f.status === "added")
      .map((f) => f.path)
  );
  const tracked = paths.filter((p) => !untracked.has(p));
  if (tracked.length > 0) {
    await restoreWorktreeFiles(repoRoot, tracked);
  }
  if (untracked.size > 0) {
    await deleteFiles(repoRoot, [...untracked]);
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

/** Discard every working-tree change after the confirm-discard-all overlay is accepted. */
export async function confirmDiscardAll(): Promise<void> {
  const store = getStore();
  const { overlay } = store.getState();
  if (overlay?.kind !== "confirm-discard-all") {
    return;
  }
  store.set({ overlay: null });
  const changes = store.changeset("changes");
  const paths = (changes?.files ?? []).map((f) => f.path);
  if (paths.length === 0) {
    return;
  }
  try {
    await discardPaths("changes", paths);
    store.clearCommentsFor("changes", paths);
    store.showToast("success", `discarded changes in ${paths.length} file(s)`);
    await refresh();
  } catch (err) {
    store.showToast(
      "error",
      `discard-all failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function unstageAll(): Promise<void> {
  const store = getStore();
  const { stagingEnabled } = store.getState();
  if (!stagingEnabled) {
    store.showToast("warn", "staging is disabled in this mode");
    return;
  }
  const changes = store.changeset("changes");
  if (changes && changes.files.length > 0) {
    store.set({ overlay: { kind: "confirm-discard-all" } });
    return;
  }
  const staged = store.changeset("staged");
  if (!staged || staged.files.length === 0) {
    store.showToast("info", "no staged files");
    return;
  }
  const paths = staged.files.map((f) => f.path);
  try {
    const { repoRoot } = store.getState();
    if (!repoRoot) {
      return;
    }
    await unstageFiles(repoRoot, paths);
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
  const { repoRoot } = store.getState();
  if (!repoRoot) {
    return;
  }
  try {
    await stageFiles(repoRoot, pending.paths);
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
  const { repoRoot } = store.getState();
  if (!repoRoot || store.getState().commitLoading) {
    return;
  }
  store.set({ commitEntries: [], commitLoading: true, commitOffset: 0 });
  try {
    const { commits, hasMore, behind, ahead } = await gitLog(repoRoot, 0, 10);
    store.set({
      commitAhead: ahead,
      commitBehind: behind,
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

export async function loadMoreCommits(followCursor = false): Promise<void> {
  const store = getStore();
  const { repoRoot } = store.getState();
  if (!repoRoot) {
    return;
  }
  const state = store.getState();
  if (state.commitLoading || !state.commitHasMore) {
    return;
  }
  store.set({ commitLoading: true });
  try {
    const before = state.commitEntries.length;
    const { commits, hasMore, behind, ahead } = await gitLog(
      repoRoot,
      state.commitOffset + 10,
      10
    );
    store.set({
      commitAhead: ahead,
      commitBehind: behind,
      commitEntries: [...state.commitEntries, ...commits],
      commitHasMore: hasMore,
      commitLoading: false,
      commitOffset: state.commitOffset + 10,
    });
    const [first] = commits;
    if (followCursor && first) {
      store.set({
        commitCursor: commitRowKey({
          hash: first.hash,
          index: before,
          kind: "header",
        }),
      });
    }
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

async function moveCommitCursor(store: AppStore, delta: -1 | 1): Promise<void> {
  const rows = store.commitRows();
  if (rows.length === 0) {
    return;
  }
  const cur = store.getState().commitCursor;
  const idx = cur ? rows.findIndex((r) => commitRowKey(r) === cur) : -1;
  let target: CommitRow | undefined;
  if (cur === null || idx < 0) {
    target = delta === 1 ? rows[0] : (rows.at(-1) ?? rows[0]);
  } else {
    target = rows[Math.min(Math.max(idx + delta, 0), rows.length - 1)];
  }
  if (!target) {
    return;
  }
  store.set({ commitCursor: commitRowKey(target) });
  if (target.kind === "file") {
    await selectCommitFile(target.hash, target.path);
  }
}

export function commitSelectNext(): Promise<void> {
  return moveCommitCursor(getStore(), 1);
}

export function commitSelectPrev(): Promise<void> {
  return moveCommitCursor(getStore(), -1);
}

async function moveCommitCursorToFile(
  store: AppStore,
  delta: -1 | 1
): Promise<void> {
  const rows = store.commitRows();
  if (rows.length === 0) {
    return;
  }
  const cur = store.getState().commitCursor;
  const curIdx = cur ? rows.findIndex((r) => commitRowKey(r) === cur) : -1;
  let start: number;
  if (cur === null || curIdx < 0) {
    start = delta === 1 ? -1 : rows.length;
  } else {
    start = curIdx;
  }
  let target: CommitRow | undefined;
  for (let i = start + delta; i >= 0 && i < rows.length; i += delta) {
    if (rows[i]?.kind === "file") {
      target = rows[i];
      break;
    }
  }
  if (!target) {
    return;
  }
  store.set({ commitCursor: commitRowKey(target) });
  if (target.kind === "file") {
    await selectCommitFile(target.hash, target.path);
  }
}

export function commitSelectNextFile(): Promise<void> {
  return moveCommitCursorToFile(getStore(), 1);
}

export function commitSelectPrevFile(): Promise<void> {
  return moveCommitCursorToFile(getStore(), -1);
}

export async function commitToggleCursorRow(): Promise<void> {
  const store = getStore();
  const rows = store.commitRows();
  const cur = store.getState().commitCursor;
  const idx = cur ? rows.findIndex((r) => commitRowKey(r) === cur) : -1;
  const row = idx >= 0 ? rows[idx] : null;
  if (!row) {
    return;
  }
  if (row.kind === "header") {
    toggleCommitExpand(row.hash);
  } else if (row.kind === "load-more") {
    await loadMoreCommits(true);
  }
}

export async function selectCommitFile(
  hash: string,
  filePath: string
): Promise<void> {
  const store = getStore();
  const { repoRoot, ignoreFiles } = store.getState();
  if (!repoRoot) {
    return;
  }
  const entry = store.getState().commitEntries.find((c) => c.hash === hash);
  if (!entry) {
    return;
  }

  let diff = entry.diffByPath[filePath];
  const ignored = compileIgnorePatterns(ignoreFiles)(filePath);
  if (!(ignored || diff)) {
    try {
      diff = await getCommitFileDiff(repoRoot, hash, filePath);
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
    diff: ignored ? "" : (diff ?? ""),
    ignored,
    isBinary: false,
    path: filePath,
    status: "modified",
    tooLarge: false,
  };
  store.set({
    anchorRow: null,
    commitView: { file, hash },
    cursorRow: 0,
    selection: null,
  });
}

export function clearCommitView(): void {
  const store = getStore();
  store.set({ commitView: null });
}

async function gitRemoteCommand(args: string[], verb: string): Promise<void> {
  const store = getStore();
  const { repoRoot } = store.getState();
  if (!repoRoot) {
    return;
  }
  store.set({ remoteBusy: verb === "pull" ? "pull" : "push" });
  try {
    await gitThrow(args, repoRoot);
    store.showToast("success", `git ${verb} succeeded`);
    await refresh();
  } catch (err) {
    const detail =
      err instanceof GitError ? err.stderr.trim() || err.message : String(err);
    store.showToast("error", detail);
  } finally {
    store.set({ remoteBusy: null });
  }
}

export function gitPull(): void {
  gitRemoteCommand(["pull"], "pull");
}

export async function gitPush(): Promise<void> {
  const store = getStore();
  const { repoRoot } = store.getState();
  if (!repoRoot) {
    return;
  }
  const { ahead, behind } = await getBranchAheadBehind(repoRoot);
  if (ahead > 0 && behind > 0) {
    store.set({ overlay: { kind: "confirm-force-push" } });
    return;
  }
  await gitRemoteCommand(["push"], "push");
}

export function confirmForcePush(): void {
  const store = getStore();
  if (store.getState().overlay?.kind !== "confirm-force-push") {
    return;
  }
  store.set({ overlay: null });
  gitRemoteCommand(["push", "--force-with-lease"], "force push");
}

/** Open the commit-message input from the commit pane. */
export function openCommitDraft(): void {
  const store = getStore();
  if (store.getState().focus !== "commits") {
    return;
  }
  store.set({ commitDraft: "" });
}

export function cancelCommitDraft(): void {
  getStore().set({ commitDraft: null });
}

/** Clear the commit-message input, keeping the overlay open. */
export function clearCommitDraft(): void {
  const store = getStore();
  store.set({ draftClearTick: store.getState().draftClearTick + 1 });
}

async function commitMessage(root: string, message: string): Promise<void> {
  const store = getStore();
  try {
    await gitThrow(["commit", "-m", message], root);
    store.showToast("success", "committed");
    await refresh();
  } catch (err) {
    store.showToast(
      "error",
      `commit failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

/** Commit staged changes, or ask before committing all working-tree changes. */
export async function submitCommitDraft(text: string): Promise<void> {
  const store = getStore();
  const trimmed = text.trim();
  if (trimmed === "") {
    store.set({ commitDraft: null });
    store.showToast("info", "empty commit message");
    return;
  }
  const { repoRoot } = store.getState();
  if (!repoRoot) {
    store.set({ commitDraft: null });
    return;
  }
  const staged = store.changeset("staged");
  if (staged && staged.files.length > 0) {
    store.set({ commitDraft: null });
    await commitMessage(repoRoot, trimmed);
    return;
  }
  const changes = store.changeset("changes");
  if (changes && changes.files.length > 0) {
    store.set({
      commitDraft: null,
      overlay: { kind: "confirm-commit-all", message: trimmed },
    });
    return;
  }
  store.set({ commitDraft: null });
  store.showToast("info", "nothing to commit");
}

/** Stage every working-tree change and commit after the confirm-commit-all overlay. */
export async function confirmCommitAll(): Promise<void> {
  const store = getStore();
  const { overlay } = store.getState();
  if (overlay?.kind !== "confirm-commit-all") {
    return;
  }
  const { message } = overlay;
  store.set({ overlay: null });
  const { repoRoot } = store.getState();
  if (!repoRoot) {
    return;
  }
  try {
    await gitThrow(["add", "-A"], repoRoot);
    await gitThrow(["commit", "-m", message], repoRoot);
    store.showToast("success", "committed all changes");
    await refresh();
  } catch (err) {
    store.showToast(
      "error",
      `commit failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

export async function confirmGitReset(
  mode: "mixed" | "soft" | "hard",
  hash: string
): Promise<void> {
  const store = getStore();
  const { repoRoot } = store.getState();
  store.set({ overlay: null });
  if (!repoRoot) {
    return;
  }
  try {
    await resetCommit(repoRoot, mode, hash);
    store.showToast("success", `reset ${mode} to ${hash.slice(0, 7)}`);
    await refresh();
  } catch (err) {
    store.showToast(
      "error",
      `reset failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
