import { clearCommitDraft, clearRewordDraft } from "./actions/drafts";
import { clearCommentDraft } from "./comment-actions";
import { quit } from "./lifecycle";
import type { Store } from "./store";

export function handleCtrlC(store: Store): void {
  const state = store.getState();
  if (state.commitDraft !== null) {
    clearCommitDraft();
    return;
  }
  if (state.commentDraft) {
    clearCommentDraft();
    return;
  }
  if (state.rewordDraft !== null) {
    clearRewordDraft();
    return;
  }
  quit();
}
