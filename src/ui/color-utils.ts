/** One parsed RGB triplet from a #rrggbb hex color. */
type RgbColor = {
  b: number;
  g: number;
  r: number;
};

const hexColorRegex = /^#?[0-9a-f]{6}$/i;
const hexHashRegex = /^#/;

const displayP3ColorRegex =
  /^color\(\s*display-p3\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+)?\s*\)$/i;

/** Display-P3 to linear-sRGB matrix (D65) from CSS Color 4. */
const P3_TO_SRGB_MATRIX = [
  [1.224_940_2, -0.224_940_2, 0],
  [-0.042_056_9, 1.042_056_9, 0],
  [-0.019_637_6, -0.078_636_1, 1.098_273_6],
] as const;

/** Decode one gamma-encoded sRGB channel into linear light. */
function sRGBToLinear(channel: number) {
  return channel <= 0.040_45
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Encode one linear-light channel back into gamma-encoded sRGB. */
function linearToSRGB(channel: number) {
  return channel <= 0.003_130_8
    ? 12.92 * channel
    : 1.055 * channel ** (1 / 2.4) - 0.055;
}

/** Convert one normalized channel into a clamped, two-digit hex pair. */
function channelToHex(channel: number) {
  const clamped = Math.max(0, Math.min(1, channel));
  return Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
}

/**
 * Convert a CSS `color(display-p3 ...)` value into an sRGB #rrggbb hex.
 *
 * Terminals only understand sRGB hex, so the first-party Pierre themes that
 * declare Display-P3 token colors must be converted before rendering. Any
 * other value passes through unchanged.
 */
export function cssColorToHex(color: string) {
  const match = displayP3ColorRegex.exec(color.trim());
  if (!match) {
    return color;
  }

  const redLinear = sRGBToLinear(Number(match[1]));
  const greenLinear = sRGBToLinear(Number(match[2]));
  const blueLinear = sRGBToLinear(Number(match[3]));
  const [redRow, greenRow, blueRow] = P3_TO_SRGB_MATRIX;
  const red =
    redRow[0] * redLinear + redRow[1] * greenLinear + redRow[2] * blueLinear;
  const green =
    greenRow[0] * redLinear +
    greenRow[1] * greenLinear +
    greenRow[2] * blueLinear;
  const blue =
    blueRow[0] * redLinear + blueRow[1] * greenLinear + blueRow[2] * blueLinear;

  return `#${channelToHex(linearToSRGB(red))}${channelToHex(linearToSRGB(green))}${channelToHex(linearToSRGB(blue))}`;
}

/** Parse a #rrggbb color into RGB components. Falls back to black for invalid input. */
function hexToRgb(hex: string): RgbColor {
  const normalized = hexColorRegex.test(hex)
    ? hex.replace(hexHashRegex, "")
    : "000000";
  const value = Number.parseInt(normalized, 16);
  return {
    // biome-ignore lint/suspicious/noBitwiseOperators: intentional hex color parsing
    b: value & 0xff,
    // biome-ignore lint/suspicious/noBitwiseOperators: intentional hex color parsing
    g: (value >> 8) & 0xff,
    // biome-ignore lint/suspicious/noBitwiseOperators: intentional hex color parsing
    r: (value >> 16) & 0xff,
  };
}

/** Blend one foreground color toward a background color at a fixed ratio. */
export function blendHex(fg: string, bg: string, ratio: number) {
  const foreground = hexToRgb(fg);
  const background = hexToRgb(bg);
  const mix = (front: number, back: number) =>
    Math.max(0, Math.min(255, Math.round(back + (front - back) * ratio)));

  const packed =
    // biome-ignore lint/suspicious/noBitwiseOperators: intentional hex color packing
    (mix(foreground.r, background.r) << 16) |
    // biome-ignore lint/suspicious/noBitwiseOperators: intentional hex color packing
    (mix(foreground.g, background.g) << 8) |
    mix(foreground.b, background.b);
  return `#${packed.toString(16).padStart(6, "0")}`;
}

/** Convert one sRGB channel into linear-light space for WCAG contrast math. */
function linearizedChannel(channel: number) {
  const value = channel / 255;
  return value <= 0.039_28 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Return the WCAG relative luminance for a #rrggbb color. */
export function relativeLuminance(hex: string) {
  const color = hexToRgb(hex);
  return (
    0.2126 * linearizedChannel(color.r) +
    0.7152 * linearizedChannel(color.g) +
    0.0722 * linearizedChannel(color.b)
  );
}

/** Return the WCAG contrast ratio between two #rrggbb colors. */
export function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Measure how visually separated two #rrggbb colors are using channel deltas. */
export function hexColorDistance(left: string, right: string) {
  const a = hexToRgb(left);
  const b = hexToRgb(right);
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}
