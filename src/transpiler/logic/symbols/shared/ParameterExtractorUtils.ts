/**
 * ParameterExtractorUtils - Shared utilities for parameter extraction in C/C++.
 *
 * Contains common patterns for building parameter info from extracted values.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import IExtractedParameter from "./IExtractedParameter";

class ParameterExtractorUtils {
  /**
   * Process a list of parameter declarations and collect parameter info.
   *
   * @param paramList The parameter list context (from either C or C++ grammar)
   * @param extractInfo Function to extract parameter info from a single declaration
   * @returns Array of extracted parameters
   */
  static processParameterList(
    paramList: any,
    extractInfo: (paramDecl: any) => IExtractedParameter | null,
  ): IExtractedParameter[] {
    const params: IExtractedParameter[] = [];
    for (const paramDecl of paramList.parameterDeclaration?.() ?? []) {
      const paramInfo = extractInfo(paramDecl);
      if (paramInfo) {
        params.push(paramInfo);
      }
    }
    return params;
  }

  /**
   * Build extracted parameter info from intermediate values.
   *
   * @param declarator The declarator context
   * @param baseType The base type string
   * @param isConst Whether the parameter is const
   * @param isPointer Whether the parameter is a pointer
   * @param isArray Whether the parameter is an array
   * @param extractName Function to extract name from declarator
   * @returns The extracted parameter info
   */
  static buildParameterInfo(
    declarator: any,
    baseType: string,
    isConst: boolean,
    isPointer: boolean,
    isArray: boolean,
    extractName: (decl: any) => string | null,
  ): IExtractedParameter {
    // Append * to type if pointer
    const finalType = isPointer ? baseType + "*" : baseType;

    // Get parameter name (may be empty for abstract declarators)
    let paramName = "";
    if (declarator) {
      const name = extractName(declarator);
      if (name) {
        paramName = name;
      }
    }

    return {
      name: paramName,
      type: finalType,
      isConst,
      isArray,
    };
  }
}

export default ParameterExtractorUtils;
