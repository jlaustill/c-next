/**
 * StringDeclHelper - Generates string variable declarations
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 * Migrated to use CodeGenState instead of constructor DI.
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
import StringUtils from "../../../../utils/StringUtils.js";
import CodeGenState from "../../../state/CodeGenState.js";

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
 * Callbacks required for string declaration generation.
 * These need CodeGenerator context and cannot be replaced with static state.
 */
interface IStringDeclCallbacks {
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
  /** Get string expression capacity */
  getStringExprCapacity: (exprCode: string) => number | null;
  /** Request string include */
  requireStringInclude: () => void;
}

/**
 * Generates string variable declarations in C.
 */
class StringDeclHelper {
  /**
   * Generate string declaration if the type is a string type.
   * Returns { handled: false } if not a string type.
   */
  static generateStringDecl(
    typeCtx: Parser.TypeContext,
    name: string,
    expression: Parser.ExpressionContext | null,
    arrayDims: Parser.ArrayDimensionContext[],
    modifiers: IStringDeclModifiers,
    isConst: boolean,
    callbacks: IStringDeclCallbacks,
  ): IStringDeclResult {
    // Issue #1029: Check for string array in arrayType syntax first
    // For `string<32>[4] items`, the structure is: arrayType -> stringType arrayTypeDimension+
    const arrayTypeCtx = typeCtx.arrayType?.();
    if (arrayTypeCtx?.stringType?.()) {
      return StringDeclHelper._generateStringArrayFromArrayType(
        name,
        arrayTypeCtx,
        expression,
        arrayDims,
        modifiers,
        isConst,
        callbacks,
      );
    }

    const stringCtx = typeCtx.stringType();
    if (!stringCtx) {
      return { code: "", handled: false };
    }

    const intLiteral = stringCtx.INTEGER_LITERAL();

    if (intLiteral) {
      // Bounded string with explicit capacity
      const capacity = Number.parseInt(intLiteral.getText(), 10);
      return StringDeclHelper._generateBoundedStringDecl(
        name,
        capacity,
        expression,
        arrayDims,
        modifiers,
        isConst,
        callbacks,
      );
    } else {
      // Unsized string - requires const and literal
      return StringDeclHelper._generateUnsizedStringDecl(
        name,
        expression,
        modifiers,
        isConst,
        callbacks,
      );
    }
  }

  /**
   * Issue #1029: Generate string array declaration from arrayType syntax.
   * Handles: string<32>[4] items -> char items[4][33] = {0};
   */
  private static _generateStringArrayFromArrayType(
    name: string,
    arrayTypeCtx: Parser.ArrayTypeContext,
    expression: Parser.ExpressionContext | null,
    trailingArrayDims: Parser.ArrayDimensionContext[],
    modifiers: IStringDeclModifiers,
    isConst: boolean,
    callbacks: IStringDeclCallbacks,
  ): IStringDeclResult {
    const stringCtx = arrayTypeCtx.stringType()!;
    const intLiteral = stringCtx.INTEGER_LITERAL();
    if (!intLiteral) {
      // Unsized string array - not supported
      throw new Error(
        "Error: String arrays require explicit capacity, e.g., string<64>[4]",
      );
    }

    const capacity = Number.parseInt(intLiteral.getText(), 10);
    // Ensure string.h is included for strncpy operations
    callbacks.requireStringInclude();

    const {
      extern,
      const: constMod,
      atomic,
      volatile: volatileMod,
    } = modifiers;

    // Build array dimensions from arrayType (e.g., [4] from string<32>[4])
    let arrayDimStr = "";
    for (const dim of arrayTypeCtx.arrayTypeDimension()) {
      const sizeExpr = dim.expression();
      if (sizeExpr) {
        arrayDimStr += `[${sizeExpr.getText()}]`;
      } else {
        arrayDimStr += "[]";
      }
    }

    // Add any trailing dimensions from variable declaration
    arrayDimStr += callbacks.generateArrayDimensions(trailingArrayDims);

    // Add string capacity dimension
    arrayDimStr += `[${capacity + 1}]`;

    let decl = `${extern}${constMod}${atomic}${volatileMod}char ${name}${arrayDimStr}`;

    // Track as local array
    CodeGenState.localArrays.add(name);

    // No initializer - zero-initialize
    if (!expression) {
      return { code: `${decl} = {0};`, handled: true };
    }

    // Reset array init tracking and generate initializer
    CodeGenState.lastArrayInitCount = 0;
    CodeGenState.lastArrayFillValue = undefined;
    const initValue = callbacks.generateExpression(expression);

    // Check if it was an array initializer
    const isArrayInit =
      CodeGenState.lastArrayInitCount > 0 ||
      CodeGenState.lastArrayFillValue !== undefined;

    if (!isArrayInit) {
      throw new Error(
        `Error: String array initialization from variables not supported`,
      );
    }

    // Validate element count if declared size is available
    const declaredSize =
      StringDeclHelper._getArrayTypeDeclaredSize(arrayTypeCtx);
    if (declaredSize !== null) {
      const isFillAll = CodeGenState.lastArrayFillValue !== undefined;
      const elementCount = CodeGenState.lastArrayInitCount;

      if (!isFillAll && elementCount !== declaredSize) {
        throw new Error(
          `Error: Array size mismatch - declared [${declaredSize}] but got ${elementCount} elements`,
        );
      }
    }

    // Handle fill-all expansion if needed
    const finalInitValue = StringDeclHelper._expandFillAllForArrayType(
      initValue,
      arrayTypeCtx,
    );

    // MISRA C:2012 Rules 9.3/9.4 - String literals don't fill all inner array bytes,
    // but C standard guarantees zero-initialization of remaining elements
    const suppression =
      "// cppcheck-suppress misra-c2012-9.3\n// cppcheck-suppress misra-c2012-9.4\n";
    return {
      code: `${suppression}${decl} = ${finalInitValue};`,
      handled: true,
    };
  }

  /**
   * Get the numeric size from the first arrayTypeDimension, or null if not numeric.
   * Used by arrayType-based string arrays (string<N>[M]).
   */
  private static _getArrayTypeDeclaredSize(
    arrayTypeCtx: Parser.ArrayTypeContext,
  ): number | null {
    const dims = arrayTypeCtx.arrayTypeDimension();
    if (dims.length === 0) {
      return null;
    }
    const firstDimExpr = dims[0].expression();
    return StringDeclHelper._parseNumericSize(firstDimExpr);
  }

  /**
   * Expand fill-all syntax for arrayType-based string arrays.
   * Delegates to the common fill-all expansion logic with size from arrayType.
   */
  private static _expandFillAllForArrayType(
    initValue: string,
    arrayTypeCtx: Parser.ArrayTypeContext,
  ): string {
    const declaredSize =
      StringDeclHelper._getArrayTypeDeclaredSize(arrayTypeCtx);
    return StringDeclHelper._expandFillAll(initValue, declaredSize);
  }

  /**
   * Common fill-all expansion logic shared between arrayType and arrayDimension paths.
   */
  private static _expandFillAll(
    initValue: string,
    declaredSize: number | null,
  ): string {
    const fillVal = CodeGenState.lastArrayFillValue;
    if (fillVal === undefined) {
      return initValue;
    }

    // Empty string fill doesn't need expansion (C handles {""} correctly)
    if (fillVal === '""') {
      return initValue;
    }

    if (declaredSize === null) {
      return initValue;
    }

    const elements = new Array<string>(declaredSize).fill(fillVal);
    return `{${elements.join(", ")}}`;
  }

  /**
   * Parse a numeric size from an expression, or return null if not numeric.
   * Shared helper to eliminate duplicate parsing logic.
   */
  private static _parseNumericSize(
    expr: Parser.ExpressionContext | null | undefined,
  ): number | null {
    if (!expr) {
      return null;
    }
    const sizeText = expr.getText();
    if (!/^\d+$/.exec(sizeText)) {
      return null;
    }
    return Number.parseInt(sizeText, 10);
  }

  /**
   * Generate bounded string declaration (string<N>).
   */
  private static _generateBoundedStringDecl(
    name: string,
    capacity: number,
    expression: Parser.ExpressionContext | null,
    arrayDims: Parser.ArrayDimensionContext[],
    modifiers: IStringDeclModifiers,
    isConst: boolean,
    callbacks: IStringDeclCallbacks,
  ): IStringDeclResult {
    const { extern, const: constMod } = modifiers;

    // String arrays: string<64> arr[4] -> char arr[4][65] = {0};
    if (arrayDims.length > 0) {
      return StringDeclHelper._generateStringArrayDecl(
        name,
        capacity,
        expression,
        arrayDims,
        modifiers,
        isConst,
        callbacks,
      );
    }

    // Simple bounded string without initializer
    if (!expression) {
      return {
        code: `${extern}${constMod}char ${name}[${capacity + 1}] = "";`,
        handled: true,
      };
    }

    return StringDeclHelper._generateBoundedStringWithInit(
      name,
      capacity,
      expression,
      extern,
      constMod,
      callbacks,
    );
  }

  /**
   * Generate bounded string with initializer expression
   */
  private static _generateBoundedStringWithInit(
    name: string,
    capacity: number,
    expression: Parser.ExpressionContext,
    extern: string,
    constMod: string,
    callbacks: IStringDeclCallbacks,
  ): IStringDeclResult {
    // Check for string concatenation
    const concatOps = callbacks.getStringConcatOperands(expression);
    if (concatOps) {
      return StringDeclHelper._generateConcatDecl(
        name,
        capacity,
        concatOps,
        constMod,
      );
    }

    // Check for substring extraction
    const substringOps = callbacks.getSubstringOperands(expression);
    if (substringOps) {
      return StringDeclHelper._generateSubstringDecl(
        name,
        capacity,
        substringOps,
        constMod,
      );
    }

    // Validate and check if it's a literal or variable
    const exprText = expression.getText();
    const isLiteral = StringDeclHelper._validateStringInit(
      exprText,
      capacity,
      callbacks,
    );

    if (isLiteral) {
      // String literal: can use direct initialization
      const code = `${extern}${constMod}char ${name}[${capacity + 1}] = ${callbacks.generateExpression(expression)};`;
      return { code, handled: true };
    }

    // String variable: need strcpy (cannot use array initialization in C)
    // Issue #1030: string-to-string initialization
    if (!CodeGenState.inFunctionBody) {
      throw new Error(
        `Error: String initialization from variable cannot be used at global scope. ` +
          `Move the declaration inside a function, or use an empty initializer and assign later.`,
      );
    }

    const srcExpr = callbacks.generateExpression(expression);
    const indent = FormatUtils.indent(CodeGenState.indentLevel);
    const lines: string[] = [];
    lines.push(
      `${constMod}char ${name}[${capacity + 1}] = "";`,
      `${indent}strcpy(${name}, ${srcExpr});`,
    );
    return { code: lines.join("\n"), handled: true };
  }

  /**
   * Validate string initialization (literal length and variable capacity)
   * Returns true if the expression is a string literal, false if it's a variable.
   */
  private static _validateStringInit(
    exprText: string,
    capacity: number,
    callbacks: IStringDeclCallbacks,
  ): boolean {
    // Validate string literal fits capacity
    if (exprText.startsWith('"') && exprText.endsWith('"')) {
      const content = StringUtils.literalLength(exprText);
      if (content > capacity) {
        throw new Error(
          `Error: String literal (${content} chars) exceeds string<${capacity}> capacity`,
        );
      }
      return true; // Is a literal
    }

    // Check for string variable assignment
    const srcCapacity = callbacks.getStringExprCapacity(exprText);
    if (srcCapacity !== null && srcCapacity > capacity) {
      throw new Error(
        `Error: Cannot assign string<${srcCapacity}> to string<${capacity}> (potential truncation)`,
      );
    }
    return false; // Is a variable (not a literal)
  }

  /**
   * Generate string array declaration.
   */
  private static _generateStringArrayDecl(
    name: string,
    capacity: number,
    expression: Parser.ExpressionContext | null,
    arrayDims: Parser.ArrayDimensionContext[],
    modifiers: IStringDeclModifiers,
    isConst: boolean,
    callbacks: IStringDeclCallbacks,
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
      decl += callbacks.generateArrayDimensions(arrayDims);
      decl += `[${capacity + 1}]`;
      return { code: `${decl} = {0};`, handled: true };
    }

    // Reset array init tracking and generate initializer
    CodeGenState.lastArrayInitCount = 0;
    CodeGenState.lastArrayFillValue = undefined;
    const initValue = callbacks.generateExpression(expression);

    // Check if it was an array initializer
    const isArrayInit =
      CodeGenState.lastArrayInitCount > 0 ||
      CodeGenState.lastArrayFillValue !== undefined;

    if (!isArrayInit) {
      throw new Error(
        `Error: String array initialization from variables not supported`,
      );
    }

    // Track as local array
    CodeGenState.localArrays.add(name);

    const hasEmptyArrayDim = arrayDims.some((dim) => !dim.expression());
    if (hasEmptyArrayDim) {
      decl += StringDeclHelper._handleSizeInference(name, capacity, isConst);
    } else {
      decl += StringDeclHelper._handleExplicitSize(arrayDims, callbacks);
    }

    decl += `[${capacity + 1}]`; // String capacity + null terminator

    const finalInitValue = StringDeclHelper._expandFillAllIfNeeded(
      initValue,
      arrayDims,
    );
    // MISRA C:2012 Rules 9.3/9.4 - String literals don't fill all inner array bytes,
    // but C standard guarantees zero-initialization of remaining elements
    const suppression =
      "// cppcheck-suppress misra-c2012-9.3\n// cppcheck-suppress misra-c2012-9.4\n";
    return {
      code: `${suppression}${decl} = ${finalInitValue};`,
      handled: true,
    };
  }

  /**
   * Handle size inference for empty array dimension.
   * Returns the dimension string to append to declaration.
   */
  private static _handleSizeInference(
    name: string,
    capacity: number,
    isConst: boolean,
  ): string {
    const fillValue = CodeGenState.lastArrayFillValue;
    if (fillValue !== undefined) {
      throw new Error(
        `Error: Fill-all syntax [${fillValue}*] requires explicit array size`,
      );
    }

    const arraySize = CodeGenState.lastArrayInitCount;

    // Update type registry with inferred size
    CodeGenState.setVariableTypeInfo(name, {
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
  private static _handleExplicitSize(
    arrayDims: Parser.ArrayDimensionContext[],
    callbacks: IStringDeclCallbacks,
  ): string {
    const declaredSize = StringDeclHelper._getFirstDimNumericSize(arrayDims);

    // Validate element count matches declared size (only for non-fill-all)
    if (declaredSize !== null) {
      const isFillAll = CodeGenState.lastArrayFillValue !== undefined;
      const elementCount = CodeGenState.lastArrayInitCount;

      if (!isFillAll && elementCount !== declaredSize) {
        throw new Error(
          `Error: Array size mismatch - declared [${declaredSize}] but got ${elementCount} elements`,
        );
      }
    }

    return callbacks.generateArrayDimensions(arrayDims);
  }

  /**
   * Expand fill-all syntax if needed.
   * ["Hello"*] with size 3 -> {"Hello", "Hello", "Hello"}
   * Delegates to the common fill-all expansion logic with size from arrayDimension.
   */
  private static _expandFillAllIfNeeded(
    initValue: string,
    arrayDims: Parser.ArrayDimensionContext[],
  ): string {
    const declaredSize = StringDeclHelper._getFirstDimNumericSize(arrayDims);
    return StringDeclHelper._expandFillAll(initValue, declaredSize);
  }

  /**
   * Get the numeric size from the first array dimension, or null if not numeric.
   * Used by arrayDimension-based string arrays (string<N> arr[M]).
   */
  private static _getFirstDimNumericSize(
    arrayDims: Parser.ArrayDimensionContext[],
  ): number | null {
    const firstDimExpr = arrayDims[0]?.expression();
    return StringDeclHelper._parseNumericSize(firstDimExpr);
  }

  /**
   * Generate string concatenation declaration.
   */
  private static _generateConcatDecl(
    name: string,
    capacity: number,
    concatOps: IStringConcatOps,
    constMod: string,
  ): IStringDeclResult {
    // String concatenation requires runtime function calls (strncpy, strncat)
    // which cannot exist at global scope in C
    if (!CodeGenState.inFunctionBody) {
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
    const indent = FormatUtils.indent(CodeGenState.indentLevel);
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
  private static _generateSubstringDecl(
    name: string,
    capacity: number,
    substringOps: ISubstringOps,
    constMod: string,
  ): IStringDeclResult {
    // Substring extraction requires runtime function calls (strncpy)
    // which cannot exist at global scope in C
    if (!CodeGenState.inFunctionBody) {
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
    const indent = FormatUtils.indent(CodeGenState.indentLevel);
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
  private static _generateUnsizedStringDecl(
    name: string,
    expression: Parser.ExpressionContext | null,
    modifiers: IStringDeclModifiers,
    isConst: boolean,
    callbacks: IStringDeclCallbacks,
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
    const inferredCapacity = StringUtils.literalLength(exprText);
    callbacks.requireStringInclude();

    // Register in type registry with inferred capacity
    CodeGenState.setVariableTypeInfo(name, {
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
