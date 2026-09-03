import { eastAsianWidth } from "get-east-asian-width";
import stringWidth from "string-width";

import { sanitizeTerminalLine } from "./terminalText";

const printableAsciiRegex = /^[\u0020-\u007E]*$/;

/** Return whether text contains only single-cell printable ASCII scalars. */
export function isPrintableAsciiText(text: string) {
  return printableAsciiRegex.test(text);
}
const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

/** Iterate user-visible text clusters so wide and combining characters stay together. */
export function textClusters(text: string) {
  if (!graphemeSegmenter) {
    return Array.from(text);
  }

  return Array.from(
    graphemeSegmenter.segment(text),
    (segment) => segment.segment,
  );
}

const zeroWidthScalarRegex =
  /^[\p{Default_Ignorable_Code_Point}\p{Control}\p{Format}\p{Mark}\p{Surrogate}]$/u;
const emojiModifierRegex = /^\p{Emoji_Modifier}$/u;
const regionalIndicatorRegex = /^\p{Regional_Indicator}$/u;

/** Return whether one scalar prepends itself to the following grapheme cluster. */
function isGraphemePrepend(codePoint: number) {
  return (
    (codePoint >= 0x06_00 && codePoint <= 0x06_05) ||
    codePoint === 0x06_dd ||
    codePoint === 0x07_0f ||
    (codePoint >= 0x08_90 && codePoint <= 0x08_91) ||
    codePoint === 0x08_e2 ||
    codePoint === 0x0d_4e ||
    codePoint === 0x1_10_bd ||
    codePoint === 0x1_10_cd ||
    (codePoint >= 0x1_11_c2 && codePoint <= 0x1_11_c3) ||
    codePoint === 0x1_19_3f ||
    codePoint === 0x1_19_41 ||
    codePoint === 0x1_1a_3a ||
    (codePoint >= 0x1_1a_84 && codePoint <= 0x1_1a_89) ||
    codePoint === 0x1_1d_46 ||
    codePoint === 0x1_1f_02
  );
}

/** Return whether a common source-code scalar is known to stand alone as one grapheme. */
function isCommonIndependentScalar(codePoint: number) {
  return (
    (codePoint >= 0x20 && codePoint <= 0x7e) ||
    (codePoint >= 0x30_00 && codePoint <= 0x30_29) ||
    (codePoint >= 0x30_41 && codePoint <= 0x30_96) ||
    (codePoint >= 0x30_9d && codePoint <= 0x30_ff) ||
    (codePoint >= 0x34_00 && codePoint <= 0x9f_ff) ||
    (codePoint >= 0xac_00 && codePoint <= 0xd7_a3) ||
    (codePoint >= 0xf9_00 && codePoint <= 0xfa_ff) ||
    (codePoint >= 0xff_01 && codePoint <= 0xff_60) ||
    (codePoint >= 0xff_e0 && codePoint <= 0xff_e6)
  );
}

/** Return whether one scalar can compose with adjacent scalars into a different-width cluster. */
function scalarRequiresGraphemeComposition(scalar: string, codePoint: number) {
  if (isCommonIndependentScalar(codePoint)) {
    return false;
  }

  return (
    zeroWidthScalarRegex.test(scalar) ||
    emojiModifierRegex.test(scalar) ||
    regionalIndicatorRegex.test(scalar) ||
    isGraphemePrepend(codePoint) ||
    codePoint === 0x0e_33 ||
    codePoint === 0x0e_b3 ||
    codePoint === 0xff_9e ||
    codePoint === 0xff_9f ||
    (codePoint >= 0x11_00 && codePoint <= 0x11_ff) ||
    (codePoint >= 0xa9_60 && codePoint <= 0xa9_7f) ||
    (codePoint >= 0xd7_b0 && codePoint <= 0xd7_ff)
  );
}

/** Return a direct width for sanitized independent scalars, or null when graphemes must compose. */
export function measureSimpleSanitizedTextWidth(text: string) {
  let width = 0;
  for (const scalar of text) {
    const codePoint = scalar.codePointAt(0) ?? 0;
    if (scalarRequiresGraphemeComposition(scalar, codePoint)) {
      return null;
    }
    width += eastAsianWidth(codePoint);
  }
  return width;
}

export function measureClusterWidth(cluster: string): number {
  const codePoint = cluster.codePointAt(0);
  if (codePoint === undefined) {
    return 0;
  }

  const scalarUnitLength = codePoint > 0xff_ff ? 2 : 1;

  if (cluster.length === scalarUnitLength) {
    return zeroWidthScalarRegex.test(cluster) ? 0 : eastAsianWidth(codePoint);
  }

  return stringWidth(cluster);
}

function repeatedSingleUnitChar(text: string): string | null {
  if (text.length < 2) {
    return null;
  }

  const unit = text.charCodeAt(0);
  if (unit >= 0xd8_00 && unit <= 0xdf_ff) {
    return null;
  }

  for (let index = 1; index < text.length; index += 1) {
    if (text.charCodeAt(index) !== unit) {
      return null;
    }
  }

  return text[0] ?? null;
}

/** Measure terminal width for text that has already passed terminal sanitization. */
export function measureSanitizedTextWidth(text: string) {
  if (printableAsciiRegex.test(text)) {
    return text.length;
  }

  const repeatedChar = repeatedSingleUnitChar(text);
  if (repeatedChar !== null) {
    const codePoint = repeatedChar.codePointAt(0) ?? 0;
    const charWidth = measureClusterWidth(repeatedChar);
    if (
      charWidth > 0 &&
      !scalarRequiresGraphemeComposition(repeatedChar, codePoint)
    ) {
      return charWidth * text.length;
    }
  }

  return measureSimpleSanitizedTextWidth(text) ?? stringWidth(text);
}

/** Measure text in terminal cells, treating CJK and emoji clusters as wide. */
export function measureTextWidth(text: string) {
  return measureSanitizedTextWidth(sanitizeTerminalLine(text));
}

export type WrappedTextChunk = {
  startsNewLine: boolean;
  text: string;
  width: number;
};

export function wrapTextByWidth(
  text: string,
  lineWidth: number,
  firstLineWidth = lineWidth,
  firstLineHasContent = false,
): WrappedTextChunk[] {
  return wrapSanitizedTextByWidth(
    sanitizeTerminalLine(text),
    lineWidth,
    firstLineWidth,
    firstLineHasContent,
  );
}

/** Split already-sanitized text by terminal width without rescanning for control sequences. */
export function wrapSanitizedTextByWidth(
  safeText: string,
  lineWidth: number,
  firstLineWidth = lineWidth,
  firstLineHasContent = false,
): WrappedTextChunk[] {
  const fullWidth = Math.max(0, lineWidth);
  if (fullWidth === 0 || safeText.length === 0) {
    return [];
  }

  const chunks: WrappedTextChunk[] = [];
  let remaining = Math.max(0, Math.min(firstLineWidth, fullWidth));
  let startsNewLine = false;

  if (printableAsciiRegex.test(safeText)) {
    let offset = 0;
    while (offset < safeText.length) {
      if (remaining === 0) {
        remaining = fullWidth;
        startsNewLine = true;
      }

      const chunkWidth = Math.min(remaining, safeText.length - offset);
      chunks.push({
        startsNewLine,
        text: safeText.slice(offset, offset + chunkWidth),
        width: chunkWidth,
      });
      offset += chunkWidth;
      remaining -= chunkWidth;
      startsNewLine = false;
    }
    return chunks;
  }

  let chunkText = "";
  let chunkWidth = 0;
  let existingLineHasContent = firstLineHasContent;
  const flushChunk = () => {
    if (chunkText.length === 0) {
      return;
    }
    chunks.push({ startsNewLine, text: chunkText, width: chunkWidth });
    chunkText = "";
    chunkWidth = 0;
    startsNewLine = false;
  };

  const initialRemaining = remaining;
  const appendCluster = (cluster: string, clusterWidth: number) => {
    if (clusterWidth > remaining) {
      const rowAlreadyStarted =
        existingLineHasContent || remaining < fullWidth || chunkText.length > 0;
      flushChunk();
      remaining = fullWidth;
      startsNewLine = rowAlreadyStarted;
      existingLineHasContent = false;

      if (clusterWidth > fullWidth) {
        if (rowAlreadyStarted) {
          chunks.push({ startsNewLine: true, text: "", width: 0 });
        }
        startsNewLine = false;
        return true;
      }
    }

    chunkText += cluster;
    chunkWidth += clusterWidth;
    remaining -= clusterWidth;
    return true;
  };

  let simpleScalars = true;
  for (const scalar of safeText) {
    const codePoint = scalar.codePointAt(0) ?? 0;
    if (scalarRequiresGraphemeComposition(scalar, codePoint)) {
      simpleScalars = false;
      break;
    }
    if (
      // biome-ignore lint/suspicious/noUnnecessaryConditions: always true, kept for future flexibility
      !appendCluster(scalar, eastAsianWidth(codePoint))
    ) {
      flushChunk();
      return chunks;
    }
  }
  if (simpleScalars) {
    flushChunk();
    return chunks;
  }

  // Discard the speculative scalar chunks and preserve exact grapheme behavior for complex text.
  chunks.length = 0;
  remaining = initialRemaining;
  startsNewLine = false;
  chunkText = "";
  existingLineHasContent = firstLineHasContent;
  chunkWidth = 0;
  for (const cluster of textClusters(safeText)) {
    if (
      // biome-ignore lint/suspicious/noUnnecessaryConditions: always true, kept for future flexibility
      !appendCluster(cluster, measureClusterWidth(cluster))
    ) {
      break;
    }
  }

  flushChunk();
  return chunks;
}

/** Slice text by terminal cells without splitting wide or combining clusters. */
export function sliceTextByWidth(text: string, offset: number, width: number) {
  return sliceSanitizedTextByWidth(sanitizeTerminalLine(text), offset, width);
}

/** Slice already-sanitized text without rescanning for terminal control sequences. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: slicing by width with grapheme-cluster awareness and east-asian width handling is inherently complex
export function sliceSanitizedTextByWidth(
  safeText: string,
  offset: number,
  width: number,
) {
  const startOffset = Math.max(0, offset);
  const maxWidth = Math.max(0, width);
  if (maxWidth === 0) {
    return { text: "", width: 0 };
  }

  if (printableAsciiRegex.test(safeText)) {
    const sliced = safeText.slice(startOffset, startOffset + maxWidth);
    return { text: sliced, width: sliced.length };
  }

  let scalarCursor = 0;
  let scalarUsedWidth = 0;
  let scalarVisibleText = "";
  let simpleScalars = true;
  for (const scalar of safeText) {
    const codePoint = scalar.codePointAt(0) ?? 0;
    if (scalarRequiresGraphemeComposition(scalar, codePoint)) {
      simpleScalars = false;
      break;
    }

    const scalarWidth = eastAsianWidth(codePoint);
    const scalarStart = scalarCursor;
    const scalarEnd = scalarCursor + scalarWidth;
    scalarCursor = scalarEnd;
    if (scalarEnd <= startOffset) {
      continue;
    }
    if (scalarStart < startOffset) {
      const hiddenCellWidth =
        Math.min(scalarEnd, startOffset + maxWidth) - startOffset;
      if (hiddenCellWidth > 0) {
        scalarVisibleText += " ".repeat(hiddenCellWidth);
        scalarUsedWidth += hiddenCellWidth;
      }
      continue;
    }
    if (scalarUsedWidth + scalarWidth > maxWidth) {
      return { text: scalarVisibleText, width: scalarUsedWidth };
    }

    scalarVisibleText += scalar;
    scalarUsedWidth += scalarWidth;
  }
  if (simpleScalars) {
    return { text: scalarVisibleText, width: scalarUsedWidth };
  }

  let cursor = 0;
  let usedWidth = 0;
  let visibleText = "";

  for (const cluster of textClusters(safeText)) {
    const clusterWidth = measureClusterWidth(cluster);
    const clusterStart = cursor;
    const clusterEnd = cursor + clusterWidth;
    cursor = clusterEnd;

    if (clusterEnd <= startOffset) {
      continue;
    }
    if (clusterStart < startOffset) {
      const hiddenCellWidth =
        Math.min(clusterEnd, startOffset + maxWidth) - startOffset;
      if (hiddenCellWidth > 0) {
        visibleText += " ".repeat(hiddenCellWidth);
        usedWidth += hiddenCellWidth;
      }
      continue;
    }
    if (usedWidth + clusterWidth > maxWidth) {
      break;
    }

    visibleText += cluster;
    usedWidth += clusterWidth;
  }

  return { text: visibleText, width: usedWidth };
}

export function cellRangeToCharRange(
  text: string,
  startCell: number,
  endCell: number,
) {
  const safeStartCell = Math.max(0, startCell);

  if (printableAsciiRegex.test(text)) {
    const startIndex = Math.min(text.length, safeStartCell);
    return {
      endIndex: Math.min(text.length, Math.max(startIndex, endCell + 1)),
      startIndex,
    };
  }

  let cellCursor = 0;
  let unitCursor = 0;
  let startIndex = -1;
  let endIndex = text.length;

  for (const cluster of textClusters(text)) {
    if (cellCursor > endCell) {
      endIndex = unitCursor;
      break;
    }

    const clusterWidth = measureClusterWidth(cluster);
    const coversStart =
      clusterWidth > 0
        ? cellCursor + clusterWidth > safeStartCell
        : cellCursor >= safeStartCell;
    if (startIndex < 0 && coversStart) {
      startIndex = unitCursor;
    }

    cellCursor += clusterWidth;
    unitCursor += cluster.length;
  }

  if (startIndex < 0) {
    startIndex = text.length;
  }

  return { endIndex: Math.max(startIndex, endIndex), startIndex };
}

/** Clamp text to a fixed width using a cell-aware overflow marker. */
export function fitText(text: string, width: number, overflowMarker = ".") {
  const safeText = sanitizeTerminalLine(text);
  if (width <= 0) {
    return "";
  }

  if (measureTextWidth(safeText) <= width) {
    return safeText;
  }

  const safeMarker = sanitizeTerminalLine(overflowMarker);
  const marker = sliceTextByWidth(safeMarker, 0, width);
  const textWidth = Math.max(0, width - marker.width);
  return `${sliceTextByWidth(safeText, 0, textWidth).text}${marker.text}`;
}

/** Clamp and then right-pad text to an exact width. */
export function padText(text: string, width: number) {
  const trimmed = fitText(text, width);
  return `${trimmed}${" ".repeat(Math.max(0, width - measureTextWidth(trimmed)))}`;
}
