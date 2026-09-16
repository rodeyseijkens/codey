import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { parse } from "shell-quote";

import { TOAST_KINDS } from "../../types";
import { resumeFromEditor, suspendForEditor } from "../lifecycle";
import { getStore, type Store } from "../store";
import { refresh } from "./core";

const DEFAULT_EDITOR = "vi";

function parseEditorCommand(raw: string): string[] {
  const tokens: string[] = [];
  for (const token of parse(raw)) {
    if (typeof token !== "string") {
      break;
    }
    tokens.push(token);
  }
  return tokens;
}

/**
 * Editor argv from config `editor`, then $VISUAL / $EDITOR, falling back to vi.
 * Non-string shell tokens (pipes, redirects) terminate the argv.
 */
export function editorCommand(override?: string | null): string[] {
  const configured = override?.trim();
  const visual = process.env.VISUAL?.trim();
  const editor = process.env.EDITOR?.trim();
  const raw = configured || visual || editor || DEFAULT_EDITOR;
  const tokens = parseEditorCommand(raw);
  return tokens.length > 0 ? tokens : [DEFAULT_EDITOR];
}

/** Worktree-relative path of the file under the current focus, or null. */
export function resolveEditTarget(store: Store): string | null {
  const state = store.getState();
  if (state.focus === "commits") {
    const row = store.commitCursorRow();
    if (row?.kind === "file") {
      return row.path;
    }
    return state.commitView?.file.path ?? null;
  }
  if (state.focus === "sidebar") {
    const sel = state.selection;
    if (sel?.kind === "file") {
      return store.changeset(sel.scope)?.files[sel.index]?.path ?? null;
    }
    return null;
  }
  return store.selectedFile()?.file.path ?? null;
}

/**
 * Open the file under the current focus in $EDITOR on the same TTY: suspend
 * the renderer (leaving the alt screen), run the editor, then resume and
 * refresh. Mirrors lazygit's behavior.
 */
export async function editFocusedFile(): Promise<void> {
  const store = getStore();
  const state = store.getState();
  if (state.editorBusy) {
    return;
  }
  if (!state.repoRoot) {
    store.showToast(
      TOAST_KINDS.info,
      "no git repository — cannot open the editor",
    );
    return;
  }
  const path = resolveEditTarget(store);
  if (!path) {
    store.showToast(TOAST_KINDS.info, "no file in focus");
    return;
  }
  const abs = isAbsolute(path) ? path : join(state.repoRoot, path);
  if (!existsSync(abs)) {
    store.showToast(TOAST_KINDS.error, `${path} is not in the working tree`);
    return;
  }

  const cmd = editorCommand(state.editor);
  store.set({ editorBusy: true });
  suspendForEditor();
  try {
    const proc = Bun.spawn([...cmd, abs], {
      cwd: state.repoRoot,
      env: process.env,
      stdio: ["inherit", "inherit", "inherit"],
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      store.showToast(
        TOAST_KINDS.error,
        `${cmd[0] ?? "editor"} exited with code ${exitCode}`,
      );
    }
  } catch (err) {
    store.showToast(
      TOAST_KINDS.error,
      `failed to open editor: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    resumeFromEditor();
    store.set({ editorBusy: false });
    await refresh();
  }
}
