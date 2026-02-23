/**
 * Parameter Dereference Resolver
 *
 * Determines whether a parameter needs to be dereferenced when used as a value.
 * C-Next uses pass-by-reference for most types, but some types use pass-by-value:
 * - Callbacks (function pointers)
 * - Float types (f32, f64)
 * - Enum types
 * - Small unmodified primitives (optimization)
 * - Structs (use -> instead of dereference)
 * - Arrays (already pointers)
 * - Unknown types (external enums, typedefs)
 *
 * Issue #551, #558, #644, ADR-006, ADR-029
 */

import TParameterInfo from "../types/TParameterInfo";
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

    // Float types use pass-by-value
    if (deps.isFloatType(paramInfo.baseType)) {
      return true;
    }

    // Enum types use pass-by-value
    if (deps.knownEnums.has(paramInfo.baseType)) {
      return true;
    }

    // ADR-045: String parameters are passed as char*
    if (paramInfo.isString) {
      return true;
    }

    // Issue #269: Small unmodified primitives use pass-by-value
    if (
      deps.currentFunctionName &&
      deps.isParameterPassByValue(deps.currentFunctionName, paramInfo.name)
    ) {
      return true;
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
   * @param id The parameter identifier
   * @param paramInfo Parameter information
   * @param deps Dependencies for resolution
   * @returns The resolved identifier (possibly with dereference)
   */
  static resolve(
    id: string,
    paramInfo: TParameterInfo,
    deps: IParameterDereferenceDeps,
  ): string {
    if (ParameterDereferenceResolver.isPassByValue(paramInfo, deps)) {
      return id;
    }

    // Issue #895: Callback-compatible primitives need dereferencing when
    // used as values (assignments, comparisons) because the C-Next type
    // (e.g., u8) became a pointer (uint8_t*) to match the callback typedef.
    if (paramInfo.forcePointerSemantics) {
      return `(*${id})`;
    }

    // Known primitive that is pass-by-reference needs dereference
    // Issue #558/#644: In C++ mode, primitives become references
    return deps.maybeDereference(id);
  }
}

export default ParameterDereferenceResolver;
