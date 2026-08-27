import type { CommandId } from "../keymap/commands";
import type { Overlay } from "./store";

export type ConfirmKind =
  | "confirm-force-push"
  | "confirm-discard"
  | "confirm-discard-all"
  | "confirm-commit-all";

export type OverlayAction =
  | { kind: ConfirmKind }
  | { kind: "dismiss" }
  | { kind: "git-reset"; mode: "mixed" | "soft" | "hard" }
  | { kind: "git-edit"; action: "squash" | "fixup" | "drop" | "amend" }
  | { kind: "switch-to-reset" };

const CONFIRM_OVERLAYS = new Set<string>([
  "confirm-force-push",
  "confirm-discard",
  "confirm-discard-all",
  "confirm-commit-all",
]);

function isConfirmKey(chordKey: string): boolean {
  return chordKey === "y" || chordKey === "return" || chordKey === "enter";
}

function isCancelKey(chordKey: string, cmd: CommandId | null): boolean {
  return cmd === "cancel" || chordKey === "escape";
}

function isConfirmKind(kind: string): kind is ConfirmKind {
  return CONFIRM_OVERLAYS.has(kind);
}

function resolveConfirmOverlay(
  chordKey: string,
  overlay: Overlay,
): ConfirmKind | null {
  if (isConfirmKey(chordKey) && isConfirmKind(overlay.kind)) {
    return overlay.kind;
  }
  return null;
}

function resetModeFromKey(chordKey: string): "mixed" | "soft" | "hard" | null {
  if (chordKey === "m") {
    return "mixed";
  }
  if (chordKey === "s") {
    return "soft";
  }
  if (chordKey === "h") {
    return "hard";
  }
  return null;
}

function editActionFromKey(
  chordKey: string,
): "squash" | "fixup" | "drop" | "amend" | null {
  if (chordKey === "s") {
    return "squash";
  }
  if (chordKey === "f") {
    return "fixup";
  }
  if (chordKey === "d") {
    return "drop";
  }
  if (chordKey === "a") {
    return "amend";
  }
  return null;
}

export function resolveOverlayKey(
  chordKey: string,
  cmd: CommandId | null,
  overlay: Overlay,
): OverlayAction | null {
  if (isCancelKey(chordKey, cmd)) {
    return { kind: "dismiss" };
  }

  if (CONFIRM_OVERLAYS.has(overlay.kind)) {
    const confirm = resolveConfirmOverlay(chordKey, overlay);
    if (confirm) {
      return { kind: confirm };
    }
    return null;
  }

  if (overlay.kind === "reset-commits") {
    const mode = resetModeFromKey(chordKey);
    if (mode) {
      return { kind: "git-reset", mode };
    }
    return null;
  }

  if (overlay.kind === "edit-commit") {
    const action = editActionFromKey(chordKey);
    if (action) {
      return { action, kind: "git-edit" };
    }
    if (chordKey === "r") {
      return { kind: "switch-to-reset" };
    }
    return null;
  }

  return null;
}
