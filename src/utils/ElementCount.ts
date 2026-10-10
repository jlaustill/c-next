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
import type IProgram from "../types/IProgram";
import type TConstExpr from "../types/TConstExpr";
import ConstantEvaluator from "./ConstantEvaluator";
import ConstantFold from "./ConstantFold";

class ElementCount {
  /** The count, or null when C-Next cannot read one */
  static of(
    expr: TConstExpr,
    program: IProgram,
    sourceFile: string,
  ): number | null {
    const folded = ConstantFold.environment(program, sourceFile);
    const result = ConstantEvaluator.evaluate(expr, {
      ...folded,
      valueOf: (name) => {
        const bound = folded.valueOf(name);
        if (bound.kind !== "foreign" || name.root !== null) return bound;
        if (name.path.length !== 1) return bound;
        const macro = program.headerMacro(sourceFile, name.path[0]);
        return macro?.kind === "integer" && macro.value !== null
          ? { kind: "value", value: BigInt(macro.value), typeName: null }
          : bound;
      },
    });
    if (result.kind !== "value" || result.value < 0n) return null;
    return ConstantEvaluator.toNumber(result.value) ?? null;
  }
}

export default ElementCount;
