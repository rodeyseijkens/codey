import type { AppTheme } from "../../theme/resolve";

/** Fixed fallback palette for ANSI-style color names in agent markup. */
const NAMED_COLORS: Record<string, string> = {
  black: "#1c1c1c",
  blue: "#4f8fd9",
  cyan: "#3fb5b5",
  gray: "#8a8a8a",
  green: "#4fb469",
  grey: "#8a8a8a",
  magenta: "#b969d9",
  orange: "#e0873d",
  pink: "#d9699a",
  purple: "#9a6fd0",
  red: "#e05252",
  white: "#e8e8e8",
  yellow: "#d9a331",
};

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function resolveStmlColor(
  token: string | undefined,
  theme: AppTheme,
): string | null {
  if (!token) {
    return null;
  }

  const value = token.trim().toLowerCase();

  switch (value) {
    case "accent":
      return theme.accent;
    case "info":
      return theme.accentMuted;
    case "success":
      return theme.addedSignColor;
    case "danger":
    case "error":
      return theme.removedSignColor;
    case "warning":
      return theme.fileModified;
    case "muted":
      return theme.muted;
    case "subtle":
      return theme.panelAlt;
    case "heading":
    case "text":
      return theme.text;
    case "panel":
    case "bg":
      return theme.panel;
    case "note-border":
      return theme.noteBorder;
    case "badge-text":
      return theme.background;
    default:
      break;
  }

  if (HEX_COLOR.test(value)) {
    return value;
  }

  return NAMED_COLORS[value] ?? null;
}
