import { copyText } from "../../lib/clipboard";
import { getCommitFileDiff, gitLog } from "../../loaders/git-log";
import { compileIgnorePatterns } from "../../loaders/ignore";
import type { FileDiff } from "../../types";
import { TOAST_KINDS } from "../../types";
import {
  editCommit,
  gitThrow,
  reorderCommit,
  resetCommit,
  undoCommit,
} from "../../vcs/git";
import {
  type AppStore,
  type CommitRow,
  commitRowKey,
  getStore,
} from "../store";
import { refresh, toastError } from "./core";

const COMMIT_PAGE_SIZE = 10;

export async function loadCommits(): Promise<void> {
  const store = getStore();
  const { repoRoot } = store.getState();
  if (!repoRoot || store.getState().commitLoading) {
    return;
  }
  store.set({ commitEntries: [], commitLoading: true, commitOffset: 0 });
  try {
    const { commits, hasMore, behind, ahead } = await gitLog(
      repoRoot,
      0,
      COMMIT_PAGE_SIZE,
    );
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
      state.commitOffset + COMMIT_PAGE_SIZE,
      COMMIT_PAGE_SIZE,
    );
    store.set({
      commitAhead: ahead,
      commitBehind: behind,
      commitEntries: [...state.commitEntries, ...commits],
      commitHasMore: hasMore,
      commitLoading: false,
      commitOffset: state.commitOffset + COMMIT_PAGE_SIZE,
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
  delta: -1 | 1,
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
  filePath: string,
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
      store.showToast(TOAST_KINDS.error, `failed to load diff for ${filePath}`);
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

async function commitMessage(root: string, message: string): Promise<void> {
  const store = getStore();
  store.set({ commitLoading: true });
  try {
    await gitThrow(["commit", "-m", message], root);
    store.showToast(TOAST_KINDS.success, "committed");
    store.set({ commitLoading: false });
    await refresh();
  } catch (err) {
    toastError(store, "commit", err);
  }
}

export async function submitCommitDraft(text: string): Promise<void> {
  const store = getStore();
  const trimmed = text.trim();
  if (trimmed === "") {
    store.set({ commitDraft: null });
    store.showToast(TOAST_KINDS.info, "empty commit message");
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
  store.showToast(TOAST_KINDS.info, "nothing to commit");
}

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
  store.set({ commitLoading: true });
  try {
    await gitThrow(["add", "-A"], repoRoot);
    await gitThrow(["commit", "-m", message], repoRoot);
    store.showToast(TOAST_KINDS.success, "committed all changes");
    store.set({ commitLoading: false });
    await refresh();
  } catch (err) {
    store.set({ commitLoading: false });
    toastError(store, "commit-all", err);
  }
}

export async function confirmGitReset(
  mode: "mixed" | "soft" | "hard",
  hash: string,
): Promise<void> {
  const store = getStore();
  const { repoRoot } = store.getState();
  store.set({ overlay: null });
  if (!repoRoot) {
    return;
  }
  store.set({ commitLoading: true });
  try {
    await resetCommit(repoRoot, mode, hash);
    store.showToast(
      TOAST_KINDS.success,
      `reset ${mode} to ${hash.slice(0, 7)}`,
    );
    store.set({ commitLoading: false });
    await refresh();
  } catch (err) {
    store.set({ commitLoading: false });
    toastError(store, "reset", err);
  }
}

export async function confirmGitEdit(
  action: "squash" | "fixup" | "drop" | "amend",
  hash: string,
): Promise<void> {
  const store = getStore();
  const { repoRoot } = store.getState();
  store.set({ overlay: null });
  if (!repoRoot) {
    return;
  }
  store.set({ commitLoading: true });
  try {
    await editCommit(repoRoot, action, hash);
    store.showToast(TOAST_KINDS.success, `${action} ${hash.slice(0, 7)}`);
    store.set({ commitLoading: false });
    await refresh();
  } catch (err) {
    store.set({ commitLoading: false });
    toastError(store, "edit", err);
  }
}

export async function commitMove(dir: 1 | -1): Promise<void> {
  const store = getStore();
  const { repoRoot, commitEntries } = store.getState();
  if (!repoRoot) {
    return;
  }
  const rowsBefore = store.commitRows();
  const cur = store.getState().commitCursor;
  const cursorRowIdx = cur
    ? rowsBefore.findIndex((r) => commitRowKey(r) === cur)
    : -1;
  const row = cursorRowIdx >= 0 ? rowsBefore[cursorRowIdx] : null;
  if (!row || row.kind === "load-more") {
    return;
  }
  const { hash } = row;
  const idx = commitEntries.findIndex((e) => e.hash === hash);
  if (idx < 0) {
    return;
  }
  const targetIdx = idx + dir;
  if (targetIdx < 0 || targetIdx >= commitEntries.length) {
    return;
  }
  const olderHash = dir === -1 ? hash : commitEntries[idx + 1]?.hash;
  if (!olderHash) {
    return;
  }
  const targetRowIdx = cursorRowIdx + dir;
  store.set({ commitLoading: true });
  try {
    await reorderCommit(repoRoot, olderHash);
    const label = dir === -1 ? "up" : "down";
    store.showToast(TOAST_KINDS.success, `moved ${hash.slice(0, 7)} ${label}`);
    store.set({ commitLoading: false });
    await refresh();
    const rowsAfter = store.commitRows();
    const next =
      rowsAfter[Math.min(Math.max(targetRowIdx, 0), rowsAfter.length - 1)] ??
      null;
    if (next) {
      store.set({ commitCursor: commitRowKey(next) });
      if (next.kind === "file") {
        await selectCommitFile(next.hash, next.path);
      }
    }
  } catch (err) {
    store.set({ commitLoading: false });
    toastError(store, "move", err);
  }
}

export async function commitRevert(hash: string): Promise<void> {
  const store = getStore();
  const { repoRoot } = store.getState();
  if (!repoRoot) {
    return;
  }
  store.set({ commitLoading: true });
  try {
    await undoCommit(repoRoot, hash);
    store.showToast(TOAST_KINDS.success, `undone ${hash.slice(0, 7)}`);
    store.set({ commitLoading: false });
    await refresh();
  } catch (err) {
    store.set({ commitLoading: false });
    toastError(store, "revert", err);
  }
}

export async function copyCommitHash(hash: string): Promise<void> {
  const result = await copyText(hash);
  if (result.ok) {
    getStore().showToast(TOAST_KINDS.success, "copied hash to clipboard");
  } else {
    getStore().showToast(
      TOAST_KINDS.error,
      `clipboard failed: ${result.error}`,
    );
  }
}
