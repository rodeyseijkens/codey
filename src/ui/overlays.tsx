import type { ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import type { ReactNode } from "react";
import { useRef } from "react";
import { COMMAND_DESCRIPTIONS, type CommandId } from "../keymap/commands";
import { getStore, useAppState } from "../state/store";
import { useColors } from "./color-context";
import { useKeymap } from "./keymap-context";

function OverlayFrame(props: {
  title: string;
  width?: number;
  height?: number;
  children?: ReactNode;
}) {
  const { ui: C } = useColors();
  return (
    <box
      style={{
        alignItems: "center",
        height: "100%",
        justifyContent: "center",
        position: "absolute",
        width: "100%",
      }}
    >
      <box
        style={{
          backgroundColor: C.panel,
          border: true,
          borderColor: C.accent,
          borderStyle: "rounded",
          flexDirection: "column",
          height: props.height ?? 12,
          padding: 1,
          width: props.width ?? 70,
        }}
      >
        <text style={{ fg: C.accent, marginBottom: 1 }}>{props.title}</text>
        {props.children}
      </box>
    </box>
  );
}

function scrollHelp(scroll: ScrollBoxRenderable | null, name: string): void {
  if (!scroll) {
    return;
  }
  if (name === "j" || name === "down") {
    scroll.scrollTop += 1;
  } else if (name === "k" || name === "up") {
    scroll.scrollTop = Math.max(0, scroll.scrollTop - 1);
  } else if (name === "pagedown") {
    scroll.scrollTop += 10;
  } else if (name === "pageup") {
    scroll.scrollTop = Math.max(0, scroll.scrollTop - 10);
  }
}

function HelpOverlay() {
  const keymap = useKeymap();
  const store = getStore();
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const { ui: C } = useColors();
  const entries = [...keymap.byCommand.entries()]
    .map(([cmd, chord]) => ({
      chord,
      cmd,
      desc: COMMAND_DESCRIPTIONS[cmd as CommandId] ?? "",
    }))
    .sort((a, b) => a.cmd.localeCompare(b.cmd));

  useKeyboard((e) => {
    if (store.getState().overlay?.kind !== "help") {
      return;
    }
    scrollHelp(scrollRef.current, e.name?.toLowerCase() ?? "");
  });

  return (
    <OverlayFrame
      height={26}
      title="codey — keybindings (? to close)"
      width={78}
    >
      <scrollbox
        ref={(el: ScrollBoxRenderable) => {
          scrollRef.current = el;
        }}
        style={{ flexGrow: 1 }}
      >
        <box style={{ flexDirection: "column" }}>
          {entries.map((e) => (
            <box key={e.cmd} style={{ flexDirection: "row", height: 1 }}>
              <text style={{ fg: C.yellow, width: 16 }}>{e.chord}</text>
              <text style={{ fg: C.dim }}>{e.desc}</text>
            </box>
          ))}
        </box>
      </scrollbox>
    </OverlayFrame>
  );
}

function ConfirmDiscardOverlay(props: {
  overlay: Extract<
    import("../state/store.js").Overlay,
    { kind: "confirm-discard" }
  >;
}) {
  const { overlay } = props;
  const { ui: C } = useColors();
  const label = overlay.bulk
    ? `Discard changes in ${overlay.paths.length} file(s)?`
    : `Discard changes to ${overlay.paths[0] ?? ""}?`;
  return (
    <OverlayFrame height={7} title={label} width={70}>
      <text style={{ fg: C.accent, marginTop: 1 }}>
        This cannot be undone. y to confirm, Esc to cancel.
      </text>
    </OverlayFrame>
  );
}

export function Overlays() {
  const state = useAppState();
  const { overlay } = state;
  if (!overlay) {
    return null;
  }
  if (overlay.kind === "confirm-discard") {
    return <ConfirmDiscardOverlay overlay={overlay} />;
  }
  if (overlay.kind === "help") {
    return <HelpOverlay />;
  }
  return null;
}
