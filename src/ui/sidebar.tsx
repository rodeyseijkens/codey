import type { MouseEvent, ScrollBoxRenderable } from "@opentui/core";
import { type ReactNode, useEffect, useRef } from "react";
import { buildFileTree, type TreeNode, visibleTreeNodes } from "../lib/tree";
import {
  selectDir,
  selectFile,
  selectSection,
  toggleCollapse,
  toggleTreeFolder,
} from "../state/actions";
import { getStore, rowKey, useAppState } from "../state/store";
import { type Changeset, type FileDiff, fileDiffKey } from "../types";
import { useColors } from "./color-context";
import { statusColor, statusIcon } from "./colors";
import {
  CHEVRON_DOWN,
  CHEVRON_RIGHT,
  fileColor,
  fileIcon,
  folderColor,
  folderIcon,
  STATUS_UNTRACKED,
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

const FILE_CHROME = { base: 8, comment: 4 };
const DIR_CHROME = 7;

function fileNameMax(
  width: number,
  depth: number,
  hasComment: boolean
): number {
  return (
    width - FILE_CHROME.base - (hasComment ? FILE_CHROME.comment : 0) - depth
  );
}

function dirNameMax(width: number, depth: number): number {
  return width - DIR_CHROME - depth;
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
  const letter =
    file.status === "added" && file.notice === "untracked"
      ? STATUS_UNTRACKED
      : statusIcon(file.status);

  const handleClick = (e: MouseEvent) => {
    if (e.button === 0) {
      selectFile(scope, index);
    }
  };

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
      <text
        style={{
          fg: selected ? C.fg : C.dim,
          flexGrow: 1,
          overflow: "hidden",
        }}
      >
        {truncatePath(name, fileNameMax(width, depth, commentCount > 0))}
      </text>
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

  const handleClick = (e: MouseEvent) => {
    if (e.button === 0) {
      selectDir(scope, node.path);
      toggleTreeFolder(scope, node.path);
    }
  };

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

function Section(props: { cs: Changeset; width: number }) {
  const { cs, width } = props;
  const state = useAppState();
  const { ui: C } = useColors();
  const collapsed = Boolean(state.collapsed[cs.id]);
  const sel = state.selection;
  const selected = sel?.kind === "section" && sel.scope === cs.id;
  const chevron = collapsed ? CHEVRON_RIGHT : CHEVRON_DOWN;

  const handleHeaderClick = (e: MouseEvent) => {
    if (e.button === 0) {
      selectSection(cs.id);
      toggleCollapse(cs.id);
    }
  };
  let body: ReactNode;
  if (collapsed) {
    body = null;
  } else if (state.sidebarView === "tree") {
    body = (
      <TreeBody
        collapsedTree={state.collapsedTree}
        cs={cs}
        focused={state.focus === "sidebar"}
        sel={sel}
        width={width}
      />
    );
  } else {
    body = (
      <ListBody
        cs={cs}
        focused={state.focus === "sidebar"}
        sel={sel}
        width={width}
      />
    );
  }
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
        ref={(el: ScrollBoxRenderable) => {
          scrollRef.current = el;
        }}
        style={{ flexGrow: 1 }}
      >
        {state.changesets.map((cs) => (
          <Section cs={cs} key={cs.id} width={state.sidebarWidth} />
        ))}
      </scrollbox>
    </box>
  );
}
