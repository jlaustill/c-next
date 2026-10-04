/**
 * 1.4 Resolve — builds `Program` from what every file declared.
 *
 * Declare emits one `IFileSymbols` per file, each computable with only that
 * file's parse tree open. Resolve is the first point at which the whole program
 * exists, so it is the first point at which a cross-file question has an
 * answer. Two things follow, and they are the whole pass:
 *
 *   - the scope types each file can see, combined from the `declaredScopeTypes`
 *     of the file and its include closure, which is the fact Declare used to be
 *     handed as a parameter; and
 *   - settling every `TDeferredType` against its own file's answer, which is
 *     the ADR-057 resolution Declare could not perform.
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
import type ILexicalFrame from "../../types/ILexicalFrame";
import type ILocalDeclaration from "../../types/ILocalDeclaration";
import type ISourceSpan from "../../types/ISourceSpan";
import type TChainRoot from "../../types/TChainRoot";
import type TValueBinding from "../../types/TValueBinding";
import RunTarget from "./RunTarget";
import type TRunTarget from "../../types/TRunTarget";
import invariant from "../../utils/invariant";
import type IFunctionSymbol from "../../types/symbols/IFunctionSymbol";
import ScopeUtils from "../../utils/ScopeUtils";
import type IScopeSymbol from "../../types/symbols/IScopeSymbol";
import type IFileSymbols from "../../types/IFileSymbols";
import type IStructFieldInfo from "../../types/symbols/IStructFieldInfo";
import type IProgram from "../../types/IProgram";
import type TSymbol from "../../types/symbols/TSymbol";
import type IParameterInfo from "../../types/symbols/IParameterInfo";
import DeferredTypes from "./DeferredTypes";
import ConstantFold from "../../utils/ConstantFold";
import type IFoldedConstant from "../../types/IFoldedConstant";
import OpaqueTypeResolution from "../../utils/OpaqueTypeResolution";
import SMALL_PRIMITIVES from "./SMALL_PRIMITIVES";
import TypeResolver from "../../utils/TypeResolver";
import SymbolGuards from "../../types/symbols/SymbolGuards";
import type IVariableSymbol from "../../types/symbols/IVariableSymbol";
import type IBindingFacts from "./types/IBindingFacts";
import ConflictDetector from "./ConflictDetector";
import type IForeignSymbols from "./types/IForeignSymbols";
import type IForeignValue from "./types/IForeignValue";
import type IConflict from "../../types/IConflict";
import ModificationFacts from "./ModificationFacts";
import CallbackCompatibility from "./CallbackCompatibility";
import SymbolTable from "../3-Declare/SymbolTable";
import type ICodeGenSymbols from "../../types/ICodeGenSymbols";
import type IProgramInputs from "./types/IProgramInputs";
import type IVisibilityInput from "./types/IVisibilityInput";
import TSymbolInfoAdapter from "../3-Declare/cnext/adapters/TSymbolInfoAdapter";
import TransitiveEnumCollector from "./TransitiveEnumCollector";
import VisibleSymbols from "./VisibleSymbols";
import ConstantNames from "./ConstantNames";
import ConstantEvaluator from "../../utils/ConstantEvaluator";
import EnumMemberValues from "../../utils/EnumMemberValues";
import type IConstantEnvironment from "../../utils/types/IConstantEnvironment";
import type IConstantNameFacts from "./types/IConstantNameFacts";
import type ISettledConstants from "./types/ISettledConstants";
import type IFileConstantFacts from "./types/IFileConstantFacts";
import type IEnumSymbol from "../../types/symbols/IEnumSymbol";
import type ISourcePosition from "../../utils/types/ISourcePosition";
import type TConstExpr from "../../types/TConstExpr";
import type TConstResult from "../../types/TConstResult";
import type TEnumMemberValue from "../../types/TEnumMemberValue";
import type TSettledConst from "../../types/TSettledConst";

/** Shared empty result, so a miss does not allocate. */
const EMPTY_NAMES: ReadonlySet<string> = new Set<string>();
const EMPTY_HEADER_FIELDS: ReadonlyMap<
  string,
  ReadonlyMap<string, IStructFieldInfo>
> = new Map();

/**
 * A local as the finished program's frames hold it: already settled. Only
 * 1.4, binding over the frames while it settles them, needs another answer.
 */
/** The position a binding's value is asked with: none is read */
const NO_POSITION: ISourcePosition = { line: 0, column: 0 };

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

/** A program built without include information: each file sees only itself. */
const NO_VISIBILITY: IVisibilityInput = {
  cnextIncludesByFile: new Map(),
};

/** A use's position */
type TPosition = Pick<ISourceSpan, "line" | "column">;

/** No symbol views, for a closure walk that reads only the paths it visits. */
const NO_VIEWS: ReadonlyMap<string, ICodeGenSymbols> = new Map();

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
    const visibility = inputs.visibility ?? NO_VISIBILITY;
    const registry = inputs.registry ?? null;

    // #1511: one derivation over every file, before the artifact exists. Each
    // file used to be analyzed with the running total injected and its own
    // contribution extracted back out, so "does this callee modify its
    // parameter?" answered differently depending on how many files had gone
    // before; and the callback map, accumulated while rendering, was partial
    // for whichever file went first.
    // #1825: derived HERE, from what 1.3 recorded, rather than by each caller
    // and handed in. The orchestrator and the test harness both did, and the
    // harness's copy had already dropped the callback map.
    const symbolTable = inputs.symbolTable ?? new SymbolTable();
    const modifications = ModificationFacts.derive(
      files,
      registry,
      symbolTable,
    );
    const callbackCompatibleFunctions = CallbackCompatibility.derive(
      files,
      symbolTable,
    );

    // Each derivation is its own step, in dependency order: the scope types
    // each file can see settle the types, settled types yield const values,
    // const values resolve dimensions, and the finished symbols answer
    // everything else. Written inline this read as one function with six
    // nested loops, which is both hard to follow and hard to change one part of.
    // Each file's include closure, derived once: the scope types it can see
    // and the declarations it can bind are both read from it
    const visibleFiles = Program.visibleFiles(files, visibility);
    const isScopeTypeVisibleFrom = Program.scopeTypeVisibility(
      files,
      visibleFiles,
    );
    // Opacity is a fact of the headers alone, so it is ready before the settle,
    // which stamps each opaque parameter with it (#1722).
    const opaqueTypes = Program.deriveOpaqueTypes(foreign);
    // #1175: what a constant name's facts read of the files, beside the binder
    const fileFacts: IFileConstantFacts = {
      isScopeTypeVisibleFrom,
      reachesForeignHeader: (sourceFile) =>
        (inputs.filesReachingForeignHeaders ?? EMPTY_NAMES).has(sourceFile),
    };
    const settledByFile = Program.settleEveryFile(
      files,
      isScopeTypeVisibleFrom,
      opaqueTypes,
    );
    const foreignNames = new Set([
      ...foreign.c.map((symbol) => symbol.name),
      ...foreign.cpp.map((symbol) => symbol.name),
    ]);
    const foreignValues = Program.foreignValues(foreign);
    // What a spelling means while the consts fold: the declarations as 1.3
    // recorded them, bound in the same order every later pass binds in.
    const declared: IBindingFacts = {
      framesByFile: new Map(
        files.map((file) => [file.sourceFile, file.lexicalScopes]),
      ),
      symbolsByCName: Program.indexByCName(settledByFile),
      registry,
      foreignNames,
      foreignValues,
      visibleFiles,
    };
    const values = Program.settleValues(settledByFile, declared, fileFacts);
    const constants = values.constants;
    // What a spelling means once every array is sized: a local sized by a
    // global's property (`u8[table.element_count]`) measures the settled global
    // (#1863 review: the frames read 1.3's unsized one)
    const dimensioned: IBindingFacts = {
      ...declared,
      symbolsByCName: Program.indexByCName(values.symbolsByFile),
    };
    // #1668: each file's lexical frames, settled against the scope types THAT
    // file can see (#1724) and the program's consts, then frozen with it.
    const settledLocals = new Map<ILocalDeclaration, ILocalDeclaration>();
    const framesByFile = new Map(
      files.map((file) => [
        file.sourceFile,
        LexicalFrames.settle(
          file.lexicalScopes,
          (qualifiedName) =>
            isScopeTypeVisibleFrom(file.sourceFile, qualifiedName),
          (name, settled) =>
            ConstantNames.valueOf(
              name,
              Program.nameFacts(dimensioned, file.sourceFile, constants, {
                settledLocal: settled,
                files: fileFacts,
              }),
            ),
          settledLocals,
        ),
      ]),
    );
    // A parameter sized by an earlier one (`u8[a.element_count] b`) is the
    // frame's to settle: the header writes the same answer the .c does
    const symbolsByFile = Program.withSettledParameters(
      values.symbolsByFile,
      dimensioned,
      constants,
      fileFacts,
      (declaration) => settledLocals.get(declaration),
    );
    const symbolsByCName = Program.indexByCName(symbolsByFile);
    const bound: IBindingFacts = {
      framesByFile,
      symbolsByCName,
      registry,
      foreignNames,
      foreignValues,
      visibleFiles,
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
      isScopeTypeVisibleFrom,
      symbolByCName: (cName: string): TSymbol | undefined =>
        symbolsByCName.get(cName),
      symbolsInFile: (sourceFile: string): ReadonlyArray<TSymbol> =>
        symbolsByFile.get(sourceFile) ?? [],
      sourceFiles: (): ReadonlyArray<string> => sourceFiles,
      knownEnums: (): ReadonlySet<string> => knownEnums,
      externalStructFields: (): ReadonlyMap<string, ReadonlySet<string>> =>
        externalStructFields,
      // A bound name's value is its binding's alone: the walk asks no file
      // and reports no position, so neither is given
      constantOf: (binding: TValueBinding): IFoldedConstant | null =>
        Program.foldedOf(
          ConstantNames.ofBinding(
            binding,
            "",
            NO_POSITION,
            Program.nameFacts(bound, null, constants, {
              settledLocal: SETTLED,
              files: fileFacts,
            }),
          ),
        ),
      conflicts: (): ReadonlyArray<IConflict> => conflicts,
      typesDeclaredIn: (sourceFile: string): ReadonlySet<string> =>
        typesByFile.get(sourceFile) ?? EMPTY_NAMES,
      isOpaqueType: (typeName: string): boolean => opaqueTypes.has(typeName),
      opaqueTypes: (): ReadonlySet<string> => opaqueTypes,
      modifiedParameters: (): ReadonlyMap<string, ReadonlySet<string>> =>
        modifications.modifiedParameters,
      functionParamLists: (): ReadonlyMap<string, ReadonlyArray<string>> =>
        modifications.functionParamLists,
      codeGenSymbolsFor: (sourceFile: string): ICodeGenSymbols | undefined =>
        visibleByFile.get(sourceFile),
      passByValueParams: (): ReadonlyMap<string, ReadonlySet<string>> =>
        passByValueParams,
      callbackCompatibleFunctions: (): ReadonlyMap<string, string> =>
        callbackCompatibleFunctions,
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
        invariant(root, `${sourceFile} is a file of this program`);
        return LexicalFrames.declarationAt(root, name, at);
      },
      bindValue: (
        sourceFile: string,
        root: TChainRoot,
        name: string,
        at: TPosition,
      ): TValueBinding | null =>
        Program.bindValue(bound, sourceFile, root, name, at),
      constantValueOf: (
        sourceFile: string,
        name: Extract<TConstExpr, { kind: "name" }>,
      ): TConstResult =>
        ConstantNames.valueOf(
          name,
          Program.nameFacts(bound, sourceFile, constants, {
            settledLocal: SETTLED,
            files: fileFacts,
          }),
        ),
      enumMemberValues: (enumCName: string): ReadonlyArray<TEnumMemberValue> =>
        constants.enums.get(enumCName) ?? [],
      target: (): TRunTarget => {
        invariant(
          target,
          "a program built without target inputs has no target",
        );
        return target;
      },
      scope: (path: string): IScopeSymbol | null =>
        registry?.getScope(path) ?? null,
      // Delegated like every sibling in this literal, rather than re-spelling
      // the body: `SymbolRegistry.scopePathOf` already falls back to the bare
      // name on a miss, and its own doc names this as the same decision. The
      // two spellings are the two arms `FunctionCallAnalyzer.scopePathOf`
      // selects between, so it could not have noticed them diverging.
      scopePathOf: (name: string): string =>
        registry?.scopePathOf(name) ?? name,
      resolveFunction: (
        name: string,
        fromScopePath: string,
      ): IFunctionSymbol | null =>
        registry?.resolveFunction(
          name,
          registry.getScope(fromScopePath) ?? registry.getGlobalScope(),
        ) ?? null,
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

    // A C-Next type by the C name a generated signature names it with --
    // `Lib__Point`, not `Point`. By its bare name, no header was found to
    // declare what the signature says, so the type was forward-declared after
    // the include that defines it, and a scope's `Data` answered for a C
    // typedef `Data` in another header.
    for (const symbols of symbolsByFile.values()) {
      for (const symbol of symbols) {
        record(symbol.sourceFile, symbol.kind, symbol.fullyQualifiedCName);
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
      // #1435: one closure, over the graph discovery resolved. How the file
      // arrived -- from disk or as a standalone run's text -- used to pick
      // between two walks that each re-derived that graph, and disagreed with
      // discovery and with each other.
      const sources = TransitiveEnumCollector.collect(
        sourceFile,
        visibility.cnextIncludesByFile,
        ownView,
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
   * Each file's include closure -- the files whose declarations it can see,
   * itself among them -- over the graph discovery resolved (#1435), derived
   * once. The scope-type visibility and the binder both read it (#1760
   * second review: the binder read the run-wide index instead).
   */
  private static visibleFiles(
    files: ReadonlyArray<IFileSymbols>,
    visibility: IVisibilityInput,
  ): Map<string, ReadonlySet<string>> {
    return new Map(
      files.map((file) => [
        file.sourceFile,
        new Set([
          file.sourceFile,
          ...TransitiveEnumCollector.collect(
            file.sourceFile,
            visibility.cnextIncludesByFile,
            NO_VIEWS,
          ).paths,
        ]),
      ]),
    );
  }

  /**
   * ADR-057: the scope types each file can SEE -- the ones it declares, and the
   * ones every file in its include closure declares.
   *
   * Combined from per-file answers rather than collected by a pass of its own:
   * Declare authored each file's set, and nothing may recompute a fact an
   * earlier pass owns. The closure is the one `deriveVisibleSymbols` takes, over
   * the graph discovery resolved (#1435). Only its `paths` are read, because the
   * views it can also join do not exist until these types are settled.
   *
   * #1724: this was the union over EVERY file in the run, so a bare `Config` in
   * a reopened scope settled to `Motor__Config` from a sibling the file never
   * includes, over the C typedef it could see -- and codegen, asking a run-wide
   * table, agreed. The returned predicate is now the one answer both read.
   */
  private static scopeTypeVisibility(
    files: ReadonlyArray<IFileSymbols>,
    visibleFiles: ReadonlyMap<string, ReadonlySet<string>>,
  ): (sourceFile: string, qualifiedName: string) => boolean {
    const declaredBy = new Map(
      files.map((file) => [file.sourceFile, file.declaredScopeTypes]),
    );
    const visibleBy = new Map<string, ReadonlySet<string>>();
    for (const file of files) {
      const visible = new Set(file.declaredScopeTypes);
      for (const included of visibleFiles.get(file.sourceFile) ?? []) {
        for (const scopeType of declaredBy.get(included) ?? EMPTY_NAMES) {
          visible.add(scopeType);
        }
      }
      visibleBy.set(file.sourceFile, visible);
    }
    return (sourceFile: string, qualifiedName: string): boolean =>
      visibleBy.get(sourceFile)?.has(qualifiedName) ?? false;
  }

  /**
   * Settle every file's deferred types, and refuse to hand back a `Program`
   * that still holds one.
   *
   * Each file against what IT can see, which is why the predicate takes the
   * file: a bare name means different things in two files of one run (#1724).
   *
   * The pass's own negative control, checked per file so the message can name
   * one. `TypeResolver.getTypeName` throws on a deferred type, so an escapee
   * would otherwise surface somewhere in codegen with nothing to say about
   * which pass dropped it.
   */
  private static settleEveryFile(
    files: ReadonlyArray<IFileSymbols>,
    isScopeTypeVisibleFrom: (
      sourceFile: string,
      qualifiedName: string,
    ) => boolean,
    opaqueTypes: ReadonlySet<string>,
  ): Map<string, ReadonlyArray<TSymbol>> {
    const settledByFile = new Map<string, ReadonlyArray<TSymbol>>();
    for (const file of files) {
      settledByFile.set(
        file.sourceFile,
        DeferredTypes.settle(
          file.symbols,
          (qualifiedName) =>
            isScopeTypeVisibleFrom(file.sourceFile, qualifiedName),
          (typeName) => opaqueTypes.has(typeName),
        ),
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
      invariant(
        !DeferredTypes.hasUnsettled(settled),
        `1.4 Resolve settles every deferred type, ${sourceFile}'s included`,
      );
    }

    return settledByFile;
  }

  /**
   * Every file-scope and scope const's integer value, and every C-Next
   * enum's member values, by C name, settled once for the whole program
   * (#1175, #1669).
   *
   * Consts and enums settle in ONE worklist because each may name the other:
   * `const u32 N <- (u32)EColor.COUNT` and `A <- N + 1`. A value folds with the
   * one evaluator, and each name in it means what the binder says it means
   * where it is written: the scope's own member, then a file-scope global
   * (ADR-057). Neither declaration order nor file order decides whether
   * `const B <- A * 2` has a value (#1668, C11).
   *
   * #1664 review: the fold used to look names up in a map of the consts that
   * had folded SO FAR. A scope's `N` that did not fold, or had not folded
   * yet, was absent from it, so the file-scope `N` answered in its place --
   * the value the binder, and the emitted `S__N`, never use. Bound by
   * declaration instead, an unfolded `N` leaves everything built on it
   * unfolded until `N` folds.
   *
   * A worklist, not repeated rounds (#1760 second review): an item is tried
   * again only when something it waited on settles. A binding does not depend
   * on the values, so that is the only event that can change its answer. The
   * rounds retried every pending const each time, which is O(n^2) when
   * consts are declared in reverse dependency order: 4000 of them took 6.3s
   * against 1.7s in forward order. An enum whose wait can never end -- it
   * names a const that has no value, or one in a cycle -- settles last, with
   * what it waited on counted as having no value, and wakes what waited on it.
   */
  private static deriveConstants(
    settledByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    declared: IBindingFacts,
    files: IFileConstantFacts,
  ): ISettledConstants {
    const consts = new Map<string, TSettledConst>();
    const enums = new Map<string, ReadonlyArray<TEnumMemberValue>>();
    const partialEnums = new Map<string, ReadonlyArray<TEnumMemberValue>>();
    const settled: ISettledConstants = { consts, enums, partialEnums };
    const symbols = [...settledByFile.values()].flat();
    const enumSymbols = symbols.filter(
      (symbol): symbol is IEnumSymbol => symbol.kind === "enum",
    );
    const queue: TSymbol[] = [
      ...symbols.filter(Program.hasConstInitializer),
      ...enumSymbols,
    ];
    const waitingOn = new Map<string, TSymbol[]>();
    const wake = (cName: string): void => {
      queue.push(...(waitingOn.get(cName) ?? []));
      waitingOn.delete(cName);
    };
    const settle = (symbol: TSymbol, final: boolean): void => {
      const pending: string[] = [];
      const facts = Program.nameFacts(declared, symbol.sourceFile, settled, {
        settledLocal: SETTLED,
        files,
        pending,
      });
      const cName = symbol.fullyQualifiedCName;
      if (symbol.kind === "variable") {
        const settledConst = ConstantFold.constValue(
          symbol.initialValueExpr!,
          Program.environment(facts),
          symbol.type,
        );
        // A const waiting on another settles when that one does; one with no
        // value for any other reason has settled, and keeps why
        const waits = settledConst?.kind !== "value" && pending.length > 0;
        if (settledConst !== null && !waits) consts.set(cName, settledConst);
      } else if (symbol.kind === "enum" && !enums.has(cName)) {
        const values = Program.enumValues(symbol, facts);
        if (pending.length > 0 && !final) {
          // Publish the members that settled, so what waits on one of them
          // can go on; the rest settle when what they wait on does
          const before = partialEnums.get(cName);
          partialEnums.set(cName, values);
          Program.wait(waitingOn, pending, symbol);
          if (!Program.sameValues(before, values)) wake(cName);
          return;
        }
        partialEnums.delete(cName);
        enums.set(cName, values);
      }
      if (consts.has(cName) || enums.has(cName)) {
        wake(cName);
      } else {
        Program.wait(waitingOn, pending, symbol);
      }
    };
    for (;;) {
      for (let symbol = queue.pop(); symbol; symbol = queue.pop()) {
        settle(symbol, false);
      }
      const stuck = enumSymbols.find(
        (symbol) => !enums.has(symbol.fullyQualifiedCName),
      );
      if (stuck === undefined) return settled;
      settle(stuck, true);
    }
  }

  /** Whether an enum's published member values are unchanged */
  private static sameValues(
    before: ReadonlyArray<TEnumMemberValue> | undefined,
    after: ReadonlyArray<TEnumMemberValue>,
  ): boolean {
    return (
      before !== undefined &&
      before.every((value, i) => value.kind === after[i].kind)
    );
  }

  private static hasConstInitializer(symbol: TSymbol): boolean {
    return (
      symbol.kind === "variable" &&
      symbol.isConst &&
      symbol.initialValueExpr !== undefined
    );
  }

  private static wait(
    waitingOn: Map<string, TSymbol[]>,
    pending: ReadonlyArray<string>,
    symbol: TSymbol,
  ): void {
    for (const cName of pending) {
      waitingOn.set(cName, [...(waitingOn.get(cName) ?? []), symbol]);
    }
  }

  /**
   * One enum's member values (ADR-017 "Member Values"): each member's value
   * written where the enum is, with the members above it already settled.
   */
  private static enumValues(
    symbol: IEnumSymbol,
    facts: IConstantNameFacts,
  ): TEnumMemberValue[] {
    const members = [...symbol.members.values()];
    const names = members.map((member) => member.name);
    return EnumMemberValues.compute(members, (index, done) =>
      Program.environment({
        ...facts,
        enumMember: (enumCName, member, spelling, at) =>
          enumCName === symbol.fullyQualifiedCName
            ? EnumMemberValues.ownMember(
                names,
                index,
                done,
                member,
                spelling,
                at,
              )
            : facts.enumMember(enumCName, member, spelling, at),
      }),
    );
  }

  /** Each enum rebuilt with its settled member values */
  private static withEnumValues(
    settledByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    constants: ISettledConstants,
  ): Map<string, ReadonlyArray<TSymbol>> {
    const withValues = new Map<string, ReadonlyArray<TSymbol>>();
    for (const [sourceFile, symbols] of settledByFile) {
      withValues.set(
        sourceFile,
        symbols.map((symbol) => {
          if (symbol.kind !== "enum") return symbol;
          const values = constants.enums.get(symbol.fullyQualifiedCName) ?? [];
          const members = new Map(
            [...symbol.members].map(([name, member], index) => {
              const settled = values[index];
              const value =
                settled?.kind === "value"
                  ? (ConstantEvaluator.toNumber(settled.value) ?? null)
                  : null;
              return [name, { ...member, value }];
            }),
          );
          return { ...symbol, members };
        }),
      );
    }
    return withValues;
  }

  /**
   * What `ConstantNames` asks, answered from `facts` as `sourceFile` sees
   * them and from the values settled so far. `pending` collects each const
   * and enum a name waited on, for the worklist.
   */
  private static nameFacts(
    facts: IBindingFacts,
    sourceFile: string | null,
    constants: ISettledConstants,
    options: {
      settledLocal: (
        declaration: ILocalDeclaration,
      ) => ILocalDeclaration | undefined;
      files: IFileConstantFacts;
      pending?: string[];
    },
  ): IConstantNameFacts {
    const file = (): string => {
      invariant(
        sourceFile !== null,
        "a bound name's value is its binding's: the walk asks no file of it",
      );
      return sourceFile;
    };
    return {
      bind: (root, name, at) =>
        Program.bindValue(facts, file(), root, name, at),
      scopePathAt: (at) =>
        LexicalFrames.frameAt(Program.framesOf(facts, file()), at).scopePath,
      visibleSymbol: (cName) => Program.visibleSymbolIn(facts, file(), cName),
      isScopeTypeVisible: (name) =>
        options.files.isScopeTypeVisibleFrom(file(), name),
      get reachesForeignHeader() {
        return options.files.reachesForeignHeader(file());
      },
      foreignValue: (name) => facts.foreignValues.get(name) ?? null,
      constValue: (symbol) => {
        const value = constants.consts.get(symbol.fullyQualifiedCName);
        if (value === undefined)
          options.pending?.push(symbol.fullyQualifiedCName);
        return value;
      },
      settledLocal: options.settledLocal,
      enumMember: (enumCName, member, spelling, at) =>
        Program.settledMember(facts, constants, enumCName, member, {
          spelling,
          at,
          pending: options.pending,
        }),
    };
  }

  /** A member of an enum other than the one being computed */
  private static settledMember(
    facts: IBindingFacts,
    constants: ISettledConstants,
    enumCName: string,
    member: string,
    where: { spelling: string; at: ISourcePosition; pending?: string[] },
  ): TConstResult {
    const without = (
      reason: "unfolded" | "undeclaredMember",
    ): TConstResult => ({
      kind: "notConstant",
      reason,
      spelling: where.spelling,
      at: where.at,
    });
    const symbol = facts.symbolsByCName.get(enumCName);
    const index =
      symbol?.kind === "enum" ? [...symbol.members.keys()].indexOf(member) : -1;
    if (index < 0) return without("undeclaredMember");
    const final = constants.enums.get(enumCName);
    const settled = (final ?? constants.partialEnums?.get(enumCName))?.[index];
    if (settled?.kind === "value") {
      return { kind: "value", value: settled.value, typeName: null };
    }
    // Not settled yet, or settled with no value
    if (final === undefined) where.pending?.push(enumCName);
    return without("unfolded");
  }

  private static environment(facts: IConstantNameFacts): IConstantEnvironment {
    return { valueOf: (name) => ConstantNames.valueOf(name, facts) };
  }

  /** A value as the compile-time constant `IProgram.constantOf` returns */
  private static foldedOf(result: TConstResult): IFoldedConstant | null {
    if (result.kind !== "value") return null;
    const value = ConstantEvaluator.toNumber(result.value);
    return value === undefined ? null : { value, typeName: result.typeName };
  }

  /**
   * #1175: consts, enum values and dimensions settle together, because each
   * may need another: a dimension names a const, and a const may read a
   * dimension through a length property (`const u32 K <- arr.element_count`).
   * Consts settle again only while one has no value and a dimension moved,
   * so a program that converges in one round costs one round (#1863 review:
   * consts settled once, before any dimension, and K had no value). Values
   * only go from none to one, so the rounds are bounded, and the bound is
   * asserted.
   */
  private static settleValues(
    settledByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    declared: IBindingFacts,
    files: IFileConstantFacts,
  ): {
    readonly constants: ISettledConstants;
    readonly symbolsByFile: Map<string, ReadonlyArray<TSymbol>>;
  } {
    let symbols: ReadonlyMap<string, ReadonlyArray<TSymbol>> = settledByFile;
    const bound = [...settledByFile.values()].flat().length + 2;
    for (let round = 0; ; round += 1) {
      invariant(
        round <= bound,
        "1.4's consts and dimensions settle in a bounded number of rounds",
      );
      const constants = Program.deriveConstants(
        symbols,
        { ...declared, symbolsByCName: Program.indexByCName(symbols) },
        files,
      );
      const next = Program.resolveDimensions(
        Program.withEnumValues(symbols, constants),
        declared,
        constants,
        files,
      );
      const constLacksValue = [...constants.consts.values()].some(
        (settled) => settled.kind !== "value",
      );
      if (!constLacksValue || Program.sameDimensions(symbols, next)) {
        return { constants, symbolsByFile: next };
      }
      symbols = next;
    }
  }

  /**
   * Each function's parameter dimensions, settled through the frames' own
   * settled declarations, so a parameter sized by an earlier one reads the
   * value its frame settled -- one answer for the .c and the .h
   */
  private static withSettledParameters(
    symbolsByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    facts: IBindingFacts,
    constants: ISettledConstants,
    files: IFileConstantFacts,
    settledLocal: (
      declaration: ILocalDeclaration,
    ) => ILocalDeclaration | undefined,
  ): Map<string, ReadonlyArray<TSymbol>> {
    const result = new Map<string, ReadonlyArray<TSymbol>>();
    for (const [sourceFile, symbols] of symbolsByFile) {
      const env = Program.environment(
        Program.nameFacts(facts, sourceFile, constants, {
          settledLocal,
          files,
        }),
      );
      result.set(
        sourceFile,
        symbols.map((symbol) =>
          symbol.kind === "function"
            ? Program.withResolvedDimensions(symbol, env)
            : symbol,
        ),
      );
    }
    return result;
  }

  /** Tier 2: resolved array dimensions, per file. */
  private static resolveDimensions(
    settledByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    declared: IBindingFacts,
    constants: ISettledConstants,
    files: IFileConstantFacts,
  ): Map<string, ReadonlyArray<TSymbol>> {
    // #1175: an array may be sized by another's property
    // (`u8[src.element_count]`), whose own size may need settling first. So
    // dimensions settle to a fixpoint: each pass binds names over the previous
    // pass's symbols. A size only ever goes from unresolved to a value, so the
    // passes are bounded by the number of symbols; the bound is asserted, so a
    // fault here fails rather than hangs.
    let current = settledByFile;
    const bound = [...settledByFile.values()].flat().length + 2;
    for (let pass = 0; ; pass += 1) {
      invariant(
        pass <= bound,
        "1.4's dimensions settle in a bounded number of passes",
      );
      const facts: IBindingFacts = {
        ...declared,
        symbolsByCName: Program.indexByCName(current),
      };
      const next = new Map<string, ReadonlyArray<TSymbol>>();
      for (const [sourceFile, symbols] of current) {
        const env = Program.environment(
          Program.nameFacts(facts, sourceFile, constants, {
            settledLocal: SETTLED,
            files,
          }),
        );
        next.set(
          sourceFile,
          symbols.map((symbol) => Program.withResolvedDimensions(symbol, env)),
        );
      }
      if (Program.sameDimensions(current, next)) return next;
      current = next;
    }
  }

  /** Whether two passes settled every dimension alike, compared by value */
  private static sameDimensions(
    before: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    after: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
  ): boolean {
    const sizes = (symbols: ReadonlyMap<string, ReadonlyArray<TSymbol>>) =>
      JSON.stringify(
        [...symbols.values()].flat().map((symbol) => {
          if (symbol.kind === "variable") return symbol.arrayDimensions;
          if (symbol.kind === "function") {
            return symbol.parameters.map((p) => p.arrayDimensions);
          }
          if (symbol.kind === "struct") {
            return [...symbol.fields.values()].map((f) => f.dimensions);
          }
          return null;
        }),
      );
    return sizes(before) === sizes(after);
  }

  /**
   * A file's frames. #1760 review: a file this program does not hold is a
   * caller's bug, not a file with no locals -- falling back would lose every
   * shadowing decision silently, where lexicalFrameAt already asserts
   */
  private static framesOf(
    facts: IBindingFacts,
    sourceFile: string,
  ): ILexicalFrame {
    const frames = facts.framesByFile.get(sourceFile);
    invariant(frames, `${sourceFile} is a file of this program`);
    return frames;
  }

  /**
   * A declaration `sourceFile` can see, by C name. One it cannot see binds
   * nothing there (#1760 second review): a reopened scope's member from an
   * un-included sibling beat the visible global, and sized `u8[N]` by it
   */
  private static visibleSymbolIn(
    facts: IBindingFacts,
    sourceFile: string,
    cName: string,
  ): TSymbol | undefined {
    const symbol = facts.symbolsByCName.get(cName);
    return symbol !== undefined &&
      facts.visibleFiles.get(sourceFile)?.has(symbol.sourceFile)
      ? symbol
      : undefined;
  }

  /**
   * #1668: what a value name means at a position -- the one place a spelling
   * becomes a declaration.
   *
   * A bare name: the innermost local, then the enclosing scope's member,
   * then a file-scope global, then a C-Next scope, then a C/C++ header name.
   * `this.x` is the enclosing scope's member only; `global.x` is a
   * file-scope global, a C-Next scope or a header name, never a local or a
   * member. Scope members and globals are found by C-name identity, never by a
   * first bare-name match, so a reopened scope in another file binds too.
   */
  private static bindValue(
    facts: IBindingFacts,
    sourceFile: string,
    root: TChainRoot,
    name: string,
    at: TPosition,
  ): TValueBinding | null {
    const frames = Program.framesOf(facts, sourceFile);
    const scopePath = LexicalFrames.frameAt(frames, at).scopePath;
    const local =
      root === null ? LexicalFrames.declarationAt(frames, name, at) : null;
    if (local) {
      return { kind: "local", declaration: local, scopePath };
    }
    return Program.bindOutside(facts, sourceFile, scopePath, root, name);
  }

  /**
   * The binding a name has when no local declares it, as seen from inside
   * `scopePath` -- `bindValue`'s order past its locals, and the whole order
   * for a declaration at file or scope level, where no local is in view.
   */
  private static bindOutside(
    facts: IBindingFacts,
    sourceFile: string,
    scopePath: string,
    root: TChainRoot,
    name: string,
  ): TValueBinding | null {
    const visibleSymbol = (cName: string): TSymbol | undefined =>
      Program.visibleSymbolIn(facts, sourceFile, cName);
    const declared = (cName: string): TValueBinding | null => {
      const symbol = visibleSymbol(cName);
      if (symbol?.kind === "variable") return { kind: "variable", symbol };
      if (symbol?.kind === "function") return { kind: "function", symbol };
      return null;
    };
    const scope = (): TValueBinding | null =>
      facts.registry?.getScope(name)
        ? { kind: "scope", scopePath: name }
        : null;
    const foreign = (): TValueBinding | null =>
      facts.foreignNames.has(name) ? { kind: "foreign", name } : null;

    // #1760 review: ADR-057 puts a member the enclosing scope declares first,
    // whatever its kind. A type binds no value, but it still hides a global
    // of the name; the step used to accept variables alone, so a scope
    // function let the global answer while emission wrote the function.
    const memberCName = ScopeUtils.getTranspiledCName({ name, scopePath });
    const isMember =
      scopePath !== "" && visibleSymbol(memberCName) !== undefined;
    if (root === "this") {
      return isMember ? declared(memberCName) : null;
    }
    if (root === "global") {
      // #1668 review: a header's name too. `global.` is how a scope reaches
      // one its own member shadows, and binding nothing left it untyped.
      return declared(name) ?? scope() ?? foreign();
    }
    if (isMember) {
      return declared(memberCName);
    }
    return declared(name) ?? scope() ?? foreign();
  }

  /**
   * #1175: the header variables and functions, by name -- what a constant
   * expression naming one is worth (a length property of an array; no value
   * otherwise)
   */
  private static foreignValues(
    foreign: IForeignSymbols,
  ): ReadonlyMap<string, IForeignValue> {
    const values = new Map<string, IForeignValue>();
    for (const symbol of [...foreign.c, ...foreign.cpp]) {
      if (symbol.kind === "variable") {
        values.set(symbol.name, {
          kind: "variable",
          type: symbol.type,
          dimensions: symbol.arrayDimensions ?? [],
        });
      } else if (symbol.kind === "function") {
        values.set(symbol.name, { kind: "function" });
      }
    }
    return values;
  }

  /**
   * The canonical-identity index.
   *
   * First declaration wins, matching the run-wide symbol table's own
   * precedence. A genuine clash is a diagnostic 2.1 owns, not a silent
   * overwrite here.
   */
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
   * from its plain-data form by the one evaluator (#1175), so the .c and the
   * .h read one size; one a C macro names is written for C to evaluate, from
   * its structure, never from source text.
   *
   * REBUILT, not mutated. Identity is preserved when nothing moved, so the
   * common case allocates nothing and a consumer comparing by reference still
   * sees one object.
   */
  private static withResolvedDimensions(
    symbol: TSymbol,
    env: IConstantEnvironment,
  ): TSymbol {
    if (
      symbol.kind === "variable" &&
      symbol.isArray &&
      symbol.arrayDimensions
    ) {
      const dimensions = Program.resolvedDimensions(
        symbol.arrayDimensions,
        symbol.arrayDimensionExprs,
        env,
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
          parameter.arrayDimensionExprs,
          env,
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
            field.dimensionExprs,
            env,
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

  /**
   * Each dimension 1.3 could not size, settled from what was written; the same
   * array when 1.3 sized them all
   */
  private static resolvedDimensions(
    dimensions: ReadonlyArray<number | string>,
    exprs: ReadonlyArray<TConstExpr | null> | undefined,
    env: IConstantEnvironment,
  ): ReadonlyArray<number | string> {
    if (!exprs?.some((expr) => expr !== null)) return dimensions;
    return dimensions.map((dimension, i) => {
      const expr = exprs[i];
      return expr ? ConstantFold.dimension(expr, env) : dimension;
    });
  }
}

export default Program;
