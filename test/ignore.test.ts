import {
  compileIgnorePatterns,
  DEFAULT_IGNORE_FILES,
} from "../src/loaders/ignore";
import { describe, expect, test } from "bun:test";

describe("compileIgnorePatterns", () => {
  test("matches lock files in the default list at any depth", () => {
    const ignore = compileIgnorePatterns(DEFAULT_IGNORE_FILES);
    expect(ignore("package-lock.json")).toBe(true);
    expect(ignore("apps/web/package-lock.json")).toBe(true);
    expect(ignore("pnpm-lock.yaml")).toBe(true);
    expect(ignore("vendor/bundle/Gemfile.lock")).toBe(true);
    expect(ignore("src/index.ts")).toBe(false);
    expect(ignore("package-lock.js")).toBe(false);
  });

  test("matches a bare name at any depth", () => {
    const ignore = compileIgnorePatterns(["requirements.txt"]);
    expect(ignore("requirements.txt")).toBe(true);
    expect(ignore("sub/requirements.txt")).toBe(true);
  });

  test("supports * ? and ** wildcards", () => {
    const ignore = compileIgnorePatterns(["**/*.snap", "lock-?.txt"]);
    expect(ignore("a.snap")).toBe(true);
    expect(ignore("test/__snapshots__/a.snap")).toBe(true);
    expect(ignore("lock-a.txt")).toBe(true);
    expect(ignore("sub/lock-a.txt")).toBe(true);
    expect(ignore("lock-ab.txt")).toBe(false);
    expect(ignore("a.png")).toBe(false);
  });

  test("empty patterns ignore nothing", () => {
    const ignore = compileIgnorePatterns([]);
    expect(ignore("package-lock.json")).toBe(false);
  });
});
