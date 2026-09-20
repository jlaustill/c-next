/**
 * What one declaration says about a name, recorded where 2.1 can read it.
 *
 * #1322. `IScopeFrame.vars` used to map a name to its declared type TEXT and
 * throw the rest away, and that omission is what stopped pass 2.1 authoring
 * most of the diagnostics this card relocates.
 *
 * The facts were never missing from the program, only from the record.
 * `DeclarationScopeCollector` already visits every declaration site -- function
 * parameters, named scopes, blocks, for-headers -- so each field here is one
 * file's parse tree away, with no cross-file question and nothing deferred.
 *
 * ## Why not read them from codegen instead
 *
 * `ICodeGenSymbols` is the only type view an analyzer may read, because it is
 * the only one populated before `runAnalyzers`. It carries struct field
 * dimensions but nothing per-variable. The per-variable answers live in
 * `CodeGenState.typeRegistry`, which `CodeGenerator` fills and `reset()`
 * clears -- both AFTER the analyzers run. Since #1320 hoisted 2.1 Analyze
 * whole-program, that map holds the SAME value for every file in a pass: empty
 * in a fresh process, the previous run's last file in a long-lived one, because
 * the only production `reset()` is per-file inside `generate()`. So an analyzer
 * reading it through `getVariableTypeInfo()` -- which checks it before falling
 * back to `SymbolTable` -- gets a stale local ahead of the correct answer. The
 * order-dependence this comment used to describe was the pre-hoist shape (#1399
 * shipped exactly that); the surviving failure is quieter and needs the opposite
 * debugging.
 */
interface IDeclaredVar {
  /** The declared type as written. What `vars` held before this widened. */
  readonly typeText: string;

  /**
   * Array dimensions in declaration order, empty for a scalar.
   *
   * `(number | string)[]` to match `IVariableSymbol.arrayDimensions`: a
   * dimension may be a literal, or the NAME of a const or C macro that this
   * pass cannot resolve. Recording the name rather than guessing a value keeps
   * the distinction its consumer has to make -- a bounds check can run against
   * a number and must decline against a name.
   */
  readonly dimensions: readonly (number | string)[];

  /** `N` from `string<N>`, or null when the type is not a string. */
  readonly stringCapacity: number | null;

  /** Whether the declaration carries `const` (ADR-013). */
  readonly isConst: boolean;
}

export default IDeclaredVar;
