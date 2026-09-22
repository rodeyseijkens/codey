import { formatLineRangeLabel } from "../../../patch/line-range";
import { normalizeDiffPath } from "../render/diffPaths";
import { formatTerminalPath } from "../render/terminalText";
import type {
  AgentAnnotation,
  DiffFile,
  ReviewNoteSource,
} from "../render/types";

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
  const location =
    formatLineRangeLabel(annotation.oldRange, annotation.newRange) || "hunk";
  return file ? `${fileLabel(file)} ${location}` : location;
}
