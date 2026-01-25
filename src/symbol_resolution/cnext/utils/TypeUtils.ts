/**
 * TypeUtils - Utilities for extracting and converting C-Next types.
 */

import * as Parser from "../../../antlr_parser/grammar/CNextParser";

/**
 * C-Next to C type mapping
 */
const CNEXT_TO_C_TYPE: Record<string, string> = {
  u8: "uint8_t",
  u16: "uint16_t",
  u32: "uint32_t",
  u64: "uint64_t",
  i8: "int8_t",
  i16: "int16_t",
  i32: "int32_t",
  i64: "int64_t",
  f32: "float",
  f64: "double",
  bool: "bool",
  void: "void",
};

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

    // Handle string types
    if (ctx.stringType()) {
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
    return CNEXT_TO_C_TYPE[typeName] ?? typeName;
  }
}

export default TypeUtils;
