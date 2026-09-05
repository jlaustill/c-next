/**
 * TypeUtils - Utilities for extracting and converting C-Next types.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import CNEXT_TO_C_TYPE_MAP from "../../../../../utils/constants/TypeMappings";
import TypeBinding from "../../TypeBinding";
import TypeResolver from "../../../../../utils/TypeResolver";
import TTypeUtils from "../../../../../utils/TTypeUtils";
import ScopeUtils from "../../../../../utils/ScopeUtils";
import type TType from "../../../../types/TType";
import type ITypeAccessors from "../../../../types/ITypeAccessors";

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
   * @param scopePath Enclosing scope path for this.Type resolution ("" at file
   *                  scope)
   * @param isScopeType ADR-057: predicate answering whether a *qualified* name
   *                    is a type declared in the current scope. Omit at call
   *                    sites that have no scope context.
   * @returns The resolved type name
   */
  static getTypeName(
    ctx: Parser.TypeContext | null,
    scopePath = "",
    isScopeType?: (qualifiedName: string) => boolean,
  ): string {
    if (!ctx) return "void";

    // #1285: resolveName recurses into arrayType itself, so an explicit array
    // branch here would be a second array-handling path -- and it carried a
    // DIFFERENT fallback (bracket-stripped text) from this one (raw text),
    // reachable only if a seventh element alternative ever appeared. One call,
    // one fallback.
    const result = TypeBinding.resolveName(ctx, scopePath, { isScopeType });
    if (result !== null) {
      return result;
    }

    // templateType and `void` are the alternatives resolveName does not answer
    // for; both are already their own text.
    return ctx.getText();
  }

  /**
   * The `TType` for a type context, deferring what 1.3 Declare cannot settle.
   *
   * Declare knows only the scope types THIS file declares. A bare `T` inside a
   * scope may name one from an included file, and ADR-057 cannot be applied
   * later from the resolved string, because a bare `Mode` that stayed bare and
   * `global.Mode` are byte-identical by then. So the unsettled case is recorded
   * as `TDeferredType`, carrying the written identifier and the scope it was
   * written in, and 1.4 Resolve settles it against the whole program.
   *
   * Everything else resolves exactly as before, through `getTypeName`, so the
   * settled path keeps one implementation rather than gaining a second.
   */
  static resolveType(
    ctx: Parser.TypeContext | null,
    scopePath = "",
    isScopeType?: (qualifiedName: string) => boolean,
  ): TType {
    const deferred = TypeUtils.deferredIfUnsettled(ctx, scopePath, isScopeType);
    return (
      deferred ??
      TypeResolver.resolve(TypeUtils.getTypeName(ctx, scopePath, isScopeType))
    );
  }

  /**
   * A `TDeferredType` when this context names a bare type Declare cannot
   * settle, and null when it can.
   *
   * Only the BARE branch is ever unsettled: `this.T`, `global.T` and `Scope.T`
   * state their answer in the syntax. A bare name that qualified is settled
   * too -- the predicate recognized it, so this file declares it. What remains
   * is a bare name that stayed bare inside a scope, which is either a global
   * type or a scope type from an included file, and Declare cannot tell those
   * apart without a cross-file fact it is not allowed to hold.
   *
   * At file scope there is nothing to defer: ADR-057 qualification does not
   * apply, so a bare name there is already its own answer.
   *
   * Arrays recurse, because `resolveName` treats an array context as its
   * ELEMENT type -- dimensions live in their own slot on the symbol -- so an
   * array of an unsettled scope type must defer on the element.
   */
  private static deferredIfUnsettled(
    ctx: Parser.TypeContext | null,
    scopePath: string,
    isScopeType?: (qualifiedName: string) => boolean,
  ): TType | null {
    if (!ctx || !isScopeType || ScopeUtils.isGlobalScopePath(scopePath)) {
      return null;
    }

    const accessors = ctx as ITypeAccessors;
    const array = accessors.arrayType?.();
    if (array) {
      return TypeUtils.deferredIfUnsettled(
        array as unknown as Parser.TypeContext,
        scopePath,
        isScopeType,
      );
    }

    const classified = TypeBinding.classifyNamedType(accessors, scopePath, {
      isScopeType,
    });
    if (!classified || classified.branch !== "bare") {
      return null;
    }

    // Qualified by the predicate, so this file declares it -- settled.
    if (classified.name !== classified.written) {
      return null;
    }

    return TTypeUtils.createDeferred(classified.written, scopePath);
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
