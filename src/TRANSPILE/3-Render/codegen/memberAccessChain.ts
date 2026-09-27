/**
 * Struct-parameter access helpers.
 *
 * ADR-006: Struct parameters need -> access (passed by pointer in C),
 *          or . access (passed by reference in C++)
 *
 * ## What used to be here, and why it is not
 *
 * #1445: this module also held `determineSeparator` and a 350-line generic
 * member-chain walker, `buildMemberAccessChain`, with eight private helpers.
 * Both were dead:
 *
 *   determineSeparator       0 production callers, 14 test callers
 *   buildMemberAccessChain   0 production callers, 17 test callers
 *
 * `buildMemberAccessChain`'s only two mentions outside its own tests were
 * PROSE -- `MemberChainAnalyzer`'s header said it "delegates to
 * buildMemberAccessChain to eliminate code duplication" while importing no
 * such thing. A reader who grepped for the delegation found something that
 * looked like confirmation and was not; both lines are corrected with this
 * deletion.
 *
 * This is the third instance of one defect. CLAUDE.md already records the
 * first -- `buildStructParamMemberAccess`, "no production caller ... and knip
 * could not report it, because its six test callers count as usage (#1418)",
 * deleted under #1450. knip cannot see these two either, and for a second
 * reason: they are members of an exported object literal, which the #1556
 * `include: ["classMembers"]` setting does not reach. Chains are built
 * incrementally by `MemberSeparatorResolver` and the postfix generator, never
 * in one call, so a general chain builder has never had a caller here.
 *
 * Deleting the walker is also what takes this module out of
 * `parse-tree-confined-to-parser`: its `ParseTree` import existed solely for
 * the `children` arrays the walker indexed, and the two helpers below name no
 * parse type at all.
 */

/**
 * Options for struct parameter access helpers.
 */
interface StructParamOptions {
  /** Whether we're in C++ mode (struct params are references) */
  cppMode: boolean;
  /**
   * Issue #895: the parameter takes a C callback typedef's pointer shape, so it
   * is a pointer in C++ too -- a C function pointer cannot take a reference.
   * Required so no caller can decide from the mode alone.
   */
  forcePointerSemantics: boolean;
}

/**
 * Whether a struct parameter is a pointer here, rather than a C++ reference --
 * the ONE decision both helpers below read.
 *
 * The member separator used to override the mode for a callback-promoted
 * parameter at each of its two call sites while the whole-value wrap asked the
 * mode alone, so in C++ `f->pokes` stood beside `Full copy = f;`, a `Full*`
 * where a `Full` belongs.
 */
function isPointer(options: StructParamOptions): boolean {
  return options.forcePointerSemantics || !options.cppMode;
}

/**
 * Get the member access separator for struct parameters.
 * Pointer: -> (C, or a callback-promoted parameter in C++); reference: .
 *
 * @param options - The struct param options
 * @returns "->" for a pointer, "." for a C++ reference
 */
function getStructParamSeparator(options: StructParamOptions): string {
  return isPointer(options) ? "->" : ".";
}

/**
 * Wrap a struct parameter used as a whole value (not member access).
 * Pointer: (*param) - dereference it; reference: param - use it directly
 *
 * @param paramName - The parameter name
 * @param options - The struct param options
 * @returns The wrapped parameter expression
 */
function wrapStructParamValue(
  paramName: string,
  options: StructParamOptions,
): string {
  return isPointer(options) ? `(*${paramName})` : paramName;
}

export default {
  getStructParamSeparator,
  wrapStructParamValue,
};
