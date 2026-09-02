/**
 * Assignment Handler Utilities
 *
 * Common utilities shared across assignment handlers to reduce duplication.
 * Issue #707: Extracted from RegisterHandlers.ts and AccessPatternHandlers.ts.
 */

import IRegisterNameResult from "./IRegisterNameResult";
import QualifiedCName from "../../../../../utils/QualifiedCName";
import ScopeUtils from "../../../../../utils/ScopeUtils";

/**
 * Validate that 'this' is being used within a scope context.
 * Throws if currentScopePath is not set.
 *
 * @param currentScopePath - Path of the enclosing scope; `""` at file scope
 * @throws Error if 'this' is used outside a scope
 */
function validateScopeContext(currentScopePath: string): void {
  if (!currentScopePath) {
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
  declaringScopePath: string,
  parts: readonly string[],
): string {
  // #1285: the accumulator loop was a hand-rolled join -- each turn fed the
  // PREVIOUS result back in as if it were a scope, which is why `forMember` had to
  // accept an arbitrary string. The scope qualifies the head; the remaining parts
  // are register/member components joined textually.
  return QualifiedCName.fromParts([
    ScopeUtils.qualifyInScope(parts[0], declaringScopePath),
    ...parts.slice(1),
  ]);
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
    const regName = QualifiedCName.fromParts([leadingId, identifiers[1]]);
    const fullName = QualifiedCName.fromParts([regName, identifiers[2]]);
    return { fullName, regName, isScoped: true };
  } else {
    // Non-scoped: Register.Member
    const regName = leadingId;
    const fullName = QualifiedCName.fromParts([leadingId, identifiers[1]]);
    return { fullName, regName, isScoped: false };
  }
}

/**
 * Assignment Handler Utilities
 */
class AssignmentHandlerUtils {
  static readonly validateScopeContext = validateScopeContext;
  static readonly validateNoCompoundForBitAccess =
    validateNoCompoundForBitAccess;
  static readonly validateWriteOnlyValue = validateWriteOnlyValue;
  static readonly buildScopedRegisterName = buildScopedRegisterName;
  static readonly buildRegisterNameWithScopeDetection =
    buildRegisterNameWithScopeDetection;
}

export default AssignmentHandlerUtils;
