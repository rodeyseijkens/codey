import { handleCtrlC } from "../src/state/ctrl-c";
import { setQuitHandler } from "../src/state/lifecycle";
import { AppStore, setStore } from "../src/state/store";
import { describe, expect, test } from "bun:test";

describe("handleCtrlC", () => {
  test("clears the commit draft instead of quitting", () => {
    const store = new AppStore({
      commitDraft: "",
      focus: "commits",
    });
    setStore(store);

    handleCtrlC(store);

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
    });
    setStore(store);

    handleCtrlC(store);

    const state = store.getState();
    expect(state.commentDraft).not.toBeNull();
    expect(state.commentDraft?.text).toBe("");
    expect(state.draftClearTick).toBe(1);
  });

  test("quits when no input field is active", () => {
    const store = new AppStore();
    setStore(store);

    let quitCalled = false;
    setQuitHandler(() => {
      quitCalled = true;
    });

    handleCtrlC(store);

    expect(quitCalled).toBe(true);
    expect(store.getState().draftClearTick).toBe(0);
  });
});
