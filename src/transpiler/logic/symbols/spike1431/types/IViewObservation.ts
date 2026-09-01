/**
 * SPIKE #1431 — THROWAWAY. Deleted before this branch merges.
 *
 * One observation: a question asked of a live container, with the two derived
 * answers recorded beside it at the same moment.
 *
 * THREE answers, not two, because a two-answer probe cannot tell a real divergence
 * from a key-space mismatch:
 *
 *   live        what the container actually returned.
 *   asSpecified the same view re-expressed as a query -- SAME predicate, SAME key
 *               space. This is the IDENTITY CONTROL. It must agree with `live`
 *               everywhere. A disagreement here means the schema failed to express
 *               the view, which is a defect in the probe, not a finding about the
 *               transpiler.
 *   asPrincipled the answer the normalized model says is correct: the right
 *               predicate for the question being asked. The gap between
 *               `asSpecified` and `asPrincipled` is the actual measurement.
 *
 * `ICodeGenSymbols` holds two key spaces at once -- `knownScopes`/`scopeMembers`
 * are keyed by the bare leaf `scope.name`, `knownStructs`/`knownEnums`/
 * `functionReturnTypes` by the transpiled C name. Without the identity control
 * every scope-keyed question would report a disagreement that is only a translation
 * step, and the run would read as a finding.
 */
interface IViewObservation {
  /** The accessor asked, e.g. "CodeGenState.isKnownStruct". */
  readonly question: string;

  /** The argument, verbatim. */
  readonly key: string;

  /** The file being processed when the question was asked. */
  readonly sourceFile: string;

  /**
   * Which pass was live. "analyze" = the analyzers are running and codegen-phase
   * state holds file N-1's data (#1430). "generate" = inside CodeGenerator.generate().
   * A question whose answer differs between the two is a PHASE defect, not a scope one.
   */
  readonly phase: string;

  readonly live: string;
  readonly asSpecified: string;
  readonly asPrincipled: string;
}

export default IViewObservation;
