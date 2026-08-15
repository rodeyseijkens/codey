import { chmod, mkdir, writeFile } from "node:fs/promises";

const root = new URL("..", import.meta.url).pathname;
const JS_EXT = /\.js$/;

function launcher(relEntry: string): string {
  const sourceEntry = relEntry.replace("dist/", "src/").replace(JS_EXT, ".ts");
  return `#!/usr/bin/env bun
"use strict";
const { spawnSync } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const pkgRoot = path.resolve(__dirname, "..");
const bundled = path.join(pkgRoot, ${JSON.stringify(relEntry)});
const source = path.join(pkgRoot, ${JSON.stringify(sourceEntry)});
const entry = existsSync(bundled) ? bundled : source;

if (!existsSync(entry)) {
  console.error("codey: cannot find entry point (run pnpm build from the repo)");
  process.exit(1);
}

const result = spawnSync("bun", [entry, ...process.argv.slice(2)], {
  stdio: "inherit",
});
if (result.error && result.error.code === "ENOENT") {
  console.error("codey: bun runtime not found on PATH. Install bun (https://bun.sh) — required for the OpenTUI native core.");
  process.exit(1);
}
process.exit(result.status ?? 0);
`;
}

async function main() {
  await mkdir(`${root}bin`, { recursive: true });
  await mkdir(`${root}dist`, { recursive: true });

  const result = await Bun.build({
    entrypoints: [`${root}src/main.tsx`, `${root}src/herdr/cli.ts`],
    external: [
      "@opentui/core",
      "@opentui/react",
      "react",
      "react-reconciler",
      "chokidar",
    ],
    naming: "[dir]/[name].js",
    outdir: `${root}dist`,
    target: "bun",
  });

  if (!result.success) {
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  await writeFile(`${root}bin/codey.cjs`, launcher("dist/main.js"), "utf8");
  await writeFile(`${root}bin/codey`, launcher("dist/main.js"), "utf8");
  await writeFile(
    `${root}bin/codey-herdr`,
    launcher("dist/herdr/cli.js"),
    "utf8"
  );
  await chmod(`${root}bin/codey.cjs`, 0o755);
  await chmod(`${root}bin/codey`, 0o755);
  await chmod(`${root}bin/codey-herdr`, 0o755);
  console.log(
    "built dist/main.js, dist/herdr/cli.js + bin/codey, bin/codey.cjs, bin/codey-herdr"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
