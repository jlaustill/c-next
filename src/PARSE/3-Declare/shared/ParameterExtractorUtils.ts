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
   * @param type The parameter's type, pointers included -- each grammar
   *   reads its own declarator for them
   * @param isConst Whether the parameter is const
   * @param isArray Whether the parameter is an array
   * @param extractName Function to extract name from declarator
   * @returns The extracted parameter info
   */
  static buildParameterInfo(
    declarator: any,
    type: string,
    isConst: boolean,
    isArray: boolean,
    extractName: (decl: any) => string | null,
  ): IExtractedParameter {
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
      type,
      isConst,
      isArray,
    };
  }
}

export default ParameterExtractorUtils;
