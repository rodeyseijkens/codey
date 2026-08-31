import type { KeyEvent } from "@opentui/core";

import { keyEventToChord } from "../keymap/chords";
import { lookupCommand, type ResolvedKeymap } from "../keymap/index";
import { clearCommitDraft } from "./actions/drafts";
import {
  dispatchCommand,
  quit,
  restart,
  setQuitHandler,
  setRestartHandler,
} from "./command-registry";
import { clearCommentDraft } from "./comment-actions";
import { handleDiffSearchMode } from "./modes/diff-search-mode";
import { handleDraftMode } from "./modes/draft-mode";
import { handleNormalMode } from "./modes/normal-mode";
import { handleOverlayMode } from "./modes/overlay-mode";
import { handleStageMode } from "./modes/stage-mode";
import { openDiffSearch } from "./search-actions";
import { getStore } from "./store";

export { dispatchCommand, quit, restart, setQuitHandler, setRestartHandler };

export function handleKeyEvent(e: KeyEvent, keymap: ResolvedKeymap): void {
  const state = getStore().getState();
  const chord = keyEventToChord(e);
  if (!chord) {
    return;
  }
  const cmd = lookupCommand(keymap, chord) ?? null;

  // Ctrl+C: global escape hatch — clear drafts or quit
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

  // / key: open diff search when focused on diff and no overlay/draft
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

  // Route to per-mode handler
  if (state.diffSearch && state.focus === "diff") {
    handleDiffSearchMode(e, chord, cmd);
    return;
  }
  if (state.rewordDraft !== null) {
    handleDraftMode(e, chord, cmd);
    return;
  }
  if (state.overlay) {
    handleOverlayMode(e, chord, cmd);
    return;
  }
  if (state.commitDraft !== null || state.commentDraft) {
    handleDraftMode(e, chord, cmd);
    return;
  }
  if (state.pendingStage) {
    handleStageMode(cmd);
    return;
  }
  handleNormalMode(cmd, chord);
}
