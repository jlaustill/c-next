/**
 * AutoConstUpdater
 * Issue #588: Extracted from Transpiler to logic layer
 *
 * Updates symbol parameters with auto-const information based on code generation
 * analysis. Parameters that are not modified in function bodies can be marked
 * as auto-const, enabling correct const qualifier generation in headers.
 */

import ISymbol from "../../../utils/types/ISymbol";
import ESymbolKind from "../../../utils/types/ESymbolKind";

/**
 * Utility class for updating symbol parameters with auto-const information.
 *
 * In C-Next, struct parameters are passed by pointer by default. If a parameter
 * is never modified, it can be marked as `const` in the generated C code.
 * This class encapsulates the logic to determine which parameters qualify.
 */
class AutoConstUpdater {
  /**
   * Update symbols with auto-const information.
   *
   * For each function symbol, checks if its parameters were unmodified during
   * code generation and marks them as auto-const if they meet the criteria.
   *
   * @param symbols - Array of symbols to update (typically from a single file)
   * @param unmodifiedParams - Map of function name to set of unmodified param names
   * @param knownEnums - Set of known enum type names (these don't get pointer semantics)
   */
  static update(
    symbols: ISymbol[],
    unmodifiedParams: ReadonlyMap<string, ReadonlySet<string>>,
    knownEnums: ReadonlySet<string>,
  ): void {
    for (const symbol of symbols) {
      if (symbol.kind !== ESymbolKind.Function || !symbol.parameters) {
        continue;
      }

      const unmodified = unmodifiedParams.get(symbol.name);
      if (!unmodified) continue;

      // Update each parameter's isAutoConst
      for (const param of symbol.parameters) {
        if (
          AutoConstUpdater.shouldMarkAutoConst(param, unmodified, knownEnums)
        ) {
          param.isAutoConst = true;
        }
      }
    }
  }

  /**
   * Determine if a parameter should be marked as auto-const.
   *
   * A parameter qualifies for auto-const if:
   * 1. It was not modified in the function body
   * 2. It would get pointer semantics in generated C (not a primitive/enum)
   *
   * @param param - The parameter to check
   * @param unmodified - Set of unmodified parameter names for this function
   * @param knownEnums - Set of known enum type names
   * @returns true if the parameter should be marked as auto-const
   */
  static shouldMarkAutoConst(
    param: NonNullable<ISymbol["parameters"]>[number],
    unmodified: ReadonlySet<string>,
    knownEnums: ReadonlySet<string>,
  ): boolean {
    // Parameter must be unmodified
    if (!unmodified.has(param.name)) {
      return false;
    }

    // Check if parameter would get pointer semantics
    const isPointerParam =
      !param.isConst &&
      !param.isArray &&
      param.type !== "f32" &&
      param.type !== "f64" &&
      param.type !== "ISR" &&
      !knownEnums.has(param.type);

    // Array params also become pointers in C
    const isArrayParam = param.isArray && !param.isConst;

    return isPointerParam || isArrayParam;
  }
}

export default AutoConstUpdater;
