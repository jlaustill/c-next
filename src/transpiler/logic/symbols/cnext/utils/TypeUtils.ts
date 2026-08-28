/**
 * TypeUtils - Utilities for extracting and converting C-Next types.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import CNEXT_TO_C_TYPE_MAP from "../../../../../utils/constants/TypeMappings";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import TypeBinding from "../../TypeBinding";

/**
 * Common interface for type contexts that share the same type accessors.
 * Both TypeContext and ArrayTypeContext have these methods.
 */

class TypeUtils {
  /**
   * Extract the type name from a type context.
   * Handles scoped types (this.Type), qualified types (Scope.Type),
   * and simple types.
   *
   * @param ctx The type context (may be null)
   * @param scope Optional current scope for this.Type resolution
   * @param isScopeType ADR-057: predicate answering whether a *qualified* name
   *                    is a type declared in the current scope. Omit at call
   *                    sites that have no scope context.
   * @returns The resolved type name
   */
  static getTypeName(
    ctx: Parser.TypeContext | null,
    scope?: IScopeSymbol,
    isScopeType?: (qualifiedName: string) => boolean,
  ): string {
    if (!ctx) return "void";

    // Handle arrayType: Type[size] - extract the inner type without dimension
    // The dimension is tracked separately in arrayDimensions
    if (ctx.arrayType()) {
      const result = TypeBinding.resolveName(ctx.arrayType()!, scope ?? null, {
        isScopeType,
      });
      if (result !== null) {
        return result;
      }
      // Fallback for unrecognized array types - strip the dimension part
      const text = ctx.arrayType()!.getText();
      const bracketIdx = text.indexOf("[");
      return bracketIdx > 0 ? text.substring(0, bracketIdx) : text;
    }

    // Non-array types - dispatch directly
    const result = TypeBinding.resolveName(ctx, scope ?? null, { isScopeType });
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
