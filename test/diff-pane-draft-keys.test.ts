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
];

describe("handleDiffPaneKey during a comment draft", () => {
  test("j/k do not move the cursor while composing", () => {
    const store = new AppStore({
      commentDraft: {
        context: "a",
        endRow: 1,
        mode: "add",
        path: "foo.ts",
        scope: "changes",
        startRow: 1,
        text: "hello",
      },
      cursorRow: 1,
      focus: "diff",
      keymap: keymapRes.keymap,
    });
    setStore(store);

    handleDiffPaneKey(
      { ctrl: false, meta: false, name: "j", shift: false } as never,
      store,
      keymapRes.keymap,
      rows,
      null
    );
    expect(store.getState().cursorRow).toBe(1);

    handleDiffPaneKey(
      { ctrl: false, meta: false, name: "k", shift: false } as never,
      store,
      keymapRes.keymap,
      rows,
      null
    );
    expect(store.getState().cursorRow).toBe(1);
  });
});
