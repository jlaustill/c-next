/**
 * Parameter Dereference Resolver
 *
 * Determines whether a parameter needs to be dereferenced when used as a value.
 * C-Next uses pass-by-reference for most types, but some types use pass-by-value:
 * - Callbacks (function pointers)
 * - Read-only scalars: integers, floats, enums (ADR-071 Q6)
 * - Structs (use -> instead of dereference)
 * - Arrays (already pointers)
 * - Unknown types (external enums, typedefs)
 *
 * Issue #551, #558, #644, ADR-006, ADR-029
 */

import TParameterInfo from "../../../../types/TParameterInfo";
import type IBoundParameter from "../../../types/IBoundParameter";
import IParameterDereferenceDeps from "../types/IParameterDereferenceDeps";

/**
 * Static utility for resolving parameter dereference requirements
 */
class ParameterDereferenceResolver {
  /**
   * Determine if a parameter should be passed by value (no dereference needed)
   */
  static isPassByValue(
    paramInfo: TParameterInfo,
    deps: IParameterDereferenceDeps,
  ): boolean {
    // Issue #895: Primitive params that became pointers due to callback typedef
    // are NOT pass-by-value — when used as values (assignments, comparisons),
    // they need dereferencing (*buf) to get the actual value.
    // Issue #937: However, when forwarded to C functions expecting pointers,
    // the CallExprGenerator handles using the identifier directly.
    if (paramInfo.isCallbackPointerPrimitive) {
      return false; // Needs dereferencing when used as a value
    }

    // ADR-029: Callback parameters are function pointers
    if (paramInfo.isCallback) {
      return true;
    }

    // ADR-045: String parameters are passed as char*
    if (paramInfo.isString) {
      return true;
    }

    // ADR-071 Q6: a read-only scalar -- an integer, a float, an enum -- is
    // passed by value
    if (
      deps.currentFunctionName &&
      deps.isParameterPassByValue(deps.currentFunctionName, paramInfo.name)
    ) {
      return true;
    }

    // ...and a `mut` one is a pointer, an enum too, so its value is `(*p)`.
    // An enum array is already a pointer, like any array.
    if (!paramInfo.isArray && deps.knownEnums.has(paramInfo.baseType)) {
      return false;
    }

    // Structs use -> notation, not dereference
    if (paramInfo.isStruct) {
      return true;
    }

    // Arrays are already pointers
    if (paramInfo.isArray) {
      return true;
    }

    // Issue #551: Unknown types use pass-by-value
    if (!deps.isKnownPrimitive(paramInfo.baseType)) {
      return true;
    }

    // Known primitive that is pass-by-reference
    return false;
  }

  /**
   * Resolve a parameter identifier, applying dereference if needed
   *
   * @param parameter The bound parameter, with the C name it is emitted under
   * @param deps Dependencies for resolution
   * @returns The resolved identifier (possibly with dereference)
   */
  static resolve(
    parameter: IBoundParameter,
    deps: IParameterDereferenceDeps,
  ): string {
    const paramInfo = parameter.info;
    const emittedName = parameter.emittedName;
    if (ParameterDereferenceResolver.isPassByValue(paramInfo, deps)) {
      return emittedName;
    }

    // Issue #895: Callback-compatible primitives need dereferencing when
    // used as values (assignments, comparisons) because the C-Next type
    // (e.g., u8) became a pointer (uint8_t*) to match the callback typedef.
    if (paramInfo.forcePointerSemantics) {
      return `(*${emittedName})`;
    }

    // Known primitive that is pass-by-reference needs dereference
    // Issue #558/#644: In C++ mode, primitives become references
    return deps.maybeDereference(emittedName);
  }
}

export default ParameterDereferenceResolver;
