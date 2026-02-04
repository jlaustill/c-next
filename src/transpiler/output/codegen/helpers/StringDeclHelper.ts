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
    modifiers: {
      extern: string;
      const: string;
      atomic: string;
      volatile: string;
    },
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
    modifiers: {
      extern: string;
      const: string;
      atomic: string;
      volatile: string;
    },
    isConst: boolean,
  ): IStringDeclResult {
    // Note: atomic and volatile only used for string arrays, not simple strings
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

    // Simple bounded string
    if (expression) {
      const exprText = expression.getText();

      // Check for string concatenation
      const concatOps = this.deps.getStringConcatOperands(expression);
      if (concatOps) {
        return this.generateConcatDecl(name, capacity, concatOps, constMod);
      }

      // Check for substring extraction
      const substringOps = this.deps.getSubstringOperands(expression);
      if (substringOps) {
        return this.generateSubstringDecl(
          name,
          capacity,
          substringOps,
          constMod,
        );
      }

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

      const code = `${extern}${constMod}char ${name}[${capacity + 1}] = ${this.deps.generateExpression(expression)};`;
      return { code, handled: true };
    } else {
      // Empty string initialization
      const code = `${extern}${constMod}char ${name}[${capacity + 1}] = "";`;
      return { code, handled: true };
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
    modifiers: {
      extern: string;
      const: string;
      atomic: string;
      volatile: string;
    },
    isConst: boolean,
  ): IStringDeclResult {
    const {
      extern,
      const: constMod,
      atomic,
      volatile: volatileMod,
    } = modifiers;
    let decl = `${extern}${constMod}${atomic}${volatileMod}char ${name}`;

    if (expression) {
      // Reset array init tracking
      this.deps.arrayInitState.lastArrayInitCount = 0;
      this.deps.arrayInitState.lastArrayFillValue = undefined;

      // Generate the initializer expression
      const initValue = this.deps.generateExpression(expression);

      // Check if it was an array initializer
      if (
        this.deps.arrayInitState.lastArrayInitCount > 0 ||
        this.deps.arrayInitState.lastArrayFillValue !== undefined
      ) {
        const hasEmptyArrayDim = arrayDims.some((dim) => !dim.expression());

        // Track as local array
        this.deps.localArrays.add(name);

        let arraySize: number;
        if (hasEmptyArrayDim) {
          // Size inference: string<10> labels[] <- ["One", "Two"]
          if (this.deps.arrayInitState.lastArrayFillValue !== undefined) {
            throw new Error(
              `Error: Fill-all syntax [${this.deps.arrayInitState.lastArrayFillValue}*] requires explicit array size`,
            );
          }
          arraySize = this.deps.arrayInitState.lastArrayInitCount;
          decl += `[${arraySize}]`;

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
        } else {
          // Explicit size: string<10> labels[3] <- ["One", "Two", "Three"]
          decl += this.deps.generateArrayDimensions(arrayDims);

          // Validate element count matches declared size
          const firstDimExpr = arrayDims[0].expression();
          if (firstDimExpr) {
            const sizeText = firstDimExpr.getText();
            if (/^\d+$/.exec(sizeText)) {
              const declaredSize = Number.parseInt(sizeText, 10);
              if (
                this.deps.arrayInitState.lastArrayFillValue === undefined &&
                this.deps.arrayInitState.lastArrayInitCount !== declaredSize
              ) {
                throw new Error(
                  `Error: Array size mismatch - declared [${declaredSize}] but got ${this.deps.arrayInitState.lastArrayInitCount} elements`,
                );
              }
            }
          }
        }

        decl += `[${capacity + 1}]`; // String capacity + null terminator

        // Handle fill-all syntax: ["Hello"*] -> {"Hello", "Hello", "Hello"}
        let finalInitValue = initValue;
        if (this.deps.arrayInitState.lastArrayFillValue !== undefined) {
          const firstDimExpr = arrayDims[0].expression();
          if (firstDimExpr) {
            const sizeText = firstDimExpr.getText();
            if (/^\d+$/.exec(sizeText)) {
              const declaredSize = Number.parseInt(sizeText, 10);
              const fillVal = this.deps.arrayInitState.lastArrayFillValue;
              // Only expand if not empty string (C handles {""} correctly for zeroing)
              if (fillVal !== '""') {
                const elements = new Array<string>(declaredSize).fill(fillVal);
                finalInitValue = `{${elements.join(", ")}}`;
              }
            }
          }
        }

        return { code: `${decl} = ${finalInitValue};`, handled: true };
      }

      // Non-array-initializer expression (e.g., variable assignment) not supported
      throw new Error(
        `Error: String array initialization from variables not supported`,
      );
    }

    // No initializer - zero-initialize
    decl += this.deps.generateArrayDimensions(arrayDims);
    decl += `[${capacity + 1}]`;
    return { code: `${decl} = {0};`, handled: true };
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
    modifiers: {
      extern: string;
      const: string;
      atomic: string;
      volatile: string;
    },
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
