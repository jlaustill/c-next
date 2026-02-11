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

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import CodeGenState from "../../../state/CodeGenState.js";

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
 */
interface IArrayInitCallbacks {
  /** Generate expression code */
  generateExpression: (ctx: Parser.ExpressionContext) => string;
  /** Get type name from type context */
  getTypeName: (ctx: Parser.TypeContext) => string;
  /** Generate array dimensions */
  generateArrayDimensions: (dims: Parser.ArrayDimensionContext[]) => string;
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
   * @param typeCtx - Type context
   * @param expression - Initializer expression
   * @param arrayDims - Array dimension contexts
   * @param hasEmptyArrayDim - Whether any dimension is empty (for inference)
   * @param declaredSize - First dimension size if explicit, null otherwise
   * @param callbacks - Callbacks to CodeGenerator methods
   */
  static processArrayInit(
    name: string,
    typeCtx: Parser.TypeContext,
    expression: Parser.ExpressionContext,
    arrayDims: Parser.ArrayDimensionContext[],
    hasEmptyArrayDim: boolean,
    declaredSize: number | null,
    callbacks: IArrayInitCallbacks,
  ): IArrayInitResult | null {
    // Reset and generate initializer
    CodeGenState.lastArrayInitCount = 0;
    CodeGenState.lastArrayFillValue = undefined;

    const initValue = ArrayInitHelper._generateArrayInitValue(
      typeCtx,
      expression,
      callbacks,
    );

    // Check if it was an array initializer
    if (!ArrayInitHelper._isArrayInitializer()) {
      return null;
    }

    CodeGenState.localArrays.add(name);

    const dimensionSuffix = hasEmptyArrayDim
      ? ArrayInitHelper._processSizeInference(name)
      : ArrayInitHelper._processExplicitSize(
          arrayDims,
          declaredSize,
          callbacks,
        );

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
    typeCtx: Parser.TypeContext,
    expression: Parser.ExpressionContext,
    callbacks: IArrayInitCallbacks,
  ): string {
    const typeName = callbacks.getTypeName(typeCtx);
    const savedExpectedType = CodeGenState.expectedType;
    CodeGenState.expectedType = typeName;
    const initValue = callbacks.generateExpression(expression);
    CodeGenState.expectedType = savedExpectedType;
    return initValue;
  }

  /**
   * Check if the last expression was an array initializer
   */
  private static _isArrayInitializer(): boolean {
    return (
      CodeGenState.lastArrayInitCount > 0 ||
      CodeGenState.lastArrayFillValue !== undefined
    );
  }

  /**
   * Process size inference for empty array dimension (u8 data[] <- [1, 2, 3])
   */
  private static _processSizeInference(name: string): string {
    if (CodeGenState.lastArrayFillValue !== undefined) {
      throw new Error(
        `Error: Fill-all syntax [${CodeGenState.lastArrayFillValue}*] requires explicit array size`,
      );
    }

    // Update type registry with inferred size for .length support
    const existingType = CodeGenState.typeRegistry.get(name);
    if (existingType) {
      existingType.arrayDimensions = [CodeGenState.lastArrayInitCount];
    }

    return `[${CodeGenState.lastArrayInitCount}]`;
  }

  /**
   * Process explicit array size with validation
   */
  private static _processExplicitSize(
    arrayDims: Parser.ArrayDimensionContext[],
    declaredSize: number | null,
    callbacks: IArrayInitCallbacks,
  ): string {
    const dimensionSuffix = callbacks.generateArrayDimensions(arrayDims);

    // Validate size matches if not using fill-all
    if (
      declaredSize !== null &&
      CodeGenState.lastArrayFillValue === undefined &&
      CodeGenState.lastArrayInitCount !== declaredSize
    ) {
      throw new Error(
        `Error: Array size mismatch - declared [${declaredSize}] but got ${CodeGenState.lastArrayInitCount} elements`,
      );
    }

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
