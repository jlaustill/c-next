/**
 * 1.4 Resolve — builds `Program` from what every file declared.
 *
 * Declare emits one `IFileSymbols` per file, each computable with only that
 * file's parse tree open. Resolve is the first point at which the whole program
 * exists, so it is the first point at which a cross-file question has an
 * answer. Two things follow, and they are the whole pass:
 *
 *   - the scope-type index, combined from each file's `declaredScopeTypes`,
 *     which is the fact Declare used to be handed as a parameter; and
 *   - settling every `TDeferredType` against it, which is the ADR-057
 *     resolution Declare could not perform.
 *
 * Building and settling are one step on purpose. A `Program` holding unsettled
 * symbols would be an artifact that says "complete" and is not, and every
 * consumer would have to remember to settle first -- the shape that makes an
 * invariant unenforceable.
 *
 * `docs/architecture/symbol-store-prior-art.md` governs the design:
 * normalization as discipline in plain TypeScript, the SQL engine rejected on
 * criterion 3 before its dependency cost, and the raw tables hidden by simply
 * not declaring them on `IProgram`.
 */

import LexicalFrames from "./LexicalFrames";
import type ILexicalFrame from "../../transpiler/types/ILexicalFrame";
import type ILocalDeclaration from "../../transpiler/types/ILocalDeclaration";
import type ISourceSpan from "../../transpiler/types/ISourceSpan";
import type TChainRoot from "../../transpiler/types/TChainRoot";
import type TValueBinding from "../../transpiler/types/TValueBinding";
import RunTarget from "./RunTarget";
import type TRunTarget from "../../transpiler/types/TRunTarget";
import invariant from "../../utils/invariant";
import type IFunctionSymbol from "../../transpiler/types/symbols/IFunctionSymbol";
import ScopeUtils from "../../utils/ScopeUtils";
import type IScopeSymbol from "../../transpiler/types/symbols/IScopeSymbol";
import type IFileSymbols from "../../transpiler/types/IFileSymbols";
import type IStructFieldInfo from "../../transpiler/types/symbols/IStructFieldInfo";
import type IProgram from "../../transpiler/types/IProgram";
import type TSymbol from "../../transpiler/types/symbols/TSymbol";
import type IParameterInfo from "../../transpiler/types/symbols/IParameterInfo";
import DeferredTypes from "./DeferredTypes";
import ConstantFold from "../../utils/ConstantFold";
import type IFoldedConstant from "../../transpiler/types/IFoldedConstant";
import OpaqueTypeResolution from "../../utils/OpaqueTypeResolution";
import SMALL_PRIMITIVES from "../../transpiler/constants/SMALL_PRIMITIVES";
import TypeResolver from "../../utils/TypeResolver";
import SymbolGuards from "../../transpiler/types/symbols/SymbolGuards";
import type IVariableSymbol from "../../transpiler/types/symbols/IVariableSymbol";
import type IBindingFacts from "./types/IBindingFacts";
import ConflictDetector from "./ConflictDetector";
import type IForeignSymbols from "../../transpiler/types/IForeignSymbols";
import type IConflict from "../../transpiler/types/IConflict";
import type IModificationFacts from "../../transpiler/types/IModificationFacts";
import type ICallGraphEntry from "../../transpiler/types/ICallGraphEntry";
import type ICodeGenSymbols from "../../transpiler/types/ICodeGenSymbols";
import type IDiscoveryFacts from "../../transpiler/types/IDiscoveryFacts";
import type IProgramInputs from "../../transpiler/types/IProgramInputs";
import type IVisibilityInput from "../../transpiler/types/IVisibilityInput";
import TSymbolInfoAdapter from "../3-Declare/cnext/adapters/TSymbolInfoAdapter";
import TransitiveEnumCollector from "./TransitiveEnumCollector";
import VisibleSymbols from "./VisibleSymbols";

/** Shared empty result, so a miss does not allocate. */
const EMPTY_NAMES: ReadonlySet<string> = new Set<string>();
const EMPTY_REWRITES: ReadonlyMap<string, string> = new Map<string, string>();
const EMPTY_PATHS: readonly string[] = [];
const EMPTY_HEADER_FIELDS: ReadonlyMap<
  string,
  ReadonlyMap<string, IStructFieldInfo>
> = new Map();
const EMPTY_CALLBACKS: ReadonlyMap<string, string> = new Map();

/**
 * A local as the finished program's frames hold it: already settled. Only
 * 1.4, binding over the frames while it settles them, needs another answer.
 */
const SETTLED = (declaration: ILocalDeclaration): ILocalDeclaration =>
  declaration;

/**
 * A program with no C or C++ headers behind it.
 *
 * Spelled once rather than defaulted field-by-field: every field of
 * `IForeignSymbols` is required so that a new one cannot be forgotten at a call
 * site, and a literal here would defeat that the moment one is added.
 */
const NO_FOREIGN: IForeignSymbols = {
  c: [],
  cpp: [],
  opaqueTypedefs: EMPTY_NAMES,
  typedefToTag: new Map<string, string>(),
  structTagsWithBodies: EMPTY_NAMES,
};

/** A program whose parameter-modification facts were not derived. */
const NO_MODIFICATIONS: IModificationFacts = {
  modifiedParameters: new Map<string, ReadonlySet<string>>(),
  functionParamLists: new Map<string, ReadonlyArray<string>>(),
  callGraph: new Map<string, ReadonlyArray<ICallGraphEntry>>(),
};

/** A program built without include information: nothing composes. */
const NO_DISCOVERY: IDiscoveryFacts = {
  cnxIncludeRewrites: new Map(),
  includeSearchPaths: new Map(),
};

const NO_VISIBILITY: IVisibilityInput = {
  includeDirs: [],
  cnextIncludesByFile: new Map(),
};

/** A use's position */
type TPosition = Pick<ISourceSpan, "line" | "column">;

class Program {
  /**
   * Build the artifact from every declared file.
   *
   * @param files one `IFileSymbols` per file, in declaration order
   */
  static build(
    files: ReadonlyArray<IFileSymbols>,
    inputs: IProgramInputs = {},
  ): IProgram {
    // Destructured once, here, so the body reads exactly as it did when these
    // were positional. `IProgramInputs` says why they travel together.
    const headerStructFields = inputs.headerStructFields ?? EMPTY_HEADER_FIELDS;
    const foreign = inputs.foreign ?? NO_FOREIGN;
    const modifications = inputs.modifications ?? NO_MODIFICATIONS;
    const visibility = inputs.visibility ?? NO_VISIBILITY;
    const callbackCompatibleFunctions =
      inputs.callbackCompatibleFunctions ?? EMPTY_CALLBACKS;
    const discovery = inputs.discovery ?? NO_DISCOVERY;
    const registry = inputs.registry ?? null;

    // Each derivation is its own step, in dependency order: the scope-type
    // index settles the types, settled types yield const values, const values
    // resolve dimensions, and the finished symbols answer everything else.
    // Written inline this read as one function with six nested loops, which is
    // both hard to follow and hard to change one part of.
    const isScopeType = Program.scopeTypeIndex(files);
    const settledByFile = Program.settleEveryFile(files, isScopeType);
    const foreignNames = new Set([
      ...foreign.c.map((symbol) => symbol.name),
      ...foreign.cpp.map((symbol) => symbol.name),
    ]);
    // What a spelling means while the consts fold: the declarations as 1.3
    // recorded them, bound in the same order every later pass binds in.
    const declared: IBindingFacts = {
      framesByFile: new Map(
        files.map((file) => [file.sourceFile, file.lexicalScopes]),
      ),
      symbolsByCName: Program.indexByCName(settledByFile),
      registry,
      foreignNames,
    };
    const derivedConsts = Program.deriveConstValues(settledByFile, declared);
    const symbolsByFile = Program.resolveDimensions(
      settledByFile,
      declared,
      derivedConsts,
    );
    const symbolsByCName = Program.indexByCName(symbolsByFile);
    // #1668: each file's lexical frames, settled against the whole program's
    // scope types and consts, then frozen with it.
    const framesByFile = new Map(
      files.map((file) => [
        file.sourceFile,
        LexicalFrames.settle(
          file.lexicalScopes,
          isScopeType,
          (name, at, settled) =>
            Program.constantOf(
              Program.bindValue(declared, file.sourceFile, null, name, at),
              derivedConsts,
              settled,
            ),
        ),
      ]),
    );
    const bound: IBindingFacts = {
      framesByFile,
      symbolsByCName,
      registry,
      foreignNames,
    };
    const knownEnums = Program.deriveKnownEnums(symbolsByFile);
    const externalStructFields =
      Program.deriveExternalStructFields(headerStructFields);
    const sourceFiles = files.map((file) => file.sourceFile);
    // Derived from the SETTLED symbols, and from every file at once. Detection
    // used to run over whatever an accumulator held when it was asked, which is
    // why it could not live here: the C-Next half was inserted after this point.
    // Flattened in file-declaration order so the report order is unchanged.
    const typesByFile = Program.deriveTypesByFile(symbolsByFile, foreign);
    const opaqueTypes = Program.deriveOpaqueTypes(foreign);
    const visibleByFile = Program.deriveVisibleSymbols(
      symbolsByFile,
      visibility,
    );
    const passByValueParams = Program.derivePassByValue(
      symbolsByFile,
      modifications.modifiedParameters,
    );
    // Settled once, with the program, so every pass reads one answer.
    const target = inputs.target ? RunTarget.resolve(inputs.target) : null;
    const conflicts = ConflictDetector.detect(
      registry,
      [...symbolsByFile.values()].flat(),
      foreign.c,
      foreign.cpp,
    );

    // The query surface. Every collection above stays in this closure and is
    // reachable only through the functions below, which is what makes
    // `IProgram` impossible to bypass rather than merely discouraging it.
    return Object.freeze({
      isScopeType,
      symbolByCName: (cName: string): TSymbol | undefined =>
        symbolsByCName.get(cName),
      symbolsInFile: (sourceFile: string): ReadonlyArray<TSymbol> =>
        symbolsByFile.get(sourceFile) ?? [],
      sourceFiles: (): ReadonlyArray<string> => sourceFiles,
      knownEnums: (): ReadonlySet<string> => knownEnums,
      externalStructFields: (): ReadonlyMap<string, ReadonlySet<string>> =>
        externalStructFields,
      constantOf: (binding: TValueBinding): IFoldedConstant | null =>
        Program.constantOf(binding, derivedConsts, SETTLED) ?? null,
      conflicts: (): ReadonlyArray<IConflict> => conflicts,
      typesDeclaredIn: (sourceFile: string): ReadonlySet<string> =>
        typesByFile.get(sourceFile) ?? EMPTY_NAMES,
      isOpaqueType: (typeName: string): boolean => opaqueTypes.has(typeName),
      opaqueTypes: (): ReadonlySet<string> => opaqueTypes,
      modifiedParameters: (): ReadonlyMap<string, ReadonlySet<string>> =>
        modifications.modifiedParameters,
      functionParamLists: (): ReadonlyMap<string, ReadonlyArray<string>> =>
        modifications.functionParamLists,
      callGraph: (): ReadonlyMap<string, ReadonlyArray<ICallGraphEntry>> =>
        modifications.callGraph,
      codeGenSymbolsFor: (sourceFile: string): ICodeGenSymbols | undefined =>
        visibleByFile.get(sourceFile),
      passByValueParams: (): ReadonlyMap<string, ReadonlySet<string>> =>
        passByValueParams,
      callbackCompatibleFunctions: (): ReadonlyMap<string, string> =>
        callbackCompatibleFunctions,
      cnxIncludeRewrites: (sourceFile: string): ReadonlyMap<string, string> =>
        discovery.cnxIncludeRewrites.get(sourceFile) ?? EMPTY_REWRITES,
      lexicalFrameAt: (sourceFile: string, at: TPosition): ILexicalFrame => {
        const root = framesByFile.get(sourceFile);
        invariant(root, `${sourceFile} is a file of this program`);
        return LexicalFrames.frameAt(root, at);
      },
      lexicalDeclarationAt: (
        sourceFile: string,
        name: string,
        at: TPosition,
      ): ILocalDeclaration | null => {
        const root = framesByFile.get(sourceFile);
        return root ? LexicalFrames.declarationAt(root, name, at) : null;
      },
      bindValue: (
        sourceFile: string,
        root: TChainRoot,
        name: string,
        at: TPosition,
      ): TValueBinding | null =>
        Program.bindValue(bound, sourceFile, root, name, at),
      constantAt: (
        sourceFile: string,
        name: string,
        at: TPosition,
      ): IFoldedConstant | null =>
        Program.constantOf(
          Program.bindValue(bound, sourceFile, null, name, at),
          derivedConsts,
          SETTLED,
        ) ?? null,
      target: (): TRunTarget => {
        invariant(
          target,
          "a program built without target inputs has no target",
        );
        return target;
      },
      includeSearchPaths: (sourceFile: string): readonly string[] =>
        discovery.includeSearchPaths.get(sourceFile) ?? EMPTY_PATHS,
      scope: (path: string): IScopeSymbol | null =>
        registry?.getScope(path) ?? null,
      // Delegated like every sibling in this literal, rather than re-spelling
      // the body: `SymbolRegistry.scopePathOf` already falls back to the bare
      // name on a miss, and its own doc names this as the same decision. The
      // two spellings are the two arms `FunctionCallAnalyzer.scopePathOf`
      // selects between, so it could not have noticed them diverging.
      scopePathOf: (name: string): string =>
        registry?.scopePathOf(name) ?? name,
      globalScope: (): IScopeSymbol =>
        registry?.getGlobalScope() ?? ScopeUtils.createGlobalScope(),
      resolveFunction: (
        name: string,
        fromScope: IScopeSymbol,
      ): IFunctionSymbol | null =>
        registry?.resolveFunction(name, fromScope) ?? null,
    });
  }

  /**
   * The type names each file declares — struct, type, enum and class.
   *
   * "Which header declares this type" asked the other way round, because that
   * is the direction the fact is authored in: a symbol knows its `sourceFile`,
   * so grouping by file is a read of the symbols, while the inverse would have
   * to pick a winner among headers and that choice belongs to whoever holds the
   * include order (#1511).
   *
   * Every language, in the order a per-file lookup used to return them —
   * C-Next, then C, then C++ — so a name declared in two of them keeps the same
   * precedence it had.
   */
  private static deriveTypesByFile(
    symbolsByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    foreign: IForeignSymbols,
  ): Map<string, Set<string>> {
    const typesByFile = new Map<string, Set<string>>();

    const record = (sourceFile: string, kind: string, name: string): void => {
      if (
        kind !== "struct" &&
        kind !== "type" &&
        kind !== "enum" &&
        kind !== "class"
      ) {
        return;
      }
      const existing = typesByFile.get(sourceFile);
      if (existing) {
        existing.add(name);
      } else {
        typesByFile.set(sourceFile, new Set([name]));
      }
    };

    for (const symbols of symbolsByFile.values()) {
      for (const symbol of symbols) {
        record(symbol.sourceFile, symbol.kind, symbol.name);
      }
    }
    for (const symbol of foreign.c) {
      record(symbol.sourceFile, symbol.kind, symbol.name);
    }
    for (const symbol of foreign.cpp) {
      record(symbol.sourceFile, symbol.kind, symbol.name);
    }

    return typesByFile;
  }

  /**
   * The typedefs that are TRULY opaque.
   *
   * A header may forward-declare `struct _widget_t` and typedef it, then define
   * the struct later -- in the same header or another one this program includes.
   * The typedef is opaque only if no such body ever arrived, so this is a
   * whole-program question and the raw "declared against a forward declaration"
   * set is not the answer.
   *
   * Resolved once here rather than at each query, which is what makes it a fact
   * of the artifact: the previous form recomputed it from a table that was still
   * being filled, so the same name could answer differently depending on when it
   * was asked (#948, #958, #1511).
   */
  private static deriveOpaqueTypes(
    foreign: IForeignSymbols,
  ): ReadonlySet<string> {
    return OpaqueTypeResolution.resolveAll(
      foreign.opaqueTypedefs,
      foreign.typedefToTag,
      foreign.structTagsWithBodies,
    );
  }

  /**
   * What each file may SEE: its own declarations plus its include closure's.
   *
   * Composed for every file at once, which is the point. It used to run per file
   * while that file was being rendered, over a map the publish loop was still
   * filling -- and the collector silently skips a file it has not reached yet,
   * so the answer depended on position in the run. #1301 is that bug: a cyclic
   * include graph made the order arbitrary, and the fix was to compute it later
   * still. Here there is no later: the whole program is in hand.
   *
   * The per-file views are built here rather than taken as an argument because
   * they must come from the SETTLED symbols. Handing over Declare's provisional
   * ones would put unsettled type names into the view codegen reads.
   */
  private static deriveVisibleSymbols(
    symbolsByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    visibility: IVisibilityInput,
  ): Map<string, ICodeGenSymbols> {
    const ownView = new Map<string, ICodeGenSymbols>();
    for (const [sourceFile, symbols] of symbolsByFile) {
      ownView.set(sourceFile, TSymbolInfoAdapter.convert(symbols));
    }

    const visible = new Map<string, ICodeGenSymbols>();
    for (const [sourceFile, own] of ownView) {
      const declaredIncludes = visibility.cnextIncludesByFile.get(sourceFile);
      // Two entry points, and which one applies is a property of how the file
      // arrived: a standalone run states its includes, a discovered file has
      // them on disk to walk from.
      const sources = declaredIncludes
        ? TransitiveEnumCollector.collectForStandalone(
            declaredIncludes,
            ownView,
            visibility.includeDirs,
          ).sources
        : TransitiveEnumCollector.collect(
            sourceFile,
            ownView,
            visibility.includeDirs,
          ).sources;
      visible.set(
        sourceFile,
        sources.length > 0
          ? VisibleSymbols.mergeExternalSymbols(own, sources)
          : own,
      );
    }
    return visible;
  }

  /**
   * Which parameters may be passed by value (ADR-006).
   *
   * A FACT, not a preference: a parameter is eligible when it is a small
   * primitive, is not an array, and nothing modifies it — and "nothing modifies
   * it" is only answerable across the whole call chain, which routinely crosses
   * files. That is why it is derived here and not where the signature is
   * printed.
   *
   * Keyed by transpiled C name, the identity the symbol already carries, so this
   * agrees with the modification facts by construction rather than by spelling
   * the qualification a second time (#1139).
   */
  private static derivePassByValue(
    symbolsByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    modifiedParameters: ReadonlyMap<string, ReadonlySet<string>>,
  ): ReadonlyMap<string, ReadonlySet<string>> {
    const byFunction = new Map<string, ReadonlySet<string>>();
    for (const symbols of symbolsByFile.values()) {
      for (const symbol of symbols) {
        if (!SymbolGuards.isFunction(symbol)) continue;
        byFunction.set(
          symbol.fullyQualifiedCName,
          Program.eligibleParameters(
            symbol.parameters,
            modifiedParameters.get(symbol.fullyQualifiedCName),
          ),
        );
      }
    }
    return byFunction;
  }

  /**
   * The parameters of one function that ADR-006 lets pass by value.
   *
   * Split from the walk above rather than nested inside it: three levels of loop
   * put `derivePassByValue` over SonarCloud's cognitive-complexity limit, and the
   * per-parameter rule is the part worth reading on its own.
   */
  private static eligibleParameters(
    parameters: ReadonlyArray<IParameterInfo>,
    modified: ReadonlySet<string> | undefined,
  ): ReadonlySet<string> {
    const eligible = new Set<string>();
    for (const parameter of parameters) {
      // An array parameter decays to a pointer whatever its element type, so
      // ADR-006 never applies to one.
      const isEligible =
        !parameter.isArray &&
        SMALL_PRIMITIVES.has(TypeResolver.getTypeName(parameter.type)) &&
        !(modified?.has(parameter.name) ?? false);
      if (isEligible) {
        eligible.add(parameter.name);
      }
    }
    return eligible;
  }

  /**
   * ADR-057: every scope type the PROGRAM declares.
   *
   * Combined from per-file answers rather than collected by a pass of its own:
   * Declare authored each file's set, and nothing may recompute a fact an
   * earlier pass owns. This is the cross-file fact 1.3 no longer receives as a
   * parameter.
   */
  private static scopeTypeIndex(
    files: ReadonlyArray<IFileSymbols>,
  ): (qualifiedName: string) => boolean {
    const scopeTypes = new Set<string>();
    for (const file of files) {
      for (const scopeType of file.declaredScopeTypes) {
        scopeTypes.add(scopeType);
      }
    }
    return (qualifiedName: string): boolean => scopeTypes.has(qualifiedName);
  }

  /**
   * Settle every file's deferred types, and refuse to hand back a `Program`
   * that still holds one.
   *
   * The pass's own negative control, checked per file so the message can name
   * one. `TypeResolver.getTypeName` throws on a deferred type, so an escapee
   * would otherwise surface somewhere in codegen with nothing to say about
   * which pass dropped it.
   */
  private static settleEveryFile(
    files: ReadonlyArray<IFileSymbols>,
    isScopeType: (qualifiedName: string) => boolean,
  ): Map<string, ReadonlyArray<TSymbol>> {
    const settledByFile = new Map<string, ReadonlyArray<TSymbol>>();
    for (const file of files) {
      settledByFile.set(
        file.sourceFile,
        DeferredTypes.settle(file.symbols, isScopeType),
      );
    }

    // Checked only once EVERY file is settled, not inside the loop above.
    // A scope spanned across files (#1333, #1334) is a single object holding
    // every contributing file's member functions, so a mid-loop check reports a
    // sibling's not-yet-settled function as this file's escapee -- which is what
    // it did: the two spanned fixtures failed here naming the file that was
    // already correct. Per-file granularity survives in the message, which is
    // all it was ever for.
    for (const [sourceFile, settled] of settledByFile) {
      if (DeferredTypes.hasUnsettled(settled)) {
        throw new Error(
          `Internal error: 1.4 Resolve left a deferred type in ${sourceFile}`,
        );
      }
    }

    return settledByFile;
  }

  /**
   * Every file-scope and scope const's integer value, by C name, folded once
   * for the whole program.
   *
   * A const's initializer folds with the one evaluator, and each name in it
   * means what the binder says it means where the const is declared: the
   * scope's own member, then a file-scope global (ADR-057). The fold repeats
   * until nothing new folds, so neither declaration order nor file order
   * decides whether `const B <- A * 2` has a value (#1668, C11).
   *
   * #1664 review: the fold used to look names up in a map of the consts that
   * had folded SO FAR. A scope's `N` that did not fold, or had not folded
   * yet, was absent from it, so the file-scope `N` answered in its place --
   * the value the binder, and the emitted `S__N`, never use. Bound by
   * declaration instead, an unfolded `N` leaves everything built on it
   * unfolded, and a later one folds on the next round.
   */
  private static deriveConstValues(
    settledByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    declared: IBindingFacts,
  ): ReadonlyMap<string, number> {
    const values = new Map<string, number>();
    let pending = [...settledByFile.values()]
      .flat()
      .filter(
        (symbol): symbol is IVariableSymbol =>
          symbol.kind === "variable" &&
          symbol.isConst &&
          symbol.initialValue !== undefined,
      );
    let folded = true;
    while (folded && pending.length > 0) {
      folded = false;
      const unresolved: IVariableSymbol[] = [];
      for (const symbol of pending) {
        const value = ConstantFold.declared(
          symbol.initialValue!,
          symbol.type,
          Program.constantsIn(declared, symbol.scopePath, values),
        );
        if (value === undefined) {
          unresolved.push(symbol);
          continue;
        }
        folded = true;
        values.set(symbol.fullyQualifiedCName, value);
      }
      pending = unresolved;
    }
    return values;
  }

  /**
   * A name's value as a declaration in `scopePath` sees it -- a file-scope or
   * scope-level declaration, where no local can be in view.
   */
  private static constantsIn(
    facts: IBindingFacts,
    scopePath: string,
    values: ReadonlyMap<string, number>,
  ): (name: string) => IFoldedConstant | undefined {
    return (name) =>
      Program.constantOf(
        Program.bindOutside(facts, scopePath, null, name),
        values,
        SETTLED,
      );
  }

  /**
   * What a binding is worth at compile time: a local's settled value, or a
   * global's or scope member's folded one, with the declared type that holds
   * it. Anything else -- a variable, a parameter, an unfolded const, a scope,
   * a header name -- has none.
   *
   * @param settled a local's settled declaration; 1.4 binds over the
   *        unsettled frames while it settles them
   */
  private static constantOf(
    binding: TValueBinding | null,
    values: ReadonlyMap<string, number>,
    settled: (declaration: ILocalDeclaration) => ILocalDeclaration | undefined,
  ): IFoldedConstant | undefined {
    if (binding?.kind === "local") {
      const declaration = settled(binding.declaration);
      return declaration?.constValue === null || declaration === undefined
        ? undefined
        : {
            value: declaration.constValue,
            typeName: ConstantFold.typeNameOf(declaration.type),
          };
    }
    if (binding?.kind === "variable" && binding.symbol.isConst) {
      const value = values.get(binding.symbol.fullyQualifiedCName);
      return value === undefined
        ? undefined
        : { value, typeName: ConstantFold.typeNameOf(binding.symbol.type) };
    }
    return undefined;
  }

  /** Tier 2: resolved array dimensions, per file. */
  private static resolveDimensions(
    settledByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    declared: IBindingFacts,
    values: ReadonlyMap<string, number>,
  ): Map<string, ReadonlyArray<TSymbol>> {
    const symbolsByFile = new Map<string, ReadonlyArray<TSymbol>>();
    for (const [sourceFile, settled] of settledByFile) {
      symbolsByFile.set(
        sourceFile,
        settled.map((symbol) =>
          Program.withResolvedDimensions(
            symbol,
            Program.constantsIn(declared, symbol.scopePath, values),
          ),
        ),
      );
    }
    return symbolsByFile;
  }

  /**
   * The canonical-identity index.
   *
   * First declaration wins, matching the run-wide symbol table's own
   * precedence. A genuine clash is a diagnostic 2.1 owns, not a silent
   * overwrite here.
   */
  /**
   * #1668: what a value name means at a position -- the one place a spelling
   * becomes a declaration.
   *
   * A bare name: the innermost local, then the enclosing scope's member,
   * then a file-scope global, then a C-Next scope, then a C/C++ header name.
   * `this.x` is the enclosing scope's member only; `global.x` never binds a
   * local. Scope members and globals are found by C-name identity, never by a
   * first bare-name match, so a reopened scope in another file binds too.
   */
  private static bindValue(
    facts: IBindingFacts,
    sourceFile: string,
    root: TChainRoot,
    name: string,
    at: TPosition,
  ): TValueBinding | null {
    const frames = facts.framesByFile.get(sourceFile);
    const scopePath = frames ? LexicalFrames.frameAt(frames, at).scopePath : "";
    const local =
      frames && root === null
        ? LexicalFrames.declarationAt(frames, name, at)
        : null;
    if (local) {
      return { kind: "local", declaration: local, scopePath };
    }
    return Program.bindOutside(facts, scopePath, root, name);
  }

  /**
   * The binding a name has when no local declares it, as seen from inside
   * `scopePath` -- `bindValue`'s order past its locals, and the whole order
   * for a declaration at file or scope level, where no local is in view.
   */
  private static bindOutside(
    facts: IBindingFacts,
    scopePath: string,
    root: TChainRoot,
    name: string,
  ): TValueBinding | null {
    const variable = (cName: string): TValueBinding | null => {
      const symbol = facts.symbolsByCName.get(cName);
      return symbol?.kind === "variable" ? { kind: "variable", symbol } : null;
    };
    const member = (): TValueBinding | null =>
      scopePath === ""
        ? null
        : variable(ScopeUtils.getTranspiledCName({ name, scopePath }));
    const scope = (): TValueBinding | null =>
      facts.registry?.getScope(name)
        ? { kind: "scope", scopePath: name }
        : null;

    if (root === "this") {
      return member();
    }
    if (root === "global") {
      return variable(name) ?? scope();
    }
    return (
      member() ??
      variable(name) ??
      scope() ??
      (facts.foreignNames.has(name) ? { kind: "foreign", name } : null)
    );
  }

  private static indexByCName(
    symbolsByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
  ): Map<string, TSymbol> {
    const symbolsByCName = new Map<string, TSymbol>();
    for (const symbols of symbolsByFile.values()) {
      for (const symbol of symbols) {
        if (!symbolsByCName.has(symbol.fullyQualifiedCName)) {
          symbolsByCName.set(symbol.fullyQualifiedCName, symbol);
        }
      }
    }
    return symbolsByCName;
  }

  /**
   * Tier 2: every enum the program declares.
   *
   * Header generation needs "is this enum declared anywhere" to decide it must
   * not forward-declare one from an include (#478). Aggregating it from
   * per-file views as they accumulated made the answer depend on topological
   * order, which holds only while the include graph is acyclic (#1167).
   */
  private static deriveKnownEnums(
    symbolsByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
  ): Set<string> {
    const knownEnums = new Set<string>();
    for (const symbols of symbolsByFile.values()) {
      for (const symbol of symbols) {
        if (symbol.kind === "enum") {
          knownEnums.add(symbol.fullyQualifiedCName);
        }
      }
    }
    return knownEnums;
  }

  /**
   * Tier 2: external struct fields.
   *
   * Which fields a struct declared in a C/C++ header has, for ADR-016
   * initialization analysis. Array fields are excluded (#355): an array field
   * is not something an initializer must name. A struct whose every field is an
   * array contributes nothing to ask about, so it is absent rather than
   * present-and-empty.
   */
  private static deriveExternalStructFields(
    headerStructFields: ReadonlyMap<
      string,
      ReadonlyMap<string, IStructFieldInfo>
    >,
  ): Map<string, ReadonlySet<string>> {
    const externalStructFields = new Map<string, ReadonlySet<string>>();
    for (const [structName, fieldMap] of headerStructFields) {
      const nonArrayFields = new Set<string>();
      for (const [fieldName, fieldInfo] of fieldMap) {
        if (
          !fieldInfo.arrayDimensions ||
          fieldInfo.arrayDimensions.length === 0
        ) {
          nonArrayFields.add(fieldName);
        }
      }
      if (nonArrayFields.size > 0) {
        externalStructFields.set(structName, nonArrayFields);
      }
    }
    return externalStructFields;
  }

  /**
   * A variable, a function's parameters or a struct's fields, with array
   * dimensions that name consts replaced by their values.
   *
   * A dimension that is still an identifier makes the generated type
   * variably-modified, which MISRA C:2012 Rule 18.8 forbids, so this has to
   * happen before anything renders the type -- and it cannot happen in 1.3,
   * because the const may be declared in another file. Each dimension folds
   * with the one evaluator, so `N+1` and `sizeof(u32)` settle here as they do
   * in the .c; one a C macro names stays its text for the C compiler.
   *
   * REBUILT, not mutated. Identity is preserved when nothing moved, so the
   * common case allocates nothing and a consumer comparing by reference still
   * sees one object.
   */
  private static withResolvedDimensions(
    symbol: TSymbol,
    constantOf: (name: string) => IFoldedConstant | undefined,
  ): TSymbol {
    if (
      symbol.kind === "variable" &&
      symbol.isArray &&
      symbol.arrayDimensions
    ) {
      const dimensions = Program.resolvedDimensions(
        symbol.arrayDimensions,
        constantOf,
      );
      return dimensions === symbol.arrayDimensions
        ? symbol
        : { ...(symbol as IVariableSymbol), arrayDimensions: dimensions };
    }
    if (symbol.kind === "function") {
      let changed = false;
      const parameters = symbol.parameters.map((parameter) => {
        if (!parameter.arrayDimensions) return parameter;
        const dimensions = Program.resolvedDimensions(
          parameter.arrayDimensions,
          constantOf,
        );
        if (dimensions === parameter.arrayDimensions) return parameter;
        changed = true;
        return { ...parameter, arrayDimensions: dimensions };
      });
      return changed ? { ...symbol, parameters } : symbol;
    }
    if (symbol.kind === "struct") {
      let changed = false;
      const fields = new Map(
        [...symbol.fields].map(([name, field]) => {
          if (!field.dimensions) return [name, field];
          const dimensions = Program.resolvedDimensions(
            field.dimensions,
            constantOf,
          );
          if (dimensions === field.dimensions) return [name, field];
          changed = true;
          return [name, { ...field, dimensions }];
        }),
      );
      return changed ? { ...symbol, fields } : symbol;
    }
    return symbol;
  }

  /** Dimensions folded where they can be, or the same array when none moved */
  private static resolvedDimensions(
    dimensions: ReadonlyArray<number | string>,
    constantOf: (name: string) => IFoldedConstant | undefined,
  ): ReadonlyArray<number | string> {
    let changed = false;
    const resolved = dimensions.map((dimension) => {
      if (typeof dimension === "number") return dimension;
      const value = ConstantFold.value(dimension, constantOf);
      if (value === undefined) return dimension;
      changed = true;
      return value;
    });
    return changed ? resolved : dimensions;
  }
}

export default Program;
