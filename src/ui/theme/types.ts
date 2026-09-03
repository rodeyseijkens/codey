import type { CodeyThemeColors } from "./codey";

export type AppTheme = {
  accent: string;
  accentMuted: string;
  addedBg: string;
  addedContentBg: string;
  addedSignColor: string;
  appearance: "light" | "dark";
  background: string;
  badgeAdded: string;
  badgeNeutral: string;
  badgeRemoved: string;
  border: string;
  /** Host chrome palette for codey's hand-tuned themes; absent for pure bundled themes. */
  chrome?: CodeyThemeColors;
  contextBg: string;
  contextContentBg: string;
  fileDeleted: string;
  fileModified: string;
  fileNew: string;
  fileRenamed: string;
  fileUntracked: string;
  id: string;
  label: string;
  lineNumberBg: string;
  lineNumberFg: string;
  movedAddedBg: string;
  movedRemovedBg: string;
  muted: string;
  noteBackground: string;
  noteBorder: string;
  noteTitleBackground: string;
  noteTitleText: string;
  panel: string;
  panelAlt: string;
  removedBg: string;
  removedContentBg: string;
  removedSignColor: string;
  selectedHunk: string;
  syntaxColors: SyntaxColors;
  /** Exact Shiki/TextMate scope colors layered onto the base syntax theme. */
  syntaxScopeOverrides?: Record<string, string>;
  /** Optional Shiki/Pierre base theme name for source-accurate code highlighting. */
  syntaxTheme?: string;
  text: string;
};

export type SyntaxColors = {
  default: string;
  keyword: string;
  string: string;
  comment: string;
  number: string;
  function: string;
  property: string;
  type: string;
  variable?: string;
  operator?: string;
  punctuation: string;
};

export type ThemeBase = Omit<AppTheme, "syntaxColors">;
