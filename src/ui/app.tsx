import { useKeyboard } from "@opentui/react";

import { keyEventToChord } from "../keymap/chords";
import { handleKeyEvent, restart } from "../state/dispatch";
import { getStore, useAppState } from "../state/store";
import { ColorProvider } from "./color-context";
import { getThemeColors } from "./colors";
import { DiffPane } from "./diff-pane";
import { KeymapContext } from "./keymap-context";
import { Overlays } from "./overlays";
import { Sidebar } from "./sidebar";
import { BottomBar, TopBar } from "./status-bar";

export function App() {
  const state = useAppState();
  const colors = getThemeColors(state.theme);
  const C = colors.ui;

  useKeyboard((e) => {
    const s = getStore().getState();
    if (s.fatalError) {
      const chord = keyEventToChord(e);
      if (chord?.key === "q" || (chord?.ctrl && chord.key === "c")) {
        process.exit(0);
      } else if (chord?.key === "r") {
        restart();
      }
      return;
    }
    handleKeyEvent(e, s.keymap);
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
      <KeymapContext.Provider value={state.keymap}>
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
      </KeymapContext.Provider>
    </ColorProvider>
  );
}
