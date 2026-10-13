import { describe, it, expect } from "vitest";
import { CharStream } from "antlr4ng";
import SourceSpelling from "../SourceSpelling";

function spell(text: string): string {
  return SourceSpelling.of(CharStream.fromString(text), 0, text.length - 1);
}

describe("SourceSpelling", () => {
  it("returns a slice with no gap to change as it is", () => {
    expect(spell("i < getLimit()")).toBe("i < getLimit()");
  });

  it("reads a block comment as one space", () => {
    expect(spell("(0x40000000 /* GPIO block */)")).toBe("(0x40000000 )");
    expect(spell("-/* negative */1")).toBe("- 1");
  });

  it("reads a line comment and its line break as one space", () => {
    expect(spell("(0x40000000 // GPIO block\n        + 0x100)")).toBe(
      "(0x40000000 + 0x100)",
    );
  });

  it("collapses a run of spaces and line breaks", () => {
    expect(spell("i < limit &&\n        i > 0")).toBe("i < limit && i > 0");
  });

  it("keeps tokens the source kept apart apart", () => {
    expect(spell("1 - -1")).toBe("1 - -1");
  });

  it("keeps a comment's text inside a string literal", () => {
    expect(spell('"a // b"')).toBe('"a // b"');
  });
});
