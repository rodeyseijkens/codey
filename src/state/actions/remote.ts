import { getBranchAheadBehind } from "../../loaders/git-log";
import { TOAST_KINDS } from "../../types";
import { GitError, gitThrow } from "../../vcs/git";
import { getStore } from "../store";
import { refresh } from "./core";

type RemoteBusy = "pull" | "push";

function errorDetail(err: unknown): string {
  return err instanceof GitError
    ? err.stderr.trim() || err.message
    : String(err);
}

async function runRemote(
  verb: string,
  busy: RemoteBusy,
  run: (root: string) => Promise<void>,
): Promise<void> {
  const store = getStore();
  const { repoRoot } = store.getState();
  if (!repoRoot) {
    return;
  }
  store.set({ remoteBusy: busy });
  try {
    await run(repoRoot);
    store.showToast(TOAST_KINDS.success, `git ${verb} succeeded`);
    await refresh();
  } catch (err) {
    store.showToast(TOAST_KINDS.error, errorDetail(err));
  } finally {
    store.set({ remoteBusy: null });
  }
}

async function gitRemoteCommand(
  args: string[],
  verb: string,
  busy: RemoteBusy,
): Promise<void> {
  await runRemote(verb, busy, async (root) => {
    await gitThrow(args, root);
  });
}

export async function gitPull(): Promise<void> {
  const store = getStore();
  const { repoRoot } = store.getState();
  if (!repoRoot) {
    return;
  }
  try {
    await gitThrow(["fetch"], repoRoot);
    const { ahead, behind } = await getBranchAheadBehind(repoRoot);
    if (ahead > 0 && behind > 0) {
      store.set({ overlay: { kind: "confirm-pull-diverged" } });
      return;
    }
  } catch (err) {
    store.showToast(TOAST_KINDS.error, errorDetail(err));
    return;
  }
  await gitRemoteCommand(["pull"], "pull", "pull");
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
  await gitRemoteCommand(["push"], "push", "push");
}

export function confirmForcePush(): void {
  const store = getStore();
  if (store.getState().overlay?.kind !== "confirm-force-push") {
    return;
  }
  store.set({ overlay: null });
  void gitRemoteCommand(["push", "--force-with-lease"], "force push", "push");
}

function requirePullOverlay(): boolean {
  const store = getStore();
  if (store.getState().overlay?.kind !== "confirm-pull-diverged") {
    return false;
  }
  store.set({ overlay: null });
  return true;
}

export async function confirmPullRebase(): Promise<void> {
  if (!requirePullOverlay()) {
    return;
  }
  await gitRemoteCommand(["pull", "--rebase"], "pull --rebase", "pull");
}

export async function confirmPullForce(): Promise<void> {
  if (!requirePullOverlay()) {
    return;
  }
  await runRemote("force pull", "pull", async (root) => {
    await gitThrow(["fetch"], root);
    await gitThrow(["reset", "--hard", "@{upstream}"], root);
  });
}
