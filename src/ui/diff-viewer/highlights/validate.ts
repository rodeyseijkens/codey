export type ExtensionLineHighlightTone =
  | "match"
  | "current"
  | "info"
  | "warning"
  | "error";

export type ValidatedLineHighlight = {
  readonly end: number;
  readonly line: number;
  readonly side: "old" | "new";
  readonly start: number;
  readonly tone: ExtensionLineHighlightTone;
};
