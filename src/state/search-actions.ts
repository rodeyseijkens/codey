import {
  acceptSearch,
  computeMatches,
  createOpenSearch,
  stepSearch,
  updateSearch,
} from "./diff-search";
import { getStore } from "./store";

export function openDiffSearch(): void {
  getStore().set({ diffSearch: createOpenSearch() });
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
  const sel = store.selectedFile();
  const matches = computeMatches(sel?.file.diff ?? "", query);
  store.set({ diffSearch: updateSearch(current, query, matches) });
}

export function acceptDiffSearch(): void {
  const store = getStore();
  const ds = store.getState().diffSearch;
  if (!ds?.open) {
    return;
  }
  const cursor = store.getState().cursorRow;
  const result = acceptSearch(ds, cursor);
  if (!result) {
    return;
  }
  store.set({ cursorRow: result.targetRow, diffSearch: result.search });
}

export function diffSearchNext(): void {
  applyStep(1);
}

export function diffSearchPrev(): void {
  applyStep(-1);
}

function applyStep(dir: 1 | -1): void {
  const store = getStore();
  const ds = store.getState().diffSearch;
  if (!ds) {
    return;
  }
  const result = stepSearch(ds, dir);
  if (!result) {
    return;
  }
  store.set({ cursorRow: result.targetRow, diffSearch: result.search });
}
