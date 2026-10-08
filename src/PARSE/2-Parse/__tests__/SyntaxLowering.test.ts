import { describe, expect, it } from "vitest";
import CNextSourceParser from "../CNextSourceParser";
import * as Parser from "../grammar/CNextParser";
import SyntaxLowering from "../SyntaxLowering";
import ConstExprLowering from "../../../utils/ConstExprLowering";
import type TExpression from "../../../types/syntax/TExpression";
import type TTypeSyntax from "../../../types/syntax/TTypeSyntax";

/** The expression `source` lowers to, written as a variable's initializer */
function expressionOf(source: string): TExpression {
  const tree = CNextSourceParser.parse(`u32 q <- ${source};\n`).tree;
  const expression = tree.declaration()[0].variableDeclaration()?.expression();
  if (!expression) throw new Error(`no expression in: ${source}`);
  return SyntaxLowering.expression(expression);
}

/** The type `source` lowers to, written as a variable's type */
function typeOf(source: string): TTypeSyntax {
  const tree = CNextSourceParser.parse(`${source} q;\n`).tree;
  const type = tree.declaration()[0].variableDeclaration()?.type();
  if (!type) throw new Error(`no type in: ${source}`);
  return SyntaxLowering.type(type);
}

/** A compact rendering of a lowered expression's shape, for assertions */
function shape(e: TExpression): string {
  switch (e.kind) {
    case "ternary":
      return `(${shape(e.condition)} ? ${shape(e.whenTrue)} : ${shape(e.whenFalse)})`;
    case "binary":
      return `${e.level}(${e.operands
        .map((operand, i) =>
          i === 0 ? shape(operand) : `${e.operators[i - 1]} ${shape(operand)}`,
        )
        .join(" ")})`;
    case "unary":
      return `${e.operator}${shape(e.operand)}`;
    case "postfix":
      return `${shape(e.primary)}${e.ops
        .map((op) => {
          if (op.kind === "member") return `.${op.name}`;
          if (op.kind === "subscript") {
            return `[${op.indexes.map(shape).join(", ")}]`;
          }
          if (op.kind === "missing") return "<missing op>";
          return `(${op.arguments.map(shape).join(", ")})`;
        })
        .join("")}`;
    case "identifier":
      return e.name;
    case "root":
      return e.root;
    case "literal":
      return `${e.literalKind}:${e.text}`;
    case "parenthesized":
      return `paren(${shape(e.expression)})`;
    case "cast":
      return `cast<${e.type.kind}:${e.type.text}>(${shape(e.operand)})`;
    case "sizeof":
      return e.type
        ? `sizeof<${e.type.kind}:${e.type.text}>`
        : `sizeof(${shape(e.expression!)})`;
    case "structInitializer":
      return `{${e.fields.map((f) => `${f.name}: ${shape(f.value)}`).join(", ")}}`;
    case "missing":
      return "<missing>";
    case "arrayInitializer":
      return e.fill
        ? `[${shape(e.fill)}*]`
        : `[${e.elements.map(shape).join(", ")}]`;
  }
}

describe("SyntaxLowering", () => {
  it.each<[string, string]>([
    ["x", "x"],
    ["a + b - c", "additive(a + b - c)"],
    ["a + b * c", "additive(a + multiplicative(b * c))"],
    ["a << 2 | b & c", "bitwiseOr(shift(a << integer:2) | bitwiseAnd(b & c))"],
    [
      "A = B && C != D || !E",
      "or(and(equality(A = B) && equality(C != D)) || !E)",
    ],
    ["a < b", "relational(a < b)"],
    ["a ^ b", "bitwiseXor(a ^ b)"],
    ["10 / 3 % 2", "multiplicative(integer:10 / integer:3 % integer:2)"],
    ["(a < b) ? 1 : 2", "(relational(a < b) ? integer:1 : integer:2)"],
    ["-x", "-x"],
    ["~0", "~integer:0"],
    ["&x", "&x"],
    ["!!x", "!!x"],
    ["1 - -1", "additive(integer:1 - -integer:1)"],
    ["this.n", "this.n"],
    ["global.s.n", "global.s.n"],
    ["arr[i][0, 4]", "arr[i][integer:0, integer:4]"],
    ["f()", "f()"],
    ["s.f(a, 1)", "s.f(a, integer:1)"],
    ["(x)", "paren(x)"],
    ["(u8)x", "cast<primitive:u8>(x)"],
    ["(Scope.T)x", "cast<qualified:Scope.T>(x)"],
    ["sizeof(u32)", "sizeof<primitive:u32>"],
    ["sizeof(a - -1)", "sizeof(additive(a - -integer:1))"],
    ["{ a: 1, b: x }", "{a: integer:1, b: x}"],
    ["[1, 2, 3]", "[integer:1, integer:2, integer:3]"],
    ["[0*]", "[integer:0*]"],
    ["[{ a: 1 }, [2]]", "[{a: integer:1}, [integer:2]]"],
    ["9u8", "suffixedDecimal:9u8"],
    ["0xFFu16", "suffixedHex:0xFFu16"],
    ["0b11i8", "suffixedBinary:0b11i8"],
    ["1.5f32", "suffixedFloat:1.5f32"],
    ["0x10", "hex:0x10"],
    ["0b101", "binary:0b101"],
    ["1.5", "float:1.5"],
    ['"s"', 'string:"s"'],
    ["'c'", "char:'c'"],
    ["true", "true:true"],
    ["false", "false:false"],
    ["NULL", "null:NULL"],
  ])("%s lowers to %s", (source, expected) => {
    expect(shape(expressionOf(source))).toBe(expected);
  });

  it("keeps the source as written, spaces and all, which getText() loses", () => {
    expect(expressionOf("a - -1").written).toBe("a - -1");
  });

  it("records each node's span", () => {
    const lowered = expressionOf("1 + limit");
    expect(lowered.kind === "binary" && lowered.operands[1].span).toEqual({
      line: 1,
      column: 13,
      endLine: 1,
      endColumn: 18,
    });
  });

  it.each<[string, string]>([
    ["u8", "primitive"],
    ["string<8>", "string"],
    ["this.T", "scoped"],
    ["global.T", "global"],
    ["Scope.T", "qualified"],
    ["Vec<u8, 4>", "template"],
    ["T", "user"],
    ["u8[4]", "array"],
  ])("lowers the type %s as %s", (source, kind) => {
    const type = typeOf(source);
    expect(type.kind).toBe(kind);
    expect(type.text).toBe(source.replaceAll(" ", ""));
  });

  it("lowers an array type's element and dimensions", () => {
    const type = typeOf("string<8>[4][]");
    expect(type.kind === "array" && type.element).toMatchObject({
      kind: "string",
      capacity: "8",
      text: "string<8>",
    });
    expect(
      type.kind === "array" && type.dimensions.map((d) => d && shape(d)),
    ).toEqual(["integer:4", null]);
  });

  it("is plain data: it survives a JSON round trip unchanged", () => {
    const lowered = expressionOf(
      "(u32)EColor.COUNT + f(a[1], { x: 1 }) * sizeof(u8[2]) - ((b) ? 1 : 2)",
    );
    expect(JSON.parse(JSON.stringify(lowered))).toEqual(lowered);
  });

  // The editor's symbol collection (`parseWithSymbols`) lowers a tree with
  // parse errors, so every gap the parser recovers from lowers as `missing`
  it.each<[string, string]>([
    ["(b ? 1 : 2)", "<missing>"],
    ["-", "-<missing>"],
    ["a <", "relational(a < <missing>)"],
    ["(u8)", "cast<primitive:u8>(<missing>)"],
    ["{ a: }", "{a: <missing>}"],
    ["a[", "a<missing op><missing op>"],
    ["[1, [", "[integer:1, <missing>]<missing op><missing op>"],
    ["- <- ( ] - global", "-<missing>(-global)"],
    ["( u8", "cast<primitive:u8>(<missing>)"],
    // a field recovered without a name initializes nothing
    ["{ a: 1, : 2 }", "{a: integer:1}"],
    ["& {", "&{}"],
    ["{ a: 1, b }", "{a: integer:1, b: <missing>}"],
    ["a.", "a<missing op>"],
  ])(
    "lowers %s, which the parser recovered from, as %s",
    (source, expected) => {
      const { tree, parseErrors } = CNextSourceParser.parse(
        `u32 q <- ${source};\n`,
      );
      expect(parseErrors.length).toBeGreaterThan(0);
      const expression = tree
        .declaration()[0]
        .variableDeclaration()
        ?.expression();
      expect(shape(SyntaxLowering.expression(expression!))).toBe(expected);
    },
  );
});

/*
 * Random token runs, at a fixed seed, in every position a type or an
 * expression is written. Lowering a recovered tree never throws: a getter the
 * generated parser types as required can be null after recovery.
 */
describe("SyntaxLowering on recovered trees", () => {
  const TOKENS = [
    "a",
    "1",
    "0x1",
    "true",
    '"s"',
    "u8",
    "string<4>",
    "sizeof",
    "this",
    "global",
    "+",
    "-",
    "*",
    "<",
    "<-",
    "||",
    "!",
    "~",
    "&",
    "<<",
    "?",
    ":",
    ",",
    ".",
    "(",
    ")",
    "[",
    "]",
    "{",
    "}",
    "x:",
    ";",
  ];
  const POSITIONS = [
    (run: string) => `u32 q <- ${run};`,
    (run: string) => `u32 q <- sizeof(${run});`,
    (run: string) => `u32 q <- (${run}) a;`,
    (run: string) => `${run} q;`,
    (run: string) => `u8[${run}] q;`,
    (run: string) => `Vec<${run}> q;`,
    (run: string) => `u8[4] q <- [${run}];`,
    (run: string) => `T q <- { x: ${run} };`,
    (run: string) => `T q <- { x: 1, ${run} };`,
    (run: string) => `u32 q <- (u8) ${run};`,
    (run: string) => `u32 q <- a.${run};`,
    (run: string) => `u32 q <- a(${run};`,
  ];

  /** A seeded pseudo-random generator, so every run sees the same cases */
  function random(seed: number): () => number {
    let state = seed;
    return () => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state / 2147483648;
    };
  }

  function lowerEverything(node: unknown, lowered: { count: number }): void {
    if (node instanceof Parser.ExpressionContext) {
      ConstExprLowering.lower(SyntaxLowering.expression(node));
      lowered.count++;
    } else if (node instanceof Parser.TypeContext) {
      SyntaxLowering.type(node);
      lowered.count++;
    }
    for (const child of (node as { children?: unknown[] }).children ?? []) {
      lowerEverything(child, lowered);
    }
  }

  it("never throws, and reaches every position", () => {
    const next = random(1932);
    const lowered = { count: 0 };
    let recovered = 0;
    for (let i = 0; i < 2000; i++) {
      const length = 1 + Math.floor(next() * 6);
      const run = Array.from(
        { length },
        () => TOKENS[Math.floor(next() * TOKENS.length)],
      ).join(" ");
      const position = POSITIONS[i % POSITIONS.length];
      const { tree, parseErrors } = CNextSourceParser.parse(
        `${position(run)}\n`,
      );
      if (parseErrors.length === 0) continue;
      recovered++;
      lowerEverything(tree, lowered);
    }
    expect(recovered).toBeGreaterThan(1500);
    expect(lowered.count).toBeGreaterThan(recovered);
  });
});
