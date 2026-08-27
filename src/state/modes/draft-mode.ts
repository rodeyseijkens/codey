import type { KeyEvent } from "@opentui/core";

import type { KeyChord } from "../../keymap/chords";
import type { CommandId } from "../../keymap/commands";
import { cancelCommitDraft } from "../actions/drafts";
import { cancelCommentDraft } from "../comment-actions";
import { getStore } from "../store";

export function handleDraftMode(
  _e: KeyEvent,
  chord: KeyChord,
  cmd: CommandId | null,
): void {
  const state = getStore().getState();

  if (state.commitDraft !== null) {
    if (cmd === "cancel" || chord.key === "escape") {
      cancelCommitDraft();
    }
    return;
  }

  if (state.commentDraft && (cmd === "cancel" || chord.key === "escape")) {
    cancelCommentDraft();
  }
}
