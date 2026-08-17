import { RGBA, type ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import type { ReactNode } from "react";
import { useRef } from "react";
import {
  COMMAND_DESCRIPTIONS,
  COMMAND_SECTIONS,
  type CommandId,
} from "../keymap/commands";
import { getStore, useAppState } from "../state/store";
import { useColors } from "./color-context";
import { useKeymap } from "./keymap-context";

function OverlayFrame(props: {
  title: string;
  titleEnd?: ReactNode;
  width?: number;
  height?: number;
  children?: ReactNode;
}) {
  const { ui: C } = useColors();
  return (
    <box
      style={{
        alignItems: "center",
        backgroundColor: RGBA.fromInts(0, 0, 0, 150),
        height: "100%",
        justifyContent: "center",
        position: "absolute",
        width: "100%",
      }}
    >
      <box
        style={{
          backgroundColor: C.panel,
          flexDirection: "column",
          gap: 1,
          height: props.height ?? 12,
          justifyContent: "space-between",
          padding: 1,
          width: props.width ?? 70,
        }}
      >
        <box
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          <text style={{ fg: C.accent }}>{props.title}</text>
          {props.titleEnd ?? null}
        </box>
        <box
          style={{
            flexDirection: "column",
            gap: 1,
            justifyContent: "space-between",
            paddingLeft: 1,
            paddingRight: 1,
          }}
        >
          {props.children}
        </box>
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
  const entries = [...keymap.byCommand.entries()].map(([cmd, chord]) => ({
    chord,
    cmd,
    desc: COMMAND_DESCRIPTIONS[cmd as CommandId] ?? "",
  }));
  const byCmd = new Map(entries.map((e) => [e.cmd, e]));
  const sections = COMMAND_SECTIONS.map((section) => ({
    entries: section.commands
      .map((cmd) => byCmd.get(cmd))
      .filter((e): e is NonNullable<typeof e> => e !== undefined),
    title: section.title,
  }));
  const leftover = entries.filter((e) => !byCmd.has(e.cmd));

  useKeyboard((e) => {
    if (store.getState().overlay?.kind !== "help") {
      return;
    }
    scrollHelp(scrollRef.current, e.name?.toLowerCase() ?? "");
  });

  return (
    <OverlayFrame
      height={26}
      title="Keybindings"
      titleEnd={<text style={{ fg: C.dim }}>esc</text>}
      width={78}
    >
      <scrollbox
        ref={(el: ScrollBoxRenderable) => {
          scrollRef.current = el;
        }}
        style={{ flexGrow: 1 }}
      >
        <box style={{ flexDirection: "column" }}>
          {sections.map((section, sectionIndex) => (
            <box key={section.title} style={{ flexDirection: "column" }}>
              {sectionIndex > 0 ? (
                <text style={{ fg: C.border }}>{"─".repeat(40)}</text>
              ) : null}
              <text style={{ fg: C.accent }}>{section.title}</text>
              {section.entries.map((e) => (
                <box key={e.cmd} style={{ flexDirection: "row", height: 1 }}>
                  <text style={{ fg: C.yellow, width: 16 }}>{e.chord}</text>
                  <text style={{ fg: C.dim }}>{e.desc}</text>
                </box>
              ))}
            </box>
          ))}
          {leftover.length > 0 ? (
            <box key="other" style={{ flexDirection: "column" }}>
              <text style={{ fg: C.accent }}>Other</text>
              {leftover.map((e) => (
                <box key={e.cmd} style={{ flexDirection: "row", height: 1 }}>
                  <text style={{ fg: C.yellow, width: 16 }}>{e.chord}</text>
                  <text style={{ fg: C.dim }}>{e.desc}</text>
                </box>
              ))}
            </box>
          ) : null}
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
      <text style={{ fg: C.accent }}>
        Press Esc to cancel, or Enter to confirm.
      </text>
    </OverlayFrame>
  );
}

function ConfirmDiscardAllOverlay() {
  const state = useAppState();
  const { ui: C } = useColors();
  const changes = state.changesets.find((cs) => cs.id === "changes");
  const count = changes?.files.length ?? 0;
  return (
    <OverlayFrame height={8} title="Discard all changes?" width={72}>
      <text style={{ fg: C.accent }}>
        All working-tree changes in {count} file(s) will be lost.
      </text>
      <text style={{ fg: C.dim }}>
        Press Esc to cancel, or Enter to confirm.
      </text>
    </OverlayFrame>
  );
}

function ConfirmForcePushOverlay() {
  const { ui: C } = useColors();
  return (
    <OverlayFrame height={8} title="Force push" width={72}>
      <text style={{ fg: C.accent }}>
        Your branch has diverged from the remote branch.
      </text>
      <text style={{ fg: C.dim }}>
        Press Esc to cancel, or Enter to confirm.
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
  if (overlay.kind === "confirm-discard-all") {
    return <ConfirmDiscardAllOverlay />;
  }
  if (overlay.kind === "confirm-force-push") {
    return <ConfirmForcePushOverlay />;
  }
  if (overlay.kind === "help") {
    return <HelpOverlay />;
  }
  return null;
}
