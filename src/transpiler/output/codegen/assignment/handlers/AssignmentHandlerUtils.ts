/**
 * Assignment Handler Utilities
 *
 * Common utilities shared across assignment handlers to reduce duplication.
 * Issue #707: Extracted from RegisterHandlers.ts and AccessPatternHandlers.ts.
 */

import IRegisterNameResult from "./IRegisterNameResult";

/**
 * Validate that 'this' is being used within a scope context.
 * Throws if currentScope is not set.
 *
 * @param currentScope - The current scope name or null
 * @throws Error if 'this' is used outside a scope
 */
function validateScopeContext(currentScope: string | null): void {
  if (!currentScope) {
    throw new Error("Error: 'this' can only be used inside a scope");
  }
}

/**
 * Validate that compound assignment operators are not used with bit field access.
 *
 * @param isCompound - Whether this is a compound assignment
 * @param cnextOp - The C-Next operator being used
 * @throws Error if compound operator is used with bit fields
 */
function validateNoCompoundForBitAccess(
  isCompound: boolean,
  cnextOp: string,
): void {
  if (isCompound) {
    throw new Error(
      `Compound assignment operators not supported for bit field access: ${cnextOp}`,
    );
  }
}

/**
 * Validate write-only register assignment value.
 * Throws if trying to clear bits on a write-only register.
 *
 * @param value - The value being assigned
 * @param targetName - The full register name for error messages
 * @param bitIndex - The bit index expression for error messages
 * @param isSingleBit - True for single bit access, false for bit range
 * @throws Error if attempting to clear bits on write-only register
 */
function validateWriteOnlyValue(
  value: string,
  targetName: string,
  bitIndex: string,
  isSingleBit: boolean,
): void {
  if (isSingleBit && (value === "false" || value === "0")) {
    throw new Error(
      `Cannot assign false to write-only register bit ${targetName}[${bitIndex}]. ` +
        `Use the corresponding CLEAR register to clear bits.`,
    );
  }
  if (!isSingleBit && value === "0") {
    throw new Error(
      `Cannot assign 0 to write-only register bits ${targetName}[${bitIndex}]. ` +
        `Use the corresponding CLEAR register to clear bits.`,
    );
  }
}

/**
 * Build a scoped register name from scope and identifier parts.
 *
 * @param scopeName - The scope name prefix
 * @param parts - The identifier parts (register name, member name)
 * @returns The full scoped register name (e.g., "Scope_Register_Member")
 */
function buildScopedRegisterName(
  scopeName: string,
  parts: readonly string[],
): string {
  return `${scopeName}_${parts.join("_")}`;
}

/**
 * Build register name with automatic scope detection.
 *
 * @param identifiers - The identifier chain
 * @param isKnownScope - Function to check if an identifier is a known scope
 * @returns Object with fullName, regName, and isScoped flag
 */
function buildRegisterNameWithScopeDetection(
  identifiers: readonly string[],
  isKnownScope: (name: string) => boolean,
): IRegisterNameResult {
  const leadingId = identifiers[0];

  if (isKnownScope(leadingId) && identifiers.length >= 3) {
    // Scoped: Scope.Register.Member
    const regName = `${leadingId}_${identifiers[1]}`;
    const fullName = `${regName}_${identifiers[2]}`;
    return { fullName, regName, isScoped: true };
  } else {
    // Non-scoped: Register.Member
    const regName = leadingId;
    const fullName = `${leadingId}_${identifiers[1]}`;
    return { fullName, regName, isScoped: false };
  }
}

/**
 * Assignment Handler Utilities
 */
class AssignmentHandlerUtils {
  static validateScopeContext = validateScopeContext;
  static validateNoCompoundForBitAccess = validateNoCompoundForBitAccess;
  static validateWriteOnlyValue = validateWriteOnlyValue;
  static buildScopedRegisterName = buildScopedRegisterName;
  static buildRegisterNameWithScopeDetection =
    buildRegisterNameWithScopeDetection;
}

export default AssignmentHandlerUtils;
