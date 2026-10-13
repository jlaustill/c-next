/**
 * #1997: the requests whose sites `ToolchainRequirements` defers to the 2.2
 * plan. The note side (`TranspileState`) and the take side
 * (`CodeGenWalker.planEmissionFacts`) name the same key, so a misspelling on either is a
 * `tsc` error rather than a requirement that silently loses its sites.
 */
type TDeferredSiteKey =
  | "irq_wrappers"
  | "float_static_assert"
  | "ldrex_strex_loop";

export default TDeferredSiteKey;
