import type { FileDiff } from "../types";

export const DEFAULT_IGNORE_FILES = [
  "**/package-lock.json",
  "**/yarn.lock",
  "**/pnpm-lock.yaml",
  "**/bun.lock",
  "**/bun.lockb",
  "**/Cargo.lock",
  "**/Gemfile.lock",
  "**/poetry.lock",
  "**/Pipfile.lock",
  "**/go.sum",
  "**/composer.lock",
  "**/Package.resolved",
  "**/packages.lock.json",
  "**/pubspec.lock",
  "**/uv.lock",
  "**/mix.lock",
  "**/deno.lock",
  "**/flake.lock",
  "**/.terraform.lock.hcl",
  "**/gradle.lockfile",
] as const;

const LEADING_SLASHES = /^\/+/;
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/;

export type IgnoreMatcher = (path: string) => boolean;

/** Keep ignored files in the list but drop their diff content. */
export function markIgnoredFiles(
  files: FileDiff[],
  patterns: readonly string[],
): void {
  const ignore = compileIgnorePatterns(patterns);
  for (const file of files) {
    if (ignore(file.path)) {
      file.ignored = true;
      file.diff = "";
    }
  }
}

export function compileIgnorePatterns(
  patterns: readonly string[],
): IgnoreMatcher {
  const regexps: RegExp[] = [];
  for (const raw of patterns) {
    const pattern = normalizePattern(raw);
    if (pattern) {
      regexps.push(globToRegExp(pattern));
    }
  }
  return (path: string) => regexps.some((re) => re.test(path));
}

function normalizePattern(pattern: string): string {
  const p = pattern.trim().replace(LEADING_SLASHES, "");
  if (!p) {
    return "";
  }
  if (!p.includes("/")) {
    return `**/${p}`;
  }
  return p;
}

function globToRegExp(pattern: string): RegExp {
  const segments = pattern.split("/");
  let re = "";
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i] ?? "";
    if (seg === "**") {
      if (i === segments.length - 1) {
        re += ".*";
      } else {
        re += "(?:[^/]+/)*";
      }
    } else {
      re += globSegment(seg);
    }
    if (i < segments.length - 1 && seg !== "**") {
      re += "/";
    }
  }
  return new RegExp(`^${re}$`);
}

function globSegment(seg: string): string {
  let out = "";
  for (const ch of seg) {
    if (ch === "*") {
      out += "[^/]*";
    } else if (ch === "?") {
      out += "[^/]";
    } else {
      out += REGEX_SPECIAL.test(ch) ? `\\${ch}` : ch;
    }
  }
  return out;
}
