import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../PARSE/2-Parse/CNextSourceParser";
import DeclarationParts from "../DeclarationParts";
import ExpressionNodes from "../ExpressionNodes";

/** The identifiers ExpressionNodes reaches in the file's first declaration */
const names = (source: string): string[] => {
  const parsed = CNextSourceParser.parse(source);
  expect(parsed.parseErrors).toEqual([]);
  return DeclarationParts.of(parsed.program.declarations[0].declaration)
    .flatMap(ExpressionNodes.of)
    .flatMap((e) => (e.kind === "identifier" ? [e.name] : []));
};

describe("ExpressionNodes", () => {
  it("reaches nested operands and call arguments", () => {
    expect(names("u32 n <- a + f(b);\n").sort()).toEqual(["a", "b", "f"]);
  });

  it("reaches a dimension inside a sizeof's type", () => {
    expect(names("u32 n <- sizeof(u8[a]);\n")).toEqual(["a"]);
  });

  it("reaches a dimension inside a cast's type", () => {
    expect(names("u32 n <- (u8[a]) b;\n").sort()).toEqual(["a", "b"]);
  });

  it("reaches a dimension of a declared type", () => {
    expect(names("u8[a] buffer;\n")).toEqual(["a"]);
  });
});
