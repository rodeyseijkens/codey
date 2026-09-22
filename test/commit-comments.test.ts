import { formatCommentsAsMarkdown } from "../src/lib/clipboard";
import { AppStore } from "../src/state/store";
import type { Comment } from "../src/types";
import { describe, expect, test } from "bun:test";

function comment(overrides: Partial<Comment>): Comment {
  return {
    context: "",
    createdAt: 0,
    endRow: 2,
    id: crypto.randomUUID(),
    path: "src/main.ts",
    scope: "single",
    startRow: 1,
    text: "note",
    updatedAt: 0,
    ...overrides,
  };
}

describe("commentsFor commit scoping", () => {
  const hashA = "aaaaaaa1111111111111111111111111111111";
  const hashB = "bbbbbbb2222222222222222222222222222222";
  const store = new AppStore({
    comments: [
      comment({ commitHash: hashA, id: "a" }),
      comment({ commitHash: hashB, id: "b" }),
      comment({ id: "changes", scope: "changes" }),
    ],
  });

  test("filters commit comments by hash", () => {
    expect(
      store.commentsFor("single", "src/main.ts", hashA).map((c) => c.id),
    ).toEqual(["a"]);
    expect(
      store.commentsFor("single", "src/main.ts", hashB).map((c) => c.id),
    ).toEqual(["b"]);
  });

  test("returns every comment for the file when no hash is given", () => {
    expect(
      store
        .commentsFor("single", "src/main.ts")
        .map((c) => c.id)
        .sort(),
    ).toEqual(["a", "b"]);
  });

  test("keeps working-tree comments separate from commit comments", () => {
    expect(
      store.commentsFor("changes", "src/main.ts").map((c) => c.id),
    ).toEqual(["changes"]);
  });
});

describe("formatCommentsAsMarkdown commit grouping", () => {
  test("groups comments from different commits under separate headings", () => {
    const md = formatCommentsAsMarkdown("review", [
      comment({ commitHash: "aaaaaaa1111", id: "a" }),
      comment({ commitHash: "bbbbbbb2222", id: "b" }),
    ]);
    expect(md).toContain("## single:src/main.ts @ aaaaaaa");
    expect(md).toContain("## single:src/main.ts @ bbbbbbb");
  });
});
