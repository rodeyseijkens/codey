import { DEFAULT_KEYBINDINGS } from "../src/keymap/commands";
import {
  COMMIT_MAX_HEIGHT,
  COMMIT_MIN_HEIGHT,
} from "../src/state/actions/core";
import {
  dragCommitPane,
  endCommitPaneDrag,
  resizeCommitPane,
  setCommitPaneHeight,
  startCommitPaneDrag,
} from "../src/state/actions/navigation";
import { dispatchCommand } from "../src/state/command-registry";
import { type AppState, AppStore, setStore } from "../src/state/store";
import { describe, expect, test } from "bun:test";

function setupStore(init: Partial<AppState> = {}): AppStore {
  const store = new AppStore(init);
  setStore(store);
  return store;
}

describe("commit pane height", () => {
  test("resizeCommitPane clamps to the configured bounds", () => {
    const store = setupStore({ commitHeight: 12 });
    resizeCommitPane(-100);
    expect(store.getState().commitHeight).toBe(COMMIT_MIN_HEIGHT);
    resizeCommitPane(100);
    expect(store.getState().commitHeight).toBe(COMMIT_MAX_HEIGHT);
  });

  test("setCommitPaneHeight accepts in-range values", () => {
    const store = setupStore({ commitHeight: 12 });
    setCommitPaneHeight(20);
    expect(store.getState().commitHeight).toBe(20);
  });

  test("drag uses the captured anchor so jitter does not accumulate", () => {
    const store = setupStore({ commitHeight: 12 });
    startCommitPaneDrag(30);
    dragCommitPane(28);
    expect(store.getState().commitHeight).toBe(14);
    dragCommitPane(31);
    expect(store.getState().commitHeight).toBe(11);
    endCommitPaneDrag();
    expect(store.getState().commitDrag).toBeNull();
    dragCommitPane(10);
    expect(store.getState().commitHeight).toBe(11);
  });

  test("drag clamps to bounds", () => {
    const store = setupStore({ commitHeight: 12 });
    startCommitPaneDrag(30);
    dragCommitPane(100);
    expect(store.getState().commitHeight).toBe(COMMIT_MIN_HEIGHT);
    dragCommitPane(0);
    expect(store.getState().commitHeight).toBe(COMMIT_MAX_HEIGHT);
  });
});

describe("resize command dispatch", () => {
  test("commit-taller and commit-shorter resize the pane", () => {
    const store = setupStore({ commitHeight: 12 });
    dispatchCommand("commit-taller");
    expect(store.getState().commitHeight).toBe(14);
    dispatchCommand("commit-shorter");
    expect(store.getState().commitHeight).toBe(12);
  });

  test("sidebar grow/shrink defaults gained shift+arrow and shift+h/l keys", () => {
    expect(DEFAULT_KEYBINDINGS["sidebar-grow"]).toEqual([
      ">",
      "shift+right",
      "shift+l",
    ]);
    expect(DEFAULT_KEYBINDINGS["sidebar-shrink"]).toEqual([
      "<",
      "shift+left",
      "shift+h",
    ]);
    expect(DEFAULT_KEYBINDINGS["commit-taller"]).toEqual([
      "shift+up",
      "shift+k",
    ]);
    expect(DEFAULT_KEYBINDINGS["commit-shorter"]).toEqual([
      "shift+down",
      "shift+j",
    ]);
  });
});
