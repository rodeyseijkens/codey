import { toggleAllTreeFolders } from "../src/state/actions/navigation";
import { AppStore, setStore } from "../src/state/store";
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

function changeset(id: Changeset["id"], files: string[]): Changeset {
  return {
    files: files.map(file),
    id,
    label: id,
    stats: { additions: 0, deletions: 0, files: files.length },
  };
}

describe("toggleAllTreeFolders", () => {
  test("collapses every folder when any folder is expanded", () => {
    const store = new AppStore({
      changesets: [
        {
          ...changeset("changes", [
            "src/components/Button.tsx",
            "src/a.ts",
            "README.md",
          ]),
        },
      ],
    });
    setStore(store);

    toggleAllTreeFolders();

    expect(store.getState().collapsedTree).toEqual({
      "changes:src": true,
      "changes:src/components": true,
    });
  });

  test("expands every folder when all folders are collapsed", () => {
    const store = new AppStore({
      changesets: [
        {
          ...changeset("changes", [
            "src/components/Button.tsx",
            "src/a.ts",
            "README.md",
          ]),
        },
      ],
      collapsedTree: { "changes:src": true, "changes:src/components": true },
    });
    setStore(store);

    toggleAllTreeFolders();

    expect(store.getState().collapsedTree).toEqual({});
  });

  test("keeps folders of one section independent from another section", () => {
    const store = new AppStore({
      changesets: [
        { ...changeset("changes", ["src/a.ts"]) },
        { ...changeset("staged", ["lib/b.ts"]) },
      ],
      collapsedTree: { "staged:lib": true },
    });
    setStore(store);

    toggleAllTreeFolders();

    expect(store.getState().collapsedTree).toEqual({
      "changes:src": true,
      "staged:lib": true,
    });
  });

  test("collapses nested folders, not just top-level", () => {
    const store = new AppStore({
      changesets: [{ ...changeset("changes", ["a/b/c/x.ts", "a/b/d/y.ts"]) }],
    });
    setStore(store);

    toggleAllTreeFolders();

    expect(store.getState().collapsedTree).toEqual({
      "changes:a/b": true,
      "changes:a/b/c": true,
      "changes:a/b/d": true,
    });
  });

  test("expands all when visible folders are collapsed but nested ones are not", () => {
    const store = new AppStore({
      changesets: [
        {
          ...changeset("changes", [
            "src/components/Button.tsx",
            "src/a.ts",
            "README.md",
          ]),
        },
      ],
      collapsedTree: { "changes:src": true },
    });
    setStore(store);

    toggleAllTreeFolders();

    expect(store.getState().collapsedTree).toEqual({});
  });
});
