/**
 * #1668 (C7): `DeclaredTypeInfo` -- a binding's declared type, in the shape
 * 2.2 and render read -- asserted on real declared and resolved programs.
 */
import { describe, expect, it } from "vitest";
import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../../PARSE/2-Parse/grammar/CNextParser";
import SymbolTable from "../../../PARSE/3-Declare/SymbolTable";
import DeclaredTypeInfo from "../DeclaredTypeInfo";
import OperandTyper from "../../../utils/OperandTyper";
import testAnalysisContextFor from "../../1-Analyze/__tests__/testAnalysisContextFor";

/** `name`'s declared type where `r` is declared in `source` */
function declaredAtR(source: string, name: string, root: "this" | null = null) {
  const { tree, context } = testAnalysisContextFor(source);
  let at: { line: number; column: number } | null = null;
  ParseTreeWalker.DEFAULT.walk(
    new (class extends CNextListener {
      override enterVariableDeclaration = (
        ctx: Parser.VariableDeclarationContext,
      ): void => {
        if (ctx.IDENTIFIER().getText() === "r") {
          at = { line: ctx.start!.line, column: ctx.start!.column };
        }
      };
    })(),
    tree,
  );
  expect(at).not.toBeNull();
  const binding = context.program.bindValue("test.cnx", root, name, at!);
  return DeclaredTypeInfo.of(binding, context.symbols, new SymbolTable());
}

/** The target of the first assignment in `source` */
function targetOf(source: string) {
  const { tree, context } = testAnalysisContextFor(source);
  let target: Parser.AssignmentTargetContext | null = null;
  ParseTreeWalker.DEFAULT.walk(
    new (class extends CNextListener {
      override enterAssignmentTarget = (
        ctx: Parser.AssignmentTargetContext,
      ): void => {
        target ??= ctx;
      };
    })(),
    tree,
  );
  expect(target).not.toBeNull();
  return DeclaredTypeInfo.ofChain(
    OperandTyper.chainOf(target!, context),
    context.symbols,
    new SymbolTable(),
  );
}

describe("DeclaredTypeInfo.of", () => {
  it("gives a string its C buffer, one wider than its capacity", () => {
    expect(
      declaredAtR("void f() {\nstring<8> s;\nu8 r <- 1;\n}", "s"),
    ).toMatchObject({
      baseType: "char",
      bitWidth: 8,
      isArray: true,
      arrayDimensions: [9],
      isString: true,
      stringCapacity: 8,
    });
  });

  it("gives a global the same shape as a local", () => {
    // A string global read as a C buffer in its own file and as a scalar in
    // the next; one projection now answers both
    expect(
      declaredAtR("string<8>[3] g;\nvoid f() {\nu8 r <- 1;\n}", "g"),
    ).toMatchObject({ isArray: true, arrayDimensions: [3, 9], isString: true });
  });

  it("carries an array's dimensions and ADR-044 behavior", () => {
    expect(
      declaredAtR("void f() {\nwrap u16[4] a;\nu8 r <- 1;\n}", "a"),
    ).toMatchObject({
      baseType: "u16",
      bitWidth: 16,
      isArray: true,
      arrayDimensions: [4],
      overflowBehavior: "wrap",
    });
  });

  it("gives a scalar string parameter the base type `string`", () => {
    expect(
      declaredAtR("void f(string<8> p) {\nu8 r <- 1;\n}", "p"),
    ).toMatchObject({
      baseType: "string",
      isArray: false,
      isString: true,
      stringCapacity: 8,
      isParameter: true,
    });
  });

  it("keeps main's C-style args as an unresolved-dimension array", () => {
    expect(
      declaredAtR(
        "u32 main(string args[]) {\nu8 r <- 1;\nreturn 0;\n}",
        "args",
      ),
    ).toMatchObject({
      baseType: "string",
      isArray: true,
      arrayDimensions: [0],
    });
  });

  it("has none yet for a `for` variable (#1667, transitional)", () => {
    expect(
      declaredAtR(
        "void f() {\nfor (u8 i <- 0; i < 3; i +<- 1) {\nu8 r <- i;\n}\n}",
        "i",
      ),
    ).toBeUndefined();
  });

  it("reads the member a `this.` root names", () => {
    expect(
      declaredAtR(
        "scope S {\nu16 m <- 1;\npublic void f() {\nu8 r <- 1;\n}\n}",
        "m",
        "this",
      ),
    ).toMatchObject({ baseType: "u16" });
  });
});

describe("DeclaredTypeInfo.ofChain", () => {
  it("binds a bare target's root and writes it", () => {
    const t = targetOf("void f() {\nu16 x <- 0;\nx <- 1;\n}");
    expect(t.root?.kind).toBe("local");
    expect(t.typeInfo).toMatchObject({ baseType: "u16" });
    expect(t.rootTypeInfo).toBe(t.typeInfo);
  });

  it("binds `this.x` to the member, not a same-named local", () => {
    const t = targetOf(
      "scope S {\nu16 x <- 0;\npublic void f() {\nu8 x <- 0;\nthis.x <- 1;\n}\n}",
    );
    expect(t.root?.kind).toBe("variable");
    expect(t.typeInfo).toMatchObject({ baseType: "u16" });
  });

  it("binds `global.x` past a shadowing local (#1701)", () => {
    const t = targetOf(
      "u32 x <- 0;\nvoid f() {\nu8 x <- 0;\nglobal.x <- 1;\n}",
    );
    expect(t.typeInfo).toMatchObject({ baseType: "u32" });
  });

  it("writes the member of a `Scope.member` target, whose root has no type", () => {
    const t = targetOf(
      "scope S {\npublic u16 m <- 0;\n}\nvoid f() {\nS.m <- 1;\n}",
    );
    expect(t.root?.kind).toBe("scope");
    expect(t.rootTypeInfo).toBeUndefined();
    expect(t.typeInfo).toMatchObject({ baseType: "u16" });
  });
});
