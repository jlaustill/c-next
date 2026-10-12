import { describe, expect, it } from "vitest";
import parse from "../../__tests__/testHelpers";
import ProgramLowering from "../../../../2-Parse/ProgramLowering";
import DeclarationSyntax from "../DeclarationSyntax";

describe("DeclarationSyntax (#1991)", () => {
  const first = (code: string) =>
    ProgramLowering.program(parse(code), null).declarations[0].declaration;

  it("hands 1.3 the declaration 1.2 lowered, with its members", () => {
    const syntax = DeclarationSyntax.of(first("enum E { A <- 2, B }"), "enum");
    expect(syntax.name).toBe("E");
    expect(syntax.members.map((member) => member.name)).toEqual(["A", "B"]);
    expect(syntax.members[1].value).toBeNull();
  });

  it("fails when 1.3 reads a declaration as a kind 1.2 did not lower", () => {
    expect(() =>
      DeclarationSyntax.of(first("bitmap8 B { a, b[7] }"), "enum"),
    ).toThrow(
      "1.2 lowered this declaration as bitmap, and 1.3 read it as enum",
    );
  });
});
