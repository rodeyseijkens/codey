import {
  SyntaxStyle,
  type ThemeMode,
  type ThemeTokenStyle,
} from "@opentui/core";
import { bundledThemes } from "shiki/themes";
import { convertShikiTheme, type ShikiThemeLike } from "./shiki-convert";

export const BUILTIN_DARK_THEMES = [
  "github-dark",
  "nord",
  "dracula",
  "tokyo-night",
  "one-dark-pro",
  "solarized-dark",
  "catppuccin-mocha",
  "gruvbox-dark-hard",
  "monokai",
  "night-owl",
  "rose-pine",
  "min-dark",
] as const;

export const BUILTIN_LIGHT_THEMES = [
  "github-light",
  "solarized-light",
  "catppuccin-latte",
  "gruvbox-light-medium",
  "rose-pine-dawn",
  "min-light",
] as const;

export const BUILTIN_THEMES = [
  ...BUILTIN_DARK_THEMES,
  ...BUILTIN_LIGHT_THEMES,
] as const;

export const DEFAULT_DARK_THEME = "github-dark";
export const DEFAULT_LIGHT_THEME = "github-light";

export type BuiltinThemeId = (typeof BUILTIN_THEMES)[number];

export interface ThemeModeProvider {
  themeMode?: ThemeMode | null;
  waitForThemeMode?: (timeoutMs?: number) => Promise<ThemeMode | null>;
}

type ThemeType = NonNullable<ShikiThemeLike["type"]>;

const convertedThemeCache = new Map<string, ThemeTokenStyle[]>();
const themeTypeCache = new Map<string, ThemeType>();

export function listBuiltinThemes(): string[] {
  return [...BUILTIN_THEMES];
}

export async function loadShikiTheme(themeId: string): Promise<ShikiThemeLike> {
  const loaders = bundledThemes as Record<
    string,
    (() => Promise<{ default: ShikiThemeLike }>) | undefined
  >;
  const loader = loaders[themeId];
  if (!loader) {
    throw new Error(
      `Unknown theme "${themeId}". Built-in themes: ${listBuiltinThemes().join(", ")}`
    );
  }
  const mod = await loader();
  return mod.default;
}

export async function getThemeTokens(
  themeId: string
): Promise<ThemeTokenStyle[]> {
  const cached = convertedThemeCache.get(themeId);
  if (cached) {
    return cached;
  }

  const theme = await loadShikiTheme(themeId);
  themeTypeCache.set(themeId, theme.type ?? "dark");

  const tokens = convertShikiTheme(theme);
  convertedThemeCache.set(themeId, tokens);
  return tokens;
}

export async function getSyntaxStyle(
  themeId: string,
  mode?: ThemeMode
): Promise<SyntaxStyle> {
  const tokens = await getThemeTokens(themeId);
  if (mode) {
    const type = themeTypeCache.get(themeId) ?? "dark";
    if (type !== mode) {
      throw new Error(
        `Theme "${themeId}" is a ${type} theme, but mode "${mode}" was requested`
      );
    }
  }
  return SyntaxStyle.fromTheme(tokens);
}

export async function detectThemeMode(
  renderer: ThemeModeProvider | null | undefined
): Promise<ThemeMode> {
  if (renderer && typeof renderer.themeMode === "string") {
    return renderer.themeMode;
  }
  if (renderer && typeof renderer.waitForThemeMode === "function") {
    const mode = await renderer.waitForThemeMode(1500);
    if (mode === "dark" || mode === "light") {
      return mode;
    }
  }
  return "dark";
}

export async function getAutoTheme(
  renderer?: ThemeModeProvider | null
): Promise<SyntaxStyle> {
  const mode = await detectThemeMode(renderer);
  return getSyntaxStyle(
    mode === "light" ? DEFAULT_LIGHT_THEME : DEFAULT_DARK_THEME,
    mode
  );
}
