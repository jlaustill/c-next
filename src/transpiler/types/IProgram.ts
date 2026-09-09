import type TSymbol from "./symbols/TSymbol";
import type IConflict from "./IConflict";
import type ICallGraphEntry from "./ICallGraphEntry";

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
   * Every enum the program declares, by transpiled C name.
   *
   * Header generation asks this to avoid forward-declaring an enum that an
   * include already defines (#478). Whole-program by nature, and derived from
   * the artifact rather than accumulated as files are transpiled -- the latter
   * made the answer depend on topological order.
   */
  knownEnums(): ReadonlySet<string>;

  /**
   * The non-array fields of each struct declared in a C or C++ header.
   *
   * ADR-016 initialization analysis asks whether an initializer names every
   * field, and an array field is not one it must name (#355). Cross-file by
   * definition: the struct is declared in a header this program includes.
   */
  externalStructFields(): ReadonlyMap<string, ReadonlySet<string>>;

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

  /**
   * The same, as seen from inside `scopePath`: that scope's own consts shadow
   * file-scope ones of the same name, in ADR-057's candidate order.
   *
   * #1322 review: asking `constValues()` from inside a scope is asking a
   * question the flat map cannot answer. Two scopes each declaring `SIZE`
   * share its bare key, so the answer is whichever was derived last -- which
   * rejected a legal program and made ADR-036's bounds check order-dependent.
   * A caller inside a scope asks with it.
   */
  constValuesIn(scopePath: string): ReadonlyMap<string, number>;

  /**
   * Every symbol conflict in the program.
   *
   * Cross-file by construction — a conflict exists only when two files define
   * the same name — and one of the three facts that also needs the C and C++
   * header symbols, not just C-Next's. It was previously derived from an
   * accumulator mid-run, so the answer depended on how much had been inserted
   * when it was asked (#1511).
   */
  conflicts(): ReadonlyArray<IConflict>;

  /**
   * The type names a file declares — struct, type, enum and class.
   *
   * "Which C header declares this type", asked from the file's side. Header
   * generation includes the header that defines a type rather than forward
   * declaring it (#497), and picking WHICH header wins belongs to whoever holds
   * the include order, so this answers only what each file declares (#1511).
   */
  typesDeclaredIn(sourceFile: string): ReadonlySet<string>;

  /**
   * Whether this typedef names a struct nothing in the program ever defines.
   *
   * Cross-file by nature: a header may forward-declare a struct and typedef it
   * while the body arrives from another header entirely, so "opaque" is only
   * decidable once every header has been read. Variables of such a type are
   * generated as pointers (#948), which makes a wrong answer a codegen bug
   * rather than a cosmetic one.
   */
  isOpaqueType(typeName: string): boolean;

  /** Every truly opaque typedef, resolved. */
  opaqueTypes(): ReadonlySet<string>;

  /**
   * Which parameters each function modifies, direct and transitive.
   *
   * Decides whether a caller's argument may take ADR-013 auto-const, and the
   * callee is routinely in another file. Derived once over every tree rather
   * than accumulated file by file, so it no longer depends on how far the run
   * has got (#1511).
   */
  modifiedParameters(): ReadonlyMap<string, ReadonlySet<string>>;

  /** Each function's parameter names, in declaration order. */
  functionParamLists(): ReadonlyMap<string, ReadonlyArray<string>>;

  /** Who calls whom, as transitive modification propagation reads it. */
  callGraph(): ReadonlyMap<string, ReadonlyArray<ICallGraphEntry>>;
}

export default IProgram;
