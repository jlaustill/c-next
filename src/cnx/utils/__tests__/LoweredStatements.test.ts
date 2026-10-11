import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../PARSE/2-Parse/grammar/CNextLexer";
import { CNextParser } from "../../PARSE/2-Parse/grammar/CNextParser";
import ProgramLowering from "../../PARSE/2-Parse/ProgramLowering";
import LoweredStatements from "../LoweredStatements";

function lowered(source: string): LoweredStatements {
  const lexer = new CNextLexer(CharStream.fromString(source));
  const parser = new CNextParser(new CommonTokenStream(lexer));
  return new LoweredStatements(ProgramLowering.program(parser.program(), null));
}

describe("LoweredStatements (#2003)", () => {
  const source = [
    "scope S {",
    "    public void f(u32 x) {",
    "        critical {",
    "            if (x > 0) { x <- 1; } else { x <- 2; }",
    "        }",
    "        while (x > 0) { x -<- 1; }",
    "    }",
    "}",
  ].join("\n");

  it("finds a statement nested anywhere in a scope's function by its start", () => {
    const ifStatement = lowered(source).at("if", { line: 4, column: 12 });
    expect(ifStatement.whenFalse?.kind).toBe("block");
  });

  it("tells which statement is a loop's body", () => {
    const loop = lowered(source).at("while", { line: 6, column: 8 });
    expect(LoweredStatements.startsAt(loop.body, { line: 6, column: 22 })).toBe(
      true,
    );
    expect(LoweredStatements.startsAt(loop.body, { line: 6, column: 8 })).toBe(
      false,
    );
  });

  it("a kind that does not start there is an internal error", () => {
    expect(() => lowered(source).at("for", { line: 6, column: 8 })).toThrow(
      /lowered no for statement at 6:8/,
    );
  });
});
