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

import type IFileSymbols from "../../transpiler/types/IFileSymbols";
import type IStructFieldInfo from "../../transpiler/types/symbols/IStructFieldInfo";
import type IProgram from "../../transpiler/types/IProgram";
import type TSymbol from "../../transpiler/types/symbols/TSymbol";
import DeferredTypes from "./DeferredTypes";
import LiteralUtils from "../../utils/LiteralUtils";
import OpaqueTypeResolution from "../../utils/OpaqueTypeResolution";
import type IVariableSymbol from "../../transpiler/types/symbols/IVariableSymbol";
import IDerivedConsts from "./types/IDerivedConsts";

/** Shared empty result, so a miss does not allocate. */
const EMPTY_NAMES: ReadonlySet<string> = new Set<string>();

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
import ConflictDetector from "./ConflictDetector";
import type IForeignSymbols from "../../transpiler/types/IForeignSymbols";
import type IConflict from "../../transpiler/types/IConflict";

class Program {
  /**
   * Build the artifact from every declared file.
   *
   * @param files one `IFileSymbols` per file, in declaration order
   */
  static build(
    files: ReadonlyArray<IFileSymbols>,
    headerStructFields: ReadonlyMap<
      string,
      ReadonlyMap<string, IStructFieldInfo>
    > = new Map(),
    foreign: IForeignSymbols = NO_FOREIGN,
  ): IProgram {
    // Each derivation is its own step, in dependency order: the scope-type
    // index settles the types, settled types yield const values, const values
    // resolve dimensions, and the finished symbols answer everything else.
    // Written inline this read as one function with six nested loops, which is
    // both hard to follow and hard to change one part of.
    const isScopeType = Program.scopeTypeIndex(files);
    const settledByFile = Program.settleEveryFile(files, isScopeType);
    const derivedConsts = Program.deriveConstValues(settledByFile);
    const scopedViews = new Map<string, ReadonlyMap<string, number>>();
    const constValues = derivedConsts.flat;
    const symbolsByFile = Program.resolveDimensions(
      settledByFile,
      (scopePath: string) =>
        Program.constValuesIn(derivedConsts, scopedViews, scopePath),
    );
    const symbolsByCName = Program.indexByCName(symbolsByFile);
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
    const conflicts = ConflictDetector.detect(
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
      constValue: (name: string): number | undefined => constValues.get(name),
      constValues: (): ReadonlyMap<string, number> => constValues,
      constValuesIn: (scopePath: string): ReadonlyMap<string, number> =>
        Program.constValuesIn(derivedConsts, scopedViews, scopePath),
      conflicts: (): ReadonlyArray<IConflict> => conflicts,
      typesDeclaredIn: (sourceFile: string): ReadonlySet<string> =>
        typesByFile.get(sourceFile) ?? EMPTY_NAMES,
      isOpaqueType: (typeName: string): boolean => opaqueTypes.has(typeName),
      opaqueTypes: (): ReadonlySet<string> => opaqueTypes,
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
   * Tier 2: external const values.
   *
   * "What is this const worth" is a whole-program question the moment a const
   * can arrive through an include (#1220), so it is authored once, here, from
   * every file's symbols. Keyed by BARE name, which is the question callers
   * ask: "what does SIZE mean?", not "which symbol is this?" -- and, for a
   * const declared inside a scope, by its C name as well (`Board__STEP`),
   * which is the question `this.STEP` asks. #1322: the pass-0 collector this
   * derivation replaced recorded both keys; the artifact recorded only the
   * bare one, so two scopes each declaring a `STEP` shared one slot and
   * `this.STEP` could not be told from the other scope's.
   */
  private static deriveConstValues(
    settledByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
  ): IDerivedConsts {
    const flat = new Map<string, number>();
    const byScope = new Map<string, Map<string, number>>();
    for (const settled of settledByFile.values()) {
      for (const symbol of settled) {
        const value = Program.constValueOf(symbol);
        if (value === undefined) continue;
        flat.set(symbol.name, value);
        if (symbol.scopePath === "") continue;
        flat.set(symbol.fullyQualifiedCName, value);
        // Recorded by SCOPE as well, so "what is SIZE worth inside Small?" has
        // an answer that does not depend on which scope was derived last. The
        // flat bare key keeps its meaning for a file-scope const and for the
        // cross-file lookups #1220 added.
        const own = byScope.get(symbol.scopePath) ?? new Map<string, number>();
        own.set(symbol.name, value);
        byScope.set(symbol.scopePath, own);
      }
    }
    return { flat, byScope };
  }

  /**
   * The const values visible from `scopePath`, in ADR-057's candidate order:
   * the enclosing scope's own const shadows a file-scope one of the same name.
   *
   * #1322 review: the flat map is keyed by BARE name and also, for a scoped
   * const, by its C name -- so two scopes each declaring `SIZE` shared the bare
   * slot and the last one derived won. That made a legal program fail
   * (`Small.table` sized by `Large.SIZE`) and made E0854 depend on declaration
   * ORDER, which is the hazard #1399 named arriving through a different map.
   * Asking with a scope is the same order `ConstAssignmentAnalyzer.constSymbol`,
   * `RegisterAccessAnalyzer.isFalseConst` and `ShiftAnalyzer.constValue` each
   * derived for themselves.
   *
   * Views are memoized per scope: a dimension is resolved once per declaration
   * and there are few scopes, so this trades a small map per scope for not
   * rebuilding one per lookup.
   */
  private static constValuesIn(
    derived: IDerivedConsts,
    cache: Map<string, ReadonlyMap<string, number>>,
    scopePath: string,
  ): ReadonlyMap<string, number> {
    if (scopePath === "") return derived.flat;
    const cached = cache.get(scopePath);
    if (cached) return cached;

    const own = derived.byScope.get(scopePath);
    const view =
      own === undefined ? derived.flat : new Map([...derived.flat, ...own]);
    cache.set(scopePath, view);
    return view;
  }

  /** Tier 2: resolved array dimensions, per file. */
  private static resolveDimensions(
    settledByFile: ReadonlyMap<string, ReadonlyArray<TSymbol>>,
    viewFor: (scopePath: string) => ReadonlyMap<string, number>,
  ): Map<string, ReadonlyArray<TSymbol>> {
    const symbolsByFile = new Map<string, ReadonlyArray<TSymbol>>();
    for (const [sourceFile, settled] of settledByFile) {
      symbolsByFile.set(
        sourceFile,
        settled.map((symbol) =>
          Program.withResolvedDimensions(symbol, viewFor(symbol.scopePath)),
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
   * Integer value of one symbol, if it is a const variable with a literal
   * integer initializer.
   *
   * The single derivation of "what is this const worth" (#1220 found it written
   * twice and collapsed them). It lives here now because the question is
   * cross-file: a const reached through an include is worth the same as one
   * declared beside the use, and only 1.4 sees both.
   */
  private static constValueOf(symbol: TSymbol): number | undefined {
    if (symbol.kind !== "variable" || !symbol.isConst) return undefined;
    if (symbol.initialValue === undefined) return undefined;
    return LiteralUtils.parseIntegerLiteral(symbol.initialValue);
  }

  /**
   * A variable whose array dimensions name consts replaced by their values.
   *
   * A dimension that is still an identifier makes the generated type
   * variably-modified, which MISRA C:2012 Rule 18.8 forbids, so this has to
   * happen before anything renders the type -- and it cannot happen in 1.3,
   * because the const may be declared in another file.
   *
   * REBUILT, not mutated. The previous implementation cast the `readonly` view
   * away and assigned in place, documented as "controlled mutation ...
   * cloning would require updating all maps". That is no longer true: the maps
   * are built here, after this runs, so there is nothing to keep in step and
   * no reason to defeat the type.
   */
  private static withResolvedDimensions(
    symbol: TSymbol,
    constValues: ReadonlyMap<string, number>,
  ): TSymbol {
    if (
      symbol.kind !== "variable" ||
      !symbol.isArray ||
      !symbol.arrayDimensions
    ) {
      return symbol;
    }

    let changed = false;
    const dimensions = symbol.arrayDimensions.map((dimension) => {
      if (typeof dimension === "number") return dimension;
      const value = constValues.get(dimension);
      if (value === undefined) return dimension;
      changed = true;
      return value;
    });

    // Identity is preserved when nothing moved, so the common case allocates
    // nothing and a consumer comparing by reference still sees one object.
    if (!changed) return symbol;
    return { ...(symbol as IVariableSymbol), arrayDimensions: dimensions };
  }
}

export default Program;
