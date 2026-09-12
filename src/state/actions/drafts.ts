import { getStore } from "../store";

export function openHelp(): void {
  const store = getStore();
  store.set({ commentDraft: null, overlay: { kind: "help" } });
}

export function closeOverlay(): void {
  const store = getStore();
  store.set({ overlay: null });
}

export function openCommitDraft(): void {
  const store = getStore();
  if (store.getState().focus !== "commits") {
    return;
  }
  store.set({ commitDraft: "" });
}

export function cancelCommitDraft(): void {
  getStore().set({ commitDraft: null });
}

export function clearCommitDraft(): void {
  const store = getStore();
  store.set({ draftClearTick: store.getState().draftClearTick + 1 });
}

export function openRewordDraft(hash: string): void {
  const store = getStore();
  const entry = store.getState().commitEntries.find((c) => c.hash === hash);
  store.set({
    overlay: { hash, kind: "reword-commit" },
    rewordDraft: entry?.message ?? "",
  });
}

export function cancelRewordDraft(): void {
  getStore().set({ overlay: null, rewordDraft: null });
}
