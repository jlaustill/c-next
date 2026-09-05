import type TSymbol from "./symbols/TSymbol";

/**
 * `Program` — the artifact 1.4 Resolve emits, and the only place a cross-file
 * fact may be read from after it.
 *
 * **The raw tables are deliberately absent from this type.** They exist at
 * runtime, inside the builder's closure, and are simply not declared here. That
 * is the cheapest enforcement available and it costs nothing at runtime:
 * `docs/architecture/symbol-store-prior-art.md` measured it as "the answer to
 * 118 of 163 sites", with four attempted bypasses failing under `--strict` with
 * TS2339. A gate over a store whose collections are reachable would be a
 * backstop for a hole that does not need to exist.
 *
 * It is an interface of functions over plain data rather than a class, and that
 * is a measured constraint rather than a style choice: immer's
 * `freeze(x, true)` is a silent no-op on class instances and does not recurse
 * into one nested in a plain object, so "every artifact is deep-frozen" and
 * "`Program` is a class with `#private` fields" cannot both hold.
 *
 * Every symbol reachable from here is SETTLED: no `TDeferredType` survives
 * `Program.build`, which is what "complete before 2.1 begins" means for the
 * type layer.
 */
interface IProgram {
  /**
   * ADR-057: is this QUALIFIED name a type declared inside a scope, anywhere in
   * the program?
   *
   * The cross-file fact 1.3 Declare is not allowed to hold. A per-file answer
   * to this question is the seed #1472 removed.
   */
  isScopeType(qualifiedName: string): boolean;

  /**
   * The C-Next symbol whose canonical identity is this transpiled C name.
   *
   * Exact identity, never the bare-name index: asking a bare-name lookup with a
   * transpiled name returns empty for every scoped symbol, which reads as "no
   * such symbol" rather than "wrong question" (#1139).
   */
  symbolByCName(cName: string): TSymbol | undefined;

  /** The settled symbols a file declares. */
  symbolsInFile(sourceFile: string): ReadonlyArray<TSymbol>;

  /** Every file the program declared, in the order they were declared. */
  sourceFiles(): ReadonlyArray<string>;

  /**
   * Integer value of a named const, or undefined when the name is not a const
   * with a literal integer initializer.
   *
   * Cross-file by nature: #1220 is the case where an analyzer knew only the
   * consts it had walked out of the current file, so `10 / ZERO` with an
   * imported ZERO emitted a real division by zero that compiled clean.
   */
  constValue(name: string): number | undefined;

  /** Every const name to its integer value, keyed by bare name. */
  constValues(): ReadonlyMap<string, number>;
}

export default IProgram;
