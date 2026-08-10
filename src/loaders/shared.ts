import type { Changeset, FileDiff, FileStatus, Scope } from "../types";
import { MAX_DIFF_BYTES, MAX_DIFF_LINES } from "../types";
import { parseNameStatusLine } from "../vcs/git";

const RENAME_TO_RE = /^rename to (.+)$/;
const RENAME_FROM_RE = /^rename from (.+)$/;
const BINARY_DIFF_RE = /^Binary files .* and (.+) differ$/;
const BINARY_LINE_RE = /^Binary files /m;

export interface NameStatusEntry {
  code: string;
  from?: string;
  status: FileStatus;
  to: string;
}

export function statusFromCode(code: string): FileStatus {
  switch (code[0]) {
    case "A":
      return "added";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    case "T":
      return "type-changed";
    default:
      return "modified";
  }
}

export function parseNameStatus(text: string): NameStatusEntry[] {
  const out: NameStatusEntry[] = [];
  for (const line of text.split("\n")) {
    const parsed = parseNameStatusLine(line);
    if (!parsed) {
      continue;
    }
    out.push({
      code: parsed.status,
      from: parsed.from,
      status: statusFromCode(parsed.status),
      to: parsed.to,
    });
  }
  return out;
}

export interface NumstatEntry {
  additions: number;
  deletions: number;
  isBinary: boolean;
  path: string;
}

function resolveNumstatPath(path: string): string {
  const sep = path.indexOf(" => ");
  return sep >= 0 ? path.slice(sep + 4) : path;
}

export function parseNumstat(text: string): NumstatEntry[] {
  const out: NumstatEntry[] = [];
  for (const line of text.split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 3) {
      continue;
    }
    const [addStr, delStr, ...rest] = parts;
    if (addStr === undefined || delStr === undefined) {
      continue;
    }
    const isBinary = addStr === "-" && delStr === "-";
    const path = resolveNumstatPath(rest.join("\t"));
    if (!path) {
      continue;
    }
    out.push({
      additions: isBinary ? 0 : Number(addStr) || 0,
      deletions: isBinary ? 0 : Number(delStr) || 0,
      isBinary,
      path,
    });
  }
  return out;
}

export function splitDiffSections(text: string): string[] {
  const sections: string[] = [];
  let current: string[] = [];
  for (const line of text.split("\n")) {
    if (line.startsWith("diff --git ")) {
      if (current.length > 0) {
        sections.push(current.join("\n"));
      }
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    sections.push(current.join("\n"));
  }
  return sections.filter((section) => section.trim().length > 0);
}

function stripGitPath(path: string): string {
  let s = path;
  if (s.startsWith("a/") || s.startsWith("b/")) {
    s = s.slice(2);
  }
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
    s = s.slice(1, -1);
  }
  return s;
}

export function sectionNewPath(section: string): string | null {
  const lines = section.split("\n");
  for (const line of lines) {
    const match = RENAME_TO_RE.exec(line);
    const path = match?.[1];
    if (path) {
      return stripGitPath(path);
    }
  }
  for (const line of lines) {
    if (!line.startsWith("+++ ")) {
      continue;
    }
    const rest = (line.slice(4).split("\t")[0] ?? "").trim();
    if (rest && rest !== "/dev/null") {
      return stripGitPath(rest);
    }
  }
  for (const line of lines) {
    const match = BINARY_DIFF_RE.exec(line.trim());
    const path = match?.[1];
    if (path) {
      return stripGitPath(path.trim());
    }
  }
  const [header] = lines;
  if (header?.startsWith("diff --git ")) {
    const rest = header.slice("diff --git ".length);
    const idx = rest.lastIndexOf(" b/");
    if (idx >= 0) {
      return stripGitPath(rest.slice(idx + 3).trim());
    }
  }
  return null;
}

export function sectionOldPath(section: string): string | null {
  const lines = section.split("\n");
  for (const line of lines) {
    const match = RENAME_FROM_RE.exec(line);
    const path = match?.[1];
    if (path) {
      return stripGitPath(path);
    }
  }
  for (const line of lines) {
    if (!line.startsWith("--- ")) {
      continue;
    }
    const rest = (line.slice(4).split("\t")[0] ?? "").trim();
    if (rest && rest !== "/dev/null") {
      return stripGitPath(rest);
    }
  }
  const [header] = lines;
  if (header?.startsWith("diff --git ")) {
    const rest = header.slice("diff --git ".length);
    const idx = rest.indexOf(" b/");
    if (idx > 0) {
      return stripGitPath(rest.slice(2, idx).trim());
    }
  }
  return null;
}

export function sectionIsBinary(section: string): boolean {
  return BINARY_LINE_RE.test(section);
}

export interface SizeCheck {
  notice?: string;
  tooLarge: boolean;
}

export function checkDiffLimits(diff: string): SizeCheck {
  if (diff.length === 0) {
    return { tooLarge: false };
  }
  const bytes = new TextEncoder().encode(diff).byteLength;
  const lines = diff.split("\n").length;
  if (bytes > MAX_DIFF_BYTES || lines > MAX_DIFF_LINES) {
    return {
      notice: `diff too large: ${lines} lines, ${bytes} bytes`,
      tooLarge: true,
    };
  }
  return { tooLarge: false };
}

export function countDiffLines(
  diff: string,
  kind: "additions" | "deletions"
): number {
  const marker = kind === "additions" ? "+" : "-";
  const header = kind === "additions" ? "+++" : "---";
  let count = 0;
  for (const line of diff.split("\n")) {
    if (line.startsWith(marker) && !line.startsWith(header)) {
      count += 1;
    }
  }
  return count;
}

export interface GitChangesetOptions {
  diffText: string;
  id: Scope;
  label: string;
  nameStatus: string;
  numstat: string;
}

export function buildGitChangeset(options: GitChangesetOptions): Changeset {
  const numByPath = new Map<string, NumstatEntry>();
  for (const entry of parseNumstat(options.numstat)) {
    numByPath.set(entry.path, entry);
  }
  const sectionByPath = new Map<string, string>();
  for (const section of splitDiffSections(options.diffText)) {
    const path = sectionNewPath(section);
    if (path) {
      sectionByPath.set(path, section);
    }
  }

  const files: FileDiff[] = [];
  for (const entry of parseNameStatus(options.nameStatus)) {
    const num = numByPath.get(entry.to);
    const section = sectionByPath.get(entry.to);
    const isBinary =
      num?.isBinary ?? (section ? sectionIsBinary(section) : false);
    const check = isBinary
      ? { tooLarge: false }
      : checkDiffLimits(section ?? "");
    const notice = isBinary ? "binary file" : check.notice;
    files.push({
      additions: num?.additions ?? 0,
      deletions: num?.deletions ?? 0,
      diff: isBinary || check.tooLarge ? "" : (section ?? ""),
      isBinary,
      notice,
      oldPath: entry.from,
      path: entry.to,
      status: entry.status,
      tooLarge: check.tooLarge,
    });
  }

  return {
    files,
    id: options.id,
    label: options.label,
    stats: {
      additions: files.reduce((sum, file) => sum + file.additions, 0),
      deletions: files.reduce((sum, file) => sum + file.deletions, 0),
      files: files.length,
    },
  };
}
