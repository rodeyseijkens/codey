import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  commitSelectNext,
  commitSelectNextFile,
  commitSelectPrev,
  commitToggleCursorRow,
  confirmCommitAll,
  loadCommits,
  submitCommitDraft,
} from "../src/state/actions/commits";
import { refresh } from "../src/state/actions/core";
import {
  focusCommits,
  focusPrev,
  toggleFocus,
  toggleSidebar,
} from "../src/state/actions/navigation";
import { dispatchCommand } from "../src/state/command-registry";
import {
  type AppState,
  AppStore,
  commitRowKey,
  setStore,
} from "../src/state/store";
import type { CommitEntry, FileDiff, FileStatus } from "../src/types";
import { gitThrow } from "../src/vcs/git";
import { afterAll, describe, expect, test } from "bun:test";

const dirs: string[] = [];

async function initRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "codey-commits-"));
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

async function makeCommits(dir: string, n: number, i = 0): Promise<void> {
  if (i >= n) {
    return;
  }
  await writeFile(join(dir, "f.txt"), `v${i}\n`);
  await commitAll(dir, `commit ${i}`);
  await makeCommits(dir, n, i + 1);
}

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

function setupStore(init: Partial<AppState> = {}, repoRoot?: string): AppStore {
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
      stagingEnabled: false,
    });
  }
  return store;
}

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

function diffFile(path: string): FileDiff {
  return {
    additions: 0,
    deletions: 0,
    diff: "",
    isBinary: false,
    path,
    status: "modified",
    tooLarge: false,
  };
}

describe("focus cycling", () => {
  test("tab cycles sidebar → diff → commits → sidebar", () => {
    const store = setupStore();
    expect(store.getState().focus).toBe("sidebar");
    dispatchCommand("focus-toggle");
    expect(store.getState().focus).toBe("diff");
    dispatchCommand("focus-toggle");
    expect(store.getState().focus).toBe("commits");
    dispatchCommand("focus-toggle");
    expect(store.getState().focus).toBe("sidebar");
  });

  test("shift+tab cycles backwards", () => {
    const store = setupStore({ focus: "diff" });
    focusPrev();
    expect(store.getState().focus).toBe("sidebar");
    focusPrev();
    expect(store.getState().focus).toBe("commits");
    focusPrev();
    expect(store.getState().focus).toBe("diff");
  });

  test("0/1/2 focus changes, diff and commits direct selection", () => {
    const store = setupStore({ focus: "diff" });
    dispatchCommand("focus-sidebar");
    expect(store.getState().focus).toBe("sidebar");
    dispatchCommand("focus-diff");
    expect(store.getState().focus).toBe("diff");
    dispatchCommand("focus-commits");
    expect(store.getState().focus).toBe("commits");
    expect(store.getState().sidebarVisible).toBe(true);
  });

  test("focusing commits re-shows a hidden sidebar", () => {
    const store = setupStore({ focus: "diff", sidebarVisible: false });
    focusCommits();
    expect(store.getState().sidebarVisible).toBe(true);
    expect(store.getState().focus).toBe("commits");
  });
});

describe("sidebar visibility rules", () => {
  test("hiding the sidebar forces diff focus; tab stays on diff", () => {
    const store = setupStore({ focus: "sidebar", sidebarVisible: true });
    toggleSidebar();
    expect(store.getState().sidebarVisible).toBe(false);
    expect(store.getState().focus).toBe("diff");
    toggleFocus();
    expect(store.getState().focus).toBe("diff");
  });

  test("reopening focuses commits when a commitView is shown", () => {
    const store = setupStore({
      commitView: { file: diffFile("a.txt"), hash: "abc" },
      focus: "diff",
      sidebarVisible: false,
    });
    toggleSidebar();
    expect(store.getState().sidebarVisible).toBe(true);
    expect(store.getState().focus).toBe("commits");
  });

  test("reopening focuses the sidebar without a commitView", () => {
    const store = setupStore({ focus: "diff", sidebarVisible: false });
    toggleSidebar();
    expect(store.getState().sidebarVisible).toBe(true);
    expect(store.getState().focus).toBe("sidebar");
  });
});

describe("commit pane navigation", () => {
  test("j/k moves over a flat header/list, no wrap at boundaries", async () => {
    const hashes = ["aaa", "bbb", "ccc"];
    const store = setupStore({
      commitCursor: null,
      commitEntries: hashes.map((h) => entry(h, [])),
      commitHasMore: true,
    });

    await commitSelectNext();
    expect(store.getState().commitCursor).toBe("commit:aaa");
    await commitSelectNext();
    expect(store.getState().commitCursor).toBe("commit:bbb");
    await commitSelectPrev();
    expect(store.getState().commitCursor).toBe("commit:aaa");
    await commitSelectPrev();
    expect(store.getState().commitCursor).toBe("commit:aaa");
    await commitSelectNext();
    expect(store.getState().commitCursor).toBe("commit:bbb");
    await commitSelectNext();
    expect(store.getState().commitCursor).toBe("commit:ccc");
    await commitSelectNext();
    expect(store.getState().commitCursor).toBe("commit-load-more");
    await commitSelectNext();
    expect(store.getState().commitCursor).toBe("commit-load-more");
    await commitSelectPrev();
    expect(store.getState().commitCursor).toBe("commit:ccc");
  });

  test("a stale cursor falls back to row 0 or the last row", async () => {
    const hashes = ["aaa", "bbb"];
    const store = setupStore({
      commitCursor: "commit:gone",
      commitEntries: hashes.map((h) => entry(h, [])),
      commitHasMore: false,
    });
    await commitSelectNext();
    expect(store.getState().commitCursor).toBe("commit:aaa");
    store.set({ commitCursor: "commit:gone" });
    await commitSelectPrev();
    expect(store.getState().commitCursor).toBe("commit:bbb");
  });

  test("k from the first file of an expanded commit lands on its header", async () => {
    const store = setupStore({
      collapsed: { aaa: true },
      commitCursor: "commit-file:aaa:b.txt",
      commitEntries: [
        entry("aaa", [
          ["a.txt", "modified"],
          ["b.txt", "added"],
        ]),
        entry("bbb", []),
      ],
      commitHasMore: false,
    });
    expect(store.commitRows().map(commitRowKey)).toEqual([
      "commit:aaa",
      "commit-file:aaa:a.txt",
      "commit-file:aaa:b.txt",
      "commit:bbb",
    ]);
    await commitSelectPrev();
    expect(store.getState().commitCursor).toBe("commit-file:aaa:a.txt");
    await commitSelectPrev();
    expect(store.getState().commitCursor).toBe("commit:aaa");
    await commitSelectPrev();
    expect(store.getState().commitCursor).toBe("commit:aaa");
  });

  test("space on a header toggles expansion; space on a file does nothing", async () => {
    const store = setupStore({
      collapsed: {},
      commitCursor: "commit:aaa",
      commitEntries: [entry("aaa", [["a.txt", "modified"]])],
      commitHasMore: false,
    });
    expect(store.commitRows().map(commitRowKey)).toEqual(["commit:aaa"]);
    await commitToggleCursorRow();
    expect(store.getState().collapsed.aaa).toBe(true);
    expect(store.commitRows().map(commitRowKey)).toEqual([
      "commit:aaa",
      "commit-file:aaa:a.txt",
    ]);

    store.set({ commitCursor: "commit-file:aaa:a.txt" });
    await commitToggleCursorRow();
    expect(store.getState().collapsed.aaa).toBe(true);

    store.set({ commitCursor: "commit:aaa" });
    await commitToggleCursorRow();
    expect(store.getState().collapsed.aaa).toBe(false);
  });

  test("dispatch select-prev/next is focus-aware", () => {
    const store = setupStore({
      commitCursor: null,
      commitEntries: [entry("aaa", []), entry("bbb", [])],
      commitHasMore: false,
      focus: "commits",
    });
    dispatchCommand("select-next");
    expect(store.getState().commitCursor).toBe("commit:aaa");
    dispatchCommand("select-prev");
    expect(store.getState().commitCursor).toBe("commit:aaa");
  });
});

describe("commit pane with a real repo", () => {
  test("load-more moves the cursor onto the first newly appended item", async () => {
    const dir = await initRepo();
    await makeCommits(dir, 12);
    const store = setupStore({}, dir);
    await loadCommits();
    expect(store.getState().commitEntries).toHaveLength(10);
    expect(store.getState().commitHasMore).toBe(true);

    store.set({ commitCursor: "commit-load-more" });
    await commitToggleCursorRow();
    expect(store.getState().commitEntries).toHaveLength(12);
    const bc = store.getState().commitCursor;
    const [firstNew] = store.getState().commitEntries.slice(10);
    expect(firstNew).toBeDefined();
    expect(bc).toBe(`commit:${firstNew?.hash ?? ""}`);
  });

  test("selecting a commit file loads its diff and keeps focus on commits", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "base\n");
    await commitAll(dir, "first");
    await writeFile(join(dir, "a.txt"), "base\nupdated\n");
    await commitAll(dir, "second");
    const store = setupStore({ focus: "commits" }, dir);
    await loadCommits();

    const [top] = store.getState().commitEntries;
    const topHash = top?.hash ?? "";
    const [topRow] = store.commitRows();
    store.set({ commitCursor: topRow ? commitRowKey(topRow) : null });
    await commitToggleCursorRow();
    expect(store.getState().collapsed[topHash]).toBe(true);
    await commitSelectNext();

    const cv = store.getState().commitView;
    expect(cv).not.toBeNull();
    expect(cv?.hash).toBe(topHash);
    expect(cv?.file.diff).toContain("+updated");
    expect(store.getState().selection).toBeNull();
    expect(store.getState().focus).toBe("commits");
  });

  test("refresh keeps a commit cursor whose hash survives", async () => {
    const dir = await initRepo();
    await makeCommits(dir, 3);
    const store = setupStore({}, dir);
    await loadCommits();
    const entries = store.getState().commitEntries;
    const [, target] = entries;
    if (!target) {
      throw new Error("expected at least two commits");
    }
    store.set({
      commitCursor: commitRowKey({
        hash: target.hash,
        index: 1,
        kind: "header",
      }),
    });
    await refresh();
    expect(store.getState().commitCursor).toBe(`commit:${target.hash}`);
  });

  test("refresh falls back to row 0 when the hash is gone", async () => {
    const dir = await initRepo();
    await makeCommits(dir, 3);
    const store = setupStore({}, dir);
    await loadCommits();
    store.set({ commitCursor: "commit:not-a-real-hash" });
    await refresh();
    const [firstRow] = store.commitRows();
    if (!firstRow) {
      throw new Error("expected a commit row after refresh");
    }
    expect(store.getState().commitCursor).toBe(commitRowKey(firstRow));
  });

  test("f/F jump between commit file rows and keep focus on commits", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "base\n");
    await writeFile(join(dir, "b.txt"), "b\n");
    await commitAll(dir, "first");
    await writeFile(join(dir, "a.txt"), "base\nupdated\n");
    await writeFile(join(dir, "b.txt"), "b\nupdated\n");
    await commitAll(dir, "second");
    const store = setupStore({ focus: "commits" }, dir);
    await loadCommits();

    const [top] = store.getState().commitEntries;
    if (!top) {
      throw new Error("expected a commit");
    }
    const [firstFile, secondFile] = top.files;
    if (!(firstFile && secondFile)) {
      throw new Error("expected a two-file commit");
    }
    store.set({ collapsed: { [top.hash]: true } });
    store.set({
      commitCursor: commitRowKey({ hash: top.hash, index: 0, kind: "header" }),
    });

    function fileKey(path: string, hash: string): string {
      return `commit-file:${hash}:${path}`;
    }
    await commitSelectNextFile();
    expect(store.getState().commitCursor).toBe(
      fileKey(firstFile.path, top.hash),
    );
    expect(store.getState().commitView?.hash).toBe(top.hash);
    expect(store.getState().commitView?.file.diff).toContain("+updated");
    expect(store.getState().focus).toBe("commits");

    dispatchCommand("next-file");
    expect(store.getState().commitCursor).toBe(
      fileKey(secondFile.path, top.hash),
    );
    dispatchCommand("next-file");
    expect(store.getState().commitCursor).toBe(
      fileKey(secondFile.path, top.hash),
    );
    dispatchCommand("prev-file");
    expect(store.getState().commitCursor).toBe(
      fileKey(firstFile.path, top.hash),
    );
  });

  test("f/F stay put when the commit list has no file rows", () => {
    const store = setupStore({
      collapsed: {},
      commitCursor: "commit:aaa",
      commitEntries: [entry("aaa", [["a.txt", "modified"]])],
      commitHasMore: false,
      focus: "commits",
    });
    dispatchCommand("next-file");
    expect(store.getState().commitCursor).toBe("commit:aaa");
    dispatchCommand("prev-file");
    expect(store.getState().commitCursor).toBe("commit:aaa");
  });
});

describe("focus gating in dispatch", () => {
  test("f/F do not move the changes selection from the commits focus", () => {
    const store = setupStore({
      changesets: [
        {
          files: [diffFile("a.txt"), diffFile("b.txt")],
          id: "changes",
          label: "Changes",
          stats: { additions: 0, deletions: 0, files: 2 },
        },
      ],
      focus: "commits",
      selection: { index: 0, kind: "file", scope: "changes" },
    });
    dispatchCommand("next-file");
    expect(store.getState().selection).toEqual({
      index: 0,
      kind: "file",
      scope: "changes",
    });
    dispatchCommand("prev-file");
    expect(store.getState().selection).toEqual({
      index: 0,
      kind: "file",
      scope: "changes",
    });
  });

  test("staging keys are gated while a commit file is shown", () => {
    const store = setupStore({
      changesets: [
        {
          files: [diffFile("a.txt")],
          id: "changes",
          label: "Changes",
          stats: { additions: 0, deletions: 0, files: 1 },
        },
      ],
      commitView: { file: diffFile("commit.txt"), hash: "aaa" },
      focus: "diff",
      selection: null,
    });
    dispatchCommand("stage-all");
    dispatchCommand("stage-file");
    expect(store.getState().toast).toBeNull();
    expect(store.getState().pendingStage).toBeNull();
  });

  test("f/F move the changes selection while the diff pane is focused", () => {
    const store = setupStore({
      changesets: [
        {
          files: [diffFile("a.txt"), diffFile("b.txt")],
          id: "changes",
          label: "Changes",
          stats: { additions: 0, deletions: 0, files: 2 },
        },
      ],
      focus: "diff",
      selection: { index: 0, kind: "file", scope: "changes" },
    });
    dispatchCommand("next-file");
    expect(store.getState().selection).toEqual({
      index: 1,
      kind: "file",
      scope: "changes",
    });
    expect(store.getState().focus).toBe("diff");
  });
});

describe("commit draft", () => {
  test("c opens the commit input only from the commits focus", () => {
    const store = setupStore({ focus: "commits" });
    dispatchCommand("add-comment");
    expect(store.getState().commitDraft).toBe("");
    dispatchCommand("add-comment");
    expect(store.getState().commitDraft).toBe("");
  });

  test("empty message cancels the draft", async () => {
    const dir = await initRepo();
    const store = setupStore({ focus: "commits" }, dir);
    dispatchCommand("add-comment");
    await submitCommitDraft("   ");
    expect(store.getState().commitDraft).toBeNull();
  });

  test("submitting with staged changes creates a commit", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "v1\n");
    await gitThrow(["add", "-A"], dir);
    const store = setupStore(
      {
        changesets: [
          {
            files: [diffFile("a.txt")],
            id: "staged",
            label: "Staged",
            stats: { additions: 1, deletions: 0, files: 1 },
          },
        ],
        focus: "commits",
      },
      dir,
    );
    dispatchCommand("add-comment");
    await submitCommitDraft("feat: test commit");
    expect(store.getState().commitDraft).toBeNull();
    expect(store.getState().overlay).toBeNull();
    expect((await gitThrow(["log", "-1", "--format=%s"], dir)).trim()).toBe(
      "feat: test commit",
    );
  });

  test("submitting with nothing staged asks to commit all changes", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "v1\n");
    const store = setupStore(
      {
        changesets: [
          {
            files: [diffFile("a.txt")],
            id: "changes",
            label: "Changes",
            stats: { additions: 1, deletions: 0, files: 1 },
          },
        ],
        focus: "commits",
      },
      dir,
    );
    dispatchCommand("add-comment");
    await submitCommitDraft("feat: all in");
    expect(store.getState().commitDraft).toBeNull();
    expect(store.getState().overlay).toEqual({
      kind: "confirm-commit-all",
      message: "feat: all in",
    });
    await confirmCommitAll();
    expect(store.getState().overlay).toBeNull();
    expect((await gitThrow(["log", "-1", "--format=%s"], dir)).trim()).toBe(
      "feat: all in",
    );
  });

  test("submitting with no changes at all shows a toast", async () => {
    const dir = await initRepo();
    const store = setupStore({ focus: "commits" }, dir);
    dispatchCommand("add-comment");
    await submitCommitDraft("feat: nothing");
    expect(store.getState().commitDraft).toBeNull();
    expect(store.getState().toast?.kind).toBe("info");
  });
});
