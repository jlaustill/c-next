import type ISourcePosition from "../../../../utils/types/ISourcePosition";
/**
 * Simple Identifier Resolver
 *
 * Resolves simple identifiers (no prefix, no postfix operations)
 * in assignment targets. Handles parameter lookup, local variable
 * detection, and bare identifier resolution.
 *
 * Extracted from CodeGenerator.doGenerateAssignmentTarget to reduce
 * cognitive complexity.
 *
 * ADR-006, ADR-016
 */

import ISimpleIdentifierDeps from "../types/ISimpleIdentifierDeps";

/**
 * Static utility for resolving simple identifiers
 */
class SimpleIdentifierResolver {
  /**
   * Resolve a simple identifier (no prefix, no postfix operations)
   *
   * Resolution priority:
   * 1. Function parameters (with dereference if needed)
   * 2. Bare identifier resolution (local -> scope -> global)
   * 3. Original identifier as fallback
   *
   * @param id The identifier to resolve
   * @param deps Dependencies for resolution
   * @param at Position of the reference (#1668: the binding's, and #1241's
   *   provenance line)
   * @returns The resolved identifier string
   */
  static resolve(
    id: string,
    deps: ISimpleIdentifierDeps,
    at: ISourcePosition,
  ): string {
    // ADR-006: Check if it's a function parameter
    const paramInfo = deps.getParameterInfo(id);
    if (paramInfo) {
      return deps.resolveParameter(id, paramInfo);
    }

    // ADR-016: Resolve bare identifier using local -> scope -> global priority
    const resolved = deps.resolveBareIdentifier(id, at);

    // If resolved to a different name, use it
    if (resolved !== null) {
      return resolved;
    }

    return id;
  }
}

export default SimpleIdentifierResolver;
