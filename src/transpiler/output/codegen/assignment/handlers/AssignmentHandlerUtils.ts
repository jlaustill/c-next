/**
 * Assignment Handler Utilities
 *
 * Common utilities shared across assignment handlers to reduce duplication.
 * Issue #707: Extracted from RegisterHandlers.ts and AccessPatternHandlers.ts.
 */

import IRegisterNameResult from "./IRegisterNameResult";
import QualifiedCName from "../../../../../utils/QualifiedCName";
import ScopeUtils from "../../../../../utils/ScopeUtils";
import invariant from "../../../../../utils/invariant";

/**
 * Validate that compound assignment operators are not used with bit field access.
 *
 * @param isCompound - Whether this is a compound assignment
 * @param cnextOp - The C-Next operator being used
 * @throws Error if compound operator is used with bit fields
 */
// #1322: `validateNoCompoundForBitAccess` is gone. Compound assignment on a
// bit index, bit range, slice or string is E0857 in pass 2.1 -- one decision
// where this was six throws with four message variants, and where this very
// helper was defined a second time, verbatim, in `BitAccessHandlers`.

/**
 * A write-1 register bit is never assigned a zero here.
 *
 * #1322: E0872 rejects it in pass 2.1 (ADR-004), by VALUE -- `0x0` and a
 * zero-valued const included, which the text comparison below let through and
 * turned into a SET of the bit the author meant to clear. The generated form
 * for a single bit is `REG = (1U << bit)`, so a zero reaching this point would
 * be emitted as a set; the assertion holds the emission to the rule.
 *
 * @param value - The generated value being assigned
 * @param targetName - The full register name, for the assertion's text
 * @param bitIndex - The bit index expression, for the assertion's text
 * @param isSingleBit - True for single bit access, false for bit range
 */
function validateWriteOnlyValue(
  value: string,
  targetName: string,
  bitIndex: string,
  isSingleBit: boolean,
): void {
  const zero = isSingleBit ? value === "false" || value === "0" : value === "0";
  invariant(
    !zero,
    `a write-1 register bit takes a non-zero value -- E0872 rejects ` +
      `'${value}' on ${targetName}[${bitIndex}] in pass 2.1, before this runs`,
  );
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
  static readonly validateWriteOnlyValue = validateWriteOnlyValue;
  static readonly buildScopedRegisterName = buildScopedRegisterName;
  static readonly buildRegisterNameWithScopeDetection =
    buildRegisterNameWithScopeDetection;
}

export default AssignmentHandlerUtils;
