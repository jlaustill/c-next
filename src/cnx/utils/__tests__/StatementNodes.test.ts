import { describe, expect, it } from "vitest";
import CNextSourceParser from "../../PARSE/2-Parse/CNextSourceParser";
import StatementNodes from "../StatementNodes";

const kinds = (source: string): string[] =>
  CNextSourceParser.parse(source).program.declarations.flatMap((member) =>
    StatementNodes.in(member.declaration).map((s) => s.kind),
  );

describe("StatementNodes", () => {
  it("reaches nested statements in source order", () => {
    expect(
      kinds(
        `void f() { u8 a <- 1; if (a = 1) { a <- 2; } while (a < 3) { a +<- 1; } }`,
      ),
    ).toEqual([
      "variableDeclaration",
      "if",
      "block",
      "assignment",
      "while",
      "block",
      "assignment",
    ]);
  });

  it("includes a for loop's init", () => {
    expect(kinds(`void f() { for (u8 i <- 0; i < 3; i +<- 1) { } }`)).toEqual([
      "for",
      "variableDeclaration",
      "block",
    ]);
  });

  it("reaches functions inside a scope, and nothing outside a body", () => {
    expect(
      kinds(`u8 g <- 1; scope S { u8 m <- 2; public void f() { g <- 3; } }`),
    ).toEqual(["assignment"]);
  });
});
