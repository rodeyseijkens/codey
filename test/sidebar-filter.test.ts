import { COMMAND_DEFS } from "../src/keymap/commands";
import { dispatchCommand } from "../src/state/command-registry";
import {
  acceptSidebarFilter,
  setSidebarFilterQuery,
} from "../src/state/search-actions";
import { fuzzyMatches } from "../src/state/sidebar-filter";
import { type AppState, AppStore, setStore } from "../src/state/store";
import type { Changeset } from "../src/types";
import { describe, expect, test } from "bun:test";

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

function storeWith(init: Partial<AppState>): AppStore {
  const store = new AppStore(init);
  setStore(store);
  return store;
}

describe("fuzzyMatches", () => {
  test("empty query matches everything", () => {
    expect(fuzzyMatches("src/a.ts", "")).toBe(true);
  });

  test("matches case-insensitive subsequences", () => {
    expect(fuzzyMatches("src/ui/Sidebar.tsx", "sbt")).toBe(true);
    expect(fuzzyMatches("src/ui/Sidebar.tsx", "SBX")).toBe(true);
  });

  test("rejects out-of-order characters", () => {
    expect(fuzzyMatches("src/ui/sidebar.tsx", "xr")).toBe(false);
  });

  test("rejects missing characters", () => {
    expect(fuzzyMatches("src/ui/sidebar.tsx", "zzz")).toBe(false);
  });
});

describe("sidebarRows with filter", () => {
  test("list view hides non-matching files and keeps original indices", () => {
    const store = storeWith({
      changesets: [
        changeset("staged", ["src/a.ts"]),
        changeset("changes", ["src/ui/b.tsx", "docs/readme.md"]),
      ],
      sidebarFilter: { open: true, query: "ts" },
    });
    const files = store.sidebarRows().filter((row) => row.kind === "file");
    expect(files).toEqual([
      { index: 0, kind: "file", scope: "staged" },
      { index: 0, kind: "file", scope: "changes" },
    ]);
  });

  test("tree view hides folders without matching files", () => {
    const store = storeWith({
      changesets: [changeset("changes", ["src/ui/b.tsx", "docs/readme.md"])],
      sidebarFilter: { open: true, query: "readme" },
    });
    const rows = store.sidebarRows();
    const paths: (string | number)[] = [];
    for (const row of rows) {
      if (row.kind === "file") {
        paths.push(row.index);
      } else if (row.kind === "dir") {
        paths.push(row.path);
      }
    }
    expect(paths).toEqual(["docs", 1]);
  });

  test("filter expands collapsed folders", () => {
    const store = storeWith({
      changesets: [changeset("changes", ["docs/readme.md"])],
      collapsedTree: { "changes:docs": true },
      sidebarFilter: { open: true, query: "readme" },
    });
    const rows = store.sidebarRows();
    expect(rows.some((row) => row.kind === "file" && row.index === 0)).toBe(
      true,
    );
  });

  test("filter expands collapsed sections", () => {
    const store = storeWith({
      changesets: [changeset("changes", ["docs/readme.md"])],
      collapsed: { changes: true },
      sidebarFilter: { open: true, query: "readme" },
    });
    const rows = store.sidebarRows();
    expect(rows.some((row) => row.kind === "file" && row.index === 0)).toBe(
      true,
    );
  });

  test("empty query shows all files", () => {
    const store = storeWith({
      changesets: [changeset("changes", ["a.ts", "b.ts"])],
      sidebarFilter: { open: true, query: "" },
    });
    expect(
      store.sidebarRows().filter((row) => row.kind === "file"),
    ).toHaveLength(2);
  });
});

describe("acceptSidebarFilter", () => {
  test("jumps to the first matching file and closes the input", () => {
    const store = storeWith({
      changesets: [changeset("changes", ["src/a.ts", "src/b.ts"])],
      selection: null,
      sidebarFilter: { open: true, query: "b" },
    });
    acceptSidebarFilter();
    expect(store.getState().selection).toEqual({
      index: 1,
      kind: "file",
      scope: "changes",
    });
    expect(store.getState().sidebarFilter).toEqual({
      open: false,
      query: "b",
    });
  });

  test("keeps the input open when nothing matches", () => {
    const selection = { index: 0, kind: "file", scope: "changes" } as const;
    const store = storeWith({
      changesets: [changeset("changes", ["a.ts"])],
      selection: { ...selection },
      sidebarFilter: { open: true, query: "zzz" },
    });
    acceptSidebarFilter();
    expect(store.getState().sidebarFilter?.open).toBe(true);
    expect(store.getState().selection).toEqual(selection);
  });
});

describe("setSidebarFilterQuery", () => {
  test("ignores updates when the input is closed", () => {
    const store = storeWith({
      sidebarFilter: { open: false, query: "a" },
    });
    setSidebarFilterQuery("ab");
    expect(store.getState().sidebarFilter).toEqual({ open: false, query: "a" });
  });
});

describe("open-changes-search command", () => {
  test("binds / in the changes section, separate from diff search", () => {
    expect(COMMAND_DEFS["open-changes-search"]?.defaultKey).toBe("/");
    expect(COMMAND_DEFS["open-changes-search"]?.section).toBe("changes");
    expect(COMMAND_DEFS["open-diff-search"]?.defaultKey).toBe("/");
    expect(COMMAND_DEFS["open-diff-search"]?.section).toBe("diff");
  });

  test("opens the filter only from the changes pane", () => {
    const store = storeWith({
      changesets: [changeset("changes", ["a.ts"])],
      focus: "diff",
    });
    dispatchCommand("open-changes-search");
    expect(store.getState().sidebarFilter).toBeNull();
    store.set({ focus: "sidebar" });
    dispatchCommand("open-changes-search");
    expect(store.getState().sidebarFilter?.open).toBe(true);
  });

  test("diff search stays guarded to the diff pane", () => {
    const store = storeWith({ focus: "sidebar" });
    dispatchCommand("open-diff-search");
    expect(store.getState().diffSearch).toBeNull();
  });
});
