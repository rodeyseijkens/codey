import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  confirmPullForce,
  confirmPullRebase,
  gitPull,
} from "../src/state/actions/remote";
import { type AppState, AppStore, setStore } from "../src/state/store";
import { gitThrow } from "../src/vcs/git";
import { afterAll, describe, expect, test } from "bun:test";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

function tempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix)).then((dir) => {
    dirs.push(dir);
    return dir;
  });
}

async function initBareRemote(): Promise<string> {
  const dir = await tempDir("codey-remote-");
  const bare = join(dir, "remote.git");
  await gitThrow(["init", "-q", "--bare", bare], dir);
  return bare;
}

async function cloneRepo(remote: string, prefix: string): Promise<string> {
  const dir = await tempDir(prefix);
  const repoDir = join(dir, "repo");
  await gitThrow(["clone", "-q", remote, repoDir], dir);
  await gitThrow(["config", "user.name", "Test User"], repoDir);
  await gitThrow(["config", "user.email", "test@example.com"], repoDir);
  return repoDir;
}

async function commitFile(
  dir: string,
  file: string,
  message: string,
): Promise<void> {
  await writeFile(join(dir, file), `${message}\n`);
  await gitThrow(["add", "-A"], dir);
  await gitThrow(["commit", "-qm", message], dir);
}

async function setupDiverged(): Promise<string> {
  const remote = await initBareRemote();
  const dir = await cloneRepo(remote, "codey-pull-");
  await commitFile(dir, "base.txt", "base");
  await gitThrow(["push", "-q", "-u", "origin", "HEAD"], dir);
  const other = await cloneRepo(remote, "codey-other-");
  await commitFile(other, "remote.txt", "remote");
  await gitThrow(["push", "-q"], other);
  await commitFile(dir, "local.txt", "local");
  return dir;
}

function setupStore(repoRoot: string): AppStore {
  const store = new AppStore({ focus: "commits" } as Partial<AppState>);
  setStore(store);
  store.set({
    ignoreFiles: [],
    load: async () => ({
      branch: null,
      changesets: [],
      conflictNotice: null,
    }),
    loaderMode: "diff",
    repoRoot,
    stagingEnabled: false,
  });
  return store;
}

async function subjects(dir: string): Promise<string[]> {
  const out = await gitThrow(["log", "--format=%s"], dir);
  return out.split("\n").filter((line) => line.length > 0);
}

describe("diverged pull", () => {
  test("git pull with diverged branches opens the pull overlay", async () => {
    const dir = await setupDiverged();
    const store = setupStore(dir);
    await gitPull();
    expect(store.getState().overlay).toEqual({ kind: "confirm-pull-diverged" });
    expect(await subjects(dir)).toEqual(["local", "base"]);
  });

  test("confirming rebase replays local commits onto the remote", async () => {
    const dir = await setupDiverged();
    const store = setupStore(dir);
    await gitPull();
    await confirmPullRebase();
    expect(store.getState().overlay).toBeNull();
    expect(store.getState().toast?.kind).toBe("success");
    expect(await subjects(dir)).toEqual(["local", "remote", "base"]);
  });

  test("confirming force pull discards local-only commits", async () => {
    const dir = await setupDiverged();
    const store = setupStore(dir);
    await gitPull();
    await confirmPullForce();
    expect(store.getState().overlay).toBeNull();
    expect(store.getState().toast?.kind).toBe("success");
    const head = (await gitThrow(["rev-parse", "HEAD"], dir)).trim();
    const upstream = (await gitThrow(["rev-parse", "@{upstream}"], dir)).trim();
    expect(head).toBe(upstream);
    expect(await subjects(dir)).toEqual(["remote", "base"]);
  });

  test("git pull when not diverged pulls without an overlay", async () => {
    const remote = await initBareRemote();
    const dir = await cloneRepo(remote, "codey-pull-");
    await commitFile(dir, "base.txt", "base");
    await gitThrow(["push", "-q", "-u", "origin", "HEAD"], dir);
    const other = await cloneRepo(remote, "codey-other-");
    await commitFile(other, "remote.txt", "remote");
    await gitThrow(["push", "-q"], other);
    const store = setupStore(dir);
    await gitPull();
    expect(store.getState().overlay).toBeNull();
    expect(await subjects(dir)).toEqual(["remote", "base"]);
  });

  test("confirm actions ignore a missing overlay", async () => {
    const dir = await setupDiverged();
    const store = setupStore(dir);
    await confirmPullRebase();
    await confirmPullForce();
    expect(store.getState().overlay).toBeNull();
    expect(await subjects(dir)).toEqual(["local", "base"]);
  });
});
