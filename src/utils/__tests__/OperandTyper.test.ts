/**
 * #1668: the one operand typer, a row per shape (design §3), through real
 * declared and resolved programs.
 */
import { describe, it, expect } from "vitest";
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import OperandTyper from "../OperandTyper";
import QualifiedCName from "../QualifiedCName";
import HeaderParser from "../../PARSE/2-Parse/HeaderParser";
import CResolver from "../../PARSE/3-Declare/c/index";
import CppResolver from "../../PARSE/3-Declare/cpp/index";
import CompositeType from "../CompositeType";
import ESourceLanguage from "../types/ESourceLanguage";
import TestSourceSpan from "../../transpiler/types/__testUtils__/testSourceSpan";
import testAnalysisContextFor from "../../TRANSPILE/1-Analyze/__tests__/testAnalysisContextFor";
import type IOperandType from "../../transpiler/types/IOperandType";
import type ITypingContext from "../../transpiler/types/ITypingContext";
import type TSubscriptKind from "../../transpiler/types/TSubscriptKind";
import ExpressionUnwrapper from "../ExpressionUnwrapper";

/** Register a C symbol, as Stage 2 would from a header */
function withC(
  table: SymbolTable,
  symbols: Array<Record<string, unknown> & { kind: string; name: string }>,
): SymbolTable {
  for (const symbol of symbols) {
    table.addCSymbol({
      sourceFile: "api.h",
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      ...symbol,
    } as never);
  }
  return table;
}

/** A real header, parsed and resolved as Stage 2 does, in a fresh table */
function header(source: string, cpp = false): SymbolTable {
  const table = new SymbolTable();
  if (cpp) {
    const tree = HeaderParser.parseCpp(source).tree;
    table.addCppSymbols(CppResolver.resolve(tree!, "api.hpp", table).symbols);
  } else {
    const tree = HeaderParser.parseC(source).tree;
    table.addCSymbols(CResolver.resolve(tree!, "api.h", table).symbols);
  }
  return table;
}

/** The initializer of the declaration of `name`, and the context to type it */
function initializerOf(
  source: string,
  name: string,
  symbolTable?: SymbolTable,
  helpers?: Record<string, string>,
): { node: Parser.ExpressionContext; ctx: ITypingContext } {
  const { tree, context } = testAnalysisContextFor(source, {
    symbolTable,
    helpers,
  });
  let found: Parser.ExpressionContext | null = null;
  ParseTreeWalker.DEFAULT.walk(
    new (class extends CNextListener {
      override enterVariableDeclaration = (
        ctx: Parser.VariableDeclarationContext,
      ): void => {
        if (ctx.IDENTIFIER().getText() === name) found = ctx.expression();
      };
    })(),
    tree,
  );
  expect(found).not.toBeNull();
  return { node: found!, ctx: { ...context, sourceFile: "test.cnx" } };
}

function typeOf(
  source: string,
  name = "r",
  symbolTable?: SymbolTable,
  helpers?: Record<string, string>,
): IOperandType | null {
  const { node, ctx } = initializerOf(source, name, symbolTable, helpers);
  return OperandTyper.typeOf(node as ParserRuleContext, ctx);
}

/** The facts a row asserts */
function facts(t: IOperandType | null) {
  return t === null
    ? null
    : {
        typeName: t.typeName,
        category: t.category,
        bitWidth: t.bitWidth,
        form: t.form.kind,
      };
}

const inMain = (body: string) => `void main() {\n${body}\n}`;

describe("OperandTyper.typeOf: names", () => {
  it.each([
    ["a local", inMain("u8 a <- 1;\nu8 r <- a;"), "u8", "unsigned", 8],
    ["a parameter", "void f(i16 p) {\n    i16 r <- p;\n}", "i16", "signed", 16],
    [
      "a global",
      "f32 g <- 1.0;\n" + inMain("f32 r <- g;"),
      "f32",
      "floating",
      null,
    ],
    [
      "a bool",
      inMain("bool b <- true;\nbool r <- b;"),
      "bool",
      "boolean",
      null,
    ],
  ])("types %s", (_why, source, typeName, category, bitWidth) => {
    expect(facts(typeOf(source))).toEqual({
      typeName,
      category,
      bitWidth,
      form: "declared",
    });
  });

  it("carries a whole variable's overflow behavior and binding", () => {
    const t = typeOf(inMain("wrap u8 a <- 1;\nu8 r <- a;"));
    expect(t?.overflow).toBe("wrap");
    expect(t?.binding?.kind).toBe("local");
  });

  it("binds a local that shadows a scope member to the local (#1700)", () => {
    const t = typeOf(`scope S {
    u32 n <- 1;
    public void f() {
        u8 n <- 2;
        u8 r <- n;
    }
}`);
    expect(t?.typeName).toBe("u8");
  });

  it("types this.x in a scope reopened in another file (#1699)", () => {
    const t = typeOf(
      `#include "other.cnx"
scope S {
    public void f() {
        u32 r <- this.x;
    }
}`,
      "r",
      undefined,
      { "other.cnx": "scope S {\n    u32 x <- 300;\n}" },
    );
    expect(t?.typeName).toBe("u32");
  });

  it("types global.x, never the local that shadows it (#1701)", () => {
    const t = typeOf(`u32 x <- 1;
void f() {
    u8 x <- 2;
    u32 r <- global.x;
}`);
    expect(t?.typeName).toBe("u32");
  });

  it("types Scope.member (C07)", () => {
    const t = typeOf(`scope S {
    public u16 m <- 1;
}
void f() {
    u16 r <- S.m;
}`);
    expect(t?.typeName).toBe("u16");
  });

  it("marks a volatile or atomic read as a side effect", () => {
    expect(
      typeOf(inMain("volatile u8 a <- 1;\nu8 r <- a;"))?.hasSideEffect,
    ).toBe(true);
    expect(typeOf(inMain("u8 a <- 1;\nu8 r <- a;"))?.hasSideEffect).toBe(false);
  });
});

describe("OperandTyper.typeOfWritten (#1668)", () => {
  it.each([
    ["this.T inside its scope", "this.EMode", ["Motor", "EMode"]],
    ["a bare T inside its scope", "EMode", ["Motor", "EMode"]],
    ["global.T", "global.EMode", ["EMode"]],
    ["Scope.T", "Motor.EMode", ["Motor", "EMode"]],
  ])("types a cast to %s by 1.3's one ladder", (_why, written, parts) => {
    const source = `enum EMode { A, B }\nscope Motor {\nenum EMode { C, D }\npublic void f() {\nu8 x <- 1;\nu8 r <- (${written})x;\n}\n}`;
    const t = typeOf(source);
    expect(t?.category).toBe("enum");
    expect(t?.enumTypeName).toBe(QualifiedCName.fromParts(parts));
  });
});

describe("OperandTyper.constantOf (#1668)", () => {
  function constantOf(source: string): number | null {
    const { node, ctx } = initializerOf(source, "r");
    return OperandTyper.constantOf(node as ParserRuleContext, ctx);
  }

  it.each([
    ["a literal", "u8 r <- 9;", 9],
    ["a suffixed literal", "u8 r <- 9u8;", 9],
    ["a negated literal", "i8 r <- -9;", -9],
    ["a doubly negated literal", "i8 r <- - -9;", 9],
    ["a const local", "const u8 N <- 7;\nu8 r <- N;", 7],
    ["a mutable local", "u8 N <- 7;\nu8 r <- N;", null],
    ["a leading-zero literal (#1728)", "u8 r <- 010;", null],
    ["arithmetic", "u8 r <- 2 + 3;", null],
    ["a bitwise complement", "u8 r <- ~3;", null],
  ])("evaluates %s", (_why, body, value) => {
    expect(constantOf(inMain(body))).toBe(value);
  });

  it("binds a file const, and a const local shadowing it", () => {
    expect(constantOf("const u8 N <- 4;\nvoid main() {\nu8 r <- N;\n}")).toBe(
      4,
    );
    expect(
      constantOf(
        "const u8 N <- 4;\nvoid main() {\nconst u8 N <- 6;\nu8 r <- N;\n}",
      ),
    ).toBe(6);
  });

  it("binds this.NAME and global.NAME to the scope's and the file's", () => {
    const source = (spelling: string) =>
      `const u8 N <- 4;\nscope S {\nconst u8 N <- 6;\npublic void f() {\nu8 r <- ${spelling};\n}\n}`;
    expect(constantOf(source("this.N"))).toBe(6);
    expect(constantOf(source("global.N"))).toBe(4);
  });

  it("does not evaluate an element of a const array", () => {
    expect(
      constantOf(inMain("const u8[2] T <- [1, 2];\nu8 r <- T[0];")),
    ).toBeNull();
  });
});

describe("OperandTyper.typeOf: literals (R2)", () => {
  it.each([
    ["an unsuffixed integer", "5", "int", "none", null, "literal"],
    ["a suffixed integer", "5u16", "u16", "unsigned", 16, "literal"],
    ["a signed suffix", "5i32", "i32", "signed", 32, "literal"],
    ["a hex integer", "0xFF", "int", "none", null, "literal"],
    ["a float", "2.5", "f64", "floating", null, "literal"],
    ["a suffixed float", "2.5f32", "f32", "floating", null, "literal"],
    ["a Boolean", "true", "bool", "boolean", null, "literal"],
    ["a character", "'A'", "char", "character", 8, "literal"],
  ])("types %s", (_why, literal, typeName, category, bitWidth, form) => {
    expect(facts(typeOf(inMain(`u32 r <- ${literal};`)))).toEqual({
      typeName,
      category,
      bitWidth,
      form,
    });
  });
});

describe("OperandTyper.typeOf: operators", () => {
  it("types a cast by its target type, keeping the operand's side effect", () => {
    const t = typeOf(`u8 get() {
    return 1;
}
void main() {
    f32 r <- (f32)get();
}`);
    expect(facts(t)).toEqual({
      typeName: "f32",
      category: "floating",
      bitWidth: null,
      form: "cast",
    });
    expect(t?.hasSideEffect).toBe(true);
  });

  it("types a composite by its leaves", () => {
    const t = typeOf(inMain("u8 a <- 1;\nu8 b <- 2;\nu8 r <- a + b;"));
    expect(t?.form.kind).toBe("composite");
    expect(t?.category).toBe("unsigned");
    expect(t?.typeName).toBe("u8");
  });

  it("types a parenthesized composite (ETR :759-763)", () => {
    const t = typeOf(inMain("u8 a <- 1;\nu8 r <- (a + a);"));
    expect(t?.form.kind).toBe("composite");
  });

  it("types a ternary by its value arms, never its condition", () => {
    const same = typeOf(
      inMain("i32 c <- 1;\nu8 a <- 1;\nu8 r <- (c > 0) ? a : a;"),
    );
    expect(same).toMatchObject({ typeName: "u8", category: "unsigned" });
    expect(same?.form.kind).toBe("ternary");
    const mixed = typeOf(
      inMain("u8 a <- 1;\ni8 s <- 1;\nu8 r <- (a > 0) ? a : s;"),
    );
    expect(mixed).toMatchObject({ typeName: null, category: "none" });
  });

  it.each([
    ["-x", "-a", "i16"],
    ["~x", "~a", "i16"],
  ])("types %s as its operand", (_why, expr, typeName) => {
    expect(typeOf(inMain(`i16 a <- 1;\ni16 r <- ${expr};`))?.typeName).toBe(
      typeName,
    );
  });

  it("types !x and a comparison as Boolean", () => {
    expect(typeOf(inMain("u8 a <- 1;\nbool r <- !(a > 0);"))?.form.kind).toBe(
      "boolean",
    );
    expect(typeOf(inMain("u8 a <- 1;\nbool r <- a > 0;"))?.form.kind).toBe(
      "boolean",
    );
  });

  it("types a shift by its left operand (C01)", () => {
    expect(
      typeOf(inMain("u16 a <- 1;\ni32 n <- 2;\nu16 r <- a << n;"))?.typeName,
    ).toBe("u16");
  });
});

describe("OperandTyper.typeOf: fields, elements and bits", () => {
  it("types a struct field", () => {
    const t = typeOf(`struct P { i8 v; }
void main() {
    P p <- {v: 1};
    i8 r <- p.v;
}`);
    expect(t).toMatchObject({
      typeName: "i8",
      category: "signed",
      overflow: null,
    });
  });

  it("removes the LEADING dimension per subscript (ETR :706-716)", () => {
    const row = typeOf(inMain("u32[2][3] grid;\nu32 r <- grid[1][0];"));
    expect(row).toMatchObject({ typeName: "u32", dimensions: [] });
    const part = typeOf(inMain("u32[2][3] grid;\nu32 r <- grid[1];"), "r");
    expect(part?.dimensions).toEqual([3]);
  });

  it("types a string's element as a character", () => {
    expect(typeOf(inMain('string<8> s <- "hi";\nu8 r <- s[0];'))).toMatchObject(
      {
        typeName: "char",
        category: "character",
      },
    );
  });

  it("types one bit of a scalar as a bit index, not a Boolean", () => {
    const t = typeOf(inMain("u32 w <- 1;\nbool r <- w[3];"));
    expect(t?.form.kind).toBe("bitIndex");
    expect(OperandTyper.isBoolean(t)).toBe(false);
  });

  it("gives an element read the side effect of its index (#1668, C26)", () => {
    const decls =
      "u32 calls <- 0;\nf32[4] arr;\nu32 nextIndex() { calls +<- 1; return 0; }\n";
    const called = typeOf(
      `${decls}void main() {\nf32 r <- arr[nextIndex()];\n}`,
    );
    expect(called?.hasSideEffect).toBe(true);
    const pure = typeOf(`${decls}void main() {\nf32 r <- arr[0];\n}`);
    expect(pure?.hasSideEffect).toBe(false);
  });

  it("types a string field as a string, not an array of its C buffer", () => {
    const struct = "struct Config {\nstring<32> name;\nstring<8>[4] tags;\n}\n";
    const name = typeOf(
      `${struct}void main() {\nConfig c;\nstring<32> r <- c.name;\n}`,
    );
    expect(name).toMatchObject({ stringCapacity: 32, dimensions: [] });
    const tags = typeOf(
      `${struct}void main() {\nConfig c;\nstring<8> r <- c.tags[1];\n}`,
    );
    expect(tags).toMatchObject({ stringCapacity: 8, dimensions: [] });
  });

  it("does not call an array of bools a Boolean", () => {
    const row = typeOf(inMain("bool[2][3] f;\nbool r <- f[0];"));
    expect(row).toMatchObject({ typeName: "bool", dimensions: [3] });
    expect(OperandTyper.isBoolean(row)).toBe(false);
    const cell = typeOf(inMain("bool[2][3] f;\nbool r <- f[0][1];"));
    expect(OperandTyper.isBoolean(cell)).toBe(true);
  });

  it("types a bit range at its folded width (C18b)", () => {
    const t = typeOf(inMain("const u8 W <- 8;\nu32 w <- 1;\nu8 r <- w[0, W];"));
    expect(t).toMatchObject({ typeName: "u8", bitWidth: 8 });
    expect(t?.form).toEqual({ kind: "bitRange", width: 8 });
  });

  it("types a variable of an enum, and an enum member", () => {
    const source = `enum Color { RED, GREEN }
void main() {
    Color c <- Color.RED;
    Color r <- c;
    Color m <- Color.GREEN;
}`;
    expect(typeOf(source)).toMatchObject({
      category: "enum",
      enumTypeName: "Color",
    });
    expect(typeOf(source, "m")).toMatchObject({
      category: "enum",
      enumTypeName: "Color",
      form: { kind: "enumMember" },
    });
  });

  it("types a bitmap field: one bit Boolean, wider unsigned", () => {
    const source = `bitmap8 Flags { Mode[3], Enable, Rest[4] }
void main() {
    Flags f;
    u8 r <- f.Mode;
    bool e <- f.Enable;
}`;
    expect(typeOf(source)).toMatchObject({
      typeName: "u8",
      category: "unsigned",
      bitWidth: 3,
    });
    expect(typeOf(source, "e")).toMatchObject({ category: "boolean" });
  });

  it("types a register member (C11)", () => {
    const t = typeOf(`register R @ 0x40000000 {
    CTRL: u16 rw @ 0x00,
}
void main() {
    u16 r <- R.CTRL;
}`);
    expect(t).toMatchObject({ typeName: "u16", overflow: null });
  });
});

describe("OperandTyper.typeOf: calls", () => {
  it("binds a bare call in a scope to the scope's function (#1698)", () => {
    const t = typeOf(`u8 get() {
    return 1;
}
scope S {
    u32 get() {
        return 300;
    }
    public void f() {
        u32 r <- get();
    }
}`);
    expect(t).toMatchObject({ typeName: "u32", form: { kind: "call" } });
  });

  it.each([
    ["this.f()", "this.get()"],
    ["Scope.f()", "S.get()"],
  ])("types %s (C17)", (_why, call) => {
    const t = typeOf(`scope S {
    public u16 get() {
        return 1;
    }
    public void f() {
        u16 r <- ${call};
    }
}`);
    expect(t?.typeName).toBe("u16");
  });

  it("keeps walking after a call: get().v (C10)", () => {
    const t = typeOf(`struct P { i8 v; }
P make() {
    P p <- {v: 1};
    return p;
}
void main() {
    i8 r <- make().v;
}`);
    expect(t?.typeName).toBe("i8");
  });
});

describe("OperandTyper.typeOf: C and C++ operands (R4)", () => {
  it.each([
    ["uint32_t", "", "u32", "unsigned", 32],
    ["int", "", "i32", "signed", 32],
    ["int", "#pragma target avr\n", "i16", "signed", 16],
    ["unsigned long", "", "u64", "unsigned", 64],
    ["unsigned long", "#pragma target cortex-m7\n", "u32", "unsigned", 32],
    ["uint_fast16_t", "", null, "unsigned", null],
    ["float", "", "f32", "floating", null],
    ["double", "#pragma target avr\n", "f32", "floating", null],
    ["char", "", "char", "character", 8],
  ])(
    "types a C %s variable (%s)",
    (cType, pragma, typeName, category, bitWidth) => {
      const table = withC(new SymbolTable(), [
        { kind: "variable", name: "cVar", type: cType },
      ]);
      const t = typeOf(`${pragma}${inMain("u32 r <- cVar;")}`, "r", table);
      expect(t).toMatchObject({ typeName, category, bitWidth });
    },
  );

  it("matches the fixed-width name before following its typedef (M34)", () => {
    const table = withC(new SymbolTable(), [
      { kind: "type", name: "uint32_t", type: "unsigned long" },
      { kind: "variable", name: "cVar", type: "uint32_t" },
    ]);
    expect(typeOf(inMain("u32 r <- cVar;"), "r", table)?.typeName).toBe("u32");
  });

  it("follows a typedef to a known spelling", () => {
    const table = withC(new SymbolTable(), [
      { kind: "type", name: "real_t", type: "float" },
      { kind: "variable", name: "cVar", type: "real_t" },
    ]);
    expect(typeOf(inMain("f32 r <- cVar;"), "r", table)?.category).toBe(
      "floating",
    );
  });

  it("keeps a C array's dimensions, so its subscript is an element (#978)", () => {
    const table = withC(new SymbolTable(), [
      {
        kind: "variable",
        name: "buf",
        type: "uint8_t",
        isArray: true,
        arrayDimensions: [""],
      },
    ]);
    expect(typeOf(inMain("u8 r <- buf[3];"), "r", table)).toMatchObject({
      typeName: "u8",
      dimensions: [],
    });
  });

  it("leaves a pointer untyped", () => {
    const table = withC(new SymbolTable(), [
      { kind: "variable", name: "ptr", type: "uint8_t *" },
    ]);
    expect(typeOf(inMain("u8 r <- ptr;"), "r", table)).toBeNull();
  });
});

describe("OperandTyper.valueLeaves", () => {
  function leaves(source: string) {
    const { node, ctx } = initializerOf(source, "r");
    return OperandTyper.valueLeaves(node as ParserRuleContext, ctx).map(
      (leaf) => leaf?.typeName ?? null,
    );
  }

  it("collects every value leaf of a composite", () => {
    expect(
      leaves(inMain("u8 a <- 1;\nu16 b <- 2;\nu16 r <- a + b * 2;")),
    ).toEqual(["u8", "u16", "int"]);
  });

  it("never counts a shift count or a ternary's condition", () => {
    expect(
      leaves(
        inMain(
          "u8 a <- 1;\ni32 n <- 1;\ni8 c <- 1;\nu8 r <- (a << n) + ((c > 0) ? a : a);",
        ),
      ),
    ).toEqual(["u8", "u8", "u8"]);
  });

  it("descends through parentheses and unary minus, not an address", () => {
    expect(leaves(inMain("i8 a <- 1;\ni8 r <- -(a + a);"))).toEqual([
      "i8",
      "i8",
    ]);
  });

  it("stops at a comparison, as one Boolean leaf", () => {
    expect(leaves(inMain("u8 a <- 1;\nu8 r <- a + (a > 0);"))).toEqual([
      "u8",
      "bool",
    ]);
  });
});

describe("CompositeType.integerOf", () => {
  function integerOf(source: string, table?: SymbolTable) {
    const { node, ctx } = initializerOf(source, "r", table);
    return CompositeType.integerOf(
      OperandTyper.valueLeaves(node as ParserRuleContext, ctx),
    );
  }

  it.each([
    ["the widest integer", "u8 a <- 1;\nu32 b <- 1;\nu32 r <- a + b;", "u32"],
    [
      "an unsuffixed literal is not counted",
      "u8 a <- 1;\nu8 r <- a + 300;",
      "u8",
    ],
    [
      "a suffixed literal counts at its suffix",
      "u8 b <- 1;\nu32 r <- b + 100u32;",
      "u32",
    ],
    ["a float vetoes", "u32 a <- 1;\nf32 k <- 1.0;\nf32 r <- a * k;", null],
    [
      "a bit range counts at its width",
      "u32 w <- 1;\nu8 b <- 1;\nu16 r <- b + w[0, 12];",
      "u16",
    ],
    ["a Boolean is not counted", "u8 a <- 1;\nu8 r <- a + (a > 0);", "u8"],
  ])("%s", (_why, body, expected) => {
    expect(integerOf(inMain(body))).toBe(expected);
  });

  it("counts a C integer at the target's width (S23)", () => {
    const table = withC(new SymbolTable(), [
      { kind: "variable", name: "cU32", type: "uint32_t" },
    ]);
    expect(integerOf(inMain("u8 b <- 1;\nu32 r <- b + cU32;"), table)).toBe(
      "u32",
    );
  });

  it("vetoes a C integer of unknown width (S24)", () => {
    const table = withC(new SymbolTable(), [
      { kind: "variable", name: "cFast", type: "uint_fast16_t" },
    ]);
    expect(
      integerOf(inMain("u8 b <- 1;\nu32 r <- b + cFast;"), table),
    ).toBeNull();
  });
});

describe("OperandTyper", () => {
  it("holds no state: a static class with no fields", () => {
    const own = Object.getOwnPropertyNames(OperandTyper).filter(
      (name) =>
        typeof (OperandTyper as unknown as Record<string, unknown>)[name] !==
        "function",
    );
    expect(own.sort()).toEqual(["length", "name", "prototype"]);
  });
});

describe("OperandTyper.typeOf: headers, end to end", () => {
  it("keeps an array typedef's dimensions, so gv[0] is an element (C20)", () => {
    const table = header("typedef float vec3[3];\nextern vec3 gv;");
    expect(typeOf(inMain("f32 r <- gv[0];"), "r", table)).toMatchObject({
      typeName: "f32",
      category: "floating",
      dimensions: [],
    });
  });

  it("types a C struct's field, and a C function's result", () => {
    const table = header(
      "typedef struct { float v; unsigned short n; } Sample;\nextern Sample cs;\nint cGet(void);",
    );
    expect(typeOf(inMain("f32 r <- cs.v;"), "r", table)?.category).toBe(
      "floating",
    );
    expect(typeOf(inMain("u16 r <- cs.n;"), "r", table)?.typeName).toBe("u16");
    const call = typeOf(inMain("i32 r <- cGet();"), "r", table);
    expect(call).toMatchObject({ typeName: "i32", hasSideEffect: true });
  });

  it("leaves a C++ overload set whose categories disagree indeterminate (C03)", () => {
    const table = header(
      "#include <stdint.h>\nuint32_t choose(uint32_t x);\nfloat choose(float x);",
      true,
    );
    const t = typeOf(inMain("u32 y <- 1;\nu32 r <- choose(y);"), "r", table);
    expect(t?.form).toEqual({ kind: "foreign", indeterminate: true });
    expect(t?.category).toBe("none");
  });

  it("types a namespaced C++ function by its :: key (C05)", () => {
    const table = header("namespace ns {\n    float scale();\n}", true);
    expect(typeOf(inMain("f32 r <- ns.scale();"), "r", table)?.category).toBe(
      "floating",
    );
  });
});

describe("OperandTyper.typeOf: callbacks (ADR-029)", () => {
  it("types a callback field's call by its defining function", () => {
    const t = typeOf(`u16 handler(u8 x) {
    return 1;
}
struct Ops { handler fn; }
void main() {
    Ops ops <- {fn: handler};
    u16 r <- ops.fn(1);
}`);
    expect(t).toMatchObject({ typeName: "u16", form: { kind: "call" } });
  });
});

describe("OperandTyper.chainOf", () => {
  /** The first assignment target in `source`, and the context to type it */
  function targetOf(source: string) {
    const { tree, context } = testAnalysisContextFor(source);
    let found: Parser.AssignmentTargetContext | null = null;
    ParseTreeWalker.DEFAULT.walk(
      new (class extends CNextListener {
        override enterAssignmentTarget = (
          ctx: Parser.AssignmentTargetContext,
        ): void => {
          found ??= ctx;
        };
      })(),
      tree,
    );
    expect(found).not.toBeNull();
    return OperandTyper.chainOf(found!, { ...context, sourceFile: "test.cnx" });
  }

  it("types each operation of a target, with its subscript kind", () => {
    const chain = targetOf(`struct P { u8[4] data; u32 word; }
void main() {
    P p;
    p.data[2] <- 1;
}`);
    expect(chain.root?.kind).toBe("local");
    expect(
      chain.steps.map((step) => [
        step.before?.typeName ?? null,
        step.subscript,
        step.after?.typeName ?? null,
        step.after?.dimensions,
      ]),
    ).toEqual([
      ["P", null, "u8", [4]],
      ["u8", "array_element", "u8", []],
    ]);
  });

  it("classifies a subscript on a scalar field as a bit", () => {
    const chain = targetOf(`struct P { u32 word; }
void main() {
    P p;
    p.word[3] <- true;
}`);
    expect(chain.steps.at(-1)?.subscript).toBe("bit_single");
  });

  describe("a subscript's kind on a C or C++ header's value (S25)", () => {
    /** The subscript kind of `r`'s initializer, a postfix chain */
    function subscriptOf(
      body: string,
      table: SymbolTable,
    ): TSubscriptKind | null {
      const { node, ctx } = initializerOf(inMain(body), "r", table);
      const postfix = ExpressionUnwrapper.getPostfixExpression(node);
      expect(postfix).not.toBeNull();
      return (
        OperandTyper.chainOf(postfix!, ctx).steps.at(-1)?.subscript ?? null
      );
    }

    const c = header(`#include <stdint.h>
extern uint32_t word;
extern uint8_t buf[];
extern uint8_t *ptr;
extern float cf;
typedef struct { uint8_t v; } pod_t;
extern pod_t pod;`);

    it.each([
      [
        "a scalar integer is bits (ADR-024)",
        "bool r <- word[4];",
        "bit_single",
      ],
      ["an unsized array is elements", "u8 r <- buf[3];", "array_element"],
      ["a pointer is elements", "u8 r <- ptr[1];", "array_element"],
      ["a float is left to C", "u8 r <- cf[1];", "array_element"],
      ["a struct is left to C", "u8 r <- pod[1];", "array_element"],
    ])("%s", (_why, body, expected) => {
      expect(subscriptOf(body, c)).toBe(expected);
    });

    it("leaves a C++ type's own operator[] to C++", () => {
      const cpp = header(
        `#include <stdint.h>
struct Frame { uint8_t data[4]; uint8_t operator[](int i) const; };
extern Frame frame;`,
        true,
      );
      expect(subscriptOf("u8 r <- frame[2];", cpp)).toBe("array_element");
    });

    it("keeps a C-Next scalar's subscript a bit", () => {
      // The control: the header rule does not reach C-Next's own values
      expect(
        subscriptOf("u32 w <- 16;\nbool r <- w[4];", new SymbolTable()),
      ).toBe("bit_single");
    });
  });

  it("consumes a this. root's first member", () => {
    const chain = targetOf(`scope S {
    u16[3] vals;
    public void f() {
        this.vals[0] <- 1;
    }
}`);
    expect(chain.root).toMatchObject({ kind: "variable" });
    expect(chain.steps.map((step) => step.subscript)).toEqual([
      "array_element",
    ]);
  });
});
