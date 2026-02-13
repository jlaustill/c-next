/**
 * FunctionCollector - Extracts function declarations from parse trees.
 * Handles return types, parameters, visibility, and signature generation.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IFunctionSymbol from "../../types/IFunctionSymbol";
import IParameterInfo from "../../types/IParameterInfo";
import TypeUtils from "../utils/TypeUtils";
import SymbolRegistry from "../../../../state/SymbolRegistry";
import FunctionSymbolAdapter from "../../../../types/FunctionSymbolAdapter";

class FunctionCollector {
  /**
   * Collect a function declaration and return an IFunctionSymbol.
   *
   * @param ctx The function declaration context
   * @param sourceFile Source file path
   * @param scopeName Optional scope name for nested functions
   * @param visibility Visibility for scope functions (default "private")
   * @returns The function symbol
   */
  static collect(
    ctx: Parser.FunctionDeclarationContext,
    sourceFile: string,
    scopeName?: string,
    visibility: "public" | "private" = "private",
  ): IFunctionSymbol {
    const name = ctx.IDENTIFIER().getText();
    const fullName = scopeName ? `${scopeName}_${name}` : name;
    const line = ctx.start?.line ?? 0;

    // Get return type
    const returnTypeCtx = ctx.type();
    const returnType = TypeUtils.getTypeName(returnTypeCtx, scopeName);

    // Collect parameters
    const params = ctx.parameterList()?.parameter() ?? [];
    const parameters = FunctionCollector.collectParameters(params, scopeName);

    // Generate signature for overload detection
    const paramTypes = parameters.map((p) => p.type);
    const signature = `${returnType} ${fullName}(${paramTypes.join(", ")})`;

    return {
      name: fullName,
      parent: scopeName,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: visibility === "public",
      kind: "function",
      returnType,
      parameters,
      visibility,
      signature,
    };
  }

  /**
   * Collect a function declaration and register it in SymbolRegistry.
   *
   * This method:
   * 1. Calls existing collect() to get old-style symbol
   * 2. Converts to new-style symbol via FunctionSymbolAdapter
   * 3. Gets or creates the appropriate scope in SymbolRegistry
   * 4. Registers the function in that scope
   *
   * @param ctx The function declaration context
   * @param sourceFile Source file path
   * @param scopeName Optional scope name for nested functions
   * @param visibility Visibility for scope functions (default "private")
   * @param body AST reference for the function body
   * @returns The old-style function symbol for backward compatibility
   */
  static collectAndRegister(
    ctx: Parser.FunctionDeclarationContext,
    sourceFile: string,
    scopeName: string | undefined,
    body: Parser.BlockContext,
    visibility: "public" | "private" = "private",
  ): IFunctionSymbol {
    // 1. Get old-style symbol via existing collect()
    const oldSymbol = FunctionCollector.collect(
      ctx,
      sourceFile,
      scopeName,
      visibility,
    );

    // 2. Get or create the scope in SymbolRegistry
    const scope = SymbolRegistry.getOrCreateScope(scopeName ?? "");

    // 3. Convert to new-style symbol
    const newSymbol = FunctionSymbolAdapter.toNew(oldSymbol, scope, body);

    // 4. Register in SymbolRegistry
    SymbolRegistry.registerFunction(newSymbol);

    // Return old-style symbol for backward compatibility
    return oldSymbol;
  }

  /**
   * Extract parameter information from parameter contexts.
   */
  private static collectParameters(
    params: Parser.ParameterContext[],
    scopeName?: string,
  ): IParameterInfo[] {
    return params.map((p) => {
      const name = p.IDENTIFIER().getText();
      const typeCtx = p.type();
      const type = TypeUtils.getTypeName(typeCtx, scopeName);
      const isConst = p.constModifier() !== null;

      // Check for C-Next style array type (u8[8] param, u8[4][4] param, u8[] param)
      const arrayTypeCtx = typeCtx.arrayType();
      const hasArrayType = arrayTypeCtx !== null;

      // Extract array dimensions from arrayType syntax (supports multi-dimensional)
      const arrayDimensions: string[] = [];
      if (hasArrayType) {
        for (const dim of arrayTypeCtx.arrayTypeDimension()) {
          const sizeExpr = dim.expression();
          arrayDimensions.push(sizeExpr ? sizeExpr.getText() : "");
        }
      }

      const paramInfo: IParameterInfo = {
        name,
        type,
        isConst,
        isArray: hasArrayType,
      };

      if (arrayDimensions.length > 0) {
        paramInfo.arrayDimensions = arrayDimensions;
      }

      return paramInfo;
    });
  }
}

export default FunctionCollector;
