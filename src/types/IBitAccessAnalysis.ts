/**
 * Whether an assignment target ends in a bit, or a bit range, of an integer.
 *
 * #1445: declared THREE times before this file existed -- in
 * `MemberChainAnalyzer` (which produces it), in `ICodeGenApi` (which dispatches
 * to it) and in `CodeGenerator` (which implements that method) -- all
 * byte-identical, so a fifth field meant three edits. CLAUDE.md: "If two
 * interfaces need the same fields, extract a shared type."
 *
 * In the shared `src/types/` root rather than beside its producer because more
 * than one area names it, `ICodeGenApi` (`src/TRANSPILE/types/`) among them: a
 * shape named by more than one area is a shared contract, and this directory is
 * where the layer rules send those (#1853).
 *
 * #1668 review: it carried the rendered base target, bit index and type as
 * well, built from the source spelling, so a renamed local's bit write wrote
 * the global it shadows. The write is `AssignmentHandlerUtils.writeBits` now,
 * the one every bit handler uses, and this is only the decision.
 */
interface IBitAccessAnalysis {
  /** True if the last subscript is bit access on an integer */
  isBitAccess: boolean;
}

export default IBitAccessAnalysis;
