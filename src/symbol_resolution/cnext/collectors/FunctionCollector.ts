/**
 * FunctionCollector - Extracts function declarations from parse trees.
 * Handles return types, parameters, visibility, and signature generation.
 */

import * as Parser from "../../../antlr_parser/grammar/CNextParser";
import ESourceLanguage from "../../../types/ESourceLanguage";
import ESymbolKind from "../../../types/ESymbolKind";
import IFunctionSymbol from "../../types/IFunctionSymbol";
import IParameterInfo from "../../types/IParameterInfo";
import TypeUtils from "../utils/TypeUtils";

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
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: visibility === "public",
      kind: ESymbolKind.Function,
      returnType,
      parameters,
      visibility,
      signature,
    };
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

      const arrayDims = p.arrayDimension();
      const isArray = arrayDims.length > 0;

      // Extract array dimensions as strings (can contain expressions like SIZE)
      const arrayDimensions: string[] = [];
      if (isArray) {
        for (const dim of arrayDims) {
          const text = dim.getText();
          const match = text.match(/\[([^\]]*)\]/);
          arrayDimensions.push(match ? match[1] : ""); // "" means unbounded
        }
      }

      const paramInfo: IParameterInfo = {
        name,
        type,
        isConst,
        isArray,
      };

      if (arrayDimensions.length > 0) {
        paramInfo.arrayDimensions = arrayDimensions;
      }

      return paramInfo;
    });
  }
}

export default FunctionCollector;
