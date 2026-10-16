import type IRecoveredSlice from "./IRecoveredSlice";

/**
 * Issue #985: what a run's C includes declare, read from them preprocessed as
 * one translation unit -- the way the real compiler meets them, predecessors
 * first. #1844: 1.1 does the preprocessing, so a header that cannot be
 * preprocessed alone is judged on its slice, the text a C compile meets.
 */
interface IRecoveredDeclarations {
  /** Per header, by the path the preprocessor named it, its slice */
  readonly slices: ReadonlyMap<string, IRecoveredSlice>;
  /** Names of function-like macros: no declaration exists to parse */
  readonly macroNames: ReadonlySet<string>;
}

export default IRecoveredDeclarations;
