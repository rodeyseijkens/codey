import { blendHex, contrastRatio, hexColorDistance } from "../../color-utils";
import { type AppTheme, TRANSPARENT_BACKGROUND } from "../../theme/resolve";
import type { SplitLineCell, StackLineCell } from "./pierre";
import type { ExtensionLineHighlightTone } from "./types";

const INACTIVE_RAIL_BLEND = 0.35;
const SELECTION_BG_BLEND = 0.75;
const CURSOR_LINE_BG_BLEND = 0.2;
const VISUAL_SELECT_BG_BLEND = 0.55;
const hexColorRegex = /^#[0-9a-f]{6}$/i;
const selectionBackgroundCache = new WeakMap<AppTheme, Map<string, string>>();
const cursorLineBackgroundCache = new WeakMap<AppTheme, Map<string, string>>();

/** Memoize one derived row background per theme and base color. */
function cachedRowBackground(
  cache: WeakMap<AppTheme, Map<string, string>>,
  theme: AppTheme,
  baseBg: string,
  blend: () => string,
) {
  let backgrounds = cache.get(theme);
  if (!backgrounds) {
    backgrounds = new Map();
    cache.set(theme, backgrounds);
  }
  let background = backgrounds.get(baseBg);
  if (background === undefined) {
    background = blend();
    backgrounds.set(baseBg, background);
  }
  return background;
}

/** The diff rail marker is always visible in Hunk stack and split rows. */
export function diffRailMarker() {
  return "▌";
}

/**
 * Blend a base cell background toward the selection highlight color.
 *
 * blendHex(fg, bg, ratio) returns `bg + (fg - bg) * ratio`. We pass the highlight color as the
 * "front" and the cell's base bg as the "back", so a higher SELECTION_BG_BLEND pulls the result
 * harder toward the visible highlight color.
 */
export function selectionHighlightBg(baseBg: string, theme: AppTheme) {
  return cachedRowBackground(selectionBackgroundCache, theme, baseBg, () =>
    blendHex(theme.selectedHunk, baseBg, SELECTION_BG_BLEND),
  );
}

/**
 * Lift a cell background toward the theme text color to mark the current line.
 *
 * Shifts luminance rather than hue: blending toward one fixed color barely moves a background
 * already sharing that hue, which left the marker invisible on added rows.
 */
export function cursorLineHighlightBg(baseBg: string, theme: AppTheme) {
  return cachedRowBackground(cursorLineBackgroundCache, theme, baseBg, () => {
    let source: string;
    if (baseBg === TRANSPARENT_BACKGROUND) {
      source = theme.appearance === "dark" ? "#000000" : "#ffffff";
    } else {
      source = baseBg;
    }
    return blendHex(theme.text, source, CURSOR_LINE_BG_BLEND);
  });
}

const visualSelectBackgroundCache = new WeakMap<
  AppTheme,
  Map<string, string>
>();

export function visualSelectHighlightBg(baseBg: string, theme: AppTheme) {
  return cachedRowBackground(visualSelectBackgroundCache, theme, baseBg, () =>
    blendHex(theme.fileModified, baseBg, VISUAL_SELECT_BG_BLEND),
  );
}

/** Return the neutral active-hunk rail color for the current theme. */
export function neutralRailColor(theme: AppTheme) {
  return theme.lineNumberFg;
}

/** Dim a rail color for inactive hunks by blending toward the panel background. */
export function dimRailColor(color: string, theme: AppTheme) {
  return blendHex(color, theme.panel, INACTIVE_RAIL_BLEND);
}

/** Pick the stack-view rail color for one rendered row. */
export function stackRailColor(
  kind: StackLineCell["kind"],
  theme: AppTheme,
  selected: boolean,
) {
  let color: string;

  if (kind === "addition") {
    color = theme.addedSignColor;
  } else if (kind === "deletion") {
    color = theme.removedSignColor;
  } else {
    color = neutralRailColor(theme);
  }

  return selected ? color : dimRailColor(color, theme);
}

/** Pick the left split-view rail color from the old-side cell state. */
export function splitLeftRailColor(
  kind: SplitLineCell["kind"],
  theme: AppTheme,
  selected: boolean,
) {
  const color =
    kind === "deletion" ? theme.removedSignColor : neutralRailColor(theme);
  return selected ? color : dimRailColor(color, theme);
}

/** Pick the right split-view rail color from the new-side cell state. */
export function splitRightRailColor(
  kind: SplitLineCell["kind"],
  theme: AppTheme,
  selected: boolean,
) {
  const color =
    kind === "addition" ? theme.addedSignColor : neutralRailColor(theme);
  return selected ? color : dimRailColor(color, theme);
}

/** Pick split-view colors from the semantic diff cell kind. */
export function splitCellPalette(
  kind: SplitLineCell["kind"],
  theme: AppTheme,
  moveKind?: SplitLineCell["moveKind"],
) {
  if (kind === "addition") {
    return {
      contentBg: moveKind ? theme.movedAddedBg : theme.addedBg,
      gutterBg: moveKind ? theme.movedAddedBg : theme.addedBg,
      numberColor: theme.addedSignColor,
      signColor: theme.addedSignColor,
    };
  }

  if (kind === "deletion") {
    return {
      contentBg: moveKind ? theme.movedRemovedBg : theme.removedBg,
      gutterBg: moveKind ? theme.movedRemovedBg : theme.removedBg,
      numberColor: theme.removedSignColor,
      signColor: theme.removedSignColor,
    };
  }

  if (kind === "empty") {
    return {
      contentBg: theme.panelAlt,
      gutterBg: theme.lineNumberBg,
      numberColor: theme.lineNumberFg,
      signColor: theme.muted,
    };
  }

  return {
    contentBg: theme.contextBg,
    gutterBg: theme.lineNumberBg,
    numberColor: theme.lineNumberFg,
    signColor: theme.muted,
  };
}

/** Pick stack-view colors from the semantic diff cell kind. */
export function stackCellPalette(
  kind: StackLineCell["kind"],
  theme: AppTheme,
  moveKind?: StackLineCell["moveKind"],
) {
  if (kind === "addition") {
    return {
      contentBg: moveKind ? theme.movedAddedBg : theme.addedBg,
      gutterBg: moveKind ? theme.movedAddedBg : theme.addedBg,
      numberColor: theme.addedSignColor,
      signColor: theme.addedSignColor,
    };
  }

  if (kind === "deletion") {
    return {
      contentBg: moveKind ? theme.movedRemovedBg : theme.removedBg,
      gutterBg: moveKind ? theme.movedRemovedBg : theme.removedBg,
      numberColor: theme.removedSignColor,
      signColor: theme.removedSignColor,
    };
  }

  return {
    contentBg: theme.contextBg,
    gutterBg: theme.lineNumberBg,
    numberColor: theme.lineNumberFg,
    signColor: theme.muted,
  };
}

const MIN_LINE_HIGHLIGHT_BG_DISTANCE = 72;
const LINE_HIGHLIGHT_BLEND_STEP = 0.05;
const LINE_HIGHLIGHT_MAX_BLEND = 0.85;
const MIN_LINE_HIGHLIGHT_TEXT_CONTRAST = 3.1;

/** How one resolved mark paints: a background, plus a foreground when the mark inverts. */
export type LineHighlightStyle = {
  bg: string;
  /** Set only for reverse-video marks; tinted marks keep the spans' own colors. */
  fg?: string;
};

const lineHighlightStyleCache = new WeakMap<
  AppTheme,
  Map<string, LineHighlightStyle | undefined>
>();

/** Return whether a theme color can safely participate in RGB distance and blend math. */
function isHexThemeColor(color: string) {
  return hexColorRegex.test(color);
}

function effectiveHighlightBackground(baseBg: string, theme: AppTheme) {
  if (isHexThemeColor(baseBg)) {
    return baseBg;
  }
  if (isHexThemeColor(theme.background)) {
    return theme.background;
  }
  return theme.appearance === "dark" ? "#000000" : "#ffffff";
}

/** The theme color one tinted highlight tone pulls the line background toward. */
function lineHighlightToneAnchor(
  tone: ExtensionLineHighlightTone,
  theme: AppTheme,
) {
  switch (tone) {
    case "info":
      return theme.badgeNeutral;
    case "warning":
      return theme.fileModified;
    case "error":
      return theme.removedSignColor;
    case "current":
    case "match":
      return theme.accent;
    default:
      return theme.accent;
  }
}

function strengthenLineHighlightBg(
  baseBg: string,
  anchor: string,
  minDistance: number,
  textColor: string,
) {
  let strongestReadable = baseBg;
  const maxSteps = Math.floor(
    LINE_HIGHLIGHT_MAX_BLEND / LINE_HIGHLIGHT_BLEND_STEP,
  );

  for (let step = 1; step <= maxSteps; step += 1) {
    const candidate = blendHex(
      anchor,
      baseBg,
      step * LINE_HIGHLIGHT_BLEND_STEP,
    );
    if (
      contrastRatio(textColor, candidate) < MIN_LINE_HIGHLIGHT_TEXT_CONTRAST
    ) {
      return strongestReadable;
    }
    strongestReadable = candidate;
    if (hexColorDistance(candidate, baseBg) >= minDistance) {
      return candidate;
    }
  }

  return strongestReadable;
}

export function lineHighlightToneStyle(
  tone: ExtensionLineHighlightTone,
  baseBg: string,
  theme: AppTheme,
): LineHighlightStyle | undefined {
  let styles = lineHighlightStyleCache.get(theme);
  if (!styles) {
    styles = new Map();
    lineHighlightStyleCache.set(theme, styles);
  }
  const cacheKey = `${tone}:${baseBg}`;
  if (styles.has(cacheKey)) {
    return styles.get(cacheKey);
  }

  const resolved = resolveLineHighlightToneStyle(tone, baseBg, theme);
  styles.set(cacheKey, resolved);
  return resolved;
}

/** Compute one uncached tone style; `lineHighlightToneStyle` owns memoization. */
function resolveLineHighlightToneStyle(
  tone: ExtensionLineHighlightTone,
  baseBg: string,
  theme: AppTheme,
): LineHighlightStyle | undefined {
  if (tone === "current" && isHexThemeColor(theme.text)) {
    return {
      bg: theme.text,
      fg: effectiveHighlightBackground(theme.background, theme),
    };
  }

  const anchor = lineHighlightToneAnchor(tone, theme);
  if (!(isHexThemeColor(anchor) && isHexThemeColor(theme.text))) {
    return undefined;
  }

  return {
    bg: strengthenLineHighlightBg(
      effectiveHighlightBackground(baseBg, theme),
      anchor,
      MIN_LINE_HIGHLIGHT_BG_DISTANCE,
      theme.text,
    ),
  };
}

/** Format one optional line number for a fixed-width diff gutter. */
export function diffLineNumberText(value: number | undefined, width: number) {
  return value === undefined
    ? " ".repeat(width)
    : String(value).padStart(width, " ");
}

/** Build the stack-view gutter text shared by the TUI and static pager renderers. */
export function stackGutterText(
  cell: StackLineCell,
  lineNumberDigits: number,
  showLineNumbers: boolean,
  showSign = false,
) {
  if (!showLineNumbers) {
    return showSign ? `${cell.sign} ` : "  ";
  }

  const oldNumber = diffLineNumberText(cell.oldLineNumber, lineNumberDigits);
  const newNumber = diffLineNumberText(cell.newLineNumber, lineNumberDigits);
  return showSign
    ? `${oldNumber} ${newNumber} ${cell.sign}`
    : `${oldNumber} ${newNumber} `;
}

/** Build the split-view gutter text shared by the TUI and clipboard renderers. */
export function splitGutterText(
  cell: SplitLineCell,
  lineNumberDigits: number,
  showLineNumbers: boolean,
  showSign = false,
) {
  if (!showLineNumbers) {
    return showSign ? `${cell.sign} ` : "  ";
  }

  const number = cell.lineNumber
    ? String(cell.lineNumber).padStart(lineNumberDigits, " ")
    : " ".repeat(lineNumberDigits);
  return showSign ? `${number} ${cell.sign}` : `${number} `;
}
