/**
 * Nullable C standard-library functions that return a STRUCT pointer (`FILE*`),
 * as opposed to the `char*`-returning ones (`fgets`, `strstr`) which map to
 * C-Next's `cstring`. Codegen adds an asterisk to the generated type for these.
 *
 * #1322: this was a static method on `NullCheckAnalyzer`, which put a constant
 * lookup inside pass 2.1 and gave `output/` a reason to import an analyzer.
 * That edge is what `render-cannot-import-analyzers` forbids -- a later pass
 * reaching into an earlier one's modules rather than reading its artifact.
 *
 * It is a constant, not a decision: it answers "which C functions are these?",
 * which is neither "is this program legal?" (2.1) nor "what C should exist?"
 * (2.2). `constants/` is the documented home for runtime lookups, and both
 * passes may read it.
 */
const STRUCT_POINTER_C_FUNCTIONS: ReadonlySet<string> = new Set([
  "fopen",
  "freopen",
  "tmpfile",
]);

export default STRUCT_POINTER_C_FUNCTIONS;
