export type StmlInlineRole =
  | "strong"
  | "emphasis"
  | "underline"
  | "strike"
  | "muted"
  | "key"
  | "badge"
  | "link"
  | "styled"
  | "line-break";

export type StmlBlockRole =
  | "container"
  | "card"
  | "row"
  | "paragraph"
  | "heading"
  | "title"
  | "divider"
  | "spacer"
  | "list"
  | "ordered-list"
  | "list-item"
  | "code";

export type StmlTagRole = StmlInlineRole | StmlBlockRole;

const TAG_ROLES: Readonly<Record<string, StmlTagRole>> = {
  a: "link",
  b: "strong",
  badge: "badge",
  box: "container",
  br: "line-break",
  c: "styled",
  card: "card",
  code: "code",
  col: "container",
  color: "styled",
  column: "container",
  del: "strike",
  dim: "muted",
  divider: "divider",
  em: "emphasis",
  h: "heading",
  h1: "title",
  h2: "heading",
  h3: "heading",
  heading: "heading",
  hr: "divider",
  i: "emphasis",
  item: "list-item",
  kbd: "key",
  li: "list-item",
  link: "link",
  list: "list",
  muted: "muted",
  ol: "ordered-list",
  p: "paragraph",
  pre: "code",
  row: "row",
  rule: "divider",
  s: "strike",
  section: "container",
  space: "spacer",
  spacer: "spacer",
  span: "styled",
  stack: "container",
  strike: "strike",
  strong: "strong",
  text: "paragraph",
  title: "title",
  u: "underline",
  ul: "list",
};

const INLINE_ROLES: ReadonlySet<StmlTagRole> = new Set<StmlInlineRole>([
  "strong",
  "emphasis",
  "underline",
  "strike",
  "muted",
  "key",
  "badge",
  "link",
  "styled",
  "line-break",
]);

const VOID_ROLES: ReadonlySet<StmlTagRole> = new Set<StmlTagRole>([
  "line-break",
  "divider",
  "spacer",
]);

const RAW_TEXT_ROLES: ReadonlySet<StmlTagRole> = new Set<StmlTagRole>(["code"]);

/** Resolve one lowercase tag name to its role, or undefined when the tag is unknown. */
export function stmlTagRole(tag: string): StmlTagRole | undefined {
  return TAG_ROLES[tag];
}

/** Return whether one role participates in inline flow rather than block layout. */
export function isInlineStmlRole(
  role: StmlTagRole | undefined,
): role is StmlInlineRole {
  return role !== undefined && INLINE_ROLES.has(role);
}

/** Return whether one tag never has children, so a closing tag for it is noise. */
export function isVoidStmlTag(tag: string) {
  const role = stmlTagRole(tag);
  return role !== undefined && VOID_ROLES.has(role);
}

/** Return whether one tag's content is verbatim text rather than nested markup. */
export function isRawTextStmlTag(tag: string) {
  const role = stmlTagRole(tag);
  return role !== undefined && RAW_TEXT_ROLES.has(role);
}
