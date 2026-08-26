import type { KeyEvent } from "@opentui/core";

import { type KeyChord, keyEventToChord } from "../keymap/chords";
import type { CommandId } from "../keymap/commands";
import { lookupCommand, type ResolvedKeymap } from "../keymap/index";
import {
  cancelCommitDraft,
  cancelPendingStage,
  clearCommitDraft,
  closeOverlay,
  commitMove,
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
  refresh,
  resizeSidebar,
  SIDEBAR_RESIZE_STEP,
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
import {
  acceptDiffSearch,
  closeDiffSearch,
  diffSearchNext,
  diffSearchPrev,
  openDiffSearch,
  setDiffSearchQuery,
} from "./search-actions";
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

type CommandHandler = {
  guard?: (state: AppState) => boolean;
  run: (store: AppStore, state: AppState) => void;
};

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
  r.set("commit-move-up", {
    guard: (state) => state.focus === "commits",
    run: () => void commitMove(-1),
  });
  r.set("commit-move-down", {
    guard: (state) => state.focus === "commits",
    run: () => void commitMove(1),
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
  r.set("sidebar-shrink", { run: () => resizeSidebar(-SIDEBAR_RESIZE_STEP) });
  r.set("sidebar-grow", { run: () => resizeSidebar(SIDEBAR_RESIZE_STEP) });
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

  if (
    state.focus === "diff" &&
    !state.overlay &&
    !state.commentDraft &&
    !state.commitDraft &&
    !(chord.alt || chord.ctrl || chord.shift) &&
    chord.key === "/"
  ) {
    openDiffSearch();
    return;
  }

  const { diffSearch } = state;
  if (diffSearch && state.focus === "diff") {
    if (diffSearch.open) {
      const { name } = e;
      switch (name) {
        case "escape":
          closeDiffSearch();
          break;
        case "enter":
        case "return":
          void acceptDiffSearch();
          break;
        case "backspace":
          setDiffSearchQuery(diffSearch.query.slice(0, -1));
          break;
        case "space":
          setDiffSearchQuery(`${diffSearch.query} `);
          break;
        default:
          if (!(e.ctrl || e.meta) && name.length === 1) {
            setDiffSearchQuery(diffSearch.query + name);
          }
          break;
      }
      return;
    }
    if (chord.key === "escape") {
      closeDiffSearch();
      return;
    }
    if (chord.key === "n") {
      if (chord.shift) {
        diffSearchPrev();
      } else {
        diffSearchNext();
      }
      return;
    }
  }

  if (state.overlay) {
    const confirmKey =
      chord.key === "y" || chord.key === "return" || chord.key === "enter";
    const cancelKey = cmd === "cancel" || chord.key === "escape";

    switch (true) {
      case cancelKey:
        closeOverlay();
        break;
      case state.overlay.kind === "confirm-force-push" && confirmKey:
        confirmForcePush();
        break;
      case state.overlay.kind === "confirm-discard" && confirmKey:
        void confirmDiscard();
        break;
      case state.overlay.kind === "confirm-discard-all" && confirmKey:
        void confirmDiscardAll();
        break;
      case state.overlay.kind === "confirm-commit-all" && confirmKey:
        void confirmCommitAll();
        break;
      case state.overlay.kind === "reset-commits":
        switch (chord.key) {
          case "m":
            void confirmGitReset("mixed", state.overlay.hash);
            break;
          case "s":
            void confirmGitReset("soft", state.overlay.hash);
            break;
          case "h":
            void confirmGitReset("hard", state.overlay.hash);
            break;
          default:
            break;
        }
        break;
      case state.overlay.kind === "edit-commit":
        switch (chord.key) {
          case "s":
            void confirmGitEdit("squash", state.overlay.hash);
            break;
          case "f":
            void confirmGitEdit("fixup", state.overlay.hash);
            break;
          case "d":
            void confirmGitEdit("drop", state.overlay.hash);
            break;
          case "a":
            void confirmGitEdit("amend", state.overlay.hash);
            break;
          case "r":
            store.set({
              overlay: { hash: state.overlay.hash, kind: "reset-commits" },
            });
            break;
          default:
            break;
        }
        break;
      default:
        break;
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
