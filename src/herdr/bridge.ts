import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import type { Comment } from "../types";
import { getRepoRoot, git } from "../vcs/git";
import { PLUGIN_ID } from "./manifest";

export class HerdrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HerdrError";
  }
}

export function isHerdrPlugin(): boolean {
  const e = process.env;
  const paneEnv = Boolean(
    e.HERDR_SOCKET_PATH && e.HERDR_PANE_ID && e.HERDR_WORKSPACE_ID
  );
  const apiEnv = Boolean(e.HERDR_AGENT_API && e.HERDR_SESSION_ID);
  return paneEnv || apiEnv;
}

interface HerdrResult {
  exitCode: number;
  stderr: string;
  stdout: string;
}

async function runHerdr(args: string[]): Promise<HerdrResult> {
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

interface HerdrAgent {
  agent_status?: string;
  cwd?: string;
  pane_id: string;
  workspace_id?: string;
}

/**
 * Resolve the agent pane to send comments to, or null when there is no agent.
 * One agent in the workspace auto-selects it; several pick the first in herdr's
 * order (or the one named by $HERDR_AGENT_PANE). A real interactive picker is
 * future work — v1 auto-picks.
 */
export async function getAgentPicker(): Promise<string | null> {
  if (!isHerdrPlugin()) {
    return null;
  }
  const workspace = currentWorkspaceId();
  if (!workspace) {
    return null;
  }
  const res = await runHerdr(["agent", "list"]);
  if (res.exitCode !== 0) {
    return null;
  }
  const agents = parseAgentList(res.stdout);
  const mine = process.env.HERDR_PANE_ID;
  const candidates = agents.filter(
    (a) => a.workspace_id === workspace && a.pane_id !== mine
  );
  const pinned = process.env.HERDR_AGENT_PANE;
  const chosen = candidates.find((a) => a.pane_id === pinned) ?? candidates[0];
  return chosen?.pane_id ?? null;
}

/**
 * Send comments to the target agent. Degrades to a no-op outside herdr.
 * With $HERDR_AGENT_API set, POSTs the comments as JSON to that endpoint
 * (the speculative agent API); otherwise writes them into the agent's input
 * via `herdr pane send-text` (bracketed paste) and focuses the agent.
 */
export async function sendToAgent(comments: Comment[]): Promise<void> {
  if (!isHerdrPlugin() || comments.length === 0) {
    return;
  }
  const api = process.env.HERDR_AGENT_API;
  if (api) {
    const res = await fetch(api, {
      body: JSON.stringify({
        comments: comments.map(serializeComment),
        sessionId: process.env.HERDR_SESSION_ID ?? null,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    if (!res.ok) {
      throw new HerdrError(
        `agent API ${api} returned ${res.status}: ${await res.text()}`
      );
    }
    return;
  }
  const target = await getAgentPicker();
  if (!target) {
    return;
  }
  const body = formatComments(comments);
  const write = await runHerdr(["pane", "send-text", target, body]);
  if (write.exitCode !== 0) {
    throw new HerdrError(
      `send comments to agent ${target} failed: ${write.stderr.trim()}`
    );
  }
  await runHerdr(["agent", "focus", target]);
}

export interface TurnBaseline {
  additions: number;
  capturedAt: number;
  deletions: number;
  files: number;
  hash: string;
  head: string;
  root: string;
}

/**
 * Snapshot the current diff state at the start of an agent turn, so comments
 * can later reference the right lines. Persists to
 * $HERDR_PLUGIN_STATE_DIR/turn-baseline.json. No-op outside herdr.
 */
export async function captureTurnBaseline(): Promise<void> {
  if (!isHerdrPlugin()) {
    return;
  }
  const root = await resolveRepoRoot();
  if (!root) {
    return;
  }
  const [headRes, stagedRes, unstagedRes, untrackedRes, statusRes] =
    await Promise.all([
      git(["rev-parse", "HEAD"], root),
      git(["diff", "--cached"], root),
      git(["diff"], root),
      git(["ls-files", "--others", "--exclude-standard"], root),
      git(["status", "--porcelain", "-z", "--untracked-files=all"], root),
    ]);
  const head = headRes.exitCode === 0 ? headRes.stdout.trim() : "";
  const untracked = untrackedRes.stdout;
  const stagedStats = countLines(stagedRes.stdout);
  const unstagedStats = countLines(unstagedRes.stdout);
  const files = statusRes.stdout.split("\u0000").filter((p) => p.length > 0);
  const baseline: TurnBaseline = {
    additions: stagedStats.additions + unstagedStats.additions,
    capturedAt: Date.now(),
    deletions: stagedStats.deletions + unstagedStats.deletions,
    files: files.length,
    hash: sha256(
      [head, stagedRes.stdout, unstagedRes.stdout, untracked].join("\u0000")
    ),
    head,
    root,
  };
  const dir = stateDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "turn-baseline.json"),
    JSON.stringify(baseline, null, 2)
  );
}

export interface OpenPaneOptions {
  direction?: "right" | "down";
  placement?: "overlay" | "split" | "tab" | "zoomed";
}

/** Open a codey pane split beside the target agent (no-op when one is open). */
export async function openPane(opts: OpenPaneOptions = {}): Promise<void> {
  if (!isHerdrPlugin()) {
    return;
  }
  if ((await findPluginPanes()).length > 0) {
    return;
  }
  const root = await resolveRepoRoot();
  if (!root) {
    throw new HerdrError("open codey pane requires a git repository");
  }
  const targetPane =
    parseContext().focusedPaneId ?? (await firstPaneInWorkspace());
  if (!targetPane) {
    throw new HerdrError("no target pane to split");
  }
  const placement = opts.placement ?? "split";
  const args = [
    "plugin",
    "pane",
    "open",
    "--plugin",
    PLUGIN_ID,
    "--entrypoint",
    "pane",
    "--placement",
    placement,
    "--target-pane",
    targetPane,
    "--cwd",
    root,
  ];
  if (placement === "split") {
    args.push("--direction", opts.direction ?? "right");
  }
  const res = await runHerdr(args);
  if (res.exitCode !== 0) {
    throw new HerdrError(`open codey pane failed: ${res.stderr.trim()}`);
  }
}

/** Close every codey pane in the workspace (no-op when none is open). */
export async function closePanes(): Promise<void> {
  if (!isHerdrPlugin()) {
    return;
  }
  const panes = await findPluginPanes();
  await Promise.all(
    panes.map(async (paneId) => {
      const res = await runHerdr(["pane", "close", paneId]);
      if (res.exitCode !== 0 && !res.stderr.includes("pane_not_found")) {
        throw new HerdrError(
          `close codey pane ${paneId} failed: ${res.stderr.trim()}`
        );
      }
    })
  );
}

export async function togglePane(): Promise<void> {
  if (!isHerdrPlugin()) {
    return;
  }
  if ((await findPluginPanes()).length > 0) {
    await closePanes();
  } else {
    await openPane();
  }
}

/** Open a pane for a fresh worktree, gated by `auto_open` (default true). */
export async function autoOpenPane(): Promise<void> {
  if (!isHerdrPlugin()) {
    return;
  }
  if (!(await isAutoOpenEnabled())) {
    return;
  }
  await openPane();
}

/** Panes in the current workspace whose foreground process is the codey TUI. */
export async function findPluginPanes(): Promise<string[]> {
  const workspace = currentWorkspaceId();
  if (!workspace) {
    return [];
  }
  const panes = await listPanes();
  const inWorkspace = panes.filter((p) => p.workspaceId === workspace);
  const results = await Promise.all(
    inWorkspace.map(async (pane) => ({
      paneId: pane.paneId,
      runsCodey: await paneRunsCodey(pane.paneId),
    }))
  );
  return results.filter((r) => r.runsCodey).map((r) => r.paneId);
}

interface HerdrPaneInfo {
  paneId: string;
  workspaceId?: string;
}

async function listPanes(): Promise<HerdrPaneInfo[]> {
  const res = await runHerdr(["pane", "list"]);
  if (res.exitCode !== 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(res.stdout) as {
      result?: { panes?: Array<{ pane_id?: unknown; workspace_id?: unknown }> };
    };
    const panes = parsed.result?.panes;
    if (!Array.isArray(panes)) {
      return [];
    }
    return panes.flatMap((p) =>
      typeof p.pane_id === "string"
        ? [
            {
              paneId: p.pane_id,
              workspaceId:
                typeof p.workspace_id === "string" ? p.workspace_id : undefined,
            },
          ]
        : []
    );
  } catch {
    return [];
  }
}

async function firstPaneInWorkspace(): Promise<string | null> {
  const workspace = currentWorkspaceId();
  if (!workspace) {
    return null;
  }
  return (
    (await listPanes()).find((p) => p.workspaceId === workspace)?.paneId ?? null
  );
}

async function paneRunsCodey(paneId: string): Promise<boolean> {
  const res = await runHerdr(["pane", "process-info", "--pane", paneId]);
  if (res.exitCode !== 0) {
    return false;
  }
  try {
    const parsed = JSON.parse(res.stdout) as {
      result?: {
        process_info?: { foreground_processes?: Array<{ argv0?: unknown }> };
      };
    };
    const processes = parsed.result?.process_info?.foreground_processes;
    if (!Array.isArray(processes)) {
      return false;
    }
    return processes.some((p) => {
      const base =
        String(p.argv0 ?? "")
          .split("/")
          .pop() ?? "";
      return base === "codey" || base === "codey-herdr";
    });
  } catch {
    return false;
  }
}

async function isAutoOpenEnabled(): Promise<boolean> {
  const configDir =
    process.env.HERDR_PLUGIN_CONFIG_DIR ??
    join(
      process.env.HOME ?? "~",
      ".config",
      "herdr",
      "plugins",
      "config",
      PLUGIN_ID
    );
  const file = Bun.file(join(configDir, "config.toml"));
  if (!(await file.exists())) {
    return true;
  }
  try {
    const raw = parse(await file.text()) as { auto_open?: unknown };
    return raw.auto_open !== false;
  } catch {
    return true;
  }
}

function parseAgentList(stdout: string): HerdrAgent[] {
  try {
    const parsed = JSON.parse(stdout) as {
      result?: {
        agents?: Array<
          HerdrAgent & { pane_id?: unknown; workspace_id?: unknown }
        >;
      };
    };
    const agents = parsed.result?.agents;
    if (!Array.isArray(agents)) {
      return [];
    }
    return agents.flatMap((a) =>
      typeof a.pane_id === "string"
        ? [
            {
              agent_status:
                typeof a.agent_status === "string" ? a.agent_status : undefined,
              cwd: typeof a.cwd === "string" ? a.cwd : undefined,
              pane_id: a.pane_id,
              workspace_id:
                typeof a.workspace_id === "string" ? a.workspace_id : undefined,
            },
          ]
        : []
    );
  } catch {
    return [];
  }
}

function currentWorkspaceId(): string | undefined {
  const fromEnv = process.env.HERDR_WORKSPACE_ID;
  if (fromEnv) {
    return fromEnv;
  }
  try {
    const event = JSON.parse(process.env.HERDR_PLUGIN_EVENT_JSON ?? "") as {
      data?: { workspace?: { workspace_id?: unknown } };
    };
    const workspaceId = event.data?.workspace?.workspace_id;
    return typeof workspaceId === "string" ? workspaceId : undefined;
  } catch {
    // event JSON missing or malformed — fall back to no workspace id
  }
}

interface HerdrContext {
  focusedPaneId?: string;
}

function parseContext(): HerdrContext {
  const raw = process.env.HERDR_PLUGIN_CONTEXT_JSON;
  if (!raw) {
    return {};
  }
  try {
    const ctx = JSON.parse(raw) as {
      focused_pane_id?: unknown;
    };
    return {
      focusedPaneId:
        typeof ctx.focused_pane_id === "string"
          ? ctx.focused_pane_id
          : undefined,
    };
  } catch {
    return {};
  }
}

async function resolveRepoRoot(): Promise<string | null> {
  const roots = await Promise.all(
    repoCandidates().map((candidate) =>
      candidate ? tryGetRepoRoot(candidate) : Promise.resolve(null)
    )
  );
  return roots.find((root) => root !== null) ?? null;
}

async function tryGetRepoRoot(candidate: string): Promise<string | null> {
  try {
    return await getRepoRoot(candidate);
  } catch {
    // not a git repository; try the next candidate
    return null;
  }
}

function repoCandidates(): string[] {
  const candidates: string[] = [];
  try {
    const ctx = JSON.parse(process.env.HERDR_PLUGIN_CONTEXT_JSON ?? "") as {
      worktree?: { repo_root?: unknown; checkout_path?: unknown };
      focused_pane_cwd?: unknown;
    };
    candidates.push(
      ...toStrings([
        ctx.worktree?.repo_root,
        ctx.worktree?.checkout_path,
        ctx.focused_pane_cwd,
      ])
    );
  } catch {
    // ignore malformed context JSON
  }
  try {
    const event = JSON.parse(process.env.HERDR_PLUGIN_EVENT_JSON ?? "") as {
      data?: {
        worktree?: { checkout_path?: unknown };
        workspace?: { worktree?: { checkout_path?: unknown } };
      };
    };
    candidates.push(
      ...toStrings([
        event.data?.worktree?.checkout_path,
        event.data?.workspace?.worktree?.checkout_path,
      ])
    );
  } catch {
    // ignore malformed event JSON
  }
  candidates.push(process.cwd());
  return candidates;
}

function toStrings(values: unknown[]): string[] {
  return values.filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );
}

function stateDir(): string {
  return (
    process.env.HERDR_PLUGIN_STATE_DIR ??
    join(process.env.HOME ?? "~", ".local", "state", "codey")
  );
}

function formatComments(comments: Comment[]): string {
  const lines: string[] = [];
  for (const comment of comments) {
    lines.push(
      [
        `${comment.path}:${comment.startRow}-${comment.endRow}`,
        comment.text,
      ].join("\n")
    );
  }
  const body = lines.join("\n\n").replaceAll("\u001b[201~", "");
  return `\u001b[200~${body}\u001b[201~`;
}

function serializeComment(comment: Comment): Record<string, string | number> {
  return {
    endRow: comment.endRow,
    path: comment.path,
    startRow: comment.startRow,
    text: comment.text,
  };
}

function countLines(text: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of text.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) {
      continue;
    }
    if (line.startsWith("+")) {
      additions += 1;
    } else if (line.startsWith("-")) {
      deletions += 1;
    }
  }
  return { additions, deletions };
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
