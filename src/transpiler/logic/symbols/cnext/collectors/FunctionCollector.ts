/**
 * FunctionCollector - Extracts function declarations from parse trees.
 * Handles return types, parameters, visibility, and signature generation.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ESymbolKind from "../../../../../utils/types/ESymbolKind";
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
      parent: scopeName,
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
