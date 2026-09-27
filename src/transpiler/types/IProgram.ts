import type IFunctionSymbol from "./symbols/IFunctionSymbol";
import type IFoldedConstant from "./IFoldedConstant";
import type ILexicalFrame from "./ILexicalFrame";
import type ILocalDeclaration from "./ILocalDeclaration";
import type ISourceSpan from "./ISourceSpan";
import type TChainRoot from "./TChainRoot";
import type TValueBinding from "./TValueBinding";
import type TRunTarget from "./TRunTarget";
import type IScopeSymbol from "./symbols/IScopeSymbol";
import type TSymbol from "./symbols/TSymbol";
import type IConflict from "./IConflict";
import type ICallGraphEntry from "./ICallGraphEntry";
import type ICodeGenSymbols from "./ICodeGenSymbols";

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
   * ADR-057: is this QUALIFIED name a type declared inside a scope that
   * `sourceFile` can see -- declared by that file or by a file in its include
   * closure?
   *
   * The cross-file fact 1.3 Declare is not allowed to hold, and the ONE answer
   * both of ADR-057's resolution points read: 1.4 settles each file's deferred
   * types with it, and codegen asks it about the file being generated, so the
   * `.h` and the `.c` cannot disagree. It asks for the file because the
   * whole-program question has the wrong answer: a scope type from a sibling
   * the file never includes captured a bare name the file could only mean as
   * a C typedef, in both halves at once (#1724).
   */
  isScopeTypeVisibleFrom(sourceFile: string, qualifiedName: string): boolean;

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
   * What a binding is worth at compile time, with the declared type that
   * holds it: a const local's or a folded global's or scope member's value.
   * Null for anything else -- a variable, a parameter, an unfolded const, a
   * scope, a header name. Asked of a binding, so the answer is about the
   * declaration the spelling means (#1538, #1664 review).
   */
  constantOf(binding: TValueBinding): IFoldedConstant | null;

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
   * The type names a file declares — struct, type, enum and class — by the C
   * name a generated signature uses: a C-Next scope's `Point` is `Lib__Point`.
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

  /**
   * The symbol view a file's code generation reads: what it declares, plus
   * everything its include closure reaches, with its own names shadowing.
   *
   * Composed here because it is a cross-file question. It was previously built
   * per file and patched during rendering, from a map that filled as the run
   * proceeded — so a file rendered early saw less than the same file rendered
   * late (#1301, #1511).
   */
  codeGenSymbolsFor(sourceFile: string): ICodeGenSymbols | undefined;

  /**
   * Which parameters of each function may be passed by value (ADR-006).
   *
   * A fact with a truth value — is this parameter modified anywhere downstream?
   * — and answering it needs the whole call chain, which crosses files. Keyed by
   * transpiled C name (#1511).
   */
  passByValueParams(): ReadonlyMap<string, ReadonlySet<string>>;

  /**
   * Functions used as an ADR-029 callback, to the typedef they are used as.
   *
   * A function assigned to a callback typedef must keep that typedef's parameter
   * shape, so it takes neither auto-const nor pass-by-value. The use can sit in
   * a different file from the declaration, which makes this cross-file — and it
   * was previously accumulated as files rendered, so an early file decided its
   * signatures on a partial answer (#1511).
   */
  callbackCompatibleFunctions(): ReadonlyMap<string, string>;

  /**
   * Issue #1467: where each `.cnx` include of `sourceFile` resolves to. Empty
   * when the file was never reached through discovery -- a real answer, not a
   * default.
   */
  cnxIncludeRewrites(sourceFile: string): ReadonlyMap<string, string>;

  /**
   * #1668 / #1664: the innermost lexical frame of `sourceFile` containing
   * `at`, or its file frame. Settled and frozen with the program.
   */
  lexicalFrameAt(
    sourceFile: string,
    at: Pick<ISourceSpan, "line" | "column">,
  ): ILexicalFrame;

  /**
   * The local, parameter or `for` variable `name` binds to at `at`, or null.
   * The lexical half of binding only; `bindValue` is the whole decision.
   */
  lexicalDeclarationAt(
    sourceFile: string,
    name: string,
    at: Pick<ISourceSpan, "line" | "column">,
  ): ILocalDeclaration | null;

  /**
   * What a value name, written bare, as `this.name` or as `global.name`,
   * means at `at` -- the one place a spelling becomes a declaration, for
   * typing and emission alike.
   */
  bindValue(
    sourceFile: string,
    root: TChainRoot,
    name: string,
    at: Pick<ISourceSpan, "line" | "column">,
  ): TValueBinding | null;

  /**
   * A bare name's compile-time value where it is used: `constantOf` of what
   * `bindValue` binds it to. The one question every constant fold asks, so a
   * parameter, a variable or an unfolded const shadows a folded const of the
   * same name exactly as it does for typing (#1664 review).
   */
  constantAt(
    sourceFile: string,
    name: string,
    at: Pick<ISourceSpan, "line" | "column">,
  ): IFoldedConstant | null;

  /**
   * ADR-049: the run's one target, settled from every file's pragmas and the
   * target option. Asking a program built without target inputs is a caller
   * error: only a test builds one, and only a test that never asks.
   */
  target(): TRunTarget;

  /**
   * Issue #1322: the directories an angle include from `sourceFile` is searched
   * along, in discovery's priority order. Empty when the file was never
   * discovered, which is also a real answer: a rule that guessed a search path
   * would report against directories the run does not use.
   */
  includeSearchPaths(sourceFile: string): readonly string[];

  /**
   * #1435: the directory a quoted include from `sourceFile` resolves from, as
   * discovery resolved it. Unlike the search path it has no empty answer:
   * every file the run analyzes was discovered, so a missing entry is a
   * defect, and guessing `dirname(sourceFile)` is the re-derivation that let
   * discovery and E0506 disagree for an in-memory root.
   */
  quotedIncludeDirectory(sourceFile: string): string;

  /**
   * The run's scope graph, for the passes after 1.4 (#1452 box 3).
   *
   * 2.2 Plan does NOT read it here: `ModificationFacts.derive` runs before
   * `Program.build`, so a fact needed to BUILD this artifact cannot be reached
   * through it. It takes the registry directly for that reason.
   */
  scope(path: string): IScopeSymbol | null;

  /**
   * The full scope PATH for a scope named `name`, or `name` itself when none
   * exists.
   *
   * This is the question 2.1 and 2.3 were asking through
   * `ScopeUtils.pathOf(getOrCreateScope(name))` -- a name-to-path lookup where
   * the create arm was never taken. Measured across 120 fixtures: those passes
   * produced ZERO creations, and the probe fires from 1.3, so the zero is real.
   * Stated once, with the fallback explicit, instead of four times.
   */
  scopePathOf(name: string): string;

  /**
   * The function a bare call to `name` means from inside `fromScopePath`
   * (`""` at file scope), walking current -> parent -> global (ADR-057). A
   * path that names no scope resolves from the global scope.
   *
   * It takes the PATH, not a scope, so where a lookup starts is decided here
   * once. The typer (#1698) and the C name a call is emitted under each
   * derived the start scope themselves, the same expression twice; the key a
   * call is typed by and the name it is emitted under now share one
   * resolution rather than two that agreed.
   */
  resolveFunction(name: string, fromScopePath: string): IFunctionSymbol | null;
}

export default IProgram;
