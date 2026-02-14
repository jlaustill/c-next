/**
 * DeclaratorUtils - Shared utilities for extracting information from C++ declarators.
 *
 * Provides methods for extracting names, types, parameters, and array dimensions
 * from C++ parse tree declarator contexts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import SymbolUtils from "../../SymbolUtils";
import IExtractedParameter from "./IExtractedParameter";

class DeclaratorUtils {
  /**
   * Extract name from a declarator context.
   */
  static extractDeclaratorName(declarator: any): string | null {
    // Pointer declarator -> noPointerDeclarator
    const ptrDecl = declarator.pointerDeclarator?.();
    if (ptrDecl) {
      const noPtr = ptrDecl.noPointerDeclarator?.();
      if (noPtr) {
        return DeclaratorUtils.extractNoPointerDeclaratorName(noPtr);
      }
    }

    // No pointer declarator
    const noPtr = declarator.noPointerDeclarator?.();
    if (noPtr) {
      return DeclaratorUtils.extractNoPointerDeclaratorName(noPtr);
    }

    return null;
  }

  /**
   * Extract name from a noPointerDeclarator context.
   */
  static extractNoPointerDeclaratorName(noPtr: any): string | null {
    const declId = noPtr.declaratorid?.();
    if (declId) {
      const idExpr = declId.idExpression?.();
      if (idExpr) {
        const unqualId = idExpr.unqualifiedId?.();
        if (unqualId) {
          const identifier = unqualId.Identifier?.();
          if (identifier) {
            return identifier.getText();
          }
        }
      }
    }

    // Recursive case
    const innerNoPtr = noPtr.noPointerDeclarator?.();
    if (innerNoPtr) {
      return DeclaratorUtils.extractNoPointerDeclaratorName(innerNoPtr);
    }

    return null;
  }

  /**
   * Check if a declarator represents a function.
   */
  static declaratorIsFunction(declarator: any): boolean {
    const ptrDecl = declarator.pointerDeclarator?.();
    if (ptrDecl) {
      const noPtr = ptrDecl.noPointerDeclarator?.();
      if (noPtr?.parametersAndQualifiers?.()) {
        return true;
      }
    }

    const noPtr = declarator.noPointerDeclarator?.();
    if (noPtr?.parametersAndQualifiers?.()) {
      return true;
    }

    return false;
  }

  /**
   * Extract function parameters from a declarator.
   */
  static extractFunctionParameters(declarator: any): IExtractedParameter[] {
    const params: IExtractedParameter[] = [];

    // Find parametersAndQualifiers from the declarator
    let paramsAndQuals: any = null;
    const ptrDecl = declarator.pointerDeclarator?.();
    if (ptrDecl) {
      const noPtr = ptrDecl.noPointerDeclarator?.();
      paramsAndQuals = noPtr?.parametersAndQualifiers?.();
    }
    if (!paramsAndQuals) {
      const noPtr = declarator.noPointerDeclarator?.();
      paramsAndQuals = noPtr?.parametersAndQualifiers?.();
    }
    if (!paramsAndQuals) {
      return params;
    }

    // Get parameterDeclarationClause
    const paramClause = paramsAndQuals.parameterDeclarationClause?.();
    if (!paramClause) {
      return params;
    }

    // Get parameterDeclarationList
    const paramList = paramClause.parameterDeclarationList?.();
    if (!paramList) {
      return params;
    }

    // Iterate over parameterDeclaration entries
    for (const paramDecl of paramList.parameterDeclaration?.() ?? []) {
      const paramInfo = DeclaratorUtils.extractParameterInfo(paramDecl);
      if (paramInfo) {
        params.push(paramInfo);
      }
    }

    return params;
  }

  /**
   * Extract parameter info from a single parameter declaration.
   */
  static extractParameterInfo(paramDecl: any): IExtractedParameter | null {
    // Get the type from declSpecifierSeq
    const declSpecSeq = paramDecl.declSpecifierSeq?.();
    if (!declSpecSeq) {
      return null;
    }

    let baseType = DeclaratorUtils.extractTypeFromDeclSpecSeq(declSpecSeq);
    let isConst = false;
    let isPointer = false;

    // Check for const qualifier
    const declText = declSpecSeq.getText();
    if (declText.includes("const")) {
      isConst = true;
    }

    // Check for pointer in declarator or abstractDeclarator
    const declarator = paramDecl.declarator?.();
    const abstractDecl = paramDecl.abstractDeclarator?.();

    if (declarator) {
      if (DeclaratorUtils.declaratorHasPointer(declarator)) {
        isPointer = true;
      }
    }
    if (abstractDecl) {
      if (DeclaratorUtils.abstractDeclaratorHasPointer(abstractDecl)) {
        isPointer = true;
      }
    }

    // If pointer, append * to the type
    if (isPointer) {
      baseType = baseType + "*";
    }

    // Get parameter name (may be empty for abstract declarators)
    let paramName = "";
    if (declarator) {
      const name = DeclaratorUtils.extractDeclaratorName(declarator);
      if (name) {
        paramName = name;
      }
    }

    return {
      name: paramName,
      type: baseType,
      isConst,
      isArray: false, // Could be enhanced to detect arrays
    };
  }

  /**
   * Check if a declarator contains a pointer operator.
   */
  static declaratorHasPointer(declarator: any): boolean {
    const ptrDecl = declarator.pointerDeclarator?.();
    if (ptrDecl) {
      // Check for pointerOperator children
      const ptrOps = ptrDecl.pointerOperator?.();
      if (ptrOps && ptrOps.length > 0) {
        return true;
      }
      // Also check getText for *
      if (ptrDecl.getText().includes("*")) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if an abstract declarator contains a pointer.
   */
  static abstractDeclaratorHasPointer(abstractDecl: any): boolean {
    // Check for pointerAbstractDeclarator
    const ptrAbstract = abstractDecl.pointerAbstractDeclarator?.();
    if (ptrAbstract) {
      const ptrOps = ptrAbstract.pointerOperator?.();
      if (ptrOps && ptrOps.length > 0) {
        return true;
      }
      if (ptrAbstract.getText().includes("*")) {
        return true;
      }
    }
    // Simple check for * in the text
    if (abstractDecl.getText().includes("*")) {
      return true;
    }
    return false;
  }

  /**
   * Extract type string from a declSpecifierSeq context.
   */
  static extractTypeFromDeclSpecSeq(declSpecSeq: any): string {
    const parts: string[] = [];

    for (const spec of declSpecSeq.declSpecifier?.() ?? []) {
      const typeSpec = spec.typeSpecifier?.();
      if (typeSpec) {
        const trailingType = typeSpec.trailingTypeSpecifier?.();
        if (trailingType) {
          const simpleType = trailingType.simpleTypeSpecifier?.();
          if (simpleType) {
            parts.push(simpleType.getText());
          }
        }
      }
    }

    return parts.join(" ") || "int";
  }

  /**
   * Extract array dimensions from a declarator.
   */
  static extractArrayDimensions(declarator: any): number[] {
    // For C++, we need to check both pointer and no-pointer declarators
    const ptrDecl = declarator.pointerDeclarator?.();
    if (ptrDecl) {
      const noPtr = ptrDecl.noPointerDeclarator?.();
      if (noPtr) {
        return DeclaratorUtils.extractArrayDimensionsFromNoPtr(noPtr);
      }
    }

    const noPtr = declarator.noPointerDeclarator?.();
    if (noPtr) {
      return DeclaratorUtils.extractArrayDimensionsFromNoPtr(noPtr);
    }

    return [];
  }

  /**
   * Extract array dimensions from a noPointerDeclarator.
   */
  static extractArrayDimensionsFromNoPtr(noPtr: any): number[] {
    // Use shared utility for regex-based extraction
    return SymbolUtils.parseArrayDimensions(noPtr.getText());
  }
}

export default DeclaratorUtils;
