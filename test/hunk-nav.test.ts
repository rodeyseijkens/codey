import { AppStore, setStore } from "../src/state/store";
import { jumpHunk, registerDiffPaneHandle } from "../src/ui/diff-pane-runtime";
import type { CanonicalDiffRow } from "../src/ui/hunk-diff";
import { beforeEach, describe, expect, test } from "bun:test";

const rows: CanonicalDiffRow[] = [
  { hunkIndex: 0, kind: "header", text: "@@" },
  { hunkIndex: 0, kind: "context", newLine: 1, oldLine: 1, text: "a" },
  { hunkIndex: 0, kind: "add", newLine: 2, text: "b" },
  { hunkIndex: 0, kind: "del", oldLine: 3, text: "c" },
  { hunkIndex: 1, kind: "header", text: "@@" },
  { hunkIndex: 1, kind: "context", newLine: 5, oldLine: 5, text: "d" },
  { hunkIndex: 1, kind: "add", newLine: 6, text: "e" },
];

describe("hunk navigation", () => {
  beforeEach(() => {
    registerDiffPaneHandle({
      getRows: () => rows,
      getScrollBox: () => null,
    });
  });

  test("next-hunk jumps to next change block from header", () => {
    const store = new AppStore({ cursorRow: 0, focus: "diff" });
    setStore(store);
    jumpHunk("next-hunk");
    expect(store.getState().cursorRow).toBe(2);
  });

  test("prev-hunk jumps to previous change block from context", () => {
    const store = new AppStore({ cursorRow: 5, focus: "diff" });
    setStore(store);
    jumpHunk("prev-hunk");
    expect(store.getState().cursorRow).toBe(2);
  });

  test("next-hunk from last change block stays", () => {
    const store = new AppStore({ cursorRow: 6, focus: "diff" });
    setStore(store);
    jumpHunk("next-hunk");
    expect(store.getState().cursorRow).toBe(6);
  });

  test("prev-hunk from first change block stays", () => {
    const store = new AppStore({ cursorRow: 2, focus: "diff" });
    setStore(store);
    jumpHunk("prev-hunk");
    expect(store.getState().cursorRow).toBe(2);
  });

  test("next-hunk skips rest of current block", () => {
    const store = new AppStore({ cursorRow: 2, focus: "diff" });
    setStore(store);
    jumpHunk("next-hunk");
    expect(store.getState().cursorRow).toBe(6);
  });
});
