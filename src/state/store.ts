import { useSyncExternalStore } from "react";

import { buildFileTree, visibleTreeNodes } from "../lib/tree";
import type {
  Changeset,
  Comment,
  CommitEntry,
  DiffMode,
  FileDiff,
  Scope,
} from "../types";
import {
  LAYOUT_MODES,
  type LoaderMode,
  SIDEBAR_VIEWS,
  type SidebarView,
  type ToastKind,
} from "../types";

export type FocusPane = "sidebar" | "diff" | "commits";

export type CommitRow =
  | { kind: "header"; hash: string; index: number }
  | { kind: "file"; hash: string; fileIndex: number; path: string }
  | { kind: "load-more" };

export function commitRowKey(row: CommitRow): string {
  switch (row.kind) {
    case "header":
      return `commit:${row.hash}`;
    case "file":
      return `commit-file:${row.hash}:${row.path}`;
    case "load-more":
      return "commit-load-more";
    default:
      return "commit-load-more";
  }
}

export type Toast = {
  kind: ToastKind;
  message: string;
};

export type SidebarRow =
  | { index: number; kind: "file"; scope: Scope }
  | { kind: "dir"; path: string; scope: Scope }
  | { kind: "section"; scope: Scope };

export type Selection = SidebarRow;

export function rowKey(row: SidebarRow): string {
  switch (row.kind) {
    case "section":
      return `section:${row.scope}`;
    case "dir":
      return `dir:${row.scope}:${row.path}`;
    default:
      return `file:${row.scope}:${row.index}`;
  }
}

export type PendingStage = {
  bulk: boolean;
  commentCount: number;
  paths: string[];
  scope: Scope;
};

export type OverlayKind<K extends Overlay["kind"]> = Extract<
  Overlay,
  { kind: K }
>;

export type Overlay =
  | { kind: "confirm-discard"; scope: Scope; paths: string[]; bulk: boolean }
  | { kind: "confirm-discard-all" }
  | { kind: "confirm-commit-all"; message: string }
  | { kind: "confirm-force-push" }
  | { kind: "help" }
  | { kind: "palette" }
  | { kind: "reset-commits"; hash: string }
  | { kind: "edit-commit"; hash: string }
  | { kind: "reword-commit"; hash: string };

export type DiffSearch = {
  index: number;
  matches: number[];
  open: boolean;
  query: string;
};

/** An in-progress inline comment being typed into the diff body. */
export type CommentDraft = {
  commentId?: string;
  context: string;
  endRow: number;
  mode: "add" | "edit";
  path: string;
  scope: Scope;
  startRow: number;
  text: string;
};

export type AppState = {
  anchorRow: number | null;
  branch: string | null;
  changesets: Changeset[];
  collapsed: Record<string, boolean>;
  collapsedTree: Record<string, boolean>;
  commentDraft: CommentDraft | null;
  comments: Comment[];
  commitAhead: number;
  commitBehind: number;
  commitCursor: string | null;
  commitDraft: string | null;
  commitEntries: CommitEntry[];
  commitHasMore: boolean;
  commitLoading: boolean;
  commitOffset: number;
  commitView: { hash: string; file: FileDiff } | null;
  conflictNotice: string | null;
  cursorRow: number;
  diffSearch: DiffSearch | null;
  draftClearTick: number;
  fatalError: string | null;
  focus: FocusPane;
  gutterSign: boolean;
  ignoreFiles: readonly string[];
  lastFile: { index: number; scope: Scope } | null;
  layoutMode: DiffMode;
  lineNumbers: boolean;
  load: () => Promise<{
    changesets: Changeset[];
    branch: string | null;
    conflictNotice: string | null;
  }>;
  loaderMode: LoaderMode;
  loading: boolean;
  overlay: Overlay | null;
  pendingStage: PendingStage | null;
  remoteBusy: "push" | "pull" | null;
  repoRoot: string | null;
  selection: Selection | null;
  rewordDraft: string | null;
  sidebarView: SidebarView;
  sidebarVisible: boolean;
  sidebarWidth: number;
  stagingEnabled: boolean;
  tabWidth: number;
  theme: string;
  toast: Toast | null;
  watchActive: boolean;
  wrapLines: boolean;
};

export function initialState(): AppState {
  return {
    anchorRow: null,
    branch: null,
    changesets: [],
    collapsed: {},
    collapsedTree: {},
    commentDraft: null,
    comments: [],
    commitAhead: 0,
    commitBehind: 0,
    commitCursor: null,
    commitDraft: null,
    commitEntries: [],
    commitHasMore: true,
    commitLoading: false,
    commitOffset: 0,
    commitView: null,
    conflictNotice: null,
    cursorRow: 0,
    diffSearch: null,
    draftClearTick: 0,
    fatalError: null,
    focus: "sidebar",
    gutterSign: false,
    ignoreFiles: [],
    lastFile: null,
    layoutMode: LAYOUT_MODES.auto,
    lineNumbers: true,
    load: async () => ({
      branch: null,
      changesets: [],
      conflictNotice: null,
    }),
    loaderMode: "diff",
    loading: false,
    overlay: null,
    pendingStage: null,
    remoteBusy: null,
    repoRoot: null,
    rewordDraft: null,
    selection: null,
    sidebarView: SIDEBAR_VIEWS.tree,
    sidebarVisible: true,
    sidebarWidth: 32,
    stagingEnabled: true,
    tabWidth: 4,
    theme: "auto",
    toast: null,
    watchActive: false,
    wrapLines: false,
  };
}

type Listener = () => void;

export class AppStore implements Store {
  private state: AppState;
  private readonly listeners = new Set<Listener>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(init?: Partial<AppState>) {
    this.state = { ...initialState(), ...init };
  }

  getState = (): AppState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener();
    }
  }

  update(fn: (state: AppState) => Partial<AppState>): void {
    this.set(fn(this.state));
  }

  showToast(kind: ToastKind, message: string, ttlMs = 4000): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.set({ toast: { kind, message } });
    this.toastTimer = setTimeout(() => {
      this.toastTimer = null;
      this.set({ toast: null });
    }, ttlMs);
  }

  changeset(scope: Scope): Changeset | undefined {
    return this.state.changesets.find((c) => c.id === scope);
  }

  sidebarRows(): SidebarRow[] {
    const out: SidebarRow[] = [];
    for (const cs of this.state.changesets) {
      out.push({ kind: "section", scope: cs.id });
      if (this.state.collapsed[cs.id]) {
        continue;
      }
      if (this.state.sidebarView === SIDEBAR_VIEWS.tree) {
        const tree = buildFileTree(cs.files);
        const visible = visibleTreeNodes(cs.id, tree, this.state.collapsedTree);
        for (const v of visible) {
          if (v.node.type === "dir") {
            out.push({ kind: "dir", path: v.node.path, scope: cs.id });
          } else if (v.node.fileIndex !== undefined) {
            out.push({ index: v.node.fileIndex, kind: "file", scope: cs.id });
          }
        }
      } else {
        cs.files.forEach((_, index) => {
          out.push({ index, kind: "file", scope: cs.id });
        });
      }
    }
    return out;
  }

  commitRows(): CommitRow[] {
    const out: CommitRow[] = [];
    const { collapsed, commitEntries, commitHasMore } = this.state;
    for (let index = 0; index < commitEntries.length; index += 1) {
      const entry = commitEntries[index];
      if (!entry) {
        continue;
      }
      out.push({ hash: entry.hash, index, kind: "header" });
      if (!collapsed[entry.hash]) {
        continue;
      }
      for (let fileIndex = 0; fileIndex < entry.files.length; fileIndex += 1) {
        const file = entry.files[fileIndex];
        if (!file) {
          continue;
        }
        out.push({
          fileIndex,
          hash: entry.hash,
          kind: "file",
          path: file.path,
        });
      }
    }
    if (commitHasMore && commitEntries.length > 0) {
      out.push({ kind: "load-more" });
    }
    return out;
  }

  commitCursorRow(): CommitRow | null {
    const cursor = this.state.commitCursor;
    if (cursor === null) {
      return null;
    }
    return (
      this.commitRows().find((row) => commitRowKey(row) === cursor) ?? null
    );
  }

  selectedFile(): { scope: Scope; file: FileDiff } | null {
    const { commitView, focus, selection } = this.state;
    if (focus === "commits" && commitView) {
      return { file: commitView.file, scope: "single" };
    }
    const sel = selection;
    if (sel && sel.kind === "file") {
      const cs = this.changeset(sel.scope);
      const file = cs?.files[sel.index];
      if (file) {
        return { file, scope: sel.scope };
      }
    }
    const cv = commitView;
    if (cv) {
      return { file: cv.file, scope: "single" };
    }
    const last = this.state.lastFile;
    if (last) {
      const cs = this.changeset(last.scope);
      const file = cs?.files[last.index];
      if (file) {
        return { file, scope: last.scope };
      }
    }
    return null;
  }

  commentsFor(scope: Scope, path: string): Comment[] {
    return this.state.comments.filter(
      (c) => c.scope === scope && c.path === path,
    );
  }

  pendingCommentCount(scope: Scope, paths: string[]): number {
    const set = new Set(paths);
    return this.state.comments.filter(
      (c) => c.scope === scope && set.has(c.path),
    ).length;
  }

  clearCommentsFor(scope: Scope, paths: string[]): void {
    const set = new Set(paths);
    this.set({
      comments: this.state.comments.filter(
        (c) => !(c.scope === scope && set.has(c.path)),
      ),
    });
  }
}

export type Store = {
  changeset: (scope: Scope) => Changeset | undefined;
  clearCommentsFor: (scope: Scope, paths: string[]) => void;
  commentsFor: (scope: Scope, path: string) => Comment[];
  commitCursorRow: () => CommitRow | null;
  commitRows: () => CommitRow[];
  getState: () => AppState;
  pendingCommentCount: (scope: Scope, paths: string[]) => number;
  selectedFile: () => { scope: Scope; file: FileDiff } | null;
  set: (patch: Partial<AppState>) => void;
  showToast: (kind: ToastKind, message: string, ttlMs?: number) => void;
  sidebarRows: () => SidebarRow[];
  subscribe: (listener: () => void) => () => void;
  update: (fn: (state: AppState) => Partial<AppState>) => void;
};

let activeStore: Store = new AppStore();

export function getStore(): Store {
  return activeStore;
}

export function setStore(store: Store): void {
  activeStore = store;
}

export function useAppState(): AppState {
  return useSyncExternalStore(activeStore.subscribe, activeStore.getState);
}
