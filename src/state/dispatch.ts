import type { KeyEvent } from "@opentui/core";
import { type KeyChord, keyEventToChord } from "../keymap/chords";
import type { CommandId } from "../keymap/commands";
import { lookupCommand, type ResolvedKeymap } from "../keymap/index";
import {
  cancelCommitDraft,
  cancelPendingStage,
  clearCommitDraft,
  closeOverlay,
  commitSelectNext,
  commitSelectNextFile,
  commitSelectPrev,
  commitSelectPrevFile,
  commitToggleCursorRow,
  confirmCommitAll,
  confirmDiscard,
  confirmDiscardAll,
  confirmForcePush,
  confirmGitEdit,
  confirmGitReset,
  confirmPendingStage,
  copySelection,
  cycleLayout,
  focusCommits,
  focusDiff,
  focusPrev,
  focusSidebar,
  gitPull,
  gitPush,
  openCommitDraft,
  openHelp,
  refresh,
  resizeSidebar,
  selectNext,
  selectPrev,
  sendComments,
  stageAll,
  stageSelected,
  toggleFocus,
  toggleSelectedRow,
  toggleSidebar,
  toggleSidebarView,
  unstageAll,
  unstageSelected,
} from "./actions";
import {
  cancelCommentDraft,
  clearCommentDraft,
  deleteCommentAtCursor,
  jumpToComment,
  openAddCommentDraft,
  openEditCommentDraft,
  visualSelect,
} from "./comment-actions";
import { type AppState, type AppStore, getStore } from "./store";

let quitHandler: (() => void) | null = null;
let restartHandler: (() => void) | null = null;

export function setQuitHandler(fn: () => void): void {
  quitHandler = fn;
}

export function setRestartHandler(fn: () => void): void {
  restartHandler = fn;
}

export function restart(): void {
  restartHandler?.();
}

export function quit(): void {
  if (quitHandler) {
    quitHandler();
  } else {
    process.exit(0);
  }
}

const STAGE_COMMANDS: ReadonlySet<CommandId> = new Set([
  "stage-file",
  "stage-all",
  "unstage-file",
  "unstage-all",
]);

/** True when the diff pane is showing a commit-file diff (not a working-tree file). */
function commitFileShown(state: AppState): boolean {
  return state.commitView !== null && state.selection === null;
}

interface CommandHandler {
  guard?: (state: AppState) => boolean;
  run: (store: AppStore, state: AppState) => void;
}

function buildRegistry(): Map<CommandId, CommandHandler> {
  const r = new Map<CommandId, CommandHandler>();

  r.set("quit", { run: () => quit() });
  r.set("help", {
    run: (store) =>
      store.set({ commentDraft: null, overlay: { kind: "help" } }),
  });
  r.set("cancel", {
    run: (store, state) => {
      if (state.pendingStage) {
        cancelPendingStage();
        return;
      }
      if (state.overlay) {
        closeOverlay();
        return;
      }
      if (state.anchorRow !== null) {
        store.set({ anchorRow: null });
      }
      if (state.commitView) {
        store.set({ commitView: null });
      }
    },
  });
  r.set("select-prev", {
    run: (_, state) => {
      if (state.focus === "sidebar") {
        selectPrev();
      } else if (state.focus === "commits") {
        void commitSelectPrev();
      }
    },
  });
  r.set("select-next", {
    run: (_, state) => {
      if (state.focus === "sidebar") {
        selectNext();
      } else if (state.focus === "commits") {
        void commitSelectNext();
      }
    },
  });
  r.set("prev-file", {
    run: (_, state) => {
      if (state.focus === "diff") {
        selectPrev();
      } else if (state.focus === "commits") {
        void commitSelectPrevFile();
      }
    },
  });
  r.set("next-file", {
    run: (_, state) => {
      if (state.focus === "diff") {
        selectNext();
      } else if (state.focus === "commits") {
        void commitSelectNextFile();
      }
    },
  });
  r.set("focus-toggle", { run: () => toggleFocus() });
  r.set("focus-prev", { run: () => focusPrev() });
  r.set("focus-sidebar", { run: () => focusSidebar() });
  r.set("focus-diff", { run: () => focusDiff() });
  r.set("focus-commits", { run: () => focusCommits() });
  r.set("git-pull", {
    guard: (state) => state.focus === "commits" && state.remoteBusy === null,
    run: () => gitPull(),
  });
  r.set("git-push", {
    guard: (state) => state.focus === "commits" && state.remoteBusy === null,
    run: () => gitPush(),
  });
  r.set("git-reset", {
    guard: (state) => state.focus === "commits",
    run: (store) => {
      const cursorRow = store.commitCursorRow();
      if (
        cursorRow &&
        (cursorRow.kind === "header" || cursorRow.kind === "file")
      ) {
        store.set({
          overlay: { hash: cursorRow.hash, kind: "reset-commits" },
        });
      }
    },
  });
  r.set("git-edit", {
    guard: (state) => state.focus === "commits",
    run: (store) => {
      const cursorRow = store.commitCursorRow();
      if (
        cursorRow &&
        (cursorRow.kind === "header" || cursorRow.kind === "file")
      ) {
        store.set({
          overlay: { hash: cursorRow.hash, kind: "edit-commit" },
        });
      }
    },
  });
  r.set("toggle-sidebar", { run: () => toggleSidebar() });
  r.set("collapse-section", {
    run: (_, state) => {
      if (state.focus === "sidebar") {
        toggleSelectedRow();
      } else if (state.focus === "commits") {
        void commitToggleCursorRow();
      }
    },
  });
  r.set("sidebar-shrink", { run: () => resizeSidebar(-4) });
  r.set("sidebar-grow", { run: () => resizeSidebar(4) });
  r.set("visual-select", {
    guard: (state) => !commitFileShown(state),
    run: () => visualSelect(),
  });
  r.set("add-comment", {
    run: (_, state) => {
      if (state.focus === "commits") {
        openCommitDraft();
        return;
      }
      if (commitFileShown(state)) {
        return;
      }
      openAddCommentDraft();
    },
  });
  r.set("edit-comment", {
    guard: (state) => !commitFileShown(state),
    run: () => openEditCommentDraft(),
  });
  r.set("delete-comment", {
    guard: (state) => !commitFileShown(state),
    run: () => deleteCommentAtCursor(),
  });
  r.set("next-comment", {
    guard: (state) => !commitFileShown(state),
    run: () => jumpToComment(1),
  });
  r.set("prev-comment", {
    guard: (state) => !commitFileShown(state),
    run: () => jumpToComment(-1),
  });
  r.set("send-comments", { run: () => void sendComments() });
  r.set("copy", { run: () => void copySelection() });
  r.set("stage-file", {
    guard: (state) => !commitFileShown(state),
    run: () => void stageSelected(),
  });
  r.set("stage-all", {
    guard: (state) => !commitFileShown(state),
    run: () => void stageAll(),
  });
  r.set("unstage-file", {
    guard: (state) => !commitFileShown(state),
    run: () => void unstageSelected(),
  });
  r.set("unstage-all", {
    guard: (state) => !commitFileShown(state),
    run: () => void unstageAll(),
  });
  r.set("refresh", { run: () => void refresh() });
  r.set("toggle-layout", { run: () => cycleLayout() });
  r.set("toggle-view", { run: () => toggleSidebarView() });
  r.set("wrap-text", {
    run: (store, state) => store.set({ wrapLines: !state.wrapLines }),
  });
  // prev-hunk and next-hunk are handled in the diff pane directly, not here.

  return r;
}

const COMMAND_REGISTRY = buildRegistry();

export function dispatchCommand(cmd: CommandId): void {
  const store = getStore();
  const handler = COMMAND_REGISTRY.get(cmd);
  if (!handler) {
    return;
  }
  const state = store.getState();
  if (handler.guard && !handler.guard(state)) {
    return;
  }
  handler.run(store, state);
}

export function openHelpOverlay(): void {
  openHelp();
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: its allowed for now
export function handleKeyEvent(e: KeyEvent, keymap: ResolvedKeymap): void {
  const store = getStore();
  const state = store.getState();
  const chord: KeyChord | null = keyEventToChord(e);
  if (!chord) {
    return;
  }
  const cmd = lookupCommand(keymap, chord);

  if (chord.ctrl && !chord.alt && !chord.shift && chord.key === "c") {
    if (state.commitDraft !== null) {
      clearCommitDraft();
    } else if (state.commentDraft) {
      clearCommentDraft();
    } else {
      quit();
    }
    return;
  }

  if (state.overlay) {
    if (cmd === "cancel" || chord.key === "escape") {
      closeOverlay();
    } else if (
      state.overlay.kind === "confirm-force-push" &&
      (chord.key === "y" || chord.key === "return" || chord.key === "enter")
    ) {
      confirmForcePush();
    } else if (
      state.overlay.kind === "confirm-discard" &&
      (chord.key === "y" || chord.key === "return" || chord.key === "enter")
    ) {
      void confirmDiscard();
    } else if (
      state.overlay.kind === "confirm-discard-all" &&
      (chord.key === "y" || chord.key === "return" || chord.key === "enter")
    ) {
      void confirmDiscardAll();
    } else if (
      state.overlay.kind === "confirm-commit-all" &&
      (chord.key === "y" || chord.key === "return" || chord.key === "enter")
    ) {
      void confirmCommitAll();
    } else if (state.overlay.kind === "reset-commits") {
      if (chord.key === "m") {
        void confirmGitReset("mixed", state.overlay.hash);
      } else if (chord.key === "s") {
        void confirmGitReset("soft", state.overlay.hash);
      } else if (chord.key === "h") {
        void confirmGitReset("hard", state.overlay.hash);
      }
    } else if (state.overlay.kind === "edit-commit") {
      if (chord.key === "s") {
        void confirmGitEdit("squash", state.overlay.hash);
      } else if (chord.key === "f") {
        void confirmGitEdit("fixup", state.overlay.hash);
      } else if (chord.key === "d") {
        void confirmGitEdit("drop", state.overlay.hash);
      } else if (chord.key === "a") {
        void confirmGitEdit("amend", state.overlay.hash);
      }
    }
    return;
  }

  if (state.commitDraft !== null) {
    if (cmd === "cancel" || chord.key === "escape") {
      cancelCommitDraft();
    }
    return;
  }

  if (state.commentDraft) {
    if (cmd === "cancel" || chord.key === "escape") {
      cancelCommentDraft();
    }
    return;
  }

  if (state.pendingStage) {
    if (cmd === "cancel") {
      cancelPendingStage();
      return;
    }
    if (cmd && STAGE_COMMANDS.has(cmd)) {
      void confirmPendingStage();
      return;
    }
    cancelPendingStage();
  }

  if (
    chord.key === "e" &&
    !chord.ctrl &&
    !chord.alt &&
    !chord.shift &&
    state.focus === "commits"
  ) {
    dispatchCommand("git-edit");
    return;
  }

  if (cmd) {
    dispatchCommand(cmd);
    return;
  }

  if (chord.key === "up") {
    dispatchCommand("select-prev");
  } else if (chord.key === "down") {
    dispatchCommand("select-next");
  }
}
