import { type CliRenderer, createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Command } from "commander";
import { loadConfig } from "./config";
import { captureTurnBaseline, isHerdrPlugin } from "./herdr";
import { resolveKeymap } from "./keymap/index";
import { buildRuntime, type Runtime } from "./runtime";
import { refresh } from "./state/actions";
import { setQuitHandler, setRestartHandler } from "./state/dispatch";
import { AppStore, getStore, setStore } from "./state/store";
import type { DiffMode, LoaderMode } from "./types";
import { App } from "./ui/app";
import { startWatcher } from "./watch";

const VERSION = "0.1.0";

interface CliFlags {
  mode?: string;
  tabWidth?: string;
  theme?: string;
  view?: string;
  watch?: boolean;
}
interface RunOptions {
  a?: string;
  b?: string;
  flags: CliFlags;
  mode: LoaderMode;
  patchInput?: string;
  rev?: string;
}

let renderer: CliRenderer | null = null;
let stopWatcher: (() => void) | null = null;
let sessionOpts: RunOptions | null = null;

async function readAllStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function startSession(opts: RunOptions): Promise<void> {
  const store = getStore();
  store.set({ fatalError: null });

  const cfgRes = await loadConfig();
  if (!cfgRes.ok) {
    store.set({ fatalError: `${cfgRes.error} — fix and press r to retry` });
    return;
  }
  const { config } = cfgRes;

  const keymapRes = resolveKeymap(config.keybindings);
  if (!keymapRes.ok) {
    const msg = keymapRes.errors.map((e) => e.message).join("; ");
    store.set({
      fatalError: `keybindings invalid: ${msg} — fix ${cfgRes.path} and press r to retry`,
    });
    return;
  }

  store.set({
    gutterSign: config.gutterSign,
    ignoreFiles: config.ignoreFiles,
    keymap: keymapRes.keymap,
    layoutMode: opts.flags.mode ? (opts.flags.mode as DiffMode) : config.mode,
    lineNumbers: config.lineNumbers,
    sidebarView: opts.flags.view
      ? (opts.flags.view as "tree" | "list")
      : config.view,
    sidebarWidth: config.sidebarWidth,
    tabWidth: opts.flags.tabWidth
      ? Number.parseInt(opts.flags.tabWidth, 10)
      : config.tabWidth,
    theme: opts.flags.theme ?? config.theme,
  });

  let runtime: Runtime;
  try {
    runtime = await buildRuntime({
      a: opts.a,
      b: opts.b,
      ignoreFiles: config.ignoreFiles,
      mode: opts.mode,
      patchInput: opts.patchInput,
      rev: opts.rev,
    });
  } catch (err) {
    store.set({
      fatalError: `${err instanceof Error ? err.message : String(err)} — press r to retry`,
    });
    return;
  }

  store.set({
    ignoreFiles: config.ignoreFiles,
    load: runtime.load,
    loaderMode: runtime.mode,
    repoRoot: runtime.repoRoot ?? process.cwd(),
    stagingEnabled: runtime.stagingEnabled,
  });

  if (stopWatcher) {
    stopWatcher();
    stopWatcher = null;
  }
  const wantWatch =
    (opts.flags.watch || config.watch) &&
    runtime.gitDir !== null &&
    runtime.repoRoot !== null;
  if (wantWatch && runtime.gitDir && runtime.repoRoot) {
    stopWatcher = startWatcher({
      gitDir: runtime.gitDir,
      onChange: () => {
        void refresh();
      },
      root: runtime.repoRoot,
    });
    store.set({ watchActive: true });
  } else {
    store.set({ watchActive: false });
  }

  if (isHerdrPlugin()) {
    void captureTurnBaseline();
  }

  await refresh();
}

async function boot(opts: RunOptions): Promise<void> {
  setStore(new AppStore());

  const isPipedStdin = !process.stdin.isTTY;
  const rendererConfig: Parameters<typeof createCliRenderer>[0] = {
    exitOnCtrlC: false,
    useMouse: true,
  };
  if (isPipedStdin && (opts.mode === "pager" || opts.mode === "patch")) {
    const { createReadStream, createWriteStream, openSync } = await import(
      "node:fs"
    );
    rendererConfig.stdin = createReadStream("/dev/tty", {
      fd: openSync("/dev/tty", "r"),
    }) as unknown as NodeJS.ReadStream;
    rendererConfig.stdout = createWriteStream("/dev/tty", {
      fd: openSync("/dev/tty", "w"),
    }) as unknown as NodeJS.WriteStream;
  }

  renderer = await createCliRenderer(rendererConfig);
  setQuitHandler(() => {
    if (stopWatcher) {
      stopWatcher();
    }
    void renderer?.destroy();
    setTimeout(() => process.exit(0), 50);
  });

  const root = createRoot(renderer);
  root.render(<App />);

  sessionOpts = opts;
  setRestartHandler(() => {
    if (sessionOpts) {
      void startSession(sessionOpts);
    }
  });

  await startSession(opts);
}

const program = new Command();

program
  .name("codey")
  .description(
    "review-first git TUI: staged + changes viewer with transient comments"
  )
  .version(VERSION);

function addCommonFlags(cmd: Command): Command {
  return cmd
    .option("--watch", "watch git index and working tree for changes")
    .option("--mode <mode>", "layout mode: split | stack | auto")
    .option("--theme <theme>", "color theme (see themes list, or auto)")
    .option("--tab-width <n>", "tab width for diff rendering")
    .option("--view <view>", "sidebar view: tree | list");
}

addCommonFlags(
  program
    .command("diff", { isDefault: true })
    .description("review staged + unstaged changes (default)")
)
  .argument("[a]", "first ref or path (with [b], switches to two-file diff)")
  .argument("[b]", "second ref or path")
  .action(
    async (a: string | undefined, b: string | undefined, flags: CliFlags) => {
      const opts: RunOptions =
        a && b ? { a, b, flags, mode: "twoFile" } : { flags, mode: "diff" };
      await boot(opts);
    }
  );

addCommonFlags(
  program.command("show").description("show the diff of a revision (read-only)")
)
  .argument("<rev>", "revision to show (e.g. HEAD, HEAD~2, a commit sha)")
  .action(async (rev: string, flags: CliFlags) => {
    await boot({ flags, mode: "show", rev });
  });

addCommonFlags(
  program.command("patch").description("render a patch from a file or stdin")
)
  .argument("[input]", "patch file path, or '-' for stdin")
  .action(async (input: string | undefined, flags: CliFlags) => {
    let patchInput: string;
    if (!input || input === "-") {
      patchInput = await readAllStdin();
    } else {
      patchInput = await Bun.file(input).text();
    }
    await boot({ flags, mode: "patch", patchInput });
  });

addCommonFlags(
  program
    .command("pager")
    .description("act as a diff pager (reads diff from stdin)")
).action(async (flags: CliFlags) => {
  const patchInput = await readAllStdin();
  await boot({ flags, mode: "pager", patchInput });
});

void program.parseAsync(process.argv);
