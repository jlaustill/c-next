/**
 * FunctionCollector - C++ function symbols from 1.2's lowered header (#1991).
 */

import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import CppNamespaceUtils from "../../../../utils/CppNamespaceUtils";
import ICppFunctionSymbol from "../../../../types/symbols/cpp/ICppFunctionSymbol";
import ICppParameterInfo from "../../../../types/symbols/cpp/ICppParameterInfo";
import type IExtractedParameter from "../../../2-Parse/shared/IExtractedParameter";
import type ICppFunctionDefinitionSyntax from "../../../2-Parse/types/ICppFunctionDefinitionSyntax";
import type IHeaderDeclaratorSyntax from "../../../2-Parse/types/IHeaderDeclaratorSyntax";
import type ISourceSpan from "../../../../types/ISourceSpan";

class FunctionCollector {
  private static _mapParameters(
    extracted: readonly IExtractedParameter[],
  ): ICppParameterInfo[] {
    return extracted.map((p) => ({
      name: p.name,
      type: p.type,
      isConst: p.isConst,
      isArray: p.isArray,
    }));
  }

  /** A function definition at namespace scope; null when it has no name */
  static collectDefinition(
    funcDef: ICppFunctionDefinitionSyntax,
    sourceFile: string,
    currentNamespace?: string,
  ): ICppFunctionSymbol | null {
    const name = funcDef.declarator.name;
    if (!name) return null;
    const params = FunctionCollector._mapParameters(
      funcDef.declarator.parameters,
    );
    return {
      kind: "function",
      name: CppNamespaceUtils.qualify(currentNamespace, name),
      type: funcDef.returnType,
      sourceFile,
      span: funcDef.span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
      parameters: params.length > 0 ? params : undefined,
      isDeclaration: false,
    };
  }

  /** A function prototype; null when its declarator has no name */
  static collectDeclaration(
    declarator: IHeaderDeclaratorSyntax,
    baseType: string,
    sourceFile: string,
    span: ISourceSpan,
    currentNamespace?: string,
  ): ICppFunctionSymbol | null {
    const name = declarator.name;
    if (!name) return null;
    const params = FunctionCollector._mapParameters(declarator.parameters);
    return {
      kind: "function",
      name: CppNamespaceUtils.qualify(currentNamespace, name),
      type: baseType,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
      parameters: params.length > 0 ? params : undefined,
      isDeclaration: true,
    };
  }

  /** A member function, declared or defined inline in its class */
  static collectMemberFunction(
    className: string,
    funcName: string,
    declarator: IHeaderDeclaratorSyntax,
    returnType: string,
    sourceFile: string,
    span: ISourceSpan,
    isDeclaration: boolean,
  ): ICppFunctionSymbol {
    const params = FunctionCollector._mapParameters(declarator.parameters);
    return {
      kind: "function",
      name: CppNamespaceUtils.qualify(className, funcName),
      type: returnType,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: className,
      parameters: params.length > 0 ? params : undefined,
      isDeclaration: isDeclaration || undefined,
    };
  }
}

export default FunctionCollector;
