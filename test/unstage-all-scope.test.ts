import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { unstageAll } from "../src/state/actions/staging";
import { type AppState, AppStore, setStore } from "../src/state/store";
import type { Changeset } from "../src/types";
import { gitThrow } from "../src/vcs/git";
import { afterAll, describe, expect, test } from "bun:test";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

function file(path: string): Changeset["files"][number] {
  return {
    additions: 1,
    deletions: 0,
    diff: "",
    isBinary: false,
    path,
    status: "modified",
    tooLarge: false,
  };
}

function changeset(id: Changeset["id"], paths: string[]): Changeset {
  return {
    files: paths.map(file),
    id,
    label: id,
    stats: { additions: 0, deletions: 0, files: paths.length },
  };
}

function setupStore(init: Partial<AppState>, repoRoot?: string): AppStore {
  const store = new AppStore(init);
  setStore(store);
  if (repoRoot) {
    store.set({
      ignoreFiles: [],
      load: async () => ({
        branch: null,
        changesets: [],
        conflictNotice: null,
      }),
      loaderMode: "diff",
      repoRoot,
      stagingEnabled: true,
    });
  }
  return store;
}

async function initRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "codey-unstage-all-"));
  dirs.push(dir);
  await gitThrow(["init", "-q"], dir);
  await gitThrow(["config", "user.name", "Test User"], dir);
  await gitThrow(["config", "user.email", "test@example.com"], dir);
  return dir;
}

async function stagedPaths(dir: string): Promise<string[]> {
  const out = await gitThrow(["diff", "--cached", "--name-only"], dir);
  return out.split("\n").filter((p) => p.length > 0);
}

describe("unstageAll cursor awareness", () => {
  test("cursor in staged unstages everything, even with working-tree changes", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "v1\n");
    await gitThrow(["add", "-A"], dir);

    const store = setupStore(
      {
        changesets: [
          changeset("staged", ["a.txt"]),
          changeset("changes", ["b.txt"]),
        ],
        selection: { index: 0, kind: "file", scope: "staged" },
      },
      dir,
    );
    await unstageAll();

    expect(store.getState().overlay).toBeNull();
    expect(await stagedPaths(dir)).toEqual([]);
  });

  test("cursor in changes opens the discard-all confirmation", async () => {
    const store = setupStore({
      changesets: [changeset("changes", ["b.txt"])],
      selection: { index: 0, kind: "file", scope: "changes" },
    });
    await unstageAll();
    expect(store.getState().overlay).toEqual({ kind: "confirm-discard-all" });
  });

  test("without a selection it opens the discard-all confirmation", async () => {
    const store = setupStore({
      changesets: [changeset("changes", ["b.txt"])],
      selection: null,
    });
    await unstageAll();
    expect(store.getState().overlay).toEqual({ kind: "confirm-discard-all" });
  });

  test("cursor on the staged section header also unstages", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "v1\n");
    await gitThrow(["add", "-A"], dir);

    setupStore(
      {
        changesets: [changeset("staged", ["a.txt"])],
        selection: { kind: "section", scope: "staged" },
      },
      dir,
    );
    await unstageAll();

    expect(await stagedPaths(dir)).toEqual([]);
  });
});
