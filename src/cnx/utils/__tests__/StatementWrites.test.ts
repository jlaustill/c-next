import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CnxLexer } from "../../PARSE/2-Parse/grammar/CnxLexer";
import { CnxParser } from "../../PARSE/2-Parse/grammar/CnxParser";
import ProgramLowering from "../../PARSE/2-Parse/ProgramLowering";
import ExpressionShape from "../ExpressionShape";
import StatementWrites from "../StatementWrites";

function writtenNamesOf(statementSource: string): (string | undefined)[] {
  const source = `void f(u32 x, u32 y) { ${statementSource} }`;
  const lexer = new CnxLexer(CharStream.fromString(source));
  const parser = new CnxParser(new CommonTokenStream(lexer));
  const program = ProgramLowering.program(parser.program(), null);
  const declaration = program.declarations[0].declaration;
  if (declaration.kind !== "function") throw new Error("expected a function");
  const [statement] = declaration.body.statements;
  return StatementWrites.of(statement).map(
    (write) => ExpressionShape.headOf(write.target).identifier?.name,
  );
}

describe("StatementWrites (#2010)", () => {
  it("assignment: its own target", () => {
    expect(writtenNamesOf("x <- 1;")).toEqual(["x"]);
  });

  it("for: the header's init and update, in source order", () => {
    expect(writtenNamesOf("for (x <- 0; x < 3; y +<- 1) { }")).toEqual([
      "x",
      "y",
    ]);
  });

  it("for with a declared init: only the update", () => {
    expect(writtenNamesOf("for (u32 i <- 0; i < 3; i +<- 1) { }")).toEqual([
      "i",
    ]);
  });

  it("not the writes nested inside a statement", () => {
    expect(writtenNamesOf("if (x > 0) { x <- 1; }")).toEqual([]);
    expect(
      writtenNamesOf("for (u32 i <- 0; i < 3; i +<- 1) { x <- 1; }"),
    ).toEqual(["i"]);
  });

  it("a declaration or an expression writes nothing", () => {
    expect(writtenNamesOf("u32 z <- 1;")).toEqual([]);
    expect(writtenNamesOf("f(x, y);")).toEqual([]);
  });
});
