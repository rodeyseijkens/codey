import type { ThemeTokenStyle } from "@opentui/core";

export interface ShikiThemeLike {
  colors?: Record<string, string>;
  name?: string;
  settings?: ShikiTokenColor[];
  tokenColors?: ShikiTokenColor[];
  type?: "dark" | "light";
}

interface ShikiTokenColor {
  scope?: string | string[];
  settings?: ShikiTokenSettings;
}

interface ShikiTokenSettings {
  background?: string;
  fontStyle?: string;
  foreground?: string;
}

interface FontStyles {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

const FONT_STYLE_SEPARATOR = /\s+/;

function parseFontStyle(fontStyle: string | undefined): FontStyles {
  if (!fontStyle) {
    return {};
  }
  const styles: FontStyles = {};
  const parts = fontStyle.toLowerCase().split(FONT_STYLE_SEPARATOR);
  for (const part of parts) {
    if (part === "bold") {
      styles.bold = true;
    } else if (part === "italic") {
      styles.italic = true;
    } else if (part === "underline") {
      styles.underline = true;
    }
  }
  return styles;
}

function toScopeArray(scope: string | string[] | undefined): string[] {
  if (!scope) {
    return [];
  }
  if (Array.isArray(scope)) {
    return scope;
  }
  return [scope];
}

export function convertShikiTheme(theme: ShikiThemeLike): ThemeTokenStyle[] {
  const result: ThemeTokenStyle[] = [];

  const editorFg = theme.colors?.["editor.foreground"];
  const editorBg = theme.colors?.["editor.background"];

  if (editorFg || editorBg) {
    result.push({
      scope: ["default"],
      style: {
        background: editorBg,
        foreground: editorFg,
      },
    });
  }

  const tokenColors = theme.tokenColors ?? theme.settings ?? [];

  for (const tokenColor of tokenColors) {
    const scopes = toScopeArray(tokenColor.scope);
    if (scopes.length === 0) {
      continue;
    }

    const { settings } = tokenColor;
    if (!settings) {
      continue;
    }

    const hasForeground = settings.foreground !== undefined;
    const hasBackground = settings.background !== undefined;
    const fontStyles = parseFontStyle(settings.fontStyle);
    const hasAttributes = Object.keys(fontStyles).length > 0;

    if (!(hasForeground || hasBackground || hasAttributes)) {
      continue;
    }

    result.push({
      scope: scopes,
      style: {
        background: settings.background,
        foreground: settings.foreground,
        ...fontStyles,
      },
    });
  }

  return result;
}
