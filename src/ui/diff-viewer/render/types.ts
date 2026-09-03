import type { FileDiffMetadata } from "@pierre/diffs";

export type LayoutMode = "auto" | "split" | "stack";
export type CursorLine = "row" | "number" | "off";
export type ReviewNoteSource = "ai" | "agent" | "user";
export type ExtensionLineHighlightTone =
  | "match"
  | "current"
  | "info"
  | "warning"
  | "error";

export type AgentAnnotation = {
  author?: string;
  confidence?: "low" | "medium" | "high";
  createdAt?: string;
  editable?: boolean;
  id?: string;
  markup?: string;
  newRange?: [number, number];
  oldRange?: [number, number];
  rationale?: string;
  source?: string;
  summary: string;
  tags?: string[];
  title?: string;
  updatedAt?: string;
};

export type AgentFileContext = {
  annotations: AgentAnnotation[];
  path: string;
  summary?: string;
};

export type AgentContext = {
  files: AgentFileContext[];
  summary?: string;
  version: number;
};

/** @deprecated Use exact TextMate selectors through CustomSyntaxScopesConfig instead. */
export type CustomSyntaxColorsConfig = {
  comment?: string;
  default?: string;
  function?: string;
  keyword?: string;
  number?: string;
  operator?: string;
  property?: string;
  punctuation?: string;
  string?: string;
  type?: string;
  variable?: string;
};

export type CustomSyntaxScopesConfig = Record<string, string>;

export type CustomThemeConfig = {
  accent?: string;
  accentMuted?: string;
  addedBg?: string;
  addedContentBg?: string;
  addedSignColor?: string;
  background?: string;
  badgeAdded?: string;
  badgeNeutral?: string;
  badgeRemoved?: string;
  base?: string;
  border?: string;
  contextBg?: string;
  contextContentBg?: string;
  fileDeleted?: string;
  fileModified?: string;
  fileNew?: string;
  fileRenamed?: string;
  fileUntracked?: string;
  label?: string;
  lineNumberBg?: string;
  lineNumberFg?: string;
  movedAddedBg?: string;
  movedRemovedBg?: string;
  muted?: string;
  noteBackground?: string;
  noteBorder?: string;
  noteTitleBackground?: string;
  noteTitleText?: string;
  panel?: string;
  panelAlt?: string;
  removedBg?: string;
  removedContentBg?: string;
  removedSignColor?: string;
  selectedHunk?: string;
  /** @deprecated Use syntaxScopes. */
  syntax?: CustomSyntaxColorsConfig;
  syntaxScopes?: CustomSyntaxScopesConfig;
  text?: string;
};

export interface NamedCustomThemeConfig extends CustomThemeConfig {
  id: string;
}

export type DiffFile = {
  agent: AgentFileContext | null;
  id: string;
  isBinary?: boolean;
  isTooLarge?: boolean;
  isUntracked?: boolean;
  language?: string;
  lineMoveKinds?: DiffLineMoveKinds;
  metadata: FileDiffMetadata;
  patch: string;
  path: string;
  previousPath?: string;
  stats: {
    additions: number;
    deletions: number;
  };
  statsTruncated?: boolean;
};

export type DiffLineMoveKind = "moved";

export type DiffLineMoveKinds = {
  additionLines: Array<DiffLineMoveKind | undefined>;
  deletionLines: Array<DiffLineMoveKind | undefined>;
};
