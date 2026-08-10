import type { KeyEvent } from "@opentui/core";

export interface KeyChord {
  alt: boolean;
  ctrl: boolean;
  key: string;
  shift: boolean;
}

export type ChordParseResult =
  | { ok: true; chord: KeyChord }
  | { ok: false; error: string };

const PUNCT_KEYS = new Set([
  "[",
  "]",
  "/",
  "\\",
  ";",
  "'",
  ",",
  ".",
  "=",
  "-",
  "`",
  "<",
  ">",
  "!",
  "?",
  "~",
  "#",
  "$",
  "%",
  "&",
  "*",
  "(",
  ")",
  "_",
  "{",
  "}",
  "|",
  ":",
  "^",
  '"',
]);

const KNOWN_KEYS = new Set([
  "escape",
  "tab",
  "enter",
  "return",
  "backspace",
  "delete",
  "up",
  "down",
  "left",
  "right",
  "home",
  "end",
  "pageup",
  "pagedown",
  "space",
]);

interface ModifierParse {
  alt: boolean;
  ctrl: boolean;
  key: string | null;
  shift: boolean;
}

function parseModifiers(
  parts: string[],
  input: string
): ModifierParse | { error: string } {
  let ctrl = false;
  let alt = false;
  let shift = false;
  let key: string | null = null;

  for (const part of parts) {
    if (part === "") {
      return { error: `invalid chord "${input}"` };
    }
    if (part === "ctrl" || part === "control") {
      ctrl = true;
      continue;
    }
    if (part === "alt" || part === "meta" || part === "option") {
      alt = true;
      continue;
    }
    if (part === "shift") {
      shift = true;
      continue;
    }
    if (key !== null) {
      return { error: `chord "${input}" has more than one key` };
    }
    key = part;
  }
  return { alt, ctrl, key, shift };
}

function isValidSingleChar(ch: string): boolean {
  return (
    (ch >= "a" && ch <= "z") || (ch >= "0" && ch <= "9") || PUNCT_KEYS.has(ch)
  );
}

export function parseChord(input: string): ChordParseResult {
  const raw = input.trim().toLowerCase();
  if (raw === "") {
    return { error: "empty keybinding", ok: false };
  }
  const parts = raw.split("+").map((p) => p.trim());
  const mods = parseModifiers(parts, input);
  if ("error" in mods) {
    return { error: mods.error, ok: false };
  }
  const { alt, ctrl, key, shift } = mods;

  if (key === null) {
    return { error: `chord "${input}" has no key`, ok: false };
  }

  if (key.length === 1 && isValidSingleChar(key)) {
    return { chord: { alt, ctrl, key, shift }, ok: true };
  }

  if (key.length > 1 && KNOWN_KEYS.has(key)) {
    return { chord: { alt, ctrl, key, shift }, ok: true };
  }

  return { error: `unknown key "${key}" in "${input}"`, ok: false };
}

export function parseChordCaseSensitive(input: string): ChordParseResult {
  const trimmed = input.trim();
  if (trimmed.length === 1 && trimmed >= "A" && trimmed <= "Z") {
    return {
      chord: {
        alt: false,
        ctrl: false,
        key: trimmed.toLowerCase(),
        shift: true,
      },
      ok: true,
    };
  }
  return parseChord(trimmed);
}

export function serializeChord(chord: KeyChord): string {
  const parts: string[] = [];
  if (chord.ctrl) {
    parts.push("ctrl");
  }
  if (chord.alt) {
    parts.push("alt");
  }
  if (chord.shift) {
    parts.push("shift");
  }
  parts.push(chord.key);
  return parts.join("+");
}

export function keyEventToChord(e: KeyEvent): KeyChord | null {
  if (!e.name) {
    return null;
  }
  const name = e.name.toLowerCase();
  return {
    alt: Boolean(e.meta),
    ctrl: Boolean(e.ctrl),
    key: name,
    shift: Boolean(e.shift),
  };
}

export function chordsEqual(a: KeyChord, b: KeyChord): boolean {
  return (
    a.ctrl === b.ctrl &&
    a.alt === b.alt &&
    a.shift === b.shift &&
    a.key === b.key
  );
}
