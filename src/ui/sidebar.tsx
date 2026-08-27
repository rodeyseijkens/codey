import { type ReactNode, useEffect, useRef, useState } from "react";
import type { MouseEvent, ScrollBoxRenderable } from "@opentui/core";

import { buildFileTree, type TreeNode, visibleTreeNodes } from "../lib/tree";
import {
  clearCommitView,
  commitRevert,
  copyCommitHash,
  focusCommits,
  focusSidebar,
  loadCommits,
  loadMoreCommits,
  selectCommitFile,
  selectDir,
  selectFile,
  selectSection,
  toggleCollapse,
  toggleCommitExpand,
  toggleTreeFolder,
} from "../state/actions";
import {
  type CommitRow,
  commitRowKey,
  getStore,
  rowKey,
  useAppState,
} from "../state/store";
import {
  type Changeset,
  type CommitEntry,
  type CommitFile,
  type FileDiff,
  fileDiffKey,
  SIDEBAR_VIEWS,
} from "../types";
import { useColors } from "./color-context";
import { statusColor, statusIcon } from "./colors";
import {
  CHEVRON_DOWN,
  CHEVRON_RIGHT,
  fileColor,
  fileIcon,
  folderColor,
  folderIcon,
  GIT_COPY_ICON,
  GIT_PULL_ICON,
  GIT_PUSH_ICON,
  GIT_UNDO_ICON,
  SPINNER_FRAMES,
  STATUS_UNTRACKED,
  THIN_SPACE,
} from "./icons";

function truncatePath(path: string, max: number): string {
  if (max <= 1) {
    return max <= 0 ? "" : "…";
  }
  if (path.length <= max) {
    return path;
  }
  return `${path.slice(0, max - 1)}…`;
}

function splitPath(displayPath: string): [string, string] {
  if (displayPath.includes(" -> ")) {
    return [displayPath, ""];
  }
  const idx = displayPath.lastIndexOf("/");
  if (idx === -1) {
    return [displayPath, ""];
  }
  return [displayPath.slice(idx + 1), displayPath.slice(0, idx)];
}

function truncateFolder(folder: string, max: number): string {
  if (max <= 1) {
    return "…";
  }
  return `…${folder.slice(-(max - 1))}`;
}

function truncateFilePath(
  name: string,
  max: number,
): { file: string; folder: string | null } {
  const [file, folder] = splitPath(name);
  if (!folder) {
    return { file: truncatePath(file, max), folder: null };
  }
  if (file.length + 1 + folder.length <= max) {
    return { file, folder };
  }
  if (file.length >= max) {
    return { file: truncatePath(file, max), folder: null };
  }
  const folderMax = max - file.length - 1;
  if (folderMax <= 0) {
    return { file, folder: null };
  }
  return {
    file,
    folder:
      folder.length <= folderMax ? folder : truncateFolder(folder, folderMax),
  };
}

const ROW_CHROME = 7;

function dirNameMax(width: number, depth: number): number {
  return width - ROW_CHROME - depth;
}

function FileRow(props: {
  commentCount: number;
  depth: number;
  file: FileDiff;
  focused: boolean;
  index: number;
  name: string;
  scope: Changeset["id"];
  selected: boolean;
  width: number;
}) {
  const {
    commentCount,
    depth,
    file,
    focused,
    index,
    name,
    scope,
    selected,
    width,
  } = props;
  const { ui: C, icons } = useColors();
  const nameMax = Math.max(
    0,
    width - (1 + depth) - 1 - 2 - (commentCount > 0 ? 4 : 0) - 2 - 2,
  );
  const nameChunks = truncateFilePath(name, nameMax);
  const letter =
    file.status === "added" && file.notice === "untracked"
      ? STATUS_UNTRACKED
      : statusIcon(file.status);

  function handleClick(e: MouseEvent) {
    if (e.button === 0) {
      focusSidebar();
      selectFile(scope, index);
    }
  }

  return (
    <box
      id={rowKey({ index, kind: "file", scope })}
      onMouseDown={handleClick}
      style={{
        backgroundColor: selected ? C.selection : undefined,
        flexDirection: "row",
        height: 1,
        paddingLeft: 1 + depth * 1,
        paddingRight: 1,
      }}
    >
      <text style={{ fg: icons[fileColor(file.path)], width: 2 }}>
        {fileIcon(file.path)}
      </text>
      <box
        style={{
          flexDirection: "row",
          flexGrow: 1,
        }}
      >
        <text style={{ fg: selected ? C.fg : C.dim }}>{nameChunks.file}</text>
        {nameChunks.folder ? (
          <text style={{ fg: C.faint }}> {nameChunks.folder}</text>
        ) : null}
      </box>
      {commentCount > 0 ? (
        <text style={{ fg: C.commentFg, width: 4 }}> ◆{commentCount}</text>
      ) : null}
      <text style={{ width: 2 }}> </text>
      <text
        style={{
          fg: selected && focused ? C.fg : statusColor(file.status, C),
          width: 2,
        }}
      >
        {letter}
      </text>
    </box>
  );
}

function DirRow(props: {
  collapsed: boolean;
  depth: number;
  focused: boolean;
  node: TreeNode;
  scope: Changeset["id"];
  selected: boolean;
  width: number;
}) {
  const { collapsed, depth, focused, node, scope, selected, width } = props;
  const { ui: C, icons } = useColors();
  const chevron = collapsed ? CHEVRON_RIGHT : CHEVRON_DOWN;

  function handleClick(e: MouseEvent) {
    if (e.button === 0) {
      focusSidebar();
      selectDir(scope, node.path);
      toggleTreeFolder(scope, node.path);
    }
  }

  return (
    <box
      id={rowKey({ kind: "dir", path: node.path, scope })}
      onMouseDown={handleClick}
      style={{
        backgroundColor: selected ? C.selection : undefined,
        flexDirection: "row",
        height: 1,
        paddingLeft: 1 + depth * 1,
        paddingRight: 1,
      }}
    >
      <text style={{ fg: C.accent, width: 2 }}>{chevron}</text>
      <text style={{ fg: icons[folderColor(node.path)], width: 2 }}>
        {folderIcon(node.path)}
      </text>
      <text
        style={{
          fg: selected && focused ? C.fg : C.dim,
          flexGrow: 1,
          overflow: "hidden",
        }}
      >
        {truncatePath(node.name, dirNameMax(width, depth))}
      </text>
      <text style={{ width: 1 }}> </text>
    </box>
  );
}

function ListBody(props: {
  cs: Changeset;
  focused: boolean;
  sel: ReturnType<typeof useAppState>["selection"];
  width: number;
}) {
  const { cs, focused, sel, width } = props;
  const { ui: C } = useColors();
  if (cs.files.length === 0) {
    return (
      <box style={{ height: 1, paddingLeft: 3 }}>
        <text style={{ fg: C.faint }}>empty</text>
      </box>
    );
  }
  return (
    <>
      {cs.files.map((file, index) => (
        <FileRow
          commentCount={getStore().commentsFor(cs.id, file.path).length}
          depth={0}
          file={file}
          focused={focused}
          index={index}
          key={`${cs.id}:${fileDiffKey(file)}`}
          name={fileDiffKey(file)}
          scope={cs.id}
          selected={
            sel?.kind === "file" && sel.scope === cs.id && sel.index === index
          }
          width={width}
        />
      ))}
    </>
  );
}

function TreeBody(props: {
  cs: Changeset;
  collapsedTree: Record<string, boolean>;
  focused: boolean;
  sel: ReturnType<typeof useAppState>["selection"];
  width: number;
}) {
  const { cs, collapsedTree, focused, sel, width } = props;
  const { ui: C } = useColors();
  if (cs.files.length === 0) {
    return (
      <box style={{ height: 1, paddingLeft: 3 }}>
        <text style={{ fg: C.faint }}>empty</text>
      </box>
    );
  }
  const tree = buildFileTree(cs.files);
  const visible = visibleTreeNodes(cs.id, tree, collapsedTree);
  return (
    <>
      {visible.map((v) => {
        if (v.node.type === "dir") {
          return (
            <DirRow
              collapsed={v.collapsed}
              depth={v.depth}
              focused={focused}
              key={`${cs.id}:${v.node.path}`}
              node={v.node}
              scope={cs.id}
              selected={
                sel?.kind === "dir" &&
                sel.scope === cs.id &&
                sel.path === v.node.path
              }
              width={width}
            />
          );
        }
        const index = v.node.fileIndex ?? 0;
        const file = cs.files[index];
        if (!file) {
          return null;
        }
        return (
          <FileRow
            commentCount={getStore().commentsFor(cs.id, file.path).length}
            depth={v.depth}
            file={file}
            focused={focused}
            index={index}
            key={`${cs.id}:${v.node.path}`}
            name={v.node.name}
            scope={cs.id}
            selected={
              sel?.kind === "file" && sel.scope === cs.id && sel.index === index
            }
            width={width}
          />
        );
      })}
    </>
  );
}

function sectionBody(
  collapsed: boolean,
  state: ReturnType<typeof useAppState>,
  cs: Changeset,
  sel: ReturnType<typeof useAppState>["selection"],
  width: number,
): ReactNode {
  if (collapsed) {
    return null;
  }
  if (state.sidebarView === SIDEBAR_VIEWS.tree) {
    return (
      <TreeBody
        collapsedTree={state.collapsedTree}
        cs={cs}
        focused={state.focus === "sidebar"}
        sel={sel}
        width={width}
      />
    );
  }
  return (
    <ListBody
      cs={cs}
      focused={state.focus === "sidebar"}
      sel={sel}
      width={width}
    />
  );
}

function Section(props: { cs: Changeset; width: number }) {
  const { cs, width } = props;
  const state = useAppState();
  const { ui: C } = useColors();
  const collapsed = Boolean(state.collapsed[cs.id]);
  const sel = state.selection;
  const selected = sel?.kind === "section" && sel.scope === cs.id;
  const chevron = collapsed ? CHEVRON_RIGHT : CHEVRON_DOWN;

  function handleHeaderClick(e: MouseEvent) {
    if (e.button === 0) {
      focusSidebar();
      selectSection(cs.id);
      toggleCollapse(cs.id);
    }
  }
  const body = sectionBody(collapsed, state, cs, sel, width);
  return (
    <box style={{ flexDirection: "column" }}>
      <box
        id={rowKey({ kind: "section", scope: cs.id })}
        onMouseDown={handleHeaderClick}
        style={{
          backgroundColor: selected ? C.selection : C.panel,
          flexDirection: "row",
          height: 1,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text style={{ fg: C.accent }}>{chevron}</text>
        <text style={{ fg: C.fg, marginLeft: 1 }}>{cs.label}</text>
      </box>
      {body}
    </box>
  );
}

function CommitHeaderRow(props: {
  commit: CommitEntry | undefined;
  expanded: boolean;
  id: string;
  onMouseDown: (e: MouseEvent) => void;
  selected: boolean;
  width: number;
}) {
  const { commit, expanded, id, onMouseDown, selected, width } = props;
  const { ui: C } = useColors();
  const hasPushIcon = Boolean(commit && !commit.isPushed);
  const [hovered, setHovered] = useState(false);
  const iconWidth = hovered ? 4 : 0;
  return (
    // biome-ignore lint/a11y/useKeyWithMouseEvents: TUI, no onFocus
    <box
      id={id}
      onMouseDown={onMouseDown}
      onMouseOut={() => {
        setHovered(false);
      }}
      onMouseOver={() => setHovered(true)}
      style={{
        backgroundColor: selected ? C.selection : C.bg,
        flexDirection: "row",
        height: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      {expanded ? (
        <text style={{ fg: C.accent, width: 2 }}>{CHEVRON_DOWN}</text>
      ) : (
        <text style={{ fg: C.accent, width: 2 }}>{CHEVRON_RIGHT}</text>
      )}
      {hasPushIcon ? (
        <text style={{ fg: C.green, width: 2 }}>{GIT_PUSH_ICON}</text>
      ) : null}
      <text
        style={{
          fg: selected ? C.fg : C.dim,
          flexGrow: 1,
          overflow: "hidden",
        }}
      >
        {truncatePath(
          commit?.message ?? "",
          width - 4 - (hasPushIcon ? 2 : 0) - iconWidth,
        )}
      </text>
      {hovered && commit ? (
        <>
          <text
            onMouseDown={(e: MouseEvent) => {
              e.stopPropagation();
              commitRevert(commit.hash);
            }}
            style={{ fg: C.fg }}
          >
            {GIT_UNDO_ICON}
          </text>
          <text
            onMouseDown={(e: MouseEvent) => {
              e.stopPropagation();
              copyCommitHash(commit.hash);
            }}
            style={{ fg: C.fg }}
          >
            {" "}
            {GIT_COPY_ICON}
          </text>
        </>
      ) : null}
    </box>
  );
}

function CommitFileRow(props: {
  file: CommitFile | undefined;
  id: string;
  onMouseDown: (e: MouseEvent) => void;
  path: string;
  selected: boolean;
  width: number;
}) {
  const { file, id, onMouseDown, path, selected, width } = props;
  const { icons, ui: C } = useColors();
  const nameMax = Math.max(0, width - ROW_CHROME);
  const nameChunks = truncateFilePath(path, nameMax);
  return (
    <box
      id={id}
      onMouseDown={onMouseDown}
      style={{
        backgroundColor: selected ? C.selection : C.bg,
        flexDirection: "row",
        height: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text style={{ fg: icons[fileColor(path)], width: 3 }}>
        {THIN_SPACE}
        {fileIcon(path)}
      </text>
      <box
        style={{
          flexDirection: "row",
          flexGrow: 1,
        }}
      >
        <text style={{ fg: C.fg }}>{nameChunks.file}</text>
        {nameChunks.folder ? (
          <text style={{ fg: C.faint }}> {nameChunks.folder}</text>
        ) : null}
      </box>
      {file ? (
        <text style={{ fg: statusColor(file.status, C), width: 2 }}>
          {statusIcon(file.status)}
        </text>
      ) : (
        <text style={{ width: 2 }}> </text>
      )}
    </box>
  );
}

function CommitLoadMoreRow(props: {
  id: string;
  loading: boolean;
  onMouseDown: (e: MouseEvent) => void;
  selected: boolean;
}) {
  const { id, loading, onMouseDown, selected } = props;
  const { ui: C } = useColors();
  return (
    <box
      id={id}
      onMouseDown={onMouseDown}
      style={{
        backgroundColor: selected ? C.selection : undefined,
        flexDirection: "row",
        height: 1,
        paddingLeft: 1,
        paddingRight: 1,
      }}
    >
      <text style={{ fg: selected ? C.fg : C.dim, flexGrow: 1 }}>
        {loading ? "loading..." : "load more"}
      </text>
      {loading ? null : (
        <text style={{ fg: selected ? C.fg : C.dim }}>{"\u{f4d9}"}</text>
      )}
    </box>
  );
}

const SPINNER_INTERVAL = 100;

function scrollToCursor(
  cursorRowIndex: number,
  viewportHeight: number,
  scrollTop: number,
): number {
  const bottom = scrollTop + viewportHeight - 1;
  if (cursorRowIndex < scrollTop) {
    return cursorRowIndex;
  }
  if (cursorRowIndex > bottom) {
    return cursorRowIndex - viewportHeight + 1;
  }
  return scrollTop;
}

function CommitLog(props: { width: number }) {
  const state = useAppState();
  const { icons, ui: C } = useColors();
  const store = getStore();
  const {
    commitAhead,
    commitBehind,
    commitEntries,
    commitLoading,
    commitCursor,
    remoteBusy,
    repoRoot,
  } = state;
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const hasAhead = commitAhead > 0;
  const hasBehind = commitBehind > 0;
  const hasBusy = remoteBusy !== null;
  const hasCommitLoading = commitLoading;
  const [spinnerFrame, setSpinnerFrame] = useState(0);

  useEffect(() => {
    if (!(hasBusy || hasCommitLoading)) {
      setSpinnerFrame(0);
      return;
    }
    const timer = setInterval(
      () => setSpinnerFrame((frame) => (frame + 1) % SPINNER_FRAMES.length),
      SPINNER_INTERVAL,
    );
    return () => clearInterval(timer);
  }, [hasBusy, hasCommitLoading]);

  useEffect(() => {
    if (repoRoot && commitEntries.length === 0 && !commitLoading) {
      loadCommits();
    }
  }, [commitEntries.length, commitLoading, repoRoot]);

  const rows = store.commitRows();
  const cursorRowIndex = rows.findIndex(
    (row) => commitRowKey(row) === commitCursor,
  );

  useEffect(() => {
    if (commitCursor === null || cursorRowIndex < 0) {
      return;
    }
    const scroll: ScrollBoxRenderable | null = scrollRef.current;
    if (!scroll) {
      return;
    }
    const viewportHeight = scroll.viewport.height;
    const top = scroll.scrollTop;
    const scrollTarget = scrollToCursor(cursorRowIndex, viewportHeight, top);
    if (scrollTarget !== top) {
      scroll.scrollTop = Math.max(0, scrollTarget);
    }
  }, [cursorRowIndex, commitCursor]);

  const byHash = new Map(commitEntries.map((c) => [c.hash, c]));

  const handleHeaderMouseDown = (
    row: Extract<CommitRow, { kind: "header" }>,
  ) => {
    focusCommits();
    store.set({ commitCursor: commitRowKey(row) });
    toggleCommitExpand(row.hash);
  };

  function handleFileMouseDown(row: Extract<CommitRow, { kind: "file" }>) {
    focusCommits();
    store.set({ commitCursor: commitRowKey(row) });
    clearCommitView();
    selectCommitFile(row.hash, row.path);
  }

  function handleLoadMoreMouseDown() {
    focusCommits();
    store.set({ commitCursor: "commit-load-more" });
    loadMoreCommits(true);
  }

  const headerStatus: ReactNode =
    hasCommitLoading || hasBusy ? (
      <text style={{ fg: hasCommitLoading ? C.dim : icons.yellow }}>
        {SPINNER_FRAMES[spinnerFrame]}
      </text>
    ) : (
      <>
        {hasAhead ? (
          <text style={{ fg: C.green }}>
            {GIT_PUSH_ICON} {commitAhead}
          </text>
        ) : null}
        {hasAhead && hasBehind ? <text> </text> : null}
        {hasBehind ? (
          <text style={{ fg: icons.orange }}>
            {GIT_PULL_ICON} {commitBehind}
          </text>
        ) : null}
      </>
    );

  const body: ReactNode =
    commitEntries.length === 0 && !commitLoading ? (
      <box style={{ height: 1, paddingLeft: 3 }}>
        <text style={{ fg: C.faint }}>no commits</text>
      </box>
    ) : (
      rows.map((row) => {
        const selected = commitCursor === commitRowKey(row);
        const key = commitRowKey(row);
        if (row.kind === "header") {
          return (
            <CommitHeaderRow
              commit={byHash.get(row.hash)}
              expanded={Boolean(state.collapsed[row.hash])}
              id={key}
              key={key}
              onMouseDown={() => handleHeaderMouseDown(row)}
              selected={selected}
              width={props.width}
            />
          );
        }
        if (row.kind === "file") {
          const commit = byHash.get(row.hash);
          return (
            <CommitFileRow
              file={commit?.files[row.fileIndex]}
              id={key}
              key={key}
              onMouseDown={() => handleFileMouseDown(row)}
              path={row.path}
              selected={selected}
              width={props.width}
            />
          );
        }
        return (
          <CommitLoadMoreRow
            id={key}
            key={key}
            loading={commitLoading}
            onMouseDown={handleLoadMoreMouseDown}
            selected={selected}
          />
        );
      })
    );

  return (
    <box
      onMouseDown={(e) => {
        if (e.button === 0) {
          focusCommits();
        }
      }}
      style={{
        border: ["top"],
        borderColor: state.focus === "commits" ? C.accent : C.border,
        borderStyle: "single",
        flexDirection: "column",
        height: 12,
      }}
    >
      <box
        style={{
          backgroundColor: C.panel,
          flexDirection: "row",
          height: 1,
          paddingLeft: 1,
          paddingRight: 1,
        }}
      >
        <text style={{ fg: C.accent }}>Commits</text>
        <text style={{ flexGrow: 1 }} />
        {headerStatus}
      </box>
      <scrollbox
        ref={(el: ScrollBoxRenderable) => {
          scrollRef.current = el;
        }}
        style={{ flexGrow: 1 }}
      >
        {body}
      </scrollbox>
    </box>
  );
}

export function Sidebar() {
  const state = useAppState();
  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const { selection } = state;
  const { ui: C } = useColors();

  useEffect(() => {
    if (selection) {
      scrollRef.current?.scrollChildIntoView(rowKey(selection));
    }
  }, [selection]);

  return (
    <box
      style={{
        backgroundColor: C.bg,
        border: ["top"],
        borderColor: state.focus === "sidebar" ? C.accent : C.bg,
        borderStyle: "single",
        flexDirection: "column",
        height: "100%",
        width: state.sidebarWidth,
      }}
    >
      <scrollbox
        onMouseDown={(e) => {
          if (e.button === 0) {
            focusSidebar();
          }
        }}
        ref={(el: ScrollBoxRenderable) => {
          scrollRef.current = el;
        }}
        style={{ flexGrow: 1 }}
      >
        {state.changesets.map((cs) => (
          <Section cs={cs} key={cs.id} width={state.sidebarWidth} />
        ))}
      </scrollbox>
      <CommitLog width={state.sidebarWidth} />
    </box>
  );
}
