/**
 * StringDeclHelper - Generates string variable declarations
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 *
 * Handles all string-related declaration patterns:
 * - Bounded strings: string<64> name
 * - String arrays: string<64> arr[4]
 * - String concatenation: string<64> result <- str1 + str2
 * - Substring extraction: string<64> sub <- str.substring(0, 5)
 * - Unsized const strings: const string name <- "literal"
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import FormatUtils from "../../../../utils/FormatUtils.js";
import TTypeInfo from "../types/TTypeInfo.js";

/** C null terminator character literal for generated code */
const C_NULL_CHAR = String.raw`'\0'`;

/**
 * String concatenation operands extracted from expression.
 */
interface IStringConcatOps {
  left: string;
  right: string;
  leftCapacity: number;
  rightCapacity: number;
}

/**
 * Substring extraction operands extracted from expression.
 */
interface ISubstringOps {
  source: string;
  start: string;
  length: string;
  sourceCapacity: number;
}

/**
 * Array initialization tracking state.
 */
interface IArrayInitState {
  lastArrayInitCount: number;
  lastArrayFillValue: string | undefined;
}

/**
 * Dependencies required for string declaration generation.
 */
interface IStringDeclHelperDeps {
  /** Type registry for looking up variable types */
  typeRegistry: Map<string, TTypeInfo>;
  /** Get whether currently inside a function body */
  getInFunctionBody: () => boolean;
  /** Get current indentation level */
  getIndentLevel: () => number;
  /** Array initialization tracking */
  arrayInitState: IArrayInitState;
  /** Local arrays set */
  localArrays: Set<string>;
  /** Generate expression code */
  generateExpression: (ctx: Parser.ExpressionContext) => string;
  /** Generate array dimensions */
  generateArrayDimensions: (dims: Parser.ArrayDimensionContext[]) => string;
  /** Get string concatenation operands */
  getStringConcatOperands: (
    ctx: Parser.ExpressionContext,
  ) => IStringConcatOps | null;
  /** Get substring extraction operands */
  getSubstringOperands: (ctx: Parser.ExpressionContext) => ISubstringOps | null;
  /** Get string literal length */
  getStringLiteralLength: (literal: string) => number;
  /** Get string expression capacity */
  getStringExprCapacity: (exprCode: string) => number | null;
  /** Request string include */
  requireStringInclude: () => void;
}

/**
 * Declaration modifiers for string variable declarations.
 */
interface IStringDeclModifiers {
  extern: string;
  const: string;
  atomic: string;
  volatile: string;
}

/**
 * Result from generating a string declaration.
 */
interface IStringDeclResult {
  /** The generated C code */
  code: string;
  /** Whether the declaration was handled (false = not a string type) */
  handled: boolean;
}

/**
 * Generates string variable declarations in C.
 */
class StringDeclHelper {
  private readonly deps: IStringDeclHelperDeps;

  constructor(deps: IStringDeclHelperDeps) {
    this.deps = deps;
  }

  /**
   * Generate string declaration if the type is a string type.
   * Returns { handled: false } if not a string type.
   */
  generateStringDecl(
    typeCtx: Parser.TypeContext,
    name: string,
    expression: Parser.ExpressionContext | null,
    arrayDims: Parser.ArrayDimensionContext[],
    modifiers: IStringDeclModifiers,
    isConst: boolean,
  ): IStringDeclResult {
    const stringCtx = typeCtx.stringType();
    if (!stringCtx) {
      return { code: "", handled: false };
    }

    const intLiteral = stringCtx.INTEGER_LITERAL();

    if (intLiteral) {
      // Bounded string with explicit capacity
      const capacity = Number.parseInt(intLiteral.getText(), 10);
      return this.generateBoundedStringDecl(
        name,
        capacity,
        expression,
        arrayDims,
        modifiers,
        isConst,
      );
    } else {
      // Unsized string - requires const and literal
      return this.generateUnsizedStringDecl(
        name,
        expression,
        modifiers,
        isConst,
      );
    }
  }

  /**
   * Generate bounded string declaration (string<N>).
   */
  private generateBoundedStringDecl(
    name: string,
    capacity: number,
    expression: Parser.ExpressionContext | null,
    arrayDims: Parser.ArrayDimensionContext[],
    modifiers: IStringDeclModifiers,
    isConst: boolean,
  ): IStringDeclResult {
    const { extern, const: constMod } = modifiers;

    // String arrays: string<64> arr[4] -> char arr[4][65] = {0};
    if (arrayDims.length > 0) {
      return this.generateStringArrayDecl(
        name,
        capacity,
        expression,
        arrayDims,
        modifiers,
        isConst,
      );
    }

    // Simple bounded string without initializer
    if (!expression) {
      return {
        code: `${extern}${constMod}char ${name}[${capacity + 1}] = "";`,
        handled: true,
      };
    }

    return this._generateBoundedStringWithInit(
      name,
      capacity,
      expression,
      extern,
      constMod,
    );
  }

  /**
   * Generate bounded string with initializer expression
   */
  private _generateBoundedStringWithInit(
    name: string,
    capacity: number,
    expression: Parser.ExpressionContext,
    extern: string,
    constMod: string,
  ): IStringDeclResult {
    // Check for string concatenation
    const concatOps = this.deps.getStringConcatOperands(expression);
    if (concatOps) {
      return this.generateConcatDecl(name, capacity, concatOps, constMod);
    }

    // Check for substring extraction
    const substringOps = this.deps.getSubstringOperands(expression);
    if (substringOps) {
      return this.generateSubstringDecl(name, capacity, substringOps, constMod);
    }

    // Validate and generate simple assignment
    this._validateStringInit(expression.getText(), capacity);
    const code = `${extern}${constMod}char ${name}[${capacity + 1}] = ${this.deps.generateExpression(expression)};`;
    return { code, handled: true };
  }

  /**
   * Validate string initialization (literal length and variable capacity)
   */
  private _validateStringInit(exprText: string, capacity: number): void {
    // Validate string literal fits capacity
    if (exprText.startsWith('"') && exprText.endsWith('"')) {
      const content = this.deps.getStringLiteralLength(exprText);
      if (content > capacity) {
        throw new Error(
          `Error: String literal (${content} chars) exceeds string<${capacity}> capacity`,
        );
      }
    }

    // Check for string variable assignment
    const srcCapacity = this.deps.getStringExprCapacity(exprText);
    if (srcCapacity !== null && srcCapacity > capacity) {
      throw new Error(
        `Error: Cannot assign string<${srcCapacity}> to string<${capacity}> (potential truncation)`,
      );
    }
  }

  /**
   * Generate string array declaration.
   */
  private generateStringArrayDecl(
    name: string,
    capacity: number,
    expression: Parser.ExpressionContext | null,
    arrayDims: Parser.ArrayDimensionContext[],
    modifiers: IStringDeclModifiers,
    isConst: boolean,
  ): IStringDeclResult {
    const {
      extern,
      const: constMod,
      atomic,
      volatile: volatileMod,
    } = modifiers;
    let decl = `${extern}${constMod}${atomic}${volatileMod}char ${name}`;

    // No initializer - zero-initialize
    if (!expression) {
      decl += this.deps.generateArrayDimensions(arrayDims);
      decl += `[${capacity + 1}]`;
      return { code: `${decl} = {0};`, handled: true };
    }

    // Reset array init tracking and generate initializer
    this.deps.arrayInitState.lastArrayInitCount = 0;
    this.deps.arrayInitState.lastArrayFillValue = undefined;
    const initValue = this.deps.generateExpression(expression);

    // Check if it was an array initializer
    const isArrayInit =
      this.deps.arrayInitState.lastArrayInitCount > 0 ||
      this.deps.arrayInitState.lastArrayFillValue !== undefined;

    if (!isArrayInit) {
      throw new Error(
        `Error: String array initialization from variables not supported`,
      );
    }

    // Track as local array
    this.deps.localArrays.add(name);

    const hasEmptyArrayDim = arrayDims.some((dim) => !dim.expression());
    if (hasEmptyArrayDim) {
      decl += this._handleSizeInference(name, capacity, isConst);
    } else {
      decl += this._handleExplicitSize(arrayDims);
    }

    decl += `[${capacity + 1}]`; // String capacity + null terminator

    const finalInitValue = this._expandFillAllIfNeeded(initValue, arrayDims);
    return { code: `${decl} = ${finalInitValue};`, handled: true };
  }

  /**
   * Handle size inference for empty array dimension.
   * Returns the dimension string to append to declaration.
   */
  private _handleSizeInference(
    name: string,
    capacity: number,
    isConst: boolean,
  ): string {
    const fillValue = this.deps.arrayInitState.lastArrayFillValue;
    if (fillValue !== undefined) {
      throw new Error(
        `Error: Fill-all syntax [${fillValue}*] requires explicit array size`,
      );
    }

    const arraySize = this.deps.arrayInitState.lastArrayInitCount;

    // Update type registry with inferred size
    this.deps.typeRegistry.set(name, {
      baseType: "char",
      bitWidth: 8,
      isArray: true,
      arrayDimensions: [arraySize, capacity + 1],
      isConst,
      isString: true,
      stringCapacity: capacity,
    });

    return `[${arraySize}]`;
  }

  /**
   * Handle explicit array size with validation.
   * Returns the dimension string to append to declaration.
   */
  private _handleExplicitSize(
    arrayDims: Parser.ArrayDimensionContext[],
  ): string {
    const declaredSize = this._getFirstDimNumericSize(arrayDims);

    // Validate element count matches declared size (only for non-fill-all)
    if (declaredSize !== null) {
      const isFillAll =
        this.deps.arrayInitState.lastArrayFillValue !== undefined;
      const elementCount = this.deps.arrayInitState.lastArrayInitCount;

      if (!isFillAll && elementCount !== declaredSize) {
        throw new Error(
          `Error: Array size mismatch - declared [${declaredSize}] but got ${elementCount} elements`,
        );
      }
    }

    return this.deps.generateArrayDimensions(arrayDims);
  }

  /**
   * Expand fill-all syntax if needed.
   * ["Hello"*] with size 3 -> {"Hello", "Hello", "Hello"}
   */
  private _expandFillAllIfNeeded(
    initValue: string,
    arrayDims: Parser.ArrayDimensionContext[],
  ): string {
    const fillVal = this.deps.arrayInitState.lastArrayFillValue;
    if (fillVal === undefined) {
      return initValue;
    }

    // Empty string fill doesn't need expansion (C handles {""} correctly)
    if (fillVal === '""') {
      return initValue;
    }

    const declaredSize = this._getFirstDimNumericSize(arrayDims);
    if (declaredSize === null) {
      return initValue;
    }

    const elements = new Array<string>(declaredSize).fill(fillVal);
    return `{${elements.join(", ")}}`;
  }

  /**
   * Get the numeric size from the first array dimension, or null if not numeric.
   */
  private _getFirstDimNumericSize(
    arrayDims: Parser.ArrayDimensionContext[],
  ): number | null {
    const firstDimExpr = arrayDims[0]?.expression();
    if (!firstDimExpr) {
      return null;
    }

    const sizeText = firstDimExpr.getText();
    if (!/^\d+$/.exec(sizeText)) {
      return null;
    }

    return Number.parseInt(sizeText, 10);
  }

  /**
   * Generate string concatenation declaration.
   */
  private generateConcatDecl(
    name: string,
    capacity: number,
    concatOps: IStringConcatOps,
    constMod: string,
  ): IStringDeclResult {
    // String concatenation requires runtime function calls (strncpy, strncat)
    // which cannot exist at global scope in C
    if (!this.deps.getInFunctionBody()) {
      throw new Error(
        `Error: String concatenation cannot be used at global scope. ` +
          `Move the declaration inside a function.`,
      );
    }

    // Validate capacity: dest >= left + right
    const requiredCapacity = concatOps.leftCapacity + concatOps.rightCapacity;
    if (requiredCapacity > capacity) {
      throw new Error(
        `Error: String concatenation requires capacity ${requiredCapacity}, but string<${capacity}> only has ${capacity}`,
      );
    }

    // Generate safe concatenation code
    const indent = FormatUtils.indent(this.deps.getIndentLevel());
    const lines: string[] = [];
    lines.push(
      `${constMod}char ${name}[${capacity + 1}] = "";`,
      `${indent}strncpy(${name}, ${concatOps.left}, ${capacity});`,
      `${indent}strncat(${name}, ${concatOps.right}, ${capacity} - strlen(${name}));`,
      `${indent}${name}[${capacity}] = ${C_NULL_CHAR};`,
    );
    return { code: lines.join("\n"), handled: true };
  }

  /**
   * Generate substring extraction declaration.
   */
  private generateSubstringDecl(
    name: string,
    capacity: number,
    substringOps: ISubstringOps,
    constMod: string,
  ): IStringDeclResult {
    // Substring extraction requires runtime function calls (strncpy)
    // which cannot exist at global scope in C
    if (!this.deps.getInFunctionBody()) {
      throw new Error(
        `Error: Substring extraction cannot be used at global scope. ` +
          `Move the declaration inside a function.`,
      );
    }

    // For compile-time validation, we need numeric literals
    const startNum = Number.parseInt(substringOps.start, 10);
    const lengthNum = Number.parseInt(substringOps.length, 10);

    // Only validate bounds if both start and length are compile-time constants
    if (!Number.isNaN(startNum) && !Number.isNaN(lengthNum)) {
      // Bounds check: start + length <= sourceCapacity
      if (startNum + lengthNum > substringOps.sourceCapacity) {
        throw new Error(
          `Error: Substring bounds [${startNum}, ${lengthNum}] exceed source string<${substringOps.sourceCapacity}> capacity`,
        );
      }
    }

    // Validate destination capacity can hold the substring
    if (!Number.isNaN(lengthNum) && lengthNum > capacity) {
      throw new Error(
        `Error: Substring length ${lengthNum} exceeds destination string<${capacity}> capacity`,
      );
    }

    // Generate safe substring extraction code
    const indent = FormatUtils.indent(this.deps.getIndentLevel());
    const lines: string[] = [];
    lines.push(
      `${constMod}char ${name}[${capacity + 1}] = "";`,
      `${indent}strncpy(${name}, ${substringOps.source} + ${substringOps.start}, ${substringOps.length});`,
      `${indent}${name}[${substringOps.length}] = ${C_NULL_CHAR};`,
    );
    return { code: lines.join("\n"), handled: true };
  }

  /**
   * Generate unsized const string declaration.
   */
  private generateUnsizedStringDecl(
    name: string,
    expression: Parser.ExpressionContext | null,
    modifiers: IStringDeclModifiers,
    isConst: boolean,
  ): IStringDeclResult {
    if (!isConst) {
      throw new Error(
        "Error: Non-const string requires explicit capacity, e.g., string<64>",
      );
    }

    if (!expression) {
      throw new Error(
        "Error: const string requires initializer for capacity inference",
      );
    }

    const exprText = expression.getText();
    if (!exprText.startsWith('"') || !exprText.endsWith('"')) {
      throw new Error(
        "Error: const string requires string literal for capacity inference",
      );
    }

    // Infer capacity from literal length
    const inferredCapacity = this.deps.getStringLiteralLength(exprText);
    this.deps.requireStringInclude();

    // Register in type registry with inferred capacity
    this.deps.typeRegistry.set(name, {
      baseType: "char",
      bitWidth: 8,
      isArray: true,
      arrayDimensions: [inferredCapacity + 1],
      isConst: true,
      isString: true,
      stringCapacity: inferredCapacity,
    });

    const code = `${modifiers.extern}const char ${name}[${inferredCapacity + 1}] = ${exprText};`;
    return { code, handled: true };
  }
}

export default StringDeclHelper;
