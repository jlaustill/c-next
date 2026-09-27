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
import HeaderParser from "../../../PARSE/2-Parse/HeaderParser";
import CResolver from "../../../PARSE/3-Declare/c/index";
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
    });
  });

  it("gives a parameter its ADR-044 behavior, which clamps (#1681)", () => {
    // A compound assignment to a parameter reads its target's behavior, and
    // with none it was plain C arithmetic
    expect(declaredAtR("void f(u8 p) {\nu8 r <- 1;\n}", "p")).toMatchObject({
      baseType: "u8",
      overflowBehavior: "clamp",
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

  it("types a `for` variable by its declaration (#1667)", () => {
    expect(
      declaredAtR(
        "void f() {\nfor (u8 i <- 0; i < 3; i +<- 1) {\nu8 r <- i;\n}\n}",
        "i",
      ),
    ).toMatchObject({ baseType: "u8", overflowBehavior: "clamp" });
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

describe("DeclaredTypeInfo.of, a C header's variables", () => {
  // #1668: these were asserted through the registry accessor's cross-file
  // fallback, which is deleted; the binding's foreign arm is their owner
  const header = `typedef struct { int v; } cfg_t;
extern cfg_t cfg;
extern cfg_t *cfgPointer;
extern int n;
#define BUF_SIZE 4`;
  function foreignAt(name: string) {
    const table = new SymbolTable();
    const tree = HeaderParser.parseC(header).tree;
    table.addCSymbols(CResolver.resolve(tree!, "api.h", table).symbols);
    const { context } = testAnalysisContextFor("void f() {\nu8 r <- 1;\n}", {
      symbolTable: table,
    });
    const binding = context.program.bindValue("test.cnx", null, name, {
      line: 2,
      column: 0,
    });
    return DeclaredTypeInfo.of(binding, context.symbols, table);
  }

  it("types a struct global as its struct (#978)", () => {
    expect(foreignAt("cfg")).toMatchObject({ baseType: "cfg_t" });
  });

  it("types a struct pointer global as a pointer (#978)", () => {
    expect(foreignAt("cfgPointer")).toMatchObject({
      baseType: "cfg_t",
      isPointer: true,
    });
  });

  it("gives a primitive C global no type info", () => {
    expect(foreignAt("n")).toBeUndefined();
  });
});

describe("DeclaredTypeInfo.of, dimensions", () => {
  it("keeps the slot of a dimension it cannot fold (#1360)", () => {
    // Dropping the slot shifted every dimension after it, so dimension 2's
    // bound was applied to dimension 1
    expect(
      declaredAtR("void f() {\nu8[UNKNOWN][3] g;\nu8 r <- 1;\n}", "g"),
    ).toMatchObject({ arrayDimensions: [0, 3] });
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
