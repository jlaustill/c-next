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
    // Reset array init tracking
    this.deps.arrayInitState.lastArrayInitCount = 0;
    this.deps.arrayInitState.lastArrayFillValue = undefined;

    // Generate the initializer expression (may be array initializer)
    const typeName = this.deps.getTypeName(typeCtx);
    const savedExpectedType = this.deps.getExpectedType();
    this.deps.setExpectedType(typeName);

    const initValue = this.deps.generateExpression(expression);

    this.deps.setExpectedType(savedExpectedType);

    // Check if it was an array initializer
    if (
      this.deps.arrayInitState.lastArrayInitCount === 0 &&
      this.deps.arrayInitState.lastArrayFillValue === undefined
    ) {
      // Not an array initializer
      return null;
    }

    // Track as local array
    this.deps.localArrays.add(name);

    let dimensionSuffix = "";

    if (hasEmptyArrayDim) {
      // Size inference: u8 data[] <- [1, 2, 3]
      if (this.deps.arrayInitState.lastArrayFillValue !== undefined) {
        throw new Error(
          `Error: Fill-all syntax [${this.deps.arrayInitState.lastArrayFillValue}*] requires explicit array size`,
        );
      }
      dimensionSuffix = `[${this.deps.arrayInitState.lastArrayInitCount}]`;

      // Update type registry with inferred size for .length support
      const existingType = this.deps.typeRegistry.get(name);
      if (existingType) {
        existingType.arrayDimensions = [
          this.deps.arrayInitState.lastArrayInitCount,
        ];
      }
    } else {
      // Explicit size - generate all dimensions
      dimensionSuffix = this.deps.generateArrayDimensions(arrayDims);

      // Validate size matches if not using fill-all
      if (
        declaredSize !== null &&
        this.deps.arrayInitState.lastArrayFillValue === undefined
      ) {
        if (this.deps.arrayInitState.lastArrayInitCount !== declaredSize) {
          throw new Error(
            `Error: Array size mismatch - declared [${declaredSize}] but got ${this.deps.arrayInitState.lastArrayInitCount} elements`,
          );
        }
      }
    }

    // Handle fill-all syntax expansion
    let finalInitValue = initValue;
    if (
      this.deps.arrayInitState.lastArrayFillValue !== undefined &&
      declaredSize !== null
    ) {
      const fillVal = this.deps.arrayInitState.lastArrayFillValue;
      // Only expand if the fill value is not "0" (C handles {0} correctly)
      if (fillVal !== "0") {
        const elements = Array(declaredSize).fill(fillVal);
        finalInitValue = `{${elements.join(", ")}}`;
      }
    }

    return {
      isArrayInit: true,
      dimensionSuffix,
      initValue: finalInitValue,
    };
  }
}

export default ArrayInitHelper;
