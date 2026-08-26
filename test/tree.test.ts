import {
  buildFileTree,
  isFileHidden,
  treeKey,
  visibleTreeNodes,
} from "../src/lib/tree";
import type { FileDiff } from "../src/types";
import { describe, expect, test } from "bun:test";

function file(path: string, additions = 1, deletions = 0): FileDiff {
  return {
    additions,
    deletions,
    diff: "",
    isBinary: false,
    path,
    status: "modified",
    tooLarge: false,
  };
}

describe("buildFileTree", () => {
  test("groups files under directory nodes", () => {
    const files = [file("src/a.ts"), file("src/b.ts"), file("README.md")];
    const tree = buildFileTree(files);
    expect(tree).toHaveLength(2);
    expect(tree[0]).toMatchObject({ name: "src", path: "src", type: "dir" });
    expect(tree[1]).toMatchObject({ name: "README.md", type: "file" });
  });

  test("sorts directories before files, alphabetically within each", () => {
    const files = [
      file("z.txt"),
      file("a/b.ts"),
      file("a/c.ts"),
      file("a/b/d.ts"),
    ];
    const tree = buildFileTree(files);
    expect(tree[0]).toMatchObject({ name: "a", type: "dir" });
    expect(tree[1]).toMatchObject({ name: "z.txt", type: "file" });
    const [a] = tree;
    if (!a) {
      throw new Error("expected dir node");
    }
    expect(a.children?.map((n) => n.name)).toEqual(["b", "b.ts", "c.ts"]);
  });

  test("nested directories appear as children", () => {
    const tree = buildFileTree([file("src/foo/bar.ts")]);
    const [src] = tree;
    if (!src) {
      throw new Error("expected dir node");
    }
    expect(src).toMatchObject({ name: "src", type: "dir" });
    expect(src.children?.[0]).toMatchObject({
      name: "foo",
      path: "src/foo",
      type: "dir",
    });
  });

  test("aggregates additions, deletions and file counts", () => {
    const tree = buildFileTree([file("a/x.ts", 3, 1), file("a/b/y.ts", 2, 0)]);
    const [a] = tree;
    if (!a) {
      throw new Error("expected dir node");
    }
    expect(a.fileCount).toBe(2);
    expect(a.additions).toBe(5);
    expect(a.deletions).toBe(1);
  });

  test("keeps fileIndex pointing at the original array position", () => {
    const files = [file("a/x.ts"), file("top.ts"), file("a/y.ts")];
    const tree = buildFileTree(files);
    const [a] = tree;
    if (!a) {
      throw new Error("expected dir node");
    }
    const indices = (a.children ?? [])
      .filter((n) => n.type === "file")
      .map((n) => n.fileIndex);
    expect(indices).toEqual([0, 2]);
  });
});

describe("visibleTreeNodes", () => {
  test("walks expanded directories depth-first", () => {
    const tree = buildFileTree([
      file("a/b/x.ts"),
      file("a/y.ts"),
      file("z.ts"),
    ]);
    const visible = visibleTreeNodes("changes", tree, {});
    expect(visible.map((v) => v.node.path)).toEqual([
      "a",
      "a/b",
      "a/b/x.ts",
      "a/y.ts",
      "z.ts",
    ]);
    expect(visible.map((v) => v.depth)).toEqual([0, 1, 2, 1, 0]);
  });

  test("hides children of collapsed directories but keeps the dir row and sibling files", () => {
    const tree = buildFileTree([file("a/b/x.ts"), file("a/y.ts")]);
    const collapsedTree: Record<string, boolean> = {
      [treeKey("changes", "a/b")]: true,
    };
    const visible = visibleTreeNodes("changes", tree, collapsedTree);
    expect(visible.map((v) => v.node.path)).toEqual(["a", "a/b", "a/y.ts"]);
    expect(visible[1]?.collapsed).toBe(true);
  });
});

describe("isFileHidden", () => {
  test("detects files under collapsed ancestors", () => {
    const collapsedTree: Record<string, boolean> = {
      [treeKey("staged", "src/components")]: true,
    };
    expect(
      isFileHidden("staged", "src/components/Button.tsx", collapsedTree),
    ).toBe(true);
    expect(isFileHidden("staged", "src/other.ts", collapsedTree)).toBe(false);
    expect(
      isFileHidden("changes", "src/components/Button.tsx", collapsedTree),
    ).toBe(false);
  });
});
