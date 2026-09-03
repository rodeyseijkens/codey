import { measureTextWidth, sliceTextByWidth } from "../diff/text";
import { isInlineStmlRole, stmlTagRole } from "../review/stml";
import {
  decodeStmlEntities,
  parseStml,
  type StmlElement,
  type StmlNode,
} from "./parse";

export type StmlStyle = {
  bg?: string;
  bold?: boolean;
  dim?: boolean;
  fg?: string;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
};

export interface StmlSpan extends StmlStyle {
  text: string;
}

export type StmlLine = {
  spans: StmlSpan[];
};

export type StmlLayoutResult = {
  errors: string[];
  lines: StmlLine[];
};

/** Minimum content width the layout engine will attempt to fill. */
export const MIN_STML_LAYOUT_WIDTH = 8;

export const STML_REFERENCE_WIDTH = 56;

/** Lay out markup at one note width and return its render notes. */
export function validateStmlMarkup(
  markup: string,
  width: number = STML_REFERENCE_WIDTH,
): string[] {
  return layoutStmlCached(markup, width).errors;
}

const MAX_LAYOUT_ERRORS = 20;

/** Answer whether a tag joins inline flow, using core's shared tag vocabulary. */
const isInlineTag = (tag: string) => isInlineStmlRole(stmlTagRole(tag));

type BorderChars = {
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  topLeft: string;
  topRight: string;
  vertical: string;
};

const BORDER_STYLES: Record<string, BorderChars> = {
  double: {
    bottomLeft: "╚",
    bottomRight: "╝",
    horizontal: "═",
    topLeft: "╔",
    topRight: "╗",
    vertical: "║",
  },
  heavy: {
    bottomLeft: "┗",
    bottomRight: "┛",
    horizontal: "━",
    topLeft: "┏",
    topRight: "┓",
    vertical: "┃",
  },
  rounded: {
    bottomLeft: "╰",
    bottomRight: "╯",
    horizontal: "─",
    topLeft: "╭",
    topRight: "╮",
    vertical: "│",
  },
  single: {
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    topLeft: "┌",
    topRight: "┐",
    vertical: "│",
  },
};

const truthyAttr = (value: string | undefined) =>
  value === undefined ||
  value === "" ||
  value === "true" ||
  value === "yes" ||
  value === "on";

const collapseWs = (text: string) => text.replace(/\s+/g, " ");

const mergeStyle = (base: StmlStyle, over: StmlStyle): StmlStyle => ({
  ...base,
  ...over,
});

function numAttr(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/** Resolve a width attribute (cells or percentage of the available width). */
function widthAttr(
  value: string | undefined,
  available: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  // biome-ignore lint/performance/useTopLevelRegex: simple percentage regex in utility
  const percent = /^(\d+(?:\.\d+)?)%$/.exec(value);
  if (percent) {
    return Math.max(1, Math.floor((available * Number(percent[1])) / 100));
  }
  const n = numAttr(value);
  return n === undefined ? undefined : Math.max(1, Math.floor(n));
}

function attrStyle(attrs: Record<string, string>): StmlStyle {
  const style: StmlStyle = {};
  if (attrs.fg) {
    style.fg = attrs.fg;
  }
  if (attrs.bg) {
    style.bg = attrs.bg;
  }
  if ("bold" in attrs) {
    style.bold = truthyAttr(attrs.bold);
  }
  if ("italic" in attrs) {
    style.italic = truthyAttr(attrs.italic);
  }
  if ("underline" in attrs) {
    style.underline = truthyAttr(attrs.underline);
  }
  if ("dim" in attrs) {
    style.dim = truthyAttr(attrs.dim);
  }
  if ("strike" in attrs) {
    style.strike = truthyAttr(attrs.strike);
  }
  return style;
}

function inlineStyle(tag: string, attrs: Record<string, string>): StmlStyle {
  switch (stmlTagRole(tag)) {
    case "strong":
      return { bold: true };
    case "emphasis":
      return { italic: true };
    case "underline":
      return { underline: true };
    case "strike":
      return { strike: true };
    case "muted":
      return { dim: true };
    case "key":
      return { bg: "subtle", fg: "heading" };
    case "badge":
      return {
        bg: attrs.color,
        bold: true,
        fg: attrs.fg,
      };
    case "link":
      return { fg: "accent", underline: true };
    default:
      return attrStyle(attrs);
  }
}

class LayoutErrors {
  readonly messages: string[] = [];

  add(message: string) {
    if (this.messages.length < MAX_LAYOUT_ERRORS) {
      this.messages.push(message);
    } else if (this.messages.length === MAX_LAYOUT_ERRORS) {
      this.messages.push("further layout notes omitted");
    }
  }
}

/** Flatten one inline subtree into styled spans; `\n` spans mark hard breaks. */
function inlineSpans(node: StmlNode, style: StmlStyle): StmlSpan[] {
  if (node.type === "text") {
    const text = collapseWs(decodeStmlEntities(node.value));
    return text === "" ? [] : [{ ...style, text }];
  }
  const role = stmlTagRole(node.tag);
  if (role === "line-break") {
    return [{ ...style, text: "\n" }];
  }
  const next = mergeStyle(style, inlineStyle(node.tag, node.attrs));
  const padded = role === "badge" || role === "key";
  const out: StmlSpan[] = [];
  if (padded) {
    out.push({ ...next, text: " " });
  }
  for (const child of node.children) {
    out.push(...inlineSpans(child, next));
  }
  if (padded) {
    out.push({ ...next, text: " " });
  }
  return out;
}

type InlineToken = {
  kind: "word" | "space" | "break";
  span: StmlSpan;
  width: number;
};

/** Split styled spans into wrap-safe word/space/break tokens. */
function tokenizeSpans(spans: StmlSpan[]): InlineToken[] {
  const tokens: InlineToken[] = [];
  for (const span of spans) {
    // biome-ignore lint/performance/useTopLevelRegex: used once in rare utility function
    const parts = span.text.split(/(\n| +)/);
    for (const part of parts) {
      if (part === "") {
        continue;
      }
      if (part === "\n") {
        tokens.push({ kind: "break", span: { ...span, text: "\n" }, width: 0 });
        // biome-ignore lint/performance/useTopLevelRegex: used once in rare utility function
      } else if (/^ +$/.test(part) && !span.bg) {
        tokens.push({
          kind: "space",
          span: { ...span, text: part },
          width: part.length,
        });
      } else {
        tokens.push({
          kind: "word",
          span: { ...span, text: part },
          width: measureTextWidth(part),
        });
      }
    }
  }
  return tokens;
}

function sameStyle(a: StmlStyle, b: StmlStyle): boolean {
  return (
    a.fg === b.fg &&
    a.bg === b.bg &&
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.dim === b.dim &&
    a.strike === b.strike
  );
}

/** Append a span to a line, merging with the previous span when styles match. */
function pushSpan(line: StmlLine, span: StmlSpan) {
  const last = line.spans.at(-1);
  if (last && sameStyle(last, span)) {
    last.text += span.text;
  } else {
    line.spans.push({ ...span });
  }
}

/** Greedy word-wrap styled spans into lines no wider than `width`. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: word-wrapping with token awareness and inline style consolidation is inherently complex
function wrapSpans(spans: StmlSpan[], width: number): StmlLine[] {
  const usable = Math.max(1, width);
  const tokens = tokenizeSpans(spans);
  const lines: StmlLine[] = [];
  let current: StmlLine = { spans: [] };
  let currentWidth = 0;
  let started = false;

  const flush = () => {
    while (current.spans.length > 0) {
      // biome-ignore lint/style/noNonNullAssertion: algorithmically safe, flush only runs when spans exist
      const last = current.spans.at(-1)!;
      // biome-ignore lint/performance/useTopLevelRegex: used once in rare utility function
      if (last.bg || !/^ *$/.test(last.text)) {
        // biome-ignore lint/performance/useTopLevelRegex: used once in rare utility function
        last.text = last.bg ? last.text : last.text.replace(/ +$/, "");
        break;
      }
      current.spans.pop();
    }
    lines.push(current);
    current = { spans: [] };
    currentWidth = 0;
    started = false;
  };

  for (const token of tokens) {
    if (token.kind === "break") {
      flush();
      continue;
    }
    if (token.kind === "space") {
      if (!started) {
        continue;
      }
      if (currentWidth + token.width > usable) {
        flush();
        continue;
      }
      pushSpan(current, token.span);
      currentWidth += token.width;
      continue;
    }

    if (currentWidth + token.width <= usable) {
      pushSpan(current, token.span);
      currentWidth += token.width;
      started = true;
      continue;
    }

    if (started) {
      flush();
    }

    let rest = token.span.text;
    while (measureTextWidth(rest) > usable) {
      const slice = sliceTextByWidth(rest, 0, usable);
      if (slice.text.length === 0) {
        break;
      }
      pushSpan(current, { ...token.span, text: slice.text });
      flush();
      rest = rest.slice(slice.text.length);
    }
    if (rest.length > 0) {
      pushSpan(current, { ...token.span, text: rest });
      currentWidth = measureTextWidth(rest);
      started = true;
    }
  }

  if (current.spans.length > 0 || lines.length === 0) {
    lines.push(current);
  }
  return lines;
}

function lineWidth(line: StmlLine): number {
  return line.spans.reduce(
    (total, span) => total + measureTextWidth(span.text),
    0,
  );
}

/** Pad every line to an exact width, filling with the block background. */
function padLines(lines: StmlLine[], width: number, bg?: string): StmlLine[] {
  return lines.map((line) => {
    const spans = bg
      ? line.spans.map((span) => ({ ...span, bg: span.bg ?? bg }))
      : line.spans.map((span) => ({ ...span }));
    const used = lineWidth({ spans });
    if (used < width) {
      spans.push({ text: " ".repeat(width - used), ...(bg ? { bg } : {}) });
    }
    return { spans };
  });
}

const rawText = (el: StmlElement) =>
  el.children
    .map((child) => (child.type === "text" ? child.value : ""))
    .join("");

function dedent(text: string): string {
  // biome-ignore lint/performance/useTopLevelRegex: used once in rare utility function
  const lines = text.replace(/^\n/, "").replace(/\s+$/, "").split("\n");
  let min = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    if (line.trim() === "") {
      continue;
    }
    min = Math.min(min, line.length - line.trimStart().length);
  }
  if (!Number.isFinite(min) || min === 0) {
    return lines.join("\n");
  }
  return lines.map((line) => line.slice(min)).join("\n");
}

function borderChars(
  styleAttr: string | undefined,
  fallback: keyof typeof BORDER_STYLES,
) {
  if (styleAttr && BORDER_STYLES[styleAttr]) {
    // biome-ignore lint/style/noNonNullAssertion: BORDER_STYLES has fallback
    return { chars: BORDER_STYLES[styleAttr]!, unknown: false };
  }
  // biome-ignore lint/style/noNonNullAssertion: BORDER_STYLES has fallback
  return { chars: BORDER_STYLES[fallback]!, unknown: styleAttr !== undefined };
}

/** Wrap block content in a box frame with optional title and padding. */
function frameLines(
  content: StmlLine[],
  {
    width,
    border,
    chars,
    borderColor,
    title,
    titleColor,
    bg,
    paddingX,
    paddingY,
  }: {
    width: number;
    border: boolean;
    chars: BorderChars;
    borderColor: string;
    title?: string;
    titleColor: string;
    bg?: string;
    paddingX: number;
    paddingY: number;
  },
): StmlLine[] {
  const innerWidth = Math.max(1, width - (border ? 2 : 0) - paddingX * 2);
  const padded = padLines(content, innerWidth, bg);
  const sidePad: StmlSpan | null =
    paddingX > 0 ? { text: " ".repeat(paddingX), ...(bg ? { bg } : {}) } : null;

  const bodyLines: StmlLine[] = [];
  const blankRow = (): StmlLine => ({
    spans: [
      { text: " ".repeat(innerWidth + paddingX * 2), ...(bg ? { bg } : {}) },
    ],
  });

  for (let i = 0; i < paddingY; i += 1) {
    bodyLines.push(blankRow());
  }
  for (const line of padded) {
    const spans: StmlSpan[] = [];
    if (sidePad) {
      spans.push({ ...sidePad });
    }
    spans.push(...line.spans);
    if (sidePad) {
      spans.push({ ...sidePad });
    }
    bodyLines.push({ spans });
  }
  for (let i = 0; i < paddingY; i += 1) {
    bodyLines.push(blankRow());
  }

  if (!border) {
    return bodyLines;
  }

  const horizontalWidth = Math.max(0, width - 2);
  const top: StmlLine = { spans: [] };
  if (title && title.trim() !== "") {
    const label = ` ${title.trim()} `;
    const fitted = sliceTextByWidth(
      label,
      0,
      Math.max(0, horizontalWidth - 2),
    ).text;
    const remainder = Math.max(
      0,
      horizontalWidth - 1 - measureTextWidth(fitted),
    );
    top.spans.push({
      fg: borderColor,
      text: `${chars.topLeft}${chars.horizontal}`,
    });
    top.spans.push({ bold: true, fg: titleColor, text: fitted });
    top.spans.push({
      fg: borderColor,
      text: `${chars.horizontal.repeat(remainder)}${chars.topRight}`,
    });
  } else {
    top.spans.push({
      fg: borderColor,
      text: `${chars.topLeft}${chars.horizontal.repeat(horizontalWidth)}${chars.topRight}`,
    });
  }

  const bottom: StmlLine = {
    spans: [
      {
        fg: borderColor,
        text: `${chars.bottomLeft}${chars.horizontal.repeat(horizontalWidth)}${chars.bottomRight}`,
      },
    ],
  };

  const framed: StmlLine[] = [top];
  for (const line of bodyLines) {
    framed.push({
      spans: [
        { fg: borderColor, text: chars.vertical, ...(bg ? { bg } : {}) },
        ...line.spans,
        { fg: borderColor, text: chars.vertical, ...(bg ? { bg } : {}) },
      ],
    });
  }
  framed.push(bottom);
  return framed;
}

/** Lay out one bullet/numbered item with a hanging indent. */
function bulletLines(
  prefix: string,
  children: StmlNode[],
  width: number,
  style: StmlStyle,
  errors: LayoutErrors,
): StmlLine[] {
  const prefixWidth = measureTextWidth(prefix);
  const bodyWidth = Math.max(1, width - prefixWidth);
  const body = layoutBlockNodes(children, bodyWidth, style, errors);
  return body.map((line, index) => ({
    spans: [
      index === 0
        ? { fg: "muted", text: prefix }
        : { text: " ".repeat(prefixWidth) },
      ...line.spans,
    ],
  }));
}

/** Merge column line lists side by side, padding shorter columns. */
function mergeColumns(
  columns: StmlLine[][],
  widths: number[],
  gap: number,
): StmlLine[] {
  const height = Math.max(0, ...columns.map((column) => column.length));
  const merged: StmlLine[] = [];
  for (let rowIndex = 0; rowIndex < height; rowIndex += 1) {
    const spans: StmlSpan[] = [];
    columns.forEach((column, columnIndex) => {
      if (columnIndex > 0 && gap > 0) {
        spans.push({ text: " ".repeat(gap) });
      }
      // biome-ignore lint/style/noNonNullAssertion: widths array index is in bounds
      const width = widths[columnIndex]!;
      const line = column[rowIndex];
      if (line) {
        spans.push(...line.spans);
        const used = lineWidth(line);
        if (used < width) {
          spans.push({ text: " ".repeat(width - used) });
        }
      } else {
        spans.push({ text: " ".repeat(width) });
      }
    });
    merged.push({ spans });
  }
  return merged;
}

function layoutRow(
  el: StmlElement,
  width: number,
  style: StmlStyle,
  errors: LayoutErrors,
): StmlLine[] {
  const children = el.children.filter(
    (child): child is StmlElement =>
      child.type === "element" && !isInlineTag(child.tag),
  );
  const looseInline = el.children.filter(
    (child) =>
      child.type === "text" ||
      (child.type === "element" && isInlineTag(child.tag)),
  );

  if (children.length === 0) {
    return layoutBlockNodes(el.children, width, style, errors);
  }
  if (
    looseInline.some((node) => node.type !== "text" || node.value.trim() !== "")
  ) {
    errors.add(
      "<row> mixes bare text with block children; text laid out above the row",
    );
  }

  const gap = Math.max(0, numAttr(el.attrs.gap) ?? 1);
  const totalGap = gap * (children.length - 1);
  const available = width - totalGap;

  const fixed = children.map((child) =>
    widthAttr(child.attrs.width, available),
  );
  const fixedTotal = fixed.reduce<number>((total, w) => total + (w ?? 0), 0);
  const flexCount = fixed.filter((w) => w === undefined).length;
  const flexSpace = Math.max(flexCount, available - fixedTotal);
  const flexWidth = flexCount > 0 ? Math.floor(flexSpace / flexCount) : 0;
  let flexRemainder = flexCount > 0 ? flexSpace - flexWidth * flexCount : 0;

  if (available < children.length) {
    errors.add("<row> too narrow for its columns; stacking vertically");
    return children.flatMap((child) =>
      layoutBlock(child, width, style, errors),
    );
  }

  const widths = fixed.map((w) => {
    if (w !== undefined) {
      return Math.max(1, Math.min(w, available));
    }
    const extra = flexRemainder > 0 ? 1 : 0;
    flexRemainder -= extra;
    return Math.max(1, flexWidth + extra);
  });

  const inlinePrefix =
    looseInline.length > 0
      ? layoutBlockNodes(looseInline, width, style, errors)
      : [];
  const columns = children.map((child, index) =>
    // biome-ignore lint/style/noNonNullAssertion: widths array is sized to match children
    layoutBlock(child, widths[index]!, style, errors),
  );
  return [...inlinePrefix, ...mergeColumns(columns, widths, gap)];
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: layoutBlock dispatches 10+ tag roles (box, table, ordered-list, code, etc.) each with different layout rules — the complexity is the tag vocabulary
function layoutBlock(
  el: StmlElement,
  width: number,
  style: StmlStyle,
  errors: LayoutErrors,
): StmlLine[] {
  const { tag } = el;
  const role = stmlTagRole(tag);
  switch (role) {
    case "container":
    case "card": {
      const isCard = role === "card";
      const border =
        "border" in el.attrs
          ? truthyAttr(el.attrs.border)
          : isCard || "border-style" in el.attrs;
      const { chars, unknown } = borderChars(
        el.attrs["border-style"],
        isCard ? "rounded" : "single",
      );
      if (unknown) {
        errors.add(`unknown border-style "${el.attrs["border-style"]}"`);
      }
      const padding = Math.max(
        0,
        numAttr(el.attrs.padding) ?? (isCard ? 1 : 0),
      );
      const paddingX = Math.max(0, numAttr(el.attrs["padding-x"]) ?? padding);
      const paddingY = Math.max(0, numAttr(el.attrs["padding-y"]) ?? padding);
      const requestedWidth = widthAttr(el.attrs.width, width);
      const boxWidth = Math.max(4, Math.min(requestedWidth ?? width, width));
      const innerWidth = Math.max(
        1,
        boxWidth - (border ? 2 : 0) - paddingX * 2,
      );
      const childStyle = mergeStyle(style, attrStyle(el.attrs));
      const content = layoutBlockNodes(
        el.children,
        innerWidth,
        childStyle,
        errors,
      );
      return frameLines(content, {
        bg: el.attrs.bg,
        border,
        // biome-ignore lint/suspicious/noUnnecessaryConditions: el.attrs values are always strings but ?? is safe default
        borderColor: el.attrs["border-color"] ?? "note-border",
        chars,
        paddingX,
        paddingY,
        title: el.attrs.title,
        // biome-ignore lint/suspicious/noUnnecessaryConditions: el.attrs values are always strings but ?? is safe default
        titleColor: el.attrs["title-color"] ?? "heading",
        width: boxWidth,
      });
    }

    case "row":
      return layoutRow(el, width, style, errors);

    case "paragraph":
      return wrapSpans(
        el.children.flatMap((child) =>
          inlineSpans(child, mergeStyle(style, attrStyle(el.attrs))),
        ),
        width,
      );

    case "heading":
    case "title": {
      const base = mergeStyle(style, {
        bold: true,
        fg: el.attrs.fg,
      });
      if (role === "title") {
        base.underline = true;
      }
      return wrapSpans(
        el.children.flatMap((child) => inlineSpans(child, base)),
        width,
      );
    }

    case "divider":
      return [
        {
          spans: [
            {
              fg: el.attrs.color,
              text: "─".repeat(Math.max(1, width)),
            },
          ],
        },
      ];

    case "spacer": {
      const size = Math.max(1, Math.min(20, numAttr(el.attrs.size) ?? 1));
      return Array.from({ length: size }, () => ({ spans: [{ text: "" }] }));
    }

    case "list":
    case "ordered-list": {
      const ordered = role === "ordered-list";
      const { marker } = el.attrs;
      const lines: StmlLine[] = [];
      let index = 1;
      for (const child of el.children) {
        if (
          child.type !== "element" ||
          stmlTagRole(child.tag) !== "list-item"
        ) {
          continue;
        }
        const prefix = ordered ? `${index + 1}. ` : `${marker} `;
        index += 1;
        lines.push(
          ...bulletLines(prefix, child.children, width, style, errors),
        );
      }
      return lines;
    }

    case "list-item":
      return bulletLines("• ", el.children, width, style, errors);

    case "code": {
      const { chars } = borderChars(el.attrs["border-style"], "single");
      // biome-ignore lint/suspicious/noUnnecessaryConditions: el.attrs values are always strings but ?? is safe default
      const codeStyle: StmlStyle = { ...style, fg: el.attrs.fg ?? style.fg };
      const codeWidth = Math.max(1, width - 4);
      const content = dedent(rawText(el))
        .split("\n")
        .map((line): StmlLine => {
          const fitted = sliceTextByWidth(
            line.replaceAll("\t", "  "),
            0,
            codeWidth,
          );
          return { spans: [{ ...codeStyle, text: fitted.text }] };
        });
      return frameLines(content, {
        bg: el.attrs.bg,
        border: true,
        // biome-ignore lint/suspicious/noUnnecessaryConditions: el.attrs values are always strings but ?? is safe default
        borderColor: el.attrs["border-color"] ?? "subtle",
        chars,
        paddingX: 1,
        paddingY: 0,
        title: el.attrs.title,
        titleColor: "heading",
        width,
      });
    }

    default: {
      errors.add(`unknown tag <${tag}>`);
      return layoutBlockNodes(el.children, width, style, errors);
    }
  }
}

/** Walk a child list: group consecutive inline nodes, lay out blocks one by one. */
function layoutBlockNodes(
  nodes: StmlNode[],
  width: number,
  style: StmlStyle,
  errors: LayoutErrors,
): StmlLine[] {
  const out: StmlLine[] = [];
  let run: StmlNode[] = [];

  const flush = () => {
    if (run.length === 0) {
      return;
    }
    const spans = run.flatMap((node) => inlineSpans(node, style));
    const meaningful = spans.some(
      (span) => span.text.trim() !== "" || span.text === "\n",
    );
    if (meaningful) {
      out.push(...wrapSpans(spans, width));
    }
    run = [];
  };

  for (const node of nodes) {
    if (node.type === "text" || isInlineTag(node.tag)) {
      run.push(node);
      continue;
    }
    flush();
    out.push(...layoutBlock(node, width, style, errors));
  }
  flush();
  return out;
}

/** Parse STML markup and lay it out into styled lines for a given width. */
export function layoutStml(markup: string, width: number): StmlLayoutResult {
  if (width < MIN_STML_LAYOUT_WIDTH) {
    return {
      errors: [`width ${width} below minimum ${MIN_STML_LAYOUT_WIDTH}`],
      lines: [],
    };
  }

  const errors = new LayoutErrors();
  const parsed = parseStml(markup);
  for (const message of parsed.errors) {
    errors.add(message);
  }

  const lines = layoutBlockNodes(parsed.nodes, width, {}, errors);

  while (
    lines.length > 0 &&
    // biome-ignore lint/style/noNonNullAssertion: length > 0 guarantees first element exists
    lineWidth(lines[0]!) === 0 &&
    lines[0]?.spans.every((s) => s.text.trim() === "")
  ) {
    lines.shift();
  }
  while (
    lines.length > 0 &&
    // biome-ignore lint/style/noNonNullAssertion: length > 0 guarantees last element exists
    lineWidth(lines.at(-1)!) === 0 &&
    lines.at(-1)?.spans.every((s) => s.text.trim() === "")
  ) {
    lines.pop();
  }

  return { errors: errors.messages, lines };
}

const layoutCache = new Map<string, StmlLayoutResult>();
const LAYOUT_CACHE_LIMIT = 256;

/** Memoized layoutStml for the hot measure/render path. */
export function layoutStmlCached(
  markup: string,
  width: number,
): StmlLayoutResult {
  const key = `${width} ${markup}`;
  const cached = layoutCache.get(key);
  if (cached) {
    return cached;
  }
  const result = layoutStml(markup, width);
  if (layoutCache.size >= LAYOUT_CACHE_LIMIT) {
    layoutCache.clear();
  }
  layoutCache.set(key, result);
  return result;
}
