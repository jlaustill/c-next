/**
 * TypeUtils - Utilities for extracting and converting C-Next types.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import CNEXT_TO_C_TYPE_MAP from "../../../../../utils/constants/TypeMappings";

class TypeUtils {
  /**
   * Extract the type name from a type context.
   * Handles scoped types (this.Type), qualified types (Scope.Type),
   * and simple types.
   *
   * @param ctx The type context (may be null)
   * @param scopeName Optional current scope for this.Type resolution
   * @returns The resolved type name
   */
  static getTypeName(
    ctx: Parser.TypeContext | null,
    scopeName?: string,
  ): string {
    if (!ctx) return "void";

    // Handle this.Type for scoped types (e.g., this.State -> Motor_State)
    if (ctx.scopedType()) {
      const typeName = ctx.scopedType()!.IDENTIFIER().getText();
      if (scopeName) {
        return `${scopeName}_${typeName}`;
      }
      return typeName;
    }

    // Issue #478: Handle global.Type for global types inside scope
    // global.ECategory -> ECategory (just the type name, no scope prefix)
    if (ctx.globalType()) {
      return ctx.globalType()!.IDENTIFIER().getText();
    }

    // Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
    if (ctx.qualifiedType()) {
      const identifiers = ctx.qualifiedType()!.IDENTIFIER();
      return identifiers.map((id) => id.getText()).join("_");
    }

    // Handle user-defined types
    if (ctx.userType()) {
      return ctx.userType()!.getText();
    }

    // Handle primitive types
    if (ctx.primitiveType()) {
      return ctx.primitiveType()!.getText();
    }

    // Handle string types - preserve capacity for validation (Issue #139)
    if (ctx.stringType()) {
      const stringCtx = ctx.stringType()!;
      const intLiteral = stringCtx.INTEGER_LITERAL();
      if (intLiteral) {
        return `string<${intLiteral.getText()}>`;
      }
      return "string";
    }

    // Fallback
    return ctx.getText();
  }

  /**
   * Convert a C-Next type name to its C equivalent.
   *
   * @param typeName The C-Next type name
   * @returns The C type name
   */
  static cnextTypeToCType(typeName: string): string {
    return CNEXT_TO_C_TYPE_MAP[typeName] ?? typeName;
  }
}

export default TypeUtils;
