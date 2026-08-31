import { clearCommitDraft } from "./actions/drafts";
import { clearCommentDraft } from "./comment-actions";
import { quit } from "./lifecycle";
import type { Store } from "./store";

export function handleCtrlC(store: Store): void {
  const state = store.getState();
  if (state.commitDraft !== null) {
    clearCommitDraft();
  } else if (state.commentDraft) {
    clearCommentDraft();
  } else {
    quit();
  }
}
