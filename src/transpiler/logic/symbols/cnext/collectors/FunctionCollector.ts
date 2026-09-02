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
import TypeResolver from "../../../../../utils/TypeResolver";
import TypeUtils from "../utils/TypeUtils";
import SymbolRegistry from "../../../../state/SymbolRegistry";
import ScopeUtils from "../../../../../utils/ScopeUtils";
import TVisibility from "../../../../types/TVisibility";

class FunctionCollector {
  /**
   * Collect a function declaration and return an IFunctionSymbol.
   *
   * @param ctx The function declaration context
   * @param sourceFile Source file path
   * @param scopePath The path of the scope this function belongs to (dotted path, "" at file scope)
   * @param body AST reference for the function body
   * @param visibility Required: #1161 — a default here is a third source
   *   of truth for ADR-016 and drifted from it. Callers pass
   *   ScopeUtils.getDefaultVisibility() or an explicit keyword.
   * @param isScopeType ADR-057 predicate: is this *qualified* name a scope type?
   * @returns The function symbol with TType-based types and scope reference
   */
  static collect(
    ctx: Parser.FunctionDeclarationContext,
    sourceFile: string,
    scopePath: string,
    body: Parser.BlockContext | null,
    visibility: TVisibility,
    isScopeType?: (qualifiedName: string) => boolean,
  ): IFunctionSymbol {
    const name = ctx.IDENTIFIER().getText();
    const line = ctx.start?.line ?? 0;

    // Get return type string and convert to TType
    const returnTypeCtx = ctx.type();
    // #1298: members carry the scope's PATH, not the scope object. The path
    // holds every outer component, so nothing downstream can flatten it to a
    // leaf -- which is what the reference threaded here used to protect against.
    const returnTypeStr = TypeUtils.getTypeName(
      returnTypeCtx,
      scopePath,
      isScopeType,
    );
    const returnType = TypeResolver.resolve(returnTypeStr);

    // Collect parameters with TType
    const params = ctx.parameterList()?.parameter() ?? [];
    const parameters = FunctionCollector.collectParameters(
      params,
      scopePath,
      isScopeType,
    );

    return {
      kind: "function",
      name,
      scopePath,
      // #1285: identity computed once, from the scope chain, not
      // re-derived by every consumer.
      ...ScopeUtils.identityOf({ name, scopePath }),
      parameters,
      returnType,
      visibility,
      body,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
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
   * @param scopePath Declaring scope path; carries every outer component
   * @param body AST reference for the function body
   * @param visibility Required: #1161 — a default here is a third source
   *   of truth for ADR-016 and drifted from it. Callers pass
   *   ScopeUtils.getDefaultVisibility() or an explicit keyword.
   * @param isScopeType ADR-057 predicate: is this *qualified* name a scope type?
   * @returns The function symbol
   */
  static collectAndRegister(
    ctx: Parser.FunctionDeclarationContext,
    sourceFile: string,
    scopePath: string,
    body: Parser.BlockContext,
    visibility: TVisibility,
    isScopeType?: (qualifiedName: string) => boolean,
  ): IFunctionSymbol {
    // 1. Get or create the scope in SymbolRegistry

    // 2. Collect function with TType-based types and scope reference
    const symbol = FunctionCollector.collect(
      ctx,
      sourceFile,
      scopePath,
      body,
      visibility,
      isScopeType,
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
    scopePath = "",
    isScopeType?: (qualifiedName: string) => boolean,
  ): IParameterInfo[] {
    return params.map((p) => {
      const name = p.IDENTIFIER().getText();
      const typeCtx = p.type();
      const typeStr = TypeUtils.getTypeName(typeCtx, scopePath, isScopeType);
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
