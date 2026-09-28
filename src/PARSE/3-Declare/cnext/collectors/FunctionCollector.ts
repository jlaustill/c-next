/**
 * FunctionCollector - Extracts function declarations from parse trees.
 * Handles return types, parameters, visibility, and signature generation.
 *
 * Produces TType-based IFunctionSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../2-Parse/grammar/CNextParser";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IFunctionSymbol from "../../../../transpiler/types/symbols/IFunctionSymbol";
import IParameterInfo from "../../../../transpiler/types/symbols/IParameterInfo";
import TypeUtils from "../utils/TypeUtils";
import SymbolRegistry from "../../SymbolRegistry";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TVisibility from "../../../../transpiler/types/TVisibility";
import ParserUtils from "../../../../utils/ParserUtils";
import DimensionResolver from "../utils/DimensionResolver";

class FunctionCollector {
  /**
   * Collect a function declaration and return an IFunctionSymbol.
   *
   * @param ctx The function declaration context
   * @param sourceFile Source file path
   * @param scopePath The path of the scope this function belongs to (dotted path, "" at file scope)
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
    visibility: TVisibility,
    isScopeType?: (qualifiedName: string) => boolean,
  ): IFunctionSymbol {
    const name = ctx.IDENTIFIER().getText();
    const span = ParserUtils.getSpan(ctx);

    // Get return type string and convert to TType
    const returnTypeCtx = ctx.type();
    // #1298: members carry the scope's PATH, not the scope object. The path
    // holds every outer component, so nothing downstream can flatten it to a
    // leaf -- which is what the reference threaded here used to protect against.
    // #1472: `resolveType` defers a bare name this file cannot settle instead
    // of guessing it, so 1.4 Resolve can apply ADR-057 with the whole-program
    // scope-type set. Everything it can settle resolves exactly as before.
    const returnType = TypeUtils.resolveType(
      returnTypeCtx,
      scopePath,
      isScopeType,
    );

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
      sourceFile,
      span,
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
   * @param visibility Required: #1161 — a default here is a third source
   *   of truth for ADR-016 and drifted from it. Callers pass
   *   ScopeUtils.getDefaultVisibility() or an explicit keyword.
   * @param isScopeType ADR-057 predicate: is this *qualified* name a scope type?
   * @returns The function symbol
   */
  static collectAndRegister(
    registry: SymbolRegistry,
    ctx: Parser.FunctionDeclarationContext,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
    isScopeType?: (qualifiedName: string) => boolean,
  ): IFunctionSymbol {
    // 1. Get or create the scope in SymbolRegistry

    // 2. Collect function with TType-based types and scope reference
    const symbol = FunctionCollector.collect(
      ctx,
      sourceFile,
      scopePath,
      visibility,
      isScopeType,
    );

    // 3. Register in SymbolRegistry
    registry.registerFunction(symbol);

    return symbol;
  }

  /**
   * Extract parameter information from parameter contexts.
   * Converts type strings to TType.
   */
  static collectParameters(
    params: Parser.ParameterContext[],
    scopePath = "",
    isScopeType?: (qualifiedName: string) => boolean,
  ): IParameterInfo[] {
    return params.map((p) => {
      const name = p.IDENTIFIER().getText();
      const typeCtx = p.type();
      const type = TypeUtils.resolveType(typeCtx, scopePath, isScopeType);
      const isConst = p.constModifier() !== null;

      // Check for C-Next style array type (u8[8] param, u8[4][4] param, u8[] param)
      const arrayTypeCtx = typeCtx.arrayType();
      // #1668: and the C-style dimensions E0874 admits for `main(string
      // args[])`, which this dropped -- so the declaration read `args` as a
      // scalar while the function's own plan read it as an array
      const cStyleDimensions = p.arrayDimension();
      const isArray = arrayTypeCtx !== null || cStyleDimensions.length > 0;

      // Each dimension folds as a declaration's does (#1760 review): parseInt
      // read `2*BUF` as 2 and `0x10` as 0, so the prototype disagreed with
      // the definition and a subscript was checked against the wrong size.
      // An unsized `[]` keeps its slot as "".
      const arrayDimensions: (number | string)[] = [
        ...(arrayTypeCtx?.arrayTypeDimension() ?? []),
        ...cStyleDimensions,
      ].map((dim) => {
        const sizeExpr = dim.expression();
        return sizeExpr ? DimensionResolver.resolve(sizeExpr) : "";
      });

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
