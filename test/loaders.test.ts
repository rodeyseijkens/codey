import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { gitShow } from "../src/loaders/gitShow";
import { gitStaged } from "../src/loaders/gitStaged";
import { gitUnstaged } from "../src/loaders/gitUnstaged";
import { stdinPatch } from "../src/loaders/stdinPatch";
import { twoFile } from "../src/loaders/twoFile";
import { gitThrow } from "../src/vcs/git";
import { afterAll, describe, expect, test } from "bun:test";

const dirs: string[] = [];

async function initRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "codey-loaders-"));
  dirs.push(dir);
  await gitThrow(["init", "-q"], dir);
  await gitThrow(["config", "user.name", "Test User"], dir);
  await gitThrow(["config", "user.email", "test@example.com"], dir);
  return dir;
}

async function commitAll(dir: string, message: string): Promise<void> {
  await gitThrow(["add", "-A"], dir);
  await gitThrow(["commit", "-qm", message], dir);
}

afterAll(async () => {
  await Promise.all(
    dirs.map((dir) => rm(dir, { force: true, recursive: true })),
  );
});

describe("gitStaged", () => {
  test("lists a newly added file", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "hello\n");
    await gitThrow(["add", "a.txt"], dir);

    const cs = await gitStaged(dir);
    expect(cs.id).toBe("staged");
    expect(cs.label).toBe("Staged");
    expect(cs.files).toHaveLength(1);
    expect(cs.files[0]?.path).toBe("a.txt");
    expect(cs.files[0]?.status).toBe("added");
    expect(cs.files[0]?.diff).toContain("+hello");
    expect(cs.files[0]?.additions).toBe(1);
    expect(cs.stats.files).toBe(1);
    expect(cs.stats.additions).toBe(1);
  });

  test("detects renames", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "old.txt"), "content\n");
    await commitAll(dir, "init");
    await gitThrow(["mv", "old.txt", "new.txt"], dir);

    const cs = await gitStaged(dir);
    expect(cs.files).toHaveLength(1);
    expect(cs.files[0]?.status).toBe("renamed");
    expect(cs.files[0]?.oldPath).toBe("old.txt");
    expect(cs.files[0]?.path).toBe("new.txt");
  });

  test("marks binary files", async () => {
    const dir = await initRepo();
    const buf = Buffer.alloc(256);
    buf.write("\x89PNG\r\n\x1a\n", 0, "latin1");
    await writeFile(join(dir, "img.png"), buf);
    await gitThrow(["add", "img.png"], dir);

    const cs = await gitStaged(dir);
    const file = cs.files.find((f) => f.path === "img.png");
    expect(file).toBeDefined();
    expect(file?.isBinary).toBe(true);
    expect(file?.diff).toBe("");
  });

  test("keeps lock files in the list but marks them ignored", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "package-lock.json"), "{}\n");
    await writeFile(join(dir, "pnpm-lock.yaml"), "lockfileVersion: 9\n");
    await writeFile(join(dir, "a.txt"), "hello\n");
    await gitThrow(["add", "-A"], dir);

    const cs = await gitStaged(dir);
    expect(
      cs.files.map((f) => f.path).sort((a, b) => a.localeCompare(b)),
    ).toEqual(["a.txt", "package-lock.json", "pnpm-lock.yaml"]);
    expect(cs.stats.files).toBe(3);
    const lock = cs.files.find((f) => f.path === "package-lock.json");
    expect(lock?.ignored).toBe(true);
    expect(lock?.diff).toBe("");
    const plain = cs.files.find((f) => f.path === "a.txt");
    expect(plain?.ignored).toBeFalsy();
    expect(plain?.diff).toContain("+hello");
  });

  test("loads lock file diffs when ignoreFiles is overridden", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "package-lock.json"), "{}\n");
    await writeFile(join(dir, "a.txt"), "hello\n");
    await gitThrow(["add", "-A"], dir);

    const cs = await gitStaged(dir, []);
    expect(
      cs.files.map((f) => f.path).sort((a, b) => a.localeCompare(b)),
    ).toEqual(["a.txt", "package-lock.json"]);
    const lock = cs.files.find((f) => f.path === "package-lock.json");
    expect(lock?.ignored).toBeFalsy();
    expect(lock?.diff).toContain("{}");
  });
});

describe("gitUnstaged", () => {
  test("lists a modified tracked file", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "one\n");
    await commitAll(dir, "init");
    await writeFile(join(dir, "a.txt"), "one\nchanged\n");

    const cs = await gitUnstaged(dir);
    expect(cs.id).toBe("changes");
    expect(cs.label).toBe("Changes");
    expect(cs.files).toHaveLength(1);
    expect(cs.files[0]?.path).toBe("a.txt");
    expect(cs.files[0]?.status).toBe("modified");
    expect(cs.files[0]?.diff).toContain("+changed");
  });

  test("includes untracked files with a synthetic diff", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "new.txt"), "fresh\ncontent\n");

    const cs = await gitUnstaged(dir);
    const file = cs.files.find((f) => f.path === "new.txt");
    expect(file).toBeDefined();
    expect(file?.status).toBe("added");
    expect(file?.diff).toContain("+fresh");
    expect(file?.diff).toContain("+content");
    expect(file?.diff).toContain("+++ b/new.txt");
    expect(file?.additions).toBe(2);
  });

  test("marks files over the size limit", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "big.txt"), "x".repeat(2 * 1024 * 1024 + 1024));

    const cs = await gitUnstaged(dir);
    const file = cs.files.find((f) => f.path === "big.txt");
    expect(file).toBeDefined();
    expect(file?.tooLarge).toBe(true);
    expect(file?.diff).toBe("");
  });

  test("marks untracked lock files ignored without dropping them", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "new.txt"), "fresh\n");
    await writeFile(join(dir, "bun.lockb"), "not a text lock\n");

    const cs = await gitUnstaged(dir);
    const lock = cs.files.find((f) => f.path === "bun.lockb");
    expect(lock).toBeDefined();
    expect(lock?.ignored).toBe(true);
    expect(lock?.diff).toBe("");
    expect(
      cs.files.map((f) => f.path).sort((a, b) => a.localeCompare(b)),
    ).toEqual(["bun.lockb", "new.txt"]);
    const overridden = await gitUnstaged(dir, []);
    const shown = overridden.files.find((f) => f.path === "bun.lockb");
    expect(shown?.ignored).toBeFalsy();
    expect(shown?.diff).not.toBe("");
  });
});

describe("gitShow", () => {
  test("returns a commit's diff", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "base\n");
    await commitAll(dir, "first");
    await writeFile(join(dir, "a.txt"), "base\nupdated\n");
    await commitAll(dir, "second");

    const cs = await gitShow("HEAD", dir);
    expect(cs.id).toBe("single");
    expect(cs.label).toBe("show HEAD");
    expect(cs.files).toHaveLength(1);
    expect(cs.files[0]?.path).toBe("a.txt");
    expect(cs.files[0]?.diff).toContain("+updated");
    expect(cs.files[0]?.additions).toBe(1);
  });

  test("shows a file added in the commit", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "base\n");
    await commitAll(dir, "first");
    await writeFile(join(dir, "b.txt"), "new file\n");
    await commitAll(dir, "second");

    const cs = await gitShow("HEAD", dir);
    expect(cs.files).toHaveLength(1);
    expect(cs.files[0]?.path).toBe("b.txt");
    expect(cs.files[0]?.status).toBe("added");
  });

  test("keeps lock files listed but ignored and honors an override", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "base\n");
    await commitAll(dir, "first");
    await writeFile(join(dir, "a.txt"), "base\nupdated\n");
    await writeFile(join(dir, "package-lock.json"), "{}\n");
    await commitAll(dir, "second");

    const cs = await gitShow("HEAD", dir);
    const lock = cs.files.find((f) => f.path === "package-lock.json");
    expect(lock).toBeDefined();
    expect(lock?.ignored).toBe(true);
    expect(lock?.diff).toBe("");
    expect(
      cs.files.map((f) => f.path).sort((a, b) => a.localeCompare(b)),
    ).toEqual(["a.txt", "package-lock.json"]);

    const overridden = await gitShow("HEAD", dir, []);
    const shown = overridden.files.find((f) => f.path === "package-lock.json");
    expect(shown?.ignored).toBeFalsy();
    expect(shown?.diff).toContain("{}");
  });
});

describe("twoFile", () => {
  test("diffs two files on disk", async () => {
    const dir = await initRepo();
    const fileA = join(dir, "a.txt");
    const fileB = join(dir, "b.txt");
    await writeFile(fileA, "one\ntwo\n");
    await writeFile(fileB, "one\nthree\n");

    const cs = await twoFile(fileA, fileB, dir);
    expect(cs.id).toBe("single");
    expect(cs.files).toHaveLength(1);
    expect(cs.files[0]?.diff).toContain("-two");
    expect(cs.files[0]?.diff).toContain("+three");
    expect(cs.files[0]?.additions).toBe(1);
    expect(cs.files[0]?.deletions).toBe(1);
  });

  test("diffs two git refs", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "v1\n");
    await commitAll(dir, "first");
    await writeFile(join(dir, "a.txt"), "v2\n");
    await commitAll(dir, "second");

    const cs = await twoFile("HEAD~1", "HEAD", dir);
    expect(cs.label).toBe("diff HEAD~1..HEAD");
    expect(cs.files).toHaveLength(1);
    expect(cs.files[0]?.diff).toContain("-v1");
    expect(cs.files[0]?.diff).toContain("+v2");
  });

  test("throws when a file is missing", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "a.txt"), "one\n");
    expect(
      twoFile(join(dir, "a.txt"), join(dir, "nope.txt"), dir),
    ).rejects.toThrow("no such file");
  });
});

describe("stdinPatch", () => {
  test("splits a multi-file patch", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "x.txt"), "x\n");
    await writeFile(join(dir, "y.txt"), "y\n");
    await commitAll(dir, "init");
    await writeFile(join(dir, "x.txt"), "x\nx2\n");
    await writeFile(join(dir, "y.txt"), "y\ny2\n");
    const patch = await gitThrow(["diff", "--no-color"], dir);

    const cs = await stdinPatch(patch);
    expect(cs.id).toBe("single");
    expect(cs.label).toBe("patch");
    expect(cs.files).toHaveLength(2);
    expect(
      cs.files.map((f) => f.path).sort((a, b) => a.localeCompare(b)),
    ).toEqual(["x.txt", "y.txt"]);
    expect(cs.files.map((f) => f.status)).toEqual(["modified", "modified"]);
    expect(cs.files[0]?.diff).toContain("+x2");
    expect(cs.files[1]?.diff).toContain("+y2");
    expect(cs.files[0]?.additions).toBe(1);
  });

  test("handles added and renamed files", async () => {
    const dir = await initRepo();
    await writeFile(join(dir, "old.txt"), "a\nb\n");
    await commitAll(dir, "init");
    await gitThrow(["mv", "old.txt", "new.txt"], dir);
    await writeFile(join(dir, "fresh.txt"), "c\n");
    await gitThrow(["add", "-A"], dir);
    const patch = await gitThrow(["diff", "--cached", "--no-color", "-M"], dir);

    const cs = await stdinPatch(patch);
    const byPath = new Map(cs.files.map((f) => [f.path, f]));
    expect(byPath.get("new.txt")?.status).toBe("renamed");
    expect(byPath.get("new.txt")?.oldPath).toBe("old.txt");
    expect(byPath.get("fresh.txt")?.status).toBe("added");
  });
});
