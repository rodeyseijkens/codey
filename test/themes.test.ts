import { describe, expect, test } from "bun:test";
import { getThemeColors } from "../src/ui/colors";
import { resolveTheme } from "../src/ui/hunk-diff/ui/themes";

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
    expect(ui.bg.length).toBe(7);
  });

  test("unknown theme ids fall back to the default theme", () => {
    const fallback = getThemeColors("does-not-exist");
    const def = getThemeColors("github-dark-default");
    expect(fallback.ui.bg).toBe(def.ui.bg);
  });
});
