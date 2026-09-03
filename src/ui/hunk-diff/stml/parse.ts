import { sanitizeTerminalText } from "../diff/terminalText";
import { isRawTextStmlTag, isVoidStmlTag } from "../review/stml";
import { utf8ByteLength } from "../review/validation";

export type StmlText = {
  type: "text";
  value: string;
};

export type StmlElement = {
  attrs: Record<string, string>;
  children: StmlNode[];
  tag: string;
  type: "element";
};

export type StmlNode = StmlText | StmlElement;

export type StmlParseResult = {
  errors: string[];
  nodes: StmlNode[];
};

export type StmlParseOptions = {
  maxDepth?: number;
  maxErrors?: number;
  maxInputBytes?: number;
  maxNodes?: number;
};

export const DEFAULT_STML_PARSE_LIMITS = {
  maxDepth: 32,
  maxErrors: 20,
  maxInputBytes: 64 * 1024,
  maxNodes: 2000,
} as const satisfies Required<StmlParseOptions>;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  bull: "•",
  check: "✓",
  cross: "✗",
  darr: "↓",
  gt: ">",
  hellip: "…",
  larr: "←",
  lt: "<",
  mdash: "—",
  middot: "·",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rarr: "→",
  times: "×",
  uarr: "↑",
};

function isValidCodePoint(code: number): boolean {
  return Number.isInteger(code) && code >= 0 && code <= 0x10_ff_ff;
}

/** Decode a small, predictable entity set; unknown entities stay literal. */
export function decodeStmlEntities(text: string): string {
  return text.replace(
    /&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]+);/g,
    (whole, body: string) => {
      if (body[0] !== "#") {
        return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
      }

      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      return isValidCodePoint(code) ? String.fromCodePoint(code) : whole;
    },
  );
}

/** Neutralize control sequences in agent markup before it reaches the TUI. */
function sanitizeStmlText(text: string): string {
  return sanitizeTerminalText(text, {
    preserveNewlines: true,
    preserveTabs: false,
  });
}

const isSpace = (ch: string) =>
  ch === " " || ch === "\t" || ch === "\n" || ch === "\r" || ch === "\f";
const nameCharRegex = /[a-zA-Z0-9\-_]/;
const tagStartRegex = /[a-zA-Z]/;
const isNameChar = (ch: string) => nameCharRegex.test(ch);
const isTagStart = (ch: string | undefined) =>
  ch !== undefined && tagStartRegex.test(ch);
const replacementCharRegex = /�$/;

/** Parse STML markup into a tolerant node tree; never throws. */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: parseStml is a character-level HTML-like parser with error recovery, entity decoding, and nested tag handling — the complexity is the parsing algorithm
export function parseStml(
  input: string,
  options: StmlParseOptions = {},
): StmlParseResult {
  const limits: Required<StmlParseOptions> = {
    ...DEFAULT_STML_PARSE_LIMITS,
    ...options,
  };
  const errors: string[] = [];
  const addError = limitedErrorCollector(errors, limits.maxErrors);
  const root: StmlNode[] = [];
  const stack: StmlElement[] = [];
  const top = (): StmlNode[] =>
    stack.length > 0 ? (stack.at(-1)?.children ?? []) : root;

  let source = input;
  const bytes = utf8ByteLength(source);
  if (bytes > limits.maxInputBytes) {
    source = truncateUtf8(source, limits.maxInputBytes);
    addError(`input truncated at ${limits.maxInputBytes} byte(s)`);
  }

  let i = 0;
  const n = source.length;
  let nodeCount = 0;
  let nodeLimitReached = false;

  const canAddNode = () => {
    if (nodeCount < limits.maxNodes) {
      nodeCount += 1;
      return true;
    }
    if (!nodeLimitReached) {
      nodeLimitReached = true;
      addError(
        `node limit reached at ${limits.maxNodes} node(s); remaining markup ignored`,
      );
    }
    return false;
  };

  const pushText = (value: string) => {
    if (value.length === 0 || nodeLimitReached) {
      return;
    }
    const safe = sanitizeStmlText(value);
    if (safe.length === 0) {
      return;
    }
    const siblings = top();
    const last = siblings.at(-1);
    if (last && last.type === "text") {
      last.value += safe;
    } else if (canAddNode()) {
      siblings.push({ type: "text", value: safe });
    }
  };

  while (i < n && !nodeLimitReached) {
    const lt = source.indexOf("<", i);
    if (lt === -1) {
      pushText(source.slice(i));
      break;
    }
    if (lt > i) {
      pushText(source.slice(i, lt));
    }
    if (nodeLimitReached) {
      break;
    }
    i = lt;

    if (source.startsWith("<!--", i)) {
      const end = source.indexOf("-->", i + 4);
      i = end === -1 ? n : end + 3;
      continue;
    }

    if (source[i + 1] === "/") {
      let j = i + 2;
      let name = "";
      while (j < n && isNameChar(source[j] ?? "")) {
        name += source[j];
        j += 1;
      }
      while (j < n && source[j] !== ">") {
        j += 1;
      }
      i = j + 1;
      name = name.toLowerCase();
      const idx = findOpen(stack, name);
      if (idx === -1) {
        addError(`stray closing tag </${name}>`);
      } else {
        if (idx !== stack.length - 1) {
          addError(
            `closing </${name}> implicitly closed ${stack.length - 1 - idx} tag(s)`,
          );
        }
        stack.length = idx;
      }
      continue;
    }

    if (!isTagStart(source[i + 1])) {
      pushText("<");
      i += 1;
      continue;
    }

    const open = readOpenTag(source, i);
    if (!open) {
      pushText("<");
      i += 1;
      continue;
    }
    i = open.next;

    if (stack.length >= limits.maxDepth) {
      addError(
        `depth limit reached at <${open.tag}> (${limits.maxDepth} level(s))`,
      );
      continue;
    }
    if (!canAddNode()) {
      break;
    }

    const el: StmlElement = {
      attrs: open.attrs,
      children: [],
      tag: open.tag,
      type: "element",
    };
    top().push(el);

    if (open.selfClosing || isVoidStmlTag(open.tag)) {
      continue;
    }

    if (isRawTextStmlTag(open.tag)) {
      const close = `</${open.tag}`;
      const end = indexOfCloser(source, i, close);
      const raw = source.slice(i, end === -1 ? n : end);
      if (raw.length > 0 && canAddNode()) {
        el.children.push({ type: "text", value: sanitizeStmlText(raw) });
      }
      if (end === -1) {
        addError(`unclosed <${open.tag}>`);
        i = n;
      } else {
        const gt = source.indexOf(">", end);
        i = gt === -1 ? n : gt + 1;
      }
      continue;
    }

    stack.push(el);
  }

  if (stack.length > 0) {
    addError(`unclosed tag(s): ${stack.map((e) => `<${e.tag}>`).join(", ")}`);
  }
  return { errors, nodes: root };
}

function limitedErrorCollector(
  errors: string[],
  maxErrors: number,
): (message: string) => void {
  let omitted = false;
  return (message: string) => {
    if (errors.length < maxErrors) {
      errors.push(message);
      return;
    }
    if (!omitted) {
      omitted = true;
      if (errors.length === 0) {
        return;
      }
      errors[errors.length - 1] =
        `${errors.at(-1)} (further parse errors omitted)`;
    }
  };
}

function truncateUtf8(text: string, maxBytes: number): string {
  const bytes = new TextEncoder().encode(text).slice(0, maxBytes);
  return new TextDecoder("utf-8", { fatal: false })
    .decode(bytes)
    .replace(replacementCharRegex, "");
}

function findOpen(stack: StmlElement[], name: string): number {
  for (let k = stack.length - 1; k >= 0; k -= 1) {
    if (stack[k]?.tag === name) {
      return k;
    }
  }
  return -1;
}

function indexOfCloser(input: string, from: number, closer: string): number {
  return input.toLowerCase().indexOf(closer.toLowerCase(), from);
}

type OpenTag = {
  attrs: Record<string, string>;
  next: number;
  selfClosing: boolean;
  tag: string;
};

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: readOpenTag handles tag name, quoted attributes, and unquoted attribute values — the complexity is the attribute parsing grammar
function readOpenTag(input: string, start: number): OpenTag | null {
  const n = input.length;
  let i = start + 1;
  let tag = "";
  while (i < n && isNameChar(input[i] ?? "")) {
    tag += input[i];
    i += 1;
  }
  if (!tag) {
    return null;
  }
  tag = tag.toLowerCase();
  const attrs: Record<string, string> = {};

  while (i < n) {
    while (i < n && isSpace(input[i] ?? "")) {
      i += 1;
    }
    if (i >= n) {
      break;
    }
    if (input[i] === ">") {
      return { attrs, next: i + 1, selfClosing: false, tag };
    }
    if (input[i] === "/" && input[i + 1] === ">") {
      return { attrs, next: i + 2, selfClosing: true, tag };
    }
    let name = "";
    while (i < n && isNameChar(input[i] ?? "")) {
      name += input[i];
      i += 1;
    }
    if (!name) {
      i += 1;
      continue;
    }
    name = name.toLowerCase();
    while (i < n && isSpace(input[i] ?? "")) {
      i += 1;
    }
    if (input[i] === "=") {
      i += 1;
      while (i < n && isSpace(input[i] ?? "")) {
        i += 1;
      }
      const quote = input[i];
      if (quote === '"' || quote === "'") {
        i += 1;
        let value = "";
        while (i < n && input[i] !== quote) {
          value += input[i];
          i += 1;
        }
        i += 1;
        attrs[name] = sanitizeStmlText(decodeStmlEntities(value));
      } else {
        let value = "";
        while (
          i < n &&
          !isSpace(input[i] ?? "") &&
          input[i] !== ">" &&
          !(input[i] === "/" && input[i + 1] === ">")
        ) {
          value += input[i];
          i += 1;
        }
        attrs[name] = sanitizeStmlText(decodeStmlEntities(value));
      }
    } else {
      attrs[name] = "";
    }
  }
  return { attrs, next: n, selfClosing: false, tag };
}
