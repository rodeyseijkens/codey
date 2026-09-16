import { registerCustomTheme } from "@pierre/diffs";

import { cssColorToHex } from "../src/ui/color-utils";
import { getThemeColors } from "../src/ui/colors";
import {
  BUNDLED_PIERRE_THEME_IDS,
  BUNDLED_THEME_IDS,
} from "../src/ui/theme/catalog";
import {
  availableThemeIds,
  availableThemes,
  resolveTheme,
  resolveThemeAsync,
} from "../src/ui/theme/resolve";
import { describe, expect, test } from "bun:test";

const HEX_COLOR_LENGTH = 7;
const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

describe("unified theme system", () => {
  test("github-dark keeps codey's original chrome palette", () => {
    const { ui } = getThemeColors("github-dark");
    expect(ui.bg).toBe("#0d1117");
    expect(ui.panel).toBe("#161b22");
    expect(ui.accent).toBe("#58a6ff");
    expect(ui.fg).toBe("#e6edf3");
    expect(ui.green).toBe("#3fb950");
    expect(ui.red).toBe("#f85149");
    expect(ui.selection).toBe("#1f3a5f");
  });

  test("diff colors resolve from the same theme as the chrome", () => {
    const theme = resolveTheme("github-dark", null);
    expect(theme.background).toBe(getThemeColors("github-dark").ui.bg);
    expect(theme.addedBg).toBe("#1a4d2e");
    expect(theme.removedBg).toBe("#4d1a24");
    expect(theme.addedSignColor).toBe("#3fb950");
    expect(theme.removedSignColor).toBe("#f85149");
  });

  test("syntax highlighting keeps the bundled shiki base", () => {
    const theme = resolveTheme("github-dark", null);
    expect(theme.syntaxTheme).toBe("github-dark");
    expect(theme.syntaxColors.keyword).toBeDefined();
  });

  test("non-codey bundled themes still resolve with derived chrome", () => {
    const { ui } = getThemeColors("ayu-dark");
    expect(ui.bg).toBe(resolveTheme("ayu-dark", null).background);
    expect(ui.bg.length).toBe(HEX_COLOR_LENGTH);
  });

  test("unknown theme ids fall back to the default theme", () => {
    const fallback = getThemeColors("does-not-exist");
    const def = getThemeColors("github-dark-default");
    expect(fallback.ui.bg).toBe(def.ui.bg);
  });
});

describe("first-party pierre themes", () => {
  test("every bundled Shiki and Pierre theme is selectable", () => {
    const ids = availableThemeIds();
    for (const id of BUNDLED_THEME_IDS) {
      expect(ids).toContain(id);
    }
  });

  test("pierre themes resolve with their own palette and syntax base", () => {
    const theme = resolveTheme("pierre-dark", null);
    expect(theme.id).toBe("pierre-dark");
    expect(theme.background).toBe("#0a0a0a");
    expect(theme.appearance).toBe("dark");
    expect(theme.addedSignColor).toBe("#07c480");
    expect(theme.removedSignColor).toBe("#ff2e3f");
    expect(theme.syntaxTheme).toBe("pierre-dark");
  });

  test("pierre vibrant themes convert display-p3 colors to hex", () => {
    const theme = resolveTheme("pierre-light-vibrant", null);
    expect(theme.id).toBe("pierre-light-vibrant");
    expect(theme.background).toBe("#ffffff");
    expect(theme.appearance).toBe("light");
    expect(theme.removedSignColor).toBe("#e91e2e");
    expect(theme.addedSignColor).toMatch(HEX_COLOR_PATTERN);
  });

  test("chrome colors resolve for every pierre theme", () => {
    for (const id of BUNDLED_PIERRE_THEME_IDS) {
      const { ui } = getThemeColors(id);
      expect(ui.bg).toBe(resolveTheme(id, null).background);
      expect(ui.bg).toMatch(HEX_COLOR_PATTERN);
    }
  });

  test("custom themes can inherit from a pierre base", () => {
    const custom = availableThemes([
      { base: "pierre-dark", id: "my-pierre" },
    ]).find((theme) => theme.id === "my-pierre");
    expect(custom?.background).toBe("#0a0a0a");
    expect(custom?.syntaxTheme).toBe("pierre-dark");
  });
});

describe("async theme resolution", () => {
  test("bundled ids resolve the same as the sync path", async () => {
    const theme = await resolveThemeAsync("tokyo-night", null);
    expect(theme.id).toBe("tokyo-night");
    expect(theme.background).toBe(resolveTheme("tokyo-night", null).background);
  });

  test("auto and unknown ids stay on the fallback path", async () => {
    const auto = await resolveThemeAsync("auto", "dark");
    expect(auto.id).toBe("github-dark-default");

    const unknown = await resolveThemeAsync("not-a-real-shiki-theme", null);
    expect(unknown.id).toBe(resolveTheme("not-a-real-shiki-theme", null).id);
  });

  test("ids outside the catalog resolve from Shiki and theme the whole app", async () => {
    registerCustomTheme("codey-test-shiki", () =>
      Promise.resolve({
        colors: {
          "editor.background": "#101820",
          "editor.foreground": "#e0e0e0",
          "gitDecoration.addedResourceForeground": "#00ff00",
          "gitDecoration.deletedResourceForeground": "#ff0000",
        },
        name: "codey-test-shiki",
        settings: [],
        type: "dark",
      }),
    );

    const theme = await resolveThemeAsync("codey-test-shiki", null);
    expect(theme.id).toBe("codey-test-shiki");
    expect(theme.background).toBe("#101820");
    expect(theme.addedSignColor).toBe("#00ff00");
    expect(theme.removedSignColor).toBe("#ff0000");
    // Chrome reads the same cached theme through the sync path.
    expect(getThemeColors("codey-test-shiki").ui.bg).toBe("#101820");
    expect(resolveTheme("codey-test-shiki", null).id).toBe("codey-test-shiki");
  });
});

describe("css color conversion", () => {
  test("display-p3 token colors convert to sRGB hex", () => {
    expect(cssColorToHex("color(display-p3 0.039216 0.039216 0.039216)")).toBe(
      "#0a0a0a",
    );
    expect(cssColorToHex("color(display-p3 1 0.250216 0.262337)")).toBe(
      "#ff1b37",
    );
  });

  test("sRGB hex and unrelated values pass through unchanged", () => {
    expect(cssColorToHex("#1F3A5F")).toBe("#1F3A5F");
    expect(cssColorToHex("italic")).toBe("italic");
  });
});
