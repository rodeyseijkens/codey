import { act } from "react";
import { testRender } from "@opentui/react/test-utils";

import { AppStore, setStore } from "../src/state/store";
import type { FileDiff, Scope } from "../src/types";
import { DiffPane } from "../src/ui/diff-pane";
import { describe, expect, test } from "bun:test";

const WIDTH = 80;
const TRAILING_SPACE_LIMIT = 5;

function file(overrides: Partial<FileDiff> = {}): FileDiff {
  return {
    additions: 0,
    deletions: 0,
    diff: "",
    isBinary: false,
    path: "image.png",
    status: "modified",
    tooLarge: false,
    ...overrides,
  };
}

function render(
  target: FileDiff | null,
  scope: Scope = "changes",
): ReturnType<typeof testRender> {
  const store = new AppStore({
    changesets: target
      ? [
          {
            files: [target],
            id: scope,
            label: "Changes",
            stats: { additions: 0, deletions: 0, files: 1 },
          },
        ]
      : [],
    selection: target ? { index: 0, kind: "file", scope } : null,
  });
  setStore(store);
  return testRender(
    <box style={{ flexDirection: "row", height: "100%", width: "100%" }}>
      <box style={{ width: 20 }} />
      <DiffPane />
    </box>,
    { height: 10, width: WIDTH },
  );
}

async function topRow(setup: Awaited<ReturnType<typeof render>>) {
  await act(async () => {
    await setup.renderOnce();
  });
  const frame = setup.captureCharFrame();
  const row = frame.split("\n")[0] ?? "";
  return { row, trailingSpaces: row.length - row.trimEnd().length };
}

describe("diff pane empty states fill their slot", () => {
  const cases: [string, FileDiff | null][] = [
    ["binary file", file({ isBinary: true })],
    ["ignored file", file({ ignored: true })],
    ["file too large", file({ tooLarge: true })],
    ["directory notice", file({ notice: "directory" })],
    ["no diff content", file()],
    ["no file selected", null],
  ];

  for (const [name, target] of cases) {
    test(`${name} notice stretches to the pane width`, async () => {
      const setup = await render(target);
      try {
        const { trailingSpaces } = await topRow(setup);
        expect(trailingSpaces).toBeLessThan(TRAILING_SPACE_LIMIT);
      } finally {
        await act(() => {
          setup.renderer.destroy();
        });
      }
    });
  }
});
