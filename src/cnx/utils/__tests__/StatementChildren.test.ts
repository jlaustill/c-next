import { describe, it, expect } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CnxLexer } from "../../PARSE/2-Parse/grammar/CnxLexer";
import { CnxParser } from "../../PARSE/2-Parse/grammar/CnxParser";
import ProgramLowering from "../../PARSE/2-Parse/ProgramLowering";
import StatementChildren from "../StatementChildren";
import type TStatement from "../../types/syntax/TStatement";

function bodyOf(source: string): readonly TStatement[] {
  const lexer = new CnxLexer(CharStream.fromString(source));
  const parser = new CnxParser(new CommonTokenStream(lexer));
  const program = ProgramLowering.program(parser.program(), null);
  const declaration = program.declarations[0].declaration;
  if (declaration.kind !== "function") throw new Error("expected a function");
  return declaration.body.statements;
}

function childKindsOf(statementSource: string): string[] {
  const [statement] = bodyOf(`void f(u32 x) { ${statementSource} }`);
  return StatementChildren.of(statement).map((child) => child.kind);
}

describe("StatementChildren (#2003)", () => {
  it("if: both branches", () => {
    expect(childKindsOf("if (x > 0) { x <- 1; } else { x <- 2; }")).toEqual([
      "block",
      "block",
    ]);
  });

  it("if without else: the one branch", () => {
    expect(childKindsOf("if (x > 0) { x <- 1; }")).toEqual(["block"]);
  });

  it("while: its body", () => {
    expect(childKindsOf("while (x > 0) { x <- 1; }")).toEqual(["block"]);
  });

  it("for: its body, not its init or update", () => {
    expect(
      childKindsOf("for (u32 i <- 0; i < 3; i +<- 1) { x <- 1; }"),
    ).toEqual(["block"]);
  });

  it("do-while: its body's statements", () => {
    expect(childKindsOf("do { x <- 1; } while (x > 0);")).toEqual([
      "assignment",
    ]);
  });

  it("forever: its body's statements", () => {
    expect(childKindsOf("forever { x <- 1; }")).toEqual(["assignment"]);
  });

  it("critical: its body's statements", () => {
    expect(childKindsOf("critical { x <- 1; }")).toEqual(["assignment"]);
  });

  it("switch: every case's statements, then the default's", () => {
    expect(
      childKindsOf(
        "switch (x) { case 1 { x <- 1; } case 2 { u32 y <- 2; } default { return; } }",
      ),
    ).toEqual(["assignment", "variableDeclaration", "return"]);
  });

  it("block: its statements", () => {
    expect(childKindsOf("{ x <- 1; }")).toEqual(["assignment"]);
  });

  it("a statement with no nested statements has no children", () => {
    expect(childKindsOf("x <- 1;")).toEqual([]);
    expect(childKindsOf("return;")).toEqual([]);
  });
});
