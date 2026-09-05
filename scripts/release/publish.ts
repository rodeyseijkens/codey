// Publish the release to npm and upload GitHub Release assets.
//
//   bun run scripts/release/publish.ts [--version=<v>] [--dry-run]
//
// Version source: --version flag > GITHUB_REF_NAME (vX.Y.Z) > exact git tag.
//
// Generates under dist/publish/:
//   <target>/   @rodey-io/codey-<target> platform packages (binary only)
//   root/       @rodey-io/codey root package (bin/codey.mjs shim + docs)
//
// Publish order: platform packages first, then root — each with
// `npm publish --access public --provenance`. Auth comes from the environment:
// npm Trusted Publishing (OIDC) in CI, or NODE_AUTH_TOKEN during the one-time
// bootstrap. With --dry-run, runs `npm pack` locally instead and skips the
// GitHub asset upload.
import {
  chmod,
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";

import {
  platformPackageName,
  RELEASE_TARGETS,
  type ReleaseTarget,
  ROOT_PACKAGE,
} from "./targets";

const root = new URL("../..", import.meta.url).pathname;
const releaseDir = `${root}dist/release`;
const publishDir = `${root}dist/publish`;

const REPO_URL = "https://github.com/rodeyseijkens/codey";
const VERSION_RE = /^v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/;

type Flags = {
  dryRun: boolean;
  version?: string;
};

type RepoPackage = {
  description?: string;
  version?: string;
  [key: string]: unknown;
};

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { dryRun: false };
  for (const arg of argv) {
    if (arg === "--dry-run") {
      flags.dryRun = true;
    } else if (arg.startsWith("--version=")) {
      flags.version = arg.slice("--version=".length);
    } else {
      console.error(`unknown flag: ${arg}`);
      process.exit(2);
    }
  }
  return flags;
}

function stripV(ref: string): string | null {
  const match = VERSION_RE.exec(ref.trim());
  return match?.[1] ?? null;
}

async function resolveVersion(flags: Flags): Promise<string> {
  if (flags.version) {
    const v = stripV(flags.version);
    if (!v) {
      throw new Error(`invalid --version: ${flags.version}`);
    }
    return v;
  }
  const fromEnv = process.env.GITHUB_REF_NAME;
  if (fromEnv) {
    const v = stripV(fromEnv);
    if (v) {
      return v;
    }
  }
  const proc = Bun.spawn(["git", "describe", "--tags", "--exact-match"], {
    stderr: "pipe",
    stdout: "pipe",
  });
  const out = (await new Response(proc.stdout).text()).trim();
  if ((await proc.exited) !== 0) {
    throw new Error(
      "no version source: pass --version, set GITHUB_REF_NAME, or run on an exact git tag",
    );
  }
  const v = stripV(out);
  if (!v) {
    throw new Error(`git tag is not a version: ${out}`);
  }
  return v;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function run(cmd: string[], cwd: string): Promise<void> {
  console.info(`$ ${cmd.join(" ")}  (cwd: ${cwd})`);
  const proc = Bun.spawn(cmd, { cwd, stderr: "inherit", stdout: "inherit" });
  if ((await proc.exited) !== 0) {
    throw new Error(`command failed: ${cmd.join(" ")}`);
  }
}

async function stagePlatformPackage(
  t: ReleaseTarget,
  version: string,
): Promise<string> {
  const dir = `${publishDir}/${t.target}`;
  await mkdir(`${dir}/bin`, { recursive: true });
  const binary = `${dir}/bin/codey`;
  await copyFile(`${releaseDir}/codey-${t.target}`, binary);
  await chmod(binary, 0o755);
  await writeJson(`${dir}/package.json`, {
    cpu: [t.cpu],
    description: `Prebuilt codey binary for ${t.target}`,
    files: ["bin"],
    homepage: REPO_URL,
    license: "MIT",
    name: platformPackageName(t),
    os: [t.os],
    repository: { type: "git", url: `${REPO_URL}.git` },
    version,
  });
  return dir;
}

async function stageRootPackage(
  repoPkg: RepoPackage,
  version: string,
): Promise<string> {
  const dir = `${publishDir}/root`;
  await mkdir(`${dir}/bin`, { recursive: true });
  await copyFile(`${root}bin/codey.mjs`, `${dir}/bin/codey.mjs`);
  await copyFile(`${root}README.md`, `${dir}/README.md`);
  await copyFile(`${root}LICENSE`, `${dir}/LICENSE`);

  const optionalDependencies = Object.fromEntries(
    RELEASE_TARGETS.map((t) => [platformPackageName(t), version]),
  );
  await writeJson(`${dir}/package.json`, {
    bin: { codey: "bin/codey.mjs" },
    cpu: ["x64", "arm64"],
    description: repoPkg.description,
    engines: { node: ">=18" },
    files: ["bin", "README.md", "LICENSE"],
    homepage: REPO_URL,
    license: "MIT",
    name: ROOT_PACKAGE,
    optionalDependencies,
    os: ["darwin", "linux"],
    repository: { type: "git", url: `${REPO_URL}.git` },
    type: "module",
    version,
  });
  return dir;
}

async function publishPackage(dir: string, dryRun: boolean): Promise<void> {
  if (dryRun) {
    await run(["npm", "pack", "--dry-run"], dir);
    return;
  }
  await run(["npm", "publish", "--access", "public", "--provenance"], dir);
}

async function uploadReleaseAssets(version: string): Promise<void> {
  const assets = RELEASE_TARGETS.map(
    (t) => `${releaseDir}/codey-${version}-${t.target}.tar.gz`,
  );
  await run(
    ["gh", "release", "upload", `v${version}`, ...assets, "--clobber"],
    root,
  );
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const version = await resolveVersion(flags);
  const repoPkg: RepoPackage = JSON.parse(
    await readFile(`${root}package.json`, "utf8"),
  );
  console.info(
    `${flags.dryRun ? "[dry-run] " : ""}publishing ${ROOT_PACKAGE}@${version}`,
  );

  await rm(publishDir, { force: true, recursive: true });
  await mkdir(publishDir, { recursive: true });

  const platformDirs: string[] = [];
  for (const t of RELEASE_TARGETS) {
    // biome-ignore lint/performance/noAwaitInLoops: staging is cheap and order is explicit
    platformDirs.push(await stagePlatformPackage(t, version));
  }
  const rootDir = await stageRootPackage(repoPkg, version);

  for (const dir of [...platformDirs, rootDir]) {
    // biome-ignore lint/performance/noAwaitInLoops: publish order matters (platform packages before root)
    await publishPackage(dir, flags.dryRun);
  }

  if (flags.dryRun) {
    console.info("[dry-run] skipping GitHub Release asset upload");
    return;
  }
  await uploadReleaseAssets(version);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
