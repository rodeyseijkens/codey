import { type Scope, TOAST_KINDS } from "../../types";
import {
  deleteFiles,
  restoreWorktreeFiles,
  stageFiles,
  unstageFiles,
} from "../../vcs/git";
import { type AppStore, getStore, type PendingStage } from "../store";
import { refresh, toastError } from "./core";

function buildPendingStage(
  scope: Scope,
  paths: string[],
  bulk: boolean,
): PendingStage | null {
  const store = getStore();
  const count = store.pendingCommentCount(scope, paths);
  if (count === 0) {
    return null;
  }
  return { bulk, commentCount: count, paths, scope };
}

function selectionPaths(
  store: AppStore,
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
    store.showToast(TOAST_KINDS.warn, "staging is disabled in this mode");
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
      `${pending.commentCount} comment(s) will be cleared — press again to confirm`,
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
        : `staged ${target.paths[0]}`,
    );
    await refresh();
  } catch (err) {
    store.showToast(
      "error",
      `stage failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function stageAll(): Promise<void> {
  const store = getStore();
  const { stagingEnabled } = store.getState();
  if (!stagingEnabled) {
    store.showToast(TOAST_KINDS.warn, "staging is disabled in this mode");
    return;
  }
  const changes = store.changeset("changes");
  if (!changes || changes.files.length === 0) {
    store.showToast(TOAST_KINDS.info, "no changes to stage");
    return;
  }
  const paths = changes.files.map((f) => f.path);
  const pending = buildPendingStage("changes", paths, true);
  if (pending) {
    store.set({ pendingStage: pending });
    store.showToast(
      "warn",
      `${pending.commentCount} comment(s) will be cleared — press again to confirm`,
    );
    return;
  }
  try {
    const { repoRoot } = store.getState();
    if (!repoRoot) {
      return;
    }
    await stageFiles(repoRoot, paths);
    store.showToast(TOAST_KINDS.success, `staged ${paths.length} file(s)`);
    await refresh();
  } catch (err) {
    toastError(store, "stage-all", err);
  }
}

export async function unstageSelected(): Promise<void> {
  const store = getStore();
  const { stagingEnabled } = store.getState();
  if (!stagingEnabled) {
    store.showToast(TOAST_KINDS.warn, "staging is disabled in this mode");
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
        : `unstaged ${target.paths[0]}`,
    );
    await refresh();
  } catch (err) {
    toastError(store, "unstage", err);
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
      .map((f) => f.path),
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
        : `discarded changes in ${paths[0] ?? ""}`,
    );
    await refresh();
  } catch (err) {
    toastError(store, "discard", err);
  }
}

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
    store.showToast(
      TOAST_KINDS.success,
      `discarded changes in ${paths.length} file(s)`,
    );
    await refresh();
  } catch (err) {
    toastError(store, "discard-all", err);
  }
}

export async function unstageAll(): Promise<void> {
  const store = getStore();
  const { stagingEnabled } = store.getState();
  if (!stagingEnabled) {
    store.showToast(TOAST_KINDS.warn, "staging is disabled in this mode");
    return;
  }
  const changes = store.changeset("changes");
  if (changes && changes.files.length > 0) {
    store.set({ overlay: { kind: "confirm-discard-all" } });
    return;
  }
  const staged = store.changeset("staged");
  if (!staged || staged.files.length === 0) {
    store.showToast(TOAST_KINDS.info, "no staged files");
    return;
  }
  const paths = staged.files.map((f) => f.path);
  try {
    const { repoRoot } = store.getState();
    if (!repoRoot) {
      return;
    }
    await unstageFiles(repoRoot, paths);
    store.showToast(TOAST_KINDS.success, `unstaged ${paths.length} file(s)`);
    await refresh();
  } catch (err) {
    toastError(store, "unstage-all", err);
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
      `staged ${pending.paths.length} file(s), cleared ${pending.commentCount} comment(s)`,
    );
    await refresh();
  } catch (err) {
    toastError(store, "stage", err);
  }
}

export function cancelPendingStage(): void {
  const store = getStore();
  store.set({ pendingStage: null });
  store.showToast(TOAST_KINDS.info, "cancelled");
}
