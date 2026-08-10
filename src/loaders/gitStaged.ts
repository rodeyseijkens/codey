// biome-ignore lint/style/useFilenamingConvention: spec requires this filename
import type { Changeset } from "../types";
import { gitThrow } from "../vcs/git";
import { buildGitChangeset } from "./shared";

export async function gitStaged(cwd: string): Promise<Changeset> {
  const base = ["diff", "--cached", "--no-color", "-M", "-U999999"];
  const [nameStatus, numstat, diffText] = await Promise.all([
    gitThrow([...base, "--name-status"], cwd),
    gitThrow([...base, "--numstat"], cwd),
    gitThrow(base, cwd),
  ]);
  return buildGitChangeset({
    diffText,
    id: "staged",
    label: "Staged",
    nameStatus,
    numstat,
  });
}
