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
import TYPE_WIDTH from "../types/TYPE_WIDTH.js";
import ArrayDimensionParser from "./ArrayDimensionParser.js";
import IFunctionContextCallbacks from "../types/IFunctionContextCallbacks.js";

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
      ? `${CodeGenState.currentScope}_${name}`
      : name;
    CodeGenState.currentFunctionName = fullFuncName;

    // Issue #477: Set return type for enum inference in return statements
    CodeGenState.currentFunctionReturnType = ctx.type().getText();

    // Track parameters for ADR-006 pointer semantics
    FunctionContextManager.processParameterList(
      ctx.parameterList() ?? null,
      callbacks,
    );

    // ADR-016: Clear local variables and mark that we're in a function body
    CodeGenState.localVariables.clear();
    CodeGenState.floatBitShadows.clear();
    CodeGenState.floatShadowCurrent.clear();
    CodeGenState.inFunctionBody = true;
  }

  /**
   * Clean up context after function generation.
   * Resets all function-related state.
   */
  static cleanupFunctionContext(): void {
    CodeGenState.inFunctionBody = false;
    CodeGenState.localVariables.clear();
    CodeGenState.floatBitShadows.clear();
    CodeGenState.floatShadowCurrent.clear();
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

    for (const param of params.parameter()) {
      FunctionContextManager.processParameter(param, callbacks);
    }
  }

  /**
   * Process a single parameter declaration.
   */
  static processParameter(
    param: Parser.ParameterContext,
    callbacks: IFunctionContextCallbacks,
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

    // Register in currentParameters
    const paramInfo = {
      name,
      baseType: typeInfo.typeName,
      isArray,
      isStruct: typeInfo.isStruct,
      isConst,
      isCallback: typeInfo.isCallback,
      isString: typeInfo.isString,
    };
    CodeGenState.currentParameters.set(name, paramInfo);

    // Register in typeRegistry
    FunctionContextManager.registerParameterType(
      name,
      typeInfo,
      param,
      isArray,
      isConst,
    );
  }

  /**
   * Resolve type name and flags from a type context.
   */
  static resolveParameterTypeInfo(
    typeCtx: Parser.TypeContext,
    callbacks: IFunctionContextCallbacks,
  ): IParameterTypeInfo {
    if (typeCtx.primitiveType()) {
      return {
        typeName: typeCtx.primitiveType()!.getText(),
        isStruct: false,
        isCallback: false,
        isString: false,
      };
    }

    if (typeCtx.userType()) {
      const typeName = typeCtx.userType()!.getText();
      return {
        typeName,
        isStruct: callbacks.isStructType(typeName),
        isCallback: CodeGenState.callbackTypes.has(typeName),
        isString: false,
      };
    }

    if (typeCtx.qualifiedType()) {
      const identifierNames = typeCtx
        .qualifiedType()!
        .IDENTIFIER()
        .map((id) => id.getText());
      const typeName = callbacks.resolveQualifiedType(identifierNames);
      return {
        typeName,
        isStruct: callbacks.isStructType(typeName),
        isCallback: false,
        isString: false,
      };
    }

    if (typeCtx.scopedType()) {
      const localTypeName = typeCtx.scopedType()!.IDENTIFIER().getText();
      const typeName = CodeGenState.currentScope
        ? `${CodeGenState.currentScope}_${localTypeName}`
        : localTypeName;
      return {
        typeName,
        isStruct: callbacks.isStructType(typeName),
        isCallback: false,
        isString: false,
      };
    }

    if (typeCtx.globalType()) {
      const typeName = typeCtx.globalType()!.IDENTIFIER().getText();
      return {
        typeName,
        isStruct: callbacks.isStructType(typeName),
        isCallback: false,
        isString: false,
      };
    }

    if (typeCtx.stringType()) {
      return {
        typeName: "string",
        isStruct: false,
        isCallback: false,
        isString: true,
      };
    }

    // Handle C-Next style array type (u8[8] param) - extract base type
    if (typeCtx.arrayType()) {
      const arrayTypeCtx = typeCtx.arrayType()!;
      if (arrayTypeCtx.primitiveType()) {
        return {
          typeName: arrayTypeCtx.primitiveType()!.getText(),
          isStruct: false,
          isCallback: false,
          isString: false,
        };
      }
      if (arrayTypeCtx.userType()) {
        const typeName = arrayTypeCtx.userType()!.getText();
        return {
          typeName,
          isStruct: callbacks.isStructType(typeName),
          isCallback: CodeGenState.callbackTypes.has(typeName),
          isString: false,
        };
      }
      // Handle string array type (string<32>[5] param)
      if (arrayTypeCtx.stringType()) {
        const stringCtx = arrayTypeCtx.stringType()!;
        return {
          typeName: stringCtx.getText(), // "string<32>"
          isStruct: false,
          isCallback: false,
          isString: true,
        };
      }
    }

    // Fallback
    return {
      typeName: typeCtx.getText(),
      isStruct: false,
      isCallback: false,
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
      return ArrayDimensionParser.parseForParameters(param.arrayDimension());
    }

    // C-Next style: get dimensions from arrayType
    const arrayTypeCtx = typeCtx.arrayType();
    if (!arrayTypeCtx) return [];

    const dimensions: number[] = [];
    for (const dim of arrayTypeCtx.arrayTypeDimension()) {
      const expr = dim.expression();
      if (!expr) continue;
      const size = Number.parseInt(expr.getText(), 10);
      if (!Number.isNaN(size)) {
        dimensions.push(size);
      }
    }
    return dimensions;
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
    CodeGenState.localVariables.clear();
    CodeGenState.floatBitShadows.clear();
    CodeGenState.floatShadowCurrent.clear();
    CodeGenState.inFunctionBody = true;
    CodeGenState.enterFunctionBody();
  }

  /**
   * Exit function body - clears local variables and inFunctionBody flag.
   * This is a simpler version used when only body lifecycle is needed.
   */
  static exitFunctionBody(): void {
    CodeGenState.inFunctionBody = false;
    CodeGenState.localVariables.clear();
    CodeGenState.floatBitShadows.clear();
    CodeGenState.floatShadowCurrent.clear();
    CodeGenState.mainArgsName = null;
    CodeGenState.exitFunctionBody();
    CodeGenState.mainArgsName = null;
  }
}

export default FunctionContextManager;
