/**
 * ParameterInputAdapter - Adapts different input formats to IParameterInput
 *
 * Provides two conversion methods:
 * - fromAST(): For CodeGenerator, converts Parser.ParameterContext + CodeGenState
 * - fromSymbol(): For HeaderGenerator, converts IParameterSymbol
 *
 * Both produce normalized IParameterInput for use with ParameterSignatureBuilder.
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser";
import IParameterInput from "../types/IParameterInput";
import IParameterSymbol from "../../../../utils/types/IParameterSymbol";
import ICallbackTypeInfo from "../types/ICallbackTypeInfo";

/**
 * Dependencies required by fromAST() to resolve types and state.
 * These are passed in to avoid direct dependency on CodeGenState,
 * making the adapter more testable.
 */
interface IFromASTDeps {
  /** Get C-Next type name from type context (e.g., 'u32', 'Point') */
  getTypeName: (type: Parser.TypeContext) => string;

  /** Generate C type from type context (e.g., 'uint32_t', 'Point') */
  generateType: (type: Parser.TypeContext) => string;

  /** Generate expression string (for array dimension expressions) */
  generateExpression: (expr: Parser.ExpressionContext) => string;

  /** Map of callback type names to their info */
  callbackTypes: ReadonlyMap<string, ICallbackTypeInfo>;

  /** Check if type is a known struct (C-Next or C header) */
  isKnownStruct: (typeName: string) => boolean;

  /** TYPE_MAP for primitive detection */
  typeMap: Record<string, string>;

  /** Whether the parameter is modified in the current function */
  isModified: boolean;

  /** Whether the parameter should use pass-by-value (pre-computed) */
  isPassByValue: boolean;

  /** Issue #895: Whether the current function is callback-compatible */
  isCallbackCompatible: boolean;

  /**
   * Issue #895: Force pass-by-reference for callback-compatible functions
   * When the typedef signature requires a pointer, this overrides normal logic.
   */
  forcePassByReference?: boolean;

  /** Issue #958: Check if a type name is a typedef'd struct from C headers */
  isTypedefStructType: (typeName: string) => boolean;

  /**
   * Issue #895: Force const qualifier from callback typedef signature.
   * When the C typedef has `const T*`, this preserves const on the generated param.
   */
  forceConst?: boolean;

  /**
   * Issue #995: Check if a type is an opaque handle (incomplete struct typedef).
   * Opaque handles should not get auto-const because they must be passed to
   * C APIs that expect non-const pointers.
   */
  isOpaqueType?: (typeName: string) => boolean;
}

/**
 * Dependencies required by fromSymbol() to resolve types.
 * Simpler than AST deps since IParameterSymbol already contains most info.
 *
 * The caller (BaseHeaderGenerator) pre-computes isPassByValue including
 * ISR/float/enum/passByValueSet checks. The adapter trusts this decision.
 */
interface IFromSymbolDeps {
  /** Map C-Next type to C type */
  mapType: (type: string) => string;

  /** Whether the parameter should use pass-by-value (pre-computed by caller) */
  isPassByValue: boolean;
}

/**
 * Static adapter class for converting different input formats to IParameterInput.
 */
class ParameterInputAdapter {
  /**
   * Convert AST ParameterContext to normalized IParameterInput.
   * Used by CodeGenerator.generateParameter().
   *
   * Note: Validation (C-style array rejection, unbounded dimension rejection)
   * should be done BEFORE calling this method.
   *
   * @param ctx - The parser context for the parameter
   * @param deps - Dependencies for type resolution and state lookup
   * @returns Normalized IParameterInput
   */
  static fromAST(
    ctx: Parser.ParameterContext,
    deps: IFromASTDeps,
  ): IParameterInput {
    const isConst = ctx.constModifier() !== null;
    const typeName = deps.getTypeName(ctx.type());
    const name = ctx.IDENTIFIER().getText();
    const mappedType = deps.generateType(ctx.type());

    // Check for callback type
    const callbackInfo = deps.callbackTypes.get(typeName);
    if (callbackInfo) {
      return this._buildCallbackInput(
        name,
        typeName,
        mappedType,
        callbackInfo.typedefName,
      );
    }

    // Check for array type
    const arrayTypeCtx = ctx.type().arrayType();
    if (arrayTypeCtx) {
      return this._buildArrayInputFromAST(
        arrayTypeCtx,
        name,
        typeName,
        mappedType,
        isConst,
        deps,
      );
    }

    // Check for string type (non-array)
    const stringTypeCtx = ctx.type().stringType();
    if (stringTypeCtx) {
      return this._buildStringInput(
        name,
        typeName,
        isConst,
        deps,
        stringTypeCtx,
      );
    }

    // Determine classification for non-array, non-string types
    const isKnownStruct = deps.isKnownStruct(typeName);
    const isKnownPrimitive = !!deps.typeMap[typeName];
    // Issue #958: C-header typedef struct types need pointer semantics
    const isTypedefStruct = deps.isTypedefStructType(typeName);
    // Issue #995: Opaque handles (incomplete struct typedefs) should not get auto-const
    const isOpaque = deps.isOpaqueType?.(typeName) ?? false;
    // Issue #895: Don't add auto-const for callback-compatible functions
    // because it would change the signature and break typedef compatibility
    // Issue #995: Don't add auto-const for opaque handles because they must be
    // passed to C APIs that expect non-const pointers (like LVGL's lv_obj_t)
    const isAutoConst =
      !deps.isCallbackCompatible && !deps.isModified && !isConst && !isOpaque;

    // Issue #895/#958: Force pass-by-reference for callback or typedef struct types
    const isPassByReference =
      deps.forcePassByReference ||
      isKnownStruct ||
      isKnownPrimitive ||
      isTypedefStruct;

    return {
      name,
      baseType: typeName,
      mappedType,
      isConst,
      isAutoConst,
      isArray: false,
      isCallback: false,
      isString: false,
      isPassByValue: deps.isPassByValue,
      isPassByReference,
      // Issue #895/#958/#995: Force pointer syntax in C++ mode for callback-compatible,
      // typedef struct, and opaque handle params (C types expect pointers, not C++ references)
      forcePointerSyntax:
        deps.forcePassByReference || isTypedefStruct || isOpaque || undefined,
      // Issue #895: Preserve const from callback typedef signature
      forceConst: deps.forceConst,
    };
  }

  /**
   * Convert IParameterSymbol to normalized IParameterInput.
   * Used by BaseHeaderGenerator.generateParameter().
   *
   * The caller pre-computes isPassByValue (ISR, float, enum, passByValueSet).
   * Non-PBV, non-array, non-string types use pass-by-reference.
   *
   * @param param - The parameter symbol
   * @param deps - Dependencies for type mapping
   * @returns Normalized IParameterInput
   */
  static fromSymbol(
    param: IParameterSymbol,
    deps: IFromSymbolDeps,
  ): IParameterInput {
    const mappedType = deps.mapType(param.type);

    // Array parameters
    if (
      param.isArray &&
      param.arrayDimensions &&
      param.arrayDimensions.length > 0
    ) {
      return this._buildArrayInputFromSymbol(param, mappedType);
    }

    // String type detection
    const isString =
      param.type === "string" || param.type.startsWith("string<");

    // Non-array string
    if (isString && !param.isArray) {
      return {
        name: param.name,
        baseType: param.type,
        mappedType: "char",
        isConst: param.isConst,
        isAutoConst: param.isAutoConst ?? false,
        isArray: false,
        isCallback: false,
        isString: true,
        isPassByValue: false,
        isPassByReference: false,
      };
    }

    // Issue #914: Callback typedef overrides — param carries resolved pointer/const info
    const isCallbackPointer = param.isCallbackPointer ?? false;
    // Issue #995: Opaque handle info resolved onto symbol — needs pointer syntax, no auto-const
    const isOpaqueHandle = param.isOpaqueHandle ?? false;
    // Either callback or opaque handle needs pointer treatment
    const needsPointerSemantics = isCallbackPointer || isOpaqueHandle;

    return {
      name: param.name,
      baseType: param.type,
      mappedType,
      isConst: param.isConst,
      // Issue #995: Opaque handles never get auto-const (resolved value may still be true from symbol)
      isAutoConst: isOpaqueHandle ? false : (param.isAutoConst ?? false),
      isArray: false,
      isCallback: false,
      isString: false,
      isPassByValue: needsPointerSemantics ? false : deps.isPassByValue,
      isPassByReference: needsPointerSemantics ? true : !deps.isPassByValue,
      forcePointerSyntax: needsPointerSemantics || undefined,
      forceConst: param.isCallbackConst || undefined,
    };
  }

  /**
   * Build IParameterInput for a callback parameter.
   */
  private static _buildCallbackInput(
    name: string,
    typeName: string,
    mappedType: string,
    typedefName: string,
  ): IParameterInput {
    return {
      name,
      baseType: typeName,
      mappedType,
      isConst: false,
      isAutoConst: false,
      isArray: false,
      isCallback: true,
      callbackTypedefName: typedefName,
      isString: false,
      isPassByValue: true, // Callbacks are function pointers, pass by value
      isPassByReference: false,
    };
  }

  /**
   * Build IParameterInput for an array parameter from AST.
   */
  private static _buildArrayInputFromAST(
    arrayTypeCtx: Parser.ArrayTypeContext,
    name: string,
    typeName: string,
    mappedType: string,
    isConst: boolean,
    deps: IFromASTDeps,
  ): IParameterInput {
    const allDims = arrayTypeCtx.arrayTypeDimension();

    // Build dimension strings
    const dims: string[] = allDims.map(
      (d: Parser.ArrayTypeDimensionContext) => {
        const expr = d.expression();
        return expr ? deps.generateExpression(expr) : "";
      },
    );

    // Check for string array (string<N>[M])
    const stringTypeCtx = arrayTypeCtx.stringType();
    const isString = stringTypeCtx !== null;

    if (isString && stringTypeCtx) {
      const intLiteral = stringTypeCtx.INTEGER_LITERAL();
      if (intLiteral) {
        const capacity = Number.parseInt(intLiteral.getText(), 10);
        dims.push(String(capacity + 1));
      }
    }

    // ADR-006: Arrays are pass-by-reference and mutable by default.
    // Never apply auto-const to arrays - only explicit const from source code.
    // Auto-const would break compatibility with C APIs expecting mutable pointers.
    return {
      name,
      baseType: typeName,
      mappedType,
      isConst,
      isAutoConst: false,
      isArray: true,
      arrayDimensions: dims,
      isCallback: false,
      isString,
      isPassByValue: false, // Arrays are always passed by pointer
      isPassByReference: false,
    };
  }

  /**
   * Build IParameterInput for an array parameter from symbol.
   */
  private static _buildArrayInputFromSymbol(
    param: IParameterSymbol,
    mappedType: string,
  ): IParameterInput {
    const isString =
      param.type === "string" || param.type.startsWith("string<");
    const isUnboundedString = param.type === "string"; // No capacity specified

    // For header generator, we need to use char for string arrays
    const actualMappedType = isString ? "char" : mappedType;

    return {
      name: param.name,
      baseType: param.type,
      mappedType: actualMappedType,
      isConst: param.isConst,
      isAutoConst: param.isAutoConst ?? false,
      isArray: true,
      arrayDimensions: param.arrayDimensions,
      isCallback: false,
      isString,
      isUnboundedString,
      isPassByValue: false,
      isPassByReference: false,
    };
  }

  /**
   * Build IParameterInput for a non-array string parameter.
   */
  private static _buildStringInput(
    name: string,
    typeName: string,
    isConst: boolean,
    deps: IFromASTDeps,
    stringTypeCtx: Parser.StringTypeContext,
  ): IParameterInput {
    const intLiteral = stringTypeCtx.INTEGER_LITERAL();
    const capacity = intLiteral
      ? Number.parseInt(intLiteral.getText(), 10)
      : undefined;
    const isAutoConst = !deps.isModified && !isConst;

    return {
      name,
      baseType: typeName,
      mappedType: "char",
      isConst,
      isAutoConst,
      isArray: false,
      isCallback: false,
      isString: true,
      stringCapacity: capacity,
      isPassByValue: false,
      isPassByReference: false,
    };
  }
}

export default ParameterInputAdapter;
