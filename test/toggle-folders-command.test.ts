import { COMMAND_DEFS, DEFAULT_KEYBINDINGS } from "../src/keymap/commands";
import { dispatchCommand } from "../src/state/command-registry";
import { AppStore, setStore } from "../src/state/store";
import type { Changeset } from "../src/types";
import { describe, expect, test } from "bun:test";

function changeset(): Changeset {
  return {
    files: [
      {
        additions: 1,
        deletions: 0,
        diff: "",
        isBinary: false,
        path: "src/components/Button.tsx",
        status: "modified",
        tooLarge: false,
      },
    ],
    id: "changes",
    label: "Changes",
    stats: { additions: 1, deletions: 0, files: 1 },
  };
}

describe("toggle-folders command", () => {
  test("has no default keybinding", () => {
    expect(COMMAND_DEFS["toggle-folders"]?.defaultKey).toEqual([]);
    expect(DEFAULT_KEYBINDINGS["toggle-folders"]).toEqual([]);
  });

  test("is grouped under the changes section", () => {
    expect(COMMAND_DEFS["toggle-folders"]?.section).toBe("changes");
  });

  test("dispatch collapses all folders when in tree view", () => {
    const store = new AppStore({ changesets: [changeset()] });
    setStore(store);

    dispatchCommand("toggle-folders");

    expect(store.getState().collapsedTree).toEqual({
      "changes:src": true,
      "changes:src/components": true,
    });
  });

  test("dispatch expands all when every folder is collapsed", () => {
    const store = new AppStore({
      changesets: [changeset()],
      collapsedTree: { "changes:src": true, "changes:src/components": true },
    });
    setStore(store);

    dispatchCommand("toggle-folders");

    expect(store.getState().collapsedTree).toEqual({});
  });

  test("dispatch no-ops in list view", () => {
    const store = new AppStore({
      changesets: [changeset()],
      sidebarView: "list",
    });
    setStore(store);

    dispatchCommand("toggle-folders");

    expect(store.getState().collapsedTree).toEqual({});
  });
});
