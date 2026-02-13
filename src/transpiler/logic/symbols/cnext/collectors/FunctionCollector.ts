/**
 * FunctionCollector - Extracts function declarations from parse trees.
 * Handles return types, parameters, visibility, and signature generation.
 *
 * Produces TType-based IFunctionSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IFunctionSymbol from "../../../../types/symbols/IFunctionSymbol";
import IParameterInfo from "../../../../types/symbols/IParameterInfo";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import TypeResolver from "../../../../types/TypeResolver";
import TypeUtils from "../utils/TypeUtils";
import SymbolRegistry from "../../../../state/SymbolRegistry";

class FunctionCollector {
  /**
   * Collect a function declaration and return an IFunctionSymbol.
   *
   * @param ctx The function declaration context
   * @param sourceFile Source file path
   * @param scope The scope this function belongs to (IScopeSymbol)
   * @param body AST reference for the function body
   * @param visibility Visibility for scope functions (default "private")
   * @returns The function symbol with TType-based types and scope reference
   */
  static collect(
    ctx: Parser.FunctionDeclarationContext,
    sourceFile: string,
    scope: IScopeSymbol,
    body: Parser.BlockContext | null,
    visibility: "public" | "private" = "private",
  ): IFunctionSymbol {
    const name = ctx.IDENTIFIER().getText();
    const line = ctx.start?.line ?? 0;

    // Get return type string and convert to TType
    const returnTypeCtx = ctx.type();
    const scopeName = scope.name === "" ? undefined : scope.name;
    const returnTypeStr = TypeUtils.getTypeName(returnTypeCtx, scopeName);
    const returnType = TypeResolver.resolve(returnTypeStr);

    // Collect parameters with TType
    const params = ctx.parameterList()?.parameter() ?? [];
    const parameters = FunctionCollector.collectParameters(params, scopeName);

    return {
      kind: "function",
      name,
      scope,
      parameters,
      returnType,
      visibility,
      body,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: visibility === "public",
    };
  }

  /**
   * Collect a function declaration and register it in SymbolRegistry.
   *
   * This method:
   * 1. Gets or creates the appropriate scope in SymbolRegistry
   * 2. Collects the function with TType-based types
   * 3. Registers the function in that scope
   *
   * @param ctx The function declaration context
   * @param sourceFile Source file path
   * @param scopeName Optional scope name for nested functions
   * @param body AST reference for the function body
   * @param visibility Visibility for scope functions (default "private")
   * @returns The function symbol
   */
  static collectAndRegister(
    ctx: Parser.FunctionDeclarationContext,
    sourceFile: string,
    scopeName: string | undefined,
    body: Parser.BlockContext,
    visibility: "public" | "private" = "private",
  ): IFunctionSymbol {
    // 1. Get or create the scope in SymbolRegistry
    const scope = SymbolRegistry.getOrCreateScope(scopeName ?? "");

    // 2. Collect function with TType-based types and scope reference
    const symbol = FunctionCollector.collect(
      ctx,
      sourceFile,
      scope,
      body,
      visibility,
    );

    // 3. Register in SymbolRegistry
    SymbolRegistry.registerFunction(symbol);

    return symbol;
  }

  /**
   * Extract parameter information from parameter contexts.
   * Converts type strings to TType.
   */
  private static collectParameters(
    params: Parser.ParameterContext[],
    scopeName?: string,
  ): IParameterInfo[] {
    return params.map((p) => {
      const name = p.IDENTIFIER().getText();
      const typeCtx = p.type();
      const typeStr = TypeUtils.getTypeName(typeCtx, scopeName);
      const type = TypeResolver.resolve(typeStr);
      const isConst = p.constModifier() !== null;

      // Check for C-Next style array type (u8[8] param, u8[4][4] param, u8[] param)
      const arrayTypeCtx = typeCtx.arrayType();
      const isArray = arrayTypeCtx !== null;

      // Extract array dimensions from arrayType syntax (supports multi-dimensional)
      const arrayDimensions: (number | string)[] = [];
      if (isArray) {
        for (const dim of arrayTypeCtx.arrayTypeDimension()) {
          const sizeExpr = dim.expression();
          if (sizeExpr) {
            const dimStr = sizeExpr.getText();
            const dimNum = Number.parseInt(dimStr, 10);
            // Convert numeric strings to numbers, keep others as strings
            arrayDimensions.push(Number.isNaN(dimNum) ? dimStr : dimNum);
          } else {
            // Unbounded array dimension
            arrayDimensions.push("");
          }
        }
      }

      return {
        name,
        type,
        isConst,
        isArray,
        arrayDimensions:
          arrayDimensions.length > 0 ? arrayDimensions : undefined,
      };
    });
  }
}

export default FunctionCollector;
