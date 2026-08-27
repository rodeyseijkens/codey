import type { KeyEvent } from "@opentui/core";

import type { KeyChord } from "../../keymap/chords";
import type { CommandId } from "../../keymap/commands";
import {
  acceptDiffSearch,
  closeDiffSearch,
  diffSearchNext,
  diffSearchPrev,
  setDiffSearchQuery,
} from "../search-actions";
import { getStore } from "../store";

export function handleDiffSearchMode(
  e: KeyEvent,
  chord: KeyChord,
  _cmd: CommandId | null,
): void {
  const state = getStore().getState();
  const { diffSearch } = state;

  if (!diffSearch || state.focus !== "diff") {
    return;
  }

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
  }
}
