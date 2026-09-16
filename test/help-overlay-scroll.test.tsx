import { act, useEffect, useMemo } from "react";
import type { TestRendererSetup } from "@opentui/core/testing";
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";
import { KeymapProvider } from "@opentui/keymap/react";
import { useRenderer } from "@opentui/react";
import { testRender } from "@opentui/react/test-utils";

import { registerAppLayers } from "../src/keymap/layers";
import { AppStore, getStore, setStore } from "../src/state/store";
import { Overlays } from "../src/ui/overlays";
import { afterAll, describe, expect, test } from "bun:test";

function Harness() {
  const renderer = useRenderer();
  const keymap = useMemo(
    () => createDefaultOpenTuiKeymap(renderer),
    [renderer],
  );
  useEffect(() => registerAppLayers(keymap, getStore(), {}), [keymap]);
  return (
    <KeymapProvider keymap={keymap}>
      <Overlays />
    </KeymapProvider>
  );
}

const rendererCleanups: (() => void)[] = [];

afterAll(() => {
  for (const cleanup of rendererCleanups) {
    cleanup();
  }
});

async function renderHelp(): Promise<TestRendererSetup> {
  const store = new AppStore();
  setStore(store);
  store.set({ overlay: { kind: "help" } });
  const setup = await testRender(<Harness />, { height: 30, width: 90 });
  rendererCleanups.push(() => {
    void setup.renderer.destroy();
  });
  await act(async () => {
    await setup.renderOnce();
  });
  return setup;
}

describe("help overlay scroll", () => {
  test("j/k and arrow keys scroll the help content", async () => {
    const setup = await renderHelp();
    const top = setup.captureCharFrame();

    for (const key of ["j", "down", "j", "j"] as const) {
      if (key === "down") {
        setup.mockInput.pressArrow("down");
      } else {
        setup.mockInput.pressKey(key);
      }
    }
    await act(async () => {
      await setup.renderOnce();
    });
    const scrolled = setup.captureCharFrame();
    expect(scrolled).not.toBe(top);

    for (const key of ["k", "up", "k", "k"] as const) {
      if (key === "up") {
        setup.mockInput.pressArrow("up");
      } else {
        setup.mockInput.pressKey(key);
      }
    }
    await act(async () => {
      await setup.renderOnce();
    });
    expect(setup.captureCharFrame()).toBe(top);
  });
});
