/**
 * VariableDeclHelper - Generates variable declarations
 *
 * Issue #792: Extracted from CodeGenerator to reduce file size.
 *
 * Handles:
 * - Variable declarations with initializers
 * - Array declarations with dimension parsing
 * - Array syntax validation (C-Next style vs C-style)
 * - Integer initializer validation
 * - C++ constructor declarations
 *
 * Uses CodeGenState for shared state and callback interfaces for
 * CodeGenerator dependencies.
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import CodeGenState from "../../../state/CodeGenState.js";
import TypeResolver from "../TypeResolver.js";
import ArrayInitHelper from "./ArrayInitHelper.js";
import EnumAssignmentValidator from "./EnumAssignmentValidator.js";
import IntegerLiteralValidator from "./IntegerLiteralValidator.js";
import StringDeclHelper from "./StringDeclHelper.js";
import VariableModifierBuilder from "./VariableModifierBuilder.js";

/**
 * Callbacks for integer validation in variable declarations.
 */
interface IIntegerValidationCallbacks {
  /** Get expression type for validation */
  getExpressionType: (ctx: Parser.ExpressionContext) => string | null;
}

/**
 * Callbacks for C++ class assignment finalization.
 */
interface ICppAssignmentCallbacks {
  /** Get type name from type context */
  getTypeName: (ctx: Parser.TypeContext) => string;
}

/**
 * Callbacks for array type dimension generation.
 */
interface IArrayTypeDimCallbacks {
  /** Try to evaluate expression as constant value */
  tryEvaluateConstant: (ctx: Parser.ExpressionContext) => number | undefined;
  /** Generate expression code */
  generateExpression: (ctx: Parser.ExpressionContext) => string;
}

/**
 * Callbacks for array declaration handling.
 */
interface IArrayDeclCallbacks {
  /** Generate expression code */
  generateExpression: (ctx: Parser.ExpressionContext) => string;
  /** Get type name from type context */
  getTypeName: (ctx: Parser.TypeContext) => string;
  /** Generate array dimensions from contexts */
  generateArrayDimensions: (dims: Parser.ArrayDimensionContext[]) => string;
  /** Try to evaluate expression as constant value */
  tryEvaluateConstant: (ctx: Parser.ExpressionContext) => number | undefined;
}

/**
 * Callbacks for variable initializer generation.
 */
interface IVariableInitCallbacks {
  /** Generate expression code */
  generateExpression: (ctx: Parser.ExpressionContext) => string;
  /** Get type name from type context */
  getTypeName: (ctx: Parser.TypeContext) => string;
  /** Get zero initializer for a type */
  getZeroInitializer: (ctx: Parser.TypeContext, isArray: boolean) => string;
  /** Get expression type for validation */
  getExpressionType: (ctx: Parser.ExpressionContext) => string | null;
}

/**
 * Result from handling array declaration.
 */
interface IArrayDeclResult {
  /** Whether array init was fully handled (early return) */
  handled: boolean;
  /** Generated code if handled */
  code: string;
  /** Updated declaration string */
  decl: string;
  /** Whether this is an array type */
  isArray: boolean;
}

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
 * Callbacks for the full variable declaration orchestrator.
 */
interface IVariableDeclCallbacks {
  /** Generate expression code */
  generateExpression: (ctx: Parser.ExpressionContext) => string;
  /** Generate type code from type context */
  generateType: (ctx: Parser.TypeContext) => string;
  /** Get type name from type context */
  getTypeName: (ctx: Parser.TypeContext) => string;
  /** Generate array dimensions from contexts */
  generateArrayDimensions: (dims: Parser.ArrayDimensionContext[]) => string;
  /** Try to evaluate expression as constant value */
  tryEvaluateConstant: (ctx: Parser.ExpressionContext) => number | undefined;
  /** Get zero initializer for a type */
  getZeroInitializer: (ctx: Parser.TypeContext, isArray: boolean) => string;
  /** Get expression type for validation */
  getExpressionType: (ctx: Parser.ExpressionContext) => string | null;
  /** Infer variable type with C pointer handling */
  inferVariableType: (
    ctx: Parser.VariableDeclarationContext,
    name: string,
  ) => string;
  /** Track local variable metadata */
  trackLocalVariable: (
    ctx: Parser.VariableDeclarationContext,
    name: string,
  ) => void;
  /** Issue #895 Bug B: Mark variable as pointer in type registry */
  markVariableAsPointer: (name: string) => void;
  /** Get string concatenation operands */
  getStringConcatOperands: (
    ctx: Parser.ExpressionContext,
  ) => IStringConcatOps | null;
  /** Get substring extraction operands */
  getSubstringOperands: (ctx: Parser.ExpressionContext) => ISubstringOps | null;
  /** Get string expression capacity */
  getStringExprCapacity: (exprCode: string) => number | null;
  /** Request include for string operations */
  requireStringInclude: () => void;
}

/**
 * Generates variable declarations in C.
 */
class VariableDeclHelper {
  // ========================================================================
  // Tier 1: Pure Utilities (no dependencies)
  // ========================================================================

  /**
   * Parse first array dimension from arrayType syntax for size validation.
   * Returns numeric value if dimension is a literal, null otherwise.
   *
   * @param typeCtx - Type context containing potential arrayType
   * @returns First dimension as number, or null if not available/numeric
   */
  static parseArrayTypeDimension(typeCtx: Parser.TypeContext): number | null {
    if (!typeCtx.arrayType()) {
      return null;
    }
    const dims = typeCtx.arrayType()!.arrayTypeDimension();
    if (dims.length === 0) {
      return null;
    }
    const sizeExpr = dims[0].expression();
    if (!sizeExpr) {
      return null;
    }
    const sizeText = sizeExpr.getText();
    const digitRegex = /^\d+$/;
    if (digitRegex.exec(sizeText)) {
      return Number.parseInt(sizeText, 10);
    }
    return null;
  }

  /**
   * Parse first array dimension from arrayDimension contexts for validation.
   * Returns numeric value if dimension is a literal, null otherwise.
   *
   * @param arrayDims - Array dimension contexts
   * @returns First dimension as number, or null if not available/numeric
   */
  static parseFirstArrayDimension(
    arrayDims: Parser.ArrayDimensionContext[],
  ): number | null {
    if (arrayDims.length === 0 || !arrayDims[0].expression()) {
      return null;
    }
    const sizeText = arrayDims[0].expression()!.getText();
    if (/^\d+$/.exec(sizeText)) {
      return Number.parseInt(sizeText, 10);
    }
    return null;
  }

  /**
   * Extract base type name from type context for error messages.
   * Handles primitive types, user types, and array types.
   *
   * @param typeCtx - Type context
   * @returns Base type name as string
   */
  static extractBaseTypeName(typeCtx: Parser.TypeContext): string {
    if (typeCtx.primitiveType()) {
      return typeCtx.primitiveType()!.getText();
    }
    if (typeCtx.userType()) {
      return typeCtx.userType()!.getText();
    }
    if (typeCtx.arrayType()) {
      const arrCtx = typeCtx.arrayType()!;
      if (arrCtx.primitiveType()) {
        return arrCtx.primitiveType()!.getText();
      }
      if (arrCtx.userType()) {
        return arrCtx.userType()!.getText();
      }
    }
    return typeCtx.getText();
  }

  // ========================================================================
  // Tier 2: Simple Operations (CodeGenState + simple callbacks)
  // ========================================================================

  /**
   * Validate array declaration syntax - reject C-style, require C-Next style.
   * C-style: u16 arr[8] (all dimensions after identifier) - REJECTED
   * C-Next style: u16[8] arr (first dimension in type) - REQUIRED
   * Multi-dim C-Next: u16[4] arr[2] (first in type, rest after) - ALLOWED
   *
   * Exceptions (grammar limitations):
   *   - Empty dimensions for size inference: u8 arr[] <- [...]
   *   - Qualified types: SeaDash.Parse.Result arr[3] (no arrayType support)
   *   - Scoped/global types: this.Type arr[3], global.Type arr[3]
   *   - String types: string<N> arr[3]
   *
   * @param ctx - Variable declaration context
   * @param typeCtx - Type context
   * @param name - Variable name
   * @throws Error if C-style array declaration detected
   */
  static validateArrayDeclarationSyntax(
    ctx: Parser.VariableDeclarationContext,
    typeCtx: Parser.TypeContext,
    name: string,
  ): void {
    const arrayDims = ctx.arrayDimension();
    if (arrayDims.length === 0) {
      return; // Not an array declaration
    }

    // If type already has arrayType, additional dimensions are allowed (multi-dim)
    if (typeCtx.arrayType()) {
      return; // Valid C-Next style: u16[4] arr[2] -> uint16_t arr[4][2]
    }

    // Allow empty first dimension for size inference: u8 arr[] <- [1, 2, 3]
    // The grammar doesn't support u8[] arr syntax, so this is the only way
    if (arrayDims.length === 1 && !arrayDims[0].expression()) {
      return; // Size inference pattern allowed
    }

    // Allow C-style for multi-dimensional arrays: u8 matrix[4][4]
    // The arrayType grammar only supports single dimension, so multi-dim needs C-style
    if (arrayDims.length > 1) {
      return; // Multi-dimensional arrays need C-style
    }

    // Allow C-style for types that don't support arrayType syntax:
    // - Qualified types (Scope.Type, Namespace::Type)
    // - Scoped types (this.Type)
    // - Global types (global.Type)
    // - String types (string<N>)
    // - Bitmap types (code generator doesn't yet handle arrayType for bitmaps)
    if (
      typeCtx.qualifiedType() ||
      typeCtx.scopedType() ||
      typeCtx.globalType() ||
      typeCtx.stringType()
    ) {
      return; // Grammar limitation - these can't use arrayType
    }

    // C-style array declaration detected - reject with helpful error
    const baseType = VariableDeclHelper.extractBaseTypeName(typeCtx);
    const dimensions = arrayDims
      .map((dim) => `[${dim.expression()?.getText() ?? ""}]`)
      .join("");
    const line = ctx.start?.line ?? 0;
    const col = ctx.start?.column ?? 0;

    throw new Error(
      `${line}:${col} C-style array declaration is not allowed. ` +
        `Use '${baseType}${dimensions} ${name}' instead of '${baseType} ${name}${dimensions}'`,
    );
  }

  /**
   * Validate integer initializer using type validation helpers.
   * Checks that literal values fit in target type and validates type conversions.
   *
   * Delegates to IntegerLiteralValidator for the actual validation logic.
   *
   * @param ctx - Variable declaration context (must have expression)
   * @param typeName - Target type name
   * @param callbacks - Callbacks for expression type resolution
   * @throws Error if value doesn't fit in type or conversion is invalid
   */
  static validateIntegerInitializer(
    ctx: Parser.VariableDeclarationContext,
    typeName: string,
    callbacks: IIntegerValidationCallbacks,
  ): void {
    const exprText = ctx.expression()!.getText();
    const line = ctx.start?.line ?? 0;
    const col = ctx.start?.column ?? 0;

    const validator = new IntegerLiteralValidator({
      isIntegerType: TypeResolver.isIntegerType,
      validateLiteralFitsType: TypeResolver.validateLiteralFitsType,
      getExpressionType: (_text: string) => {
        // IntegerLiteralValidator passes text, but our callback uses the context
        return callbacks.getExpressionType(ctx.expression()!);
      },
      validateTypeConversion: TypeResolver.validateTypeConversion,
    });

    validator.validateIntegerAssignment(typeName, exprText, line, col);
  }

  /**
   * Handle pending C++ class field assignments.
   * In function body, generates assignments after declaration.
   * At global scope, throws error since assignments can't exist there.
   *
   * @param typeCtx - Type context for error messages
   * @param name - Variable name
   * @param decl - Current declaration string
   * @param callbacks - Callbacks for type name generation
   * @returns Final declaration with semicolon and any pending assignments
   * @throws Error if C++ class with constructor at global scope
   */
  static finalizeCppClassAssignments(
    typeCtx: Parser.TypeContext,
    name: string,
    decl: string,
    callbacks: ICppAssignmentCallbacks,
  ): string {
    if (CodeGenState.pendingCppClassAssignments.length === 0) {
      return `${decl};`;
    }

    if (CodeGenState.inFunctionBody) {
      const assignments = CodeGenState.pendingCppClassAssignments
        .map((a) => `${name}.${a}`)
        .join("\n");
      CodeGenState.pendingCppClassAssignments = [];
      return `${decl};\n${assignments}`;
    }

    // At global scope, we can't emit assignment statements.
    CodeGenState.pendingCppClassAssignments = [];
    throw new Error(
      `Error: C++ class '${callbacks.getTypeName(typeCtx)}' with constructor cannot use struct initializer ` +
        `syntax at global scope. Use constructor syntax or initialize fields separately.`,
    );
  }

  // ========================================================================
  // Tier 3: Complex Operations (callbacks + ArrayInitHelper)
  // ========================================================================

  /**
   * Get array dimension string from arrayType syntax.
   * Evaluates const expressions to their numeric values for C compatibility.
   * Example: u16[8] -> "[8]", u16[4][4] -> "[4][4]"
   *
   * @param typeCtx - Type context containing arrayType
   * @param callbacks - Callbacks for expression evaluation
   * @returns Dimension string like "[8]" or "" if no arrayType
   */
  static getArrayTypeDimension(
    typeCtx: Parser.TypeContext,
    callbacks: IArrayTypeDimCallbacks,
  ): string {
    if (!typeCtx.arrayType()) {
      return "";
    }
    const dims = typeCtx.arrayType()!.arrayTypeDimension();
    let result = "";
    for (const dim of dims) {
      const sizeExpr = dim.expression();
      if (!sizeExpr) {
        result += "[]";
        continue;
      }
      // Try to evaluate as constant first (required for C file-scope arrays)
      // Fall back to expression text for macros, enums, etc.
      const dimValue =
        callbacks.tryEvaluateConstant(sizeExpr) ??
        callbacks.generateExpression(sizeExpr);
      result += `[${dimValue}]`;
    }
    return result;
  }

  /**
   * Handle array declaration with dimension parsing and initialization.
   * Handles both C-Next style arrayType syntax (u16[8] myArray) and
   * traditional arrayDimension syntax.
   *
   * @param ctx - Variable declaration context
   * @param typeCtx - Type context
   * @param name - Variable name
   * @param decl - Current declaration string
   * @param callbacks - Callbacks for code generation
   * @returns Result indicating if handled and any generated code
   */
  static handleArrayDeclaration(
    ctx: Parser.VariableDeclarationContext,
    typeCtx: Parser.TypeContext,
    name: string,
    decl: string,
    callbacks: IArrayDeclCallbacks,
  ): IArrayDeclResult {
    const arrayDims = ctx.arrayDimension();
    const hasArrayTypeSyntax = typeCtx.arrayType() !== null;
    const isArray = arrayDims.length > 0 || hasArrayTypeSyntax;

    if (!isArray) {
      return { handled: false, code: "", decl, isArray: false };
    }

    // Generate dimension string from arrayType syntax (u16[8] myArray)
    const arrayTypeDimStr = VariableDeclHelper.getArrayTypeDimension(
      typeCtx,
      callbacks,
    );

    const hasEmptyArrayDim = arrayDims.some((dim) => !dim.expression());
    const declaredSize =
      VariableDeclHelper.parseArrayTypeDimension(typeCtx) ??
      VariableDeclHelper.parseFirstArrayDimension(arrayDims);

    // ADR-035: Handle array initializers with size inference
    if (ctx.expression()) {
      const arrayInitResult = ArrayInitHelper.processArrayInit(
        name,
        typeCtx,
        ctx.expression()!,
        arrayDims,
        hasEmptyArrayDim,
        declaredSize,
        {
          generateExpression: (exprCtx) =>
            callbacks.generateExpression(exprCtx),
          getTypeName: (typeCtxParam) => callbacks.getTypeName(typeCtxParam),
          generateArrayDimensions: (dims) =>
            callbacks.generateArrayDimensions(dims),
        },
      );
      if (arrayInitResult) {
        // Track as local array for type resolution
        CodeGenState.localArrays.add(name);
        // Include arrayType dimension before arrayDimension dimensions
        const fullDimSuffix = arrayTypeDimStr + arrayInitResult.dimensionSuffix;
        return {
          handled: true,
          code: `${decl}${fullDimSuffix} = ${arrayInitResult.initValue};`,
          decl,
          isArray: true,
        };
      }
    }

    // Generate dimensions: arrayType dimension first, then arrayDimension dimensions
    const newDecl =
      decl + arrayTypeDimStr + callbacks.generateArrayDimensions(arrayDims);
    CodeGenState.localArrays.add(name);

    return { handled: false, code: "", decl: newDecl, isArray: true };
  }

  /**
   * Generate variable initializer with validation.
   * Handles zero initialization for uninitialized variables and
   * validates enum and integer assignments.
   *
   * @param ctx - Variable declaration context
   * @param typeCtx - Type context
   * @param decl - Current declaration string
   * @param isArray - Whether this is an array type
   * @param callbacks - Callbacks for code generation and validation
   * @returns Declaration string with initializer
   */
  static generateVariableInitializer(
    ctx: Parser.VariableDeclarationContext,
    typeCtx: Parser.TypeContext,
    decl: string,
    isArray: boolean,
    callbacks: IVariableInitCallbacks,
  ): string {
    if (!ctx.expression()) {
      // ADR-015: Zero initialization for uninitialized variables
      return `${decl} = ${callbacks.getZeroInitializer(typeCtx, isArray)}`;
    }

    const typeName = callbacks.getTypeName(typeCtx);

    // ADR-017: Validate enum type for initialization
    EnumAssignmentValidator.validateEnumAssignment(typeName, ctx.expression()!);

    // ADR-024: Validate integer literals and type conversions
    VariableDeclHelper.validateIntegerInitializer(ctx, typeName, {
      getExpressionType: callbacks.getExpressionType,
    });

    // Issue #872: Set expectedType for MISRA 7.2 U suffix compliance
    return CodeGenState.withExpectedType(
      typeName,
      () => `${decl} = ${callbacks.generateExpression(ctx.expression()!)}`,
    );
  }

  // ========================================================================
  // Tier 4: Orchestrators (main entry points)
  // ========================================================================

  /**
   * Generate a complete variable declaration.
   * This is the main entry point for variable declaration generation.
   *
   * Handles:
   * - C++ constructor syntax
   * - String declarations
   * - Array declarations
   * - Regular variable declarations with initializers
   * - C++ class field assignments
   *
   * @param ctx - Variable declaration context
   * @param callbacks - Callbacks for code generation
   * @returns Complete variable declaration code
   */
  static generateVariableDecl(
    ctx: Parser.VariableDeclarationContext,
    callbacks: IVariableDeclCallbacks,
  ): string {
    // Issue #375: Check for C++ constructor syntax - early return
    const constructorArgList = ctx.constructorArgumentList();
    if (constructorArgList) {
      return VariableDeclHelper.generateConstructorDecl(
        ctx,
        constructorArgList,
        { generateType: callbacks.generateType },
      );
    }

    // Issue #696: Use helper for modifier extraction and validation
    // Issue #852 (MISRA Rule 8.5): Pass hasInitializer and cppMode for correct extern behavior
    const hasInitializer = ctx.expression() !== null;
    const modifiers = VariableModifierBuilder.build(
      ctx,
      CodeGenState.inFunctionBody,
      hasInitializer,
      CodeGenState.cppMode,
    );

    const name = ctx.IDENTIFIER().getText();
    const typeCtx = ctx.type();

    // Reject C-style array declarations (u16 arr[8]) - require C-Next style (u16[8] arr)
    VariableDeclHelper.validateArrayDeclarationSyntax(ctx, typeCtx, name);

    const type = callbacks.inferVariableType(ctx, name);

    // Track local variable metadata
    callbacks.trackLocalVariable(ctx, name);

    // Issue #895 Bug B: If type was inferred as pointer, mark it in the registry
    if (type.endsWith("*")) {
      callbacks.markVariableAsPointer(name);
    }

    // ADR-045: Handle bounded string type specially - early return
    const stringResult = StringDeclHelper.generateStringDecl(
      typeCtx,
      name,
      ctx.expression() ?? null,
      ctx.arrayDimension(),
      modifiers,
      ctx.constModifier() !== null,
      {
        generateExpression: (exprCtx) => callbacks.generateExpression(exprCtx),
        generateArrayDimensions: (dims) =>
          callbacks.generateArrayDimensions(dims),
        getStringConcatOperands: (concatCtx) =>
          callbacks.getStringConcatOperands(concatCtx),
        getSubstringOperands: (substrCtx) =>
          callbacks.getSubstringOperands(substrCtx),
        getStringExprCapacity: (exprCode) =>
          callbacks.getStringExprCapacity(exprCode),
        requireStringInclude: () => callbacks.requireStringInclude(),
      },
    );
    if (stringResult.handled) {
      return stringResult.code;
    }

    // Build base declaration
    const modifierPrefix = VariableModifierBuilder.toPrefix(modifiers);
    let decl = `${modifierPrefix}${type} ${name}`;

    // Handle array declarations - early return if array init handled
    const arrayResult = VariableDeclHelper.handleArrayDeclaration(
      ctx,
      typeCtx,
      name,
      decl,
      {
        generateExpression: callbacks.generateExpression,
        getTypeName: callbacks.getTypeName,
        generateArrayDimensions: callbacks.generateArrayDimensions,
        tryEvaluateConstant: callbacks.tryEvaluateConstant,
      },
    );
    if (arrayResult.handled) {
      return arrayResult.code;
    }
    decl = arrayResult.decl;

    // Handle initialization
    decl = VariableDeclHelper.generateVariableInitializer(
      ctx,
      typeCtx,
      decl,
      arrayResult.isArray,
      {
        generateExpression: callbacks.generateExpression,
        getTypeName: callbacks.getTypeName,
        getZeroInitializer: callbacks.getZeroInitializer,
        getExpressionType: callbacks.getExpressionType,
      },
    );

    // Handle pending C++ class field assignments
    return VariableDeclHelper.finalizeCppClassAssignments(typeCtx, name, decl, {
      getTypeName: callbacks.getTypeName,
    });
  }

  /**
   * Generate C++ constructor-style declaration.
   * Validates that all arguments are const variables.
   *
   * Example: `Adafruit_MAX31856 thermocouple(pinConst);`
   *
   * @param ctx - Variable declaration context
   * @param argListCtx - Constructor argument list context
   * @param callbacks - Callbacks for type generation
   * @returns Constructor declaration code
   * @throws Error if argument not declared or not const
   */
  static generateConstructorDecl(
    ctx: Parser.VariableDeclarationContext,
    argListCtx: Parser.ConstructorArgumentListContext,
    callbacks: Pick<IVariableDeclCallbacks, "generateType">,
  ): string {
    const type = callbacks.generateType(ctx.type());
    const name = ctx.IDENTIFIER().getText();
    const line = ctx.start?.line ?? 0;

    // Collect and validate all arguments
    const argIdentifiers = argListCtx.IDENTIFIER();
    const resolvedArgs: string[] = [];

    for (const argNode of argIdentifiers) {
      const argName = argNode.getText();

      // Check if it exists in type registry
      const typeInfo = CodeGenState.getVariableTypeInfo(argName);

      // Also check scoped variables if inside a scope
      let scopedArgName = argName;
      let scopedTypeInfo = typeInfo;
      if (!typeInfo && CodeGenState.currentScope) {
        scopedArgName = `${CodeGenState.currentScope}_${argName}`;
        scopedTypeInfo = CodeGenState.getVariableTypeInfo(scopedArgName);
      }

      if (!typeInfo && !scopedTypeInfo) {
        throw new Error(
          `Error at line ${line}: Constructor argument '${argName}' is not declared`,
        );
      }

      const finalTypeInfo = typeInfo ?? scopedTypeInfo!;
      const finalArgName = typeInfo ? argName : scopedArgName;

      // Check if it's const
      if (!finalTypeInfo.isConst) {
        throw new Error(
          `Error at line ${line}: Constructor argument '${argName}' must be const. ` +
            `C++ constructors in C-Next only accept const variables.`,
        );
      }

      resolvedArgs.push(finalArgName);
    }

    // Track the variable in type registry (as an external C++ type)
    CodeGenState.setVariableTypeInfo(name, {
      baseType: type,
      bitWidth: 0, // Unknown for C++ types
      isArray: false,
      arrayDimensions: [],
      isConst: false,
      isExternalCppType: true,
    });

    // Track as local variable if inside function body
    if (CodeGenState.inFunctionBody) {
      CodeGenState.localVariables.add(name);
    }

    return `${type} ${name}(${resolvedArgs.join(", ")});`;
  }
}

export default VariableDeclHelper;
