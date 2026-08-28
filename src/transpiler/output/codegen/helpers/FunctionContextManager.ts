/**
 * FunctionContextManager - Manages function context lifecycle and parameter processing
 *
 * Issue #793: Extracted from CodeGenerator to reduce file size.
 *
 * Handles:
 * - Function context setup/cleanup lifecycle
 * - Parameter type resolution and registration
 * - Return type resolution (including main() special case)
 * - Function body enter/exit coordination
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import CodeGenState from "../../../state/CodeGenState.js";
import TYPE_WIDTH from "../../../constants/TYPE_WIDTH.js";
import ArrayDimensionParser from "../../../../utils/ArrayDimensionParser.js";
import dimensionEvalOptions from "./dimensionEvalOptions.js";
import IFunctionContextCallbacks from "../types/IFunctionContextCallbacks.js";
// Issue #895: Parse typedef signatures to determine pointer vs value params
import TypedefParamParser from "./TypedefParamParser.js";
import UNRESOLVED_DIMENSION from "../../../constants/UNRESOLVED_DIMENSION";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TypeBinding from "../../../logic/symbols/TypeBinding";

/**
 * Result from resolving parameter type information.
 */
interface IParameterTypeInfo {
  typeName: string;
  isStruct: boolean;
  isCallback: boolean;
  isString: boolean;
}

/**
 * Result from resolving return type and params for a function.
 */
interface IReturnTypeAndParams {
  actualReturnType: string;
  initialParams: string;
}

/**
 * Manages function context lifecycle and parameter processing.
 */
class FunctionContextManager {
  /**
   * Set up context for function generation.
   * - Sets current function name (with scope prefix if in a scope)
   * - Sets return type for enum inference
   * - Processes parameters for ADR-006 pointer semantics
   * - Clears local variables and marks in function body
   */
  static setupFunctionContext(
    name: string,
    ctx: Parser.FunctionDeclarationContext,
    callbacks: IFunctionContextCallbacks,
  ): void {
    // Issue #269: Set current function name for pass-by-value lookup
    const fullFuncName = CodeGenState.currentScope
      ? ScopeUtils.qualifyInScope(name, CodeGenState.currentScope)
      : name;
    CodeGenState.currentFunctionName = fullFuncName;

    // Issue #477: Set return type for enum inference in return statements
    CodeGenState.currentFunctionReturnType = ctx.type().getText();

    // Track parameters for ADR-006 pointer semantics
    FunctionContextManager.processParameterList(
      ctx.parameterList() ?? null,
      callbacks,
    );

    // ADR-016: Clear local tracking and mark that we're in a function body.
    // Delegated: this path used to clear three of the four local registers and
    // let `localArrays` leak into the next function.
    CodeGenState.enterFunctionBody();
  }

  /**
   * Clean up context after function generation.
   * Resets all function-related state.
   */
  static cleanupFunctionContext(): void {
    CodeGenState.exitFunctionBody();
    CodeGenState.mainArgsName = null;
    CodeGenState.currentFunctionName = null;
    CodeGenState.currentFunctionReturnType = null;
    FunctionContextManager.clearParameters();
  }

  /**
   * Resolve return type and initial params for function.
   * Handles main() special cases:
   * - main(u8 args[][]) -> int main(int argc, char *argv[])
   * - main() -> int main() (for C++ compatibility)
   */
  static resolveReturnTypeAndParams(
    name: string,
    returnType: string,
    isMainWithArgs: boolean,
    ctx: Parser.FunctionDeclarationContext,
  ): IReturnTypeAndParams {
    if (isMainWithArgs) {
      // Special case: main(u8 args[][]) -> int main(int argc, char *argv[])
      const argsParam = ctx.parameterList()!.parameter()[0];
      CodeGenState.mainArgsName = argsParam.IDENTIFIER().getText();
      return {
        actualReturnType: "int",
        initialParams: "int argc, char *argv[]",
      };
    }

    // For main() without args, always use int return type for C++ compatibility
    const actualReturnType = name === "main" ? "int" : returnType;
    return { actualReturnType, initialParams: "" };
  }

  /**
   * Process parameter list and register parameters in state.
   */
  static processParameterList(
    params: Parser.ParameterListContext | null,
    callbacks: IFunctionContextCallbacks,
  ): void {
    CodeGenState.currentParameters.clear();
    if (!params) return;

    const paramList = params.parameter();
    for (let i = 0; i < paramList.length; i++) {
      FunctionContextManager.processParameter(paramList[i], callbacks, i);
    }
  }

  /**
   * Process a single parameter declaration.
   */
  static processParameter(
    param: Parser.ParameterContext,
    callbacks: IFunctionContextCallbacks,
    paramIndex: number,
  ): void {
    const name = param.IDENTIFIER().getText();
    // Check both C-Next style (u8[8] param) and legacy style (u8 param[8])
    const isArray =
      param.arrayDimension().length > 0 || param.type().arrayType() !== null;
    const isConst = param.constModifier() !== null;
    const typeCtx = param.type();

    // Resolve type information
    const typeInfo = FunctionContextManager.resolveParameterTypeInfo(
      typeCtx,
      callbacks,
    );

    // Issue #895: For callback-compatible functions, check the typedef signature
    // to determine if the param should be a pointer or value
    const callbackTypedefInfo =
      FunctionContextManager.getCallbackTypedefParamInfo(paramIndex);
    const isCallbackPointerParam =
      callbackTypedefInfo?.shouldBePointer ?? false;

    // Issue #958: Check if type is a typedef'd struct from C headers
    const isTypedefStruct =
      callbacks.isTypedefStructType?.(typeInfo.typeName) ?? false;

    // Determine isStruct: for callback-compatible params, both typedef AND type info matter
    // - If typedef says pointer AND it's actually a struct, use -> access (isStruct=true)
    // - If typedef says pointer BUT it's a primitive (like u8), don't treat as struct
    //   (primitives use forcePointerSemantics for dereference instead)
    // Issue #958: C-header typedef struct types are always treated as struct (pointer semantics)
    const isStruct = callbackTypedefInfo
      ? isCallbackPointerParam && typeInfo.isStruct
      : typeInfo.isStruct || isTypedefStruct;

    // Issue #895: Primitive types that become pointers need dereferencing when used as values
    // e.g., "u8 buf" becoming "uint8_t* buf" requires "*buf" when accessing the value
    const isCallbackPointerPrimitive =
      isCallbackPointerParam && !typeInfo.isStruct && !isArray;

    // Issue #958: typedef struct params need pointer semantics (like callback pointer params)
    const forcePointerSemantics = isCallbackPointerParam || isTypedefStruct;

    // Register in currentParameters
    const paramInfo = {
      name,
      baseType: typeInfo.typeName,
      isArray,
      isStruct,
      isConst,
      isCallback: typeInfo.isCallback,
      isString: typeInfo.isString,
      isCallbackPointerPrimitive,
      // Issue #895/#958: Force pointer semantics for callback-compatible and typedef struct params
      forcePointerSemantics,
    };
    CodeGenState.currentParameters.set(name, paramInfo);

    // Register in typeRegistry
    FunctionContextManager.registerParameterType(
      name,
      typeInfo,
      param,
      isArray,
      isConst,
      isTypedefStruct,
    );
  }

  /**
   * Resolve type name and flags from a type context.
   */
  static resolveParameterTypeInfo(
    typeCtx: Parser.TypeContext,
    callbacks: IFunctionContextCallbacks,
  ): IParameterTypeInfo {
    // Strings are special and stay explicit: a top-level `string<32>` parameter
    // reports the bare "string" (its capacity travels separately through
    // stringCapacities), while a string ARRAY element keeps "string<32>". That
    // asymmetry is load-bearing, so it is preserved rather than folded in.
    const topLevelString = typeCtx.stringType();
    if (topLevelString) {
      return {
        typeName: "string",
        isStruct: false,
        isCallback: false,
        isString: true,
      };
    }
    const arrayString = typeCtx.arrayType()?.stringType();
    if (arrayString) {
      return {
        typeName: arrayString.getText(),
        isStruct: false,
        isCallback: false,
        isString: true,
      };
    }

    const primitive =
      typeCtx.primitiveType() ?? typeCtx.arrayType()?.primitiveType();
    if (primitive) {
      return {
        typeName: primitive.getText(),
        isStruct: false,
        isCallback: false,
        isString: false,
      };
    }

    // #1285: one ladder for the NAME, then ONE derivation of its consequences.
    // Previously each of the six branches decided isStruct/isCallback for
    // itself, so `isCallback` was hardcoded false in the scoped, qualified and
    // global branches, and `arrayType().userType()` skipped the ADR-057
    // qualification that the bare `userType()` branch applied -- `Mode[4] p`
    // and `Mode p` in the same scope resolved to different names.
    const deps = {
      isScopeType: (qualifiedName: string): boolean =>
        CodeGenState.isScopeType(qualifiedName),
      resolveQualifiedType: (parts: string[]): string =>
        callbacks.resolveQualifiedType(parts),
    };
    const arrayTypeCtx = typeCtx.arrayType();
    const typeName =
      TypeBinding.resolveNamedType(typeCtx, CodeGenState.currentScope, deps) ??
      (arrayTypeCtx
        ? TypeBinding.resolveNamedType(
            arrayTypeCtx,
            CodeGenState.currentScope,
            deps,
          )
        : null);

    // What is left is `templateType` and `void`. Neither is a symbol name, and
    // querying knownStructs/callbackTypes with mangled template text
    // (`FlexCAN_T4<CAN1,RX_SIZE_256,TX_SIZE_16>`) only fails to match by
    // construction of those lookups rather than by intent.
    if (typeName === null) {
      return {
        typeName: typeCtx.getText(),
        isStruct: false,
        isCallback: false,
        isString: false,
      };
    }

    return {
      typeName,
      isStruct: callbacks.isStructType(typeName),
      isCallback: CodeGenState.callbackTypes.has(typeName),
      isString: false,
    };
  }

  /**
   * Register a parameter in the type registry.
   */
  static registerParameterType(
    name: string,
    typeInfo: IParameterTypeInfo,
    param: Parser.ParameterContext,
    isArray: boolean,
    isConst: boolean,
    isTypedefStruct = false,
  ): void {
    const { typeName, isString } = typeInfo;
    const typeCtx = param.type();

    const isEnum = CodeGenState.symbols!.knownEnums.has(typeName);
    const isBitmap = CodeGenState.symbols!.knownBitmaps.has(typeName);

    // Extract array dimensions
    const arrayDimensions = FunctionContextManager.extractParamArrayDimensions(
      param,
      typeCtx,
      isArray,
    );

    // Add string capacity dimension if applicable
    const stringCapacity = FunctionContextManager.getStringCapacity(
      typeCtx,
      isString,
    );
    if (isArray && stringCapacity !== undefined) {
      arrayDimensions.push(stringCapacity + 1);
    }

    const registeredType = {
      baseType: typeName,
      bitWidth: isBitmap
        ? CodeGenState.symbols!.bitmapBitWidth.get(typeName) || 0
        : TYPE_WIDTH[typeName] || 0,
      isArray,
      arrayDimensions: arrayDimensions.length > 0 ? arrayDimensions : undefined,
      isConst,
      isEnum,
      enumTypeName: isEnum ? typeName : undefined,
      isBitmap,
      bitmapTypeName: isBitmap ? typeName : undefined,
      isString,
      stringCapacity,
      isParameter: true,
      // Issue #958: typedef struct params are already pointers — prevent &arg in call sites
      ...(isTypedefStruct && { isPointer: true }),
    };
    CodeGenState.setVariableTypeInfo(name, registeredType);
  }

  /**
   * Extract array dimensions from parameter (C-style or C-Next style).
   */
  static extractParamArrayDimensions(
    param: Parser.ParameterContext,
    typeCtx: Parser.TypeContext,
    isArray: boolean,
  ): number[] {
    if (!isArray) return [];

    // Try C-style first (param.arrayDimension())
    if (param.arrayDimension().length > 0) {
      return ArrayDimensionParser.parseDimensions(
        param.arrayDimension(),
        dimensionEvalOptions(),
      );
    }

    // C-Next style: get dimensions from arrayType
    const arrayTypeCtx = typeCtx.arrayType();
    if (!arrayTypeCtx) return [];

    const dimensions: number[] = [];
    for (const dim of arrayTypeCtx.arrayTypeDimension()) {
      const expr = dim.expression();
      if (!expr) continue;
      // Issue #1159: fold through the shared evaluator, and keep the slot when
      // the size does not fold so dimension i still matches subscript i.
      //
      // parseIntegerLiteral alone folds literals only, so a const-sized
      // parameter recorded UNRESOLVED_DIMENSION and lost ADR-036 bounds
      // checking while ParameterInputAdapter folded the same const for the
      // signature -- `void fill(u8[SIZE] buf)` emitted `uint8_t buf[6]` and
      // still accepted `buf[9]`.
      const size = ArrayDimensionParser.parseSingleDimension(
        expr,
        dimensionEvalOptions(),
      );
      dimensions.push(size ?? UNRESOLVED_DIMENSION);
    }
    return dimensions;
  }

  /**
   * Issue #895: Get callback typedef parameter info from the C header.
   * Returns null if not callback-compatible or index is invalid.
   */
  static getCallbackTypedefParamInfo(
    paramIndex: number,
  ): { shouldBePointer: boolean; shouldBeConst: boolean } | null {
    if (CodeGenState.currentFunctionName === null) return null;

    const typedefName = CodeGenState.callbackCompatibleFunctions.get(
      CodeGenState.currentFunctionName,
    );
    if (!typedefName) return null;

    const typedefType = CodeGenState.getTypedefType(typedefName);
    if (!typedefType) return null;

    const shouldBePointer = TypedefParamParser.shouldBePointer(
      typedefType,
      paramIndex,
    );
    const shouldBeConst = TypedefParamParser.shouldBeConst(
      typedefType,
      paramIndex,
    );

    if (shouldBePointer === null) return null;

    return {
      shouldBePointer,
      shouldBeConst: shouldBeConst ?? false,
    };
  }

  /**
   * Extract string capacity from a string type context.
   */
  static getStringCapacity(
    typeCtx: Parser.TypeContext,
    isString: boolean,
  ): number | undefined {
    if (!isString) return undefined;

    // Check direct stringType (e.g., string<32> param)
    if (typeCtx.stringType()) {
      const intLiteral = typeCtx.stringType()!.INTEGER_LITERAL();
      if (intLiteral) {
        return Number.parseInt(intLiteral.getText(), 10);
      }
    }

    // Check arrayType with stringType (e.g., string<32>[5] param)
    if (typeCtx.arrayType()?.stringType()) {
      const intLiteral = typeCtx.arrayType()!.stringType()!.INTEGER_LITERAL();
      if (intLiteral) {
        return Number.parseInt(intLiteral.getText(), 10);
      }
    }

    return undefined;
  }

  /**
   * Clear parameter tracking when leaving a function.
   */
  static clearParameters(): void {
    // ADR-025: Remove parameter types from typeRegistry
    for (const name of CodeGenState.currentParameters.keys()) {
      CodeGenState.deleteVariableTypeInfo(name);
    }
    CodeGenState.currentParameters.clear();
    CodeGenState.localArrays.clear();
  }

  /**
   * Enter function body - clears local variables and sets inFunctionBody flag.
   * This is a simpler version used when only body lifecycle is needed.
   */
  static enterFunctionBody(): void {
    CodeGenState.enterFunctionBody();
  }

  /**
   * Exit function body - clears local variables and inFunctionBody flag.
   * This is a simpler version used when only body lifecycle is needed.
   */
  static exitFunctionBody(): void {
    CodeGenState.mainArgsName = null;
    CodeGenState.exitFunctionBody();
  }
}

export default FunctionContextManager;
