import type { KeyEvent, Renderable } from "@opentui/core";
import type { Keymap } from "@opentui/keymap";

import { ALL_COMMANDS } from "./commands";

const COMMAND_SET = new Set<string>(ALL_COMMANDS);

export type ValidationError = {
  command: string;
  message: string;
};

export type ValidationResult =
  | { ok: true; errors: undefined }
  | { ok: false; errors: ValidationError[] };

export function validateKeybindings(
  keymap: Keymap<Renderable, KeyEvent>,
  overrides: Record<string, string>,
): ValidationResult {
  const errors: ValidationError[] = [];

  for (const command of Object.keys(overrides)) {
    if (!COMMAND_SET.has(command)) {
      errors.push({
        command,
        message: `unknown command "${command}" in [keybindings]`,
      });
    }
  }

  for (const [command, raw] of Object.entries(overrides)) {
    if (!COMMAND_SET.has(command)) {
      continue;
    }
    try {
      const parsed = keymap.parseKeySequence(raw);
      if (parsed.length !== 1) {
        errors.push({
          command,
          message: `keybinding "${raw}" for "${command}" must be exactly one stroke, got ${parsed.length}`,
        });
      }
    } catch {
      errors.push({
        command,
        message: `invalid keybinding "${raw}" for "${command}"`,
      });
    }
  }

  if (errors.length > 0) {
    return { errors, ok: false };
  }
  return { errors: undefined, ok: true };
}
