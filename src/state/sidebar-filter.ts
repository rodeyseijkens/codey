import { type FileDiff, fileDiffKey } from "../types";

/**
 * fzf-style match: every query character must appear in the target in order,
 * case-insensitively. An empty query matches everything.
 */
export function fuzzyMatches(target: string, query: string): boolean {
  if (!query) {
    return true;
  }
  const lower = target.toLowerCase();
  let from = 0;
  for (const char of query.toLowerCase()) {
    const at = lower.indexOf(char, from);
    if (at < 0) {
      return false;
    }
    from = at + 1;
  }
  return true;
}

/** Files match against their display key so renames match old or new paths. */
export function fileMatchesFilter(file: FileDiff, query: string): boolean {
  return fuzzyMatches(fileDiffKey(file), query);
}

/**
 * Files kept by the filter, padded with nulls so array indices (used as
 * `fileIndex` by buildFileTree) still point at the original changeset files.
 */
export function filterTreeFiles(
  files: readonly FileDiff[],
  query: string,
): readonly (FileDiff | null)[] {
  if (!query) {
    return files;
  }
  return files.map((file) => (fileMatchesFilter(file, query) ? file : null));
}
