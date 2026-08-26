import { diffRowsFromPatch } from "../diff/from-patch";
import { getStore } from "./store";

function selectedRows() {
  const store = getStore();
  const sel = store.selectedFile();
  if (!sel?.file.diff) {
    return null;
  }
  return diffRowsFromPatch(sel.file.diff);
}

function computeMatches(query: string): number[] {
  const lower = query.toLowerCase();
  const rows = selectedRows();
  if (!rows || lower === "") {
    return [];
  }
  const out: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    if (rows[i]?.text.toLowerCase().includes(lower)) {
      out.push(i);
    }
  }
  return out;
}

export function openDiffSearch(): void {
  getStore().set({
    diffSearch: { index: 0, matches: [], open: true, query: "" },
  });
}

export function closeDiffSearch(): void {
  getStore().set({ diffSearch: null });
}

export function setDiffSearchQuery(query: string): void {
  const store = getStore();
  const current = store.getState().diffSearch;
  if (!current?.open) {
    return;
  }
  const matches = computeMatches(query);
  const index = Math.min(
    Math.max(0, current.index),
    Math.max(0, matches.length - 1),
  );
  store.set({ diffSearch: { ...current, index, matches, query } });
}

export function acceptDiffSearch(): void {
  const store = getStore();
  const ds = store.getState().diffSearch;
  if (!ds?.open) {
    return;
  }
  const cursor = store.getState().cursorRow;
  let index = ds.matches.findIndex((m) => m >= cursor);
  if (index < 0) {
    index = 0;
  }
  const target = ds.matches[index];
  if (target === undefined) {
    return;
  }
  store.set({
    cursorRow: target,
    diffSearch: { ...ds, index, open: false },
  });
}

function diffSearchStep(dir: 1 | -1): void {
  const store = getStore();
  const ds = store.getState().diffSearch;
  if (!ds) {
    return;
  }
  if (ds.matches.length === 0) {
    return;
  }
  const index = (ds.index + dir + ds.matches.length) % ds.matches.length;
  const target = ds.matches[index];
  if (target !== undefined) {
    store.set({ cursorRow: target, diffSearch: { ...ds, index } });
  }
}

export function diffSearchNext(): void {
  diffSearchStep(1);
}

export function diffSearchPrev(): void {
  diffSearchStep(-1);
}
