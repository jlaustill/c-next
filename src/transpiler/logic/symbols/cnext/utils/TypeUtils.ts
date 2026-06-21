/**
 * TypeUtils - Utilities for extracting and converting C-Next types.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import CNEXT_TO_C_TYPE_MAP from "../../../../../utils/constants/TypeMappings";

/**
 * Common interface for type contexts that share the same type accessors.
 * Both TypeContext and ArrayTypeContext have these methods.
 */
interface ITypeAccessors {
  primitiveType(): Parser.PrimitiveTypeContext | null;
  userType(): Parser.UserTypeContext | null;
  stringType(): Parser.StringTypeContext | null;
  scopedType(): Parser.ScopedTypeContext | null;
  qualifiedType(): Parser.QualifiedTypeContext | null;
  globalType(): Parser.GlobalTypeContext | null;
}

/**
 * Resolve string type with optional capacity.
 */
function resolveStringType(stringCtx: Parser.StringTypeContext): string {
  const intLiteral = stringCtx.INTEGER_LITERAL();
  return intLiteral ? `string<${intLiteral.getText()}>` : "string";
}

/**
 * Dispatch type resolution for contexts that share common type accessors.
 * Handles scoped, qualified, global, primitive, string, and user types.
 * Used by both bare type contexts and array element type contexts.
 *
 * @returns The resolved type name, or null if no matching type accessor found
 */
function dispatchTypeResolution(
  accessors: ITypeAccessors,
  scopeName?: string,
): string | null {
  // Handle this.Type for scoped types (e.g., this.State -> Motor_State)
  if (accessors.scopedType()) {
    const typeName = accessors.scopedType()!.IDENTIFIER().getText();
    return scopeName ? `${scopeName}_${typeName}` : typeName;
  }

  // Handle global.Type for global types inside scope
  // global.ECategory -> ECategory (just the type name, no scope prefix)
  if (accessors.globalType()) {
    return accessors.globalType()!.IDENTIFIER().getText();
  }

  // Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
  if (accessors.qualifiedType()) {
    const identifiers = accessors.qualifiedType()!.IDENTIFIER();
    return identifiers.map((id) => id.getText()).join("_");
  }

  // Handle user-defined types
  if (accessors.userType()) {
    return accessors.userType()!.getText();
  }

  // Handle primitive types
  if (accessors.primitiveType()) {
    return accessors.primitiveType()!.getText();
  }

  // Handle string types - preserve capacity for validation (Issue #139)
  if (accessors.stringType()) {
    return resolveStringType(accessors.stringType()!);
  }

  return null;
}

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

    // Handle arrayType: Type[size] - extract the inner type without dimension
    // The dimension is tracked separately in arrayDimensions
    if (ctx.arrayType()) {
      const result = dispatchTypeResolution(ctx.arrayType()!, scopeName);
      if (result !== null) {
        return result;
      }
      // Fallback for unrecognized array types - strip the dimension part
      const text = ctx.arrayType()!.getText();
      const bracketIdx = text.indexOf("[");
      return bracketIdx > 0 ? text.substring(0, bracketIdx) : text;
    }

    // Non-array types - dispatch directly
    const result = dispatchTypeResolution(ctx, scopeName);
    if (result !== null) {
      return result;
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
