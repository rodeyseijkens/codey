import { createHash } from "node:crypto";
import { join } from "node:path";

import { getRepoRoot } from "../vcs/git";

export class HerdrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HerdrError";
  }
}

export type HerdrResult = {
  exitCode: number;
  stderr: string;
  stdout: string;
};

export async function runHerdr(args: string[]): Promise<HerdrResult> {
  const bin = process.env.HERDR_BIN_PATH ?? "herdr";
  const proc = Bun.spawn([bin, ...args], {
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    stderr: "pipe",
    stdin: "ignore",
    stdout: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { exitCode, stderr, stdout };
}

export function isHerdrPlugin(): boolean {
  const e = process.env;
  const paneEnv = Boolean(
    e.HERDR_SOCKET_PATH && e.HERDR_PANE_ID && e.HERDR_WORKSPACE_ID,
  );
  const apiEnv = Boolean(e.HERDR_AGENT_API && e.HERDR_SESSION_ID);
  return paneEnv || apiEnv;
}

export function currentWorkspaceId(): string | undefined {
  const fromEnv = process.env.HERDR_WORKSPACE_ID;
  if (fromEnv) {
    return fromEnv;
  }
  try {
    const raw = JSON.parse(process.env.HERDR_PLUGIN_EVENT_JSON ?? "");
    if (typeof raw !== "object" || raw === null) {
      return;
    }
    const data =
      "data" in raw ? (raw as Record<string, unknown>).data : undefined;
    if (typeof data !== "object" || data === null) {
      return;
    }
    const workspace =
      "workspace" in data
        ? (data as Record<string, unknown>).workspace
        : undefined;
    if (typeof workspace !== "object" || workspace === null) {
      return;
    }
    const workspaceId =
      "workspace_id" in workspace
        ? (workspace as Record<string, unknown>).workspace_id
        : undefined;
    return typeof workspaceId === "string" ? workspaceId : undefined;
  } catch {
    // event JSON missing or malformed — fall back to no workspace id
  }
}

export type HerdrContext = {
  focusedPaneId?: string;
};

export function parseContext(): HerdrContext {
  const raw = process.env.HERDR_PLUGIN_CONTEXT_JSON;
  if (!raw) {
    return {};
  }
  try {
    const ctx = JSON.parse(raw);
    if (typeof ctx !== "object" || ctx === null) {
      return {};
    }
    const focusedPaneId =
      "focused_pane_id" in ctx
        ? (ctx as Record<string, unknown>).focused_pane_id
        : undefined;
    return {
      focusedPaneId:
        typeof focusedPaneId === "string" ? focusedPaneId : undefined,
    };
  } catch {
    return {};
  }
}

export function stateDir(): string {
  return (
    process.env.HERDR_PLUGIN_STATE_DIR ??
    join(process.env.HOME ?? "~", ".local", "state", "codey")
  );
}

export async function resolveRepoRoot(): Promise<string | null> {
  const roots = await Promise.all(
    repoCandidates().map((candidate) =>
      candidate ? tryGetRepoRoot(candidate) : Promise.resolve(null),
    ),
  );
  return roots.find((root) => root !== null) ?? null;
}

async function tryGetRepoRoot(candidate: string): Promise<string | null> {
  try {
    return await getRepoRoot(candidate);
  } catch {
    return null;
  }
}

function repoCandidates(): string[] {
  const candidates: string[] = [];
  collectContextCandidates(candidates);
  collectEventCandidates(candidates);
  candidates.push(process.cwd());
  return candidates;
}

function collectContextCandidates(candidates: string[]): void {
  try {
    const ctx = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON ?? "");
    if (typeof ctx !== "object" || ctx === null) {
      return;
    }
    const record = ctx as Record<string, unknown>;
    const worktree = record.worktree
      ? (record.worktree as Record<string, unknown>)
      : undefined;
    candidates.push(
      ...toStrings([
        worktree?.repo_root,
        worktree?.checkout_path,
        record.focused_pane_cwd,
      ]),
    );
  } catch {
    // ignore malformed context JSON
  }
}

function collectEventCandidates(candidates: string[]): void {
  try {
    const event = JSON.parse(process.env.HERDR_PLUGIN_EVENT_JSON ?? "");
    if (typeof event !== "object" || event === null) {
      return;
    }
    const eventRecord = event as Record<string, unknown>;
    const data = "data" in eventRecord ? eventRecord.data : undefined;
    if (typeof data !== "object" || data === null) {
      return;
    }
    const dataRecord = data as Record<string, unknown>;
    const checkoutPaths: unknown[] = [];
    if (dataRecord.worktree) {
      checkoutPaths.push(
        (dataRecord.worktree as Record<string, unknown>).checkout_path,
      );
    }
    if (dataRecord.workspace) {
      const workspaceRecord = dataRecord.workspace as Record<string, unknown>;
      if (workspaceRecord.worktree) {
        checkoutPaths.push(
          (workspaceRecord.worktree as Record<string, unknown>).checkout_path,
        );
      }
    }
    candidates.push(...toStrings(checkoutPaths));
  } catch {
    // ignore malformed event JSON
  }
}

function toStrings(values: unknown[]): string[] {
  return values.filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
