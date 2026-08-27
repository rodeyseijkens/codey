import { createHash } from "node:crypto";
import { join } from "node:path";

import { getRepoRoot } from "../vcs/git";
import { asRecord, asString, parseJson } from "./parse";

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
  const event = asRecord(parseJson(process.env.HERDR_PLUGIN_EVENT_JSON));
  const data = asRecord(event?.data);
  const workspace = asRecord(data?.workspace);
  return asString(workspace?.workspace_id) ?? undefined;
}

export type HerdrContext = {
  focusedPaneId?: string;
};

export function parseContext(): HerdrContext {
  const ctx = asRecord(parseJson(process.env.HERDR_PLUGIN_CONTEXT_JSON));
  return { focusedPaneId: asString(ctx?.focused_pane_id) ?? undefined };
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
  const ctx = asRecord(parseJson(process.env.HERDR_PLUGIN_CONTEXT_JSON));
  const worktree = asRecord(ctx?.worktree);
  candidates.push(
    ...toStrings([
      worktree?.repo_root,
      worktree?.checkout_path,
      ctx?.focused_pane_cwd,
    ]),
  );
}

function collectEventCandidates(candidates: string[]): void {
  const event = asRecord(parseJson(process.env.HERDR_PLUGIN_EVENT_JSON));
  const data = asRecord(event?.data);
  const checkoutPaths: unknown[] = [];
  const worktree = asRecord(data?.worktree);
  if (worktree) {
    checkoutPaths.push(worktree.checkout_path);
  }
  const workspace = asRecord(data?.workspace);
  if (workspace) {
    const ww = asRecord(workspace.worktree);
    if (ww) {
      checkoutPaths.push(ww.checkout_path);
    }
  }
  candidates.push(...toStrings(checkoutPaths));
}

function toStrings(values: unknown[]): string[] {
  return values.filter(
    (v): v is string => typeof v === "string" && v.length > 0,
  );
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
