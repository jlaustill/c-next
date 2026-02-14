/**
 * DeclaratorUtils - Shared utilities for extracting information from C declarators.
 *
 * Provides methods for extracting names, types, parameters, and array dimensions
 * from C parse tree declarator contexts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  DeclarationSpecifiersContext,
  StructOrUnionSpecifierContext,
  EnumSpecifierContext,
} from "../../../parser/c/grammar/CParser";
import SymbolUtils from "../../SymbolUtils";
import IExtractedParameter from "./IExtractedParameter";

class DeclaratorUtils {
  /**
   * Extract name from a declarator context.
   */
  static extractDeclaratorName(declarator: any): string | null {
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return null;

    return DeclaratorUtils.extractDirectDeclaratorName(directDecl);
  }

  /**
   * Extract identifier from directDeclarator, handling arrays and function pointers.
   * The C grammar has recursive directDeclarator for arrays: `directDeclarator '[' ... ']'`
   * so `buf[8]` is parsed as directDeclarator('[', directDeclarator('buf'), ']')
   */
  static extractDirectDeclaratorName(directDecl: any): string | null {
    // Check for identifier (base case)
    const identifier = directDecl.Identifier?.();
    if (identifier) {
      return identifier.getText();
    }

    // Nested declarator in parentheses: '(' declarator ')'
    const nestedDecl = directDecl.declarator?.();
    if (nestedDecl) {
      return DeclaratorUtils.extractDeclaratorName(nestedDecl);
    }

    // Nested directDeclarator for arrays/functions
    // Grammar: directDeclarator '[' ... ']' or directDeclarator '(' ... ')'
    const nestedDirectDecl = directDecl.directDeclarator?.();
    if (nestedDirectDecl) {
      return DeclaratorUtils.extractDirectDeclaratorName(nestedDirectDecl);
    }

    return null;
  }

  /**
   * Check if a declarator represents a function.
   */
  static declaratorIsFunction(declarator: any): boolean {
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return false;

    // Check for parameter type list (function with params) or empty parens
    // The C grammar: directDeclarator '(' parameterTypeList ')' | directDeclarator '(' identifierList? ')'
    if (directDecl.parameterTypeList?.() !== null) return true;

    // Check for LeftParen token - indicates function declarator even with empty params
    if (directDecl.LeftParen?.()) return true;

    return false;
  }

  /**
   * Extract function parameters from a declarator.
   */
  static extractFunctionParameters(declarator: any): IExtractedParameter[] {
    const params: IExtractedParameter[] = [];

    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return params;

    const paramTypeList = directDecl.parameterTypeList?.();
    if (!paramTypeList) return params;

    const paramList = paramTypeList.parameterList?.();
    if (!paramList) return params;

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
    const declSpecs = paramDecl.declarationSpecifiers?.();
    if (!declSpecs) return null;

    let baseType = DeclaratorUtils.extractTypeFromDeclSpecs(declSpecs);
    let isConst = false;
    let isPointer = false;
    let isArray = false;

    // Check for const qualifier
    const declText = declSpecs.getText();
    if (declText.includes("const")) {
      isConst = true;
    }

    // Check for pointer in declarator
    const declarator = paramDecl.declarator?.();
    if (declarator) {
      // Check for pointer operator
      if (declarator.pointer?.()) {
        isPointer = true;
      }
      // Check for array
      const directDecl = declarator.directDeclarator?.();
      if (directDecl) {
        const text = directDecl.getText();
        if (text.includes("[") && text.includes("]")) {
          isArray = true;
        }
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
      isArray,
    };
  }

  /**
   * Extract array dimensions from a declarator.
   */
  static extractArrayDimensions(declarator: any): number[] {
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return [];

    // Use shared utility for regex-based extraction
    return SymbolUtils.parseArrayDimensions(directDecl.getText());
  }

  /**
   * Extract type string from declaration specifiers.
   */
  static extractTypeFromDeclSpecs(
    declSpecs: DeclarationSpecifiersContext,
  ): string {
    const parts: string[] = [];

    for (const spec of declSpecs.declarationSpecifier()) {
      const typeSpec = spec.typeSpecifier();
      if (typeSpec) {
        parts.push(typeSpec.getText());
      }
    }

    return parts.join(" ") || "int";
  }

  /**
   * Check if declaration specifiers contain a specific storage class.
   */
  static hasStorageClass(
    declSpecs: DeclarationSpecifiersContext,
    storage: string,
  ): boolean {
    for (const spec of declSpecs.declarationSpecifier()) {
      const storageSpec = spec.storageClassSpecifier();
      if (storageSpec?.getText() === storage) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find struct or union specifier in declaration specifiers.
   */
  static findStructOrUnionSpecifier(
    declSpecs: DeclarationSpecifiersContext,
  ): StructOrUnionSpecifierContext | null {
    for (const spec of declSpecs.declarationSpecifier()) {
      const typeSpec = spec.typeSpecifier();
      if (typeSpec) {
        const structSpec = typeSpec.structOrUnionSpecifier?.();
        if (structSpec) {
          return structSpec;
        }
      }
    }
    return null;
  }

  /**
   * Find enum specifier in declaration specifiers.
   */
  static findEnumSpecifier(
    declSpecs: DeclarationSpecifiersContext,
  ): EnumSpecifierContext | null {
    for (const spec of declSpecs.declarationSpecifier()) {
      const typeSpec = spec.typeSpecifier();
      if (typeSpec) {
        const enumSpec = typeSpec.enumSpecifier?.();
        if (enumSpec) {
          return enumSpec;
        }
      }
    }
    return null;
  }

  /**
   * Extract type from specifierQualifierList (for struct fields).
   * For struct/union field types, extract just the identifier (e.g., "InnerConfig")
   * not the concatenated text ("structInnerConfig").
   */
  static extractTypeFromSpecQualList(specQualList: any): string {
    const parts: string[] = [];

    // Traverse the specifierQualifierList
    let current = specQualList;
    while (current) {
      const typeSpec = current.typeSpecifier?.();
      if (typeSpec) {
        // Check for struct/union specifier - need to extract just the identifier
        const structSpec = typeSpec.structOrUnionSpecifier?.();
        if (structSpec) {
          const identifier = structSpec.Identifier?.();
          if (identifier) {
            // Use just the struct/union name, not "structName" concatenated
            parts.push(identifier.getText());
          } else {
            // Anonymous struct - use full text
            parts.push(typeSpec.getText());
          }
        } else {
          parts.push(typeSpec.getText());
        }
      }

      const typeQual = current.typeQualifier?.();
      if (typeQual) {
        parts.push(typeQual.getText());
      }

      current = current.specifierQualifierList?.();
    }

    return parts.join(" ") || "int";
  }

  /**
   * Extract typedef name from declaration specifiers.
   * For "typedef struct { ... } AppConfig;", this returns "AppConfig".
   */
  static extractTypedefNameFromSpecs(
    declSpecs: DeclarationSpecifiersContext,
  ): string | undefined {
    for (const spec of declSpecs.declarationSpecifier()) {
      const typeSpec = spec.typeSpecifier();
      if (typeSpec) {
        const typeName = typeSpec.typedefName?.();
        if (typeName) {
          return typeName.getText();
        }
      }
    }
    return undefined;
  }
}

export default DeclaratorUtils;
