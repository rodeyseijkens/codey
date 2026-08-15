import { describe, expect, test } from "bun:test";
import { resolveKeymap } from "../src/keymap/index";
import { AppStore, setStore } from "../src/state/store";
import { handleDiffPaneKey } from "../src/ui/diff-pane";
import type { CanonicalDiffRow } from "../src/ui/hunk-diff/opentui";

const keymapRes = resolveKeymap({});
if (!keymapRes.ok) {
  throw new Error("expected default keymap");
}

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
  test("next-hunk jumps to next change block from header", () => {
    const store = new AppStore({
      cursorRow: 0,
      focus: "diff",
      keymap: keymapRes.keymap,
    });
    setStore(store);

    handleDiffPaneKey(
      { ctrl: false, meta: false, name: "]", shift: false } as never,
      store,
      keymapRes.keymap,
      rows,
      null
    );
    expect(store.getState().cursorRow).toBe(2);
  });

  test("prev-hunk jumps to previous change block from context", () => {
    const store = new AppStore({
      cursorRow: 5,
      focus: "diff",
      keymap: keymapRes.keymap,
    });
    setStore(store);

    handleDiffPaneKey(
      { ctrl: false, meta: false, name: "[", shift: false } as never,
      store,
      keymapRes.keymap,
      rows,
      null
    );
    expect(store.getState().cursorRow).toBe(2);
  });

  test("next-hunk from last change block stays", () => {
    const store = new AppStore({
      cursorRow: 6,
      focus: "diff",
      keymap: keymapRes.keymap,
    });
    setStore(store);

    handleDiffPaneKey(
      { ctrl: false, meta: false, name: "]", shift: false } as never,
      store,
      keymapRes.keymap,
      rows,
      null
    );
    expect(store.getState().cursorRow).toBe(6);
  });

  test("prev-hunk from first change block stays", () => {
    const store = new AppStore({
      cursorRow: 2,
      focus: "diff",
      keymap: keymapRes.keymap,
    });
    setStore(store);

    handleDiffPaneKey(
      { ctrl: false, meta: false, name: "[", shift: false } as never,
      store,
      keymapRes.keymap,
      rows,
      null
    );
    expect(store.getState().cursorRow).toBe(2);
  });

  test("next-hunk skips rest of current block", () => {
    const store = new AppStore({
      cursorRow: 2,
      focus: "diff",
      keymap: keymapRes.keymap,
    });
    setStore(store);

    handleDiffPaneKey(
      { ctrl: false, meta: false, name: "]", shift: false } as never,
      store,
      keymapRes.keymap,
      rows,
      null
    );
    expect(store.getState().cursorRow).toBe(6);
  });
});
