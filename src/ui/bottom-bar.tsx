import { useKeymap } from "@opentui/keymap/react";

import type { CommandId } from "../keymap/commands";
import { useAppState } from "../state/store";
import { useColors } from "./color-context";

type KeymapApi = ReturnType<typeof useKeymap>;

function commandKey(keymap: KeymapApi, cmd: CommandId): string {
  const entries = keymap.getCommandBindings({
    commands: [cmd],
    visibility: "registered",
  });
  const stroke = entries.get(cmd)?.[0]?.sequence[0]?.stroke;
  return stroke ? keymap.formatKey(stroke) : "";
}

function hint(keymap: KeymapApi, cmds: CommandId[], label: string): string {
  const keys = cmds
    .map((cmd) => commandKey(keymap, cmd))
    .filter((key) => key !== "")
    .join("/");
  return keys === "" ? "" : `${keys} ${label}`;
}

function joinHints(hints: string[]): string {
  return hints.filter((h) => h !== "").join(" · ");
}

function bottomBarContent(
  state: ReturnType<typeof useAppState>,
  C: ReturnType<typeof useColors>["ui"],
  keymap: KeymapApi,
): { color: string; content: string } {
  const help = hint(keymap, ["help"], "help");
  if (state.pendingStage) {
    const cancelKey = commandKey(keymap, "cancel") || "esc";
    return {
      color: C.yellow,
      content: `press stage key again to confirm (${state.pendingStage.commentCount} comment(s) will be cleared) — ${cancelKey} to cancel`,
    };
  }
  if (!state.stagingEnabled) {
    return {
      color: C.dim,
      content: `${joinHints([
        hint(keymap, ["next-hunk", "prev-hunk"], "hunk"),
        hint(keymap, ["next-file", "prev-file"], "file"),
        hint(keymap, ["add-comment"], "comment"),
        hint(keymap, ["send-comments"], "send"),
        help,
      ])} — staging disabled in this mode`,
    };
  }
  if (state.focus === "commits") {
    return {
      color: C.dim,
      content: joinHints([
        hint(keymap, ["collapse-section"], "expand/fold"),
        hint(keymap, ["next-file", "prev-file"], "file"),
        hint(keymap, ["toggle-view"], "view"),
        hint(keymap, ["add-comment"], "commit"),
        hint(keymap, ["git-pull"], "pull"),
        hint(keymap, ["git-push"], "push"),
        hint(keymap, ["git-edit"], "edit"),
        hint(keymap, ["commit-move-down", "commit-move-up"], "reorder"),
        help,
      ]),
    };
  }
  if (state.focus === "sidebar") {
    return {
      color: C.dim,
      content: joinHints([
        hint(keymap, ["collapse-section"], "collapse"),
        hint(keymap, ["stage-file"], "stage"),
        hint(keymap, ["stage-all"], "stage all"),
        hint(keymap, ["unstage-file"], "unstage/discard"),
        hint(keymap, ["unstage-all"], "discard all"),
        hint(keymap, ["toggle-sidebar"], "sidebar"),
        hint(keymap, ["toggle-view"], "view"),
        hint(keymap, ["sidebar-shrink", "sidebar-grow"], "resize"),
        hint(keymap, ["refresh"], "refresh"),
        hint(keymap, ["toggle-layout"], "layout"),
        hint(keymap, ["wrap-text"], "wrap"),
        help,
      ]),
    };
  }
  return {
    color: C.dim,
    content: joinHints([
      hint(keymap, ["next-hunk", "prev-hunk"], "hunk"),
      hint(keymap, ["visual-select"], "select"),
      hint(keymap, ["add-comment"], "comment"),
      hint(keymap, ["edit-comment", "delete-comment"], "edit/del"),
      hint(keymap, ["next-comment", "prev-comment"], "jump"),
      hint(keymap, ["copy"], "copy"),
      hint(keymap, ["send-comments"], "send"),
      hint(keymap, ["wrap-text"], state.wrapLines ? "unwrap" : "wrap"),
      help,
    ]),
  };
}

export function BottomBar() {
  const state = useAppState();
  const keymap = useKeymap();
  const { ui: C } = useColors();
  const { color, content } = bottomBarContent(state, C, keymap);

  return (
    <box
      style={{
        backgroundColor: C.panel,
        flexDirection: "row",
        height: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text style={{ fg: color, overflow: "hidden" }}>{content}</text>
      <text style={{ flexGrow: 1 }}> </text>
    </box>
  );
}
