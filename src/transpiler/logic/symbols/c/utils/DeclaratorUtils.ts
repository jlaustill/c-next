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
  StructDeclarationListContext,
  StructDeclarationContext,
  StructDeclaratorContext,
} from "../../../parser/c/grammar/CParser";
import SymbolUtils from "../../SymbolUtils";
import IExtractedParameter from "../../shared/IExtractedParameter";
import ParameterExtractorUtils from "../../shared/ParameterExtractorUtils";

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
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return [];

    const paramTypeList = directDecl.parameterTypeList?.();
    if (!paramTypeList) return [];

    const paramList = paramTypeList.parameterList?.();
    if (!paramList) return [];

    return ParameterExtractorUtils.processParameterList(
      paramList,
      DeclaratorUtils.extractParameterInfo,
    );
  }

  /**
   * Extract parameter info from a single parameter declaration.
   */
  static extractParameterInfo(paramDecl: any): IExtractedParameter | null {
    const declSpecs = paramDecl.declarationSpecifiers?.();
    if (!declSpecs) return null;

    const baseType = DeclaratorUtils.extractTypeFromDeclSpecs(declSpecs);
    const isConst = declSpecs.getText().includes("const");

    // Check for pointer and array in declarator
    const declarator = paramDecl.declarator?.();
    let isPointer = false;
    let isArray = false;

    if (declarator) {
      isPointer = Boolean(declarator.pointer?.());
      const directDecl = declarator.directDeclarator?.();
      if (directDecl) {
        const text = directDecl.getText();
        isArray = text.includes("[") && text.includes("]");
      }
    }

    return ParameterExtractorUtils.buildParameterInfo(
      declarator,
      baseType,
      isConst,
      isPointer,
      isArray,
      DeclaratorUtils.extractDeclaratorName,
    );
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
            // Anonymous struct - reconstruct with proper spacing
            parts.push(DeclaratorUtils.reconstructAnonymousStruct(structSpec));
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
   * Reconstruct an anonymous struct/union type with proper spacing.
   * For `struct { unsigned int flag_a: 1; }`, returns the properly formatted string
   * instead of the concatenated tokens from getText().
   */
  private static reconstructAnonymousStruct(
    structSpec: StructOrUnionSpecifierContext,
  ): string {
    const structOrUnion = structSpec.structOrUnion();
    const keyword = structOrUnion.Struct() ? "struct" : "union";

    const declList = structSpec.structDeclarationList();
    if (!declList) {
      return `${keyword} { }`;
    }

    const fields = DeclaratorUtils.reconstructStructFields(declList);
    return `${keyword} { ${fields} }`;
  }

  /**
   * Reconstruct struct fields with proper spacing.
   */
  private static reconstructStructFields(
    declList: StructDeclarationListContext,
  ): string {
    const fieldStrings: string[] = [];

    for (const decl of declList.structDeclaration()) {
      const fieldStr = DeclaratorUtils.reconstructStructField(decl);
      if (fieldStr) {
        fieldStrings.push(fieldStr);
      }
    }

    return fieldStrings.join(" ");
  }

  /**
   * Reconstruct a single struct field declaration.
   */
  private static reconstructStructField(
    decl: StructDeclarationContext,
  ): string | null {
    const specQualList = decl.specifierQualifierList();
    if (!specQualList) return null;

    // Get the base type with proper spacing
    const baseType = DeclaratorUtils.extractTypeFromSpecQualList(specQualList);

    const declaratorList = decl.structDeclaratorList();
    if (!declaratorList) {
      return `${baseType};`;
    }

    // Process each declarator in the list
    const declarators: string[] = [];
    for (const structDecl of declaratorList.structDeclarator()) {
      const declStr = DeclaratorUtils.reconstructStructDeclarator(structDecl);
      if (declStr) {
        declarators.push(declStr);
      }
    }

    if (declarators.length === 0) {
      return `${baseType};`;
    }

    return `${baseType} ${declarators.join(", ")};`;
  }

  /**
   * Reconstruct a struct declarator (field name with optional bitfield width).
   */
  private static reconstructStructDeclarator(
    structDecl: StructDeclaratorContext,
  ): string | null {
    const declarator = structDecl.declarator();
    const hasColon = structDecl.Colon() !== null;
    const constExpr = structDecl.constantExpression();

    let name = "";
    if (declarator) {
      name = DeclaratorUtils.extractDeclaratorName(declarator) || "";
    }

    if (hasColon && constExpr) {
      const width = constExpr.getText();
      return `${name}: ${width}`;
    }

    return name || null;
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

  /**
   * Extract the first declarator name from an init-declarator-list.
   * For "typedef struct _widget_t widget_t;", this returns "widget_t".
   * Used for Issue #948 opaque type detection.
   */
  static extractFirstDeclaratorName(initDeclList: any): string | undefined {
    const initDeclarators = initDeclList.initDeclarator?.();
    if (!initDeclarators || initDeclarators.length === 0) return undefined;

    const firstDeclarator = initDeclarators[0].declarator?.();
    if (!firstDeclarator) return undefined;

    return DeclaratorUtils.extractDeclaratorName(firstDeclarator) ?? undefined;
  }
}

export default DeclaratorUtils;
