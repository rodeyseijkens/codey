import chokidar from "chokidar";
import { git } from "./vcs/git";

export interface WatcherOptions {
  debounceMs?: number;
  gitDir: string;
  onChange: () => void;
  pollMs?: number;
  root: string;
}

async function repoSnapshot(root: string): Promise<string> {
  const status = await git(["status", "--porcelain"], root);
  return `${status.exitCode}:${status.stdout}`;
}

function startPolling(
  root: string,
  trigger: () => void,
  pollMs: number
): () => void {
  let last: string | null = null;
  let busy = false;
  const interval = setInterval(() => {
    if (busy) {
      return;
    }
    busy = true;
    repoSnapshot(root)
      .then((snap) => {
        if (last !== null && snap !== last) {
          trigger();
        }
        last = snap;
      })
      .catch(() => {
        // repo transiently unreadable — keep previous snapshot
      })
      .finally(() => {
        busy = false;
      });
  }, pollMs);
  return () => {
    clearInterval(interval);
  };
}

export function startWatcher(opts: WatcherOptions): () => void {
  const { gitDir, root, onChange, debounceMs = 300, pollMs = 2000 } = opts;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopPoll: (() => void) | null = null;

  const trigger = () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      onChange();
    }, debounceMs);
  };

  let watcher: ReturnType<typeof chokidar.watch> | null = null;
  try {
    watcher = chokidar.watch([`${gitDir}/index`, `${gitDir}/HEAD`, root], {
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/dist/**",
        "**/.turbo/**",
        "**/bin/**",
      ],
      ignoreInitial: true,
      persistent: true,
    });
    watcher.on("change", trigger);
    watcher.on("add", trigger);
    watcher.on("unlink", trigger);
    watcher.on("error", () => {
      // chokidar failed (inotify limits, FS races on .git/index) — fall back
      void watcher?.close();
      watcher = null;
      if (!stopPoll) {
        stopPoll = startPolling(root, trigger, pollMs);
      }
    });
  } catch {
    watcher = null;
  }

  if (!watcher) {
    stopPoll = startPolling(root, trigger, pollMs);
  }

  return () => {
    if (timer) {
      clearTimeout(timer);
    }
    if (stopPoll) {
      stopPoll();
    }
    void watcher?.close();
  };
}
