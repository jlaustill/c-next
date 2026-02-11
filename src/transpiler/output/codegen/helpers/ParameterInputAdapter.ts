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
}

/**
 * Dependencies required by fromSymbol() to resolve types.
 * Simpler than AST deps since IParameterSymbol already contains most info.
 */
interface IFromSymbolDeps {
  /** Map C-Next type to C type */
  mapType: (type: string) => string;

  /** Whether the parameter should use pass-by-value */
  isPassByValue: boolean;

  /** Set of known enum names (for pass-by-value detection) */
  knownEnums: ReadonlySet<string>;
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
    const isAutoConst = !deps.isModified && !isConst;

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
      isKnownStruct,
      isKnownPrimitive,
    };
  }

  /**
   * Convert IParameterSymbol to normalized IParameterInput.
   * Used by BaseHeaderGenerator.generateParameter().
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
        isKnownStruct: false,
        isKnownPrimitive: false,
      };
    }

    // Determine if pass-by-value
    // ISR, float, enum, or explicitly marked
    const isPassByValue =
      param.type === "ISR" ||
      param.type === "f32" ||
      param.type === "f64" ||
      deps.knownEnums.has(param.type) ||
      deps.isPassByValue;

    return {
      name: param.name,
      baseType: param.type,
      mappedType,
      isConst: param.isConst,
      isAutoConst: param.isAutoConst ?? false,
      isArray: false,
      isCallback: false,
      isString: false,
      isPassByValue,
      // For symbol-based, we need to pass by reference for non-pass-by-value types
      // The builder will handle this via the refSuffix parameter
      isKnownStruct: !isPassByValue,
      isKnownPrimitive: !isPassByValue,
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
      isKnownStruct: false,
      isKnownPrimitive: false,
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

    const isAutoConst = !deps.isModified && !isConst;

    return {
      name,
      baseType: typeName,
      mappedType,
      isConst,
      isAutoConst,
      isArray: true,
      arrayDimensions: dims,
      isCallback: false,
      isString,
      isPassByValue: false, // Arrays are always passed by pointer
      isKnownStruct: false,
      isKnownPrimitive: false,
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
      isKnownStruct: false,
      isKnownPrimitive: false,
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
      isKnownStruct: false,
      isKnownPrimitive: false,
    };
  }
}

export default ParameterInputAdapter;
