import type { ThemeMode } from "@opentui/core";
import {
  resolveTheme as resolvePierreTheme,
  type ThemeRegistrationResolved,
} from "@pierre/diffs";

import {
  blendHex,
  contrastRatio,
  cssColorToHex,
  relativeLuminance,
} from "../color-utils";
import type { NamedCustomThemeConfig } from "../diff-viewer/render/types";
import {
  BUNDLED_THEME_IDS,
  type BundledThemeDiffColors,
  type BundledThemeId,
  getBundledThemeBackground,
  getBundledThemeDiffColors,
  getBundledThemeForeground,
  resolveBundledThemeId,
} from "./catalog";
import { CODEX_PALETTES, type CodeyThemeColors } from "./codey";
import { LEGACY_CUSTOM_THEME_ID } from "./custom";
import { resolveSyntaxScopeOverrides } from "./legacy-scopes";
import type { AppTheme, SyntaxColors, ThemeBase } from "./types";

export type { AppTheme, SyntaxColors, ThemeBase } from "./types";

export const TRANSPARENT_BACKGROUND = "transparent";
export const DEFAULT_DARK_THEME_ID = "github-dark-default";
export const DEFAULT_LIGHT_THEME_ID = "github-light-default";

const MIN_GUTTER_CONTRAST = 4.5;
const MIN_DIFF_SIGN_CONTRAST = 3;

const FALLBACK_DIFF_COLORS = {
  dark: { added: "#5ecc71", modified: "#69b1ff", removed: "#ff6762" },
  light: { added: "#0dbe4e", modified: "#009fff", removed: "#ff2e3f" },
} as const;

/** Return a high-contrast foreground layered over an arbitrary editor surface. */
function readableForeground(preferred: string | undefined, background: string) {
  if (
    preferred &&
    contrastRatio(preferred, background) >= MIN_GUTTER_CONTRAST
  ) {
    return preferred;
  }

  return relativeLuminance(background) > 0.45 ? "#000000" : "#ffffff";
}

/** Return a readable dim foreground for gutters layered over an arbitrary editor surface. */
function readableDimForeground(preferred: string, background: string) {
  if (contrastRatio(preferred, background) >= MIN_GUTTER_CONTRAST) {
    return preferred;
  }

  return relativeLuminance(background) > 0.45
    ? blendHex("#000000", background, 0.62)
    : blendHex("#ffffff", background, 0.62);
}

/** Return a semantic diff marker color that remains legible on a theme editor surface. */
function readableDiffSign(preferred: string, background: string) {
  if (contrastRatio(preferred, background) >= MIN_DIFF_SIGN_CONTRAST) {
    return preferred;
  }

  return relativeLuminance(background) > 0.45
    ? blendHex("#000000", preferred, 0.45)
    : blendHex("#ffffff", preferred, 0.45);
}

/** Build Hunk's fallback semantic syntax palette for non-Shiki custom highlighting. */
function buildSyntaxColors(codeForeground: string): SyntaxColors {
  return {
    comment: codeForeground,
    default: codeForeground,
    function: codeForeground,
    keyword: codeForeground,
    number: codeForeground,
    operator: codeForeground,
    property: codeForeground,
    punctuation: codeForeground,
    string: codeForeground,
    type: codeForeground,
    variable: codeForeground,
  };
}

/** Return the strongest tinted background that keeps foreground text readable. */
function readableTintedBackground(
  tintColor: string,
  background: string,
  foreground: string,
  preferredAmount: number,
) {
  for (let amount = preferredAmount; amount >= 0.02; amount -= 0.02) {
    const candidate = blendHex(tintColor, background, amount);
    if (contrastRatio(foreground, candidate) >= MIN_GUTTER_CONTRAST) {
      return candidate;
    }
  }

  return background;
}

/** Keep semantic status colors readable on sidebar and menu surfaces. */
function readableChromeColor(
  preferred: string,
  panel: string,
  panelAlt: string,
) {
  if (
    contrastRatio(preferred, panel) >= MIN_GUTTER_CONTRAST &&
    contrastRatio(preferred, panelAlt) >= MIN_GUTTER_CONTRAST
  ) {
    return preferred;
  }

  const lightPanel = relativeLuminance(panelAlt) > 0.45;
  const anchor = lightPanel ? "#000000" : "#ffffff";
  for (const amount of [0.35, 0.5, 0.65, 0.8, 1]) {
    const candidate = blendHex(anchor, preferred, amount);
    if (
      contrastRatio(candidate, panel) >= MIN_GUTTER_CONTRAST &&
      contrastRatio(candidate, panelAlt) >= MIN_GUTTER_CONTRAST
    ) {
      return candidate;
    }
  }

  return anchor;
}

/** The editor colors one app theme derives all of its surfaces and tints from. */
type ThemePaletteInput = {
  background: string;
  diffColors: BundledThemeDiffColors | undefined;
  foreground: string | undefined;
  id: string;
};

/** Derive one complete codey theme from an editor palette. */
function buildThemeFromPalette({
  background,
  diffColors,
  foreground,
  id,
}: ThemePaletteInput): AppTheme {
  const editorBackground = background;
  const editorForeground = foreground;
  const isLightSurface = relativeLuminance(editorBackground) > 0.45;
  const fallbackDiffColors =
    FALLBACK_DIFF_COLORS[isLightSurface ? "light" : "dark"];
  const rowTint = isLightSurface ? 0.12 : 0.2;
  const contentTint = isLightSurface ? 0.18 : 0.28;
  const selectedTint = isLightSurface ? 0.18 : 0.25;
  const codeForeground = readableForeground(editorForeground, editorBackground);
  const neutralPanel = blendHex(
    codeForeground,
    editorBackground,
    isLightSurface ? 0.04 : 0.08,
  );
  const neutralPanelAlt = blendHex(
    codeForeground,
    editorBackground,
    isLightSurface ? 0.08 : 0.12,
  );
  const neutralBorder = blendHex(
    codeForeground,
    editorBackground,
    isLightSurface ? 0.15 : 0.18,
  );
  const textForeground = readableForeground(
    editorForeground ?? codeForeground,
    neutralPanelAlt,
  );
  const lineNumberForeground = readableDimForeground(
    blendHex(textForeground, editorBackground, 0.56),
    editorBackground,
  );
  const mutedForeground = readableDimForeground(
    blendHex(textForeground, editorBackground, 0.56),
    neutralPanelAlt,
  );
  const addedSignColor = readableDiffSign(
    diffColors?.added ?? fallbackDiffColors.added,
    editorBackground,
  );
  const removedSignColor = readableDiffSign(
    diffColors?.removed ?? fallbackDiffColors.removed,
    editorBackground,
  );
  const modifiedColor = readableDiffSign(
    diffColors?.modified ?? fallbackDiffColors.modified,
    editorBackground,
  );
  const addedBg = readableTintedBackground(
    addedSignColor,
    editorBackground,
    textForeground,
    rowTint,
  );
  const removedBg = readableTintedBackground(
    removedSignColor,
    editorBackground,
    textForeground,
    rowTint,
  );
  const movedBg = readableTintedBackground(
    modifiedColor,
    editorBackground,
    textForeground,
    rowTint,
  );
  const addedContentBg = readableTintedBackground(
    addedSignColor,
    editorBackground,
    textForeground,
    contentTint,
  );
  const removedContentBg = readableTintedBackground(
    removedSignColor,
    editorBackground,
    textForeground,
    contentTint,
  );
  const accentMuted = readableTintedBackground(
    modifiedColor,
    editorBackground,
    textForeground,
    selectedTint,
  );
  const syntaxColors = buildSyntaxColors(textForeground);
  const badgeAdded = readableChromeColor(
    addedSignColor,
    neutralPanel,
    neutralPanelAlt,
  );
  const badgeRemoved = readableChromeColor(
    removedSignColor,
    neutralPanel,
    neutralPanelAlt,
  );
  const badgeModified = readableChromeColor(
    modifiedColor,
    neutralPanel,
    neutralPanelAlt,
  );
  const themeBase: ThemeBase = {
    accent: modifiedColor,
    accentMuted,
    addedBg,
    addedContentBg,
    addedSignColor,
    appearance: isLightSurface ? "light" : "dark",
    background: editorBackground,
    badgeAdded,
    badgeNeutral: mutedForeground,
    badgeRemoved,
    border: neutralBorder,
    contextBg: editorBackground,
    contextContentBg: editorBackground,
    fileDeleted: badgeRemoved,
    fileModified: badgeModified,
    fileNew: badgeAdded,
    fileRenamed: badgeModified,
    fileUntracked: badgeAdded,
    id,
    label: id,
    lineNumberBg: editorBackground,
    lineNumberFg: lineNumberForeground,
    movedAddedBg: movedBg,
    movedRemovedBg: movedBg,
    muted: mutedForeground,
    noteBackground: neutralPanel,
    noteBorder: modifiedColor,
    noteTitleBackground: neutralPanel,
    noteTitleText: textForeground,
    panel: neutralPanel,
    panelAlt: neutralPanelAlt,
    removedBg,
    removedContentBg,
    removedSignColor,
    selectedHunk: blendHex(modifiedColor, editorBackground, selectedTint),
    syntaxTheme: id,
    text: textForeground,
  };

  return { ...themeBase, syntaxColors };
}

/** Derive one complete codey theme from one bundled Shiki or Pierre editor theme. */
function buildBundledTheme(themeId: BundledThemeId): AppTheme {
  return buildThemeFromPalette({
    background: getBundledThemeBackground(themeId) ?? "#0d1117",
    diffColors: getBundledThemeDiffColors(themeId),
    foreground: getBundledThemeForeground(themeId),
    id: themeId,
  });
}

export const THEMES: AppTheme[] = BUNDLED_THEME_IDS.map((themeId) => {
  const theme = buildBundledTheme(themeId);
  const palette = CODEX_PALETTES[themeId];
  return palette ? applyCodeyPalette(theme, palette) : theme;
});

/**
 * Overlay codey's hand-tuned chrome palette onto a bundled theme so diff and
 * chrome colors both come from codey's original values while syntax
 * highlighting keeps the bundled shiki base.
 */
function applyCodeyPalette(
  theme: AppTheme,
  palette: CodeyThemeColors,
): AppTheme {
  const { ui } = palette;
  return {
    ...theme,
    accent: ui.accent,
    addedBg: ui.diffAddedBg,
    addedSignColor: ui.green,
    background: ui.bg,
    badgeAdded: ui.green,
    badgeNeutral: ui.commentFg,
    badgeRemoved: ui.red,
    border: ui.border,
    chrome: palette,
    contextBg: ui.bg,
    fileDeleted: ui.red,
    fileModified: ui.yellow,
    fileNew: ui.green,
    fileRenamed: ui.purple,
    fileUntracked: ui.green,
    lineNumberBg: ui.panel,
    lineNumberFg: ui.faint,
    muted: ui.dim,
    panel: ui.panel,
    panelAlt: ui.panel,
    removedBg: ui.diffRemovedBg,
    removedSignColor: ui.red,
    selectedHunk: ui.selection,
    text: ui.fg,
  };
}

/**
 * Themes loaded on demand from the Shiki/Pierre collection for ids codey's
 * static catalog does not name. Populated by `resolveThemeAsync` at boot so the
 * synchronous render paths can find the result.
 */
const RESOLVED_THEME_CACHE = new Map<string, AppTheme>();

const shortHexColorPattern = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const longHexColorPattern = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i;

/** Expand #rgb and drop the alpha from #rrggbbaa so every value becomes #rrggbb. */
function opaqueHexColor(color: string) {
  const short = shortHexColorPattern.exec(color);
  if (short) {
    const [, red, green, blue] = short;
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }

  const long = longHexColorPattern.exec(color);
  return long ? `#${long[1]}` : undefined;
}

/** Return the first candidate that normalizes to a usable #rrggbb color. */
function firstHexColor(...candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    // Resolved Shiki/Pierre themes declare Display-P3, #rgb, and #rrggbbaa
    // colors, so normalize each candidate before deciding it is unusable.
    const hex = opaqueHexColor(cssColorToHex(candidate.trim()));
    if (hex) {
      return hex;
    }
  }
}

/** Derive a codey theme from the colors a resolved Shiki/Pierre theme declares. */
function buildThemeFromResolvedTheme(
  id: string,
  resolved: ThemeRegistrationResolved,
) {
  const colors = resolved.colors ?? {};
  return buildThemeFromPalette({
    background:
      firstHexColor(resolved.bg, colors["editor.background"]) ?? "#0d1117",
    diffColors: {
      added: firstHexColor(
        colors["gitDecoration.addedResourceForeground"],
        colors["terminal.ansiGreen"],
      ),
      modified: firstHexColor(
        colors["gitDecoration.modifiedResourceForeground"],
        colors["terminal.ansiBlue"],
      ),
      removed: firstHexColor(
        colors["gitDecoration.deletedResourceForeground"],
        colors["terminal.ansiRed"],
      ),
    },
    foreground: firstHexColor(resolved.fg, colors["editor.foreground"]),
    id,
  });
}

/**
 * Resolve a theme id that the bundled catalog may not name by loading the
 * Shiki/Pierre theme itself and deriving every chrome and diff color from it.
 * Falls back to the standard resolution when the id is unknown to Shiki too.
 */
export async function resolveThemeAsync(
  requested: string | undefined,
  themeMode: ThemeMode | null,
  customThemes: readonly NamedCustomThemeConfig[] = [],
) {
  const isKnown =
    !requested ||
    requested === "auto" ||
    Boolean(builtInThemeById(requested)) ||
    customThemes.some((theme) => theme.id === requested);

  if (!isKnown && requested && !RESOLVED_THEME_CACHE.has(requested)) {
    try {
      const resolved = await resolvePierreTheme(requested);
      RESOLVED_THEME_CACHE.set(
        requested,
        buildThemeFromResolvedTheme(requested, resolved),
      );
    } catch {
      // Unknown theme ids flow through to resolveTheme's default fallback.
    }
  }

  return resolveTheme(requested, themeMode, customThemes);
}

/** Return the built-in theme by id so config-defined themes can inherit from it. */
function builtInThemeById(themeId: string | undefined) {
  const cached = themeId ? RESOLVED_THEME_CACHE.get(themeId) : undefined;
  if (cached) {
    return cached;
  }

  const resolvedThemeId = resolveBundledThemeId(themeId);
  return THEMES.find((theme) => theme.id === resolvedThemeId);
}

/** Return the explicit built-in fallback theme used across startup and missing ids. */
function fallbackTheme(themeMode?: ThemeMode | null) {
  const fallbackId =
    themeMode === "light" ? DEFAULT_LIGHT_THEME_ID : DEFAULT_DARK_THEME_ID;
  return builtInThemeById(fallbackId) ?? (THEMES[0] as AppTheme);
}

function resolvedCustomThemeLabel(
  customLabel: string | undefined,
  customId: string,
) {
  return (
    customLabel ?? (customId === LEGACY_CUSTOM_THEME_ID ? "Custom" : customId)
  );
}

type ThemeFieldOverride<T> = {
  custom: T | undefined;
  base: T;
};

function themeField<T>(override: ThemeFieldOverride<T>): T {
  return override.custom ?? override.base;
}

/** Build one named custom theme by inheriting from a Shiki-backed base palette. */
function buildCustomTheme(customTheme: NamedCustomThemeConfig) {
  const baseTheme = builtInThemeById(customTheme.base) ?? fallbackTheme();
  const syntaxScopeOverrides = resolveSyntaxScopeOverrides(
    customTheme.syntax,
    customTheme.syntaxScopes,
  );
  const label = resolvedCustomThemeLabel(customTheme.label, customTheme.id);
  const themeBase: ThemeBase = {
    accent: themeField({ base: baseTheme.accent, custom: customTheme.accent }),
    accentMuted: themeField({
      base: baseTheme.accentMuted,
      custom: customTheme.accentMuted,
    }),
    addedBg: themeField({
      base: baseTheme.addedBg,
      custom: customTheme.addedBg,
    }),
    addedContentBg: themeField({
      base: baseTheme.addedContentBg,
      custom: customTheme.addedContentBg,
    }),
    addedSignColor: themeField({
      base: baseTheme.addedSignColor,
      custom: customTheme.addedSignColor,
    }),
    appearance: baseTheme.appearance,
    background: themeField({
      base: baseTheme.background,
      custom: customTheme.background,
    }),
    badgeAdded: themeField({
      base: baseTheme.badgeAdded,
      custom: customTheme.badgeAdded,
    }),
    badgeNeutral: themeField({
      base: baseTheme.badgeNeutral,
      custom: customTheme.badgeNeutral,
    }),
    badgeRemoved: themeField({
      base: baseTheme.badgeRemoved,
      custom: customTheme.badgeRemoved,
    }),
    border: themeField({ base: baseTheme.border, custom: customTheme.border }),
    contextBg: themeField({
      base: baseTheme.contextBg,
      custom: customTheme.contextBg,
    }),
    contextContentBg: themeField({
      base: baseTheme.contextContentBg,
      custom: customTheme.contextContentBg,
    }),
    fileDeleted: themeField({
      base: baseTheme.fileDeleted,
      custom: customTheme.fileDeleted,
    }),
    fileModified: themeField({
      base: baseTheme.fileModified,
      custom: customTheme.fileModified,
    }),
    fileNew: themeField({
      base: baseTheme.fileNew,
      custom: customTheme.fileNew,
    }),
    fileRenamed: themeField({
      base: baseTheme.fileRenamed,
      custom: customTheme.fileRenamed,
    }),
    fileUntracked: themeField({
      base: baseTheme.fileUntracked,
      custom: customTheme.fileUntracked,
    }),
    id: customTheme.id,
    label,
    lineNumberBg: themeField({
      base: baseTheme.lineNumberBg,
      custom: customTheme.lineNumberBg,
    }),
    lineNumberFg: themeField({
      base: baseTheme.lineNumberFg,
      custom: customTheme.lineNumberFg,
    }),
    movedAddedBg: themeField({
      base: baseTheme.movedAddedBg,
      custom: customTheme.movedAddedBg,
    }),
    movedRemovedBg: themeField({
      base: baseTheme.movedRemovedBg,
      custom: customTheme.movedRemovedBg,
    }),
    muted: themeField({ base: baseTheme.muted, custom: customTheme.muted }),
    noteBackground: themeField({
      base: baseTheme.noteBackground,
      custom: customTheme.noteBackground,
    }),
    noteBorder: themeField({
      base: baseTheme.noteBorder,
      custom: customTheme.noteBorder,
    }),
    noteTitleBackground: themeField({
      base: baseTheme.noteTitleBackground,
      custom: customTheme.noteTitleBackground,
    }),
    noteTitleText: themeField({
      base: baseTheme.noteTitleText,
      custom: customTheme.noteTitleText,
    }),
    panel: themeField({ base: baseTheme.panel, custom: customTheme.panel }),
    panelAlt: themeField({
      base: baseTheme.panelAlt,
      custom: customTheme.panelAlt,
    }),
    removedBg: themeField({
      base: baseTheme.removedBg,
      custom: customTheme.removedBg,
    }),
    removedContentBg: themeField({
      base: baseTheme.removedContentBg,
      custom: customTheme.removedContentBg,
    }),
    removedSignColor: themeField({
      base: baseTheme.removedSignColor,
      custom: customTheme.removedSignColor,
    }),
    selectedHunk: themeField({
      base: baseTheme.selectedHunk,
      custom: customTheme.selectedHunk,
    }),
    syntaxScopeOverrides,
    syntaxTheme: baseTheme.syntaxTheme,
    text: themeField({ base: baseTheme.text, custom: customTheme.text }),
  };

  return { ...themeBase, syntaxColors: baseTheme.syntaxColors };
}

/**
 * Return every selectable theme id: bundled themes first, then custom themes in
 * the order the session resolved them.
 */
export function availableThemeIds(
  customThemes: readonly NamedCustomThemeConfig[] = [],
): string[] {
  return [
    ...new Set([
      ...THEMES.map((theme) => theme.id),
      ...RESOLVED_THEME_CACHE.keys(),
      ...customThemes.map((theme) => theme.id),
    ]),
  ];
}

/**
 * Return selectable themes in menu and cycle order.
 *
 * The custom themes are expected to be one already-merged list (config themes
 * before extension themes, ids deduped) so this stays a pure projection.
 */
export function availableThemes(
  customThemes: readonly NamedCustomThemeConfig[] = [],
): AppTheme[] {
  const builtIn = [...THEMES, ...RESOLVED_THEME_CACHE.values()];
  return customThemes.length > 0
    ? [
        ...builtIn,
        ...customThemes.map((customTheme) => buildCustomTheme(customTheme)),
      ]
    : builtIn;
}

/**
 * Resolve a named theme, including terminal-background auto mode and custom themes.
 *
 * Custom themes are matched before bundled ids so a custom theme that reuses a
 * deprecated built-in alias still resolves to what the user actually defined.
 */
export function resolveTheme(
  requested: string | undefined,
  themeMode: ThemeMode | null,
  customThemes: readonly NamedCustomThemeConfig[] = [],
) {
  if (requested === "auto") {
    return fallbackTheme(themeMode);
  }

  const customTheme = requested
    ? customThemes.find((theme) => theme.id === requested)
    : undefined;
  if (customTheme) {
    return buildCustomTheme(customTheme);
  }

  const exact = builtInThemeById(requested);
  if (exact) {
    return exact;
  }

  return fallbackTheme(themeMode);
}

/** Return known semantic diff colors for a bundled Shiki- or Pierre-backed theme. */
export function bundledThemeDiffColors(
  themeId: string,
): BundledThemeDiffColors | undefined {
  return getBundledThemeDiffColors(themeId);
}

/**
 * Return a copy of a theme whose neutral surfaces allow the terminal background through while
 * added/removed row tints stay painted. Both the interactive TUI and static pager hosts use
 * this so diff rows keep their semantic backgrounds on translucent terminals.
 */
export function withTransparentSurfaces(theme: AppTheme): AppTheme {
  return {
    ...theme,
    background: TRANSPARENT_BACKGROUND,
    contextBg: TRANSPARENT_BACKGROUND,
    contextContentBg: TRANSPARENT_BACKGROUND,
    lineNumberBg: TRANSPARENT_BACKGROUND,
    panel: TRANSPARENT_BACKGROUND,
    panelAlt: TRANSPARENT_BACKGROUND,
  };
}
