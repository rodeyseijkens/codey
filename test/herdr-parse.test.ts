import { asArray, asRecord, asString, parseJson } from "../src/herdr/parse";
import { describe, expect, test } from "bun:test";

describe("parseJson", () => {
  test("parses valid JSON", () => {
    const result = parseJson('{"a": 1}');
    expect(result).toEqual({ a: 1 });
  });

  test("returns null for invalid JSON", () => {
    expect(parseJson("not json")).toBeNull();
  });

  test("returns null for undefined", () => {
    expect(parseJson(undefined)).toBeNull();
  });

  test("returns null for null input", () => {
    expect(parseJson(null)).toBeNull();
  });

  test("parses JSON array", () => {
    const result = parseJson("[1, 2, 3]");
    expect(result).toEqual([1, 2, 3]);
  });

  test("parses JSON string", () => {
    const result = parseJson('"hello"');
    expect(result).toBe("hello");
  });

  test("returns null for empty string", () => {
    expect(parseJson("")).toBeNull();
  });
});

describe("asRecord", () => {
  test("returns record for object", () => {
    const result = asRecord({ a: 1 });
    expect(result).toEqual({ a: 1 });
  });

  test("returns null for null", () => {
    expect(asRecord(null)).toBeNull();
  });

  test("returns null for array", () => {
    expect(asRecord([1, 2])).toBeNull();
  });

  test("returns null for string", () => {
    expect(asRecord("hello")).toBeNull();
  });

  test("returns null for number", () => {
    expect(asRecord(42)).toBeNull();
  });

  test("returns null for undefined", () => {
    expect(asRecord(undefined)).toBeNull();
  });
});

describe("asString", () => {
  test("returns string for string", () => {
    expect(asString("hello")).toBe("hello");
  });

  test("returns null for number", () => {
    expect(asString(42)).toBeNull();
  });

  test("returns null for object", () => {
    expect(asString({})).toBeNull();
  });

  test("returns null for null", () => {
    expect(asString(null)).toBeNull();
  });

  test("returns null for undefined", () => {
    expect(asString(undefined)).toBeNull();
  });
});

describe("asArray", () => {
  test("returns array for array", () => {
    expect(asArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  test("returns null for object", () => {
    expect(asArray({ a: 1 })).toBeNull();
  });

  test("returns null for string", () => {
    expect(asArray("hello")).toBeNull();
  });

  test("returns null for null", () => {
    expect(asArray(null)).toBeNull();
  });

  test("returns null for undefined", () => {
    expect(asArray(undefined)).toBeNull();
  });
});
