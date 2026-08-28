/**
 * TypeUtils - Utilities for extracting and converting C-Next types.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import CNEXT_TO_C_TYPE_MAP from "../../../../../utils/constants/TypeMappings";
import QualifiedCName from "../../../../../utils/QualifiedCName";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import ScopeUtils from "../../../../../utils/ScopeUtils";

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
 * @param isScopeType ADR-057: predicate answering whether a *qualified* name
 *                    (e.g. "A__B") is a type declared in the current scope.
 *                    Only consulted for bare `userType()` names — `global.T`
 *                    and `this.T` carry an explicit answer in the syntax.
 * @returns The resolved type name, or null if no matching type accessor found
 */
function dispatchTypeResolution(
  accessors: ITypeAccessors,
  scope?: IScopeSymbol,
  isScopeType?: (qualifiedName: string) => boolean,
): string | null {
  // Handle this.Type for scoped types (e.g., this.State -> Motor__State)
  if (accessors.scopedType()) {
    const typeName = accessors.scopedType()!.IDENTIFIER().getText();
    // #1285: built from the scope CHAIN. The collectors used to flatten `scope`
    // to its leaf name before reaching here, so a nested scope lost every
    // component but the innermost.
    return ScopeUtils.qualifyInScope(typeName, scope ?? null);
  }

  // Handle global.Type for global types inside scope
  // global.ECategory -> ECategory (just the type name, no scope prefix)
  if (accessors.globalType()) {
    return accessors.globalType()!.IDENTIFIER().getText();
  }

  // Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
  if (accessors.qualifiedType()) {
    const identifiers = accessors.qualifiedType()!.IDENTIFIER();
    return QualifiedCName.join(...identifiers.map((id) => id.getText()));
  }

  // Handle user-defined types
  if (accessors.userType()) {
    const typeName = accessors.userType()!.getText();
    // ADR-057: a bare name inside a scope resolves local -> scope -> global.
    // Qualify here, while the parse tree still distinguishes a bare `T` from
    // an explicit `global.T` — downstream both are the same string.
    return isScopeType
      ? ScopeUtils.qualifyScopeType(typeName, scope ?? null, isScopeType)
      : typeName;
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
      const result = dispatchTypeResolution(
        ctx.arrayType()!,
        scope,
        isScopeType,
      );
      if (result !== null) {
        return result;
      }
      // Fallback for unrecognized array types - strip the dimension part
      const text = ctx.arrayType()!.getText();
      const bracketIdx = text.indexOf("[");
      return bracketIdx > 0 ? text.substring(0, bracketIdx) : text;
    }

    // Non-array types - dispatch directly
    const result = dispatchTypeResolution(ctx, scope, isScopeType);
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
