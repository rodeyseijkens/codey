import { getBranchAheadBehind } from "../../loaders/git-log";
import { TOAST_KINDS } from "../../types";
import { GitError, gitThrow } from "../../vcs/git";
import { getStore } from "../store";
import { refresh } from "./core";

async function gitRemoteCommand(args: string[], verb: string): Promise<void> {
  const store = getStore();
  const { repoRoot } = store.getState();
  if (!repoRoot) {
    return;
  }
  store.set({ remoteBusy: verb === "pull" ? "pull" : "push" });
  try {
    await gitThrow(args, repoRoot);
    store.showToast(TOAST_KINDS.success, `git ${verb} succeeded`);
    await refresh();
  } catch (err) {
    const detail =
      err instanceof GitError ? err.stderr.trim() || err.message : String(err);
    store.showToast(TOAST_KINDS.error, detail);
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
