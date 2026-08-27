import type { CommandId } from "../../keymap/commands";
import { cancelPendingStage, confirmPendingStage } from "../actions/staging";
import { getStore } from "../store";

const STAGE_COMMANDS: ReadonlySet<CommandId> = new Set([
  "stage-file",
  "stage-all",
  "unstage-file",
  "unstage-all",
]);

export function handleStageMode(cmd: CommandId | null): void {
  const state = getStore().getState();

  if (!state.pendingStage) {
    return;
  }

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
