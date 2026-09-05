// Compile per-platform standalone binaries with `bun build --compile` and pack
// them as GitHub Release tarballs.
//
//   bun run scripts/release/build-binaries.ts [--target=<t>] [--version=<v>] [--dry-run]
//
// Outputs into dist/release/:
//   codey-<target>                       standalone binary per target
//   codey-<version>-<target>.tar.gz      release asset (contains a single `codey`)
//
// Prerequisite (enforced by the publish workflow): install all @opentui/core-*
// native packages at the lockfile's @opentui/core version before compiling:
//   bun install --os="*" --cpu="*" @opentui/core@$(bun -p 'require("./node_modules/@opentui/core/package.json").version')
import { chmod, mkdir, readFile } from "node:fs/promises";

import {
  bunCompileTarget,
  findTarget,
  RELEASE_TARGETS,
  type ReleaseTarget,
} from "./targets";

const root = new URL("../..", import.meta.url).pathname;
const outDir = `${root}dist/release`;

type Flags = {
  dryRun: boolean;
  target?: string;
  version?: string;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg.startsWith("--target=")) {
      flags.target = arg.slice("--target=".length);
    } else if (arg.startsWith("--version=")) {
      flags.version = arg.slice("--version=".length);
    } else {
      console.error(`unknown flag: ${arg}`);
      process.exit(2);
    }
  }
  return flags;
}

async function repoVersion(): Promise<string> {
  const pkg = JSON.parse(await readFile(`${root}package.json`, "utf8"));
  return String(pkg.version);
}

async function compileTarget(t: ReleaseTarget, version: string): Promise<void> {
  const outfile = `${outDir}/codey-${t.target}`;
  console.info(`compiling ${t.target} -> ${outfile}`);
  const result = await Bun.build({
    compile: { outfile, target: bunCompileTarget(t) },
    define: t.libc
      ? { "process.env.OPENTUI_LIBC": JSON.stringify(t.libc) }
      : {},
    entrypoints: [`${root}src/main.tsx`],
    minify: true,
    sourcemap: "none",
    target: "bun",
  });
  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    throw new Error(`compile failed for ${t.target}`);
  }
  await chmod(outfile, 0o755);

  const tarball = `${outDir}/codey-${version}-${t.target}.tar.gz`;
  const proc = Bun.spawn(
    [
      "tar",
      "-czf",
      tarball,
      "-C",
      outDir,
      `--transform=s/codey-${t.target}/codey/`,
      `codey-${t.target}`,
    ],
    { stderr: "inherit", stdout: "inherit" },
  );
  if ((await proc.exited) !== 0) {
    throw new Error(`tar failed for ${t.target}`);
  }
  console.info(`packed ${tarball}`);
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const version = flags.version ?? (await repoVersion());

  const targets = flags.target
    ? [findTarget(flags.target)].filter(
        (t): t is ReleaseTarget => t !== undefined,
      )
    : RELEASE_TARGETS;
  if (targets.length === 0) {
    console.error(
      `unknown target: ${flags.target} (expected one of ${RELEASE_TARGETS.map((t) => t.target).join(", ")})`,
    );
    process.exit(2);
  }

  if (flags.dryRun) {
    for (const t of targets) {
      console.info(
        `[dry-run] would compile codey-${t.target} and pack codey-${version}-${t.target}.tar.gz`,
      );
    }
    return;
  }

  await mkdir(outDir, { recursive: true });
  for (const t of targets) {
    // biome-ignore lint/performance/noAwaitInLoops: cross-compiles are memory-heavy; run sequentially on purpose
    await compileTarget(t, version);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
