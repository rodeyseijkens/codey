import type { Hunk } from "@pierre/diffs";

import {
  type ReviewGapAddress,
  reviewLeadingGap,
  reviewTrailingGap,
} from "../../../diff/gap";
import type { ValidatedLineHighlight } from "../highlights/validate";
import { normalizedReviewSourceLines } from "../review/geometry";
import { reviewExpansionSide } from "../review/types";
import { expandDiffTabs } from "./codeColumns";
import type { RenderSpan } from "./pierre";
import { DEFAULT_TAB_WIDTH } from "./tabWidth";
import { sanitizeTerminalLine } from "./terminalText";
import {
  isPrintableAsciiText,
  measureClusterWidth,
  measureSanitizedTextWidth,
  measureTextWidth,
  textClusters,
} from "./text";
import type { DiffFile, ExtensionLineHighlightTone } from "./types";

const trailingNewlineRegex = /\n$/;

/** One mark resolved to terminal columns of the rendered (expanded) line. */
export type LineHighlightColRange = {
  readonly endCol: number;
  readonly startCol: number;
  readonly tone: ExtensionLineHighlightTone;
};

/**
 * Column ranges per rendered line, keyed by `lineHighlightPaintKey`.
 *
 * A context line is registered under both its old and new key with one shared
 * range list, so split view mirrors the mark onto both halves and stack view
 * finds it through either line number.
 */
export type LineHighlightPaintIndex = ReadonlyMap<
  string,
  readonly LineHighlightColRange[]
>;

/** Key one rendered line by the side and 1-based line number a cell carries. */
export function lineHighlightPaintKey(side: "old" | "new", line: number) {
  return `${side}:${line}`;
}

/** Strip one trailing newline the way diff rendering does before measuring. */
function stripTrailingNewline(text: string) {
  return text.replace(trailingNewlineRegex, "");
}

/**
 * Snap one code-unit offset in sanitized text to a grapheme-cluster boundary.
 *
 * A mid-cluster offset widens outward (`start` down, `end` up) so a bad offset
 * marks the whole visible glyph instead of tearing it.
 */
function snapToClusterBoundary(
  text: string,
  offset: number,
  direction: "down" | "up",
) {
  if (offset <= 0) {
    return 0;
  }
  if (offset >= text.length) {
    return text.length;
  }

  let boundary = 0;
  for (const cluster of textClusters(text)) {
    const next = boundary + cluster.length;
    if (next === offset) {
      return offset;
    }
    if (next > offset) {
      return direction === "down" ? boundary : next;
    }
    boundary = next;
  }
  return text.length;
}

/**
 * Map one raw-text code-unit offset to a sanitized-text offset.
 *
 * Sanitization mostly leaves source code untouched; when it does strip control
 * sequences, sanitizing the raw prefix approximates the shifted offset. A
 * sequence straddling the cut can round the answer by a few code units, which
 * cluster snapping then contains to whole glyphs.
 */
function rawOffsetToSanitizedOffset(
  raw: string,
  sanitized: string,
  offset: number,
) {
  const clamped = Math.max(0, Math.min(offset, raw.length));
  if (raw === sanitized) {
    return clamped;
  }
  return Math.min(
    sanitizeTerminalLine(raw.slice(0, clamped)).length,
    sanitized.length,
  );
}

/** Resolve one mark against its raw line text into terminal columns. */
function markToColRange(
  mark: ValidatedLineHighlight,
  rawText: string,
  tabWidth: number,
): LineHighlightColRange | null {
  const raw = stripTrailingNewline(rawText);
  const sanitized = sanitizeTerminalLine(raw);
  if (sanitized.length === 0) {
    return null;
  }

  const start = snapToClusterBoundary(
    sanitized,
    rawOffsetToSanitizedOffset(raw, sanitized, mark.start),
    "down",
  );
  const end = snapToClusterBoundary(
    sanitized,
    rawOffsetToSanitizedOffset(raw, sanitized, mark.end),
    "up",
  );
  if (start >= end) {
    return null;
  }

  // A prefix expands to the same columns the full line's expansion gives it,
  // because tab stops depend only on the columns already consumed.
  const startCol = measureTextWidth(
    expandDiffTabs(sanitized.slice(0, start), tabWidth),
  );
  const endCol = measureTextWidth(
    expandDiffTabs(sanitized.slice(0, end), tabWidth),
  );
  return endCol > startCol ? { endCol, startCol, tone: mark.tone } : null;
}

/** The raw text one addressed line renders, plus the counterpart key of a context pair. */
type AddressedLine = {
  /** The same physical line's key on the other side, for context and gap lines. */
  counterpartKey?: string;
  rawText: string;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: hunk-content iteration with three inner loops (context/deletion/addition) is inherently complex
function resolveHunkLines(
  resolved: Map<string, AddressedLine>,
  addressedKeys: ReadonlySet<string>,
  hunk: Hunk,
  deletionLines: readonly string[],
  additionLines: readonly string[],
) {
  let {
    additionLineIndex,
    deletionLineIndex,
    additionStart: newLine,
    deletionStart: oldLine,
  } = hunk;

  for (const content of hunk.hunkContent) {
    if (content.type === "context") {
      for (let offset = 0; offset < content.lines; offset += 1) {
        const oldKey = lineHighlightPaintKey("old", oldLine + offset);
        const newKey = lineHighlightPaintKey("new", newLine + offset);
        if (!(addressedKeys.has(oldKey) || addressedKeys.has(newKey))) {
          continue;
        }
        const rawText =
          additionLines[additionLineIndex + offset] ??
          deletionLines[deletionLineIndex + offset];
        if (rawText === undefined) {
          continue;
        }
        resolved.set(oldKey, { counterpartKey: newKey, rawText });
        resolved.set(newKey, { counterpartKey: oldKey, rawText });
      }
      deletionLineIndex += content.lines;
      additionLineIndex += content.lines;
      oldLine += content.lines;
      newLine += content.lines;
      continue;
    }

    for (let offset = 0; offset < content.deletions; offset += 1) {
      const key = lineHighlightPaintKey("old", oldLine + offset);
      if (!addressedKeys.has(key)) {
        continue;
      }
      const rawText = deletionLines[deletionLineIndex + offset];
      if (rawText !== undefined) {
        resolved.set(key, { rawText });
      }
    }
    for (let offset = 0; offset < content.additions; offset += 1) {
      const key = lineHighlightPaintKey("new", newLine + offset);
      if (!addressedKeys.has(key)) {
        continue;
      }
      const rawText = additionLines[additionLineIndex + offset];
      if (rawText !== undefined) {
        resolved.set(key, { rawText });
      }
    }
    deletionLineIndex += content.deletions;
    additionLineIndex += content.additions;
    oldLine += content.deletions;
    newLine += content.additions;
  }
}

/** Walk the patch once, resolving every addressed `(side, line)` to its raw text. */
function resolvePatchLines(file: DiffFile, addressedKeys: ReadonlySet<string>) {
  const resolved = new Map<string, AddressedLine>();
  const { metadata } = file;

  for (const hunk of metadata.hunks) {
    resolveHunkLines(
      resolved,
      addressedKeys,
      hunk,
      metadata.deletionLines,
      metadata.additionLines,
    );
  }

  return resolved;
}

/** Every collapsed gap of one file, in the addressing shared with expansion rows. */
function fileGapAddresses(file: DiffFile): ReviewGapAddress[] {
  const gaps: ReviewGapAddress[] = [];
  for (
    let hunkIndex = 0;
    hunkIndex < file.metadata.hunks.length;
    hunkIndex += 1
  ) {
    const leading = reviewLeadingGap(file.metadata, hunkIndex);
    if (leading) {
      gaps.push(leading);
    }
  }
  const trailing = reviewTrailingGap(file.metadata);
  if (trailing) {
    gaps.push(trailing);
  }
  return gaps;
}

function resolvePendingGapKey(
  key: string,
  gaps: ReviewGapAddress[],
  expansionSide: "old" | "new",
  sourceLines: string[],
  resolved: Map<string, AddressedLine>,
) {
  const [side, lineText] = key.split(":") as ["old" | "new", string];
  const line = Number(lineText);
  for (const gap of gaps) {
    const range = side === "old" ? gap.oldRange : gap.newRange;
    if (line < range[0] || line > range[1]) {
      continue;
    }
    const offset = line - range[0];
    const otherRange = side === "old" ? gap.newRange : gap.oldRange;
    const counterpart = otherRange[0] + offset;
    const expansionLine = side === expansionSide ? line : counterpart;
    const rawText = sourceLines[expansionLine - 1];
    if (rawText === undefined) {
      break;
    }
    const counterpartKey = lineHighlightPaintKey(
      side === "old" ? "new" : "old",
      counterpart,
    );
    resolved.set(key, { counterpartKey, rawText });
    resolved.set(counterpartKey, { counterpartKey: key, rawText });
    break;
  }
}

function resolveGapLines(
  file: DiffFile,
  addressedKeys: ReadonlySet<string>,
  resolved: Map<string, AddressedLine>,
  sourceText: string,
) {
  const pending = [...addressedKeys].filter((key) => !resolved.has(key));
  if (pending.length === 0) {
    return;
  }

  const expansionSide = reviewExpansionSide(file.metadata.type);
  const sourceLines = normalizedReviewSourceLines(sourceText);
  const gaps = fileGapAddresses(file);

  for (const key of pending) {
    resolvePendingGapKey(key, gaps, expansionSide, sourceLines, resolved);
  }
}

export function buildLineHighlightPaintIndex({
  file,
  marks,
  tabWidth = DEFAULT_TAB_WIDTH,
  sourceText,
}: {
  file: DiffFile;
  marks: readonly ValidatedLineHighlight[];
  tabWidth?: number;
  /** Loaded full source for the expansion side, covering expanded gap rows. */
  sourceText?: string;
}): LineHighlightPaintIndex | undefined {
  if (marks.length === 0) {
    return undefined;
  }

  const marksByKey = new Map<string, ValidatedLineHighlight[]>();
  for (const mark of marks) {
    const key = lineHighlightPaintKey(mark.side, mark.line);
    const bucket = marksByKey.get(key);
    if (bucket) {
      bucket.push(mark);
    } else {
      marksByKey.set(key, [mark]);
    }
  }

  const addressedKeys = new Set(marksByKey.keys());
  const lines = resolvePatchLines(file, addressedKeys);
  if (sourceText !== undefined) {
    resolveGapLines(file, addressedKeys, lines, sourceText);
  }

  const index = new Map<string, LineHighlightColRange[]>();
  const bucketFor = (key: string, counterpartKey: string | undefined) => {
    let bucket =
      index.get(key) ??
      (counterpartKey ? index.get(counterpartKey) : undefined);
    if (!bucket) {
      bucket = [];
    }
    index.set(key, bucket);
    if (counterpartKey) {
      index.set(counterpartKey, bucket);
    }
    return bucket;
  };

  for (const [key, keyMarks] of marksByKey) {
    const line = lines.get(key);
    if (!line) {
      continue;
    }
    for (const mark of keyMarks) {
      const range = markToColRange(mark, line.rawText, tabWidth);
      if (!range) {
        continue;
      }
      bucketFor(key, line.counterpartKey).push(range);
    }
  }

  for (const [key, bucket] of index) {
    if (bucket.length === 0) {
      index.delete(key);
    }
  }
  if (index.size === 0) {
    return undefined;
  }

  for (const ranges of index.values()) {
    ranges.sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol);
  }
  return index;
}

/** Append a span preserving color-run coalescing. */
function appendSpan(target: RenderSpan[], span: RenderSpan) {
  const previous = target.at(-1);
  if (previous && previous.fg === span.fg && previous.bg === span.bg) {
    previous.text += span.text;
  } else {
    target.push(span);
  }
}

/** One line's cut columns plus the tone winning each gap between them. */
type LineHighlightCutPlan = {
  /** Sorted unique cut columns; every painted piece begins and ends on one. */
  readonly cuts: readonly number[];
  /** Winning tone for `[cuts[i], cuts[i + 1])`, or `undefined` where nothing paints. */
  readonly tones: ReadonlyArray<ExtensionLineHighlightTone | undefined>;
};

const lineHighlightCutPlans = new WeakMap<
  readonly LineHighlightColRange[],
  LineHighlightCutPlan
>();

function lineHighlightCutPlan(
  ranges: readonly LineHighlightColRange[],
): LineHighlightCutPlan {
  const cached = lineHighlightCutPlans.get(ranges);
  if (cached) {
    return cached;
  }

  const cutSet = new Set<number>();
  for (const range of ranges) {
    cutSet.add(range.startCol);
    cutSet.add(range.endCol);
  }
  const cuts = [...cutSet].sort((a, b) => a - b);
  const columnIndex = new Map<number, number>();
  for (const [index, cut] of cuts.entries()) {
    columnIndex.set(cut, index);
  }

  const intervals = Math.max(0, cuts.length - 1);
  const tones = Array.from<ExtensionLineHighlightTone | undefined>({
    length: intervals,
  });
  const skip = new Int32Array(intervals + 1);
  for (let index = 0; index <= intervals; index += 1) {
    skip[index] = index;
  }
  const nextUnclaimed = (index: number) => {
    let current = index;
    while (skip[current] !== current) {
      // biome-ignore lint/style/noNonNullAssertion: union-find algorithm guarantees populated indices
      skip[current] = skip[skip[current]!]!;
      // biome-ignore lint/style/noNonNullAssertion: union-find algorithm guarantees populated indices
      current = skip[current]!;
    }
    return current;
  };

  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    // biome-ignore lint/style/noNonNullAssertion: array index is in bounds
    const range = ranges[index]!;
    const to = columnIndex.get(range.endCol) ?? 0;
    let interval = nextUnclaimed(columnIndex.get(range.startCol) ?? 0);
    while (interval < to) {
      tones[interval] = range.tone;
      skip[interval] = interval + 1;
      interval = nextUnclaimed(interval + 1);
    }
  }

  const plan: LineHighlightCutPlan = { cuts, tones };
  lineHighlightCutPlans.set(ranges, plan);
  return plan;
}

/** The tone painting one column, with later ranges already resolved into the plan. */
function toneAtColumn(plan: LineHighlightCutPlan, col: number) {
  const { cuts: planCuts, tones: planTones } = plan;
  let low = 0;
  let high = planCuts.length - 1;
  let interval = -1;
  while (low <= high) {
    // biome-ignore lint/suspicious/noBitwiseOperators: intentional binary search halving
    const middle = (low + high) >> 1;
    // biome-ignore lint/style/noNonNullAssertion: array index is in bounds
    if (planCuts[middle]! <= col) {
      interval = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return interval >= 0 ? planTones[interval] : undefined;
}

/** The resolved paint for one tone: a background, plus a foreground when the mark inverts. */
export type LineHighlightSpanStyle = {
  bg: string;
  fg?: string;
};

function paintHighlightSpan(
  result: RenderSpan[],
  span: RenderSpan,
  text: string,
  startCol: number,
  plan: LineHighlightCutPlan,
  resolveStyle: (
    tone: ExtensionLineHighlightTone,
  ) => LineHighlightSpanStyle | undefined,
) {
  if (text.length === 0) {
    return;
  }
  const tone = toneAtColumn(plan, startCol);
  const style = tone === undefined ? undefined : resolveStyle(tone);
  appendSpan(
    result,
    style === undefined
      ? { ...span, text }
      : // biome-ignore lint/style/noNestedTernary: three-way paint decision
        style.fg === undefined
        ? { ...span, bg: style.bg, text }
        : { ...span, bg: style.bg, fg: style.fg, text },
  );
}

function processHighlightSpan(
  result: RenderSpan[],
  span: RenderSpan,
  plan: LineHighlightCutPlan,
  col: number,
  cutCursor: number,
  resolveStyle: (
    tone: ExtensionLineHighlightTone,
  ) => LineHighlightSpanStyle | undefined,
): { col: number; cutCursor: number } {
  const { cuts } = plan;
  const safeText = sanitizeTerminalLine(span.text);
  const spanWidth = measureSanitizedTextWidth(safeText);
  if (spanWidth === 0) {
    appendSpan(result, { ...span });
    return { col, cutCursor };
  }

  const spanStart = col;
  const spanEnd = col + spanWidth;
  let cursor = cutCursor;

  while (
    cursor < cuts.length &&
    // biome-ignore lint/style/noNonNullAssertion: loop condition guarantees in-bounds access
    cuts[cursor]! <= spanStart
  ) {
    cursor += 1;
  }
  if (
    cursor >= cuts.length ||
    // biome-ignore lint/style/noNonNullAssertion: accessed only when cursor < cuts.length
    cuts[cursor]! >= spanEnd
  ) {
    paintHighlightSpan(result, span, span.text, spanStart, plan, resolveStyle);
    return { col: spanEnd, cutCursor: cursor };
  }

  let pieceIndex = 0;
  let pieceCol = spanStart;

  if (isPrintableAsciiText(safeText)) {
    while (
      cursor < cuts.length &&
      // biome-ignore lint/style/noNonNullAssertion: loop condition guarantees in-bounds access
      cuts[cursor]! < spanEnd
    ) {
      // biome-ignore lint/style/noNonNullAssertion: loop condition guarantees in-bounds access
      const cut = cuts[cursor]!;
      paintHighlightSpan(
        result,
        span,
        safeText.slice(pieceIndex, cut - spanStart),
        pieceCol,
        plan,
        resolveStyle,
      );
      pieceIndex = cut - spanStart;
      pieceCol = cut;
      cursor += 1;
    }
    paintHighlightSpan(
      result,
      span,
      safeText.slice(pieceIndex),
      pieceCol,
      plan,
      resolveStyle,
    );
    return { col: spanEnd, cutCursor: cursor };
  }

  let clusterIndex = 0;
  let clusterCol = spanStart;
  for (const cluster of textClusters(safeText)) {
    while (
      cursor < cuts.length &&
      // biome-ignore lint/style/noNonNullAssertion: loop condition guarantees in-bounds access
      cuts[cursor]! < clusterCol
    ) {
      cursor += 1;
    }
    if (cursor < cuts.length && cuts[cursor] === clusterCol) {
      paintHighlightSpan(
        result,
        span,
        safeText.slice(pieceIndex, clusterIndex),
        pieceCol,
        plan,
        resolveStyle,
      );
      pieceIndex = clusterIndex;
      pieceCol = clusterCol;
      cursor += 1;
    }
    clusterCol += measureClusterWidth(cluster);
    clusterIndex += cluster.length;
  }
  paintHighlightSpan(
    result,
    span,
    safeText.slice(pieceIndex),
    pieceCol,
    plan,
    resolveStyle,
  );
  return { col: spanEnd, cutCursor: cursor };
}

export function applyLineHighlightsToSpans(
  spans: readonly RenderSpan[],
  ranges: readonly LineHighlightColRange[],
  resolveStyle: (
    tone: ExtensionLineHighlightTone,
  ) => LineHighlightSpanStyle | undefined,
): RenderSpan[] {
  if (ranges.length === 0) {
    return [...spans];
  }

  const plan = lineHighlightCutPlan(ranges);
  const result: RenderSpan[] = [];
  let col = 0;
  let cutCursor = 0;

  for (const span of spans) {
    const { col: nextCol, cutCursor: nextCursor } = processHighlightSpan(
      result,
      span,
      plan,
      col,
      cutCursor,
      resolveStyle,
    );
    col = nextCol;
    cutCursor = nextCursor;
  }

  return result;
}
