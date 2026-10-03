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
import type TConstExpr from "../types/TConstExpr";
import type TConstResult from "../types/TConstResult";
import type IConstantEnvironment from "./types/IConstantEnvironment";

type TBinary = Extract<TConstExpr, { kind: "binary" }>;
type TValue = Extract<TConstResult, { kind: "value" }>;
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
  static evaluate(expr: TConstExpr, env: IConstantEnvironment): TConstResult {
    switch (expr.kind) {
      case "literal":
        return {
          kind: "value",
          value: BigInt(expr.digits),
          typeName: expr.typeName,
        };
      case "name":
        return env.valueOf(expr);
      case "sizeof":
        return ConstantEvaluator.sizeOf(expr.typeName);
      case "cast":
        return ConstantEvaluator.cast(
          expr.typeName,
          ConstantEvaluator.evaluate(expr.operand, env),
        );
      case "unary":
        return ConstantEvaluator.unary(
          expr.op,
          ConstantEvaluator.evaluate(expr.operand, env),
        );
      case "binary":
        return ConstantEvaluator.binary(expr, env);
      case "ternary":
        return ConstantEvaluator.ternary(expr, env);
      case "other":
        return {
          kind: "notConstant",
          reason: expr.what,
          spelling: expr.spelling,
          at: expr.at,
        };
    }
  }

  /** A value as a `number`, when a `number` holds it exactly */
  static toNumber(value: bigint): number | undefined {
    return value >= BigInt(Number.MIN_SAFE_INTEGER) &&
      value <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : undefined;
  }

  /** A primitive's size in bytes; any other type's is the target's to decide */
  private static sizeOf(typeName: string): TConstResult {
    const width = TYPE_WIDTH[typeName];
    return width === undefined
      ? { kind: "foreign" }
      : { kind: "value", value: BigInt(width / 8), typeName: null };
  }

  private static cast(typeName: string, operand: TConstResult): TConstResult {
    if (operand.kind !== "value") return operand;
    if (typeName === BOOL) {
      return { kind: "value", value: operand.value === 0n ? 0n : 1n, typeName };
    }
    if (TypeCheckUtils.isFloat(typeName)) {
      return {
        kind: "notConstant",
        reason: "float",
        spelling: `(${typeName})`,
        at: null,
      };
    }
    return ConstantEvaluator.held(operand.value, typeName, typeName);
  }

  private static unary(
    op: Extract<TConstExpr, { kind: "unary" }>["op"],
    operand: TConstResult,
  ): TConstResult {
    if (operand.kind !== "value") return operand;
    if (op === "!") {
      return {
        kind: "value",
        value: operand.value === 0n ? 1n : 0n,
        typeName: BOOL,
      };
    }
    const at = ConstantEvaluator.integerType(operand.typeName);
    if (op === "-") {
      return ConstantEvaluator.held(-operand.value, at ?? DEFAULT_TYPE, at);
    }
    // `~` flips every bit of the operand's width; an unsigned result is the
    // complement within it, a signed or untyped one is two's complement
    const flipped = ~operand.value;
    const value =
      at !== null && TypeCheckUtils.isUnsigned(at)
        ? flipped & ((1n << BigInt(TYPE_WIDTH[at])) - 1n)
        : flipped;
    return ConstantEvaluator.held(value, at ?? DEFAULT_TYPE, at);
  }

  private static ternary(
    expr: Extract<TConstExpr, { kind: "ternary" }>,
    env: IConstantEnvironment,
  ): TConstResult {
    const condition = ConstantEvaluator.evaluate(expr.condition, env);
    if (condition.kind !== "value") return condition;
    return ConstantEvaluator.evaluate(
      condition.value === 0n ? expr.whenFalse : expr.whenTrue,
      env,
    );
  }

  private static binary(
    expr: TBinary,
    env: IConstantEnvironment,
  ): TConstResult {
    if (expr.op === "&&" || expr.op === "||") {
      return ConstantEvaluator.logical(expr, env);
    }
    const left = ConstantEvaluator.evaluate(expr.left, env);
    const right = ConstantEvaluator.evaluate(expr.right, env);
    if (left.kind !== "value" || right.kind !== "value") {
      return ConstantEvaluator.firstWithoutValue(left, right);
    }
    const op = expr.op;
    if (ConstantEvaluator.isComparison(op)) {
      return ConstantEvaluator.compare(op, left.value, right.value);
    }
    return ConstantEvaluator.arithmetic(op, left, right);
  }

  /** `&&` and `||` evaluate their right operand only when C would */
  private static logical(
    expr: TBinary,
    env: IConstantEnvironment,
  ): TConstResult {
    const left = ConstantEvaluator.evaluate(expr.left, env);
    if (left.kind !== "value") return left;
    const decided = expr.op === "&&" ? left.value === 0n : left.value !== 0n;
    if (decided) {
      return {
        kind: "value",
        value: expr.op === "&&" ? 0n : 1n,
        typeName: BOOL,
      };
    }
    const right = ConstantEvaluator.evaluate(expr.right, env);
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

  private static compare(op: TComparison, left: bigint, right: bigint): TValue {
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
  ): TConstResult {
    const typeName = ConstantEvaluator.operationType(
      left.typeName,
      right.typeName,
    );
    const width = typeName ?? DEFAULT_TYPE;
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
