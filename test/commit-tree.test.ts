import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { commitTreeKey } from "../src/lib/tree";
import {
  commitSelectNext,
  commitToggleCursorRow,
  loadCommits,
  toggleAllCommitFolders,
  toggleCommitExpand,
  toggleCommitFileView,
  toggleCommitTreeFolder,
} from "../src/state/actions/commits";
import { toggleAllTreeFolders } from "../src/state/actions/navigation";
import { dispatchCommand } from "../src/state/command-registry";
import {
  type AppState,
  AppStore,
  commitRowKey,
  setStore,
} from "../src/state/store";
import type { CommitEntry, FileStatus } from "../src/types";
import { gitThrow } from "../src/vcs/git";
import { afterAll, describe, expect, test } from "bun:test";

const dirs: string[] = [];

async function initRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "codey-commit-tree-"));
  dirs.push(dir);
  await gitThrow(["init", "-q"], dir);
  await gitThrow(["config", "user.name", "Test User"], dir);
  await gitThrow(["config", "user.email", "test@example.com"], dir);
  return dir;
}

async function commitAll(dir: string, message: string): Promise<void> {
  await gitThrow(["add", "-A"], dir);
  await gitThrow(["commit", "-qm", message], dir);
}

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

function entry(hash: string, files: [string, FileStatus][]): CommitEntry {
  return {
    author: "A",
    date: "2024-01-01",
    diffByPath: {},
    files: files.map(([path, status]) => ({
      additions: 1,
      deletions: 0,
      path,
      status,
    })),
    hash,
    isPushed: true,
    message: `msg ${hash}`,
    shortHash: hash.slice(0, 7),
    stats: { additions: 1, deletions: 0, files: files.length },
  };
}

function commitFileEntry(hash: string, paths: string[]): CommitEntry {
  return entry(
    hash,
    paths.map((p): [string, FileStatus] => [p, "modified"]),
  );
}

function setupStore(init: Partial<AppState> = {}): AppStore {
  const store = new AppStore(init);
  setStore(store);
  return store;
}

function sidebarChangeset(path: string): AppState["changesets"][number] {
  return {
    files: [
      {
        additions: 1,
        deletions: 0,
        diff: "",
        isBinary: false,
        path,
        status: "modified",
        tooLarge: false,
      },
    ],
    id: "changes",
    label: "Changes",
    stats: { additions: 1, deletions: 0, files: 1 },
  };
}

function repoStore(dir: string, init: Partial<AppState> = {}): AppStore {
  const store = new AppStore(init);
  setStore(store);
  store.set({
    ignoreFiles: [],
    load: async () => ({
      branch: null,
      changesets: [],
      conflictNotice: null,
    }),
    loaderMode: "diff",
    repoRoot: dir,
    stagingEnabled: false,
  });
  return store;
}

describe("commit tree rows", () => {
  test("tree view groups files under dirs with depth", () => {
    const store = setupStore({
      collapsed: { aaa: true },
      commitEntries: [
        commitFileEntry("aaa", [
          "src/ui/app.tsx",
          "src/lib/tree.ts",
          "README.md",
        ]),
      ],
      commitHasMore: false,
    });
    expect(store.commitRows().map(commitRowKey)).toEqual([
      "commit:aaa",
      "commit-dir:aaa:src",
      "commit-dir:aaa:src/lib",
      "commit-file:aaa:src/lib/tree.ts",
      "commit-dir:aaa:src/ui",
      "commit-file:aaa:src/ui/app.tsx",
      "commit-file:aaa:README.md",
    ]);
  });

  test("collapsed commit dirs hide their subtree", () => {
    const store = setupStore({
      collapsed: { aaa: true },
      collapsedTree: { "commit:aaa:src": true },
      commitEntries: [commitFileEntry("aaa", ["src/a.ts"])],
      commitHasMore: false,
    });
    expect(store.commitRows().map(commitRowKey)).toEqual([
      "commit:aaa",
      "commit-dir:aaa:src",
    ]);
  });

  test("collapse state is keyed per commit", () => {
    const store = setupStore({
      collapsed: { aaa: true, bbb: true },
      collapsedTree: { "commit:aaa:src": true },
      commitEntries: [
        commitFileEntry("aaa", ["src/a.ts"]),
        commitFileEntry("bbb", ["src/b.ts"]),
      ],
      commitHasMore: false,
    });
    const keys = store.commitRows().map(commitRowKey);
    expect(keys).toContain("commit-file:bbb:src/b.ts");
    expect(keys).not.toContain("commit-file:aaa:src/a.ts");
  });

  test("list view keeps flat file rows", () => {
    const store = setupStore({
      collapsed: { aaa: true },
      commitEntries: [commitFileEntry("aaa", ["src/a.ts", "b.ts"])],
      commitFileView: "list",
      commitHasMore: false,
    });
    expect(store.commitRows().map(commitRowKey)).toEqual([
      "commit:aaa",
      "commit-file:aaa:src/a.ts",
      "commit-file:aaa:b.ts",
    ]);
  });
});

describe("commit folder toggling", () => {
  test("toggleCommitTreeFolder flips the per-commit dir key and repairs a stale cursor", () => {
    const store = setupStore({
      collapsed: { aaa: true },
      commitCursor: "commit-file:aaa:src/a.ts",
      commitEntries: [commitFileEntry("aaa", ["src/a.ts"])],
      commitHasMore: false,
    });
    toggleCommitTreeFolder("aaa", "src");
    expect(store.getState().collapsedTree[commitTreeKey("aaa", "src")]).toBe(
      true,
    );
    expect(store.getState().commitCursor).toBe("commit:aaa");

    store.set({ commitCursor: "commit:aaa" });
    toggleCommitTreeFolder("aaa", "src");
    expect(store.getState().collapsedTree[commitTreeKey("aaa", "src")]).toBe(
      false,
    );
  });

  test("space on a dir row toggles its folder", async () => {
    const store = setupStore({
      collapsed: { aaa: true },
      commitCursor: "commit-dir:aaa:src",
      commitEntries: [commitFileEntry("aaa", ["src/a.ts"])],
      commitHasMore: false,
    });
    await commitToggleCursorRow();
    expect(store.getState().collapsedTree[commitTreeKey("aaa", "src")]).toBe(
      true,
    );
    expect(store.commitRows().map(commitRowKey)).toEqual([
      "commit:aaa",
      "commit-dir:aaa:src",
    ]);

    await commitToggleCursorRow();
    expect(store.getState().collapsedTree[commitTreeKey("aaa", "src")]).toBe(
      false,
    );
  });

  test("collapsing a commit header with the cursor inside repairs the cursor", () => {
    const store = setupStore({
      collapsed: { aaa: true },
      commitCursor: "commit-file:aaa:src/a.ts",
      commitEntries: [commitFileEntry("aaa", ["src/a.ts"]), entry("bbb", [])],
      commitHasMore: false,
    });
    toggleCommitExpand("aaa");
    expect(store.getState().commitCursor).toBe("commit:aaa");
  });

  test("toggleAllCommitFolders collapses and expands commit dirs, preserving sidebar keys", () => {
    const store = setupStore({
      collapsed: { aaa: true },
      collapsedTree: { "changes:lib": true },
      commitEntries: [commitFileEntry("aaa", ["src/ui/a.tsx", "src/b.ts"])],
      commitHasMore: false,
    });
    toggleAllCommitFolders();
    expect(store.getState().collapsedTree).toEqual({
      "changes:lib": true,
      "commit:aaa:src": true,
      "commit:aaa:src/ui": true,
    });

    toggleAllCommitFolders();
    expect(store.getState().collapsedTree).toEqual({
      "changes:lib": true,
    });
  });

  test("toggleAllTreeFolders preserves commit dir keys", () => {
    const store = setupStore({
      changesets: [sidebarChangeset("lib/x.ts")],
      collapsed: { aaa: true },
      collapsedTree: { "commit:aaa:src": true },
      commitEntries: [commitFileEntry("aaa", ["src/a.ts"])],
      commitHasMore: false,
    });
    toggleAllTreeFolders();
    expect(store.getState().collapsedTree).toEqual({
      "changes:lib": true,
      "commit:aaa:src": true,
    });
  });
});

describe("commit view toggling", () => {
  test("toggleCommitFileView flips between tree and list and repairs dir cursors", () => {
    const store = setupStore({
      collapsed: { aaa: true },
      commitCursor: "commit-dir:aaa:src",
      commitEntries: [commitFileEntry("aaa", ["src/a.ts"])],
      commitHasMore: false,
    });
    expect(store.getState().commitFileView).toBe("tree");
    toggleCommitFileView();
    expect(store.getState().commitFileView).toBe("list");
    expect(store.getState().commitCursor).toBe("commit:aaa");
    toggleCommitFileView();
    expect(store.getState().commitFileView).toBe("tree");
    expect(store.getState().commitCursor).toBe("commit:aaa");
  });

  test("dispatch toggle-view is focus-aware", () => {
    const commitsStore = setupStore({
      commitEntries: [entry("aaa", [])],
      commitHasMore: false,
      focus: "commits",
    });
    dispatchCommand("toggle-view");
    expect(commitsStore.getState().commitFileView).toBe("list");
    expect(commitsStore.getState().sidebarView).toBe("tree");

    const sidebarStore = setupStore({
      focus: "sidebar",
      sidebarView: "tree",
    });
    dispatchCommand("toggle-view");
    expect(sidebarStore.getState().sidebarView).toBe("list");
    expect(sidebarStore.getState().commitFileView).toBe("tree");
  });
});

describe("toggle-folders dispatch", () => {
  test("acts on commit trees when focus is commits", () => {
    const store = setupStore({
      collapsed: { aaa: true },
      commitEntries: [commitFileEntry("aaa", ["src/ui/a.tsx", "src/b.ts"])],
      commitHasMore: false,
      focus: "commits",
    });
    dispatchCommand("toggle-folders");
    expect(store.getState().collapsedTree).toEqual({
      "commit:aaa:src": true,
      "commit:aaa:src/ui": true,
    });
  });

  test("no-ops in commits focus while the commit view is a list", () => {
    const store = setupStore({
      collapsed: { aaa: true },
      commitEntries: [commitFileEntry("aaa", ["src/a.ts"])],
      commitFileView: "list",
      commitHasMore: false,
      focus: "commits",
    });
    dispatchCommand("toggle-folders");
    expect(store.getState().collapsedTree).toEqual({});
  });

  test("acts on sidebar trees when focus is sidebar", () => {
    const store = setupStore({
      changesets: [sidebarChangeset("src/a.ts")],
      focus: "sidebar",
    });
    dispatchCommand("toggle-folders");
    expect(store.getState().collapsedTree).toEqual({
      "changes:src": true,
    });
  });
});

describe("commit navigation with dir rows", () => {
  test("j steps through dir rows without loading a diff", async () => {
    const store = setupStore({
      collapsed: { aaa: true },
      commitCursor: null,
      commitEntries: [commitFileEntry("aaa", ["src/a.ts"])],
      commitHasMore: false,
      focus: "commits",
    });
    await commitSelectNext();
    expect(store.getState().commitCursor).toBe("commit:aaa");
    await commitSelectNext();
    expect(store.getState().commitCursor).toBe("commit-dir:aaa:src");
    expect(store.getState().commitView).toBeNull();
    await commitSelectNext();
    expect(store.getState().commitCursor).toBe("commit-file:aaa:src/a.ts");
  });
});

describe("commit files from a real repo", () => {
  test("renames are placed at their destination path with numstat counts", async () => {
    const dir = await initRepo();
    const nested = join(dir, "src");
    await mkdir(nested, { recursive: true });
    const oldLines = ["l1", "l2", "l3", "l4", "l5", "l6", "l7", "l8", "l9"];
    await writeFile(join(nested, "old.txt"), `${oldLines.join("\n")}\n`);
    await commitAll(dir, "first");
    await gitThrow(["mv", "src/old.txt", "src/new.txt"], dir);
    const newLines = [...oldLines.slice(0, -1), "x9", "l10"];
    await writeFile(join(nested, "new.txt"), `${newLines.join("\n")}\n`);
    await commitAll(dir, "rename it");

    const store = repoStore(dir);
    await loadCommits();

    const [top] = store.getState().commitEntries;
    expect(top?.message).toBe("rename it");
    const file = top?.files[0];
    expect(file?.path).toBe("src/new.txt");
    expect(file?.path.includes("\t")).toBe(false);
    expect(file?.status).toBe("renamed");
    expect(file?.additions).toBe(2);
    expect(file?.deletions).toBe(1);
  });

  test("tree rows from a real repo nest files under dirs", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "f.txt"), "x\n");
    await commitAll(dir, "placeholder");
    const nested = join(dir, "src", "ui");
    await mkdir(nested, { recursive: true });
    await writeFile(join(nested, "app.tsx"), "x\n");
    await commitAll(dir, "add nested file");

    const store = repoStore(dir, { focus: "commits" });
    await loadCommits();

    const [top] = store.getState().commitEntries;
    if (!top) {
      throw new Error("expected a commit");
    }
    toggleCommitExpand(top.hash);
    const rows = store.commitRows().map(commitRowKey);
    expect(rows).toContain(`commit-dir:${top.hash}:src/ui`);
    expect(rows).toContain(`commit-file:${top.hash}:src/ui/app.tsx`);
  });
});
