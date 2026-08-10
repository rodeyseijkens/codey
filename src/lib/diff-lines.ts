export type DiffRowType = "add" | "del" | "context";

export interface DiffRow {
  hunkIndex: number;
  newLine?: number;
  oldLine?: number;
  text: string;
  type: DiffRowType;
}

const HUNK_HEADER = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

export function parseDiffRows(diffText: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let oldLine = 0;
  let newLine = 0;
  let hunkIndex = -1;
  let seenHunk = false;
  for (const line of diffText.split("\n")) {
    if (line.startsWith("@@")) {
      const m = line.match(HUNK_HEADER);
      if (m) {
        seenHunk = true;
        const [, oldStart, newStart] = m;
        oldLine = Number(oldStart);
        newLine = Number(newStart);
        hunkIndex += 1;
      }
      continue;
    }
    if (!seenHunk) {
      continue;
    }
    const [first] = line;
    if (first === "+") {
      rows.push({
        hunkIndex,
        newLine,
        text: line.slice(1),
        type: "add",
      });
      newLine += 1;
    } else if (first === "-") {
      rows.push({
        hunkIndex,
        oldLine,
        text: line.slice(1),
        type: "del",
      });
      oldLine += 1;
    } else if (first === " ") {
      rows.push({
        hunkIndex,
        newLine,
        oldLine,
        text: line.slice(1),
        type: "context",
      });
      oldLine += 1;
      newLine += 1;
    }
  }
  return rows;
}

export function rowLabel(row: DiffRow): string {
  if (row.type === "add") {
    return `+${row.newLine ?? "?"}`;
  }
  if (row.type === "del") {
    return `-${row.oldLine ?? "?"}`;
  }
  return `${row.newLine ?? "?"}`;
}

const CHANGE_GAP = 3;

export function changeGroupOffsets(rows: DiffRow[]): number[] {
  const offsets: number[] = [];
  let lastChange = Number.NEGATIVE_INFINITY;
  rows.forEach((row, i) => {
    if (row.type === "add" || row.type === "del") {
      if (offsets.length === 0 || i - lastChange > CHANGE_GAP) {
        offsets.push(i);
      }
      lastChange = i;
    }
  });
  return offsets;
}
