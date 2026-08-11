export type Scope = "staged" | "changes" | "single";

export type FileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "type-changed";

export interface FileDiff {
  additions: number;
  deletions: number;
  diff: string;
  isBinary: boolean;
  notice?: string;
  oldPath?: string;
  path: string;
  status: FileStatus;
  tooLarge: boolean;
}

export interface ChangesetStats {
  additions: number;
  deletions: number;
  files: number;
}

export interface Changeset {
  files: FileDiff[];
  id: Scope;
  label: string;
  stats: ChangesetStats;
}

export interface Comment {
  context: string;
  createdAt: number;
  endRow: number;
  id: string;
  path: string;
  scope: Scope;
  startRow: number;
  text: string;
  updatedAt: number;
}

export type DiffMode = "split" | "stack" | "auto";

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

export interface CommitFile {
  additions: number;
  deletions: number;
  path: string;
  status: FileStatus;
}

export interface CommitEntry {
  author: string;
  date: string;
  diffByPath: Record<string, string>;
  files: CommitFile[];
  hash: string;
  isPushed: boolean;
  message: string;
  shortHash: string;
  stats: { additions: number; deletions: number; files: number };
}

export function commentKey(scope: Scope, path: string): string {
  return `${scope}:${path}`;
}
