#!/usr/bin/env bash
set -euo pipefail

DEMO_DIR="${1:?usage: demo-repo.sh <target-dir> [--long-lines] [--diverge]}"
shift

LONG_LINES=0
DIVERGE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --long-lines) LONG_LINES=1 ;;
    --diverge) DIVERGE=1 ;;
    *)
      echo "unknown flag: $1" >&2
      exit 1
      ;;
  esac
  shift
done

git init -q -b main "$DEMO_DIR"
cd "$DEMO_DIR"
git config user.name "Rodey"
git config user.email "rodey@harbor.dev"
git config commit.gpgsign false

mkdir -p src test

cat > package.json <<'EOF'
{
  "name": "harbor",
  "version": "0.4.1",
  "bin": { "harbor": "dist/cli.js" },
  "scripts": { "test": "bun test" }
}
EOF

cat > README.md <<'EOF'
# harbor

Deploy small things without thinking about it.

```sh
harbor deploy main --env staging
harbor releases --env production
```
EOF

cat > src/cli.ts <<'EOF'
import { parseArgs } from "node:util";

import { loadConfig } from "./config";
import { deploy } from "./deploy";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    env: { short: "e", default: "staging" },
    watch: { short: "w", type: "boolean", default: false },
  },
});

const [command, target] = positionals;
const config = await loadConfig(values.env);

if (command === "deploy") {
  await deploy(config, target ?? "main", values.watch);
} else {
  console.error(`unknown command: ${command}`);
  process.exit(1);
}
EOF

git add -A
git commit -qm "feat: scaffold harbor cli"

cat > src/config.ts <<'EOF'
export type HarborConfig = {
  env: string;
  region: string;
  replicas: number;
  timeoutMs: number;
};

const DEFAULTS: HarborConfig = {
  env: "staging",
  region: "us-east-1",
  replicas: 3,
  timeoutMs: 30_000,
};

export async function loadConfig(env: string): Promise<HarborConfig> {
  const file = Bun.file(`harbor.${env}.toml`);
  const raw = (await file.exists()) ? await file.text() : "";
  return { ...DEFAULTS, env, ...parseOverrides(raw) };
}

function parseOverrides(raw: string): Partial<HarborConfig> {
  const overrides: Record<string, unknown> = {};
  for (const line of raw.split("\n")) {
    const [key, value] = line.split("=");
    if (key && value) {
      overrides[key.trim()] = value.trim();
    }
  }
  return overrides as Partial<HarborConfig>;
}
EOF

git add -A
git commit -qm "feat: add config loader with env overrides"

cat > test/config.test.ts <<'EOF'
import { describe, expect, test } from "bun:test";

import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  test("falls back to defaults for a missing env", async () => {
    const config = await loadConfig("nonexistent");
    expect(config.replicas).toBe(3);
    expect(config.timeoutMs).toBe(30_000);
  });
});
EOF

git add -A
git commit -qm "test: cover config loader defaults"

cat > src/deploy.ts <<'EOF'
import type { HarborConfig } from "./config";

export async function deploy(config: HarborConfig, ref: string, watch = false) {
  const startedAt = Date.now();
  log(`deploying ${ref} to ${config.env} (${config.region})`);

  const release = await createRelease(config, ref);
  await waitForHealth(config, release);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  log(`release ${release.id} is live in ${seconds}s`);

  if (watch) {
    await streamLogs(config, release);
  }
}

async function createRelease(config: HarborConfig, ref: string) {
  log(`creating release from ${ref}`);
  return { id: crypto.randomUUID().slice(0, 8), ref };
}

async function waitForHealth(config: HarborConfig, release: { id: string }) {
  const deadline = Date.now() + config.timeoutMs;
  while (Date.now() < deadline) {
    if (await isHealthy(config, release.id)) {
      return;
    }
    await Bun.sleep(500);
  }
  throw new Error(`release ${release.id} never became healthy`);
}

async function streamLogs(config: HarborConfig, release: { id: string }) {
  const response = await fetch(`https://harbor.local/logs/${release.id}`);
  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return;
    }
    process.stderr.write(value);
  }
}

declare function isHealthy(config: HarborConfig, id: string): Promise<boolean>;

function log(message: string) {
  process.stderr.write(`harbor: ${message}\n`);
}
EOF

git add -A
git commit -qm "feat: stream deploy logs to stderr"

cat > src/rollback.ts <<'EOF'
export type Release = {
  id: string;
  healthy: boolean;
  createdAt: string;
};

export function planRollback(releases: Release[], target: string): Release[] {
  const pivot = releases.findIndex((release) => release.id === target);
  if (pivot === -1) {
    return [];
  }
  return releases.slice(pivot + 1);
}

export function rollbackTargets(releases: Release[], target: string): string[] {
  return planRollback(releases, target).map((release) => release.id);
}
EOF

git add -A
git commit -qm "feat: plan rollbacks after a failed release"

sed -i 's/region: "us-east-1"/region: process.env.HARBOR_REGION ?? "us-east-1"/' src/config.ts
git add -A
git commit -qm "fix: default region to us-east-1"

cat >> README.md <<'EOF'

## Flags

| Flag      | Description                    |
| --------- | ------------------------------ |
| `--env`   | Target environment             |
| `--watch` | Stream logs after the deploy   |
EOF
git add -A
git commit -qm "docs: document deploy flags"

cat > src/rollback.ts <<'EOF'
export type Release = {
  id: string;
  healthy: boolean;
  createdAt: string;
};

export function planRollback(releases: Release[], target: string): Release[] {
  const pivot = releases.findIndex((release) => release.id === target);
  if (pivot === -1) {
    return [];
  }
  return releases
    .slice(pivot + 1)
    .filter((release) => !release.healthy)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function rollbackTargets(releases: Release[], target: string): string[] {
  return planRollback(releases, target).map((release) => release.id);
}
EOF

cat > test/rollback.test.ts <<'EOF'
import { describe, expect, test } from "bun:test";

import { planRollback } from "../src/rollback";

const releases = [
  { id: "c1f9a2", healthy: true, createdAt: "2026-09-18" },
  { id: "b04e77", healthy: false, createdAt: "2026-09-17" },
  { id: "9d3c10", healthy: false, createdAt: "2026-09-16" },
];

describe("planRollback", () => {
  test("collects unhealthy releases after the pivot", () => {
    expect(planRollback(releases, "c1f9a2")).toHaveLength(2);
  });

  test("returns nothing for an unknown target", () => {
    expect(planRollback(releases, "nope")).toEqual([]);
  });
});
EOF

git add src/rollback.ts test/rollback.test.ts

cat > src/deploy.ts <<'EOF'
import type { HarborConfig } from "./config";

const MAX_ATTEMPTS = Number(process.env.HARBOR_DEPLOY_ATTEMPTS ?? 1);

export async function deploy(config: HarborConfig, ref: string, watch = false) {
  const startedAt = Date.now();
  log(`deploying ${ref} to ${config.env} (${config.region})`);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const release = await createRelease(config, ref);
    await waitForHealth(config, release);

    const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    log(`release ${release.id} is live in ${seconds}s`);

    if (watch) {
      await streamLogs(config, release);
      return;
    }
  }
}

async function createRelease(config: HarborConfig, ref: string) {
  log(`creating release from ${ref}`);
  return { id: crypto.randomUUID().slice(0, 8), ref };
}

async function waitForHealth(config: HarborConfig, release: { id: string }) {
  const deadline = Date.now() + config.timeoutMs;
  while (Date.now() < deadline) {
    if (await isHealthy(config, release.id)) {
      return;
    }
    await Bun.sleep(500);
  }
  throw new Error(`release ${release.id} never became healthy`);
}

async function streamLogs(config: HarborConfig, release: { id: string }) {
  const response = await fetch(`https://harbor.local/logs/${release.id}`);
  const reader = response.body?.getReader();
  if (!reader) {
    return;
  }
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return;
    }
    process.stderr.write(value);
  }
}

declare function isHealthy(config: HarborConfig, id: string): Promise<boolean>;

function log(message: string) {
  process.stderr.write(`harbor: ${message}\n`);
}
EOF

if [ "$LONG_LINES" = 1 ]; then
  cat > src/flags.ts <<'EOF'
export const FLAG_REFERENCE = `
harbor deploy <ref>       Create a release from <ref> and wait for it to become healthy before returning; streams logs with --watch.
  --env <name>            Target environment for the deploy; accepts staging, production, or any custom env defined in harbor.<env>.toml.
  --watch                 Stream release logs to stderr until the process is interrupted; implies no early exit on health timeout.
  --attempts <n>          Retry the deploy up to n times when a release never becomes healthy; each attempt creates a fresh release id.
harbor releases           List recent releases for the current environment with id, health, and creation timestamp in a stable order.
  --json                  Emit machine-readable JSON instead of the human table; intended for scripts, CI jobs, and agent tooling.
harbor rollback <id>      Roll back every unhealthy release created after <id>, newest first, and print the ids that were removed.
  --dry-run               Show the rollback plan without touching any release; pairs with --json for review-first agent workflows.
`;
EOF
fi

if [ "$DIVERGE" = 1 ]; then
  REMOTE_DIR="$(dirname "$DEMO_DIR")/harbor-remote.git"
  DIVERGE_DIR="$(dirname "$DEMO_DIR")/harbor-diverge"
  rm -rf "$REMOTE_DIR"
  git init -q --bare "$REMOTE_DIR"
  git remote add origin "$REMOTE_DIR"
  git push -q -u origin main
  git clone -q "$REMOTE_DIR" "$DIVERGE_DIR"
  git -C "$DIVERGE_DIR" config user.name "Rodey"
  git -C "$DIVERGE_DIR" config user.email "rodey@harbor.dev"
  git -C "$DIVERGE_DIR" reset -q --hard HEAD~1
  printf '\n> deprecated: use `harbor releases --json` instead.\n' >> "$DIVERGE_DIR/README.md"
  git -C "$DIVERGE_DIR" commit -qam "docs: stale remote flag docs"
  git -C "$DIVERGE_DIR" push -q --force origin main
  rm -rf "$DIVERGE_DIR"
  git -C "$DEMO_DIR" fetch -q origin
fi
