import {
  cleanLastNewline,
  type FileDiffMetadata,
  getHighlighterOptions,
  getSharedHighlighter,
  type Hunk,
  renderDiffWithHighlighter,
} from "@pierre/diffs";

import {
  type ReviewGapAddress,
  type ReviewGapPosition,
  reviewLeadingGap,
  reviewTrailingGap,
} from "../../../patch/gap";
import { formatHunkHeader } from "../../../patch/hunk-header";
import { blendHex, hexColorDistance } from "../../color-utils";
import { type AppTheme, TRANSPARENT_BACKGROUND } from "../../theme/resolve";
import { expandDiffTabs } from "./codeColumns";
import {
  ensureSyntaxHighlightThemeRegistered,
  syntaxHighlightThemeName,
} from "./syntaxHighlightTheme";
import { DEFAULT_TAB_WIDTH } from "./tabWidth";
import { sanitizeTerminalLine } from "./terminalText";
import { measureTextWidth } from "./text";
import type { DiffFile, DiffLineMoveKind } from "./types";

const hexColorRegex = /^#[0-9a-f]{6}$/i;

type HighlightThemeInput = AppTheme | AppTheme["appearance"];

/** Return the light/dark mode for a theme object or legacy appearance argument. */
function highlightThemeAppearance(theme: HighlightThemeInput) {
  return typeof theme === "string" ? theme : theme.appearance;
}

/** Build render options for the active syntax theme. */
function pierreRenderOptions(theme: HighlightThemeInput) {
  return {
    lineDiffType: "word-alt" as const,
    maxLineDiffLength: 10_000,
    theme: syntaxHighlightThemeName(theme),
    tokenizeMaxLineLength: 1000,
    useTokenTransformer: false,
  };
}

type HighlightOptions = ReturnType<typeof getHighlighterOptions>;

const highlighterOptionsByKey = new Map<string, HighlightOptions>();
let queuedHighlightWork = Promise.resolve();

type HastNode = HastTextNode | HastElementNode;

type HastTextNode = {
  type: "text";
  value: string;
};

type HastElementNode = {
  children?: HastNode[];
  properties?: Record<string, unknown>;
  tagName: string;
  type: "element";
};

export type HighlightedDiffCode = {
  additionLines: Array<HastNode | undefined>;
  deletionLines: Array<HastNode | undefined>;
};

export type RenderSpan = {
  bg?: string;
  fg?: string;
  text: string;
};

export type SplitLineCell = {
  kind: "context" | "addition" | "deletion" | "empty";
  lineNumber?: number;
  moveKind?: DiffLineMoveKind;
  sign: string;
  spans: RenderSpan[];
};

export type StackLineCell = {
  kind: "context" | "addition" | "deletion";
  moveKind?: DiffLineMoveKind;
  newLineNumber?: number;
  oldLineNumber?: number;
  sign: string;
  spans: RenderSpan[];
};

/** One vocabulary for gap positions, shared with the core gap addressing it comes from. */
export type CollapsedGapPosition = ReviewGapPosition;

export type DiffRow =
  | {
      type: "collapsed";
      key: string;
      fileId: string;
      hunkIndex: number;
      text: string;
      // Where this gap sits relative to the surrounding hunks; "before" attaches to
      // the gap leading into hunkIndex, "trailing" sits after the final hunk.
      position: CollapsedGapPosition;
      // 1-based inclusive file-line ranges this gap covers on each side. Expansion
      // uses these to slice the file contents that fill the gap.
      oldRange: [number, number];
      newRange: [number, number];
    }
  | {
      type: "hunk-header";
      key: string;
      fileId: string;
      hunkIndex: number;
      text: string;
    }
  | {
      type: "split-line";
      key: string;
      fileId: string;
      hunkIndex: number;
      left: SplitLineCell;
      right: SplitLineCell;
      // True when this row was synthesized to fill an expanded collapsed gap.
      // Expanded rows carry the neighbor hunk's index for ordering but must not
      // count toward that hunk's bounds or anchor position.
      isExpansionRow?: true;
      /** Exact collapsed gap this synthesized row reveals. */
      expandedGapKey?: string;
    }
  | {
      type: "stack-line";
      key: string;
      fileId: string;
      hunkIndex: number;
      cell: StackLineCell;
      isExpansionRow?: true;
      /** Exact collapsed gap this synthesized row reveals. */
      expandedGapKey?: string;
    };

/** Expand source tabs before terminal rendering so downstream geometry stays predictable. */
function tabify(text: string, tabWidth: number, initialColumn = 0) {
  return expandDiffTabs(sanitizeTerminalLine(text), tabWidth, initialColumn);
}

const EMPTY_STYLE_VALUES = new Map<string, string>();
const parsedStyleValueCache = new Map<string, Map<string, string>>();

/** Parse an inline CSS style string from Pierre's highlighted HAST output. */
function parseStyleValue(styleValue: unknown) {
  if (typeof styleValue !== "string") {
    return EMPTY_STYLE_VALUES;
  }

  const cached = parsedStyleValueCache.get(styleValue);
  if (cached) {
    return cached;
  }

  const styles = new Map<string, string>();
  for (const segment of styleValue.split(";")) {
    const separator = segment.indexOf(":");
    if (separator <= 0) {
      continue;
    }

    const key = segment.slice(0, separator).trim();
    const value = segment.slice(separator + 1).trim();
    if (key && value) {
      styles.set(key, value);
    }
  }

  parsedStyleValueCache.set(styleValue, styles);
  return styles;
}

const flattenedHighlightedLineCache = new WeakMap<
  HastNode,
  Map<string, RenderSpan[]>
>();
const MIN_WORD_DIFF_BG_DISTANCE = 28;
const WORD_DIFF_BLEND_STEP = 0.005;
const WORD_DIFF_MAX_BLEND = 0.2;
const wordDiffBackgroundCache = new Map<
  string,
  Record<SplitLineCell["kind"], string>
>();

/** Blend toward the semantic sign color just enough to hit the minimum visible contrast. */
function strengthenWordDiffBg(lineBg: string, signColor: string) {
  let strongestCandidate = lineBg;
  const maxSteps = Math.floor(WORD_DIFF_MAX_BLEND / WORD_DIFF_BLEND_STEP);

  for (let step = 1; step <= maxSteps; step += 1) {
    const blendRatio = step * WORD_DIFF_BLEND_STEP;
    const candidate = blendHex(signColor, lineBg, blendRatio);
    strongestCandidate = candidate;

    if (hexColorDistance(candidate, lineBg) >= MIN_WORD_DIFF_BG_DISTANCE) {
      return candidate;
    }
  }

  return strongestCandidate;
}

/** Return whether a theme color can safely participate in RGB distance and blend math. */
function isHexThemeColor(color: string) {
  return hexColorRegex.test(color);
}

/** Resolve one word-diff background without turning transparent surfaces into black blends. */
function resolveWordDiffHighlightBg(
  contentBg: string,
  lineBg: string,
  signColor: string,
) {
  if (
    contentBg === TRANSPARENT_BACKGROUND ||
    lineBg === TRANSPARENT_BACKGROUND
  ) {
    return contentBg;
  }

  if (!(isHexThemeColor(contentBg) && isHexThemeColor(lineBg))) {
    return contentBg;
  }

  return hexColorDistance(contentBg, lineBg) >= MIN_WORD_DIFF_BG_DISTANCE
    ? contentBg
    : strengthenWordDiffBg(lineBg, signColor);
}

/** Resolve the inline word-diff background, strengthening theme colors that are too subtle to see. */
function wordDiffHighlightBg(kind: SplitLineCell["kind"], theme: AppTheme) {
  const cacheKey = [
    theme.addedContentBg,
    theme.addedBg,
    theme.addedSignColor,
    theme.removedContentBg,
    theme.removedBg,
    theme.removedSignColor,
    theme.contextContentBg,
    theme.panelAlt,
  ].join(":");
  let cached = wordDiffBackgroundCache.get(cacheKey);
  if (!cached) {
    const addition = resolveWordDiffHighlightBg(
      theme.addedContentBg,
      theme.addedBg,
      theme.addedSignColor,
    );
    const deletion = resolveWordDiffHighlightBg(
      theme.removedContentBg,
      theme.removedBg,
      theme.removedSignColor,
    );

    cached = {
      addition,
      context: theme.contextContentBg,
      deletion,
      empty: theme.panelAlt,
    };
    wordDiffBackgroundCache.set(cacheKey, cached);
  }

  return cached[kind];
}

/** Append a span while coalescing adjacent runs with identical colors. */
function mergeSpan(target: RenderSpan[], next: RenderSpan) {
  if (next.text.length === 0) {
    return;
  }

  const previous = target.at(-1);
  if (previous && previous.fg === next.fg && previous.bg === next.bg) {
    previous.text += next.text;
    return;
  }

  target.push(next);
}

/** Flatten one highlighted HAST line into terminal-friendly styled text spans. */
function flattenHighlightedLine(
  node: HastNode | undefined,
  theme: AppTheme,
  emphasisBg: string,
  tabWidth: number,
) {
  if (!node) {
    return [];
  }

  const cacheKey = `${theme.appearance}:${emphasisBg}:${tabWidth}`;
  const cachedByTheme = flattenedHighlightedLineCache.get(node);
  const cached = cachedByTheme?.get(cacheKey);
  if (cached) {
    return cached;
  }

  const spans: RenderSpan[] = [];
  let codeColumn = 0;
  const colorVariable =
    theme.appearance === "light" ? "--diffs-token-light" : "--diffs-token-dark";

  const visit = (
    current: HastNode | undefined,
    inherited: Pick<RenderSpan, "fg" | "bg">,
  ) => {
    if (!current) {
      return;
    }

    if (current.type === "text") {
      const text = tabify(
        cleanLastNewline(current.value),
        tabWidth,
        codeColumn,
      );
      mergeSpan(spans, {
        bg: inherited.bg,
        fg: inherited.fg,
        text,
      });
      codeColumn += measureTextWidth(text);
      return;
    }

    const properties = current.properties ?? {};
    const styles = parseStyleValue(properties.style);
    const nextStyle: Pick<RenderSpan, "fg" | "bg"> = {
      bg: Object.hasOwn(properties, "data-diff-span")
        ? emphasisBg
        : inherited.bg,
      fg: styles.get(colorVariable) ?? styles.get("color") ?? inherited.fg,
    };

    for (const child of current.children ?? []) {
      visit(child, nextStyle);
    }
  };

  visit(node, {});

  const nextCachedByTheme = cachedByTheme ?? new Map<string, RenderSpan[]>();
  nextCachedByTheme.set(cacheKey, spans);
  if (!cachedByTheme) {
    flattenedHighlightedLineCache.set(node, nextCachedByTheme);
  }

  return spans;
}

/** Normalize one raw diff line before rendering. */
function cleanDiffLine(line: string | undefined, tabWidth: number) {
  return tabify(cleanLastNewline(line ?? ""), tabWidth);
}

/** Build the normalized render model for one split-view cell. */
function makeSplitCell(
  kind: SplitLineCell["kind"],
  lineNumber: number | undefined,
  rawLine: string | undefined,
  highlightedLine: HastNode | undefined,
  theme: AppTheme,
  tabWidth: number,
  moveKind?: DiffLineMoveKind,
) {
  if (kind === "empty") {
    return {
      kind,
      sign: " ",
      spans: [],
    } satisfies SplitLineCell;
  }

  let spans: RenderSpan[];
  if (highlightedLine === undefined) {
    const fallbackText = cleanDiffLine(rawLine, tabWidth);
    spans = fallbackText.length > 0 ? [{ text: fallbackText }] : [];
  } else {
    spans = flattenHighlightedLine(
      highlightedLine,
      theme,
      wordDiffHighlightBg(kind, theme),
      tabWidth,
    );

    if (spans.length === 0) {
      const fallbackText = cleanDiffLine(rawLine, tabWidth);
      spans = fallbackText.length > 0 ? [{ text: fallbackText }] : [];
    }
  }

  let sign: string;
  if (kind === "addition") {
    sign = "+";
  } else if (kind === "deletion") {
    sign = "-";
  } else {
    sign = " ";
  }

  return {
    kind,
    lineNumber,
    moveKind,
    sign,
    spans,
  } satisfies SplitLineCell;
}

/** Build the normalized render model for one stack-view cell. */
function makeStackCell(
  kind: StackLineCell["kind"],
  oldLineNumber: number | undefined,
  newLineNumber: number | undefined,
  rawLine: string | undefined,
  highlightedLine: HastNode | undefined,
  theme: AppTheme,
  tabWidth: number,
  moveKind?: DiffLineMoveKind,
) {
  let spans: RenderSpan[];
  if (highlightedLine === undefined) {
    const fallbackText = cleanDiffLine(rawLine, tabWidth);
    spans = fallbackText.length > 0 ? [{ text: fallbackText }] : [];
  } else {
    spans = flattenHighlightedLine(
      highlightedLine,
      theme,
      wordDiffHighlightBg(kind, theme),
      tabWidth,
    );

    if (spans.length === 0) {
      const fallbackText = cleanDiffLine(rawLine, tabWidth);
      spans = fallbackText.length > 0 ? [{ text: fallbackText }] : [];
    }
  }

  let sign: string;
  if (kind === "addition") {
    sign = "+";
  } else if (kind === "deletion") {
    sign = "-";
  } else {
    sign = " ";
  }

  return {
    kind,
    moveKind,
    newLineNumber,
    oldLineNumber,
    sign,
    spans,
  } satisfies StackLineCell;
}

/** Describe one collapsed unchanged region in the diff stream. */
function collapsedRowText(lines: number) {
  return `${lines} unchanged ${lines === 1 ? "line" : "lines"}`;
}

/** Build the collapsed row one resolved gap address renders as. */
function collapsedGapRow(
  file: DiffFile,
  address: ReviewGapAddress,
  keyPrefix: string,
): Extract<DiffRow, { type: "collapsed" }> {
  return {
    fileId: file.id,
    hunkIndex: address.hunkIndex,
    key: `${file.id}:${keyPrefix}${address.position === "trailing" ? "trailing" : address.hunkIndex}`,
    newRange: [...address.newRange] as [number, number],
    oldRange: [...address.oldRange] as [number, number],
    position: address.position,
    text: collapsedRowText(address.lineCount),
    type: "collapsed",
  };
}

/** Prepare syntax highlighting for one language/theme pair using Pierre's shared highlighter. */
// biome-ignore lint/suspicious/useAwait: returns a Promise directly, async needed for Awaited<> type inference
async function prepareHighlighter(
  language: string | undefined,
  theme: HighlightThemeInput,
) {
  const resolvedLanguage = language ?? "text";
  const syntaxTheme = ensureSyntaxHighlightThemeRegistered(theme);
  const cacheKey = `${syntaxTheme}:${resolvedLanguage}`;
  const options =
    highlighterOptionsByKey.get(cacheKey) ??
    getHighlighterOptions(resolvedLanguage, {
      theme: syntaxTheme,
    });

  if (!highlighterOptionsByKey.has(cacheKey)) {
    highlighterOptionsByKey.set(cacheKey, options);
  }

  return getSharedHighlighter({
    ...options,
    preferredHighlighter: "shiki-wasm",
  });
}

/** Queue highlight rendering so startup work stays serialized without starving input/render timers. */
function queueHighlightedWork<T>(run: () => T) {
  const queued = queuedHighlightWork.then(
    () =>
      new Promise<T>((resolve, reject) => {
        setTimeout(() => {
          try {
            resolve(run());
          } catch (error) {
            reject(error);
          }
        }, 0);
      }),
  );

  queuedHighlightWork = queued.then(
    () => undefined,
    () => undefined,
  );

  return queued;
}

/**
 * Pierre highlights unchanged context on both diff sides even though split/stack rendering later
 * cares only about the styled code spans. Reuse one side's line node for both arrays so identical
 * context flattens once and the existing WeakMap span cache can fan that result back out.
 */
function aliasHighlightedContextLines(
  file: DiffFile,
  highlighted: HighlightedDiffCode,
) {
  for (const hunk of file.metadata.hunks) {
    let { deletionLineIndex, additionLineIndex } = hunk;

    for (const content of hunk.hunkContent) {
      if (content.type === "context") {
        for (let offset = 0; offset < content.lines; offset += 1) {
          const sharedLine =
            highlighted.additionLines[additionLineIndex + offset] ??
            highlighted.deletionLines[deletionLineIndex + offset];

          if (!sharedLine) {
            continue;
          }

          highlighted.deletionLines[deletionLineIndex + offset] = sharedLine;
          highlighted.additionLines[additionLineIndex + offset] = sharedLine;
        }

        deletionLineIndex += content.lines;
        additionLineIndex += content.lines;
        continue;
      }

      deletionLineIndex += content.deletions;
      additionLineIndex += content.additions;
    }
  }

  return highlighted;
}

function renderHighlightedDiff(
  file: DiffFile,
  metadata: FileDiffMetadata,
  highlighter: Awaited<ReturnType<typeof prepareHighlighter>>,
  theme: HighlightThemeInput,
) {
  return queueHighlightedWork(() => {
    const highlighted = renderDiffWithHighlighter(
      metadata,
      highlighter,
      pierreRenderOptions(theme),
    );
    return aliasHighlightedContextLines(file, {
      additionLines: highlighted.code.additionLines as Array<
        HastNode | undefined
      >,
      deletionLines: highlighted.code.deletionLines as Array<
        HastNode | undefined
      >,
    });
  });
}

export async function loadHighlightedDiff(
  file: DiffFile,
  theme: HighlightThemeInput = "dark",
): Promise<HighlightedDiffCode> {
  try {
    const highlighter = await prepareHighlighter(file.language, theme);
    return await renderHighlightedDiff(file, file.metadata, highlighter, theme);
  } catch {
    const fallbackTheme = highlightThemeAppearance(theme);
    const highlighter = await prepareHighlighter("text", fallbackTheme);
    return await renderHighlightedDiff(
      file,
      { ...file.metadata, lang: "text" },
      highlighter,
      fallbackTheme,
    );
  }
}

function appendTrailingGapRow(
  file: DiffFile,
  rows: DiffRow[],
  keyPrefix: string,
) {
  const trailingGap = reviewTrailingGap(file.metadata);
  if (trailingGap) {
    rows.push(collapsedGapRow(file, trailingGap, keyPrefix));
  }
}

/** Walk one hunk's content in split view, pushing rows in shared index-tracked order. */
function processSplitHunkContent(
  hunk: Hunk,
  hunkIndex: number,
  file: DiffFile,
  deletionLines: readonly (HastNode | undefined)[],
  additionLines: readonly (HastNode | undefined)[],
  theme: AppTheme,
  tabWidth: number,
  rows: DiffRow[],
) {
  let {
    deletionLineIndex,
    additionLineIndex,
    deletionStart: deletionLineNumber,
    additionStart: additionLineNumber,
  } = hunk;

  for (const content of hunk.hunkContent) {
    if (content.type === "context") {
      for (let offset = 0; offset < content.lines; offset += 1) {
        rows.push({
          fileId: file.id,
          hunkIndex,
          key: `${file.id}:split:${hunkIndex}:context:${deletionLineIndex + offset}:${additionLineIndex + offset}`,
          left: makeSplitCell(
            "context",
            deletionLineNumber + offset,
            file.metadata.deletionLines[deletionLineIndex + offset],
            deletionLines[deletionLineIndex + offset],
            theme,
            tabWidth,
          ),
          right: makeSplitCell(
            "context",
            additionLineNumber + offset,
            file.metadata.additionLines[additionLineIndex + offset],
            additionLines[additionLineIndex + offset],
            theme,
            tabWidth,
          ),
          type: "split-line",
        });
      }

      deletionLineIndex += content.lines;
      additionLineIndex += content.lines;
      deletionLineNumber += content.lines;
      additionLineNumber += content.lines;
      continue;
    }

    const pairedLines = Math.max(content.deletions, content.additions);
    for (let offset = 0; offset < pairedLines; offset += 1) {
      const hasDeletion = offset < content.deletions;
      const hasAddition = offset < content.additions;

      rows.push({
        fileId: file.id,
        hunkIndex,
        key: `${file.id}:split:${hunkIndex}:change:${deletionLineIndex + offset}:${additionLineIndex + offset}`,
        left: hasDeletion
          ? makeSplitCell(
              "deletion",
              deletionLineNumber + offset,
              file.metadata.deletionLines[deletionLineIndex + offset],
              deletionLines[deletionLineIndex + offset],
              theme,
              tabWidth,
              file.lineMoveKinds?.deletionLines[deletionLineIndex + offset],
            )
          : makeSplitCell(
              "empty",
              undefined,
              undefined,
              undefined,
              theme,
              tabWidth,
            ),
        right: hasAddition
          ? makeSplitCell(
              "addition",
              additionLineNumber + offset,
              file.metadata.additionLines[additionLineIndex + offset],
              additionLines[additionLineIndex + offset],
              theme,
              tabWidth,
              file.lineMoveKinds?.additionLines[additionLineIndex + offset],
            )
          : makeSplitCell(
              "empty",
              undefined,
              undefined,
              undefined,
              theme,
              tabWidth,
            ),
        type: "split-line",
      });
    }

    deletionLineIndex += content.deletions;
    additionLineIndex += content.additions;
    deletionLineNumber += content.deletions;
    additionLineNumber += content.additions;
  }
}

/** Expand Pierre metadata into the flat split-view row stream consumed by the renderer. */
export function buildSplitRows(
  file: DiffFile,
  highlighted: HighlightedDiffCode | null,
  theme: AppTheme,
  tabWidth = DEFAULT_TAB_WIDTH,
): DiffRow[] {
  const rows: DiffRow[] = [];
  const deletionLines = highlighted?.deletionLines ?? [];
  const additionLines = highlighted?.additionLines ?? [];

  for (const [hunkIndex, hunk] of file.metadata.hunks.entries()) {
    const leadingGap = reviewLeadingGap(file.metadata, hunkIndex);
    if (leadingGap) {
      rows.push(collapsedGapRow(file, leadingGap, "collapsed:"));
    }

    rows.push({
      fileId: file.id,
      hunkIndex,
      key: `${file.id}:header:${hunkIndex}`,
      text: formatHunkHeader(hunk),
      type: "hunk-header",
    });

    processSplitHunkContent(
      hunk,
      hunkIndex,
      file,
      deletionLines,
      additionLines,
      theme,
      tabWidth,
      rows,
    );
  }

  appendTrailingGapRow(file, rows, "collapsed:");
  return rows;
}

/** Walk one hunk's content in stack view, pushing rows in shared index-tracked order. */
function processStackHunkContent(
  hunk: Hunk,
  hunkIndex: number,
  file: DiffFile,
  deletionLines: readonly (HastNode | undefined)[],
  additionLines: readonly (HastNode | undefined)[],
  theme: AppTheme,
  tabWidth: number,
  rows: DiffRow[],
) {
  let {
    deletionLineIndex,
    additionLineIndex,
    deletionStart: deletionLineNumber,
    additionStart: additionLineNumber,
  } = hunk;

  for (const content of hunk.hunkContent) {
    if (content.type === "context") {
      for (let offset = 0; offset < content.lines; offset += 1) {
        rows.push({
          cell: makeStackCell(
            "context",
            deletionLineNumber + offset,
            additionLineNumber + offset,
            file.metadata.additionLines[additionLineIndex + offset],
            additionLines[additionLineIndex + offset],
            theme,
            tabWidth,
          ),
          fileId: file.id,
          hunkIndex,
          key: `${file.id}:stack:${hunkIndex}:context:${deletionLineIndex + offset}:${additionLineIndex + offset}`,
          type: "stack-line",
        });
      }

      deletionLineIndex += content.lines;
      additionLineIndex += content.lines;
      deletionLineNumber += content.lines;
      additionLineNumber += content.lines;
      continue;
    }

    for (let offset = 0; offset < content.deletions; offset += 1) {
      rows.push({
        cell: makeStackCell(
          "deletion",
          deletionLineNumber + offset,
          undefined,
          file.metadata.deletionLines[deletionLineIndex + offset],
          deletionLines[deletionLineIndex + offset],
          theme,
          tabWidth,
          file.lineMoveKinds?.deletionLines[deletionLineIndex + offset],
        ),
        fileId: file.id,
        hunkIndex,
        key: `${file.id}:stack:${hunkIndex}:deletion:${deletionLineIndex + offset}`,
        type: "stack-line",
      });
    }

    for (let offset = 0; offset < content.additions; offset += 1) {
      rows.push({
        cell: makeStackCell(
          "addition",
          undefined,
          additionLineNumber + offset,
          file.metadata.additionLines[additionLineIndex + offset],
          additionLines[additionLineIndex + offset],
          theme,
          tabWidth,
          file.lineMoveKinds?.additionLines[additionLineIndex + offset],
        ),
        fileId: file.id,
        hunkIndex,
        key: `${file.id}:stack:${hunkIndex}:addition:${additionLineIndex + offset}`,
        type: "stack-line",
      });
    }

    deletionLineIndex += content.deletions;
    additionLineIndex += content.additions;
    deletionLineNumber += content.deletions;
    additionLineNumber += content.additions;
  }
}

/** Expand Pierre metadata into the flat stack-view row stream consumed by the renderer. */
export function buildStackRows(
  file: DiffFile,
  highlighted: HighlightedDiffCode | null,
  theme: AppTheme,
  tabWidth = DEFAULT_TAB_WIDTH,
): DiffRow[] {
  const rows: DiffRow[] = [];
  const deletionLines = highlighted?.deletionLines ?? [];
  const additionLines = highlighted?.additionLines ?? [];

  for (const [hunkIndex, hunk] of file.metadata.hunks.entries()) {
    const leadingGap = reviewLeadingGap(file.metadata, hunkIndex);
    if (leadingGap) {
      rows.push(collapsedGapRow(file, leadingGap, "stack:collapsed:"));
    }

    rows.push({
      fileId: file.id,
      hunkIndex,
      key: `${file.id}:stack:header:${hunkIndex}`,
      text: formatHunkHeader(hunk),
      type: "hunk-header",
    });

    processStackHunkContent(
      hunk,
      hunkIndex,
      file,
      deletionLines,
      additionLines,
      theme,
      tabWidth,
      rows,
    );
  }

  appendTrailingGapRow(file, rows, "stack:collapsed:");
  return rows;
}
