import { Fragment, isValidElement, memo, type ReactNode } from "react";
import { parseColor, StyledText, type TextChunk } from "@opentui/core";

import { reviewGapId } from "../../../patch/gap";
import type { AppTheme } from "../../theme/resolve";
import {
  type ReviewEmptyDiffReason,
  reviewEmptyDiffReason,
} from "../review/document";
import {
  resolveSplitCellGeometry,
  resolveSplitPaneWidths,
  resolveStackCellGeometry,
} from "./codeColumns";
import {
  applyLineHighlightsToSpans,
  type LineHighlightPaintIndex,
  lineHighlightPaintKey,
} from "./lineHighlightPaint";
import type {
  DiffRow,
  RenderSpan,
  SplitLineCell,
  StackLineCell,
} from "./pierre";
import {
  cursorLineHighlightBg,
  diffRailMarker,
  dimRailColor,
  lineHighlightToneStyle,
  neutralRailColor,
  selectionHighlightBg,
  splitCellPalette,
  splitGutterText,
  splitLeftRailColor,
  splitRightRailColor,
  stackCellPalette,
  stackGutterText,
  stackRailColor,
  visualSelectHighlightBg,
} from "./rowStyle";
import { sanitizeTerminalLine, sanitizeTerminalSpans } from "./terminalText";
import {
  isPrintableAsciiText,
  measureSanitizedTextWidth,
  measureSimpleSanitizedTextWidth,
  measureTextWidth,
  sliceSanitizedTextByWidth,
  sliceTextByWidth,
  textClusters,
  wrapSanitizedTextByWidth,
} from "./text";
import type { CursorLine, DiffFile } from "./types";

type CopySelectedRowRange = {
  endCol: number;
  startCol: number;
};

export type CursorHighlight = {
  /** Which half of a split row the cursor sits on, and where a note would anchor. */
  side: "old" | "new";
  /** The render plan anchor of the row the cursor rests on, shared with reveal lookups. */
  stableKey: string;
  style: Exclude<CursorLine, "off">;
};

type RowHighlight = {
  bg: (baseBg: string) => string;
  /** Global columns to blend; absent blends the gutter alone. */
  colRange?: CopySelectedRowRange;
};

/** Column span covering a row's whole content column, in the global columns selection uses. */
const FULL_ROW_COL_RANGE: CopySelectedRowRange = {
  endCol: Number.MAX_SAFE_INTEGER,
  startCol: 0,
};

/** Clamp a label to one terminal row with an ellipsis. */
export function fitText(text: string, width: number) {
  const safeText = sanitizeTerminalLine(text);
  if (width <= 0) {
    return "";
  }

  if (measureSanitizedTextWidth(safeText) <= width) {
    return safeText;
  }

  if (width === 1) {
    return "…";
  }

  return `${sliceSanitizedTextByWidth(safeText, 0, width - 1).text}…`;
}

/** Append a styled span while preserving color-run coalescing. */
function appendRenderSpan(target: RenderSpan[], span: RenderSpan) {
  const previous = target.at(-1);
  if (previous && previous.fg === span.fg && previous.bg === span.bg) {
    previous.text += span.text;
  } else {
    target.push(span);
  }
}

/** Return the first or last scalar in one non-empty string. */
function boundaryScalar(text: string, first: boolean) {
  if (first) {
    const codePoint = text.codePointAt(0);
    return codePoint === undefined ? "" : String.fromCodePoint(codePoint);
  }

  let scalar = "";
  for (const candidate of text) {
    scalar = candidate;
  }
  return scalar;
}

/** Return whether a styled-span boundary may divide one grapheme cluster. */
function spansMaySplitGrapheme(spans: RenderSpan[]) {
  for (let index = 1; index < spans.length; index += 1) {
    const left = boundaryScalar(spans[index - 1]?.text ?? "", false);
    const right = boundaryScalar(spans[index]?.text ?? "", true);
    if (
      (left && measureSimpleSanitizedTextWidth(left) === null) ||
      (right && measureSimpleSanitizedTextWidth(right) === null)
    ) {
      return true;
    }
  }
  return false;
}

/** Merge indivisible graphemes while preserving the style where each cluster starts. */
function mergeCrossSpanGraphemes(spans: RenderSpan[]) {
  const normalized: RenderSpan[] = [];
  const text = spans.map((span) => span.text).join("");
  let sourceIndex = 0;
  let sourceEnd = spans[0]?.text.length ?? 0;
  let cursor = 0;

  for (const cluster of textClusters(text)) {
    while (cursor >= sourceEnd && sourceIndex < spans.length - 1) {
      sourceIndex += 1;
      sourceEnd += spans[sourceIndex]?.text.length ?? 0;
    }
    const source = spans[sourceIndex];
    if (source) {
      appendRenderSpan(normalized, { ...source, text: cluster });
    }
    cursor += cluster.length;
  }
  return normalized;
}

/** Merge only indivisible graphemes that may cross styled-span boundaries. */
function preserveCrossSpanGraphemes(spans: RenderSpan[]) {
  return spansMaySplitGrapheme(spans) ? mergeCrossSpanGraphemes(spans) : spans;
}

/** Slice styled spans to one visible window while preserving color runs. */
function sliceSpansWindow(spans: RenderSpan[], offset: number, width: number) {
  if (width <= 0) {
    return {
      spans: [] as RenderSpan[],
      usedWidth: 0,
    };
  }

  const sliced: RenderSpan[] = [];
  let remainingOffset = Math.max(0, offset);
  let remaining = width;
  let usedWidth = 0;

  for (const span of spans) {
    if (remaining <= 0) {
      break;
    }

    const spanWidth = measureSanitizedTextWidth(span.text);
    if (spanWidth === 0) {
      appendRenderSpan(sliced, { ...span });
      continue;
    }

    if (remainingOffset >= spanWidth) {
      remainingOffset -= spanWidth;
      continue;
    }

    if (remainingOffset === 0 && spanWidth <= remaining) {
      appendRenderSpan(sliced, { ...span });
      remaining -= spanWidth;
      usedWidth += spanWidth;
      continue;
    }

    const visible = sliceSanitizedTextByWidth(
      span.text,
      remainingOffset,
      remaining,
    );
    remainingOffset = 0;

    if (visible.text.length === 0) {
      continue;
    }

    const nextSpan = {
      ...span,
      text: visible.text,
    };

    appendRenderSpan(sliced, nextSpan);

    remaining -= visible.width;
    usedWidth += visible.width;
  }

  return {
    spans: sliced,
    usedWidth,
  };
}

const marker = diffRailMarker;
const styledTextColorCache = new Map<string, ReturnType<typeof parseColor>>();

/** Resolve one OpenTUI color while reusing immutable parsed theme values. */
function styledTextColor(value: string | undefined) {
  if (!value) {
    return;
  }
  let parsed = styledTextColorCache.get(value);
  if (!parsed) {
    parsed = parseColor(value);
    styledTextColorCache.set(value, parsed);
  }
  return parsed;
}

/** Convert a React span fragment into OpenTUI's direct styled-text run list. */
function styledTextFromSpanNodes(nodes: ReactNode[]) {
  const chunks: TextChunk[] = [];
  const collect = (node: ReactNode, fg?: string, bg?: string) => {
    if (node === null || node === undefined || typeof node === "boolean") {
      return;
    }
    if (typeof node === "string" || typeof node === "number") {
      chunks.push({
        __isChunk: true,
        bg: styledTextColor(bg),
        fg: styledTextColor(fg),
        text: String(node),
      });
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) {
        collect(child, fg, bg);
      }
      return;
    }
    if (
      !isValidElement<{ children?: ReactNode; fg?: string; bg?: string }>(node)
    ) {
      return;
    }
    if (node.type === Fragment) {
      collect(node.props.children, fg, bg);
      return;
    }
    if (node.type === "span") {
      collect(node.props.children, node.props.fg ?? fg, node.props.bg ?? bg);
    }
  };

  collect(nodes);
  return new StyledText(chunks);
}

/** Append a fixed-width inline span plan directly to StyledText chunks. */
function appendFixedInlineChunks(
  chunks: TextChunk[],
  spans: RenderSpan[],
  width: number,
  fallbackColor: string,
  fallbackBg: string,
  highlightBg?: (baseBg: string) => string,
) {
  const { spans: trimmed, usedWidth } = sliceSpansWindow(spans, 0, width);
  const renderedBackground = (background: string) =>
    highlightBg ? highlightBg(background) : background;
  const paddingAmount = Math.max(0, width - usedWidth);
  const lastSpan = trimmed.at(-1);
  let paddingMerged = false;
  if (
    paddingAmount > 0 &&
    lastSpan &&
    (lastSpan.fg ?? fallbackColor) === fallbackColor &&
    (lastSpan.bg ?? fallbackBg) === fallbackBg
  ) {
    lastSpan.text += " ".repeat(paddingAmount);
    paddingMerged = true;
  }

  for (const span of trimmed) {
    chunks.push({
      __isChunk: true,
      bg: styledTextColor(renderedBackground(span.bg ?? fallbackBg)),
      fg: styledTextColor(span.fg ?? fallbackColor),
      text: span.text,
    });
  }
  if (!paddingMerged && paddingAmount > 0) {
    chunks.push({
      __isChunk: true,
      bg: styledTextColor(renderedBackground(fallbackBg)),
      fg: styledTextColor(fallbackColor),
      text: " ".repeat(paddingAmount),
    });
  }
}

/** Report whether a wrapped highlight can paint existing chunks without slicing token spans. */
function isChunkCompatibleWrappedHighlight(
  highlight: RowHighlight | undefined,
) {
  return !highlight?.colRange || highlight.colRange === FULL_ROW_COL_RANGE;
}

/** Append one wrapped cell without constructing intermediate React span elements. */
function appendWrappedCellChunks(
  chunks: TextChunk[],
  line: WrappedCellLine,
  palette: { numberColor: string; gutterBg: string; contentBg: string },
  contentWidth: number,
  theme: AppTheme,
  prefix: { text: string; fg: string; bg: string },
  highlight?: RowHighlight,
) {
  const renderedBackground = (background: string) =>
    highlight ? highlight.bg(background) : background;
  const contentHighlightBg =
    highlight?.colRange === FULL_ROW_COL_RANGE ? highlight.bg : undefined;
  chunks.push(
    {
      __isChunk: true,
      bg: styledTextColor(renderedBackground(prefix.bg)),
      fg: styledTextColor(prefix.fg),
      text: prefix.text,
    },
    {
      __isChunk: true,
      bg: styledTextColor(renderedBackground(palette.gutterBg)),
      fg: styledTextColor(palette.numberColor),
      text: line.gutterText,
    },
  );
  appendFixedInlineChunks(
    chunks,
    line.spans,
    contentWidth,
    theme.syntaxColors.default,
    palette.contentBg,
    contentHighlightBg,
  );
}

/** Render a fixed-width inline span sequence for one diff cell. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: renderInlineSpans manages selection-highlight blending, split-at-char boundaries, and cross-span grapheme preservation — the complexity is the rendering algorithm
function renderInlineSpans(
  spans: RenderSpan[],
  width: number,
  fallbackColor: string,
  fallbackBg: string,
  keyPrefix: string,
  horizontalOffset = 0,
  highlightBg?: (baseBg: string) => string,
  selectionColRange?: { start: number; end: number },
  spansAreSanitized = false,
) {
  const { spans: trimmed, usedWidth } = sliceSpansWindow(
    spansAreSanitized ? spans : sanitizeTerminalSpans(spans),
    horizontalOffset,
    width,
  );
  // A whole-row cursor covers this complete rendered window, so it can recolor each existing span
  // directly. Treating it like a partial copy selection would remeasure and split every token — a
  // particularly expensive duplicate width pass for long wrapped CJK lines.
  const fullHighlightBg =
    highlightBg &&
    selectionColRange &&
    selectionColRange.start <= 0 &&
    selectionColRange.end >= width
      ? highlightBg
      : undefined;
  const needsBlending = !fullHighlightBg && highlightBg && selectionColRange;
  const renderedBackground = (background: string) =>
    fullHighlightBg ? fullHighlightBg(background) : background;
  const paddingAmount = Math.max(0, width - usedWidth);
  let paddingMerged = false;
  const lastSpan = trimmed.at(-1);
  if (
    !needsBlending &&
    paddingAmount > 0 &&
    lastSpan &&
    (lastSpan.fg ?? fallbackColor) === fallbackColor &&
    (lastSpan.bg ?? fallbackBg) === fallbackBg
  ) {
    // sliceSpansWindow always returns owned span objects, so padding can share the final native node.
    lastSpan.text += " ".repeat(paddingAmount);
    paddingMerged = true;
  }

  // Build the final element list by splitting spans at selection boundaries so the highlight
  // applies at character-level precision rather than whole-token granularity.
  const elements: ReactNode[] = [];
  let colPos = 0;
  let elementIndex = 0;

  for (const span of trimmed) {
    if (!needsBlending) {
      const spanKey = elementIndex;
      elementIndex += 1;
      elements.push(
        <span
          bg={renderedBackground(span.bg ?? fallbackBg)}
          fg={span.fg ?? fallbackColor}
          key={`${keyPrefix}:${spanKey}`}
        >
          {span.text}
        </span>,
      );
      continue;
    }

    const spanWidth = measureTextWidth(span.text);
    const spanStart = colPos;
    const spanEnd = colPos + spanWidth;
    colPos = spanEnd;

    if (
      spanEnd <= selectionColRange.start ||
      spanStart >= selectionColRange.end
    ) {
      // Span is entirely outside the selection — render with original styling.
      const spanKeyOuter = elementIndex;
      elementIndex += 1;
      elements.push(
        <span
          bg={span.bg ?? fallbackBg}
          fg={span.fg ?? fallbackColor}
          key={`${keyPrefix}:${spanKeyOuter}`}
        >
          {span.text}
        </span>,
      );
      continue;
    }

    // Compute the split offsets within this span's text.
    const localSelStart = Math.max(0, selectionColRange.start - spanStart);
    const localSelEnd = Math.min(spanWidth, selectionColRange.end - spanStart);

    if (localSelStart >= localSelEnd) {
      // No overlap after clamping — render original.
      const spanKeyNoOverlap = elementIndex;
      elementIndex += 1;
      elements.push(
        <span
          bg={span.bg ?? fallbackBg}
          fg={span.fg ?? fallbackColor}
          key={`${keyPrefix}:${spanKeyNoOverlap}`}
        >
          {span.text}
        </span>,
      );
      continue;
    }

    // Split the span at selection boundaries for character-level precision.
    const prefix = sliceTextByWidth(span.text, 0, localSelStart).text;
    const selected = sliceTextByWidth(
      span.text,
      localSelStart,
      localSelEnd - localSelStart,
    ).text;
    const suffix = sliceTextByWidth(
      span.text,
      localSelEnd,
      spanWidth - localSelEnd,
    ).text;

    if (prefix) {
      const spanKeyPrefix = elementIndex;
      elementIndex += 1;
      elements.push(
        <span
          bg={span.bg ?? fallbackBg}
          fg={span.fg ?? fallbackColor}
          key={`${keyPrefix}:${spanKeyPrefix}`}
        >
          {prefix}
        </span>,
      );
    }
    if (selected) {
      const spanKeySelected = elementIndex;
      elementIndex += 1;
      elements.push(
        <span
          bg={highlightBg(span.bg ?? fallbackBg)}
          fg={span.fg ?? fallbackColor}
          key={`${keyPrefix}:${spanKeySelected}`}
        >
          {selected}
        </span>,
      );
    }
    if (suffix) {
      const spanKeySuffix = elementIndex;
      elementIndex += 1;
      elements.push(
        <span
          bg={span.bg ?? fallbackBg}
          fg={span.fg ?? fallbackColor}
          key={`${keyPrefix}:${spanKeySuffix}`}
        >
          {suffix}
        </span>,
      );
    }
  }

  // Trailing padding after all spans.
  if (needsBlending) {
    // Compute how much of the padding falls within the selection.
    // The padding starts at colPos (which is now the terminal-cell width consumed by
    // the rendered spans) and extends to `width`.
    const padStart = colPos;
    const padEnd = colPos + Math.max(0, width - usedWidth);
    if (paddingAmount > 0) {
      if (
        padStart < selectionColRange.end &&
        padEnd > selectionColRange.start
      ) {
        // Split padding into outside/before, selected, and after.
        const beforeSel = Math.max(0, selectionColRange.start - padStart);
        const inSel =
          Math.min(paddingAmount, selectionColRange.end - padStart) -
          Math.max(0, beforeSel);
        const afterSel = paddingAmount - beforeSel - Math.max(0, inSel);

        if (beforeSel > 0) {
          elements.push(
            <span
              bg={fallbackBg}
              fg={fallbackColor}
              key={`${keyPrefix}:pad-before`}
            >
              {" ".repeat(beforeSel)}
            </span>,
          );
        }
        if (inSel > 0) {
          elements.push(
            <span
              bg={highlightBg(fallbackBg)}
              fg={fallbackColor}
              key={`${keyPrefix}:pad-sel`}
            >
              {" ".repeat(inSel)}
            </span>,
          );
        }
        if (afterSel > 0) {
          elements.push(
            <span
              bg={fallbackBg}
              fg={fallbackColor}
              key={`${keyPrefix}:pad-after`}
            >
              {" ".repeat(afterSel)}
            </span>,
          );
        }
      } else {
        elements.push(
          <span bg={fallbackBg} fg={fallbackColor} key={`${keyPrefix}:pad`}>
            {" ".repeat(paddingAmount)}
          </span>,
        );
      }
    }
  } else if (!paddingMerged && paddingAmount > 0) {
    // Keep a separate padding span when the final content style differs from the cell fallback.
    elements.push(
      <span
        bg={renderedBackground(fallbackBg)}
        fg={fallbackColor}
        key={`${keyPrefix}:pad`}
      >
        {" ".repeat(paddingAmount)}
      </span>,
    );
  }

  return <>{elements}</>;
}

type WrappedCellLine = {
  gutterText: string;
  spans: RenderSpan[];
};

type WrappedCellLayout = {
  contentWidth: number;
  gutterWidth: number;
  lines: WrappedCellLine[];
  palette:
    | ReturnType<typeof splitCellPalette>
    | ReturnType<typeof stackCellPalette>;
};

// Repeated offset slicing is faster for short spans, while its repeated grapheme traversal turns
// quadratic once one span crosses many visual lines. Switch only where the linear planner wins
// decisively so ordinary wrapped and nowrap text retain their established fast paths.
const SINGLE_PASS_WRAP_LINE_THRESHOLD = 8;

/** Wrap styled spans into visual lines while preserving color runs across splits. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: wrapSpans handles grapheme-cluster-aware line breaking with color-run coalescing — the wrapping algorithm is inherently complex
function wrapSpans(spans: RenderSpan[], width: number) {
  if (width <= 0) {
    return [[]] as RenderSpan[][];
  }

  const lines: RenderSpan[][] = [[]];
  // biome-ignore lint/style/noNonNullAssertion: lines initialized with one element
  let current = lines[0]!;
  let remaining = width;
  const safeSpans = sanitizeTerminalSpans(spans);
  let plannedSpans = safeSpans;
  let hasCompositionSensitiveSpan = false;
  let simpleSpanWidths: Array<number | null> = [];
  for (const span of safeSpans) {
    const spanWidth = measureSimpleSanitizedTextWidth(span.text);
    simpleSpanWidths.push(spanWidth);
    hasCompositionSensitiveSpan ||= spanWidth === null;
  }
  if (safeSpans.length > 1 && hasCompositionSensitiveSpan) {
    plannedSpans = mergeCrossSpanGraphemes(safeSpans);
    simpleSpanWidths = plannedSpans.map((span) =>
      measureSimpleSanitizedTextWidth(span.text),
    );
  }

  for (let spanIndex = 0; spanIndex < plannedSpans.length; spanIndex += 1) {
    // biome-ignore lint/style/noNonNullAssertion: spanIndex is in bounds
    const span = plannedSpans[spanIndex]!;
    const simpleSpanWidth = simpleSpanWidths[spanIndex] ?? null;
    const spanWidth = simpleSpanWidth ?? measureSanitizedTextWidth(span.text);
    if (spanWidth === 0) {
      appendRenderSpan(current, { ...span });
      continue;
    }

    if (
      spanWidth > width * SINGLE_PASS_WRAP_LINE_THRESHOLD ||
      simpleSpanWidth === null ||
      (width === 1 && !isPrintableAsciiText(span.text))
    ) {
      for (const chunk of wrapSanitizedTextByWidth(
        span.text,
        width,
        remaining,
        current.length > 0,
      )) {
        if (chunk.startsNewLine) {
          current = [];
          lines.push(current);
          remaining = width;
        }
        if (chunk.text.length > 0) {
          appendRenderSpan(current, { ...span, text: chunk.text });
        }
        remaining -= chunk.width;
      }
      continue;
    }

    let offset = 0;

    while (offset < spanWidth) {
      if (remaining <= 0) {
        current = [];
        lines.push(current);
        remaining = width;
      }

      const visible = sliceSanitizedTextByWidth(span.text, offset, remaining);
      if (visible.width === 0) {
        // Move to a fresh row only when this row already contains content. If the full row itself
        // is too narrow, keep the single attempted continuation aligned with geometry measurement.
        if (current.length > 0 || remaining < width) {
          current = [];
          lines.push(current);
          remaining = width;
        }
        const forced = sliceSanitizedTextByWidth(span.text, offset, width);
        if (forced.width === 0) {
          break;
        }
        const nextSpan = {
          ...span,
          text: forced.text,
        };
        current.push(nextSpan);
        offset += forced.width;
        remaining = Math.max(0, width - forced.width);
        continue;
      }

      const nextSpan = {
        ...span,
        text: visible.text,
      };
      appendRenderSpan(current, nextSpan);

      offset += visible.width;
      remaining -= visible.width;
    }
  }

  return lines;
}

/** Count wrapped visual lines without allocating the styled line arrays used by rendering. */
function measureWrappedSpansLineCount(spans: RenderSpan[], width: number) {
  if (width <= 0) {
    return 1;
  }

  let lineCount = 1;
  let remaining = width;
  let currentLineHasContent = false;
  const safeSpans = preserveCrossSpanGraphemes(sanitizeTerminalSpans(spans));
  for (const span of safeSpans) {
    // Preserve zero-width span presence across styled runs so a later over-wide grapheme makes the
    // same continuation decision as wrapSpans' concrete line arrays.
    for (const chunk of wrapSanitizedTextByWidth(
      span.text,
      width,
      remaining,
      currentLineHasContent,
    )) {
      if (chunk.startsNewLine) {
        lineCount += 1;
        remaining = width;
        currentLineHasContent = false;
      }
      remaining -= chunk.width;
      currentLineHasContent ||= chunk.text.length > 0;
    }
  }
  return lineCount;
}

/** Build wrapped split-cell gutter/content lines while keeping continuation gutters blank. */
function buildWrappedSplitCell(
  cell: SplitLineCell,
  width: number,
  lineNumberDigits: number,
  showLineNumbers: boolean,
  prefixWidth: number,
  theme: AppTheme,
  showSign = false,
) {
  const palette = splitCellPalette(cell.kind, theme);
  const { gutterWidth, contentWidth } = resolveSplitCellGeometry(
    width,
    lineNumberDigits,
    showLineNumbers,
    prefixWidth,
    showSign,
  );
  const firstGutterText = splitGutterText(
    cell,
    lineNumberDigits,
    showLineNumbers,
    showSign,
  ).padEnd(gutterWidth);
  const wrappedSpans = wrapSpans(cell.spans, contentWidth);

  return {
    contentWidth,
    gutterWidth,
    lines: wrappedSpans.map((spans, index) => ({
      gutterText: index === 0 ? firstGutterText : " ".repeat(gutterWidth),
      spans,
    })),
    palette,
  } satisfies WrappedCellLayout;
}

/** Build wrapped stack-cell gutter/content lines while keeping continuation gutters blank. */
function buildWrappedStackCell(
  cell: StackLineCell,
  width: number,
  lineNumberDigits: number,
  showLineNumbers: boolean,
  prefixWidth: number,
  theme: AppTheme,
  showSign = false,
) {
  const palette = stackCellPalette(cell.kind, theme);
  const { gutterWidth, contentWidth } = resolveStackCellGeometry(
    width,
    lineNumberDigits,
    showLineNumbers,
    prefixWidth,
    showSign,
  );
  const firstGutterText = stackGutterText(
    cell,
    lineNumberDigits,
    showLineNumbers,
    showSign,
  ).padEnd(gutterWidth);
  const wrappedSpans = wrapSpans(cell.spans, contentWidth);

  return {
    contentWidth,
    gutterWidth,
    lines: wrappedSpans.map((spans, index) => ({
      gutterText: index === 0 ? firstGutterText : " ".repeat(gutterWidth),
      spans,
    })),
    palette,
  } satisfies WrappedCellLayout;
}

/**
 * Apply a highlight blend to a cell palette's gutter bg only.
 *
 * The content bg is intentionally left untouched here so renderInlineSpans can apply the same
 * blend uniformly across every rendered span (including syntax-emphasis spans that supply their
 * own bg). Pre-blending contentBg would cause the fallback path to double-blend.
 */
function applyHighlightPalette<
  P extends { gutterBg: string; contentBg: string },
>(palette: P, highlightBg: (baseBg: string) => string): P {
  return {
    ...palette,
    gutterBg: highlightBg(palette.gutterBg),
  };
}

/**
 * Choose which highlight paints one half of a row.
 *
 * An active drag outranks the resting cursor, so copy selection keeps its exact extent.
 * The visual-select highlight fills rows not covered by either copy selection or the cursor.
 */
function pickRowHighlight(
  selection: RowHighlight,
  cursor: RowHighlight | undefined,
  hasSelection: boolean,
  onCursor: boolean,
  visualSelect?: RowHighlight,
) {
  if (hasSelection) {
    return selection;
  }
  if (visualSelect) {
    return visualSelect;
  }
  return onCursor ? cursor : undefined;
}

/** Apply a highlight blend to a prefix descriptor. */
function applyHighlightPrefix<P extends { bg: string }>(
  prefix: P,
  highlightBg: (baseBg: string) => string,
): P {
  return {
    ...prefix,
    bg: highlightBg(prefix.bg),
  };
}

/** Render one split-view cell as prefix + gutter + content spans. */
function renderSplitCell(
  cell: SplitLineCell,
  width: number,
  lineNumberDigits: number,
  showLineNumbers: boolean,
  theme: AppTheme,
  keyPrefix: string,
  contentOffset = 0,
  prefix?: {
    text: string;
    fg: string;
    bg: string;
  },
  highlight?: RowHighlight,
  paneOffset = 0,
  showSign = false,
) {
  const basePalette = splitCellPalette(cell.kind, theme, cell.moveKind);
  const palette = highlight
    ? applyHighlightPalette(basePalette, highlight.bg)
    : basePalette;
  const resolvedPrefix =
    highlight && prefix ? applyHighlightPrefix(prefix, highlight.bg) : prefix;
  const prefixWidth = resolvedPrefix?.text.length ?? 0;
  const { gutterWidth, contentWidth } = resolveSplitCellGeometry(
    width,
    lineNumberDigits,
    showLineNumbers,
    prefixWidth,
    showSign,
  );
  const gutterText = splitGutterText(
    cell,
    lineNumberDigits,
    showLineNumbers,
    showSign,
  ).padEnd(gutterWidth);

  // Convert global selection column range to content-local range.
  const globalContentStart = paneOffset + prefixWidth + gutterWidth;
  const colRange = highlight?.colRange;
  const localColRange =
    colRange && globalContentStart < colRange.endCol
      ? {
          end: Math.min(
            contentWidth,
            Math.max(0, colRange.endCol - globalContentStart + 1),
          ),
          start: Math.max(0, colRange.startCol - globalContentStart),
        }
      : undefined;

  return (
    <>
      {resolvedPrefix ? (
        <span
          bg={resolvedPrefix.bg}
          fg={resolvedPrefix.fg}
          key={`${keyPrefix}:prefix`}
        >
          {resolvedPrefix.text}
        </span>
      ) : null}
      <span
        bg={palette.gutterBg}
        fg={palette.numberColor}
        key={`${keyPrefix}:gutter`}
      >
        {gutterText}
      </span>
      {renderInlineSpans(
        cell.spans,
        contentWidth,
        theme.syntaxColors.default,
        palette.contentBg,
        `${keyPrefix}:content`,
        contentOffset,
        highlight?.bg,
        localColRange,
      )}
    </>
  );
}

/** Render one stack-view cell as prefix + combined gutter + content spans. */
function renderStackCell(
  cell: StackLineCell,
  width: number,
  lineNumberDigits: number,
  showLineNumbers: boolean,
  theme: AppTheme,
  keyPrefix: string,
  contentOffset = 0,
  prefix?: {
    text: string;
    fg: string;
    bg: string;
  },
  highlight?: RowHighlight,
  showSign = false,
) {
  const basePalette = stackCellPalette(cell.kind, theme, cell.moveKind);
  const palette = highlight
    ? applyHighlightPalette(basePalette, highlight.bg)
    : basePalette;
  const resolvedPrefix =
    highlight && prefix ? applyHighlightPrefix(prefix, highlight.bg) : prefix;
  const prefixWidth = resolvedPrefix?.text.length ?? 0;
  const { gutterWidth, contentWidth } = resolveStackCellGeometry(
    width,
    lineNumberDigits,
    showLineNumbers,
    prefixWidth,
    showSign,
  );

  // Convert global selection column range to content-local range.
  const globalContentStart = prefixWidth + gutterWidth;
  const colRange = highlight?.colRange;
  const localColRange =
    colRange && globalContentStart < colRange.endCol
      ? {
          end: Math.min(
            contentWidth,
            Math.max(0, colRange.endCol - globalContentStart + 1),
          ),
          start: Math.max(0, colRange.startCol - globalContentStart),
        }
      : undefined;

  return (
    <>
      {resolvedPrefix ? (
        <span
          bg={resolvedPrefix.bg}
          fg={resolvedPrefix.fg}
          key={`${keyPrefix}:prefix`}
        >
          {resolvedPrefix.text}
        </span>
      ) : null}
      <span
        bg={palette.gutterBg}
        fg={palette.numberColor}
        key={`${keyPrefix}:gutter`}
      >
        {stackGutterText(
          cell,
          lineNumberDigits,
          showLineNumbers,
          showSign,
        ).padEnd(gutterWidth)}
      </span>
      {renderInlineSpans(
        cell.spans,
        contentWidth,
        theme.syntaxColors.default,
        palette.contentBg,
        `${keyPrefix}:content`,
        contentOffset,
        highlight?.bg,
        localColRange,
      )}
    </>
  );
}

/** Render one already-wrapped split cell line with its persistent rail/separator prefix. */
function renderWrappedSplitCellLine(
  line: WrappedCellLine,
  palette: ReturnType<typeof splitCellPalette>,
  contentWidth: number,
  theme: AppTheme,
  keyPrefix: string,
  prefix: {
    text: string;
    fg: string;
    bg: string;
  },
  highlight?: RowHighlight,
  paneOffset = 0,
) {
  const resolvedPalette = highlight
    ? applyHighlightPalette(palette, highlight.bg)
    : palette;
  const resolvedPrefix = highlight
    ? applyHighlightPrefix(prefix, highlight.bg)
    : prefix;

  const prefixWidth = prefix.text.length;
  const gutterWidth = line.gutterText.length;
  const globalContentStart = paneOffset + prefixWidth + gutterWidth;
  const colRange = highlight?.colRange;
  const localColRange =
    colRange && globalContentStart < colRange.endCol
      ? {
          end: Math.min(
            contentWidth,
            Math.max(0, colRange.endCol - globalContentStart + 1),
          ),
          start: Math.max(0, colRange.startCol - globalContentStart),
        }
      : undefined;

  return (
    <>
      <span
        bg={resolvedPrefix.bg}
        fg={resolvedPrefix.fg}
        key={`${keyPrefix}:prefix`}
      >
        {resolvedPrefix.text}
      </span>
      <span
        bg={resolvedPalette.gutterBg}
        fg={resolvedPalette.numberColor}
        key={`${keyPrefix}:gutter`}
      >
        {line.gutterText}
      </span>
      {renderInlineSpans(
        line.spans,
        contentWidth,
        theme.syntaxColors.default,
        resolvedPalette.contentBg,
        `${keyPrefix}:content`,
        0,
        highlight?.bg,
        localColRange,
        true,
      )}
    </>
  );
}

/** Render one already-wrapped stack cell line with its persistent rail prefix. */
function renderWrappedStackCellLine(
  line: WrappedCellLine,
  palette: ReturnType<typeof stackCellPalette>,
  contentWidth: number,
  theme: AppTheme,
  keyPrefix: string,
  prefix: {
    text: string;
    fg: string;
    bg: string;
  },
  highlight?: RowHighlight,
) {
  const resolvedPalette = highlight
    ? applyHighlightPalette(palette, highlight.bg)
    : palette;
  const resolvedPrefix = highlight
    ? applyHighlightPrefix(prefix, highlight.bg)
    : prefix;

  const prefixWidth = prefix.text.length;
  const gutterWidth = line.gutterText.length;
  const globalContentStart = prefixWidth + gutterWidth;
  const colRange = highlight?.colRange;
  const localColRange =
    colRange && globalContentStart < colRange.endCol
      ? {
          end: Math.min(
            contentWidth,
            Math.max(0, colRange.endCol - globalContentStart + 1),
          ),
          start: Math.max(0, colRange.startCol - globalContentStart),
        }
      : undefined;

  return (
    <>
      <span
        bg={resolvedPrefix.bg}
        fg={resolvedPrefix.fg}
        key={`${keyPrefix}:prefix`}
      >
        {resolvedPrefix.text}
      </span>
      <span
        bg={resolvedPalette.gutterBg}
        fg={resolvedPalette.numberColor}
        key={`${keyPrefix}:gutter`}
      >
        {line.gutterText}
      </span>
      {renderInlineSpans(
        line.spans,
        contentWidth,
        theme.syntaxColors.default,
        resolvedPalette.contentBg,
        `${keyPrefix}:content`,
        0,
        highlight?.bg,
        localColRange,
        true,
      )}
    </>
  );
}

/** Review-stream wording for each shared reason a file renders no diff rows. */
export const DIFF_MESSAGES: Record<ReviewEmptyDiffReason, string> = {
  binary: "Binary file skipped",
  "deleted-file": "No textual hunks. The file is marked as deleted.",
  "new-file": "No textual hunks. The file is marked as new.",
  "no-hunks": "No textual hunks to render for this file.",
  "rename-only": "No textual hunks. This change only renames the file.",
  "too-large": "File too large to render automatically.",
};

/** Explain why a file still appears in the review stream even when it has no textual hunks. */
export function diffMessage(file: DiffFile) {
  return DIFF_MESSAGES[
    reviewEmptyDiffReason({
      binary: Boolean(file.isBinary),
      changeKind: file.metadata.type,
      tooLarge: Boolean(file.isTooLarge),
    })
  ];
}

/** Build the rendered label text for one collapsed gap row. */
function collapsedRowLabel(text: string, expandable: boolean) {
  if (!expandable) {
    return `··· ${text} ···`;
  }

  // The leading chevron hints that the row is interactive on terminals that
  // render Unicode glyphs. The label still reads naturally on plain VT100.
  return `▾ ${text}`;
}

/** Render collapsed and hunk-header rows. */
function renderHeaderRow(
  row: Extract<DiffRow, { type: "collapsed" | "hunk-header" }>,
  width: number,
  theme: AppTheme,
  selected: boolean,
  anchorId?: string,
  onHoverRow?: (rowKey: string) => void,
  onToggleGap?: (gapKey: string) => void,
) {
  const collapsedExpandable = row.type === "collapsed" && Boolean(onToggleGap);
  const labelText =
    row.type === "collapsed"
      ? collapsedRowLabel(row.text, collapsedExpandable)
      : row.text;
  const label = fitText(labelText, Math.max(0, width - 1));
  const handleCollapsedClick =
    row.type === "collapsed" && onToggleGap
      ? () => onToggleGap(reviewGapId(row.position, row.hunkIndex))
      : undefined;

  return (
    // biome-ignore lint/a11y/useKeyWithMouseEvents: keyboard handler provided by parent scrollbox
    <box
      id={anchorId}
      key={row.key}
      onMouseMove={() => onHoverRow?.(row.key)}
      onMouseOver={() => onHoverRow?.(row.key)}
      onMouseUp={handleCollapsedClick}
      style={{
        backgroundColor: theme.panelAlt,
        height: 1,
        width,
      }}
    >
      <text>
        <span
          bg={theme.panelAlt}
          fg={
            selected
              ? neutralRailColor(theme)
              : dimRailColor(neutralRailColor(theme), theme)
          }
        >
          {marker()}
        </span>
        <span
          bg={theme.panelAlt}
          fg={row.type === "collapsed" ? theme.muted : theme.badgeNeutral}
        >
          {label}
        </span>
      </text>
    </box>
  );
}

/** Measure how many terminal rows one rendered diff row occupies. */
export function measureRenderedRowHeight(
  row: DiffRow,
  width: number,
  lineNumberDigits: number,
  showLineNumbers: boolean,
  showHunkHeaders: boolean,
  wrapLines: boolean,
  _theme: AppTheme,
  showSign = false,
) {
  if (row.type === "hunk-header") {
    return showHunkHeaders ? 1 : 0;
  }

  if (row.type === "collapsed") {
    return 1;
  }

  if (row.type === "split-line") {
    if (!wrapLines) {
      return 1;
    }

    const markerWidth = 1;
    const { leftWidth, rightWidth } = resolveSplitPaneWidths(width);
    const leftGeometry = resolveSplitCellGeometry(
      leftWidth,
      lineNumberDigits,
      showLineNumbers,
      markerWidth,
      showSign,
    );
    const rightGeometry = resolveSplitCellGeometry(
      rightWidth,
      lineNumberDigits,
      showLineNumbers,
      markerWidth,
      showSign,
    );

    return Math.max(
      measureWrappedSpansLineCount(row.left.spans, leftGeometry.contentWidth),
      measureWrappedSpansLineCount(row.right.spans, rightGeometry.contentWidth),
    );
  }

  if (row.type !== "stack-line") {
    return 1;
  }

  if (!wrapLines) {
    return 1;
  }

  const cellGeometry = resolveStackCellGeometry(
    width,
    lineNumberDigits,
    showLineNumbers,
    marker().length,
    showSign,
  );
  return measureWrappedSpansLineCount(
    row.cell.spans,
    cellGeometry.contentWidth,
  );
}

/** Repaint one split cell's spans over its extension highlight ranges, if any. */
function withSplitCellLineHighlights(
  cell: SplitLineCell,
  side: "old" | "new",
  lineHighlights: LineHighlightPaintIndex,
  theme: AppTheme,
): SplitLineCell {
  if (cell.kind === "empty" || cell.lineNumber === undefined) {
    return cell;
  }
  const ranges = lineHighlights.get(
    lineHighlightPaintKey(side, cell.lineNumber),
  );
  if (!ranges) {
    return cell;
  }
  const { contentBg } = splitCellPalette(cell.kind, theme, cell.moveKind);
  return {
    ...cell,
    spans: applyLineHighlightsToSpans(cell.spans, ranges, (tone) =>
      lineHighlightToneStyle(tone, contentBg, theme),
    ),
  };
}

/**
 * Apply extension line highlights to one row's cells before rendering.
 *
 * Paint-time by design: text is never changed, so the returned row measures
 * and wraps identically to the original, and the shared row plan, geometry,
 * and highlighted-diff caches never see highlights at all. Cells are copied
 * because their span arrays are shared cached objects.
 */
function withRowLineHighlights(
  row: DiffRow,
  lineHighlights: LineHighlightPaintIndex | undefined,
  theme: AppTheme,
): DiffRow {
  if (!lineHighlights || lineHighlights.size === 0) {
    return row;
  }

  if (row.type === "split-line") {
    const left = withSplitCellLineHighlights(
      row.left,
      "old",
      lineHighlights,
      theme,
    );
    const right = withSplitCellLineHighlights(
      row.right,
      "new",
      lineHighlights,
      theme,
    );
    return left === row.left && right === row.right
      ? row
      : { ...row, left, right };
  }

  if (row.type === "stack-line") {
    const { cell } = row;
    // Context cells carry both numbers pointing at one merged range list, so
    // consulting the new side first never hides an old-side mark.
    const ranges =
      (cell.newLineNumber === undefined
        ? undefined
        : lineHighlights.get(
            lineHighlightPaintKey("new", cell.newLineNumber),
          )) ??
      (cell.oldLineNumber === undefined
        ? undefined
        : lineHighlights.get(lineHighlightPaintKey("old", cell.oldLineNumber)));
    if (!ranges) {
      return row;
    }
    const { contentBg } = stackCellPalette(cell.kind, theme, cell.moveKind);
    return {
      ...row,
      cell: {
        ...cell,
        spans: applyLineHighlightsToSpans(cell.spans, ranges, (tone) =>
          lineHighlightToneStyle(tone, contentBg, theme),
        ),
      },
    };
  }

  return row;
}

/** Render one diff row. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: renderRow handles split/stack/collapsed/hunk-header rows with cursor highlights, visual selection, copy selection, note guides, wrapping, and line highlights — the complexity is the rendering surface
function renderRow(
  sourceRow: DiffRow,
  width: number,
  lineNumberDigits: number,
  showLineNumbers: boolean,
  showHunkHeaders: boolean,
  wrapLines: boolean,
  codeHorizontalOffset: number,
  theme: AppTheme,
  selected: boolean,
  copySelectedRowRange: CopySelectedRowRange | undefined,
  copySelectedSide: "left" | "right" | undefined,
  cursorHighlight: CursorHighlight | undefined,
  lineHighlights: LineHighlightPaintIndex | undefined,
  anchorId?: string,
  noteGuideSide?: "old" | "new",
  onHoverRow?: (rowKey: string) => void,
  onToggleGap?: (gapKey: string) => void,
  showSign = false,
  visualSelect = false,
  commentMarked = false,
) {
  // Extension marks repaint span backgrounds only; geometry inputs keep using the source row.
  const row = withRowLineHighlights(sourceRow, lineHighlights, theme);
  const hasCopySelection = !!copySelectedRowRange;

  // For split rows, the user's drag is anchored to one column-half of the diff. Apply the
  // selection-highlight blend only to that side so it is clear which file (A or B) the
  // selection represents.
  const hasLeftSelection = hasCopySelection && copySelectedSide !== "right";
  const hasRightSelection = hasCopySelection && copySelectedSide !== "left";

  // A split context row shows the same source line on both halves, so marking one of them would
  // read as half a row. Change rows keep the split, since the halves are different note targets.
  const splitContextRow =
    row.type === "split-line" &&
    row.left.kind === "context" &&
    row.right.kind === "context";
  const onCursorRow = cursorHighlight !== undefined;
  const yellowRailLeft = (visualSelect || commentMarked) && !hasLeftSelection;
  const yellowRailRight = (visualSelect || commentMarked) && !hasRightSelection;
  const yellowRailStack = (visualSelect || commentMarked) && !hasCopySelection;
  const selectionHighlight: RowHighlight = {
    bg: (baseBg) => selectionHighlightBg(baseBg, theme),
    colRange: copySelectedRowRange,
  };
  const cursorRowHighlight: RowHighlight | undefined = onCursorRow
    ? {
        bg: (baseBg) => cursorLineHighlightBg(baseBg, theme),
        colRange:
          cursorHighlight.style === "row" ? FULL_ROW_COL_RANGE : undefined,
      }
    : undefined;
  const visualSelectHighlight: RowHighlight | undefined = visualSelect
    ? {
        bg: (baseBg) => visualSelectHighlightBg(baseBg, theme),
      }
    : undefined;
  const leftHighlight = pickRowHighlight(
    selectionHighlight,
    cursorRowHighlight,
    hasLeftSelection,
    onCursorRow && (splitContextRow || cursorHighlight.side === "old"),
    visualSelectHighlight,
  );
  const rightHighlight = pickRowHighlight(
    selectionHighlight,
    cursorRowHighlight,
    hasRightSelection,
    onCursorRow && (splitContextRow || cursorHighlight.side === "new"),
    visualSelectHighlight,
  );
  const cellHighlight = pickRowHighlight(
    selectionHighlight,
    cursorRowHighlight,
    hasCopySelection,
    onCursorRow,
    visualSelectHighlight,
  );
  let baseRow: ReactNode;

  if (row.type === "collapsed") {
    baseRow = renderHeaderRow(
      row,
      width,
      theme,
      selected || hasCopySelection,
      anchorId,
      onHoverRow,
      onToggleGap,
    );
  } else if (row.type === "hunk-header") {
    baseRow = showHunkHeaders
      ? renderHeaderRow(
          row,
          width,
          theme,
          selected || hasCopySelection,
          anchorId,
          onHoverRow,
        )
      : null;
  } else if (row.type === "split-line") {
    const guideOnOldSide = noteGuideSide === "old";
    const guideOnNewSide = noteGuideSide === "new";

    // Reserve fixed columns for the diff rails and center separator slot.
    const { leftWidth, rightWidth } = resolveSplitPaneWidths(width);
    const rightRenderWidth = Math.max(0, rightWidth - (guideOnNewSide ? 1 : 0));
    let leftPrefixFg: string;
    if (yellowRailLeft) {
      leftPrefixFg = theme.fileModified;
    } else if (guideOnOldSide) {
      leftPrefixFg = theme.noteBorder;
    } else {
      leftPrefixFg = splitLeftRailColor(
        row.left.kind,
        theme,
        selected || hasCopySelection,
      );
    }
    let leftPrefixText: string;
    if (yellowRailLeft) {
      leftPrefixText = marker();
    } else if (guideOnOldSide) {
      leftPrefixText = "│";
    } else {
      leftPrefixText = marker();
    }
    const leftPrefix = {
      bg: theme.panel,
      fg: leftPrefixFg,
      text: leftPrefixText,
    };
    const rightPrefix = {
      bg: theme.panel,
      fg: yellowRailRight
        ? theme.fileModified
        : splitRightRailColor(
            row.right.kind,
            theme,
            selected || hasCopySelection,
          ),
      text: "▌",
    };

    if (wrapLines) {
      const leftLayout = buildWrappedSplitCell(
        row.left,
        leftWidth,
        lineNumberDigits,
        showLineNumbers,
        leftPrefix.text.length,
        theme,
        showSign,
      );
      const rightLayout = buildWrappedSplitCell(
        row.right,
        rightRenderWidth,
        lineNumberDigits,
        showLineNumbers,
        rightPrefix.text.length,
        theme,
        showSign,
      );
      const leftContentWidth = Math.max(
        0,
        leftWidth - leftPrefix.text.length - leftLayout.gutterWidth,
      );
      const rightContentWidth = Math.max(
        0,
        rightRenderWidth - rightPrefix.text.length - rightLayout.gutterWidth,
      );
      const visualLineCount = Math.max(
        leftLayout.lines.length,
        rightLayout.lines.length,
      );

      baseRow = (
        <box
          id={anchorId}
          style={{
            flexDirection: "column",
            height: visualLineCount,
            width: "100%",
          }}
        >
          {Array.from({ length: visualLineCount }, (_, index) => {
            const leftLine = leftLayout.lines[index] ?? {
              gutterText: " ".repeat(leftLayout.gutterWidth),
              spans: [],
            };
            const rightLine = rightLayout.lines[index] ?? {
              gutterText: " ".repeat(rightLayout.gutterWidth),
              spans: [],
            };

            let styledRow: StyledText;
            if (
              isChunkCompatibleWrappedHighlight(leftHighlight) &&
              isChunkCompatibleWrappedHighlight(rightHighlight)
            ) {
              const chunks: TextChunk[] = [];
              appendWrappedCellChunks(
                chunks,
                leftLine,
                leftLayout.palette,
                leftContentWidth,
                theme,
                leftPrefix,
                leftHighlight,
              );
              appendWrappedCellChunks(
                chunks,
                rightLine,
                rightLayout.palette,
                rightContentWidth,
                theme,
                rightPrefix,
                rightHighlight,
              );
              if (guideOnNewSide) {
                chunks.push({
                  __isChunk: true,
                  fg: styledTextColor(theme.noteBorder),
                  text: "│",
                });
              }
              styledRow = new StyledText(chunks);
            } else {
              styledRow = styledTextFromSpanNodes([
                renderWrappedSplitCellLine(
                  leftLine,
                  leftLayout.palette,
                  leftContentWidth,
                  theme,
                  `${row.key}:left:${index}`,
                  leftPrefix,
                  leftHighlight,
                  0,
                ),
                renderWrappedSplitCellLine(
                  rightLine,
                  rightLayout.palette,
                  rightContentWidth,
                  theme,
                  `${row.key}:right:${index}`,
                  rightPrefix,
                  rightHighlight,
                  leftWidth,
                ),
                guideOnNewSide ? (
                  <span
                    fg={theme.noteBorder}
                    // biome-ignore lint/suspicious/noArrayIndexKey: static display list, items don't reorder
                    key={`${row.key}:note-guide:${index}`}
                  >
                    │
                  </span>
                ) : null,
              ]);
            }

            return (
              <text
                content={styledRow}
                // biome-ignore lint/suspicious/noArrayIndexKey: static display list, items don't reorder
                key={`${row.key}:wrap:${index}`}
                onMouseMove={() => onHoverRow?.(row.key)}
              />
            );
          })}
        </box>
      );
    } else {
      baseRow = (
        <box
          id={anchorId}
          onMouseMove={() => onHoverRow?.(row.key)}
          style={{ flexDirection: "row", height: 1, width: "100%" }}
        >
          <box style={{ height: 1, width: "100%" }}>
            <text>
              {renderSplitCell(
                row.left,
                leftWidth,
                lineNumberDigits,
                showLineNumbers,
                theme,
                `${row.key}:left`,
                codeHorizontalOffset,
                leftPrefix,
                leftHighlight,
                0,
                showSign,
              )}
              {renderSplitCell(
                row.right,
                rightRenderWidth,
                lineNumberDigits,
                showLineNumbers,
                theme,
                `${row.key}:right`,
                codeHorizontalOffset,
                rightPrefix,
                rightHighlight,
                leftWidth,
                showSign,
              )}
              {guideOnNewSide ? (
                <span fg={theme.noteBorder} key={`${row.key}:note-guide`}>
                  │
                </span>
              ) : null}
            </text>
          </box>
        </box>
      );
    }
  } else if (row.type === "stack-line") {
    const guideOnOldSide = noteGuideSide === "old";
    const guideOnNewSide = noteGuideSide === "new";
    const contentWidth = Math.max(0, width - (guideOnNewSide ? 1 : 0));
    let prefixFg: string;
    if (yellowRailStack) {
      prefixFg = theme.fileModified;
    } else if (guideOnOldSide) {
      prefixFg = theme.noteBorder;
    } else {
      prefixFg = stackRailColor(
        row.cell.kind,
        theme,
        selected || hasCopySelection,
      );
    }
    let prefixText: string;
    if (yellowRailStack) {
      prefixText = marker();
    } else if (guideOnOldSide) {
      prefixText = "│";
    } else {
      prefixText = marker();
    }
    const prefix = {
      bg: theme.panel,
      fg: prefixFg,
      text: prefixText,
    };

    if (wrapLines) {
      const layout = buildWrappedStackCell(
        row.cell,
        contentWidth,
        lineNumberDigits,
        showLineNumbers,
        prefix.text.length,
        theme,
        showSign,
      );
      const wrappedContentWidth = Math.max(
        0,
        contentWidth - prefix.text.length - layout.gutterWidth,
      );

      baseRow = (
        <box
          id={anchorId}
          style={{
            flexDirection: "column",
            height: layout.lines.length,
            width: "100%",
          }}
        >
          {layout.lines.map((line, index) => {
            let styledRow: StyledText;
            if (isChunkCompatibleWrappedHighlight(cellHighlight)) {
              const chunks: TextChunk[] = [];
              appendWrappedCellChunks(
                chunks,
                line,
                layout.palette,
                wrappedContentWidth,
                theme,
                prefix,
                cellHighlight,
              );
              if (guideOnNewSide) {
                chunks.push({
                  __isChunk: true,
                  fg: styledTextColor(theme.noteBorder),
                  text: "│",
                });
              }
              styledRow = new StyledText(chunks);
            } else {
              styledRow = styledTextFromSpanNodes([
                renderWrappedStackCellLine(
                  line,
                  layout.palette,
                  wrappedContentWidth,
                  theme,
                  `${row.key}:stack:${index}`,
                  prefix,
                  cellHighlight,
                ),
                guideOnNewSide ? (
                  <span
                    fg={theme.noteBorder}
                    // biome-ignore lint/suspicious/noArrayIndexKey: static display list, items don't reorder
                    key={`${row.key}:note-guide:${index}`}
                  >
                    │
                  </span>
                ) : null,
              ]);
            }

            return (
              <text
                content={styledRow}
                // biome-ignore lint/suspicious/noArrayIndexKey: static display list, items don't reorder
                key={`${row.key}:wrap:${index}`}
                onMouseMove={() => onHoverRow?.(row.key)}
              />
            );
          })}
        </box>
      );
    } else {
      baseRow = (
        <box
          id={anchorId}
          onMouseMove={() => onHoverRow?.(row.key)}
          style={{ flexDirection: "row", height: 1, width: "100%" }}
        >
          <box style={{ height: 1, width: "100%" }}>
            <text>
              {renderStackCell(
                row.cell,
                contentWidth,
                lineNumberDigits,
                showLineNumbers,
                theme,
                `${row.key}:stack`,
                codeHorizontalOffset,
                prefix,
                cellHighlight,
                showSign,
              )}
              {guideOnNewSide ? (
                <span fg={theme.noteBorder} key={`${row.key}:note-guide`}>
                  │
                </span>
              ) : null}
            </text>
          </box>
        </box>
      );
    }
  } else {
    baseRow = (
      <box style={{ height: 1, width: "100%" }}>
        <text fg={theme.muted}>Unsupported row.</text>
      </box>
    );
  }

  return baseRow;
}

type DiffRowViewProps = {
  anchorId?: string;
  codeHorizontalOffset: number;
  commentMarked?: boolean;
  copySelectedRowRange?: CopySelectedRowRange;
  copySelectedSide?: "left" | "right";
  cursorHighlight?: CursorHighlight;
  /** Extension marks for this row's file, resolved to terminal columns. */
  lineHighlights?: LineHighlightPaintIndex;
  lineNumberDigits: number;
  noteGuideSide?: "old" | "new";
  onHoverRow?: (rowKey: string) => void;
  onToggleGap?: (gapKey: string) => void;
  row: DiffRow;
  selected: boolean;
  showHunkHeaders: boolean;
  showLineNumbers: boolean;
  showSign: boolean;
  theme: AppTheme;
  visualSelect?: boolean;
  width: number;
  wrapLines: boolean;
};

/**
 * Render one diff row, memoized to avoid unnecessary rerenders.
 *
 * The comparator checks every handler by reference, so callers (PierreDiffView) must pass
 * identity-stable callbacks — e.g. one shared onHoverRow that receives the row key — or the memo
 * silently degrades to re-rendering every visible row per parent render.
 */
export const DiffRowView = memo(
  function DiffRowViewComponent({
    row,
    width,
    lineNumberDigits,
    showLineNumbers,
    showSign,
    showHunkHeaders,
    wrapLines,
    codeHorizontalOffset,
    theme,
    selected,
    copySelectedRowRange,
    copySelectedSide,
    cursorHighlight,
    lineHighlights,
    anchorId,
    noteGuideSide,
    onHoverRow,
    onToggleGap,
    visualSelect = false,
    commentMarked = false,
  }: DiffRowViewProps) {
    return renderRow(
      row,
      width,
      lineNumberDigits,
      showLineNumbers,
      showHunkHeaders,
      wrapLines,
      codeHorizontalOffset,
      theme,
      selected,
      copySelectedRowRange,
      copySelectedSide,
      cursorHighlight,
      lineHighlights,
      anchorId,
      noteGuideSide,
      onHoverRow,
      onToggleGap,
      showSign,
      visualSelect,
      commentMarked,
    );
  },
  (previous, next) =>
    previous.row === next.row &&
    previous.width === next.width &&
    previous.lineNumberDigits === next.lineNumberDigits &&
    previous.showLineNumbers === next.showLineNumbers &&
    previous.showSign === next.showSign &&
    previous.showHunkHeaders === next.showHunkHeaders &&
    previous.wrapLines === next.wrapLines &&
    previous.codeHorizontalOffset === next.codeHorizontalOffset &&
    previous.theme === next.theme &&
    previous.selected === next.selected &&
    previous.copySelectedRowRange === next.copySelectedRowRange &&
    previous.copySelectedSide === next.copySelectedSide &&
    previous.cursorHighlight === next.cursorHighlight &&
    previous.lineHighlights === next.lineHighlights &&
    previous.anchorId === next.anchorId &&
    previous.noteGuideSide === next.noteGuideSide &&
    previous.onHoverRow === next.onHoverRow &&
    previous.onToggleGap === next.onToggleGap &&
    previous.visualSelect === next.visualSelect &&
    previous.commentMarked === next.commentMarked,
);
