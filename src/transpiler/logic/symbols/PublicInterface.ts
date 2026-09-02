import type SymbolTable from "./SymbolTable";
import type TSymbol from "../../types/symbols/TSymbol";
import type TType from "../../types/TType";
import QualifiedCName from "../../../utils/QualifiedCName";
import ScopeUtils from "../../../utils/ScopeUtils";
import type IScopeSymbol from "../../types/symbols/IScopeSymbol";

/**
 * Issues #1161 and #1164 — the single answer to "which symbols form this
 * file's public C interface?"
 *
 * Two predicates used to answer that question and disagreed. One decided
 * whether a `.h` was written (`isExported`, counting functions, structs, enums,
 * bitmaps and consts); the other decided whether the generated `.c` included it
 * (scope-member visibility, which nothing declared at top level can satisfy).
 * When they disagreed a header was written that nothing included, so every
 * external-linkage definition in that `.c` lost its visible declaration
 * (MISRA C:2012 Rule 8.4) and the `.c` redefined inline the very types the
 * header already declared.
 *
 * Both decisions now resolve here. Callers must ask this class rather than
 * re-derive the answer — two callers that merely agree today are a latent
 * divergence, which is what the two issues above were.
 */
class PublicInterface {
  /**
   * The symbols that make up this file's generated header, in collection order.
   */
  static forFile(symbolTable: SymbolTable, sourcePath: string): TSymbol[] {
    const fileSymbols = symbolTable.getTSymbolsByFile(sourcePath);
    const reachable = PublicInterface.typeClosure(fileSymbols);

    return fileSymbols.filter(
      (symbol) =>
        PublicInterface.isHeaderVisible(symbol) ||
        reachable.has(symbol.fullyQualifiedCName),
    );
  }

  /**
   * Whether this file's generated header DEFINES the given type, named by its
   * transpiled C name.
   *
   * #1300: codegen emits a scope type into the `.c` exactly when this is false.
   * The two placements are complements of ONE decision, so codegen asks here
   * rather than re-deriving "is it private" -- those two answers agree only
   * until a public signature drags a private type into the header, and then the
   * type is defined in BOTH files and the C compiler rejects the redefinition.
   */
  static definesTypeInHeader(
    symbolTable: SymbolTable,
    sourcePath: string,
    transpiledCName: string,
  ): boolean {
    return PublicInterface.forFile(symbolTable, sourcePath).some(
      (symbol) => symbol.fullyQualifiedCName === transpiledCName,
    );
  }

  /**
   * Whether these symbols form a public C interface: a header will be
   * generated, and the generated `.c` must include it.
   *
   * Takes the file's symbols rather than reading global state, so the `.c` and
   * its header cannot be decided from two different snapshots.
   */
  static existsIn(symbols: readonly TSymbol[]): boolean {
    return symbols.some((symbol) => PublicInterface.isHeaderVisible(symbol));
  }

  /**
   * Whether this symbol contributes a declaration to the generated header on
   * its own account, before the types it makes reachable are added.
   */
  private static isHeaderVisible(symbol: TSymbol): boolean {
    // #1300: `visibility` is the declared fact, on every kind. Four kinds used
    // to carry none, so their collectors hardcoded an exported flag and every
    // `private` struct, enum and bitmap reached the public header.
    if (symbol.visibility !== "public") {
      return false;
    }

    // Kinds no header path emits a declaration for. Counting one produces a
    // header holding only include guards — and, once the `.c` includes whatever
    // header exists, a self-include of that empty file.
    //
    // "scope" because a scope is a container, not a declaration: its members
    // are collected as symbols in their own right.
    //
    // "register" because `HeaderGeneratorUtils.groupSymbolsByKind` has no
    // register bucket, so a register is emitted as `#define`s in the `.c`
    // whether it is public or private. This predicate used to answer "yes, if
    // public" while the emitter answered "never" -- one question, two answers,
    // agreeing on outcome only because the symbol was dropped downstream. That
    // is what made a register-only file emit an empty header. #1453 is the
    // issue that makes a register reachable across an include boundary; when it
    // lands, this is the line it changes.
    if (symbol.kind === "scope" || symbol.kind === "register") {
      return false;
    }

    return !PublicInterface.isTopLevelMain(symbol);
  }

  /**
   * ADR-030: `main` has external linkage but is called by the C runtime, never
   * by another translation unit, so a prototype serves no consumer. MISRA
   * C:2012 Rule 8.4 exempts it for that reason while requiring a visible
   * declaration for every other external-linkage definition.
   *
   * Scoped members are not exempt: a `main` inside `scope Sample` transpiles to
   * `Sample__main`, which is an ordinary cross-file callee.
   */
  private static isTopLevelMain(symbol: TSymbol): boolean {
    return (
      symbol.kind === "function" &&
      symbol.name === "main" &&
      symbol.scope.name === ""
    );
  }

  /**
   * #1300: the private types a header-visible declaration forces into the
   * header, transitively.
   *
   * Not a privacy exception. C requires a COMPLETE type wherever a value of it
   * is declared, returned or passed, so a private type named by a public
   * signature has to be defined in the header or no caller can compile:
   *
   *     public Secret expose()      ->  Internal__Secret Internal__expose(void);
   *     public struct W { Secret s; }
   *     public Secret shared <- ...
   *
   * The type stays unnameable from outside -- C-Next rejects `Internal.Secret`
   * in another scope either way -- so what reaches the header is completeness,
   * not access. Putting a type in a public signature opts it into the ABI, and
   * that is the author's decision to make.
   *
   * Without this the transpiler exits 0 and emits a header carrying only the
   * incomplete `typedef struct Internal__Secret Internal__Secret;`, which any
   * caller that touches the value fails to compile -- cnext green, cc red.
   */
  private static typeClosure(symbols: readonly TSymbol[]): Set<string> {
    // What a name can resolve to. Only type-forming kinds can be pulled in --
    // a header defines types, and a private function or variable is `static`
    // in the `.c` by design (ADR-016).
    //
    // Enum MEMBERS are indexed too, because an array dimension crosses the
    // header boundary as a value, not a type: `extern u8 v[Motor__State__COUNT]`
    // needs the enum defined even though no declaration names `Motor__State`.
    // Walking types alone left four headers in the corpus referencing an
    // undeclared constant, all of which compiled before this fix.
    const definedBy = new Map<string, TSymbol>();
    const enumCNames = new Set<string>();
    for (const symbol of symbols) {
      if (
        symbol.kind === "struct" ||
        symbol.kind === "enum" ||
        symbol.kind === "bitmap"
      ) {
        definedBy.set(symbol.fullyQualifiedCName, symbol);
      }
      if (symbol.kind === "enum") {
        enumCNames.add(symbol.fullyQualifiedCName);
        for (const memberName of symbol.members.keys()) {
          definedBy.set(
            QualifiedCName.fromParts([symbol.fullyQualifiedCName, memberName]),
            symbol,
          );
        }
      }
    }

    // A dimension is written in SOURCE form -- `State.COUNT`, `this.State.COUNT`,
    // `global.EColor.COUNT` -- so it has to be resolved before it can be matched
    // against a C name. `ScopeUtils.resolveDimensionName` is the same rule the
    // header and the struct-field path apply (#1127); it takes the predicate
    // injected so it stays usable from this layer.
    //
    // Scoping the predicate to THIS FILE's enums is deliberate: a dimension
    // naming an enum from an include resolves to a name this map does not hold,
    // and is correctly ignored -- an included type is not this header's to
    // define, and the external-dependency path already handles it.
    const isKnownEnum = (qualifiedName: string): boolean =>
      enumCNames.has(qualifiedName);

    const reached = new Set<string>();
    const queue = symbols.filter((symbol) =>
      PublicInterface.isHeaderVisible(symbol),
    );

    while (queue.length > 0) {
      const current = queue.pop()!;
      for (const name of PublicInterface.namesReferencedBy(
        current,
        isKnownEnum,
      )) {
        // Absent means it is not this file's to define -- a primitive, a C
        // macro dimension, or a type from an include, which the header already
        // handles as an external dependency.
        const definer = definedBy.get(name);
        if (definer === undefined || reached.has(definer.fullyQualifiedCName)) {
          continue;
        }
        reached.add(definer.fullyQualifiedCName);
        queue.push(definer);
      }
    }

    return reached;
  }

  /**
   * Every name this symbol requires the header to declare: the types it names,
   * and the constants its array dimensions name.
   */
  private static namesReferencedBy(
    symbol: TSymbol,
    isKnownEnum: (qualifiedName: string) => boolean,
  ): string[] {
    const names: string[] = [];
    const scope = symbol.scope;
    const collect = (type: TType): void =>
      PublicInterface.collectTypeNames(type, scope, isKnownEnum, names);
    const collectDims = (
      dimensions: ReadonlyArray<number | string> | undefined,
    ): void =>
      PublicInterface.collectDimensions(dimensions, scope, isKnownEnum, names);

    if (symbol.kind === "function") {
      collect(symbol.returnType);
      for (const parameter of symbol.parameters) {
        collect(parameter.type);
        collectDims(parameter.arrayDimensions);
      }
    } else if (symbol.kind === "variable") {
      collect(symbol.type);
      collectDims(symbol.arrayDimensions);
    } else if (symbol.kind === "struct") {
      for (const field of symbol.fields.values()) {
        collect(field.type);
        // `field.type` is the ELEMENT type; a field's dimensions live in their
        // own slot, spelled `dimensions` here and `arrayDimensions` on
        // parameters and variables. Walking only the type missed an enum that
        // a public struct field names as its bound, so the header declared
        // `uint8_t data[Internal__Size__COUNT]` with the enum defined in the
        // `.c` -- transpiler exit 0, header does not compile.
        collectDims(field.dimensions);
      }
    }

    return names;
  }

  /**
   * Flatten a TType to the names it depends on.
   *
   * An array needs its ELEMENT type complete AND its dimensions declared, so it
   * contributes both. Primitives and strings name nothing -- a C-Next string is
   * a fixed-capacity char array.
   */
  private static collectTypeNames(
    type: TType,
    scope: IScopeSymbol,
    isKnownEnum: (qualifiedName: string) => boolean,
    into: string[],
  ): void {
    if (type.kind === "array") {
      PublicInterface.collectDimensions(
        type.dimensions,
        scope,
        isKnownEnum,
        into,
      );
      PublicInterface.collectTypeNames(
        type.elementType,
        scope,
        isKnownEnum,
        into,
      );
      return;
    }
    if (type.kind === "primitive" || type.kind === "string") {
      return;
    }
    into.push(type.name);
  }

  /**
   * Array dimensions are numbers once resolved; a string is a name the header
   * must be able to see -- an enum member, or a C macro from an include.
   */
  private static collectDimensions(
    dimensions: ReadonlyArray<number | string> | undefined,
    scope: IScopeSymbol,
    isKnownEnum: (qualifiedName: string) => boolean,
    into: string[],
  ): void {
    for (const dimension of dimensions ?? []) {
      if (typeof dimension === "string") {
        into.push(
          ScopeUtils.resolveDimensionName(dimension, scope, isKnownEnum),
        );
      }
    }
  }
}

export default PublicInterface;
