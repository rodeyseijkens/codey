import type { KeyEvent, Renderable } from "@opentui/core";
import type { Keymap } from "@opentui/keymap";
import { KeymapProvider } from "@opentui/keymap/react";
import { useKeyboard } from "@opentui/react";

import { handleCtrlC } from "../state/ctrl-c";
import { restart } from "../state/lifecycle";
import { getStore, useAppState } from "../state/store";
import { ColorProvider } from "./color-context";
import { getThemeColors } from "./colors";
import { DiffPane } from "./diff-pane";
import { Overlays } from "./overlays";
import { Sidebar } from "./sidebar";
import { BottomBar, TopBar } from "./status-bar";

function isCtrlC(e: KeyEvent): boolean {
  return Boolean(e.ctrl) && !e.meta && !e.shift && e.name.toLowerCase() === "c";
}

export function App({ keymap }: { keymap: Keymap<Renderable, KeyEvent> }) {
  const state = useAppState();
  const colors = getThemeColors(state.theme);
  const C = colors.ui;

  useKeyboard((e) => {
    const s = getStore().getState();
    if (s.fatalError) {
      const name = e.name?.toLowerCase() ?? "";
      if (name === "q" || (e.ctrl && name === "c")) {
        process.exit(0);
      } else if (name === "r") {
        restart();
      }
      return;
    }
    if (isCtrlC(e)) {
      handleCtrlC(getStore());
    }
  });

  if (state.fatalError) {
    return (
      <box
        style={{
          alignItems: "center",
          backgroundColor: C.bg,
          flexDirection: "column",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <text style={{ fg: C.red, marginBottom: 1 }}>Fatal Error</text>
        <text style={{ fg: C.fg }}>{state.fatalError}</text>
        <text style={{ fg: C.dim, marginTop: 2 }}>Press q to quit</text>
      </box>
    );
  }

  return (
    <ColorProvider colors={colors}>
      <KeymapProvider keymap={keymap}>
        <box
          style={{
            backgroundColor: C.bg,
            flexDirection: "column",
            height: "100%",
            width: "100%",
          }}
        >
          <TopBar />
          <box style={{ flexDirection: "row", flexGrow: 1 }}>
            {state.sidebarVisible ? <Sidebar /> : null}
            <DiffPane />
          </box>
          <BottomBar />
          <Overlays />
        </box>
      </KeymapProvider>
    </ColorProvider>
  );
}
