import type { KeyEvent } from "@opentui/core";
import { type KeyChord, keyEventToChord } from "../keymap/chords";
import type { CommandId } from "../keymap/commands";
import { lookupCommand, type ResolvedKeymap } from "../keymap/index";
import {
  cancelPendingStage,
  closeOverlay,
  confirmDiscard,
  confirmPendingStage,
  copySelection,
  cycleLayout,
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
import { getStore } from "./store";

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
      }
      return;
    case "select-next":
      if (state.focus === "sidebar") {
        selectNext();
      }
      return;
    case "prev-file":
      selectPrev();
      return;
    case "next-file":
      selectNext();
      return;
    case "focus-toggle":
      toggleFocus();
      return;
    case "toggle-sidebar":
      toggleSidebar();
      return;
    case "collapse-section":
      toggleSelectedRow();
      return;
    case "sidebar-shrink":
      resizeSidebar(-4);
      return;
    case "sidebar-grow":
      resizeSidebar(4);
      return;
    case "visual-select":
      visualSelect();
      return;
    case "add-comment":
      openAddCommentDraft();
      return;
    case "edit-comment":
      openEditCommentDraft();
      return;
    case "delete-comment":
      deleteCommentAtCursor();
      return;
    case "next-comment":
      jumpToComment(1);
      return;
    case "prev-comment":
      jumpToComment(-1);
      return;
    case "send-comments":
      void sendComments();
      return;
    case "copy":
      void copySelection();
      return;
    case "stage-file":
      void stageSelected();
      return;
    case "stage-all":
      void stageAll();
      return;
    case "unstage-file":
      void unstageSelected();
      return;
    case "unstage-all":
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
