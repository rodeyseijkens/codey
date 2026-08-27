import type { KeyEvent } from "@opentui/core";

import type { KeyChord } from "../../keymap/chords";
import type { CommandId } from "../../keymap/commands";
import {
  confirmCommitAll,
  confirmGitEdit,
  confirmGitReset,
} from "../actions/commits";
import { closeOverlay } from "../actions/drafts";
import { confirmForcePush } from "../actions/remote";
import { confirmDiscard, confirmDiscardAll } from "../actions/staging";
import { resolveOverlayKey } from "../overlay-controller";
import { getStore } from "../store";

export function handleOverlayMode(
  _e: KeyEvent,
  chord: KeyChord,
  cmd: CommandId | null,
): void {
  const store = getStore();
  const state = store.getState();

  if (!state.overlay) {
    return;
  }

  const action = resolveOverlayKey(chord.key, cmd, state.overlay);

  if (!action) {
    return;
  }

  const { overlay } = state;
  switch (action.kind) {
    case "dismiss":
      closeOverlay();
      break;
    case "confirm-force-push":
      confirmForcePush();
      break;
    case "confirm-discard":
      void confirmDiscard();
      break;
    case "confirm-discard-all":
      void confirmDiscardAll();
      break;
    case "confirm-commit-all":
      void confirmCommitAll();
      break;
    case "git-reset":
      if (overlay.kind === "reset-commits") {
        void confirmGitReset(action.mode, overlay.hash);
      }
      break;
    case "git-edit":
      if (overlay.kind === "edit-commit") {
        void confirmGitEdit(action.action, overlay.hash);
      }
      break;
    case "switch-to-reset":
      if (overlay.kind === "edit-commit") {
        store.set({ overlay: { hash: overlay.hash, kind: "reset-commits" } });
      }
      break;
  }
}
