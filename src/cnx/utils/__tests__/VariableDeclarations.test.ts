import { describe, expect, it } from "vitest";
import CnxSourceParser from "../../PARSE/2-Parse/CnxSourceParser";
import VariableDeclarations from "../VariableDeclarations";

const SOURCE = [
  "u8 g <- 1;",
  "scope S {",
  "    u8 m <- 2;",
  "    void go() {",
  "        u8 inMethod <- 3;",
  "    }",
  "}",
  "void f() {",
  "    u8 a <- 4;",
  "    for (mut u8 i <- 0; i < 2; i +<- 1) {",
  "        u8 inLoop <- 5;",
  "    }",
  "    if (a = 4) {",
  "        u8 nested <- 6;",
  "    }",
  "}",
].join("\n");

const sites = (
  pick: typeof VariableDeclarations.in,
): ReadonlyArray<readonly [string, string]> =>
  pick(CnxSourceParser.parse(SOURCE).program).map(
    (entry) => [entry.declaration.name, entry.site] as const,
  );

describe("VariableDeclarations (#2073)", () => {
  it("lists every variable declaration in source order, with where it is written", () => {
    expect(sites(VariableDeclarations.in)).toEqual([
      ["g", "file"],
      ["m", "scopeMember"],
      ["inMethod", "statement"],
      ["a", "statement"],
      ["i", "forHeader"],
      ["inLoop", "statement"],
      ["nested", "statement"],
    ]);
  });

  it("rules on every declaration but a for header's, which is E0917's", () => {
    expect(sites(VariableDeclarations.ruled)).toEqual([
      ["g", "file"],
      ["m", "scopeMember"],
      ["inMethod", "statement"],
      ["a", "statement"],
      ["inLoop", "statement"],
      ["nested", "statement"],
    ]);
    expect(sites(VariableDeclarations.forHeaders)).toEqual([
      ["i", "forHeader"],
    ]);
  });
});
