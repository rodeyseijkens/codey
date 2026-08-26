export type Scope = "staged" | "changes" | "single";

export type FileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "type-changed";

export type FileDiff = {
  additions: number;
  deletions: number;
  diff: string;
  ignored?: boolean;
  isBinary: boolean;
  notice?: string;
  oldPath?: string;
  path: string;
  status: FileStatus;
  tooLarge: boolean;
};

export type ChangesetStats = {
  additions: number;
  deletions: number;
  files: number;
};

export type Changeset = {
  files: FileDiff[];
  id: Scope;
  label: string;
  stats: ChangesetStats;
};

export type Comment = {
  context: string;
  createdAt: number;
  endRow: number;
  id: string;
  path: string;
  scope: Scope;
  startRow: number;
  text: string;
  updatedAt: number;
};

export type DiffMode = "split" | "stack" | "auto";

export const DIFF_MODES: readonly DiffMode[] = ["split", "stack", "auto"];

export const LAYOUT_MODES = {
  auto: "auto",
  split: "split",
  stack: "stack",
} as const;

export function parseDiffMode(s: string | undefined): DiffMode | undefined {
  if (
    s === LAYOUT_MODES.split ||
    s === LAYOUT_MODES.stack ||
    s === LAYOUT_MODES.auto
  ) {
    return s;
  }
}

export const SIDEBAR_VIEWS = {
  list: "list",
  tree: "tree",
} as const;

export type SidebarView = (typeof SIDEBAR_VIEWS)[keyof typeof SIDEBAR_VIEWS];

export function parseSidebarView(
  s: string | undefined,
): SidebarView | undefined {
  if (s === SIDEBAR_VIEWS.tree || s === SIDEBAR_VIEWS.list) {
    return s;
  }
}

export const TOAST_KINDS = {
  error: "error",
  info: "info",
  success: "success",
  warn: "warn",
} as const;

export type ToastKind = (typeof TOAST_KINDS)[keyof typeof TOAST_KINDS];

export type LoaderMode = "diff" | "show" | "twoFile" | "patch" | "pager";

export const MAX_DIFF_BYTES = 2 * 1024 * 1024;
export const MAX_DIFF_LINES = 50_000;

export function emptyChangeset(id: Scope, label: string): Changeset {
  return {
    files: [],
    id,
    label,
    stats: { additions: 0, deletions: 0, files: 0 },
  };
}

export function fileDiffKey(file: FileDiff): string {
  return file.oldPath && file.oldPath !== file.path
    ? `${file.oldPath} -> ${file.path}`
    : file.path;
}

export type CommitFile = {
  additions: number;
  deletions: number;
  path: string;
  status: FileStatus;
};

export type CommitEntry = {
  author: string;
  date: string;
  diffByPath: Record<string, string>;
  files: CommitFile[];
  hash: string;
  isPushed: boolean;
  message: string;
  shortHash: string;
  stats: { additions: number; deletions: number; files: number };
};

export function commentKey(scope: Scope, path: string): string {
  return `${scope}:${path}`;
}
