/**
 * ArrayInitHelper - Handles array initialization with size inference and fill-all syntax
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 *
 * Handles:
 * - Array initializers with size inference: u8 data[] <- [1, 2, 3]
 * - Fill-all syntax: u8 data[10] <- [0*]
 * - Array size validation
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import TTypeInfo from "../types/TTypeInfo.js";

/**
 * Array initialization tracking state.
 */
interface IArrayInitState {
  lastArrayInitCount: number;
  lastArrayFillValue: string | undefined;
}

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
 * Dependencies required for array initialization.
 */
interface IArrayInitHelperDeps {
  /** Type registry for updating inferred dimensions */
  typeRegistry: Map<string, TTypeInfo>;
  /** Local arrays set for tracking */
  localArrays: Set<string>;
  /** Array initialization tracking state */
  arrayInitState: IArrayInitState;
  /** Get/set expected type context */
  getExpectedType: () => string | null;
  setExpectedType: (type: string | null) => void;
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
  private readonly deps: IArrayInitHelperDeps;

  constructor(deps: IArrayInitHelperDeps) {
    this.deps = deps;
  }

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
   */
  processArrayInit(
    name: string,
    typeCtx: Parser.TypeContext,
    expression: Parser.ExpressionContext,
    arrayDims: Parser.ArrayDimensionContext[],
    hasEmptyArrayDim: boolean,
    declaredSize: number | null,
  ): IArrayInitResult | null {
    // Reset and generate initializer
    this.deps.arrayInitState.lastArrayInitCount = 0;
    this.deps.arrayInitState.lastArrayFillValue = undefined;

    const initValue = this._generateArrayInitValue(typeCtx, expression);

    // Check if it was an array initializer
    if (!this._isArrayInitializer()) {
      return null;
    }

    this.deps.localArrays.add(name);

    const dimensionSuffix = hasEmptyArrayDim
      ? this._processSizeInference(name)
      : this._processExplicitSize(arrayDims, declaredSize);

    const finalInitValue = this._expandFillAllSyntax(initValue, declaredSize);

    return { isArrayInit: true, dimensionSuffix, initValue: finalInitValue };
  }

  /**
   * Generate the array initializer value with proper expected type
   */
  private _generateArrayInitValue(
    typeCtx: Parser.TypeContext,
    expression: Parser.ExpressionContext,
  ): string {
    const typeName = this.deps.getTypeName(typeCtx);
    const savedExpectedType = this.deps.getExpectedType();
    this.deps.setExpectedType(typeName);
    const initValue = this.deps.generateExpression(expression);
    this.deps.setExpectedType(savedExpectedType);
    return initValue;
  }

  /**
   * Check if the last expression was an array initializer
   */
  private _isArrayInitializer(): boolean {
    return (
      this.deps.arrayInitState.lastArrayInitCount > 0 ||
      this.deps.arrayInitState.lastArrayFillValue !== undefined
    );
  }

  /**
   * Process size inference for empty array dimension (u8 data[] <- [1, 2, 3])
   */
  private _processSizeInference(name: string): string {
    if (this.deps.arrayInitState.lastArrayFillValue !== undefined) {
      throw new Error(
        `Error: Fill-all syntax [${this.deps.arrayInitState.lastArrayFillValue}*] requires explicit array size`,
      );
    }

    // Update type registry with inferred size for .length support
    const existingType = this.deps.typeRegistry.get(name);
    if (existingType) {
      existingType.arrayDimensions = [
        this.deps.arrayInitState.lastArrayInitCount,
      ];
    }

    return `[${this.deps.arrayInitState.lastArrayInitCount}]`;
  }

  /**
   * Process explicit array size with validation
   */
  private _processExplicitSize(
    arrayDims: Parser.ArrayDimensionContext[],
    declaredSize: number | null,
  ): string {
    const dimensionSuffix = this.deps.generateArrayDimensions(arrayDims);

    // Validate size matches if not using fill-all
    if (
      declaredSize !== null &&
      this.deps.arrayInitState.lastArrayFillValue === undefined &&
      this.deps.arrayInitState.lastArrayInitCount !== declaredSize
    ) {
      throw new Error(
        `Error: Array size mismatch - declared [${declaredSize}] but got ${this.deps.arrayInitState.lastArrayInitCount} elements`,
      );
    }

    return dimensionSuffix;
  }

  /**
   * Expand fill-all syntax (e.g., [0*] with size 5 -> {0, 0, 0, 0, 0})
   */
  private _expandFillAllSyntax(
    initValue: string,
    declaredSize: number | null,
  ): string {
    if (
      this.deps.arrayInitState.lastArrayFillValue === undefined ||
      declaredSize === null
    ) {
      return initValue;
    }

    const fillVal = this.deps.arrayInitState.lastArrayFillValue;
    // C handles {0} correctly, no need to expand
    if (fillVal === "0") {
      return initValue;
    }

    const elements = new Array<string>(declaredSize).fill(fillVal);
    return `{${elements.join(", ")}}`;
  }
}

export default ArrayInitHelper;
