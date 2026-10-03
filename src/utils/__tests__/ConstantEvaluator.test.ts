import { describe, expect, it } from "vitest";
import ConstantEvaluator from "../ConstantEvaluator";
import type TConstExpr from "../../types/TConstExpr";
import type TConstResult from "../../types/TConstResult";
import type IConstantEnvironment from "../types/IConstantEnvironment";

const AT = { line: 1, column: 0 };

function lit(digits: string, typeName: string | null = null): TConstExpr {
  return { kind: "literal", digits, typeName };
}
function name(...path: string[]): TConstExpr {
  return { kind: "name", root: null, path, at: AT };
}
function bin(
  op: Extract<TConstExpr, { kind: "binary" }>["op"],
  left: TConstExpr,
  right: TConstExpr,
): TConstExpr {
  return { kind: "binary", op, left, right };
}
function un(
  op: Extract<TConstExpr, { kind: "unary" }>["op"],
  operand: TConstExpr,
): TConstExpr {
  return { kind: "unary", op, operand };
}
function cast(typeName: string, operand: TConstExpr): TConstExpr {
  return { kind: "cast", typeName, operand };
}

/** A name table standing in for the binder: what each spelling is worth */
function env(table: Record<string, TConstResult>): IConstantEnvironment {
  return {
    valueOf: (n) =>
      table[n.path.join(".")] ?? {
        kind: "notConstant",
        reason: "unknown",
        spelling: n.path.join("."),
        at: n.at,
      },
  };
}
const NONE = env({});
const U8_200: TConstResult = { kind: "value", value: 200n, typeName: "u8" };

function valueOf(expr: TConstExpr, e = NONE): bigint | string {
  const result = ConstantEvaluator.evaluate(expr, e);
  return result.kind === "value" ? result.value : result.kind;
}

describe("ConstantEvaluator", () => {
  describe("the value is the value the expression has at run time (ADR-044)", () => {
    it.each<[string, TConstExpr, bigint | string]>([
      ["1 + 2", bin("+", lit("1"), lit("2")), 3n],
      [
        "1 - -1 (unary minus, not a decrement)",
        bin("-", lit("1"), un("-", lit("1"))),
        2n,
      ],
      ["1 + 2 + 3", bin("+", bin("+", lit("1"), lit("2")), lit("3")), 6n],
      ["1 << 3", bin("<<", lit("1"), lit("3")), 8n],
      ["0x10 + 1, from digits", bin("+", lit("16"), lit("1")), 17n],
      ["7 / 2 truncates toward zero", bin("/", lit("7"), lit("2")), 3n],
      [
        "-7 / 2 truncates toward zero",
        bin("/", un("-", lit("7")), lit("2")),
        -3n,
      ],
      [
        "-7 % 2 takes the dividend's sign",
        bin("%", un("-", lit("7")), lit("2")),
        -1n,
      ],
      ["~0 is -1: an untyped literal is an i32", un("~", lit("0")), -1n],
      ["~(u8)0 is 255", un("~", cast("u8", lit("0"))), 255n],
      ["1 | 2 | 4", bin("|", bin("|", lit("1"), lit("2")), lit("4")), 7n],
      ["6 & 3", bin("&", lit("6"), lit("3")), 2n],
      ["6 ^ 3", bin("^", lit("6"), lit("3")), 5n],
      ["16 >> 2", bin(">>", lit("16"), lit("2")), 4n],
    ])("%s", (_label, expr, expected) => {
      expect(valueOf(expr)).toBe(expected);
    });
  });

  describe("an operation happens at its operands' width, and overflow is not a value", () => {
    const withA = env({ A: U8_200 });
    it.each<[string, TConstExpr, bigint | string]>([
      [
        "A + A on a u8 overflows (clamp would give 255)",
        bin("+", name("A"), name("A")),
        "overflow",
      ],
      [
        "(u16)A + (u16)A is 400",
        bin("+", cast("u16", name("A")), cast("u16", name("A"))),
        400n,
      ],
      [
        "A - 201 on a u8 overflows (clamp would give 0)",
        bin("-", name("A"), lit("201")),
        "overflow",
      ],
      [
        "A - 3 on a u8 is 197: the literal takes A's type",
        bin("-", name("A"), lit("3")),
        197n,
      ],
      [
        "(u8)200 + (u8)100 overflows",
        bin("+", cast("u8", lit("200")), cast("u8", lit("100"))),
        "overflow",
      ],
      [
        "a mixed u8 + u16 happens at u16",
        bin("+", name("A"), cast("u16", lit("100"))),
        300n,
      ],
      [
        "literals alone happen at i32: 0x40000000 * 2 overflows",
        bin("*", lit("1073741824"), lit("2")),
        "overflow",
      ],
      ["1 << 31 does not fit i32", bin("<<", lit("1"), lit("31")), "overflow"],
      ["-(u8)1 does not fit u8", un("-", cast("u8", lit("1"))), "overflow"],
      ["(u8)300 does not fit u8", cast("u8", lit("300")), "overflow"],
    ])("%s", (_label, expr, expected) => {
      expect(valueOf(expr, withA)).toBe(expected);
    });

    it("reports the type the arithmetic overflowed at", () => {
      const result = ConstantEvaluator.evaluate(
        bin("+", name("A"), name("A")),
        withA,
      );
      expect(result).toEqual({ kind: "overflow", typeName: "u8" });
    });

    it("keeps an all-literal result untyped, so a later typed operand gives it a type", () => {
      // (1 + 2) + A: the literal sum must not be fixed at i32, or the outer
      // addition would happen at i32 instead of at A's u8
      const result = ConstantEvaluator.evaluate(
        bin("+", bin("+", lit("1"), lit("2")), name("A")),
        withA,
      );
      expect(result).toEqual({ kind: "value", value: 203n, typeName: "u8" });
    });
  });

  describe("what has no value", () => {
    it.each<[string, TConstExpr, string]>([
      ["division by zero", bin("/", lit("1"), lit("0")), "divisionByZero"],
      ["modulo by zero", bin("%", lit("1"), lit("0")), "divisionByZero"],
      [
        "a negative shift amount",
        bin("<<", lit("1"), un("-", lit("1"))),
        "negativeShift",
      ],
      [
        "a right shift of a negative value",
        bin(">>", un("-", lit("8")), lit("1")),
        "negativeShift",
      ],
      ["an unknown name", name("limit"), "unknown"],
    ])("%s", (_label, expr, reason) => {
      const result = ConstantEvaluator.evaluate(expr, NONE);
      expect(result.kind === "notConstant" && result.reason).toBe(reason);
    });

    it("reports the first thing that has no value, with its spelling", () => {
      const expr: TConstExpr = {
        kind: "other",
        what: "call",
        spelling: "pick()",
        at: AT,
      };
      expect(
        ConstantEvaluator.evaluate(bin("+", expr, lit("1")), NONE),
      ).toEqual({
        kind: "notConstant",
        reason: "call",
        spelling: "pick()",
        at: AT,
      });
    });

    it("prefers a missing value to an overflow beside it", () => {
      const withA = env({ A: U8_200 });
      const expr = bin("+", bin("+", name("A"), name("A")), name("limit"));
      expect(valueOf(expr, withA)).toBe("notConstant");
    });
  });

  describe("a name only C knows", () => {
    const withMacro = env({ BUF_SIZE: { kind: "foreign" } });
    it("makes the whole expression foreign: C evaluates it", () => {
      expect(valueOf(bin("+", name("BUF_SIZE"), lit("1")), withMacro)).toBe(
        "foreign",
      );
    });
    it("sizeof a type whose size the target decides is foreign", () => {
      expect(valueOf({ kind: "sizeof", typeName: "Point" })).toBe("foreign");
    });
    it("sizeof a primitive is its width in bytes", () => {
      expect(valueOf({ kind: "sizeof", typeName: "u32" })).toBe(4n);
    });
    it("a missing value still wins over a foreign name", () => {
      const expr = bin("+", name("BUF_SIZE"), name("limit"));
      expect(valueOf(expr, withMacro)).toBe("notConstant");
    });
  });

  describe("as C, only what is evaluated must be constant (C99 6.6p3)", () => {
    it("a ternary evaluates only the arm it chooses", () => {
      const expr: TConstExpr = {
        kind: "ternary",
        condition: bin("<", lit("1"), lit("2")),
        whenTrue: lit("10"),
        whenFalse: name("limit"),
      };
      expect(valueOf(expr)).toBe(10n);
    });
    it("&& short-circuits", () => {
      expect(
        valueOf(bin("&&", bin("=", lit("1"), lit("2")), name("limit"))),
      ).toBe(0n);
    });
    it("|| short-circuits", () => {
      expect(
        valueOf(bin("||", bin("!=", lit("1"), lit("2")), name("limit"))),
      ).toBe(1n);
    });
  });

  describe("names are the environment's to answer", () => {
    it("asks the environment with the name's whole path", () => {
      const withMember = env({
        "EPerm.READ": { kind: "value", value: 1n, typeName: null },
        "EPerm.WRITE": { kind: "value", value: 2n, typeName: null },
      });
      expect(
        valueOf(
          bin("|", name("EPerm", "READ"), name("EPerm", "WRITE")),
          withMember,
        ),
      ).toBe(3n);
    });
  });

  describe("toNumber", () => {
    it.each<[bigint, number | undefined]>([
      [3n, 3],
      [-1n, -1],
      [9007199254740991n, 9007199254740991],
      [9007199254740992n, undefined],
    ])("%s", (value, expected) => {
      expect(ConstantEvaluator.toNumber(value)).toBe(expected);
    });
  });
});
