import type { ReactNode } from "react";
import { useRef } from "react";
import {
  RGBA,
  type ScrollBoxRenderable,
  type TextareaRenderable,
} from "@opentui/core";
import { useKeyboard } from "@opentui/react";

import {
  COMMAND_DESCRIPTIONS,
  COMMAND_SECTIONS,
  type CommandId,
} from "../keymap/commands";
import {
  confirmGitEdit,
  confirmGitReset,
  submitCommitDraft,
} from "../state/actions";
import { getStore, type OverlayKind, useAppState } from "../state/store";
import { useColors } from "./color-context";
import { EM_SPACE } from "./icons";
import { useKeymap } from "./keymap-context";
import { useDraftClear } from "./use-draft-clear";

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

const SHORT_HASH_LEN = 7;
const SCROLL_STEP = 10;

function scrollHelp(scroll: ScrollBoxRenderable | null, name: string): void {
  if (!scroll) {
    return;
  }
  if (name === "j" || name === "down") {
    scroll.scrollTop += 1;
  } else if (name === "k" || name === "up") {
    scroll.scrollTop = Math.max(0, scroll.scrollTop - 1);
  } else if (name === "pagedown") {
    scroll.scrollTop += SCROLL_STEP;
  } else if (name === "pageup") {
    scroll.scrollTop = Math.max(0, scroll.scrollTop - SCROLL_STEP);
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
    entries: section.commands.map((cmd) => {
      const e = byCmd.get(cmd);
      if (e) {
        return e;
      }
      return {
        chord: "",
        cmd,
        desc: COMMAND_DESCRIPTIONS[cmd as CommandId] ?? "",
      };
    }),
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
              {section.entries.map((entry) => (
                <box
                  key={entry.cmd}
                  style={{ flexDirection: "row", height: 1 }}
                >
                  <text
                    style={{
                      fg: entry.chord ? C.yellow : C.dim,
                      width: 16,
                    }}
                  >
                    {entry.chord || "—"}
                  </text>
                  <text style={{ fg: C.dim }}>{entry.desc}</text>
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
  overlay: OverlayKind<"confirm-discard">;
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

function ConfirmCommitAllOverlay() {
  const { ui: C } = useColors();
  return (
    <OverlayFrame height={8} title="No staged changes" width={72}>
      <text style={{ fg: C.accent }}>
        Commit all working-tree changes (stages everything)?
      </text>
      <text style={{ fg: C.dim }}>
        Press Esc to cancel, or Enter to confirm.
      </text>
    </OverlayFrame>
  );
}

function CommitInputOverlay() {
  const { ui: C } = useColors();
  const textareaRef = useRef<TextareaRenderable | null>(null);
  const contentWidth = 68;
  useDraftClear(textareaRef);
  return (
    <OverlayFrame
      height={5}
      title="Commit staged changes"
      titleEnd={<text style={{ fg: C.dim }}>esc</text>}
      width={72}
    >
      <textarea
        backgroundColor={C.panel}
        focused
        focusedBackgroundColor={C.panel}
        focusedTextColor={C.fg}
        height={1}
        initialValue={getStore().getState().commitDraft ?? ""}
        keyBindings={[{ action: "submit", name: "return" }]}
        onSubmit={async () => {
          const text = textareaRef.current?.plainText ?? "";
          await submitCommitDraft(text);
        }}
        placeholder="commit message — Enter to commit, esc to cancel"
        ref={textareaRef}
        textColor={C.fg}
        width={contentWidth}
      />
    </OverlayFrame>
  );
}

function GitResetOverlay(props: { overlay: OverlayKind<"reset-commits"> }) {
  const { ui: C } = useColors();
  const shortHash = props.overlay.hash.slice(0, SHORT_HASH_LEN);
  const store = getStore();
  return (
    <OverlayFrame
      height={10}
      title={`Reset to ${shortHash}`}
      titleEnd={<text style={{ fg: C.dim }}>esc</text>}
      width={50}
    >
      <text style={{ fg: C.dim }}>
        Choose reset mode, or press esc to cancel:
      </text>
      <box style={{ flexDirection: "column" }}>
        <box
          onMouseDown={async () => {
            store.set({ overlay: null });
            await confirmGitReset("mixed", props.overlay.hash);
          }}
          style={{ flexDirection: "row", gap: 1 }}
        >
          <text style={{ fg: C.yellow, width: 3 }}>m</text>
          <text style={{ fg: C.fg }}>Mixed</text>
          <text style={{ fg: C.dim }}>{EM_SPACE} keep working tree</text>
        </box>
        <box
          onMouseDown={async () => {
            store.set({ overlay: null });
            await confirmGitReset("soft", props.overlay.hash);
          }}
          style={{ flexDirection: "row", gap: 1 }}
        >
          <text style={{ fg: C.yellow, width: 3 }}>s</text>
          <text style={{ fg: C.fg }}>Soft</text>
          <text style={{ fg: C.dim }}>{EM_SPACE} keep staged + working</text>
        </box>
        <box
          onMouseDown={async () => {
            store.set({ overlay: null });
            await confirmGitReset("hard", props.overlay.hash);
          }}
          style={{ flexDirection: "row", gap: 1 }}
        >
          <text style={{ fg: C.yellow, width: 3 }}>h</text>
          <text style={{ fg: C.fg }}>Hard</text>
          <text style={{ fg: C.dim }}>{EM_SPACE} discard all changes</text>
        </box>
      </box>
    </OverlayFrame>
  );
}

function GitEditOverlay(props: { overlay: OverlayKind<"edit-commit"> }) {
  const { ui: C } = useColors();
  const shortHash = props.overlay.hash.slice(0, SHORT_HASH_LEN);
  const store = getStore();
  return (
    <OverlayFrame
      height={12}
      title={`Edit ${shortHash}`}
      titleEnd={<text style={{ fg: C.dim }}>esc</text>}
      width={50}
    >
      <text style={{ fg: C.dim }}>
        Choose action for {shortHash}, or press esc to cancel:
      </text>
      <box style={{ flexDirection: "column" }}>
        <box
          onMouseDown={async () => {
            store.set({ overlay: null });
            await confirmGitEdit("squash", props.overlay.hash);
          }}
          style={{ flexDirection: "row", gap: 1 }}
        >
          <text style={{ fg: C.yellow, width: 3 }}>s</text>
          <text style={{ fg: C.fg }}>Squash</text>
          <text style={{ fg: C.dim }}>{EM_SPACE} combine into parent</text>
        </box>
        <box
          onMouseDown={async () => {
            store.set({ overlay: null });
            await confirmGitEdit("fixup", props.overlay.hash);
          }}
          style={{ flexDirection: "row", gap: 1 }}
        >
          <text style={{ fg: C.yellow, width: 3 }}>f</text>
          <text style={{ fg: C.fg }}>Fixup</text>
          <text style={{ fg: C.dim }}>{EM_SPACE} combine, discard message</text>
        </box>
        <box
          onMouseDown={async () => {
            store.set({ overlay: null });
            await confirmGitEdit("drop", props.overlay.hash);
          }}
          style={{ flexDirection: "row", gap: 1 }}
        >
          <text style={{ fg: C.yellow, width: 3 }}>d</text>
          <text style={{ fg: C.fg }}>Drop</text>
          <text style={{ fg: C.dim }}>{EM_SPACE} remove this commit</text>
        </box>
        <box
          onMouseDown={async () => {
            store.set({ overlay: null });
            await confirmGitEdit("amend", props.overlay.hash);
          }}
          style={{ flexDirection: "row", gap: 1 }}
        >
          <text style={{ fg: C.yellow, width: 3 }}>a</text>
          <text style={{ fg: C.fg }}>Amend</text>
          <text style={{ fg: C.dim }}>{EM_SPACE} add staged changes</text>
        </box>
        <box
          onMouseDown={() => {
            store.set({
              overlay: { hash: props.overlay.hash, kind: "reset-commits" },
            });
          }}
          style={{ flexDirection: "row", gap: 1 }}
        >
          <text style={{ fg: C.yellow, width: 3 }}>r</text>
          <text style={{ fg: C.fg }}>Reset</text>
          <text style={{ fg: C.dim }}>{EM_SPACE} mixed/soft/hard reset</text>
        </box>
      </box>
    </OverlayFrame>
  );
}

export function Overlays() {
  const state = useAppState();
  const { overlay } = state;
  if (state.commitDraft !== null) {
    return <CommitInputOverlay />;
  }
  if (!overlay) {
    return null;
  }
  if (overlay.kind === "confirm-discard") {
    return <ConfirmDiscardOverlay overlay={overlay} />;
  }
  if (overlay.kind === "confirm-discard-all") {
    return <ConfirmDiscardAllOverlay />;
  }
  if (overlay.kind === "confirm-commit-all") {
    return <ConfirmCommitAllOverlay />;
  }
  if (overlay.kind === "confirm-force-push") {
    return <ConfirmForcePushOverlay />;
  }
  if (overlay.kind === "help") {
    return <HelpOverlay />;
  }
  if (overlay.kind === "reset-commits") {
    return <GitResetOverlay overlay={overlay} />;
  }
  if (overlay.kind === "edit-commit") {
    return <GitEditOverlay overlay={overlay} />;
  }
  return null;
}
