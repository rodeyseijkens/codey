import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  captureTurnBaseline,
  getAgentPicker,
  isHerdrPlugin,
  sendToAgent,
} from "../src/herdr";
import { loadManifest, MANIFEST_PATH } from "../src/herdr/manifest";
import type { Comment } from "../src/types";

const HERDR_KEYS = [
  "HERDR_PANE_ID",
  "HERDR_WORKSPACE_ID",
  "HERDR_TAB_ID",
  "HERDR_SOCKET_PATH",
  "HERDR_PLUGIN_ID",
  "HERDR_AGENT_API",
  "HERDR_SESSION_ID",
  "HERDR_AGENT_PANE",
  "HERDR_BIN_PATH",
  "HERDR_PLUGIN_STATE_DIR",
];

const savedEnv = new Map<string, string | undefined>();

beforeEach(() => {
  savedEnv.clear();
  for (const key of HERDR_KEYS) {
    savedEnv.set(key, process.env[key]);
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of HERDR_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

const comment: Comment = {
  context: "",
  createdAt: 1,
  endRow: 5,
  id: "c1",
  path: "src/main.ts",
  scope: "changes",
  startRow: 3,
  text: "Extract this into a helper.",
  updatedAt: 1,
};

describe("isHerdrPlugin", () => {
  test("returns false when herdr env vars are not set", () => {
    expect(isHerdrPlugin()).toBe(false);
  });

  test("returns true when running inside a herdr pane", () => {
    process.env.HERDR_SOCKET_PATH = "/tmp/herdr.sock";
    process.env.HERDR_PANE_ID = "w1:p2";
    process.env.HERDR_WORKSPACE_ID = "w1";
    expect(isHerdrPlugin()).toBe(true);
  });

  test("returns true when the agent API pair is set", () => {
    process.env.HERDR_AGENT_API = "http://localhost:7777";
    process.env.HERDR_SESSION_ID = "session-1";
    expect(isHerdrPlugin()).toBe(true);
  });

  test("returns false with only one of the pane env vars", () => {
    process.env.HERDR_PANE_ID = "w1:p2";
    expect(isHerdrPlugin()).toBe(false);
    process.env.HERDR_SOCKET_PATH = "/tmp/herdr.sock";
    expect(isHerdrPlugin()).toBe(false);
  });
});

describe("getAgentPicker", () => {
  test("returns null outside herdr", async () => {
    expect(await getAgentPicker()).toBeNull();
  });
});

describe("sendToAgent", () => {
  test("degrades to a no-op when herdr is not present", async () => {
    await expect(sendToAgent([comment])).resolves.toBeUndefined();
  });

  test("no-ops on an empty comment list", async () => {
    await expect(sendToAgent([])).resolves.toBeUndefined();
  });
});

describe("captureTurnBaseline", () => {
  test("degrades to a no-op when herdr is not present", async () => {
    await expect(captureTurnBaseline()).resolves.toBeUndefined();
  });
});

describe("loadManifest", () => {
  const VALID_MANIFEST = `id = "codey"
name = "codey"
version = "0.1.0"
min_herdr_version = "0.7.5"
platforms = ["macos", "linux"]
description = "test manifest"

[[build]]
command = ["bash", "herdr/build.sh"]

[[panes]]
id = "pane"
title = "codey"
placement = "split"
command = ["sh", "-c", "exec \\"$HERDR_PLUGIN_ROOT/bin/codey\\""]

[[actions]]
id = "toggle"
title = "codey: toggle pane"
contexts = ["pane", "workspace"]
command = ["sh", "-c", "exec \\"$HERDR_PLUGIN_ROOT/bin/codey-herdr\\" toggle"]

[[events]]
on = "worktree.created"
command = ["sh", "-c", "exec \\"$HERDR_PLUGIN_ROOT/bin/codey-herdr\\" auto-open"]
`;

  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "herdr-test-"));
  });

  afterEach(() => {
    rmSync(dir, { force: true, recursive: true });
  });

  function writeManifest(name: string, contents: string): string {
    const path = join(dir, name);
    writeFileSync(path, contents);
    return path;
  }

  test("parses a valid manifest", async () => {
    const path = writeManifest("herdr-plugin.toml", VALID_MANIFEST);
    const result = await loadManifest(path);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.manifest.id).toBe("codey");
    expect(result.manifest.name).toBe("codey");
    expect(result.manifest.version).toBe("0.1.0");
    expect(result.manifest.min_herdr_version).toBe("0.7.5");
    expect(result.manifest.platforms).toEqual(["macos", "linux"]);
    expect(result.manifest.actions?.map((a) => a.id)).toEqual(["toggle"]);
    expect(result.manifest.panes?.[0]?.placement).toBe("split");
    expect(result.manifest.events?.[0]?.on).toBe("worktree.created");
    expect(result.manifest.build?.[0]?.command).toEqual([
      "bash",
      "herdr/build.sh",
    ]);
  });

  test("loads the repository manifest from the default path", async () => {
    const result = await loadManifest();
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.manifest.id).toBe("codey");
    expect(result.manifest.actions?.map((a) => a.id)).toEqual([
      "toggle",
      "open",
      "close",
    ]);
    expect(MANIFEST_PATH.endsWith("herdr-plugin.toml")).toBe(true);
  });

  test("rejects invalid TOML", async () => {
    const path = writeManifest("bad.toml", "id = [unterminated");
    const result = await loadManifest(path);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("TOML");
  });

  test("rejects a manifest missing a required field", async () => {
    const path = writeManifest("missing-id.toml", 'name = "codey"');
    const result = await loadManifest(path);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("manifest invalid");
  });

  test("rejects duplicate action ids", async () => {
    const path = writeManifest(
      "dupe.toml",
      `id = "codey"
name = "codey"
version = "0.1.0"
platforms = ["linux"]

[[actions]]
id = "toggle"
command = ["true"]

[[actions]]
id = "toggle"
command = ["false"]
`
    );
    const result = await loadManifest(path);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("duplicate action toggle");
  });

  test("reports a missing manifest file", async () => {
    const result = await loadManifest(join(dir, "nope.toml"));
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toContain("manifest not found");
  });
});
