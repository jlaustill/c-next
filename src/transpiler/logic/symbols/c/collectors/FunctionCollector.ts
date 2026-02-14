/**
 * FunctionCollector - Collects function symbols from C parse trees.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { FunctionDefinitionContext } from "../../../parser/c/grammar/CParser";
import type ICFunctionSymbol from "../../../../types/symbols/c/ICFunctionSymbol";
import type ICParameterInfo from "../../../../types/symbols/c/ICParameterInfo";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import DeclaratorUtils from "../utils/DeclaratorUtils";
import type IExtractedParameter from "../../shared/IExtractedParameter";

class FunctionCollector {
  /**
   * Map extracted parameters to ICParameterInfo array.
   */
  private static _mapParameters(
    extracted: IExtractedParameter[],
  ): ICParameterInfo[] {
    return extracted.map((p) => ({
      name: p.name,
      type: p.type,
      isConst: p.isConst,
      isArray: p.isArray,
    }));
  }

  /**
   * Collect a function symbol from a function definition.
   *
   * @param funcDef The function definition context
   * @param sourceFile Source file path
   */
  static collectFromDefinition(
    funcDef: FunctionDefinitionContext,
    sourceFile: string,
  ): ICFunctionSymbol | null {
    const declarator = funcDef.declarator();
    if (!declarator) return null;

    const name = DeclaratorUtils.extractDeclaratorName(declarator);
    if (!name) return null;

    const line = funcDef.start?.line ?? 0;

    // Get return type from declaration specifiers
    const declSpecs = funcDef.declarationSpecifiers();
    const returnType = declSpecs
      ? DeclaratorUtils.extractTypeFromDeclSpecs(declSpecs)
      : "int";

    const parameters = FunctionCollector._mapParameters(
      DeclaratorUtils.extractFunctionParameters(declarator),
    );

    return {
      kind: "function",
      name,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.C,
      isExported: true,
      type: returnType,
      parameters: parameters.length > 0 ? parameters : undefined,
      isDeclaration: false,
    };
  }

  /**
   * Collect a function symbol from a declaration (prototype).
   *
   * @param name Function name
   * @param baseType Return type
   * @param declarator The declarator context
   * @param sourceFile Source file path
   * @param line Source line number
   * @param isExtern Whether the function is extern
   */
  static collectFromDeclaration(
    name: string,
    baseType: string,
    declarator: any,
    sourceFile: string,
    line: number,
    isExtern: boolean,
  ): ICFunctionSymbol {
    const parameters = FunctionCollector._mapParameters(
      DeclaratorUtils.extractFunctionParameters(declarator),
    );

    return {
      kind: "function",
      name,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.C,
      isExported: !isExtern,
      type: baseType,
      parameters: parameters.length > 0 ? parameters : undefined,
      isDeclaration: true,
    };
  }
}

export default FunctionCollector;
