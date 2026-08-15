import {
  buildCanonicalDiffRows,
  type CanonicalDiffRow,
  canonicalRowLabel,
  createHunkDiffFilesFromPatch,
} from "../ui/hunk-diff/opentui";
import { getStore } from "./store";

function rowsOfSelectedFile() {
  const store = getStore();
  const sel = store.selectedFile();
  if (!sel?.file.diff) {
    return null;
  }
  const [file] = createHunkDiffFilesFromPatch(sel.file.diff, sel.file.path);
  if (!file) {
    return null;
  }
  return { rows: buildCanonicalDiffRows(file), sel };
}

/** Context snippet for one canonical row range, used by the agent payload. */
function contextForRange(
  rows: readonly CanonicalDiffRow[],
  startRow: number,
  endRow: number
) {
  const slice = rows.slice(startRow, endRow + 1);
  return slice
    .map((r) => `${canonicalRowLabel(r)} ${r.text}`)
    .join("\n")
    .slice(0, 400);
}

export function visualSelect(): void {
  const store = getStore();
  const anchor = store.getState().anchorRow;
  store.set({ anchorRow: anchor === null ? store.getState().cursorRow : null });
}

/** Open an inline draft at the cursor (or the visual selection range). */
export function openAddCommentDraft(): void {
  const store = getStore();
  const ctx = rowsOfSelectedFile();
  if (!ctx) {
    store.showToast("info", "no diff to comment on");
    return;
  }
  const { rows, sel } = ctx;
  const cursor = store.getState().cursorRow;
  const anchor = store.getState().anchorRow;
  const startRow = anchor === null ? cursor : Math.min(anchor, cursor);
  const endRow = anchor === null ? cursor : Math.max(anchor, cursor);
  if (endRow >= rows.length) {
    return;
  }
  store.set({
    anchorRow: null,
    commentDraft: {
      context: contextForRange(rows, startRow, endRow),
      endRow,
      mode: "add",
      path: sel.file.path,
      scope: sel.scope,
      startRow,
      text: "",
    },
  });
}

/** Reopen an existing comment at the cursor as an inline edit draft. */
export function openEditCommentDraft(): void {
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
    store.showToast("info", "no comment on this line (c to add)");
    return;
  }
  store.set({
    commentDraft: {
      commentId: comment.id,
      context: comment.context,
      endRow: comment.endRow,
      mode: "edit",
      path: comment.path,
      scope: comment.scope,
      startRow: comment.startRow,
      text: comment.text,
    },
  });
}

export function cancelCommentDraft(): void {
  getStore().set({ commentDraft: null });
}

export function updateCommentDraft(text: string): void {
  const store = getStore();
  const { commentDraft } = store.getState();
  if (!commentDraft) {
    return;
  }
  store.set({ commentDraft: { ...commentDraft, text } });
}

export function deleteComment(id: string): void {
  const store = getStore();
  store.set({
    comments: store.getState().comments.filter((c) => c.id !== id),
  });
  store.showToast("success", "comment deleted");
}

/** Save the active draft: empty text cancels, edit updates, add inserts. */
export function saveCommentDraft(text: string): void {
  const store = getStore();
  const { commentDraft } = store.getState();
  if (!commentDraft) {
    return;
  }
  const trimmed = text.trim();
  if (trimmed === "") {
    store.set({ commentDraft: null });
    return;
  }
  const now = Date.now();
  if (commentDraft.mode === "edit" && commentDraft.commentId) {
    store.set({
      commentDraft: null,
      comments: store
        .getState()
        .comments.map((c) =>
          c.id === commentDraft.commentId
            ? { ...c, text: trimmed, updatedAt: now }
            : c
        ),
    });
    store.showToast("success", "comment updated");
    return;
  }
  store.set({
    commentDraft: null,
    comments: [
      ...store.getState().comments,
      {
        context: commentDraft.context,
        createdAt: now,
        endRow: commentDraft.endRow,
        id: crypto.randomUUID(),
        path: commentDraft.path,
        scope: commentDraft.scope,
        startRow: commentDraft.startRow,
        text: trimmed,
        updatedAt: now,
      },
    ],
  });
  store.showToast("success", "comment added");
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
