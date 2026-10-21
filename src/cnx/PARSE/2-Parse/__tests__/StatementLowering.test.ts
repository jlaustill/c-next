import { describe, expect, it } from "vitest";
import CnxSourceParser from "../CnxSourceParser";
import StatementLowering from "../StatementLowering";
import type TStatement from "../../../types/syntax/TStatement";

function bodyOf(statements: string): readonly TStatement[] {
  const tree = CnxSourceParser.parse(`void f() {\n${statements}\n}\n`).tree;
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
    const decl = only("atomic clamp u8 buf[4][] <- [1, 2];");
    expect(decl).toMatchObject({
      kind: "variableDeclaration",
      modifiers: {
        atomic: true,
        volatile: false,
        const: false,
        // #2233: `atomic` implies `mut`
        mut: true,
        atomicMut: false,
        overflow: "clamp",
      },
      name: "buf",
      type: { kind: "primitive", name: "u8" },
      initializer: { kind: "arrayInitializer" },
    });
    if (decl.kind !== "variableDeclaration") throw new Error("kind");
    expect(decl.dimensions.map((d) => d?.written ?? null)).toEqual(["4", null]);
    expect(decl.nameSpan.column).toBe(
      decl.span.column + "atomic clamp u8 ".length,
    );
  });

  it("records `mut` beside `atomic` only so it can be rejected (#2233)", () => {
    expect(only("atomic mut u8 a <- 0;")).toMatchObject({
      modifiers: { atomic: true, mut: true, atomicMut: true },
    });
    expect(only("mut u8 b <- 0;")).toMatchObject({
      modifiers: { atomic: false, mut: true, atomicMut: false },
    });
    expect(only("u8 c <- 0;")).toMatchObject({
      modifiers: { atomic: false, mut: false, atomicMut: false },
    });
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
      "switch (x) { case EState.IDLE || OTHER || this.MINE || global.FAR || -5 || -0x80 || 0b1 || 'c' { } default(3) { } }",
    );
    if (sw.kind !== "switch") throw new Error("kind");
    expect(sw.cases[0].labels).toMatchObject([
      { kind: "qualified", path: ["EState", "IDLE"] },
      { kind: "identifier", root: null, name: "OTHER" },
      { kind: "identifier", root: "this", name: "MINE" },
      { kind: "identifier", root: "global", name: "FAR" },
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

// #1643 (ADR-030): whether a declaration spells its own name past its
// declarator is how it is WRITTEN, so 1.2 answers it from the tokens.
describe("spellsOwnName", () => {
  const spells = (statement: string): boolean => {
    const lowered = only(statement);
    if (
      lowered.kind !== "variableDeclaration" &&
      lowered.kind !== "constructorDeclaration"
    ) {
      throw new Error(`not a declaration: ${statement}`);
    }
    return lowered.spellsOwnName;
  };

  it("is true for a bare spelling in the initializer or the arguments", () => {
    expect(spells("u32 x <- x + 1;")).toBe(true);
    expect(spells("Widget w(w);")).toBe(true);
  });

  it("is false after a `.`, for a field key, and for another name", () => {
    expect(spells("u32 x <- this.x;")).toBe(false);
    expect(spells("u32 x <- global.x;")).toBe(false);
    expect(spells("P x <- { x: 1 };")).toBe(false);
    expect(spells("u32 x <- y;")).toBe(false);
    expect(spells("Widget w(v);")).toBe(false);
  });
});
