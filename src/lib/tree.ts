import type { FileDiff, Scope } from "../types.js";

export type TreeNode = {
  additions: number;
  children?: TreeNode[];
  deletions: number;
  fileCount: number;
  fileIndex?: number;
  name: string;
  path: string;
  type: "dir" | "file";
};

export function treeKey(scope: Scope, dirPath: string): string {
  return `${scope}:${dirPath}`;
}

function sortNodes(nodes: TreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "dir" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    if (node.children) {
      sortNodes(node.children);
    }
  }
}

export function buildFileTree(files: FileDiff[]): TreeNode[] {
  const root: TreeNode[] = [];
  for (const [i, file] of files.entries()) {
    if (!file) {
      continue;
    }
    const segments = file.path.split("/");
    let level = root;
    let acc = "";
    for (const segment of segments.slice(0, -1)) {
      acc = acc ? `${acc}/${segment}` : segment;
      let dir = level.find((n) => n.type === "dir" && n.path === acc);
      if (!dir) {
        dir = {
          additions: 0,
          children: [],
          deletions: 0,
          fileCount: 0,
          name: segment,
          path: acc,
          type: "dir",
        };
        level.push(dir);
      }
      level = dir.children ?? [];
    }
    const name = segments.at(-1) ?? file.path;
    level.push({
      additions: file.additions,
      deletions: file.deletions,
      fileCount: 1,
      fileIndex: i,
      name,
      path: file.path,
      type: "file",
    });
  }

  function aggregate(nodes: TreeNode[]): void {
    for (const node of nodes) {
      if (node.type === "dir" && node.children) {
        aggregate(node.children);
        let additions = 0;
        let deletions = 0;
        let fileCount = 0;
        for (const c of node.children) {
          additions += c.additions;
          deletions += c.deletions;
          fileCount += c.fileCount;
        }
        node.additions = additions;
        node.deletions = deletions;
        node.fileCount = fileCount;
      }
    }
  }
  aggregate(root);
  sortNodes(root);
  return root;
}

export type VisibleNode = {
  collapsed: boolean;
  depth: number;
  node: TreeNode;
};

export function visibleTreeNodes(
  scope: Scope,
  nodes: TreeNode[],
  collapsedTree: Record<string, boolean>,
): VisibleNode[] {
  const out: VisibleNode[] = [];
  const walk = (list: TreeNode[], depth: number): void => {
    for (const node of list) {
      if (node.type === "dir") {
        const collapsed = Boolean(collapsedTree[treeKey(scope, node.path)]);
        out.push({ collapsed, depth, node });
        if (!collapsed && node.children) {
          walk(node.children, depth + 1);
        }
      } else {
        out.push({ collapsed: false, depth, node });
      }
    }
  };
  walk(nodes, 0);
  return out;
}

export function isFileHidden(
  scope: Scope,
  path: string,
  collapsedTree: Record<string, boolean>,
): boolean {
  const segments = path.split("/");
  let acc = "";
  for (let s = 0; s < segments.length - 1; s += 1) {
    const segment = segments[s] ?? "";
    acc = acc ? `${acc}/${segment}` : segment;
    if (collapsedTree[treeKey(scope, acc)]) {
      return true;
    }
  }
  return false;
}
