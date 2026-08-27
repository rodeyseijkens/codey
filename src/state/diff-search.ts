import { diffRowsFromPatch } from "../diff/from-patch";
import type { DiffSearch } from "./store";

export function createOpenSearch(): DiffSearch {
  return { index: 0, matches: [], open: true, query: "" };
}

export function computeMatches(diff: string, query: string): number[] {
  if (!(diff && query)) {
    return [];
  }
  const rows = diffRowsFromPatch(diff);
  const lower = query.toLowerCase();
  const out: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i]?.text.toLowerCase().includes(lower)) {
      out.push(i);
    }
  }
  return out;
}

export function updateSearch(
  search: DiffSearch,
  query: string,
  matches: number[],
): DiffSearch {
  return {
    ...search,
    index: Math.min(Math.max(0, search.index), Math.max(0, matches.length - 1)),
    matches,
    query,
  };
}

export function acceptSearch(
  search: DiffSearch,
  cursorRow: number,
): { search: DiffSearch; targetRow: number } | null {
  if (!search.open) {
    return null;
  }
  const idx = search.matches.findIndex((m) => m >= cursorRow);
  const index = idx < 0 ? 0 : idx;
  const target = search.matches[index];
  if (target === undefined) {
    return null;
  }
  return { search: { ...search, index, open: false }, targetRow: target };
}

export function stepSearch(
  search: DiffSearch,
  dir: 1 | -1,
): { search: DiffSearch; targetRow: number } | null {
  if (search.matches.length === 0) {
    return null;
  }
  const index =
    (search.index + dir + search.matches.length) % search.matches.length;
  const target = search.matches[index];
  if (target === undefined) {
    return null;
  }
  return { search: { ...search, index }, targetRow: target };
}
