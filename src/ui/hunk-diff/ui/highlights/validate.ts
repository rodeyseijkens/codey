export type ExtensionLineHighlightTone =
  | "match"
  | "current"
  | "info"
  | "warning"
  | "error";

export interface ValidatedLineHighlight {
  readonly side: "old" | "new";
  readonly line: number;
  readonly start: number;
  readonly end: number;
  readonly tone: ExtensionLineHighlightTone;
}
