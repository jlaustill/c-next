/**
 * VariableCollector - C++ variable symbols from 1.2's lowered header (#1991).
 */

import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import CppNamespaceUtils from "../../../../utils/CppNamespaceUtils";
import ICppVariableSymbol from "../../../../types/symbols/cpp/ICppVariableSymbol";
import type IHeaderDeclaratorSyntax from "../../../2-Parse/types/IHeaderDeclaratorSyntax";
import type ISourceSpan from "../../../../types/ISourceSpan";

class VariableCollector {
  /** A variable; null when its declarator has no name */
  static collect(
    declarator: IHeaderDeclaratorSyntax,
    baseType: string,
    sourceFile: string,
    span: ISourceSpan,
    currentNamespace?: string,
  ): ICppVariableSymbol | null {
    const name = declarator.name;
    if (!name) return null;
    const arrayDimensions = [...declarator.arrayDimensions];
    return {
      kind: "variable",
      name: CppNamespaceUtils.qualify(currentNamespace, name),
      type: baseType,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
      isArray: arrayDimensions.length > 0 ? true : undefined,
      arrayDimensions: arrayDimensions.length > 0 ? arrayDimensions : undefined,
    };
  }
}

export default VariableCollector;
