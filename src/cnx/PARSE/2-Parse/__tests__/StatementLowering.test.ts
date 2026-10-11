import { describe, expect, it } from "vitest";
import CNextSourceParser from "../CNextSourceParser";
import StatementLowering from "../StatementLowering";
import type TStatement from "../../../types/syntax/TStatement";

function bodyOf(statements: string): readonly TStatement[] {
  const tree = CNextSourceParser.parse(`void f() {\n${statements}\n}\n`).tree;
  const block = tree.declaration()[0].functionDeclaration()?.block();
  if (!block) throw new Error(`no body in: ${statements}`);
  return StatementLowering.block(block).statements;
}

function only(statement: string): TStatement {
  const [lowered] = bodyOf(statement);
  return lowered;
}

describe("StatementLowering", () => {
  it("lowers every statement alternative to its own kind", () => {
    const kinds = bodyOf(`
      u32 x <- 1;
      Widget w(x);
      x <- 2;
      g();
      if (x = 1) { } else { }
      while (x < 3) { }
      do { } while (x < 3);
      for (u32 i <- 0; i < 3; i +<- 1) { }
      forever { }
      switch (x) { case 1 { } default { } }
      critical { }
      { }
      return;
    `).map((s) => s.kind);
    expect(kinds).toEqual([
      "variableDeclaration",
      "constructorDeclaration",
      "assignment",
      "expression",
      "if",
      "while",
      "doWhile",
      "for",
      "forever",
      "switch",
      "critical",
      "block",
      "return",
    ]);
  });

  it("records a declaration's modifiers, name, dimensions and initializer", () => {
    const decl = only("atomic const clamp u8 buf[4][] <- [1, 2];");
    expect(decl).toMatchObject({
      kind: "variableDeclaration",
      modifiers: {
        atomic: true,
        volatile: false,
        const: true,
        overflow: "clamp",
      },
      name: "buf",
      type: { kind: "primitive", name: "u8" },
      initializer: { kind: "arrayInitializer" },
    });
    if (decl.kind !== "variableDeclaration") throw new Error("kind");
    expect(decl.dimensions.map((d) => d?.written ?? null)).toEqual(["4", null]);
    expect(decl.nameSpan.column).toBe(
      decl.span.column + "atomic const clamp u8 ".length,
    );
  });

  it("records an assignment's lowered target, operator and value", () => {
    expect(only("p.x[i] +<- a - -1;")).toMatchObject({
      kind: "assignment",
      operator: "+<-",
      target: { kind: "postfix", written: "p.x[i]" },
      value: { kind: "binary", written: "a - -1" },
    });
  });

  it("keeps an if's else and a for header's three parts", () => {
    expect(only("if (a) b(); else c();")).toMatchObject({
      whenTrue: { kind: "expression", written: "b();" },
      whenFalse: { kind: "expression", written: "c();" },
    });
    expect(only("if (a) b();")).toMatchObject({ whenFalse: null });
    expect(only("for (i <- 0; i < 3; i +<- 1) { }")).toMatchObject({
      init: { kind: "assignment", operator: "<-" },
      condition: { written: "i < 3" },
      update: { operator: "+<-" },
    });
    expect(only("for (;;) { }")).toMatchObject({
      init: null,
      condition: null,
      update: null,
    });
  });

  it("records each case label as written, and a default's count", () => {
    const sw = only(
      "switch (x) { case EState.IDLE || OTHER || -5 || -0x80 || 0b1 || 'c' { } default(3) { } }",
    );
    if (sw.kind !== "switch") throw new Error("kind");
    expect(sw.cases[0].labels).toMatchObject([
      { kind: "qualified", path: ["EState", "IDLE"] },
      { kind: "identifier", name: "OTHER" },
      { kind: "integer", text: "5", negative: true },
      { kind: "hex", text: "0x80", negative: true },
      { kind: "binary", text: "0b1" },
      { kind: "char", text: "'c'" },
    ]);
    expect(sw.defaultCase?.count).toBe("3");
  });

  it("returns a value or nothing", () => {
    expect(only("return a + 1;")).toMatchObject({
      value: { kind: "binary", written: "a + 1" },
    });
    expect(only("return;")).toMatchObject({ value: null });
  });
});
