import type { KeyEvent } from "@opentui/core";
import { type KeyChord, keyEventToChord } from "../keymap/chords";
import type { CommandId } from "../keymap/commands";
import { lookupCommand, type ResolvedKeymap } from "../keymap/index";
import {
  cancelPendingStage,
  closeOverlay,
  commitSelectNext,
  commitSelectNextFile,
  commitSelectPrev,
  commitSelectPrevFile,
  commitToggleCursorRow,
  confirmDiscard,
  confirmPendingStage,
  copySelection,
  cycleLayout,
  focusCommits,
  focusDiff,
  focusPrev,
  focusSidebar,
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
  deleteCommentAtCursor,
  jumpToComment,
  openAddCommentDraft,
  openEditCommentDraft,
  visualSelect,
} from "./comment-actions";
import { type AppState, getStore } from "./store";

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

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: its allowed for now
export function dispatchCommand(cmd: CommandId): void {
  const store = getStore();
  const state = store.getState();

  switch (cmd) {
    case "quit":
      quit();
      return;
    case "help":
      store.set({ commentDraft: null, overlay: { kind: "help" } });
      return;
    case "cancel":
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
      return;
    case "select-prev":
      if (state.focus === "sidebar") {
        selectPrev();
      } else if (state.focus === "commits") {
        void commitSelectPrev();
      }
      return;
    case "select-next":
      if (state.focus === "sidebar") {
        selectNext();
      } else if (state.focus === "commits") {
        void commitSelectNext();
      }
      return;
    case "prev-file":
      if (state.focus === "diff") {
        selectPrev();
      } else if (state.focus === "commits") {
        void commitSelectPrevFile();
      }
      return;
    case "next-file":
      if (state.focus === "diff") {
        selectNext();
      } else if (state.focus === "commits") {
        void commitSelectNextFile();
      }
      return;
    case "focus-toggle":
      toggleFocus();
      return;
    case "focus-prev":
      focusPrev();
      return;
    case "focus-sidebar":
      focusSidebar();
      return;
    case "focus-diff":
      focusDiff();
      return;
    case "focus-commits":
      focusCommits();
      return;
    case "toggle-sidebar":
      toggleSidebar();
      return;
    case "collapse-section":
      if (state.focus === "sidebar") {
        toggleSelectedRow();
      } else if (state.focus === "commits") {
        void commitToggleCursorRow();
      }
      return;
    case "sidebar-shrink":
      resizeSidebar(-4);
      return;
    case "sidebar-grow":
      resizeSidebar(4);
      return;
    case "visual-select":
      if (commitFileShown(state)) {
        return;
      }
      visualSelect();
      return;
    case "add-comment":
      if (commitFileShown(state)) {
        return;
      }
      openAddCommentDraft();
      return;
    case "edit-comment":
      if (commitFileShown(state)) {
        return;
      }
      openEditCommentDraft();
      return;
    case "delete-comment":
      if (commitFileShown(state)) {
        return;
      }
      deleteCommentAtCursor();
      return;
    case "next-comment":
      if (commitFileShown(state)) {
        return;
      }
      jumpToComment(1);
      return;
    case "prev-comment":
      if (commitFileShown(state)) {
        return;
      }
      jumpToComment(-1);
      return;
    case "send-comments":
      void sendComments();
      return;
    case "copy":
      void copySelection();
      return;
    case "stage-file":
      if (commitFileShown(state)) {
        return;
      }
      void stageSelected();
      return;
    case "stage-all":
      if (commitFileShown(state)) {
        return;
      }
      void stageAll();
      return;
    case "unstage-file":
      if (commitFileShown(state)) {
        return;
      }
      void unstageSelected();
      return;
    case "unstage-all":
      if (commitFileShown(state)) {
        return;
      }
      void unstageAll();
      return;
    case "refresh":
      void refresh();
      return;
    case "toggle-layout":
      cycleLayout();
      return;
    case "toggle-view":
      toggleSidebarView();
      return;
    case "wrap-text":
      store.set({ wrapLines: !state.wrapLines });
      return;
    case "prev-hunk":
    case "next-hunk":
      return;
    default:
      return;
  }
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

  if (state.overlay) {
    if (cmd === "cancel" || chord.key === "escape") {
      closeOverlay();
    } else if (
      state.overlay.kind === "confirm-discard" &&
      (chord.key === "y" || chord.key === "return" || chord.key === "enter")
    ) {
      void confirmDiscard();
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
