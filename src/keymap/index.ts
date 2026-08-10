import {
  type KeyChord,
  parseChordCaseSensitive,
  serializeChord,
} from "./chords";
import { ALL_COMMANDS, type CommandId, DEFAULT_KEYBINDINGS } from "./commands";

export interface KeymapValidationError {
  command: string;
  message: string;
}

export interface ResolvedKeymap {
  byChord: Map<string, CommandId>;
  byCommand: Map<CommandId, string>;
  chords: Map<string, KeyChord>;
}

export type ResolveResult =
  | { ok: true; keymap: ResolvedKeymap }
  | { ok: false; errors: KeymapValidationError[] };

const COMMAND_SET = new Set<string>(ALL_COMMANDS);

export function resolveKeymap(
  overrides: Record<string, string> = {}
): ResolveResult {
  const errors: KeymapValidationError[] = [];

  for (const command of Object.keys(overrides)) {
    if (!COMMAND_SET.has(command)) {
      errors.push({
        command,
        message: `unknown command "${command}" in [keybindings]`,
      });
    }
  }

  const merged: Record<string, string> = { ...DEFAULT_KEYBINDINGS };
  for (const [command, chord] of Object.entries(overrides)) {
    if (COMMAND_SET.has(command)) {
      merged[command] = chord;
    }
  }

  const byChord = new Map<string, CommandId>();
  const byCommand = new Map<CommandId, string>();
  const chords = new Map<string, KeyChord>();

  for (const [command, raw] of Object.entries(merged)) {
    const parsed = parseChordCaseSensitive(raw);
    if (!parsed.ok) {
      errors.push({
        command,
        message: `invalid keybinding "${raw}" for "${command}": ${parsed.error}`,
      });
      continue;
    }
    const serial = serializeChord(parsed.chord);
    const existing = byChord.get(serial);
    if (existing && existing !== command) {
      errors.push({
        command,
        message: `keybinding collision: "${raw}" is bound to both "${existing}" and "${command}"`,
      });
      continue;
    }
    byChord.set(serial, command as CommandId);
    byCommand.set(command as CommandId, serial);
    chords.set(serial, parsed.chord);
  }

  if (errors.length > 0) {
    return { errors, ok: false };
  }
  return { keymap: { byChord, byCommand, chords }, ok: true };
}

export function lookupCommand(
  keymap: ResolvedKeymap,
  chord: KeyChord
): CommandId | undefined {
  return keymap.byChord.get(serializeChord(chord));
}
