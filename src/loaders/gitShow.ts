// biome-ignore lint/style/useFilenamingConvention: spec requires this filename
import type { Changeset } from "../types";
import { gitThrow } from "../vcs/git";
import { buildGitChangeset } from "./shared";

export async function gitShow(rev: string, cwd: string): Promise<Changeset> {
  const base = [
    "show",
    "--patch",
    "--format=",
    "--no-color",
    "--find-renames",
    rev,
  ];
  const [diffText, nameStatus, numstat] = await Promise.all([
    gitThrow(base, cwd),
    gitThrow(
      [
        "show",
        "--name-status",
        "--format=",
        "--no-color",
        "--find-renames",
        rev,
      ],
      cwd
    ),
    gitThrow(
      ["show", "--numstat", "--format=", "--no-color", "--find-renames", rev],
      cwd
    ),
  ]);
  return buildGitChangeset({
    diffText,
    id: "single",
    label: `show ${rev}`,
    nameStatus,
    numstat,
  });
}
