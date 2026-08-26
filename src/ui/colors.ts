import type { ThemeMode } from "@opentui/core";

import { blendHex } from "./hunk-diff/ui/lib/color";
import { type AppTheme, resolveTheme } from "./hunk-diff/ui/themes";
import {
  STATUS_ADDED,
  STATUS_COPIED,
  STATUS_DELETED,
  STATUS_MODIFIED,
  STATUS_RENAMED,
  STATUS_TYPE_CHANGED,
} from "./icons";

export type IconColorKey =
  | "aqua"
  | "beige"
  | "blue"
  | "gray"
  | "green"
  | "orange"
  | "purple"
  | "red"
  | "yellow";

export type IconColors = {
  aqua: string;
  beige: string;
  blue: string;
  gray: string;
  green: string;
  orange: string;
  purple: string;
  red: string;
  yellow: string;
};

export type UiColors = {
  accent: string;
  bg: string;
  border: string;
  commentFg: string;
  dim: string;
  errorBg: string;
  faint: string;
  fg: string;
  green: string;
  greenBg: string;
  panel: string;
  purple: string;
  red: string;
  redBg: string;
  selection: string;
  successBg: string;
  warnBg: string;
  yellow: string;
};

export type ThemeColors = {
  icons: IconColors;
  ui: UiColors;
};

const ERROR_BG_RATIO = 0.28;
const FAINT_RATIO = 0.55;
const PANEL_TINT_RATIO = 0.22;
const SELECTION_RATIO = 0.32;
const WARN_BG_RATIO = 0.3;

/** Blend `front` into `back` at `ratio` (0-1), returning a hex color. */
function tint(front: string, back: string, ratio: number): string {
  return blendHex(front, back, ratio);
}

/** Icon palette per appearance, with status colors pulled from the theme. */
function iconsFor(theme: AppTheme): IconColors {
  const dark = theme.appearance === "dark";
  return {
    aqua: dark ? "#39d2c0" : "#0f7b6c",
    beige: dark ? "#e3b341" : "#9a6700",
    blue: theme.accent,
    gray: theme.muted,
    green: theme.addedSignColor,
    orange: dark ? "#e78a4e" : "#bc4c00",
    purple: dark ? "#bc8cff" : "#8250df",
    red: theme.removedSignColor,
    yellow: dark ? "#d29922" : "#9a6700",
  };
}

/** Chrome colors derived from the unified hunk theme for non-codey themes. */
function uiColorsFor(theme: AppTheme): UiColors {
  const { panel, background } = theme;
  const dark = theme.appearance === "dark";
  return {
    accent: theme.accent,
    bg: background,
    border: theme.border,
    commentFg: theme.badgeNeutral,
    dim: theme.muted,
    errorBg: tint(theme.removedSignColor, panel, ERROR_BG_RATIO),
    faint: tint(theme.muted, background, FAINT_RATIO),
    fg: theme.text,
    green: theme.addedSignColor,
    greenBg: tint(theme.addedSignColor, panel, PANEL_TINT_RATIO),
    panel,
    purple: dark ? "#bc8cff" : "#8250df",
    red: theme.removedSignColor,
    redBg: tint(theme.removedSignColor, panel, PANEL_TINT_RATIO),
    selection: tint(theme.accent, panel, SELECTION_RATIO),
    successBg: tint(theme.addedSignColor, panel, PANEL_TINT_RATIO),
    warnBg: tint(theme.fileModified, panel, WARN_BG_RATIO),
    yellow: theme.fileModified,
  };
}

export const DEFAULT_THEME_ID = "github-dark";

/**
 * Resolve one theme id into chrome colors. The diff body resolves the same id
 * through the same `resolveTheme` path, so chrome and diff colors always come
 * from one theme system. codey's hand-tuned themes carry their exact chrome
 * palette on the theme; other bundled themes get derived chrome colors.
 */
export function getThemeColors(
  themeId: string,
  themeMode?: ThemeMode,
): ThemeColors {
  const theme = resolveTheme(themeId, themeMode ?? null);
  return theme.chrome ?? { icons: iconsFor(theme), ui: uiColorsFor(theme) };
}

export function statusColor(status: string, C: UiColors): string {
  switch (status) {
    case "added":
      return C.green;
    case "deleted":
      return C.red;
    case "renamed":
    case "copied":
      return C.purple;
    case "modified":
      return C.yellow;
    default:
      return C.dim;
  }
}

export function statusIcon(status: string): string {
  switch (status) {
    case "added":
      return STATUS_ADDED;
    case "deleted":
      return STATUS_DELETED;
    case "renamed":
      return STATUS_RENAMED;
    case "copied":
      return STATUS_COPIED;
    case "type-changed":
      return STATUS_TYPE_CHANGED;
    default:
      return STATUS_MODIFIED;
  }
}
