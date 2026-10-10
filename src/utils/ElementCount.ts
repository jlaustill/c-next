/**
 * #1283 review: how many elements an array dimension has, as C-Next must know
 * it to spell each element (ADR-029 gives every element of a callback array
 * its default function, and every element of a struct array its default;
 * ADR-017 gives every element of an enum array its zero enumerator).
 *
 * The dimension is folded the way 1.4 folds every constant, except that a
 * macro from an included C header whose C replacement C-Next can read
 * (`HeaderMacros`: plain integer arithmetic) answers that value. Folding alone leaves it to C
 * (`foreign`), which is right for the dimension's spelling -- it stays
 * `N_HANDLERS` (#1127) -- but not for counting.
 */
import invariant from "./invariant";
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
    const folded = ConstantFold.environment(program, sourceFile);
    // A header macro's value depends on the target's `int` (#1283 review)
    const target = program.target();
    invariant(
      target.kind === "resolved",
      "Stage 3b halts a run whose target did not resolve",
    );
    const intBits = target.description.int_bits;
    const result = ConstantEvaluator.evaluate(expr, {
      ...folded,
      valueOf: (name) => {
        const bound = folded.valueOf(name);
        if (bound.kind !== "foreign" || name.root !== null) return bound;
        if (name.path.length !== 1) return bound;
        const macro = program.headerMacro(sourceFile, name.path[0]);
        const value =
          macro?.kind === "integer"
            ? (macro.valueByIntBits.get(intBits) ?? null)
            : null;
        return value === null
          ? bound
          : { kind: "value", value: BigInt(value), typeName: null };
      },
    });
    if (result.kind !== "value") return { kind: "unreadable" };
    if (result.value <= 0n) return { kind: "notPositive", value: result.value };
    const value = ConstantEvaluator.toNumber(result.value);
    return value === undefined || value === null
      ? { kind: "unreadable" }
      : { kind: "count", value };
  }
}

export default ElementCount;
