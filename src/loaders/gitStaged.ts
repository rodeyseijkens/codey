// biome-ignore lint/style/useFilenamingConvention: spec requires this filename
import type { Changeset } from "../types";
import { gitThrow } from "../vcs/git";
import { DEFAULT_IGNORE_FILES } from "./ignore";
import { buildGitChangeset } from "./shared";

export async function gitStaged(
  cwd: string,
  ignoreFiles: readonly string[] = DEFAULT_IGNORE_FILES
): Promise<Changeset> {
  const base = ["diff", "--cached", "--no-color", "-M", "-U999999"];
  const [nameStatus, numstat, diffText] = await Promise.all([
    gitThrow([...base, "--name-status"], cwd),
    gitThrow([...base, "--numstat"], cwd),
    gitThrow(base, cwd),
  ]);
  return buildGitChangeset({
    diffText,
    id: "staged",
    ignoreFiles,
    label: "Staged",
    nameStatus,
    numstat,
  });
}
