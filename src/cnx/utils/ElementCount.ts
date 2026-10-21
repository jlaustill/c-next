/**
 * #1283 review: how many elements an array dimension has, as C-Next must know
 * it to spell each element (ADR-029 gives every element of a callback array
 * its default function, and every element of a struct array its default;
 * ADR-017 gives every element of an enum array its zero enumerator).
 *
 * The dimension is folded the way 1.4 folds every constant, reading each
 * header macro C-Next can (`ConstantFold.readingHeaderMacros`).
 */
import type IProgram from "../types/IProgram";
import type TConstExpr from "../types/TConstExpr";
import type TElementCount from "../types/TElementCount";
import ConstantEvaluator from "./ConstantEvaluator";
import ConstantFold from "./ConstantFold";

class ElementCount {
  /** The count, or null when there is none (unreadable, or not positive) */
  static of(
    expr: TConstExpr,
    program: IProgram,
    sourceFile: string,
  ): number | null {
    const count = ElementCount.read(expr, program, sourceFile);
    return count.kind === "count" ? count.value : null;
  }

  /** The count, or why there is none */
  static read(
    expr: TConstExpr,
    program: IProgram,
    sourceFile: string,
  ): TElementCount {
    const result = ConstantEvaluator.evaluate(
      expr,
      ConstantFold.readingHeaderMacros(program, sourceFile),
    );
    if (result.kind !== "value") return { kind: "unreadable" };
    if (result.value <= 0n) return { kind: "notPositive", value: result.value };
    const value = ConstantEvaluator.toNumber(result.value);
    return value === undefined || value === null
      ? { kind: "unreadable" }
      : { kind: "count", value };
  }
}

export default ElementCount;
