/**
 * FunctionCollector - Extracts function definitions and declarations from C++ parse trees.
 *
 * Produces ICppFunctionSymbol instances with parameters.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ICppFunctionSymbol from "../../../../types/symbols/cpp/ICppFunctionSymbol";
import ICppParameterInfo from "../../../../types/symbols/cpp/ICppParameterInfo";
import DeclaratorUtils from "../utils/DeclaratorUtils";

class FunctionCollector {
  /**
   * Collect a function definition and return an ICppFunctionSymbol.
   *
   * @param funcDef The function definition context
   * @param sourceFile Source file path
   * @param line Line number
   * @param currentNamespace Optional current namespace
   * @returns The function symbol or null if no name
   */
  static collectDefinition(
    funcDef: any,
    sourceFile: string,
    line: number,
    currentNamespace?: string,
  ): ICppFunctionSymbol | null {
    const declarator = funcDef.declarator?.();
    if (!declarator) return null;

    const name = DeclaratorUtils.extractDeclaratorName(declarator);
    if (!name) return null;

    // Get return type
    const declSpecSeq = funcDef.declSpecifierSeq?.();
    const returnType = declSpecSeq
      ? DeclaratorUtils.extractTypeFromDeclSpecSeq(declSpecSeq)
      : "void";

    const fullName = currentNamespace ? `${currentNamespace}::${name}` : name;

    // Extract function parameters
    const extractedParams =
      DeclaratorUtils.extractFunctionParameters(declarator);
    const params: ICppParameterInfo[] = extractedParams.map((p) => ({
      name: p.name,
      type: p.type,
      isConst: p.isConst,
      isArray: p.isArray,
    }));

    return {
      kind: "function",
      name: fullName,
      type: returnType,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      parent: currentNamespace,
      parameters: params.length > 0 ? params : undefined,
      isDeclaration: false,
    };
  }

  /**
   * Collect a function declaration (prototype) and return an ICppFunctionSymbol.
   *
   * @param declarator The function declarator context
   * @param baseType The return type string
   * @param sourceFile Source file path
   * @param line Line number
   * @param currentNamespace Optional current namespace
   * @returns The function symbol or null if no name
   */
  static collectDeclaration(
    declarator: any,
    baseType: string,
    sourceFile: string,
    line: number,
    currentNamespace?: string,
  ): ICppFunctionSymbol | null {
    const name = DeclaratorUtils.extractDeclaratorName(declarator);
    if (!name) return null;

    const fullName = currentNamespace ? `${currentNamespace}::${name}` : name;

    // Extract function parameters
    const extractedParams =
      DeclaratorUtils.extractFunctionParameters(declarator);
    const params: ICppParameterInfo[] = extractedParams.map((p) => ({
      name: p.name,
      type: p.type,
      isConst: p.isConst,
      isArray: p.isArray,
    }));

    return {
      kind: "function",
      name: fullName,
      type: baseType,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      parent: currentNamespace,
      parameters: params.length > 0 ? params : undefined,
      isDeclaration: true,
    };
  }

  /**
   * Collect a member function (method) and return an ICppFunctionSymbol.
   *
   * @param className The class this method belongs to
   * @param funcName The method name
   * @param declarator The function declarator context
   * @param returnType The return type string
   * @param sourceFile Source file path
   * @param line Line number
   * @param isDeclaration Whether this is a declaration (vs inline definition)
   * @returns The function symbol
   */
  static collectMemberFunction(
    className: string,
    funcName: string,
    declarator: any,
    returnType: string,
    sourceFile: string,
    line: number,
    isDeclaration: boolean,
  ): ICppFunctionSymbol {
    // Extract function parameters
    const extractedParams =
      DeclaratorUtils.extractFunctionParameters(declarator);
    const params: ICppParameterInfo[] = extractedParams.map((p) => ({
      name: p.name,
      type: p.type,
      isConst: p.isConst,
      isArray: p.isArray,
    }));

    return {
      kind: "function",
      name: `${className}::${funcName}`,
      type: returnType,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      parent: className,
      parameters: params.length > 0 ? params : undefined,
      isDeclaration: isDeclaration || undefined,
    };
  }
}

export default FunctionCollector;
