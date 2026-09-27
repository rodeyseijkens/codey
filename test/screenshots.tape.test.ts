import { getBundledThemeBackground } from "../src/ui/theme/catalog";
import { describe, expect, test } from "bun:test";

const SCREENSHOTS_DIR = new URL("../scripts/screenshots/", import.meta.url);

const SHOT = {
  demo: "long-lines diverge",
  file: "tour.tape",
  output: "tour.gif",
  theme: "gruvbox-dark-hard",
} as const;

const TERMINAL_SETTINGS = [
  'Set FontFamily "Maple Mono NF CN"',
  "Set FontSize 16",
  "Set Width 1600",
  "Set Height 1000",
  "Set Padding 0",
];

const THEME_BACKGROUND_PATTERN =
  /Set Theme \{[^}]*"background":\s*"(#[0-9a-fA-F]{6})"/;

const MODE_HEADER_PATTERN = /^# mode:/m;

function readTape(file: string): Promise<string> {
  return Bun.file(new URL(file, SCREENSHOTS_DIR)).text();
}

function parseHeader(tape: string, key: string): string {
  const value = tape.match(new RegExp(`^# ${key}: (.+)$`, "m"))?.[1];
  if (!value) {
    throw new Error(`tape is missing "# ${key}:" header`);
  }
  return value.trim();
}

function parseThemeBackground(tape: string): string {
  const background = tape.match(THEME_BACKGROUND_PATTERN)?.[1]?.toLowerCase();
  if (!background) {
    throw new Error(
      "tape is missing a Set Theme command with a background color",
    );
  }
  return background;
}

describe("screenshot tapes", () => {
  test("runner script exists", async () => {
    const runner = Bun.file(
      new URL("../scripts/screenshots.sh", import.meta.url),
    );
    expect(await runner.exists()).toBe(true);
  });

  test("only the tour tape remains", async () => {
    const tapes = await Array.fromAsync(
      new Bun.Glob("*.tape").scan({
        cwd: new URL("../scripts/screenshots/", import.meta.url).pathname,
      }),
    );
    expect(tapes).toEqual([SHOT.file]);
  });

  describe(SHOT.file, () => {
    test("declares the expected output, theme, and headers", async () => {
      const tape = await readTape(SHOT.file);
      expect(parseHeader(tape, "shot")).toBe(SHOT.output);
      expect(parseHeader(tape, "theme")).toBe(SHOT.theme);
      expect(parseHeader(tape, "demo")).toBe(SHOT.demo);
      expect(tape).not.toMatch(MODE_HEADER_PATTERN);
    });

    test("terminal background matches the bundled theme background", async () => {
      const tape = await readTape(SHOT.file);
      const expected = getBundledThemeBackground(SHOT.theme);
      if (!expected) {
        throw new Error(`theme ${SHOT.theme} has no bundled background`);
      }
      expect(parseThemeBackground(tape)).toBe(expected.toLowerCase());
    });

    test("captures the expected output borderless", async () => {
      const tape = await readTape(SHOT.file);
      expect(tape).toContain(`Output "shots/${SHOT.output}"`);
      expect(tape).not.toContain("WindowBar");
    });

    test("shares the agreed terminal settings", async () => {
      const tape = await readTape(SHOT.file);
      for (const setting of TERMINAL_SETTINGS) {
        expect(tape).toContain(setting);
      }
    });
  });

  test("readme embeds only the hero gif", async () => {
    const readme = await Bun.file(
      new URL("../README.md", import.meta.url),
    ).text();
    expect(readme).toContain(".github/assets/screenshots/hero.gif");
    expect(readme).not.toContain(".github/assets/screenshots/hero.png");
    expect(readme).not.toContain(".github/assets/screenshots/1.png");
    expect(readme).not.toContain(".github/assets/screenshots/5-tour.gif");
  });
});
