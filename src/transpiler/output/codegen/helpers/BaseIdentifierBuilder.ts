/**
 * Base Identifier Builder
 *
 * Builds the base identifier string for assignment targets,
 * handling global., this., and bare identifier prefixes.
 *
 * Extracted from CodeGenerator.doGenerateAssignmentTarget to reduce
 * cognitive complexity.
 */

import IBaseIdentifierResult from "../types/IBaseIdentifierResult";

/**
 * Static utility for building base identifiers
 */
class BaseIdentifierBuilder {
  /**
   * Build the base identifier with appropriate prefix
   *
   * @param identifier The raw identifier
   * @param hasGlobal Whether global. prefix is present
   * @param hasThis Whether this. prefix is present
   * @param currentScope The current scope name (required if hasThis)
   * @returns The built identifier and first ID
   * @throws Error if this. is used outside a scope
   */
  static build(
    identifier: string,
    hasGlobal: boolean,
    hasThis: boolean,
    currentScope: string | null,
  ): IBaseIdentifierResult {
    const firstId = identifier;

    if (hasGlobal) {
      // global.x - no prefix needed for code generation
      return { result: firstId, firstId };
    }

    if (hasThis) {
      if (!currentScope) {
        throw new Error("Error: 'this' can only be used inside a scope");
      }
      // this.x - prefix with current scope
      return { result: `${currentScope}_${firstId}`, firstId };
    }

    // Bare identifier with postfix ops
    return { result: firstId, firstId };
  }
}

export default BaseIdentifierBuilder;
