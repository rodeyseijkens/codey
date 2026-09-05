#!/usr/bin/env node
// Bin shim for the published @rodey-io/codey package. Resolves the prebuilt
// binary from the matching @rodey-io/codey-<os>-<arch>[-musl] platform package
// (an optionalDependency of the root package) and runs it. No bun, no deps.
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const SUPPORTED = new Map([
  ["darwin:arm64", "darwin-arm64"],
  ["darwin:x64", "darwin-x64"],
  ["linux:x64", "linux-x64"],
  ["linux:arm64", "linux-arm64"],
]);

function isMusl() {
  if (process.platform !== "linux") {
    return false;
  }
  try {
    const report = process.report?.getReport?.();
    if (report?.header?.glibcVersionRuntime) {
      return false;
    }
  } catch {
    // fall through to ldd sniff
  }
  try {
    const res = spawnSync("ldd", ["--version"], { encoding: "utf8" });
    const out = `${res.stdout ?? ""}${res.stderr ?? ""}`;
    return out.toLowerCase().includes("musl");
  } catch {
    return false;
  }
}

function targetTriple() {
  const base = SUPPORTED.get(`${process.platform}:${process.arch}`);
  if (!base) {
    return null;
  }
  return isMusl() ? `${base}-musl` : base;
}

function main() {
  const triple = targetTriple();
  if (!triple) {
    console.error(
      `codey: unsupported platform ${process.platform}/${process.arch}. ` +
        "Supported: macOS (arm64, x64) and Linux (x64, arm64, glibc and musl).",
    );
    process.exit(1);
  }

  const pkg = `@rodey-io/codey-${triple}`;
  const require = createRequire(import.meta.url);
  let binary;
  try {
    binary = join(dirname(require.resolve(`${pkg}/package.json`)), "bin/codey");
  } catch {
    console.error(
      `codey: the platform package ${pkg} is not installed.\n` +
        "This usually means your package manager skipped optionalDependencies. " +
        "Reinstall with optional dependencies enabled, or install it directly:\n\n" +
        `  npm install -g ${pkg}\n\n` +
        "On Alpine Linux (musl), also run: apk add libstdc++ libgcc",
    );
    process.exit(1);
  }

  const result = spawnSync(binary, process.argv.slice(2), {
    stdio: "inherit",
  });
  if (result.error) {
    console.error(`codey: failed to run ${binary}: ${result.error.message}`);
    if (triple.endsWith("-musl")) {
      console.error(
        "On Alpine Linux (musl), the binary needs: apk add libstdc++ libgcc",
      );
    }
    process.exit(1);
  }
  if (result.signal) {
    process.kill(process.pid, result.signal);
    return;
  }
  process.exit(result.status ?? 0);
}

main();
