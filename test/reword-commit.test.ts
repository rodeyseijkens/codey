import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { gitThrow, rewordCommit } from "../src/vcs/git";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

let root: string;

async function seedCommit(index: number): Promise<void> {
  if (index > 4) {
    return;
  }
  writeFileSync(join(root, `f${index}.txt`), `${index}\n`);
  await gitThrow(["add", "."], root);
  await gitThrow(["commit", "-q", "-m", `commit ${index}`], root);
  await seedCommit(index + 1);
}

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), "codey-reword-test-"));
  await gitThrow(["init", "-q"], root);
  await gitThrow(["config", "user.email", "t@t.t"], root);
  await gitThrow(["config", "user.name", "t"], root);
  await gitThrow(["config", "commit.gpgsign", "false"], root);
  await gitThrow(["config", "core.hooksPath", root], root);
  await seedCommit(1);
});

afterEach(() => {
  rmSync(root, { force: true, recursive: true });
});

async function subjects(): Promise<string[]> {
  return (await gitThrow(["log", "--format=%s"], root)).trim().split("\n");
}

async function subjectOf(ref: string): Promise<string> {
  return (await gitThrow(["log", "-1", "--format=%s", ref], root)).trim();
}

describe("rewordCommit", () => {
  test("rewords the selected middle commit without touching its children", async () => {
    const target = (await gitThrow(["rev-parse", "HEAD~2"], root)).trim();
    const childTree = (
      await gitThrow(["rev-parse", "HEAD~1^{tree}"], root)
    ).trim();

    await rewordCommit(root, target, "commit 2 reworded");

    expect(await subjects()).toEqual([
      "commit 4",
      "commit 3",
      "commit 2 reworded",
      "commit 1",
    ]);
    expect((await gitThrow(["rev-parse", "HEAD~1^{tree}"], root)).trim()).toBe(
      childTree,
    );
  });

  test("rewords HEAD in place", async () => {
    const head = (await gitThrow(["rev-parse", "HEAD"], root)).trim();
    await rewordCommit(root, head, "commit 4 reworded");
    expect(await subjectOf("HEAD")).toBe("commit 4 reworded");
    expect(await subjects()).toHaveLength(4);
  });

  test("rewords HEAD in place without folding staged changes", async () => {
    writeFileSync(join(root, "staged.txt"), "staged\n");
    await gitThrow(["add", "staged.txt"], root);
    const head = (await gitThrow(["rev-parse", "HEAD"], root)).trim();
    await rewordCommit(root, head, "commit 4 reworded");
    expect(await subjectOf("HEAD")).toBe("commit 4 reworded");
    const committed = await gitThrow(
      ["show", "--name-only", "--format=", "HEAD"],
      root,
    );
    expect(committed).not.toContain("staged.txt");
    expect(await gitThrow(["status", "--short"], root)).toContain("staged.txt");
  });

  test("rewords an older commit with a dirty tree and restores changes", async () => {
    const target = (await gitThrow(["rev-parse", "HEAD~2"], root)).trim();
    writeFileSync(join(root, "f1.txt"), "dirty unstaged\n");
    writeFileSync(join(root, "staged.txt"), "staged\n");
    await gitThrow(["add", "staged.txt"], root);

    await rewordCommit(root, target, "commit 2 reworded");

    expect(await subjects()).toEqual([
      "commit 4",
      "commit 3",
      "commit 2 reworded",
      "commit 1",
    ]);
    expect(readFileSync(join(root, "f1.txt"), "utf8")).toBe("dirty unstaged\n");
    expect(readFileSync(join(root, "staged.txt"), "utf8")).toBe("staged\n");
  });

  test("rewords the root commit", async () => {
    const rootCommit = (await gitThrow(["rev-parse", "HEAD~3"], root)).trim();
    await rewordCommit(root, rootCommit, "commit 1 reworded");
    expect(await subjects()).toEqual([
      "commit 4",
      "commit 3",
      "commit 2",
      "commit 1 reworded",
    ]);
  });

  test("preserves quotes and newlines in the message", async () => {
    const target = (await gitThrow(["rev-parse", "HEAD~1"], root)).trim();
    const message = `feat: 'quoted' message\n\nbody with "double" quotes`;
    await rewordCommit(root, target, message);
    expect(await subjectOf("HEAD~1")).toBe("feat: 'quoted' message");
    const body = (
      await gitThrow(["log", "-1", "--format=%B", "HEAD~1"], root)
    ).trimEnd();
    expect(body).toContain('body with "double" quotes');
  });
});
