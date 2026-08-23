import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Comment } from "../types";
import { git } from "../vcs/git";
import {
  currentWorkspaceId,
  HerdrError,
  isHerdrPlugin,
  resolveRepoRoot,
  runHerdr,
  sha256,
  stateDir,
} from "./env";

interface HerdrAgent {
  agent_status?: string;
  cwd?: string;
  pane_id: string;
  workspace_id?: string;
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
