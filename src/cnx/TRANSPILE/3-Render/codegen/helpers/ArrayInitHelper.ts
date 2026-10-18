/**
 * ArrayInitHelper - Handles array initialization with size inference and fill-all syntax
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 *
 * Handles:
 * - Array initializers with size inference: u8[] data <- [1, 2, 3]
 * - Fill-all syntax: u8 data[10] <- [0*]
 * - Array size validation
 *
 * Migrated to use CodeGenState instead of constructor DI.
 */

import invariant from "../../../../utils/invariant";
import type TranspileState from "../../../TranspileState";
import type IPlannedWholeArrayWrite from "../../../2-Plan/types/IPlannedWholeArrayWrite";

/**
 * Result from processing array initialization.
 */
interface IArrayInitResult {
  /** Whether this was an array initializer (vs regular expression) */
  isArrayInit: boolean;
  /** The dimension suffix to add to declaration (e.g., "[3]") */
  dimensionSuffix: string;
  /** The final initializer value */
  initValue: string;
}

/**
 * Callbacks required for array initialization.
 * These need CodeGenerator context and cannot be replaced with static state.
 *
 * #1445 box 3: these are THUNKS, and the nodes they used to take are closed
 * over by the caller. This module never read anything off those three
 * contexts -- each was received and handed straight back to the callback the
 * caller supplied -- so naming `ExpressionContext`, `TypeContext` and
 * `ArrayDimensionContext` here bought a dependency on the grammar purely to
 * pass values through.
 *
 * Thunks rather than pre-generated strings, deliberately: this helper decides
 * whether, and in what order, each renders.
 */
interface IArrayInitCallbacks {
  /** Generate the initializer expression's code */
  generateExpression: () => string;
  /** Generate the declaration's array dimension suffix */
  generateArrayDimensions: () => string;
}

/**
 * Handles array initialization with size inference and fill-all syntax.
 */
class ArrayInitHelper {
  /**
   * Process array initialization expression.
   * Returns null if not an array initializer pattern.
   *
   * @param name - Variable name
   * @param hasEmptyArrayDim - Whether any dimension is empty (for inference)
   * @param declaredSize - First dimension size if explicit, null otherwise
   * @param callbacks - Callbacks to CodeGenerator methods
   */
  static processArrayInit(
    name: string,
    hasEmptyArrayDim: boolean,
    declaredSize: number | null,
    callbacks: IArrayInitCallbacks,
    state: TranspileState,
  ): IArrayInitResult | null {
    // Reset and generate initializer
    state.resetArrayInitTracking();

    const initValue = callbacks.generateExpression();

    // Check if it was an array initializer
    if (!state.wasArrayInit()) {
      return null;
    }

    const dimensionSuffix = hasEmptyArrayDim
      ? ArrayInitHelper._processSizeInference(name, declaredSize, state)
      : ArrayInitHelper._processExplicitSize(declaredSize, callbacks, state);

    const finalInitValue = ArrayInitHelper.expandFillAll(
      initValue,
      declaredSize,
      state,
    );

    return { isArrayInit: true, dimensionSuffix, initValue: finalInitValue };
  }

  /**
   * An inferred size (`u8[] data <- [1, 2, 3]`) is the declaration's: 1.3
   * counted the list and 1.4 settled it, and the `.h` states that number.
   *
   * #1664 box 3: this used to count the elements it had just rendered -- a
   * second derivation of one fact, which agreed with the header only while
   * nothing else shaped the suffix. For `u8[][3] n` it emitted `n[2]` against
   * the header's `n[2][3]` (#1822, now E0892 in pass 1.2). The rendered count
   * survives as the check that the two still agree.
   */
  private static _processSizeInference(
    name: string,
    declaredSize: number | null,
    state: TranspileState,
  ): string {
    // #1322: E0876 rejects the fill-all form on an inferred size in pass 1.2
    // (ADR-035); an inferred size is counted from a list.
    invariant(
      state.lastArrayFillValue === undefined,
      `an inferred array size comes from a list -- E0876 rejects the fill-all ` +
        `form [${state.lastArrayFillValue}*] on '${name}' in pass 1.2, before this runs`,
    );
    ArrayInitHelper.assertInferredSize(name, declaredSize, state);
    return `[${declaredSize}]`;
  }

  /**
   * The rendered list has exactly the elements 1.3 counted for an omitted
   * size. Every declaration renderer that emits an inferred size asks this,
   * right after rendering the list (#1824 review: the scope-member renderer
   * had no check at all).
   */
  static assertInferredSize(
    name: string,
    declaredSize: number | null,
    state: TranspileState,
  ): asserts declaredSize is number {
    invariant(
      declaredSize !== null,
      `an inferred size is its declaration's count, and '${name}' has none ` +
        `here -- a declaration fact that never reached render`,
    );
    invariant(
      state.lastArrayInitCount === declaredSize,
      `an inferred size is its declaration's -- 1.3 counted [${declaredSize}] ` +
        `for '${name}' but ${state.lastArrayInitCount} element(s) rendered`,
    );
  }

  /**
   * Process explicit array size with validation
   */
  private static _processExplicitSize(
    declaredSize: number | null,
    callbacks: IArrayInitCallbacks,
    state: TranspileState,
  ): string {
    const dimensionSuffix = callbacks.generateArrayDimensions();

    // #1322: the element count is E0866's in pass 2.1 (ADR-035); an
    // initializer shorter than the declaration would be emitted as C's
    // partial initialization, which MISRA 9.3 forbids, so it is asserted.
    invariant(
      declaredSize === null ||
        state.lastArrayFillValue !== undefined ||
        state.lastArrayInitCount === declaredSize,
      `an array initializer has the declared number of elements -- E0866 rejects ` +
        `${state.lastArrayInitCount} for [${declaredSize}] in pass 2.1, before this runs`,
    );

    return dimensionSuffix;
  }

  /**
   * A temporary of a whole array's own type, initialized by its rendered
   * value as a declaration is (#1782, #2157): C can neither assign an array
   * nor pass a list for one. Called right after the value renders, so a
   * fill-all is read off that render.
   */
  static temporaryArray(
    array: IPlannedWholeArrayWrite,
    renderedValue: string,
    state: TranspileState,
  ): { readonly name: string; readonly declaration: string } {
    const leading = array.dimensions[0];
    const init = array.fromList
      ? ArrayInitHelper.expandFillAll(
          renderedValue,
          typeof leading === "number" ? leading : null,
          state,
        )
      : renderedValue;
    const shape = array.dimensions.map((size) => `[${size}]`).join("");
    const name = state.getNextTempVarName();
    return {
      name,
      declaration: `const ${array.elementCType} ${name}${shape} = ${init};`,
    };
  }

  /**
   * Expand fill-all syntax (e.g., [0*] with size 5 -> {0, 0, 0, 0, 0}), read
   * off the list's render just before. A declaration's list and a whole-array
   * assignment's temporary (#1782) are both expanded here.
   */
  static expandFillAll(
    initValue: string,
    declaredSize: number | null,
    state: TranspileState,
  ): string {
    if (state.lastArrayFillValue === undefined || declaredSize === null) {
      return initValue;
    }

    const fillVal = state.lastArrayFillValue;
    // C handles {0} correctly, no need to expand
    if (fillVal === "0") {
      return initValue;
    }

    const elements = new Array<string>(declaredSize).fill(fillVal);
    return `{${elements.join(", ")}}`;
  }
}

export default ArrayInitHelper;
