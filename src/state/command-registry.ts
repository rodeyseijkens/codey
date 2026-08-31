import type { CommandId } from "../keymap/commands";
import {
  halfPageScroll,
  jumpHunk,
  moveCursor,
  pageScroll,
} from "../ui/diff-pane-runtime";
import {
  commitMove,
  commitSelectNext,
  commitSelectNextFile,
  commitSelectPrev,
  commitSelectPrevFile,
  commitToggleCursorRow,
  confirmCommitAll,
  confirmGitEdit,
  confirmGitReset,
} from "./actions/commits";
import { refresh, SIDEBAR_RESIZE_STEP } from "./actions/core";
import {
  closeOverlay,
  openCommitDraft,
  openRewordDraft,
} from "./actions/drafts";
import {
  copySelection,
  cycleLayout,
  focusCommits,
  focusDiff,
  focusPrev,
  focusSidebar,
  resizeSidebar,
  selectNext,
  selectPrev,
  sendComments,
  toggleFocus,
  toggleSelectedRow,
  toggleSidebar,
  toggleSidebarView,
} from "./actions/navigation";
import { confirmForcePush, gitPull, gitPush } from "./actions/remote";
import {
  cancelPendingStage,
  confirmDiscard,
  confirmDiscardAll,
  stageAll,
  stageSelected,
  unstageAll,
  unstageSelected,
} from "./actions/staging";
import {
  deleteCommentAtCursor,
  jumpToComment,
  openAddCommentDraft,
  openEditCommentDraft,
  visualSelect,
} from "./comment-actions";
import { quit } from "./lifecycle";
import {
  diffSearchNext,
  diffSearchPrev,
  openDiffSearch,
} from "./search-actions";
import { type AppState, getStore, type Store } from "./store";

function commitFileShown(state: AppState): boolean {
  return state.commitView !== null && state.selection === null;
}

type CommandHandler = {
  guard?: (state: AppState) => boolean;
  run: (store: Store, state: AppState) => void;
};

function buildRegistry(): Map<CommandId, CommandHandler> {
  const r = new Map<CommandId, CommandHandler>();

  r.set("quit", { run: () => quit() });
  r.set("help", {
    run: (store) =>
      store.set({ commentDraft: null, overlay: { kind: "help" } }),
  });
  r.set("cancel", {
    run: (store, state) => {
      if (state.pendingStage) {
        cancelPendingStage();
        return;
      }
      if (state.overlay) {
        closeOverlay();
        return;
      }
      if (state.anchorRow !== null) {
        store.set({ anchorRow: null });
      }
      if (state.commitView) {
        store.set({ commitView: null });
      }
    },
  });
  r.set("select-prev", {
    run: (_, state) => {
      if (state.focus === "sidebar") {
        selectPrev();
      } else if (state.focus === "commits") {
        void commitSelectPrev();
      } else if (state.focus === "diff") {
        moveCursor(-1);
      }
    },
  });
  r.set("select-next", {
    run: (_, state) => {
      if (state.focus === "sidebar") {
        selectNext();
      } else if (state.focus === "commits") {
        void commitSelectNext();
      } else if (state.focus === "diff") {
        moveCursor(1);
      }
    },
  });
  r.set("prev-file", {
    run: (_, state) => {
      if (state.focus === "diff") {
        selectPrev();
      } else if (state.focus === "commits") {
        void commitSelectPrevFile();
      }
    },
  });
  r.set("next-file", {
    run: (_, state) => {
      if (state.focus === "diff") {
        selectNext();
      } else if (state.focus === "commits") {
        void commitSelectNextFile();
      }
    },
  });
  r.set("focus-toggle", { run: () => toggleFocus() });
  r.set("focus-prev", { run: () => focusPrev() });
  r.set("focus-sidebar", { run: () => focusSidebar() });
  r.set("focus-diff", { run: () => focusDiff() });
  r.set("focus-commits", { run: () => focusCommits() });
  r.set("git-pull", {
    guard: (state) => state.focus === "commits" && state.remoteBusy === null,
    run: () => gitPull(),
  });
  r.set("git-push", {
    guard: (state) => state.focus === "commits" && state.remoteBusy === null,
    run: () => gitPush(),
  });
  r.set("git-edit", {
    guard: (state) => state.focus === "commits",
    run: (store) => {
      const cursorRow = store.commitCursorRow();
      if (
        cursorRow &&
        (cursorRow.kind === "header" || cursorRow.kind === "file")
      ) {
        store.set({ overlay: { hash: cursorRow.hash, kind: "edit-commit" } });
      }
    },
  });
  r.set("commit-move-up", {
    guard: (state) => state.focus === "commits",
    run: () => void commitMove(-1),
  });
  r.set("commit-move-down", {
    guard: (state) => state.focus === "commits",
    run: () => void commitMove(1),
  });
  r.set("toggle-sidebar", { run: () => toggleSidebar() });
  r.set("collapse-section", {
    run: (_, state) => {
      if (state.focus === "sidebar") {
        toggleSelectedRow();
      } else if (state.focus === "commits") {
        void commitToggleCursorRow();
      }
    },
  });
  r.set("sidebar-shrink", { run: () => resizeSidebar(-SIDEBAR_RESIZE_STEP) });
  r.set("sidebar-grow", { run: () => resizeSidebar(SIDEBAR_RESIZE_STEP) });
  r.set("visual-select", {
    guard: (state) => !commitFileShown(state),
    run: () => visualSelect(),
  });
  r.set("add-comment", {
    run: (_, state) => {
      if (state.focus === "commits") {
        openCommitDraft();
        return;
      }
      if (commitFileShown(state)) {
        return;
      }
      openAddCommentDraft();
    },
  });
  r.set("edit-comment", {
    guard: (state) => !commitFileShown(state),
    run: () => openEditCommentDraft(),
  });
  r.set("delete-comment", {
    guard: (state) => !commitFileShown(state),
    run: () => deleteCommentAtCursor(),
  });
  r.set("next-comment", {
    guard: (state) => !commitFileShown(state),
    run: () => jumpToComment(1),
  });
  r.set("prev-comment", {
    guard: (state) => !commitFileShown(state),
    run: () => jumpToComment(-1),
  });
  r.set("send-comments", { run: () => void sendComments() });
  r.set("copy", { run: () => void copySelection() });
  r.set("stage-file", {
    guard: (state) => !commitFileShown(state),
    run: () => void stageSelected(),
  });
  r.set("stage-all", {
    guard: (state) => !commitFileShown(state),
    run: () => void stageAll(),
  });
  r.set("unstage-file", {
    guard: (state) => !commitFileShown(state),
    run: () => void unstageSelected(),
  });
  r.set("unstage-all", {
    guard: (state) => !commitFileShown(state),
    run: () => void unstageAll(),
  });
  r.set("refresh", { run: () => void refresh() });
  r.set("toggle-layout", { run: () => cycleLayout() });
  r.set("toggle-view", { run: () => toggleSidebarView() });
  r.set("wrap-text", {
    run: (store, state) => store.set({ wrapLines: !state.wrapLines }),
  });

  // Diff search commands
  r.set("open-diff-search", {
    guard: (state) => state.focus === "diff",
    run: () => openDiffSearch(),
  });
  r.set("diff-search-next", {
    run: () => diffSearchNext(),
  });
  r.set("diff-search-prev", {
    run: () => diffSearchPrev(),
  });

  // Diff pane page/hunk commands
  r.set("page-up", {
    guard: (state) => state.focus === "diff",
    run: () => pageScroll(-1),
  });
  r.set("page-down", {
    guard: (state) => state.focus === "diff",
    run: () => pageScroll(1),
  });
  r.set("page-cursor-half-up", {
    guard: (state) => state.focus === "diff",
    run: () => halfPageScroll(-1),
  });
  r.set("page-cursor-half-down", {
    guard: (state) => state.focus === "diff",
    run: () => halfPageScroll(1),
  });
  r.set("next-hunk", {
    guard: (state) => state.focus === "diff",
    run: () => jumpHunk("next-hunk"),
  });
  r.set("prev-hunk", {
    guard: (state) => state.focus === "diff",
    run: () => jumpHunk("prev-hunk"),
  });

  // Overlay commands
  r.set("overlay-confirm", {
    run: (_store, state) => {
      const o = state.overlay;
      if (!o) {
        return;
      }
      switch (o.kind) {
        case "confirm-force-push":
          confirmForcePush();
          break;
        case "confirm-discard":
          void confirmDiscard();
          break;
        case "confirm-discard-all":
          void confirmDiscardAll();
          break;
        case "confirm-commit-all":
          void confirmCommitAll();
          break;
        default:
          break;
      }
    },
  });
  r.set("overlay-reset-mixed", {
    run: (_store, state) => {
      const o = state.overlay;
      if (o?.kind === "reset-commits") {
        void confirmGitReset("mixed", o.hash);
      }
    },
  });
  r.set("overlay-reset-soft", {
    run: (_store, state) => {
      const o = state.overlay;
      if (o?.kind === "reset-commits") {
        void confirmGitReset("soft", o.hash);
      }
    },
  });
  r.set("overlay-reset-hard", {
    run: (_store, state) => {
      const o = state.overlay;
      if (o?.kind === "reset-commits") {
        void confirmGitReset("hard", o.hash);
      }
    },
  });
  r.set("overlay-edit-squash", {
    run: (_store, state) => {
      const o = state.overlay;
      if (o?.kind === "edit-commit") {
        void confirmGitEdit("squash", o.hash);
      }
    },
  });
  r.set("overlay-edit-fixup", {
    run: (_store, state) => {
      const o = state.overlay;
      if (o?.kind === "edit-commit") {
        void confirmGitEdit("fixup", o.hash);
      }
    },
  });
  r.set("overlay-edit-drop", {
    run: (_store, state) => {
      const o = state.overlay;
      if (o?.kind === "edit-commit") {
        void confirmGitEdit("drop", o.hash);
      }
    },
  });
  r.set("overlay-edit-amend", {
    run: (_store, state) => {
      const o = state.overlay;
      if (o?.kind === "edit-commit") {
        void confirmGitEdit("amend", o.hash);
      }
    },
  });
  r.set("overlay-to-reword", {
    run: (_store, state) => {
      const o = state.overlay;
      if (o?.kind === "edit-commit") {
        openRewordDraft(o.hash);
      }
    },
  });
  r.set("overlay-to-reset", {
    run: (store, state) => {
      const o = state.overlay;
      if (o?.kind === "edit-commit") {
        store.set({ overlay: { hash: o.hash, kind: "reset-commits" } });
      }
    },
  });

  return r;
}

const COMMAND_REGISTRY = buildRegistry();

export function dispatchCommand(cmd: CommandId): void {
  const store = getStore();
  const handler = COMMAND_REGISTRY.get(cmd);
  if (!handler) {
    return;
  }
  const state = store.getState();
  if (handler.guard && !handler.guard(state)) {
    return;
  }
  handler.run(store, state);
}
