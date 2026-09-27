/**
 * Assignment Handler Utilities
 *
 * Common utilities shared across assignment handlers to reduce duplication.
 * Issue #707: Extracted from RegisterHandlers.ts and AccessPatternHandlers.ts.
 */

import IRegisterNameResult from "./IRegisterNameResult";
import QualifiedCName from "../../../../../utils/QualifiedCName";
import invariant from "../../../../../utils/invariant";
import QualifiedNameGenerator from "../../../../../utils/QualifiedNameGenerator";
import BitUtils from "../../../../../utils/BitUtils";
import CompositeType from "../../../../../utils/CompositeType";
import type IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";

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
    QualifiedNameGenerator.forMember(declaringScopePath, parts[0]),
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
 * The one bit write: the target without its final subscript, rendered by
 * the target renderer, and that subscript's bit or bit range (#1668 review).
 *
 * Five handlers and the member-chain one each rebuilt the base from the
 * source spelling, so a local renamed `f__gs` was written as the global
 * `gs`, and each picked the mask's width from a type NAME only `u64`/`i64`
 * matched: a header's `uint64_t` or a `u64` struct field got `1U << 40`,
 * undefined behavior. The width is the typer's now, for the value the
 * subscript indexes, whatever its spelling -- and the MISRA C:2012 Rule
 * 10.3 narrowing cast comes with it for every form, not only two.
 */
function writeBits(ctx: IAssignmentContext): string {
  const last = ctx.postfixOps.at(-1);
  invariant(
    last?.kind === "subscript",
    "a bit write's target ends in a subscript: the classifier routed it here",
  );
  // Source order: the base's own subscripts, then the bit's
  const base = ctx.renderBitTarget();
  const [start, width] = last.renderIndexes();
  const type =
    CompositeType.integerOf([ctx.target.last?.before ?? null]) ?? undefined;
  return width === undefined
    ? BitUtils.singleBitWrite(base, start, ctx.generatedValue, type)
    : BitUtils.multiBitWrite(base, start, width, ctx.generatedValue, type);
}

/**
 * Assignment Handler Utilities
 */
class AssignmentHandlerUtils {
  static readonly writeBits = writeBits;
  static readonly validateWriteOnlyValue = validateWriteOnlyValue;
  static readonly buildScopedRegisterName = buildScopedRegisterName;
  static readonly buildRegisterNameWithScopeDetection =
    buildRegisterNameWithScopeDetection;
}

export default AssignmentHandlerUtils;
