/**
 * The one rule for what a constant expression is worth (#1175, #1669).
 *
 * ADR-044 "Values fixed at compile time": a value the program needs while it
 * compiles -- an array dimension, an enum member's value, a const's initializer
 * -- is the value the same expression has when the program runs. So an
 * operation happens at its operands' width, an untyped literal takes the type
 * of the operand beside it, or `i32` when nothing gives it one, and where that
 * arithmetic would clamp or wrap the expression has no value: the program would
 * compute something other than the exact result.
 *
 * Exact arithmetic is `bigint`: a u64 is past what a `number` holds exactly.
 *
 * Until this, four things decided a constant's value: a regex table for array
 * dimensions, a prefix parser for enum values (`1 + 2` was 1), render's fold
 * over generated C operands, and a literal evaluator nothing called. They
 * disagreed -- `u8[1 - -1]` was 2 in the .c and `1--1` in the .h.
 */
import TYPE_WIDTH from "../types/TYPE_WIDTH";
import TypeCheckUtils from "./TypeCheckUtils";
import LiteralUtils from "./LiteralUtils";
import IFloatLiteralParts from "../types/IFloatLiteralParts";
import type TConstExpr from "../types/TConstExpr";
import type TConstResult from "../types/TConstResult";
import type IConstantEnvironment from "./types/IConstantEnvironment";
import SaturationRule from "./SaturationRule";
import CNX_TO_C_TYPE_MAP from "./constants/TypeMappings";

type TBinary = Extract<TConstExpr, { kind: "binary" }>;
type TValue = Extract<TConstResult, { kind: "value" }>;
type TFloat = Extract<TConstResult, { kind: "float" }>;
type TIntegerResult = Exclude<TConstResult, { kind: "float" }>;
type TComparison = "<" | ">" | "<=" | ">=" | "=" | "!=";
type TArithmetic = Exclude<TBinary["op"], TComparison | "&&" | "||">;

/** ADR-044: a literal nothing else gives a type is an i32 */
const DEFAULT_TYPE = "i32";
const BOOL = "bool";
const COMPARISONS: ReadonlySet<string> = new Set<TComparison>([
  "<",
  ">",
  "<=",
  ">=",
  "=",
  "!=",
]);

class ConstantEvaluator {
  /**
   * `context` is the type the expression is written into, when it has one: a
   * declaration's or a parameter's type, a const's declared type. ADR-044
   * "Integer Literals" (owner ruling, 2026-10-03): a literal takes the
   * smallest type that fits its context at compile time, or `i32` when there
   * is none -- so an operation between untyped literals happens at it.
   */
  static evaluate(
    expr: TConstExpr,
    env: IConstantEnvironment,
    context: string | null = null,
  ): TIntegerResult {
    return ConstantEvaluator.integral(
      ConstantEvaluator.fold(expr, env, context),
    );
  }

  /**
   * A constant expression's value as a number, integer or float, for the one
   * question ADR-051 asks of a divisor whatever its type: is it zero (§4,
   * #1268 review). Null for anything with no value.
   */
  static numberValue(
    expr: TConstExpr,
    env: IConstantEnvironment,
  ): number | null {
    const result = ConstantEvaluator.fold(expr, env);
    if (result.kind === "value") return Number(result.value);
    return result.kind === "float" ? result.value : null;
  }

  /**
   * `evaluate`, where a float is a value too (#1268 review): as C computes it
   * with `FLT_EVAL_METHOD` 0 -- an operation between floats happens at the
   * wider one's type, an integer operand converts to the float's, and a
   * float cast to an integer type saturates as ADR-024's cast does
   */
  static fold(
    expr: TConstExpr,
    env: IConstantEnvironment,
    context: string | null = null,
  ): TConstResult {
    switch (expr.kind) {
      case "literal":
        return ConstantEvaluator.literal(expr.digits, expr.typeName);
      case "name":
        return env.valueOf(expr);
      case "cast":
        if (
          CNX_TO_C_TYPE_MAP[expr.typeName] === undefined &&
          !env.isTypeName(expr.typeName, expr.at)
        ) {
          return {
            kind: "notConstant",
            reason: "unknown",
            spelling: expr.typeName,
            at: expr.at,
          };
        }
        // A cast is the context of what it encloses
        return ConstantEvaluator.cast(
          expr.typeName,
          ConstantEvaluator.fold(expr.operand, env, expr.typeName),
        );
      case "unary":
        return ConstantEvaluator.unary(
          expr.op,
          ConstantEvaluator.fold(expr.operand, env, context),
          context,
        );
      case "binary":
        return ConstantEvaluator.binary(expr, env, context);
      case "ternary":
        return ConstantEvaluator.ternary(expr, env, context);
      case "other":
        return expr.what === "float"
          ? ConstantEvaluator.floatLiteral(expr)
          : {
              kind: "notConstant",
              reason: expr.what,
              spelling: expr.spelling,
              at: expr.at,
            };
    }
  }

  /** An integer constant's view of a result: a float is not one */
  private static integral(result: TConstResult): TIntegerResult {
    return result.kind === "float"
      ? {
          kind: "notConstant",
          reason: "float",
          spelling: result.spelling,
          at: result.at,
        }
      : result;
  }

  /** A float value as `typeName` holds it: `f32` rounds to single */
  static heldFloat(value: number, typeName: string): number {
    return typeName === "f32" ? Math.fround(value) : value;
  }

  /** `1.5`, `0.0f32`, `2e3f64`: the type its suffix names, `f64` without one */
  private static floatLiteral(
    expr: Extract<TConstExpr, { kind: "other" }>,
  ): TConstResult {
    const parts = LiteralUtils.floatLiteralParts(expr.spelling);
    const value = parts === null ? Number.NaN : Number(parts.unsuffixed);
    if (parts === null || !Number.isFinite(value)) {
      return {
        kind: "notConstant",
        reason: "float",
        spelling: expr.spelling,
        at: expr.at,
      };
    }
    const typeName = parts.width === 32 ? "f32" : "f64";
    return {
      kind: "float",
      value:
        typeName === "f32"
          ? ConstantEvaluator.decimalAsF32(parts, value)
          : value,
      typeName,
      spelling: expr.spelling,
      at: expr.at,
    };
  }

  /**
   * A decimal literal as `f32` holds it: rounded once, as C rounds `1.5f`.
   * Rounding through double differs from that only where the double lands
   * exactly on the midpoint between two floats; there the exact decimal says
   * which side of it the literal is on (#1268 review).
   */
  private static decimalAsF32(
    parts: IFloatLiteralParts,
    double: number,
  ): number {
    const held = Math.fround(double);
    if (held === double) return held;
    // Past FLT_MAX the next neighbor is 2^128, which f32 holds as infinity
    const upper = Number.isFinite(held) ? held : Math.sign(held) * 2 ** 128;
    const other = 2 * double - upper;
    if (Math.fround(other) !== other) return held;
    const side = ConstantEvaluator.compareExactly(parts, double);
    if (side === 0) return held;
    return side > 0 ? Math.max(held, other) : Math.min(held, other);
  }

  /** The sign of `parts - double`, both exactly: a literal is unsigned */
  private static compareExactly(
    parts: IFloatLiteralParts,
    double: number,
  ): number {
    const exponent = parts.exponent - parts.fraction.length;
    let scaled = double;
    let twos = 0;
    while (!Number.isInteger(scaled)) {
      scaled *= 2;
      twos += 1;
    }
    let decimal = BigInt(parts.whole + parts.fraction) * 2n ** BigInt(twos);
    let binary = BigInt(scaled);
    if (exponent >= 0) {
      decimal *= 10n ** BigInt(exponent);
    } else {
      binary *= 10n ** BigInt(-exponent);
    }
    if (decimal === binary) return 0;
    return decimal > binary ? 1 : -1;
  }

  /**
   * An integer converted to `typeName` as C converts it: rounded once. A
   * `number` holds 53 bits, so a wider magnitude is first rounded to odd at
   * 53 bits, which `fround` then rounds correctly to 24 (#1268 review).
   */
  static integerAsFloat(value: bigint, typeName: TFloat["typeName"]): number {
    if (typeName === "f64") return Number(value);
    const magnitude = value < 0n ? -value : value;
    const shift = BigInt(Math.max(0, magnitude.toString(2).length - 53));
    let top = magnitude >> shift;
    if (top << shift !== magnitude) top |= 1n;
    const held = Math.fround(Number(top) * 2 ** Number(shift));
    return value < 0n ? -held : held;
  }

  /**
   * `left op right` where an operand is a float. Computing two `f32` values
   * in double and rounding once to `f32` is exactly the `f32` result for
   * `+ - * /`: double has more than 2 * 24 + 2 bits of precision.
   */
  private static floatBinary(
    op: Exclude<TBinary["op"], "&&" | "||">,
    left: TConstResult,
    right: TConstResult,
  ): TConstResult {
    const origin = (left.kind === "float" ? left : right) as TFloat;
    const typeName =
      left.kind === "float" && right.kind === "float"
        ? ConstantEvaluator.widerFloat(left.typeName, right.typeName)
        : origin.typeName;
    const l = ConstantEvaluator.asFloat(left, typeName);
    const r = ConstantEvaluator.asFloat(right, typeName);
    if (l === null || r === null) {
      return ConstantEvaluator.firstWithoutValue(left, right);
    }
    if (ConstantEvaluator.isComparison(op)) {
      const holds = {
        "<": l < r,
        ">": l > r,
        "<=": l <= r,
        ">=": l >= r,
        "=": l === r,
        "!=": l !== r,
      }[op];
      return { kind: "value", value: holds ? 1n : 0n, typeName: BOOL };
    }
    const float = (value: number): TConstResult => ({
      ...origin,
      value: ConstantEvaluator.heldFloat(value, typeName),
      typeName,
    });
    switch (op) {
      case "+":
        return float(l + r);
      case "-":
        return float(l - r);
      case "*":
        return float(l * r);
      case "/":
        return r === 0
          ? {
              kind: "notConstant",
              reason: "divisionByZero",
              spelling: "",
              at: null,
            }
          : float(l / r);
      default:
        // `%`, a shift or a bitwise operator has no float meaning (E0804)
        return ConstantEvaluator.integral(origin);
    }
  }

  private static widerFloat(
    left: TFloat["typeName"],
    right: TFloat["typeName"],
  ): TFloat["typeName"] {
    return left === "f64" || right === "f64" ? "f64" : "f32";
  }

  /** An operand with a value, converted to `typeName` as C converts it */
  private static asFloat(
    operand: TConstResult,
    typeName: TFloat["typeName"],
  ): number | null {
    if (operand.kind === "float") return operand.value;
    return operand.kind === "value"
      ? ConstantEvaluator.integerAsFloat(operand.value, typeName)
      : null;
  }

  /**
   * A float cast: to a float type it is held there; to `bool` it is whether
   * it is nonzero; to an integer type it saturates as the generated cast
   * does: past a bound it is that bound, by `SaturationRule`, which
   * `SaturatingCast` spells in C (ADR-024), and anything else truncates
   * toward zero
   */
  private static castFloat(typeName: string, operand: TFloat): TConstResult {
    if (typeName === BOOL) {
      return { kind: "value", value: operand.value === 0 ? 0n : 1n, typeName };
    }
    if (TypeCheckUtils.isFloat(typeName)) {
      const held = typeName === "f32" ? "f32" : "f64";
      return {
        ...operand,
        value: ConstantEvaluator.heldFloat(operand.value, held),
        typeName: held,
      };
    }
    const range = TypeCheckUtils.integerRange(typeName);
    if (range === null || Number.isNaN(operand.value)) {
      return ConstantEvaluator.integral(operand);
    }
    const [min, max] = range;
    const bound = (limit: bigint): number =>
      ConstantEvaluator.integerAsFloat(limit, operand.typeName);
    let value: bigint;
    if (SaturationRule.saturatesAbove(operand.value, bound(max))) {
      value = max;
    } else if (SaturationRule.saturatesBelow(operand.value, bound(min))) {
      value = min;
    } else {
      value = BigInt(Math.trunc(operand.value));
    }
    return { kind: "value", value, typeName };
  }

  /** A condition as C tests it: a float is true when it is nonzero */
  private static truth(result: TConstResult): TConstResult {
    return result.kind === "float"
      ? { kind: "value", value: result.value === 0 ? 0n : 1n, typeName: BOOL }
      : result;
  }

  /** A value as a `number`, when a `number` holds it exactly */
  static toNumber(value: bigint): number | undefined {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) &&
      value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : undefined;
  }

  /** A suffixed literal is its type, and must fit it: `300u8` does not */
  private static literal(
    digits: string,
    typeName: string | null,
  ): TConstResult {
    const value = BigInt(digits);
    const integer = ConstantEvaluator.integerType(typeName);
    return integer === null
      ? { kind: "value", value, typeName }
      : ConstantEvaluator.held(value, integer, integer);
  }

  private static cast(typeName: string, operand: TConstResult): TConstResult {
    if (operand.kind === "float") {
      return ConstantEvaluator.castFloat(typeName, operand);
    }
    if (operand.kind !== "value") return operand;
    if (typeName === BOOL) {
      return { kind: "value", value: operand.value === 0n ? 0n : 1n, typeName };
    }
    if (TypeCheckUtils.isFloat(typeName)) {
      const held = typeName === "f32" ? "f32" : "f64";
      return {
        kind: "float",
        value: ConstantEvaluator.integerAsFloat(operand.value, held),
        typeName: held,
        spelling: `(${typeName})`,
        at: null,
      };
    }
    return ConstantEvaluator.held(operand.value, typeName, typeName);
  }

  private static unary(
    op: Extract<TConstExpr, { kind: "unary" }>["op"],
    operand: TConstResult,
    context: string | null,
  ): TConstResult {
    if (operand.kind === "float") {
      if (op === "-") return { ...operand, value: -operand.value };
      if (op === "!") {
        return {
          kind: "value",
          value: operand.value === 0 ? 1n : 0n,
          typeName: BOOL,
        };
      }
      return ConstantEvaluator.integral(operand);
    }
    if (operand.kind !== "value") return operand;
    if (op === "!") {
      return {
        kind: "value",
        value: operand.value === 0n ? 1n : 0n,
        typeName: BOOL,
      };
    }
    // An untyped operand stays untyped, at its context's width (ADR-044)
    const at = ConstantEvaluator.integerType(operand.typeName);
    const width = at ?? ConstantEvaluator.integerType(context) ?? DEFAULT_TYPE;
    if (op === "-") {
      return ConstantEvaluator.held(-operand.value, width, at);
    }
    // `~` flips every bit of the operand's width; an unsigned result is the
    // complement within it, a signed one is two's complement
    const flipped = ~operand.value;
    const value = TypeCheckUtils.isUnsigned(width)
      ? flipped & ((1n << BigInt(TYPE_WIDTH[width])) - 1n)
      : flipped;
    return ConstantEvaluator.held(value, width, at);
  }

  private static ternary(
    expr: Extract<TConstExpr, { kind: "ternary" }>,
    env: IConstantEnvironment,
    context: string | null,
  ): TConstResult {
    const condition = ConstantEvaluator.truth(
      ConstantEvaluator.fold(expr.condition, env),
    );
    if (condition.kind === "foreign") {
      // C evaluates the condition, so either arm may be the size: both must
      // have one, or the whole is not a constant C can evaluate either
      return ConstantEvaluator.foreignUnless(condition, [
        ConstantEvaluator.fold(expr.whenTrue, env, context),
        ConstantEvaluator.fold(expr.whenFalse, env, context),
      ]);
    }
    if (condition.kind !== "value") return condition;
    return ConstantEvaluator.fold(
      condition.value === 0n ? expr.whenFalse : expr.whenTrue,
      env,
      context,
    );
  }

  /**
   * `foreign`, when every other operand has a value or is C's too; otherwise
   * the first that has none. A name only C knows does not make an operand
   * beside it constant (a variable arm of `MACRO ? 4 : n` is still a VLA).
   */
  private static foreignUnless(
    foreign: TConstResult,
    others: ReadonlyArray<TConstResult>,
  ): TConstResult {
    return (
      others.find((o) => o.kind === "notConstant" || o.kind === "overflow") ??
      foreign
    );
  }

  private static binary(
    expr: TBinary,
    env: IConstantEnvironment,
    context: string | null,
  ): TConstResult {
    if (expr.op === "&&" || expr.op === "||") {
      return ConstantEvaluator.logical(expr, env);
    }
    const op = expr.op;
    // A comparison's operands are not written into its context (a `bool`)
    const comparison = ConstantEvaluator.isComparison(op);
    const operandContext = comparison ? null : context;
    const left = ConstantEvaluator.fold(expr.left, env, operandContext);
    const right = ConstantEvaluator.fold(expr.right, env, operandContext);
    if (left.kind === "float" || right.kind === "float") {
      return ConstantEvaluator.floatBinary(op, left, right);
    }
    if (left.kind !== "value" || right.kind !== "value") {
      return ConstantEvaluator.firstWithoutValue(left, right);
    }
    if (comparison) return ConstantEvaluator.compare(op, left, right);
    return ConstantEvaluator.arithmetic(op, left, right, context);
  }

  /** `&&` and `||` evaluate their right operand only when C would */
  private static logical(
    expr: TBinary,
    env: IConstantEnvironment,
  ): TConstResult {
    const left = ConstantEvaluator.truth(
      ConstantEvaluator.fold(expr.left, env),
    );
    if (left.kind === "foreign") {
      return ConstantEvaluator.foreignUnless(left, [
        ConstantEvaluator.fold(expr.right, env),
      ]);
    }
    if (left.kind !== "value") return left;
    const decided = expr.op === "&&" ? left.value === 0n : left.value !== 0n;
    if (decided) {
      return {
        kind: "value",
        value: expr.op === "&&" ? 0n : 1n,
        typeName: BOOL,
      };
    }
    const right = ConstantEvaluator.truth(
      ConstantEvaluator.fold(expr.right, env),
    );
    if (right.kind !== "value") return right;
    return {
      kind: "value",
      value: right.value === 0n ? 0n : 1n,
      typeName: BOOL,
    };
  }

  /**
   * Of two results that are not both values, the one to report: a missing
   * value first (it names what to fix), then an overflow, then a name C knows
   */
  private static firstWithoutValue(
    left: TConstResult,
    right: TConstResult,
  ): TConstResult {
    for (const kind of ["notConstant", "overflow", "foreign"] as const) {
      if (left.kind === kind) return left;
      if (right.kind === kind) return right;
    }
    return left;
  }

  private static isComparison(
    op: Exclude<TBinary["op"], "&&" | "||">,
  ): op is TComparison {
    return COMPARISONS.has(op);
  }

  /**
   * A comparison happens at its operands' type too: an untyped operand takes
   * the other's, and must fit it. `N > -1` with a u32 `N` has no value, as C
   * would compare against UINT_MAX there.
   */
  private static compare(
    op: TComparison,
    leftOperand: TValue,
    rightOperand: TValue,
  ): TConstResult {
    const at = ConstantEvaluator.operationType(
      leftOperand.typeName,
      rightOperand.typeName,
    );
    if (at !== null) {
      for (const operand of [leftOperand, rightOperand]) {
        const fits = ConstantEvaluator.held(operand.value, at, at);
        if (fits.kind !== "value") return fits;
      }
    }
    const left = leftOperand.value;
    const right = rightOperand.value;
    const holds = {
      "<": left < right,
      ">": left > right,
      "<=": left <= right,
      ">=": left >= right,
      "=": left === right,
      "!=": left !== right,
    }[op];
    return { kind: "value", value: holds ? 1n : 0n, typeName: BOOL };
  }

  private static arithmetic(
    op: TArithmetic,
    left: TValue,
    right: TValue,
    context: string | null,
  ): TConstResult {
    const typeName = ConstantEvaluator.operationType(
      left.typeName,
      right.typeName,
    );
    // Untyped operands meet at their context's type, or i32 (ADR-044)
    const width =
      typeName ?? ConstantEvaluator.integerType(context) ?? DEFAULT_TYPE;
    const exact = ConstantEvaluator.apply(op, left.value, right.value, width);
    if (exact.kind !== "value") return exact;
    return ConstantEvaluator.held(exact.value, width, typeName);
  }

  /**
   * The exact result of `left op right`, or why there is none. `width` is the
   * type the operation happens at, which bounds a shift's amount.
   */
  private static apply(
    op: TArithmetic,
    left: bigint,
    right: bigint,
    width: string,
  ): TConstResult {
    const value = (v: bigint): TConstResult => ({
      kind: "value",
      value: v,
      typeName: null,
    });
    switch (op) {
      case "*":
        return value(left * right);
      case "+":
        return value(left + right);
      case "-":
        return value(left - right);
      case "&":
        return value(left & right);
      case "|":
        return value(left | right);
      case "^":
        return value(left ^ right);
      case "/":
      case "%":
        return ConstantEvaluator.divide(op, left, right);
      case "<<":
      case ">>":
        return ConstantEvaluator.shift(op, left, right, width);
    }
  }

  /** C truncates toward zero, and `%` takes the dividend's sign, as `bigint` does */
  private static divide(
    op: "/" | "%",
    left: bigint,
    right: bigint,
  ): TConstResult {
    if (right === 0n) {
      return {
        kind: "notConstant",
        reason: "divisionByZero",
        spelling: "",
        at: null,
      };
    }
    return {
      kind: "value",
      value: op === "/" ? left / right : left % right,
      typeName: null,
    };
  }

  private static shift(
    op: "<<" | ">>",
    left: bigint,
    right: bigint,
    width: string,
  ): TConstResult {
    if (right < 0n || (op === ">>" && left < 0n)) {
      return {
        kind: "notConstant",
        reason: "negativeShift",
        spelling: "",
        at: null,
      };
    }
    if (right >= BigInt(TYPE_WIDTH[width])) {
      return { kind: "overflow", typeName: width };
    }
    return {
      kind: "value",
      value: op === "<<" ? left << right : left >> right,
      typeName: null,
    };
  }

  /**
   * The type an operation happens at: its typed operand's, the wider of two
   * (ADR-024 widens the narrower), or none when neither operand has a type
   */
  private static operationType(
    left: string | null,
    right: string | null,
  ): string | null {
    const l = ConstantEvaluator.integerType(left);
    const r = ConstantEvaluator.integerType(right);
    if (l === null || r === null) return l ?? r;
    return TYPE_WIDTH[r] > TYPE_WIDTH[l] ? r : l;
  }

  private static integerType(typeName: string | null): string | null {
    return typeName !== null && TypeCheckUtils.isInteger(typeName)
      ? typeName
      : null;
  }

  /**
   * `value` when `rangeOf` holds it, typed `typeName`; otherwise the overflow
   * the program would clamp or wrap at
   */
  private static held(
    value: bigint,
    rangeOf: string,
    typeName: string | null,
  ): TConstResult {
    const range = TypeCheckUtils.integerRange(rangeOf);
    if (range !== null && (value < range[0] || value > range[1])) {
      return { kind: "overflow", typeName: rangeOf };
    }
    return { kind: "value", value, typeName };
  }
}

export default ConstantEvaluator;
