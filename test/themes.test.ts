import { describe, expect, test } from "bun:test";
import { SyntaxStyle } from "@opentui/core";
import {
  BUILTIN_THEMES,
  getAutoTheme,
  getSyntaxStyle,
  listBuiltinThemes,
  type ThemeModeProvider,
} from "../src/themes/index";
import {
  convertShikiTheme,
  type ShikiThemeLike,
} from "../src/themes/shiki-convert";

const MODE_MISMATCH_RE = /"github-dark" is a dark theme/;
const UNKNOWN_THEME_RE = /Unknown theme/;

describe("listBuiltinThemes", () => {
  test("returns exactly 18 themes", () => {
    expect(listBuiltinThemes()).toHaveLength(18);
  });

  test("returns the expected theme ids", () => {
    expect(listBuiltinThemes()).toEqual([...BUILTIN_THEMES]);
  });
});

describe("getSyntaxStyle", () => {
  for (const themeId of listBuiltinThemes()) {
    test(`loads ${themeId} without error`, async () => {
      const style = await getSyntaxStyle(themeId);
      expect(style).toBeInstanceOf(SyntaxStyle);
      const styleCount = style.getStyleCount();
      expect(styleCount).toBeGreaterThan(0);
      style.destroy();
    });
  }

  test("every theme registers a default style", async () => {
    const themeIds = listBuiltinThemes();
    const styles = await Promise.all(
      themeIds.map((themeId) => getSyntaxStyle(themeId))
    );
    try {
      for (const [index, style] of styles.entries()) {
        expect(
          style.getStyle("default"),
          `theme ${themeIds[index]}`
        ).toBeDefined();
      }
    } finally {
      for (const style of styles) {
        style.destroy();
      }
    }
  });

  test("validates the requested mode against the theme type", async () => {
    await expect(getSyntaxStyle("github-dark", "light")).rejects.toThrow(
      MODE_MISMATCH_RE
    );
  });

  test("throws on an unknown theme id", async () => {
    await expect(getSyntaxStyle("not-a-theme")).rejects.toThrow(
      UNKNOWN_THEME_RE
    );
  });
});

describe("convertShikiTheme", () => {
  test("produces a valid ThemeTokenStyle structure", () => {
    const theme: ShikiThemeLike = {
      colors: {
        "editor.background": "#111111",
        "editor.foreground": "#dddddd",
      },
      name: "fake",
      tokenColors: [
        { scope: ["comment"], settings: { foreground: "#777777" } },
        {
          scope: "keyword",
          settings: { fontStyle: "bold", foreground: "#ff0000" },
        },
        {
          scope: ["string", "punctuation.definition.string"],
          settings: { fontStyle: "italic underline", foreground: "#00ff00" },
        },
      ],
      type: "dark",
    };

    const tokens = convertShikiTheme(theme);

    expect(tokens).toHaveLength(4);

    const [def, comment, keyword, string] = tokens;
    expect(def).toEqual({
      scope: ["default"],
      style: { background: "#111111", foreground: "#dddddd" },
    });
    expect(comment).toEqual({
      scope: ["comment"],
      style: { foreground: "#777777" },
    });
    expect(keyword).toEqual({
      scope: ["keyword"],
      style: { bold: true, foreground: "#ff0000" },
    });
    expect(string?.scope).toEqual(["string", "punctuation.definition.string"]);
    expect(string?.style).toMatchObject({ italic: true, underline: true });
  });

  test("normalizes a string scope into an array", () => {
    const tokens = convertShikiTheme({
      tokenColors: [{ scope: "keyword", settings: { foreground: "#ff0000" } }],
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.scope).toEqual(["keyword"]);
  });

  test("skips token colors with no scope and no styling", () => {
    const tokens = convertShikiTheme({
      tokenColors: [
        { settings: { foreground: "#ffffff" } },
        { scope: "comment" },
        { scope: ["string"], settings: {} },
      ],
    });
    expect(tokens).toHaveLength(0);
  });

  test("keeps only recognized fontStyle flags", () => {
    const tokens = convertShikiTheme({
      tokenColors: [
        {
          scope: ["keyword"],
          settings: { fontStyle: "bold strikethrough", foreground: "#ff0000" },
        },
      ],
    });
    expect(tokens[0]?.style).toEqual({ bold: true, foreground: "#ff0000" });
  });

  test("supports legacy settings array", () => {
    const tokens = convertShikiTheme({
      settings: [{ scope: ["comment"], settings: { foreground: "#999999" } }],
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]).toEqual({
      scope: ["comment"],
      style: { foreground: "#999999" },
    });
  });
});

describe("getAutoTheme", () => {
  test("uses renderer.themeMode when set to light", async () => {
    const renderer: ThemeModeProvider = { themeMode: "light" };
    const style = await getAutoTheme(renderer);
    const def = style.getStyle("default");
    expect(def?.bg?.toString()).toBe("rgba(1.00, 1.00, 1.00, 1.00)");
    style.destroy();
  });

  test("uses renderer.themeMode when set to dark", async () => {
    const renderer: ThemeModeProvider = { themeMode: "dark" };
    const style = await getAutoTheme(renderer);
    expect(style.getStyle("default")).toBeDefined();
    style.destroy();
  });

  test("falls back to waitForThemeMode", async () => {
    const renderer: ThemeModeProvider = {
      get themeMode() {
        return null;
      },
      waitForThemeMode: async () => "light",
    };
    const style = await getAutoTheme(renderer);
    const def = style.getStyle("default");
    expect(def?.bg?.toString()).toBe("rgba(1.00, 1.00, 1.00, 1.00)");
    style.destroy();
  });

  test("defaults to a dark theme when mode cannot be detected", async () => {
    const renderer: ThemeModeProvider = {};
    const style = await getAutoTheme(renderer);
    const def = style.getStyle("default");
    expect(def?.bg?.toString()).not.toBe("rgba(1.00, 1.00, 1.00, 1.00)");
    style.destroy();
  });

  test("dark and light auto themes differ", async () => {
    const dark = await getAutoTheme({ themeMode: "dark" });
    const light = await getAutoTheme({ themeMode: "light" });
    const darkDef = dark.getStyle("default");
    const lightDef = light.getStyle("default");
    expect(darkDef?.bg?.toString()).not.toBe(lightDef?.bg?.toString());
    dark.destroy();
    light.destroy();
  });
});
