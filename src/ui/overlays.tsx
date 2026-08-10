import type { InputRenderable, ScrollBoxRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { COMMAND_DESCRIPTIONS, type CommandId } from "../keymap/commands";
import { saveCommentFromOverlay } from "../state/comment-actions";
import { dispatchCommand } from "../state/dispatch";
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

function CommentInputOverlay(props: {
  overlay: Extract<import("../state/store.js").Overlay, { kind: "comment" }>;
}) {
  const { overlay } = props;
  const store = getStore();
  const inputRef = useRef<InputRenderable | null>(null);
  const { ui: C } = useColors();

  useEffect(() => {
    if (overlay.mode === "edit" && overlay.commentId) {
      const comment = store
        .getState()
        .comments.find((c) => c.id === overlay.commentId);
      if (comment && inputRef.current) {
        inputRef.current.value = comment.text;
      }
    }
  }, [overlay, store]);

  const range =
    overlay.startRow === overlay.endRow
      ? `row ${overlay.startRow}`
      : `rows ${overlay.startRow}-${overlay.endRow}`;

  return (
    <OverlayFrame
      height={8}
      title={`${overlay.mode === "edit" ? "Edit" : "Add"} comment — ${overlay.path} (${range})`}
    >
      <text style={{ fg: C.faint, marginBottom: 1, overflow: "hidden" }}>
        {overlay.context.split("\n")[0] ?? ""}
      </text>
      <input
        focused
        onSubmit={() => {
          saveCommentFromOverlay(inputRef.current?.value ?? "");
        }}
        placeholder="type comment, Enter to save, Esc to cancel"
        ref={(el: InputRenderable) => {
          inputRef.current = el;
        }}
        style={{ flexGrow: 1 }}
      />
    </OverlayFrame>
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

function CommentListOverlay(props: { scope: string; path: string }) {
  const store = getStore();
  const { ui: C } = useColors();
  const comments = store.commentsFor(
    props.scope as "staged" | "changes" | "single",
    props.path
  );
  return (
    <OverlayFrame
      height={Math.min(4 + comments.length * 2, 24)}
      title={`Comments — ${props.path} (${comments.length})`}
      width={78}
    >
      {comments.length === 0 ? (
        <text style={{ fg: C.faint }}>no comments yet (c to add)</text>
      ) : (
        <scrollbox style={{ flexGrow: 1 }}>
          <box style={{ flexDirection: "column" }}>
            {comments.map((c) => (
              <box key={c.id} style={{ flexDirection: "column" }}>
                <text style={{ fg: C.commentFg }}>
                  rows {c.startRow}-{c.endRow}: {c.text}
                </text>
                <text style={{ fg: C.faint, overflow: "hidden" }}>
                  {c.context.split("\n")[0] ?? ""}
                </text>
              </box>
            ))}
          </box>
        </scrollbox>
      )}
    </OverlayFrame>
  );
}

function PaletteOverlay() {
  const keymap = useKeymap();
  const store = getStore();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const { ui: C } = useColors();

  const all = [...keymap.byCommand.entries()]
    .map(([cmd, chord]) => ({
      chord,
      cmd: cmd as CommandId,
      desc: COMMAND_DESCRIPTIONS[cmd as CommandId] ?? "",
    }))
    .filter(
      (e) =>
        query === "" ||
        e.cmd.includes(query.toLowerCase()) ||
        e.desc.toLowerCase().includes(query.toLowerCase())
    );

  const run = (cmd: CommandId) => {
    store.set({ overlay: null });
    dispatchCommand(cmd);
  };

  useKeyboard((e) => {
    const s = store.getState();
    if (s.overlay?.kind !== "palette") {
      return;
    }
    if (e.name === "up") {
      setIndex((i) => Math.max(0, i - 1));
    } else if (e.name === "down") {
      setIndex((i) => Math.min(all.length - 1, i + 1));
    } else if (e.name === "return" || e.name === "enter") {
      const item = all[index];
      if (item) {
        run(item.cmd);
      }
    }
  });

  return (
    <OverlayFrame height={18} title="Command palette" width={70}>
      <input
        focused
        onInput={(value: string) => {
          setQuery(value);
          setIndex(0);
        }}
        placeholder="type to filter, arrows + Enter to run, Esc to close"
      />
      <scrollbox style={{ flexGrow: 1, marginTop: 1 }}>
        <box style={{ flexDirection: "column" }}>
          {all.map((e, i) => (
            <box
              key={e.cmd}
              style={{
                backgroundColor: i === index ? C.selection : undefined,
                flexDirection: "row",
                height: 1,
                paddingLeft: 1,
              }}
            >
              <text style={{ fg: C.yellow, width: 14 }}>{e.chord}</text>
              <text style={{ fg: i === index ? C.fg : C.dim }}>{e.desc}</text>
            </box>
          ))}
        </box>
      </scrollbox>
    </OverlayFrame>
  );
}

export function Overlays() {
  const state = useAppState();
  const { overlay } = state;
  if (!overlay) {
    return null;
  }
  if (overlay.kind === "comment") {
    return <CommentInputOverlay overlay={overlay} />;
  }
  if (overlay.kind === "confirm-discard") {
    return <ConfirmDiscardOverlay overlay={overlay} />;
  }
  if (overlay.kind === "help") {
    return <HelpOverlay />;
  }
  if (overlay.kind === "comments") {
    return <CommentListOverlay path={overlay.path} scope={overlay.scope} />;
  }
  return <PaletteOverlay />;
}
