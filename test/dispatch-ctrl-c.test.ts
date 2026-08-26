import { KeyEvent } from "@opentui/core";

import { resolveKeymap } from "../src/keymap/index";
import { handleKeyEvent, setQuitHandler } from "../src/state/dispatch";
import { AppStore, setStore } from "../src/state/store";
import { describe, expect, test } from "bun:test";

const keymapRes = resolveKeymap({});
if (!keymapRes.ok) {
  throw new Error("expected default keymap");
}

function ctrlC(): KeyEvent {
  return new KeyEvent({
    ctrl: true,
    eventType: "press",
    meta: false,
    name: "c",
    number: false,
    option: false,
    raw: "\x03",
    sequence: "\x03",
    shift: false,
    source: "raw",
  });
}

describe("handleKeyEvent ctrl+c", () => {
  test("clears the commit draft instead of quitting", () => {
    const store = new AppStore({
      commitDraft: "",
      focus: "commits",
      keymap: keymapRes.keymap,
    });
    setStore(store);

    handleKeyEvent(ctrlC(), keymapRes.keymap);

    const state = store.getState();
    expect(state.commitDraft).not.toBeNull();
    expect(state.draftClearTick).toBe(1);
  });

  test("clears the comment draft text and keeps the input open", () => {
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
      focus: "diff",
      keymap: keymapRes.keymap,
    });
    setStore(store);

    handleKeyEvent(ctrlC(), keymapRes.keymap);

    const state = store.getState();
    expect(state.commentDraft).not.toBeNull();
    expect(state.commentDraft?.text).toBe("");
    expect(state.draftClearTick).toBe(1);
  });

  test("quits when no input field is active", () => {
    const store = new AppStore({ keymap: keymapRes.keymap });
    setStore(store);

    let quitCalled = false;
    setQuitHandler(() => {
      quitCalled = true;
    });

    handleKeyEvent(ctrlC(), keymapRes.keymap);

    expect(quitCalled).toBe(true);
    expect(store.getState().draftClearTick).toBe(0);
  });
});
