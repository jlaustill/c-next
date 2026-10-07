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
import TargetCatalogFile from "../../../cli/TargetCatalogFile";
import CResolver from "../../../PARSE/3-Declare/c/index";
import OperandTyper from "../../../utils/OperandTyper";
import testAnalysisContextFor from "../../1-Analyze/__tests__/testAnalysisContextFor";
import NodeFileSystem from "../../../PARSE/1-Discover/NodeFileSystem";

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
  return DeclaredTypeInfo.of(binding, context.symbols, new SymbolTable(), null);
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
    null,
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
    return DeclaredTypeInfo.of(binding, context.symbols, table, null);
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

  // #1760 review: the foreign arm asked a bare-name C-Next lookup first, so a
  // scope member of the same name answered for the header's variable
  it("types a header global by the header, not a same-named scope member", () => {
    const table = new SymbolTable();
    const tree = HeaderParser.parseC("extern double level;").tree;
    table.addCSymbols(CResolver.resolve(tree!, "api.h", table).symbols);
    const { context } = testAnalysisContextFor(
      "scope Tank {\nu8 level <- 1;\n}\nvoid f() {\nu8 r <- 1;\n}",
      { symbolTable: table },
    );
    const binding = context.program.bindValue("test.cnx", null, "level", {
      line: 5,
      column: 0,
    });
    expect(binding?.kind).toBe("foreign");
    expect(
      DeclaredTypeInfo.of(binding, context.symbols, table, null),
    ).toMatchObject({ baseType: "f64" });
  });

  // #1760 review: a header `double` is typed by the target's data model, the
  // operand typer's answer, where this read the spelling and said f64
  it("types a header double by the target's data model", () => {
    const table = new SymbolTable();
    const tree = HeaderParser.parseC("extern double level;").tree;
    table.addCSymbols(CResolver.resolve(tree!, "api.h", table).symbols);
    const { context } = testAnalysisContextFor("void f() {\nu8 r <- 1;\n}", {
      symbolTable: table,
    });
    const binding = context.program.bindValue("test.cnx", null, "level", {
      line: 2,
      column: 0,
    });
    const avr = TargetCatalogFile.targets(NodeFileSystem.instance).get(
      "atmega328p",
    )!;
    expect(
      DeclaredTypeInfo.of(binding, context.symbols, table, avr),
    ).toMatchObject({ baseType: "f32" });
    const host = TargetCatalogFile.targets(NodeFileSystem.instance).get(
      "host",
    )!;
    expect(
      DeclaredTypeInfo.of(binding, context.symbols, table, host),
    ).toMatchObject({ baseType: "f64" });
  });

  it("gives a primitive C global no type info", () => {
    expect(foreignAt("n")).toBeUndefined();
  });
});

describe("DeclaredTypeInfo.of, handles and pointer depth (#1435's review)", () => {
  // Carried over from the registry tests main added, which this branch
  // deleted with the registry: the binding is their owner here.
  const header = `typedef struct { int v; } cfg_t;
typedef struct Dev Dev;
extern cfg_t **cfgTable;
extern Dev cDevice;`;
  function typeAt(name: string) {
    const table = new SymbolTable();
    const tree = HeaderParser.parseC(header).tree;
    table.addCSymbols(CResolver.resolve(tree!, "api.h", table).symbols);
    const { context } = testAnalysisContextFor(
      "Dev shared;\nvoid f() {\nu8 r <- 1;\n}",
      { symbolTable: table },
    );
    const binding = context.program.bindValue("test.cnx", null, name, {
      line: 3,
      column: 0,
    });
    return DeclaredTypeInfo.of(binding, context.symbols, table, null);
  }

  it("gives no answer for a C pointer to a pointer, which it cannot describe", () => {
    // `{ baseType, isPointer }` says "one pointer to the struct". Stripping
    // every `*` let `cfg_t**` claim that, and a call site took its address
    // for a `cfg_t**` parameter. Its reader asks the declared C type.
    expect(typeAt("cfgTable")).toBeUndefined();
  });

  it("holds a C-Next variable of a handle type through a pointer (ADR-030)", () => {
    expect(typeAt("shared")).toMatchObject({
      baseType: "Dev",
      isPointer: true,
    });
  });

  it("leaves a C header's global of the handle type as C declared it", () => {
    // C declared it, not C-Next, so it keeps its own type and still takes `&`
    expect(typeAt("cDevice")).toMatchObject({
      baseType: "Dev",
      isPointer: false,
    });
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

  it("never reads a dimension's text for a number (#1760 review)", () => {
    // parseInt read `2*BUF` as 2, which bounds-checked against a size the
    // array does not have
    expect(
      declaredAtR("void f() {\nu8[2*BUF][3] g;\nu8 r <- 1;\n}", "g"),
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
