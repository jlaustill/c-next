/**
 * Whether an assignment target ends in a bit access, and the pieces the
 * read-modify-write needs if it does.
 *
 * #1445: declared THREE times before this file existed -- in
 * `MemberChainAnalyzer` (which produces it), in `ICodeGenApi` (which dispatches
 * to it) and in `CodeGenerator` (which implements that method) -- all
 * byte-identical, so a fifth field meant three edits. CLAUDE.md: "If two
 * interfaces need the same fields, extract a shared type."
 *
 * In `transpiler/types/` rather than beside its producer because `ICodeGenApi`
 * is one of the three namers and lives here: a shape named by more than one
 * layer is a shared contract, and this directory is where the layer rules send
 * those.
 *
 * The three optional fields are present exactly when `isBitAccess` is true.
 * That is not expressed as a union because `ICodeGenApi`'s consumer reads them
 * behind that check with `!`, and changing how they are read is a separate
 * change from giving them one home.
 */
interface IBitAccessAnalysis {
  /** True if the last subscript is bit access on an integer */
  isBitAccess: boolean;
  /** The base target expression (without bit index) */
  baseTarget?: string;
  /** The bit index expression */
  bitIndex?: string;
  /** The base type of the target */
  baseType?: string;
}

export default IBitAccessAnalysis;
