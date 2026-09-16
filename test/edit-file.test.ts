import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  editFocusedFile,
  editorCommand,
  resolveEditTarget,
} from "../src/state/actions/editor";
import { dispatchCommand } from "../src/state/command-registry";
import { setEditorHandlers } from "../src/state/lifecycle";
import {
  type AppState,
  AppStore,
  commitRowKey,
  setStore,
} from "../src/state/store";
import type { CommitEntry, FileDiff, FileStatus } from "../src/types";
import { afterAll, afterEach, describe, expect, test } from "bun:test";

const dirs: string[] = [];
const savedEnv = {
  EDITOR: process.env.EDITOR,
  VISUAL: process.env.VISUAL,
};

afterEach(() => {
  process.env.EDITOR = savedEnv.EDITOR;
  process.env.VISUAL = savedEnv.VISUAL;
});

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
        changesets: store.getState().changesets,
        conflictNotice: null,
      }),
      loaderMode: "diff",
      repoRoot,
      stagingEnabled: false,
    });
  }
  return store;
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

describe("editorCommand", () => {
  test("prefers VISUAL over EDITOR and splits arguments", () => {
    process.env.VISUAL = "code -w";
    process.env.EDITOR = "nvim";
    expect(editorCommand()).toEqual(["code", "-w"]);
  });

  test("falls back to EDITOR, then vi", () => {
    delete process.env.VISUAL;
    process.env.EDITOR = "nvim -u custom.vim";
    expect(editorCommand()).toEqual(["nvim", "-u", "custom.vim"]);
    delete process.env.EDITOR;
    expect(editorCommand()).toEqual(["vi"]);
  });

  test("keeps quoted arguments together and ignores shell operators", () => {
    process.env.VISUAL = 'subl --wait "my dir"';
    expect(editorCommand()).toEqual(["subl", "--wait", "my dir"]);
    process.env.VISUAL = "vim | less";
    expect(editorCommand()).toEqual(["vim"]);
  });

  test("config editor beats VISUAL and EDITOR", () => {
    process.env.VISUAL = "code -w";
    process.env.EDITOR = "nvim";
    expect(editorCommand("helix")).toEqual(["helix"]);
    expect(editorCommand("  ")).toEqual(["code", "-w"]);
    expect(editorCommand(null)).toEqual(["code", "-w"]);
  });
});

describe("resolveEditTarget", () => {
  test("sidebar file selection resolves its path", () => {
    const store = new AppStore({
      changesets: [
        {
          files: [diffFile("a.txt"), diffFile("b.txt")],
          id: "changes",
          label: "Changes",
          stats: { additions: 0, deletions: 0, files: 2 },
        },
      ],
      focus: "sidebar",
      selection: { index: 1, kind: "file", scope: "changes" },
    });
    expect(resolveEditTarget(store)).toBe("b.txt");
  });

  test("sidebar dir/section selection has no target", () => {
    const store = new AppStore({
      changesets: [
        {
          files: [diffFile("a.txt")],
          id: "changes",
          label: "Changes",
          stats: { additions: 0, deletions: 0, files: 1 },
        },
      ],
      focus: "sidebar",
      selection: { kind: "dir", path: "src", scope: "changes" },
    });
    expect(resolveEditTarget(store)).toBeNull();
  });

  test("diff focus resolves the shown file via lastFile", () => {
    const store = new AppStore({
      changesets: [
        {
          files: [diffFile("a.txt"), diffFile("b.txt")],
          id: "changes",
          label: "Changes",
          stats: { additions: 0, deletions: 0, files: 2 },
        },
      ],
      focus: "diff",
      lastFile: { index: 0, scope: "changes" },
      selection: null,
    });
    expect(resolveEditTarget(store)).toBe("a.txt");
  });

  test("commits focus on a file row resolves that path", () => {
    const store = new AppStore({
      collapsed: { aaa: true },
      commitCursor: "commit-file:aaa:b.txt",
      commitEntries: [
        entry("aaa", [
          ["a.txt", "modified"],
          ["b.txt", "added"],
        ]),
      ],
      focus: "commits",
    });
    expect(store.commitCursorRow()?.kind).toBe("file");
    expect(resolveEditTarget(store)).toBe("b.txt");
  });

  test("commits focus on a header falls back to the shown commitView file", () => {
    const withView = new AppStore({
      collapsed: { aaa: true },
      commitCursor: "commit:aaa",
      commitEntries: [entry("aaa", [["a.txt", "modified"]])],
      commitView: { file: diffFile("cv.txt"), hash: "aaa" },
      focus: "commits",
    });
    expect(resolveEditTarget(withView)).toBe("cv.txt");

    const withoutView = new AppStore({
      collapsed: { aaa: true },
      commitCursor: commitRowKey({ hash: "aaa", index: 0, kind: "header" }),
      commitEntries: [entry("aaa", [["a.txt", "modified"]])],
      focus: "commits",
    });
    expect(resolveEditTarget(withoutView)).toBeNull();
  });
});

describe("editFocusedFile", () => {
  async function makeScratch(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "codey-edit-"));
    dirs.push(dir);
    return dir;
  }

  async function writeFakeEditor(dir: string): Promise<string> {
    const script = join(dir, "fake-editor.sh");
    await writeFile(script, '#!/bin/sh\necho edited >> "$1"\n');
    await chmod(script, 0o755);
    return script;
  }

  test("suspends the renderer, runs the editor, resumes, and refreshes", async () => {
    const dir = await makeScratch();
    const target = join(dir, "a.txt");
    await writeFile(target, "v1\n");
    process.env.VISUAL = await writeFakeEditor(dir);

    const events: string[] = [];
    let loadCount = 0;
    setEditorHandlers({
      resume: () => {
        events.push("resume");
      },
      suspend: () => {
        events.push("suspend");
      },
    });
    const store = setupStore({ focus: "diff" }, dir);
    store.set({
      changesets: [
        {
          files: [diffFile("a.txt")],
          id: "changes",
          label: "Changes",
          stats: { additions: 0, deletions: 0, files: 1 },
        },
      ],
      lastFile: { index: 0, scope: "changes" },
      selection: { index: 0, kind: "file", scope: "changes" },
    });
    store.set({
      load: () => {
        loadCount += 1;
        return Promise.resolve({
          branch: null,
          changesets: store.getState().changesets,
          conflictNotice: null,
        });
      },
    });

    await editFocusedFile();

    expect(events).toEqual(["suspend", "resume"]);
    expect(await Bun.file(target).text()).toContain("edited");
    expect(store.getState().editorBusy).toBe(false);
    expect(loadCount).toBe(1);
  });

  test("dispatch wires edit-file to the action and unblocks afterwards", async () => {
    const dir = await makeScratch();
    const target = join(dir, "b.txt");
    await writeFile(target, "v1\n");
    process.env.VISUAL = await writeFakeEditor(dir);

    const store = setupStore({ focus: "diff" }, dir);
    store.set({
      changesets: [
        {
          files: [diffFile("b.txt")],
          id: "changes",
          label: "Changes",
          stats: { additions: 0, deletions: 0, files: 1 },
        },
      ],
      lastFile: { index: 0, scope: "changes" },
    });

    dispatchCommand("edit-file");
    await new Promise<void>((resolve) => {
      const unsubscribe = store.subscribe(() => {
        if (!store.getState().editorBusy) {
          unsubscribe();
          resolve();
        }
      });
    });

    expect(store.getState().editorBusy).toBe(false);
    expect(await Bun.file(target).text()).toContain("edited");
  });

  test("rejects files missing from the working tree without spawning", async () => {
    const dir = await makeScratch();
    const sentinel = join(dir, "sentinel");
    process.env.VISUAL = `sh -c "touch ${JSON.stringify(sentinel)}"`;

    const store = setupStore({ focus: "diff" }, dir);
    store.set({
      changesets: [
        {
          files: [{ ...diffFile("gone.txt"), status: "deleted" }],
          id: "changes",
          label: "Changes",
          stats: { additions: 0, deletions: 0, files: 1 },
        },
      ],
      lastFile: { index: 0, scope: "changes" },
    });

    await dispatchCommand("edit-file");

    expect(store.getState().toast?.kind).toBe("error");
    expect(store.getState().editorBusy).toBe(false);
    expect(await Bun.file(sentinel).exists()).toBe(false);
  });

  test("uses the configured editor from store state", async () => {
    const dir = await makeScratch();
    const target = join(dir, "c.txt");
    await writeFile(target, "v1\n");
    process.env.VISUAL = "false";

    const store = setupStore({ focus: "diff" }, dir);
    store.set({
      changesets: [
        {
          files: [diffFile("c.txt")],
          id: "changes",
          label: "Changes",
          stats: { additions: 0, deletions: 0, files: 1 },
        },
      ],
      editor: await writeFakeEditor(dir),
      lastFile: { index: 0, scope: "changes" },
    });

    await editFocusedFile();

    expect(await Bun.file(target).text()).toContain("edited");
    expect(store.getState().editorBusy).toBe(false);
  });

  test("no git repository shows an info toast", async () => {
    const dir = await makeScratch();
    const sentinel = join(dir, "sentinel");
    process.env.VISUAL = `sh -c "touch ${JSON.stringify(sentinel)}"`;

    const store = setupStore({ focus: "diff" });
    store.set({
      changesets: [
        {
          files: [diffFile("a.txt")],
          id: "single",
          label: "Patch",
          stats: { additions: 0, deletions: 0, files: 1 },
        },
      ],
      lastFile: { index: 0, scope: "single" },
      repoRoot: null,
    });

    await editFocusedFile();

    expect(store.getState().toast?.kind).toBe("info");
    expect(await Bun.file(sentinel).exists()).toBe(false);
  });
});
