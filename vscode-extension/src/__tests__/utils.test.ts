import { describe, it, expect } from "vitest";
import {
  getAccessDescription,
  getCompletionLabel,
  escapeRegex,
} from "../utils";

describe("getAccessDescription", () => {
  it("returns read-write for rw", () => {
    expect(getAccessDescription("rw")).toBe("read-write");
  });

  it("returns read-only for ro", () => {
    expect(getAccessDescription("ro")).toBe("read-only");
  });

  it("returns write-only for wo", () => {
    expect(getAccessDescription("wo")).toBe("write-only");
  });

  it("returns write-1-to-clear for w1c", () => {
    expect(getAccessDescription("w1c")).toBe("write-1-to-clear");
  });

  it("returns write-1-to-set for w1s", () => {
    expect(getAccessDescription("w1s")).toBe("write-1-to-set");
  });

  it("returns the input for unknown access types", () => {
    expect(getAccessDescription("custom")).toBe("custom");
  });
});

describe("getCompletionLabel", () => {
  it("returns a plain string label as-is", () => {
    expect(getCompletionLabel("myLabel")).toBe("myLabel");
  });

  it("extracts label from an object", () => {
    expect(getCompletionLabel({ label: "myLabel", description: "desc" })).toBe(
      "myLabel",
    );
  });

  it("extracts label from an object without description", () => {
    expect(getCompletionLabel({ label: "onlyLabel" })).toBe("onlyLabel");
  });
});

describe("escapeRegex", () => {
  it("escapes special regex characters", () => {
    expect(escapeRegex("hello.world")).toBe("hello\\.world");
    expect(escapeRegex("a+b*c?d")).toBe("a\\+b\\*c\\?d");
    expect(escapeRegex("foo[bar]")).toBe("foo\\[bar\\]");
    expect(escapeRegex("a^b$c")).toBe("a\\^b\\$c");
    expect(escapeRegex("a{b}c")).toBe("a\\{b\\}c");
    expect(escapeRegex("a|b")).toBe("a\\|b");
    expect(escapeRegex("a(b)c")).toBe("a\\(b\\)c");
    expect(escapeRegex("a\\b")).toBe("a\\\\b");
  });

  it("leaves plain strings unchanged", () => {
    expect(escapeRegex("hello")).toBe("hello");
    expect(escapeRegex("Serial")).toBe("Serial");
  });
});
