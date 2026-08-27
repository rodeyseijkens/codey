import type { KeyChord } from "../../keymap/chords";
import type { CommandId } from "../../keymap/commands";
import { dispatchCommand } from "../command-registry";

export function handleNormalMode(cmd: CommandId | null, chord: KeyChord): void {
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
