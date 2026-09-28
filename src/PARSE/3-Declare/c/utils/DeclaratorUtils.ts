/**
 * DeclaratorUtils - Shared utilities for extracting information from C declarators.
 *
 * Provides methods for extracting names, types, parameters, and array dimensions
 * from C parse tree declarator contexts.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type {
  DeclarationSpecifiersContext,
  DeclaratorContext,
  StructOrUnionSpecifierContext,
  EnumSpecifierContext,
  StructDeclarationListContext,
  StructDeclarationContext,
  StructDeclaratorContext,
  InitDeclaratorListContext,
  TypeSpecifierContext,
} from "../../../2-Parse/c/grammar/CParser";
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

    // Check for array in declarator
    const declarator = paramDecl.declarator?.();
    let isArray = false;

    if (declarator) {
      const directDecl = declarator.directDeclarator?.();
      if (directDecl) {
        const text = directDecl.getText();
        isArray = text.includes("[") && text.includes("]");
      }
    }

    return ParameterExtractorUtils.buildParameterInfo(
      declarator,
      DeclaratorUtils.pointerType(baseType, declarator),
      isConst,
      isArray,
      DeclaratorUtils.extractDeclaratorName,
    );
  }

  /**
   * The C type a declarator gives its base type: `Dev` under `**out` is
   * `Dev**`.
   *
   * The grammar's `pointer` holds EVERY level -- `**out` is one context with
   * two `*` -- so asking only whether it is present says "at least one". A
   * parameter, a variable and a return type each asked exactly that, and a
   * `Dev**` out-parameter was recorded as `Dev*`: codegen could not see that
   * it takes the ADDRESS of a handle, and passed the handle itself. A typedef
   * alone kept the depth (`typedef struct Sample **Grid`), by a count of its
   * own. They all read it here now.
   */
  static pointerType(
    baseType: string,
    declarator: DeclaratorContext | null | undefined,
  ): string {
    const pointerText = declarator?.pointer()?.getText() ?? "";
    return baseType + "*".repeat(pointerText.split("*").length - 1);
  }

  /**
   * Extract array dimensions from a declarator.
   * Issue #981: Returns (number | string)[] to support macro-sized arrays.
   */
  static extractArrayDimensions(declarator: any): (number | string)[] {
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
        parts.push(DeclaratorUtils.typeSpecifierText(typeSpec));
      }
    }

    return parts.join(" ") || "int";
  }

  /**
   * How one type specifier is spelled in a recorded C type -- the one
   * decision for declarations, typedefs and struct fields (#1668).
   *
   * `getText()` concatenates tokens, so `struct foo` and `enum tag_e` were
   * recorded with the keyword and the tag run together, which no lookup
   * matches.
   * A struct or union is spelled by its tag, the name its fields are keyed
   * by (an anonymous one is reconstructed); an enum as `enum tag`, or
   * `enum {...}` when anonymous, so its kind is still readable.
   */
  static typeSpecifierText(typeSpec: TypeSpecifierContext): string {
    const structSpec = typeSpec.structOrUnionSpecifier();
    if (structSpec) {
      const identifier = structSpec.Identifier();
      return identifier
        ? identifier.getText()
        : DeclaratorUtils.reconstructAnonymousStruct(structSpec);
    }
    const enumSpec = typeSpec.enumSpecifier();
    if (enumSpec) {
      const identifier = enumSpec.Identifier();
      return identifier
        ? `enum ${identifier.getText()}`
        : `enum ${enumSpec.getText().replace(/^enum/, "")}`;
    }
    return typeSpec.getText();
  }

  /**
   * Check if declaration specifiers contain a specific storage class.
   */
  /**
   * The type a declarator records: the base type with any indirection the
   * declarator carries -- a pointer's depth, or a function pointer's
   * `T (*)(params)`. The one rule for a typedef and a struct field (#1760
   * review: a field recorded its specifiers alone, so `float (*getf)(void)`
   * was a `float` and `uint8_t *buf` a `uint8_t`).
   *
   * Declaration specifiers give the base type; the `*` of a pointer typedef
   * lives in the *declarator* (`typedef struct Sample *SampleHandle`). Issue
   * #1178: only function-pointer typedefs used to reconstruct their
   * indirection, so a plain pointer typedef was recorded as though it were the
   * struct itself -- and a consumer asking "can the callee write through this
   * parameter?" was told no.
   */
  static declaredType(baseType: string, declarator: DeclaratorContext): string {
    if (DeclaratorUtils.isFunctionPointerDeclarator(declarator)) {
      return `${baseType} (*)(${DeclaratorUtils.extractParamText(declarator)})`;
    }
    // Keep the declarator's pointer depth, not merely its presence: the symbol
    // model is shared, and a consumer that wants the pointer probably wants the
    // right number of them (`typedef struct Sample **Grid`).
    return DeclaratorUtils.pointerType(baseType, declarator);
  }

  /**
   * Check if a declarator represents a function pointer.
   * For `(*PointCallback)(Point p)`, the C grammar parses as:
   *   declarator -> directDeclarator
   *   directDeclarator -> directDeclarator '(' parameterTypeList ')'
   *   inner directDeclarator -> '(' declarator ')'
   *   inner declarator -> pointer directDeclarator -> * PointCallback
   */
  static isFunctionPointerDeclarator(declarator: any): boolean {
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return false;

    // The outer directDeclarator has: directDeclarator '(' params ')'
    // Check for parameter list at the outer level
    const hasParams =
      directDecl.parameterTypeList?.() !== null ||
      Boolean(directDecl.LeftParen?.());

    if (!hasParams) return false;

    // The inner directDeclarator should be '(' declarator ')' with a pointer
    const innerDirectDecl = directDecl.directDeclarator?.();
    if (!innerDirectDecl) return false;

    const nestedDecl = innerDirectDecl.declarator?.();
    if (!nestedDecl) return false;

    return Boolean(nestedDecl.pointer?.());
  }

  /**
   * Extract parameter text from a function pointer declarator.
   * Returns the text of the parameters from a function pointer like "(*Callback)(Point p)".
   */
  static extractParamText(declarator: any): string {
    const directDecl = declarator.directDeclarator?.();
    if (!directDecl) return "";

    const paramTypeList = directDecl.parameterTypeList?.();
    if (!paramTypeList) return "";

    return paramTypeList.getText();
  }
  /**
   * Whether a declaration is `volatile` (#1760 review). The specifier list is
   * read for its type specifiers alone, so a `volatile float` global was
   * recorded as `float`, and the typer could not know that reading it has a
   * side effect. A struct field's spelling keeps its qualifiers already.
   */
  static isVolatile(declSpecs: DeclarationSpecifiersContext): boolean {
    return declSpecs
      .declarationSpecifier()
      .some((spec) => spec.typeQualifier()?.getText() === "volatile");
  }

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
        parts.push(DeclaratorUtils.typeSpecifierText(typeSpec));
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
  static extractFirstDeclaratorName(
    initDeclList: InitDeclaratorListContext,
  ): string | undefined {
    const initDeclarators = initDeclList.initDeclarator?.();
    if (!initDeclarators || initDeclarators.length === 0) return undefined;

    const firstDeclarator = initDeclarators[0].declarator?.();
    if (!firstDeclarator) return undefined;

    return DeclaratorUtils.extractDeclaratorName(firstDeclarator) ?? undefined;
  }

  /**
   * Check if the first declarator in an init-declarator-list has a pointer.
   * For "typedef struct X *handle_t;", the declarator is "*handle_t" which has a pointer.
   * Used for Issue #957 to distinguish pointer typedefs from opaque struct typedefs.
   */
  static firstDeclaratorHasPointer(
    initDeclList: InitDeclaratorListContext,
  ): boolean {
    const initDeclarators = initDeclList.initDeclarator?.();
    if (!initDeclarators || initDeclarators.length === 0) return false;

    const firstDeclarator = initDeclarators[0].declarator?.();
    if (!firstDeclarator) return false;

    return Boolean(firstDeclarator.pointer?.());
  }
}

export default DeclaratorUtils;
