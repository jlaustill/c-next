/**
 * TypeUtils - Utilities for extracting and converting C-Next types.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import CNEXT_TO_C_TYPE_MAP from "../../../../../utils/constants/TypeMappings";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import TypeBinding from "../../TypeBinding";

/**
 * Static utility class for extracting and converting C-Next type names.
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

    // #1285: resolveName recurses into arrayType itself, so an explicit array
    // branch here would be a second array-handling path -- and it carried a
    // DIFFERENT fallback (bracket-stripped text) from this one (raw text),
    // reachable only if a seventh element alternative ever appeared. One call,
    // one fallback.
    const result = TypeBinding.resolveName(ctx, scope ?? null, { isScopeType });
    if (result !== null) {
      return result;
    }

    // templateType and `void` are the alternatives resolveName does not answer
    // for; both are already their own text.
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
