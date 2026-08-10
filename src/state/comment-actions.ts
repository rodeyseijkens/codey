import { parseDiffRows, rowLabel } from "../lib/diff-lines";
import { getStore } from "./store";

function rowsOfSelectedFile() {
  const store = getStore();
  const sel = store.selectedFile();
  if (!sel?.file.diff) {
    return null;
  }
  return { rows: parseDiffRows(sel.file.diff), sel };
}

export function visualSelect(): void {
  const store = getStore();
  const anchor = store.getState().anchorRow;
  store.set({ anchorRow: anchor === null ? store.getState().cursorRow : null });
}

export function openAddComment(): void {
  const store = getStore();
  const ctx = rowsOfSelectedFile();
  if (!ctx) {
    store.showToast("info", "no diff to comment on");
    return;
  }
  const { sel, rows } = ctx;
  const cursor = store.getState().cursorRow;
  const anchor = store.getState().anchorRow;
  const startRow = anchor === null ? cursor : Math.min(anchor, cursor);
  const endRow = anchor === null ? cursor : Math.max(anchor, cursor);
  if (endRow >= rows.length) {
    return;
  }
  const slice = rows.slice(startRow, endRow + 1);
  const context = slice
    .map((r) => `${rowLabel(r)} ${r.text}`)
    .join("\n")
    .slice(0, 400);
  store.set({
    anchorRow: null,
    overlay: {
      context,
      endRow,
      kind: "comment",
      mode: "add",
      path: sel.file.path,
      scope: sel.scope,
      startRow,
    },
  });
}

export function openEditCommentAtCursor(): void {
  const store = getStore();
  const ctx = rowsOfSelectedFile();
  if (!ctx) {
    return;
  }
  const { sel } = ctx;
  const cursor = store.getState().cursorRow;
  const comment = store
    .commentsFor(sel.scope, sel.file.path)
    .find((c) => cursor >= c.startRow && cursor <= c.endRow);
  if (!comment) {
    store.showToast("info", "no comment on this line (c to add)");
    return;
  }
  store.set({
    overlay: {
      commentId: comment.id,
      context: comment.context,
      endRow: comment.endRow,
      kind: "comment",
      mode: "edit",
      path: comment.path,
      scope: comment.scope,
      startRow: comment.startRow,
    },
  });
}

export function deleteCommentAtCursor(): void {
  const store = getStore();
  const sel = store.selectedFile();
  if (!sel) {
    return;
  }
  const cursor = store.getState().cursorRow;
  const comment = store
    .commentsFor(sel.scope, sel.file.path)
    .find((c) => cursor >= c.startRow && cursor <= c.endRow);
  if (!comment) {
    store.showToast("info", "no comment on this line");
    return;
  }
  store.set({
    comments: store.getState().comments.filter((c) => c.id !== comment.id),
  });
  store.showToast("success", "comment deleted");
}

export function jumpToComment(dir: 1 | -1): void {
  const store = getStore();
  const sel = store.selectedFile();
  if (!sel) {
    return;
  }
  const comments = store
    .commentsFor(sel.scope, sel.file.path)
    .sort((a, b) => a.startRow - b.startRow);
  if (comments.length === 0) {
    store.showToast("info", "no comments on this file");
    return;
  }
  const cursor = store.getState().cursorRow;
  const target =
    dir === 1
      ? (comments.find((c) => c.startRow > cursor) ?? comments[0])
      : ([...comments].reverse().find((c) => c.startRow < cursor) ??
        comments.at(-1));
  if (target) {
    store.set({ cursorRow: target.startRow });
  }
}

export function openCommentList(): void {
  const store = getStore();
  const sel = store.selectedFile();
  if (!sel) {
    return;
  }
  store.set({
    overlay: { kind: "comments", path: sel.file.path, scope: sel.scope },
  });
}

export function saveCommentFromOverlay(text: string): void {
  const store = getStore();
  const { overlay } = store.getState();
  if (overlay?.kind !== "comment") {
    return;
  }
  const trimmed = text.trim();
  if (trimmed === "") {
    store.set({ overlay: null });
    return;
  }
  const now = Date.now();
  if (overlay.mode === "edit" && overlay.commentId) {
    store.set({
      comments: store
        .getState()
        .comments.map((c) =>
          c.id === overlay.commentId
            ? { ...c, text: trimmed, updatedAt: now }
            : c
        ),
      overlay: null,
    });
    store.showToast("success", "comment updated");
    return;
  }
  store.set({
    comments: [
      ...store.getState().comments,
      {
        context: overlay.context,
        createdAt: now,
        endRow: overlay.endRow,
        id: crypto.randomUUID(),
        path: overlay.path,
        scope: overlay.scope,
        startRow: overlay.startRow,
        text: trimmed,
        updatedAt: now,
      },
    ],
    overlay: null,
  });
  store.showToast("success", "comment added");
}
