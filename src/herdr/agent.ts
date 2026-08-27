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
import { asArray, asRecord, asString, parseJson } from "./parse";

const NULL_SEP = "\u0000";

type HerdrAgent = {
  agent_status?: string;
  cwd?: string;
  pane_id: string;
  workspace_id?: string;
};

export type TurnBaseline = {
  additions: number;
  capturedAt: number;
  deletions: number;
  files: number;
  hash: string;
  head: string;
  root: string;
};

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
    (a) => a.workspace_id === workspace && a.pane_id !== mine,
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
        `agent API ${api} returned ${res.status}: ${await res.text()}`,
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
      `send comments to agent ${target} failed: ${write.stderr.trim()}`,
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
  const files = statusRes.stdout.split(NULL_SEP).filter((p) => p.length > 0);
  const baseline: TurnBaseline = {
    additions: stagedStats.additions + unstagedStats.additions,
    capturedAt: Date.now(),
    deletions: stagedStats.deletions + unstagedStats.deletions,
    files: files.length,
    hash: sha256(
      [head, stagedRes.stdout, unstagedRes.stdout, untracked].join(NULL_SEP),
    ),
    head,
    root,
  };
  const dir = stateDir();
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "turn-baseline.json"),
    JSON.stringify(baseline, null, 2),
  );
}

function parseAgentList(stdout: string): HerdrAgent[] {
  const parsed = asRecord(parseJson(stdout));
  const result = asRecord(parsed?.result);
  const agents = asArray(result?.agents);
  if (!agents) {
    return [];
  }
  return agents.flatMap((a: unknown) => {
    const record = asRecord(a);
    if (!record || typeof record.pane_id !== "string") {
      return [];
    }
    return [
      {
        agent_status: asString(record.agent_status) ?? undefined,
        cwd: asString(record.cwd) ?? undefined,
        pane_id: record.pane_id,
        workspace_id: asString(record.workspace_id) ?? undefined,
      },
    ];
  });
}

const BRACKETED_PASTE_START = "\u001b[200~";
const BRACKETED_PASTE_END = "\u001b[201~";

function formatComments(comments: Comment[]): string {
  const lines: string[] = [];
  for (const comment of comments) {
    lines.push(
      [
        `${comment.path}:${comment.startRow}-${comment.endRow}`,
        comment.text,
      ].join("\n"),
    );
  }
  const body = lines.join("\n\n").replaceAll(BRACKETED_PASTE_END, "");
  return `${BRACKETED_PASTE_START}${body}${BRACKETED_PASTE_END}`;
}

function serializeComment(comment: Comment) {
  return {
    endRow: comment.endRow,
    path: comment.path,
    startRow: comment.startRow,
    text: comment.text,
  };
}

function countLines(text: string) {
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
