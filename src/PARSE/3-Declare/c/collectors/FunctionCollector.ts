/**
 * FunctionCollector - Collects function symbols from C parse trees.
 */

import type {
  DeclaratorContext,
  FunctionDefinitionContext,
} from "../../../../transpiler/logic/parser/c/grammar/CParser";
import type ICFunctionSymbol from "../../../../transpiler/types/symbols/c/ICFunctionSymbol";
import type ICParameterInfo from "../../../../transpiler/types/symbols/c/ICParameterInfo";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import DeclaratorUtils from "../utils/DeclaratorUtils";
import type IExtractedParameter from "../../shared/IExtractedParameter";
import type ISourceSpan from "../../../../transpiler/types/ISourceSpan";
import ParserUtils from "../../../../utils/ParserUtils";

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
   * Resolve return type, appending '*' if declarator has a pointer.
   * Issue #895 Bug B / Issue #945: C grammar puts pointer before directDeclarator
   * (e.g., `widget_t *func()` has declarator.pointer() !== null)
   */
  private static _resolveReturnType(
    baseType: string,
    declarator: DeclaratorContext,
  ): string {
    const hasPointer = declarator.pointer() !== null;
    return hasPointer ? `${baseType}*` : baseType;
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

    const span = ParserUtils.getSpan(funcDef);

    // Get return type from declaration specifiers
    const declSpecs = funcDef.declarationSpecifiers();
    const baseType = declSpecs
      ? DeclaratorUtils.extractTypeFromDeclSpecs(declSpecs)
      : "int";

    const returnType = FunctionCollector._resolveReturnType(
      baseType,
      declarator,
    );

    const parameters = FunctionCollector._mapParameters(
      DeclaratorUtils.extractFunctionParameters(declarator),
    );

    return {
      kind: "function",
      name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
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
   * @param span Source span of the declaration
   */
  static collectFromDeclaration(
    name: string,
    baseType: string,
    declarator: DeclaratorContext,
    sourceFile: string,
    span: ISourceSpan,
  ): ICFunctionSymbol {
    const parameters = FunctionCollector._mapParameters(
      DeclaratorUtils.extractFunctionParameters(declarator),
    );

    const returnType = FunctionCollector._resolveReturnType(
      baseType,
      declarator,
    );

    return {
      kind: "function",
      name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      type: returnType,
      parameters: parameters.length > 0 ? parameters : undefined,
      isDeclaration: true,
    };
  }
}

export default FunctionCollector;
