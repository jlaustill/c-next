import { describe, expect, it } from "vitest";
import CNextSourceParser from "../CNextSourceParser";
import CommentScanner from "../CommentScanner";
import ProgramLowering from "../ProgramLowering";
import type IProgramSyntax from "../../../types/syntax/IProgramSyntax";

function lower(source: string): IProgramSyntax {
  const parsed = CNextSourceParser.parse(source);
  return ProgramLowering.program(
    parsed.tree,
    new CommentScanner(parsed.tokenStream),
  );
}

describe("ProgramLowering", () => {
  it("lowers every declaration alternative to its own kind, in source order", () => {
    const program = lower(`
      scope Motor { public void run() { } u8 speed; }
      register GPIO @ 0x40000000 { DR: u32 rw @ 0x04, }
      struct Point { i32 x; u8 tags[4]; }
      enum Color { RED, GREEN }
      bitmap8 Flags { a, b[7] }
      u32 add(const u32 a, u8 buf[]) { return a; }
      u32 total <- 0;
      Widget w(total);
    `);
    expect(program.declarations.map((d) => d.declaration.kind)).toEqual([
      "scope",
      "register",
      "struct",
      "enum",
      "bitmap",
      "function",
      "variableDeclaration",
      "constructorDeclaration",
    ]);
  });

  it("is plain data: it survives a JSON round trip unchanged", () => {
    const program = lower(`
      #include <stdint.h>
      #define DEBUG
      scope Motor { public void run() { if (true) { u8 n <- 1; } } u8 speed; }
      register GPIO @ 0x40000000 { DR: u32 rw @ 0x04, }
      struct Point { i32 x; u8 tags[4]; }
      enum Color { RED, GREEN }
      bitmap8 Flags { a, b[7] }
      u32 add(const u32 a, u8 buf[]) { while (a > 0) { { return a; } } return 0; }
      u32 total <- 0;
      Widget w(total);
    `);
    expect(program.includes).toHaveLength(1);
    expect(program.directives).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(program))).toEqual(program);
  });

  it("records a scope member's written visibility, or null when unwritten", () => {
    const [{ declaration }] = lower(
      "scope Motor { public void run() { } u8 speed; private u8 gear; }",
    ).declarations;
    expect(declaration).toMatchObject({
      kind: "scope",
      name: "Motor",
      members: [
        {
          visibility: "public",
          declaration: { kind: "function", name: "run" },
        },
        {
          visibility: null,
          declaration: { kind: "variableDeclaration", name: "speed" },
        },
        {
          visibility: "private",
          declaration: { kind: "variableDeclaration", name: "gear" },
        },
      ],
    });
  });

  it("records a function's return type, parameters and body", () => {
    const [{ declaration }] = lower(
      "u32 add(const u32 a, u8 buf[]) { return a; }",
    ).declarations;
    expect(declaration).toMatchObject({
      kind: "function",
      name: "add",
      returnType: { kind: "primitive", name: "u32" },
      parameters: [
        { const: true, name: "a", dimensions: [] },
        { const: false, name: "buf", dimensions: [null] },
      ],
      body: { statements: [{ kind: "return" }] },
    });
  });

  it("has no parameter list for a function written with ()", () => {
    const [{ declaration }] = lower("void f() { }").declarations;
    expect(declaration).toMatchObject({ kind: "function", parameters: null });
  });

  it("records a register's address and each member's type, access and offset", () => {
    const [{ declaration }] = lower(
      "register GPIO @ 0x40000000 { DR: u32 rw @ 0x04, SR: u8 ro @ 0x08 }",
    ).declarations;
    expect(declaration).toMatchObject({
      kind: "register",
      name: "GPIO",
      address: { written: "0x40000000" },
      members: [
        { name: "DR", access: "rw", offset: { written: "0x04" } },
        { name: "SR", access: "ro", offset: { written: "0x08" } },
      ],
    });
  });

  it("records a struct's fields with their dimensions", () => {
    const [{ declaration }] = lower(
      "struct Point { i32 x; u8 tags[4]; }",
    ).declarations;
    expect(declaration).toMatchObject({
      kind: "struct",
      name: "Point",
      fields: [
        { name: "x", dimensions: [] },
        { name: "tags", dimensions: [{ written: "4" }] },
      ],
    });
  });

  it("keeps includes, directives and the comments written above each", () => {
    const program = lower(
      [
        "// the header",
        "#include <stdint.h>",
        "#define PLATFORM",
        "/* the counter */",
        "u32 count <- 0;",
      ].join("\n"),
    );
    expect(program.includes).toMatchObject([
      {
        written: "#include <stdint.h>",
        leadingComments: [{ content: " the header" }],
      },
    ]);
    expect(program.directives).toMatchObject([
      { kind: "define-flag", text: "#define PLATFORM", leadingComments: [] },
    ]);
    expect(program.declarations[0].leadingComments).toMatchObject([
      { content: " the counter " },
    ]);
  });

  it("reads no comments when there is no token stream", () => {
    const parsed = CNextSourceParser.parse("// note\nu32 count <- 0;\n");
    const program = ProgramLowering.program(parsed.tree, null);
    expect(program.declarations[0].leadingComments).toEqual([]);
  });
});
