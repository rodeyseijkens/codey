import { resolveNumstatPath } from "../src/loaders/shared";
import { describe, expect, test } from "bun:test";

describe("resolveNumstatPath", () => {
  test("passes plain paths through", () => {
    expect(resolveNumstatPath("src/a.ts")).toBe("src/a.ts");
  });

  test("resolves full-path renames to the destination", () => {
    expect(resolveNumstatPath("old.txt => new.txt")).toBe("new.txt");
  });

  test("resolves brace-form renames within a shared directory", () => {
    expect(resolveNumstatPath("src/{old.txt => new.txt}")).toBe("src/new.txt");
  });

  test("resolves brace-form renames with a shared suffix", () => {
    expect(resolveNumstatPath("src/{old => new}/deep/x.ts")).toBe(
      "src/new/deep/x.ts",
    );
  });
});
