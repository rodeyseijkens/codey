import { normalizeDiffPath } from "../diff/diffPaths";
import { formatTerminalPath } from "../diff/terminalText";
import type {
  AgentAnnotation,
  DiffFile,
  ReviewNoteSource,
} from "../diff/types";

export function reviewNoteSource(
  annotation: AgentAnnotation,
): ReviewNoteSource {
  if (annotation.source === "user") {
    return "user";
  }
  if (annotation.source === "mcp" || annotation.source === "agent") {
    return "agent";
  }
  return "ai";
}

function formatGithubStyleRange(prefix: "L" | "R", range: [number, number]) {
  return range[0] === range[1]
    ? `${prefix}${range[0]}`
    : `${prefix}${range[0]}–${prefix}${range[1]}`;
}

function fileLabel(file: DiffFile | undefined) {
  if (!file) {
    return "No file selected";
  }
  const path = formatTerminalPath(normalizeDiffPath(file.path) ?? file.path);
  const previousPath = file.previousPath
    ? formatTerminalPath(
        normalizeDiffPath(file.previousPath) ?? file.previousPath,
      )
    : undefined;
  return previousPath && previousPath !== path
    ? `${previousPath} -> ${path}`
    : path;
}

export function annotationRangeLabel(
  annotation: AgentAnnotation,
  file?: DiffFile,
) {
  const locationParts: string[] = [];
  if (annotation.oldRange) {
    locationParts.push(formatGithubStyleRange("L", annotation.oldRange));
  }
  if (annotation.newRange) {
    locationParts.push(formatGithubStyleRange("R", annotation.newRange));
  }
  const location = locationParts.join(" → ") || "hunk";
  return file ? `${fileLabel(file)} ${location}` : location;
}
