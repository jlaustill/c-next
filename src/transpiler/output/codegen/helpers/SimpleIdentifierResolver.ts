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
   * @returns The resolved identifier string
   */
  static resolve(id: string, deps: ISimpleIdentifierDeps): string {
    // ADR-006: Check if it's a function parameter
    const paramInfo = deps.getParameterInfo(id);
    if (paramInfo) {
      return deps.resolveParameter(id, paramInfo);
    }

    // Check if it's a local variable
    const isLocalVariable = deps.isLocalVariable(id);

    // ADR-016: Resolve bare identifier using local -> scope -> global priority
    const resolved = deps.resolveBareIdentifier(id, isLocalVariable);

    // If resolved to a different name, use it
    if (resolved !== null) {
      return resolved;
    }

    return id;
  }
}

export default SimpleIdentifierResolver;
