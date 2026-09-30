import { currentDiffRows } from "../ui/diff-pane-runtime";
import { applySelection } from "./actions/core";
import {
  acceptSearch,
  computeMatches,
  computeMatchesInRows,
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
  const registered = currentDiffRows();
  const matches =
    registered.length > 0
      ? computeMatchesInRows(registered, query)
      : computeMatches(sel?.file.diff ?? "", query);
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

export function openSidebarFilter(): void {
  const store = getStore();
  const current = store.getState().sidebarFilter;
  store.set({
    focus: "sidebar",
    sidebarFilter: { open: true, query: current?.query ?? "" },
    sidebarVisible: true,
  });
}

export function closeSidebarFilter(): void {
  getStore().set({ sidebarFilter: null });
}

export function setSidebarFilterQuery(query: string): void {
  const store = getStore();
  const current = store.getState().sidebarFilter;
  if (!current?.open) {
    return;
  }
  store.set({ sidebarFilter: { open: true, query } });
}

/** Accept the filter: jump to the first visible file and close the input. */
export function acceptSidebarFilter(): void {
  const store = getStore();
  const current = store.getState().sidebarFilter;
  if (!current?.open) {
    return;
  }
  const firstFile = store.sidebarRows().find((row) => row.kind === "file");
  if (!firstFile) {
    return;
  }
  applySelection(store, firstFile);
  store.set({ sidebarFilter: { open: false, query: current.query } });
}
