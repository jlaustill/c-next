import { beforeEach, describe, expect, it } from "vitest";
import parse from "../../3-Declare/cnext/__tests__/testHelpers";
import CNextResolver from "../../3-Declare/cnext/index";
import Program from "../Program";
import SymbolRegistry from "../../3-Declare/SymbolRegistry";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import ELEMENT_STEP from "../../../types/ELEMENT_STEP";
import type IProgram from "../../../types/IProgram";
import type TConstResult from "../../../types/TConstResult";
import type ICVariableSymbol from "../../../types/symbols/c/ICVariableSymbol";
import type TCSymbol from "../../../types/symbols/c/TCSymbol";

/**
 * #1175: what a name in a constant expression is worth, asked as every pass
 * after 1.4 asks it -- `program.constantValueOf` -- of programs built from real
 * Declare output. One walk answers a scope's member, an enum's, a length
 * property through struct fields, and a name only a header may define.
 */

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

const FILE = "a.cnx";
const TOP = { line: 1, column: 0 };

function build(
  source: string,
  reachesHeader = false,
  header: ReadonlyArray<TCSymbol> = [],
): IProgram {
  return Program.build([CNextResolver.resolve(parse(source), FILE, registry)], {
    filesReachingForeignHeaders: new Set(reachesHeader ? [FILE] : []),
    // Scope bindings are the registry's, as in a real run
    registry,
    foreign: {
      c: header,
      cpp: [],
      opaqueTypedefs: new Set(),
      typedefToTag: new Map(),
      structTagsWithBodies: new Set(),
    },
  });
}

/** A variable a C header declares: `extern <type> <name><dims>;` */
function cVariable(
  name: string,
  type: string,
  arrayDimensions?: ReadonlyArray<number | string>,
): ICVariableSymbol {
  return {
    kind: "variable",
    name,
    type,
    sourceFile: "header.h",
    span: { line: 1, column: 0, endLine: 1, endColumn: 0 },
    sourceLanguage: ESourceLanguage.C,
    visibility: "public",
    isArray: arrayDimensions !== undefined,
    arrayDimensions,
  };
}

function ask(
  program: IProgram,
  path: string[],
  options: { at?: { line: number; column: number }; root?: "this" } = {},
): TConstResult {
  return program.constantValueOf(FILE, {
    kind: "name",
    root: options.root ?? null,
    path,
    at: options.at ?? TOP,
  });
}

/** A value as a number, or the reason there is none */
function answer(result: TConstResult): number | string {
  switch (result.kind) {
    case "value":
      return Number(result.value);
    case "notConstant":
      return result.reason;
    default:
      return result.kind;
  }
}

describe("ConstantNames, through program.constantValueOf (#1175)", () => {
  describe("a scope's member, named from outside it", () => {
    const SCOPE = `
scope Motor {
    public const u8 MAX <- 4;
    public enum EMode { SLOW, FAST }
    public u8 speed() { return 1; }
}
u8 after;`;
    /** Where `after` is declared, below the scope: the scope is in view */
    const BELOW = { line: 7, column: 0 };

    it.each([
      ["a const", ["Motor", "MAX"], 4],
      ["an enum's member", ["Motor", "EMode", "FAST"], 1],
      ["a function, which has no value", ["Motor", "speed"], "function"],
      ["nothing the scope declares", ["Motor", "NOPE"], "undeclaredMember"],
      ["the scope itself", ["Motor"], "scope"],
    ])("answers %s", (_label, path, expected) => {
      expect(answer(ask(build(SCOPE), path, { at: BELOW }))).toBe(expected);
    });

    it("answers `this.EMode.M` inside the scope, as its own enum", () => {
      const program = build(`
scope Motor {
    enum EMode { SLOW, FAST }
    u8[4] buf;
}`);
      const inside = { line: 4, column: 4 };
      expect(
        answer(ask(program, ["EMode", "FAST"], { root: "this", at: inside })),
      ).toBe(1);
    });
  });

  describe("a length property (ADR-058), through struct fields", () => {
    const SOURCE = `
struct Packet {
    u8[6] data;
    u8 flag;
}
Packet pkt;
u16[3] words;
u8 lone;`;

    it.each([
      ["an array variable's element_count", ["words", "element_count"], 3],
      ["an array variable's bit_length", ["words", "bit_length"], 48],
      ["a struct field's element_count", ["pkt", "data", "element_count"], 6],
      [
        "a property of a field of an array",
        ["words", "data", "element_count"],
        "member",
      ],
      [
        "a field of a scalar field",
        ["pkt", "flag", "x", "element_count"],
        "member",
      ],
      [
        "a field the struct does not have",
        ["pkt", "nope", "element_count"],
        "member",
      ],
      ["a member that is not a length property", ["pkt", "data"], "member"],
    ])("answers %s", (_label, path, expected) => {
      expect(answer(ask(build(SOURCE), path))).toBe(expected);
    });

    it("answers a local array's element_count where the local is in view", () => {
      const program = build(`
void f() {
    u8[5] local;
    local[0] <- 1;
}`);
      const inFunction = { line: 4, column: 4 };
      expect(
        answer(ask(program, ["local", "element_count"], { at: inFunction })),
      ).toBe(5);
    });

    it("has no value for an array a header macro sizes, which C alone knows", () => {
      const program = build(`u8[SOME_MACRO] buf;`, true);
      expect(answer(ask(program, ["buf", "element_count"]))).toBe("unfolded");
    });
  });

  describe("a name a C header declares", () => {
    const HEADER = [
      cVariable("table", "uint8_t", [10, 4]),
      cVariable("BUF_SIZE", "int"),
      cVariable("macroSized", "uint8_t", ["N_ITEMS"]),
    ];
    const program = () => build("u8 x;", true, HEADER);

    it("is C's to evaluate as written, when it is a bare name", () => {
      expect(ask(program(), ["BUF_SIZE"])).toEqual({
        kind: "foreign",
        spelling: "BUF_SIZE",
        why: "header",
      });
    });

    it.each([
      ["an array's element_count", ["table", "element_count"], 10],
      [
        "an element's element_count",
        ["table", ELEMENT_STEP, "element_count"],
        4,
      ],
      [
        "a property a header macro sizes",
        ["macroSized", "element_count"],
        "unfolded",
      ],
      // The element's width is the target's to decide
      ["an array's bit_length", ["table", "bit_length"], "unfolded"],
      ["a member of a header scalar", ["BUF_SIZE", "element_count"], "member"],
    ])("measures %s from its declared dimensions", (_label, path, expected) => {
      expect(answer(ask(program(), path))).toBe(expected);
    });
  });

  describe("a name nothing C-Next declares", () => {
    it("may be a header macro in a file that includes a header", () => {
      const program = build(`u8 x;`, true);
      expect(ask(program, ["BUF_SIZE"])).toEqual({
        kind: "foreign",
        spelling: "BUF_SIZE",
        why: "maybeHeader",
      });
      // A macro is a bare name: C has no spelling of `X.y` to write for it
      expect(answer(ask(program, ["NotAnEnum", "MEMBER"]))).toBe("member");
    });

    it("is undeclared in a file that includes none, which E0427 reports", () => {
      const program = build(`u8 x;`);
      expect(answer(ask(program, ["BUF_SIZE"]))).toBe("unknown");
      expect(answer(ask(program, ["NotAnEnum", "MEMBER"]))).toBe("unknown");
    });

    it("is unknown for an empty path, which no source spells", () => {
      expect(answer(ask(build(`u8 x;`), []))).toBe("unknown");
    });
  });
});
