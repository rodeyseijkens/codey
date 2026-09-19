import { getBundledThemeBackground } from "../src/ui/theme/catalog";
import { describe, expect, test } from "bun:test";

const SCREENSHOTS_DIR = new URL("../scripts/screenshots/", import.meta.url);

type Shot = {
  demo?: string;
  file: string;
  mode?: string;
  output: string;
  theme: string;
};

const SHOTS: Shot[] = [
  {
    file: "1-diff-comment.tape",
    output: "1.png",
    theme: "gruvbox-dark-hard",
  },
  {
    file: "2-commits-rebase.tape",
    output: "2.png",
    theme: "kanagawa-wave",
  },
  {
    file: "3-help.tape",
    output: "3.png",
    theme: "catppuccin-frappe",
  },
  {
    file: "4-diff-split.tape",
    mode: "split",
    output: "4.png",
    theme: "gruvbox-dark-hard",
  },
  {
    demo: "long-lines diverge",
    file: "5-tour.tape",
    output: "5-tour.gif",
    theme: "gruvbox-dark-hard",
  },
];

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
const DEMO_HEADER_PATTERN = /^# demo:/m;

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

  for (const shot of SHOTS) {
    describe(shot.file, () => {
      test("declares the expected output, theme, and headers", async () => {
        const tape = await readTape(shot.file);
        expect(parseHeader(tape, "shot")).toBe(shot.output);
        expect(parseHeader(tape, "theme")).toBe(shot.theme);
        if (shot.mode) {
          expect(parseHeader(tape, "mode")).toBe(shot.mode);
        } else {
          expect(tape).not.toMatch(MODE_HEADER_PATTERN);
        }
        if (shot.demo) {
          expect(parseHeader(tape, "demo")).toBe(shot.demo);
        } else {
          expect(tape).not.toMatch(DEMO_HEADER_PATTERN);
        }
      });

      test("terminal background matches the bundled theme background", async () => {
        const tape = await readTape(shot.file);
        const expected = getBundledThemeBackground(shot.theme);
        if (!expected) {
          throw new Error(`theme ${shot.theme} has no bundled background`);
        }
        expect(parseThemeBackground(tape)).toBe(expected.toLowerCase());
      });

      test("captures the expected output borderless", async () => {
        const tape = await readTape(shot.file);
        const verb = shot.output.endsWith(".gif") ? "Output" : "Screenshot";
        expect(tape).toContain(`${verb} "shots/${shot.output}"`);
        expect(tape).not.toContain("WindowBar");
      });

      test("shares the agreed terminal settings", async () => {
        const tape = await readTape(shot.file);
        for (const setting of TERMINAL_SETTINGS) {
          expect(tape).toContain(setting);
        }
      });
    });
  }

  test("readme embeds the hero gif", async () => {
    const readme = await Bun.file(
      new URL("../README.md", import.meta.url),
    ).text();
    expect(readme).toContain(".github/assets/screenshots/hero.gif");
    expect(readme).not.toContain(".github/assets/screenshots/hero.png");
  });
});
