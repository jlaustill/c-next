/**
 * TypeGenerationHelper
 *
 * Helper class for generating C type strings from C-Next type contexts.
 * Handles primitive types, scoped types, qualified types, user types, and array types.
 *
 * Extracted from CodeGenerator._generateType for improved testability.
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import TYPE_MAP from "../types/TYPE_MAP.js";
import TIncludeHeader from "../generators/TIncludeHeader.js";

/**
 * Result of generating a primitive type.
 */
interface IPrimitiveTypeResult {
  cType: string;
  include: TIncludeHeader | null;
}

/**
 * Dependencies required for type generation that involve external state.
 */
interface ITypeGenerationDeps {
  currentScope: string | null;
  isCppScopeSymbol: (name: string) => boolean;
  checkNeedsStructKeyword: (name: string) => boolean;
  validateCrossScopeVisibility: (scope: string, member: string) => void;
}

class TypeGenerationHelper {
  /**
   * Generate C type for a primitive type.
   * Returns the C type and any required include header.
   */
  static generatePrimitiveType(type: string): IPrimitiveTypeResult {
    let include: TIncludeHeader | null = null;

    if (type === "bool") {
      include = "stdbool";
    } else if (type === "ISR") {
      include = "isr";
    } else if (type in TYPE_MAP && type !== "void") {
      include = "stdint";
    }

    const cType = TYPE_MAP[type] || type;
    return { cType, include };
  }

  /**
   * Generate C type for a scoped type (this.Type).
   * Throws if called outside a scope context.
   */
  static generateScopedType(
    typeName: string,
    currentScope: string | null,
  ): string {
    if (!currentScope) {
      throw new Error("Cannot use 'this.Type' outside of a scope");
    }
    return `${currentScope}_${typeName}`;
  }

  /**
   * Generate C type for a global type (global.Type).
   */
  static generateGlobalType(typeName: string): string {
    return typeName;
  }

  /**
   * Generate C type for a qualified type (Scope.Type or Namespace::Type).
   *
   * @param identifiers - Array of identifier names in the qualified path
   * @param isCppNamespace - Whether the first identifier is a C++ namespace
   * @param validateVisibility - Optional callback to validate cross-scope visibility
   * @returns The C/C++ type string
   */
  static generateQualifiedType(
    identifiers: string[],
    isCppNamespace: boolean,
    validateVisibility?: (scope: string, member: string) => void,
  ): string {
    if (isCppNamespace) {
      return identifiers.join("::");
    }

    // C-Next scoped type - validate visibility for 2-part types
    if (identifiers.length === 2 && validateVisibility) {
      validateVisibility(identifiers[0], identifiers[1]);
    }

    return identifiers.join("_");
  }

  /**
   * Generate C type for a user-defined type.
   *
   * @param typeName - The type name
   * @param needsStructKeyword - Whether to prefix with 'struct'
   * @returns The C type string
   */
  static generateUserType(
    typeName: string,
    needsStructKeyword: boolean,
  ): string {
    // ADR-046: cstring maps to char* for C library interop
    if (typeName === "cstring") {
      return "char*";
    }

    if (needsStructKeyword) {
      return `struct ${typeName}`;
    }

    return typeName;
  }

  /**
   * Generate base type for an array type.
   *
   * @param primitiveText - The primitive type text (if primitive)
   * @param userTypeName - The user type name (if user type)
   * @param needsStructKeyword - Whether to prefix with 'struct'
   * @returns The C base type string
   */
  static generateArrayBaseType(
    primitiveText: string | null,
    userTypeName: string | null,
    needsStructKeyword: boolean,
  ): string {
    if (primitiveText) {
      return TYPE_MAP[primitiveText] || primitiveText;
    }

    if (userTypeName) {
      if (needsStructKeyword) {
        return `struct ${userTypeName}`;
      }
      return userTypeName;
    }

    throw new Error("Array type must have either primitive or user type");
  }

  /**
   * Generate string type (bounded strings).
   * Returns the base type for char arrays.
   */
  static generateStringType(): string {
    return "char";
  }

  /**
   * Full type generation using all dependencies.
   * This is the main entry point that handles all type contexts.
   */
  static generate(ctx: Parser.TypeContext, deps: ITypeGenerationDeps): string {
    // Primitive type
    if (ctx.primitiveType()) {
      const type = ctx.primitiveType()!.getText();
      const result = TypeGenerationHelper.generatePrimitiveType(type);
      // Note: caller is responsible for handling the include
      return result.cType;
    }

    // Bounded string type
    if (ctx.stringType()) {
      return TypeGenerationHelper.generateStringType();
    }

    // Scoped type (this.Type)
    if (ctx.scopedType()) {
      const typeName = ctx.scopedType()!.IDENTIFIER().getText();
      return TypeGenerationHelper.generateScopedType(
        typeName,
        deps.currentScope,
      );
    }

    // Global type (global.Type)
    if (ctx.globalType()) {
      const typeName = ctx.globalType()!.IDENTIFIER().getText();
      return TypeGenerationHelper.generateGlobalType(typeName);
    }

    // Qualified type (Scope.Type or Namespace::Type)
    if (ctx.qualifiedType()) {
      const identifiers = ctx.qualifiedType()!.IDENTIFIER();
      const identifierNames = identifiers.map((id) => id.getText());
      const isCpp = deps.isCppScopeSymbol(identifierNames[0]);
      return TypeGenerationHelper.generateQualifiedType(
        identifierNames,
        isCpp,
        deps.validateCrossScopeVisibility,
      );
    }

    // User type
    if (ctx.userType()) {
      const typeName = ctx.userType()!.getText();
      const needsStruct = deps.checkNeedsStructKeyword(typeName);
      return TypeGenerationHelper.generateUserType(typeName, needsStruct);
    }

    // Array type
    if (ctx.arrayType()) {
      const arrCtx = ctx.arrayType()!;
      // String arrays have base type "char"
      if (arrCtx.stringType()) {
        return "char";
      }
      const primitiveText = arrCtx.primitiveType()?.getText() ?? null;
      const userTypeName = arrCtx.userType()?.getText() ?? null;
      const needsStruct = userTypeName
        ? deps.checkNeedsStructKeyword(userTypeName)
        : false;
      return TypeGenerationHelper.generateArrayBaseType(
        primitiveText,
        userTypeName,
        needsStruct,
      );
    }

    // Void or fallback
    if (ctx.getText() === "void") {
      return "void";
    }

    return ctx.getText();
  }

  /**
   * Get the required include header for a type context.
   * Used by the caller to track includes separately from type generation.
   */
  static getRequiredInclude(ctx: Parser.TypeContext): TIncludeHeader | null {
    if (ctx.primitiveType()) {
      const type = ctx.primitiveType()!.getText();
      return TypeGenerationHelper.generatePrimitiveType(type).include;
    }

    if (ctx.stringType()) {
      return "string";
    }

    // Bug fix: Handle arrayType syntax (u16[8] myArray) - check inner primitive type
    if (ctx.arrayType()) {
      const arrCtx = ctx.arrayType()!;
      if (arrCtx.primitiveType()) {
        const type = arrCtx.primitiveType()!.getText();
        return TypeGenerationHelper.generatePrimitiveType(type).include;
      }
    }

    return null;
  }
}

export default TypeGenerationHelper;
