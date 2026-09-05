import { join } from "node:path";
import { parse } from "smol-toml";

import {
  currentWorkspaceId,
  HerdrError,
  isHerdrPlugin,
  parseContext,
  resolveRepoRoot,
  runHerdr,
} from "./env";
import { PLUGIN_ID } from "./manifest";
import { asArray, asRecord, asString, parseJson } from "./parse";

export type OpenPaneOptions = {
  direction?: "right" | "down";
  placement?: "overlay" | "split" | "tab" | "zoomed";
};

type HerdrPaneInfo = {
  paneId: string;
  workspaceId?: string;
};

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
          `close codey pane ${paneId} failed: ${res.stderr.trim()}`,
        );
      }
    }),
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

export async function autoOpenPane(): Promise<void> {
  if (!isHerdrPlugin()) {
    return;
  }
  if (!(await isAutoOpenEnabled())) {
    return;
  }
  await openPane();
}

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
    })),
  );
  return results.filter((r) => r.runsCodey).map((r) => r.paneId);
}

async function listPanes(): Promise<HerdrPaneInfo[]> {
  const res = await runHerdr(["pane", "list"]);
  if (res.exitCode !== 0) {
    return [];
  }
  const parsed = asRecord(parseJson(res.stdout));
  const result = asRecord(parsed?.result);
  const panes = asArray(result?.panes);
  if (!panes) {
    return [];
  }
  return panes.flatMap((p: unknown) => {
    const record = asRecord(p);
    if (!record || typeof record.pane_id !== "string") {
      return [];
    }
    return [
      {
        paneId: record.pane_id,
        workspaceId: asString(record.workspace_id) ?? undefined,
      },
    ];
  });
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
  const parsed = asRecord(parseJson(res.stdout));
  const result = asRecord(parsed?.result);
  const processInfo = asRecord(result?.process_info);
  const processes = asArray(processInfo?.foreground_processes);
  if (!processes) {
    return false;
  }
  return processes.some((p: unknown) => {
    const record = asRecord(p);
    if (!record) {
      return false;
    }
    const base =
      String(record.argv0 ?? "")
        .split("/")
        .pop() ?? "";
    return base === "codey";
  });
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
      PLUGIN_ID,
    );
  const file = Bun.file(join(configDir, "config.toml"));
  if (!(await file.exists())) {
    return true;
  }
  try {
    const raw = parse(await file.text());
    if (typeof raw !== "object" || raw === null) {
      return true;
    }
    const autoOpen =
      "auto_open" in raw
        ? (raw as Record<string, unknown>).auto_open
        : undefined;
    return autoOpen !== false;
  } catch {
    return true;
  }
}
