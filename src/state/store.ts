import { useSyncExternalStore } from "react";
import { type ResolvedKeymap, resolveKeymap } from "../keymap/index";
import { buildFileTree, visibleTreeNodes } from "../lib/tree";
import type {
  Changeset,
  Comment,
  CommitEntry,
  DiffMode,
  FileDiff,
  LoaderMode,
  Scope,
} from "../types";

export type FocusPane = "sidebar" | "diff";
export type SidebarView = "tree" | "list";
export type ToastKind = "info" | "success" | "warn" | "error";

export interface Toast {
  kind: ToastKind;
  message: string;
}

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

export interface PendingStage {
  bulk: boolean;
  commentCount: number;
  paths: string[];
  scope: Scope;
}

export type Overlay =
  | { kind: "confirm-discard"; scope: Scope; paths: string[]; bulk: boolean }
  | { kind: "help" }
  | { kind: "palette" };

/** An in-progress inline comment being typed into the diff body. */
export interface CommentDraft {
  commentId?: string;
  context: string;
  endRow: number;
  mode: "add" | "edit";
  path: string;
  scope: Scope;
  startRow: number;
  text: string;
}

export interface AppState {
  anchorRow: number | null;
  branch: string | null;
  changesets: Changeset[];
  collapsed: Record<string, boolean>;
  collapsedTree: Record<string, boolean>;
  commentDraft: CommentDraft | null;
  comments: Comment[];
  commitEntries: CommitEntry[];
  commitHasMore: boolean;
  commitLoading: boolean;
  commitOffset: number;
  commitView: { hash: string; file: FileDiff } | null;
  conflictNotice: string | null;
  cursorRow: number;
  fatalError: string | null;
  focus: FocusPane;
  keymap: ResolvedKeymap;
  lastFile: { index: number; scope: Scope } | null;
  layoutMode: DiffMode;
  lineNumbers: boolean;
  loaderMode: LoaderMode;
  loading: boolean;
  overlay: Overlay | null;
  pendingStage: PendingStage | null;
  repoRoot: string | null;
  selection: Selection | null;
  sidebarView: SidebarView;
  sidebarVisible: boolean;
  sidebarWidth: number;
  stagingEnabled: boolean;
  tabWidth: number;
  theme: string;
  toast: Toast | null;
  watchActive: boolean;
  wrapLines: boolean;
}

function defaultKeymap(): ResolvedKeymap {
  const res = resolveKeymap({});
  if (res.ok) {
    return res.keymap;
  }
  return { byChord: new Map(), byCommand: new Map(), chords: new Map() };
}

export function initialState(): AppState {
  return {
    anchorRow: null,
    branch: null,
    changesets: [],
    collapsed: {},
    collapsedTree: {},
    commentDraft: null,
    comments: [],
    commitEntries: [],
    commitHasMore: true,
    commitLoading: false,
    commitOffset: 0,
    commitView: null,
    conflictNotice: null,
    cursorRow: 0,
    fatalError: null,
    focus: "sidebar",
    keymap: defaultKeymap(),
    lastFile: null,
    layoutMode: "auto",
    lineNumbers: true,
    loaderMode: "diff",
    loading: false,
    overlay: null,
    pendingStage: null,
    repoRoot: null,
    selection: null,
    sidebarView: "tree",
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

export class AppStore {
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
      if (this.state.sidebarView === "tree") {
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

  selectedFile(): { scope: Scope; file: FileDiff } | null {
    const sel = this.state.selection;
    if (sel && sel.kind === "file") {
      const cs = this.changeset(sel.scope);
      const file = cs?.files[sel.index];
      if (file) {
        return { file, scope: sel.scope };
      }
    }
    const cv = this.state.commitView;
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
      (c) => c.scope === scope && c.path === path
    );
  }

  pendingCommentCount(scope: Scope, paths: string[]): number {
    const set = new Set(paths);
    return this.state.comments.filter(
      (c) => c.scope === scope && set.has(c.path)
    ).length;
  }

  clearCommentsFor(scope: Scope, paths: string[]): void {
    const set = new Set(paths);
    this.set({
      comments: this.state.comments.filter(
        (c) => !(c.scope === scope && set.has(c.path))
      ),
    });
  }
}

let activeStore: AppStore = new AppStore();

export function getStore(): AppStore {
  return activeStore;
}

export function setStore(store: AppStore): void {
  activeStore = store;
}

export function useAppState(): AppState {
  return useSyncExternalStore(activeStore.subscribe, activeStore.getState);
}

export function useStore(): AppStore {
  return activeStore;
}
