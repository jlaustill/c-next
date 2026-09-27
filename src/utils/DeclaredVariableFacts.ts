import DeclaredTypeFacts from "./DeclaredTypeFacts";
import ForeignTypeFacts from "./ForeignTypeFacts";
import QualifiedCName from "./QualifiedCName";
import TypeResolver from "./TypeResolver";
import TYPE_WIDTH from "../transpiler/constants/TYPE_WIDTH";
import UNRESOLVED_DIMENSION from "../transpiler/constants/UNRESOLVED_DIMENSION";
import type ICodeGenSymbols from "../transpiler/types/ICodeGenSymbols";
import type IVariableSymbol from "../transpiler/types/symbols/IVariableSymbol";
import type SymbolTable from "../PARSE/3-Declare/SymbolTable";
import type TTypeInfo from "../transpiler/types/TTypeInfo";

/**
 * What the program DECLARES about a variable -- the answer that does not
 * depend on which file has been generated.
 *
 * #1456. These five lived on the render state (then `CodeGenState`, now
 * `TranspileState`), so 2.1 Analyze had to reach the
 * render pass's state container to ask a question about declarations.
 * Parameterized on the two views they actually read, they are callable from
 * either side: `TranspileState` delegates, and an analyzer passes what its
 * `IAnalysisContext` carries.
 *
 * Never a registry filled as a pass walks: #1432 is what happened when an
 * analyzer read the per-file one, which held the PREVIOUS run's variables, so
 * a signed array subscript reached generated C with the transpile reporting
 * success. #1668 (C8) deleted that registry; codegen binds a name through
 * the program and reads its declaration here too (`DeclaredTypeInfo`).
 */

/**
 * ADR-045 `string<N>`, with N captured.
 *
 * Module scope so it is compiled once. `fromSymbol` is the symbol-table arm of
 * every cross-file variable type resolution -- hundreds of calls per file -- and
 * the pattern never varies.
 */
const STRING_CAPACITY = /^string<(\d+)>$/;

class DeclaredVariableFacts {
  /**
   * The C-Next variable symbol a bare name resolves to in the SymbolTable, or
   * undefined when the name is not a typed C-Next variable.
   *
   * Extracted so "which symbol is this name?" is decided once: both the
   * TTypeInfo lookup below and the type-text lookup the analyzers use
   * go through it, instead of each repeating the
   * kind/type narrowing and drifting apart.
   */
  static symbolOf(
    symbolTable: SymbolTable,
    name: string,
  ): IVariableSymbol | undefined {
    const symbol = symbolTable.getTSymbol(name);
    if (symbol?.kind === "variable" && symbol.type) {
      return symbol;
    }

    // #1303 / #1139: `tSymbols` is keyed by the BARE name, so a caller holding
    // a transpiled C name (`Counter__value` -- which every scope-member call
    // site does hold) misses every scoped symbol, and the miss reads as "no
    // such variable" rather than "wrong question". The by-C-name index answers
    // the identity question instead.
    //
    // Gated on the name actually being qualified so a bare name still resolves
    // exactly as before: this adds an answer where there was none, and changes
    // none that existed.
    if (!QualifiedCName.isQualified(name)) {
      return undefined;
    }
    const byCName = symbolTable.getTOverloadsByCName(name)[0];
    return byCName?.kind === "variable" && byCName.type ? byCName : undefined;
  }
  /**
   * A declared variable symbol as type info.
   *
   * Takes the per-file view because the ADR-044 / ADR-017 classification is
   * derived from it -- see `DeclaredTypeFacts` for why all five fields have to
   * travel together.
   */
  static fromSymbol(
    symbols: ICodeGenSymbols | null,
    symbol: IVariableSymbol,
  ): TTypeInfo {
    const typeName = TypeResolver.getTypeName(symbol.type);

    const stringMatch = STRING_CAPACITY.exec(typeName);
    const isString = stringMatch !== null;
    const stringCapacity = stringMatch
      ? Number.parseInt(stringMatch[1], 10)
      : undefined;
    // Use char for string types to match local convention
    const baseType = isString ? "char" : typeName;

    // #1651: this converter is the CROSS-FILE path, and it used to answer the
    // enum question here and not the bitmap one -- so `shared.Active <- 1` one
    // include hop from the declaration classified as a struct member write and
    // emitted `shared.Active = 1`, a member access on a scalar that gcc
    // refuses, while the identical statement same-file lowered to mask-and-
    // shift. The classification is derived in one place now; see
    // `DeclaredTypeFacts` for why all five fields travel together.
    const declared = DeclaredTypeFacts.of(
      baseType,
      symbols,
      isString ? 8 : TYPE_WIDTH[baseType] || 0,
    );

    return {
      baseType,
      isArray: symbol.isArray || false,
      // #1360: keep the slot. Filtering a dimension that cannot be folded out shifted
      // every dimension after it, so a cross-file `u8[BUF_SIZE][3]` arrived as
      // [3] and dimension 2's bound was applied to dimension 1 -- rejecting a
      // valid `grid[10][0]` and never checking dimension 2 at all. That is the
      // same defect #1127 fixed in getMemberTypeInfo, whose comment already
      // records the reasoning; this path simply did not follow it.
      //
      // A numeric string still parses to its value -- only a genuinely
      // dimension that cannot be folded (a macro name, or "" for an unsized `[]`) becomes
      // UNRESOLVED_DIMENSION, which reads as "size unknown, cannot validate"
      // because checkArrayBounds skips a non-positive bound.
      arrayDimensions: symbol.arrayDimensions?.map((d) => {
        if (typeof d === "number") {
          return d;
        }
        const parsed = Number.parseInt(d, 10);
        return Number.isNaN(parsed) ? UNRESOLVED_DIMENSION : parsed;
      }),
      isConst: symbol.isConst || false,
      isAtomic: symbol.isAtomic || false,
      // #1303: the declared ADR-044 behavior, carried on the symbol so an
      // imported `u8` arrives saturating rather than silently wrapping.
      overflowBehavior: symbol.overflowBehavior,
      ...declared,
      isString,
      stringCapacity,
    };
  }

  /**
   * What a variable's type is according to what the program DECLARES -- the
   * answer that does not depend on which file has been generated.
   *
   * #1432. Codegen and the analyzers read it alike, so the symbol-table half
   * stays one decision: a change to how a C struct global is read reaches
   * both together.
   *
   * An analyzer that probed the registry got the PREVIOUS RUN's answer, because
   * nothing clears it between runs and `ServeCommand` holds a static
   * transpiler. A function-local `u8 idx` left by one run made a file-scope
   * `i32 idx` in the next look unsigned, and E0850 -- which exists to reject a
   * signed array subscript, undefined behavior in C -- did not fire. The
   * transpile reported success.
   *
   * Two sibling readers were already written
   * symbol-table-only for this reason under #1220; this is the third accessor
   * and the one the array-index, slice and string analyzers reach.
   */
  static typeInfoOf(
    symbols: ICodeGenSymbols | null,
    symbolTable: SymbolTable,
    name: string,
  ): TTypeInfo | undefined {
    // ADR-055 Phase 7: Fall back to SymbolTable for cross-file C-Next variables only.
    const symbol = DeclaredVariableFacts.symbolOf(symbolTable, name);
    if (symbol) {
      return DeclaredVariableFacts.fromSymbol(symbols, symbol);
    }

    // Issue #978 / #1668: a C header variable, where C-Next may use its type
    // at all -- a struct global, or a floating scalar. `ForeignTypeFacts` owns
    // that decision.
    const foreign = ForeignTypeFacts.variableType(symbolTable, name);
    const cSymbol = symbolTable.getCSymbol(name);
    if (foreign !== null && cSymbol?.kind === "variable") {
      return {
        baseType: foreign,
        bitWidth: TYPE_WIDTH[foreign] ?? 0,
        isArray: cSymbol.isArray || false,
        isConst: cSymbol.isConst || false,
        isPointer: cSymbol.type.endsWith("*"),
      };
    }

    return undefined;
  }
}

export default DeclaredVariableFacts;
