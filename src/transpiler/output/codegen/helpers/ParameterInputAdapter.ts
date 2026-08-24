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
import ArrayDimensionParser from "../../../../utils/ArrayDimensionParser";
import dimensionEvalOptions from "./dimensionEvalOptions";

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
    // Issue #995: Detect opaque handles — rule applied in ParameterSignatureBuilder
    const isOpaque = deps.isOpaqueType?.(typeName) ?? false;
    // Issue #895: Don't add auto-const for callback-compatible functions
    // because it would change the signature and break typedef compatibility
    const isAutoConst =
      !deps.isCallbackCompatible && !deps.isModified && !isConst;

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
      // Issue #895/#958: Force pointer syntax in C++ mode for callback-compatible
      // and typedef struct params (C types expect pointers, not C++ references)
      forcePointerSyntax:
        deps.forcePassByReference || isTypedefStruct || undefined,
      // Issue #895: Preserve const from callback typedef signature
      forceConst: deps.forceConst,
      // Issue #995: Pass through opaque handle detection — rule applied in builder
      isOpaqueHandle: isOpaque || undefined,
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

    // ADR-029 / #1164: a parameter whose type IS a callback function is written
    // as its typedef, with no added pointer — the typedef is already a function
    // pointer. Hardcoding isCallback false here made the header emit
    // "onReceive_fp* handler" where the .c emits "onReceive_fp handler".
    if (param.isCallback && param.callbackTypedefName) {
      return {
        name: param.name,
        baseType: param.type,
        mappedType,
        isConst: param.isConst,
        isAutoConst: false,
        isArray: false,
        isCallback: true,
        callbackTypedefName: param.callbackTypedefName,
        isString: false,
        isPassByValue: true,
        isPassByReference: false,
      };
    }

    // Issue #914: Callback typedef overrides — param carries resolved pointer/const
    // info. This is deliberately tri-state (TypedefParamParser.shouldBePointer
    // returns boolean | null): true means the typedef takes a pointer, FALSE
    // means it takes the value, and undefined means there is no typedef to
    // follow. Collapsing false into undefined with `?? false` sent a by-value
    // typedef back through ADR-006 reference semantics, so `void (*)(Point)`
    // got a `Point*` prototype against a `Point` definition (#1164).
    const callbackWantsPointer = param.isCallbackPointer;
    const callbackWantsValue = callbackWantsPointer === false;

    return {
      name: param.name,
      baseType: param.type,
      mappedType,
      isConst: param.isConst,
      isAutoConst: param.isAutoConst ?? false,
      isArray: false,
      isCallback: false,
      isString: false,
      isPassByValue: callbackWantsPointer
        ? false
        : (callbackWantsValue ?? false) || deps.isPassByValue,
      isPassByReference: callbackWantsPointer
        ? true
        : !callbackWantsValue && !deps.isPassByValue,
      forcePointerSyntax: callbackWantsPointer || undefined,
      forceConst: param.isCallbackConst || undefined,
      // Issue #995: Pass through opaque handle detection — rule applied in builder
      isOpaqueHandle: param.isOpaqueHandle || undefined,
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

    // Build dimension strings.
    //
    // Issue #1159: fold a compile-time constant to its value first. Emitting
    // the identifier makes `u8[SIZE] buf` a VLA parameter (`uint8_t buf[SIZE]`)
    // while the matching local declaration folds to `uint8_t b[6]` — the same
    // const rendered two ways in one .c, and a construct CLAUDE.md rules out
    // ("resolves consts to their value, no C VLA"). generateExpression stays
    // as the fallback for dimensions that are genuinely not constant.
    const dims: string[] = allDims.map(
      (d: Parser.ArrayTypeDimensionContext) => {
        const expr = d.expression();
        if (!expr) {
          return "";
        }
        const folded = ArrayDimensionParser.parseSingleDimension(
          expr,
          dimensionEvalOptions(),
        );
        return folded === undefined
          ? deps.generateExpression(expr)
          : String(folded);
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

    // #1164: a bounded string array's capacity is one of its C dimensions --
    // string<32>[5] is char[5][33]. ParameterSignatureBuilder expects it to be
    // present ("dimensions include capacity"); the .c path supplies it and this
    // one did not, so the header declared char arr[5] against a char arr[5][33]
    // definition.
    const arrayDimensions = ParameterInputAdapter._withStringCapacityDimension(
      param.arrayDimensions,
      param.type,
      isString && !isUnboundedString,
    );

    return {
      name: param.name,
      baseType: param.type,
      mappedType: actualMappedType,
      isConst: param.isConst,
      isAutoConst: param.isAutoConst ?? false,
      isArray: true,
      arrayDimensions,
      isCallback: false,
      isString,
      isUnboundedString,
      isPassByValue: false,
      isPassByReference: false,
    };
  }

  /**
   * Append a bounded string's capacity as the innermost C array dimension.
   *
   * `string<32>` holds 32 characters plus a NUL, so its C form is `char[33]`.
   */
  private static _withStringCapacityDimension(
    dimensions: string[] | undefined,
    typeName: string,
    isBoundedString: boolean,
  ): string[] | undefined {
    if (!isBoundedString || !dimensions) {
      return dimensions;
    }

    const capacityMatch = /^string<(\d+)>$/.exec(typeName);
    if (!capacityMatch) {
      return dimensions;
    }

    const capacity = Number.parseInt(capacityMatch[1], 10);
    return [...dimensions, String(capacity + 1)];
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
