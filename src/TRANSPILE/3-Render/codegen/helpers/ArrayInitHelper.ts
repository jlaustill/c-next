/**
 * ArrayInitHelper - Handles array initialization with size inference and fill-all syntax
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 *
 * Handles:
 * - Array initializers with size inference: u8 data[] <- [1, 2, 3]
 * - Fill-all syntax: u8 data[10] <- [0*]
 * - Array size validation
 *
 * Migrated to use CodeGenState instead of constructor DI.
 */

import CodeGenState from "../../../../transpiler/state/CodeGenState";
import invariant from "../../../../utils/invariant";

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
 * Thunks rather than pre-generated strings, deliberately. `getTypeName` must
 * run BEFORE `generateExpression`, and `generateExpression` must run INSIDE
 * the `CodeGenState.withExpectedType` window that this helper opens -- that
 * window is the whole point of `_generateArrayInitValue`. Passing strings
 * would evaluate them at the call site, outside it.
 */
interface IArrayInitCallbacks {
  /** Generate the initializer expression's code */
  generateExpression: () => string;
  /** Get the declared type's C name */
  getTypeName: () => string;
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
  ): IArrayInitResult | null {
    // Reset and generate initializer
    CodeGenState.resetArrayInitTracking();

    const initValue = ArrayInitHelper._generateArrayInitValue(callbacks);

    // Check if it was an array initializer
    if (!CodeGenState.wasArrayInit()) {
      return null;
    }

    CodeGenState.localArrays.add(name);

    const dimensionSuffix = hasEmptyArrayDim
      ? ArrayInitHelper._processSizeInference(name)
      : ArrayInitHelper._processExplicitSize(declaredSize, callbacks);

    const finalInitValue = ArrayInitHelper._expandFillAllSyntax(
      initValue,
      declaredSize,
    );

    return { isArrayInit: true, dimensionSuffix, initValue: finalInitValue };
  }

  /**
   * Generate the array initializer value with proper expected type
   */
  private static _generateArrayInitValue(
    callbacks: IArrayInitCallbacks,
  ): string {
    const typeName = callbacks.getTypeName();
    return CodeGenState.withExpectedType(typeName, () =>
      callbacks.generateExpression(),
    );
  }

  /**
   * Process size inference for empty array dimension (u8 data[] <- [1, 2, 3])
   */
  private static _processSizeInference(name: string): string {
    // #1322: E0876 rejects the fill-all form on an inferred size in pass 2.1
    // (ADR-035); the count below is the only size this path can infer.
    invariant(
      CodeGenState.lastArrayFillValue === undefined,
      `an inferred array size comes from a list -- E0876 rejects the fill-all ` +
        `form [${CodeGenState.lastArrayFillValue}*] on '${name}' in pass 2.1, before this runs`,
    );

    // Update type registry with inferred size for .length support
    const existingType = CodeGenState.getVariableTypeInfo(name);
    if (existingType) {
      existingType.arrayDimensions = [CodeGenState.lastArrayInitCount];
      CodeGenState.setVariableTypeInfo(name, existingType);
    }

    return `[${CodeGenState.lastArrayInitCount}]`;
  }

  /**
   * Process explicit array size with validation
   */
  private static _processExplicitSize(
    declaredSize: number | null,
    callbacks: IArrayInitCallbacks,
  ): string {
    const dimensionSuffix = callbacks.generateArrayDimensions();

    // #1322: the element count is E0866's in pass 2.1 (ADR-035); an
    // initializer shorter than the declaration would be emitted as C's
    // partial initialization, which MISRA 9.3 forbids, so it is asserted.
    invariant(
      declaredSize === null ||
        CodeGenState.lastArrayFillValue !== undefined ||
        CodeGenState.lastArrayInitCount === declaredSize,
      `an array initializer has the declared number of elements -- E0866 rejects ` +
        `${CodeGenState.lastArrayInitCount} for [${declaredSize}] in pass 2.1, before this runs`,
    );

    return dimensionSuffix;
  }

  /**
   * Expand fill-all syntax (e.g., [0*] with size 5 -> {0, 0, 0, 0, 0})
   */
  private static _expandFillAllSyntax(
    initValue: string,
    declaredSize: number | null,
  ): string {
    if (
      CodeGenState.lastArrayFillValue === undefined ||
      declaredSize === null
    ) {
      return initValue;
    }

    const fillVal = CodeGenState.lastArrayFillValue;
    // C handles {0} correctly, no need to expand
    if (fillVal === "0") {
      return initValue;
    }

    const elements = new Array<string>(declaredSize).fill(fillVal);
    return `{${elements.join(", ")}}`;
  }
}

export default ArrayInitHelper;
