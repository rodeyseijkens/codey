import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { act } from "react";
import { testRender } from "@opentui/react/test-utils";

import { resolveKeymap } from "../src/keymap/index";
import { loadMoreCommits } from "../src/state/actions";
import { AppStore, setStore } from "../src/state/store";
import type { CommitEntry, FileStatus } from "../src/types";
import { Sidebar } from "../src/ui/sidebar";
import { gitThrow } from "../src/vcs/git";
import { afterAll, describe, expect, test } from "bun:test";

const CURSOR_KEY_RE = /^commit:/;

const keymapRes = resolveKeymap({});
if (!keymapRes.ok) {
  throw new Error("expected default keymap");
}

const dirs: string[] = [];

async function initRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "codey-scroll-"));
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

type ScrollboxShape = {
  scrollHeight: number;
  scrollTop: number;
  viewport: { height: number };
};

function findScrollboxAncestor(
  node: { parent: unknown } | null,
): ScrollboxShape | null {
  let cur: { parent: unknown } | null = node;
  while (cur) {
    const maybe = cur as unknown as {
      scrollTop: number;
      scrollHeight: number;
      viewport?: { height: number };
    };
    if (
      typeof maybe.scrollTop === "number" &&
      typeof maybe.scrollHeight === "number" &&
      maybe.viewport?.height !== undefined
    ) {
      return maybe as ScrollboxShape;
    }
    cur = cur.parent as { parent: unknown } | null;
  }
  return null;
}

async function waitStore(pred: () => boolean): Promise<void> {
  if (pred()) {
    return;
  }
  await Bun.sleep(10);
  await waitStore(pred);
}

describe("commit load more keeps scroll position", () => {
  test("loading more commits keeps the list scrolled down", async () => {
    const dir = await initRepo();
    await makeCommits(dir, 30);
    const mockHashes = Array.from({ length: 10 }, (_, i) => `mock${i}`);
    const commitEntries = mockHashes.map((h) =>
      entry(h, [
        ["a.txt", "modified"],
        ["b.txt", "added"],
      ]),
    );
    const collapsed: Record<string, boolean> = {};
    for (const h of mockHashes) {
      collapsed[h] = true;
    }
    const store = new AppStore({
      collapsed,
      commitEntries,
      commitHasMore: true,
      commitOffset: 10,
      keymap: keymapRes.keymap,
    });
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

    const setup = await testRender(<Sidebar />, {
      height: 40,
      useMouse: true,
      width: 120,
    });
    try {
      await act(async () => {
        await setup.renderOnce();
      });

      const { root } = setup.renderer;
      const loadMore = root.findDescendantById("commit-load-more");
      expect(loadMore).toBeDefined();
      const sb = findScrollboxAncestor(loadMore ?? null);
      if (!sb) {
        throw new Error("expected scrollbox ancestor");
      }
      const { scrollHeight, viewport } = sb;
      expect(scrollHeight).toBeGreaterThan(viewport.height);

      sb.scrollTop = Math.max(0, scrollHeight - viewport.height);
      await act(async () => {
        await setup.renderOnce();
      });
      const before = sb.scrollTop;
      expect(before).toBeGreaterThan(0);

      store.set({ commitCursor: "commit-load-more" });
      await act(async () => {
        await setup.renderOnce();
      });
      expect(sb.scrollTop).toBeGreaterThan(0);

      await act(async () => {
        await loadMoreCommits(true);
      });
      await waitStore(() => store.getState().commitEntries.length > 10);
      await act(async () => {
        await setup.renderOnce();
      });
      expect(store.getState().commitCursor).toMatch(CURSOR_KEY_RE);
      expect(sb.scrollTop).toBeGreaterThan(0);
    } finally {
      await act(() => {
        setup.renderer.destroy();
      });
    }
  });
});
