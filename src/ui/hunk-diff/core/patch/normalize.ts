import { normalizeGitPatch, type NormalizedGitPatch } from "./gitFormat";
import { stripGitLogMetadata } from "./gitLog";

function stripTerminalControl(text: string) {
  return text
    .replace(/\x1bP[\s\S]*?\x1b\\/g, "")
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[@-_]/g, "");
}

export function normalizePatch(patchText: string): NormalizedGitPatch {
  return normalizeGitPatch(
    stripGitLogMetadata(stripTerminalControl(patchText.replaceAll("\r\n", "\n"))),
  );
}
