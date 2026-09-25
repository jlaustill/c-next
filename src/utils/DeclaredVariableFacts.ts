import DeclaredTypeFacts from "./DeclaredTypeFacts";
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
 * #1456. These five lived on `CodeGenState`, so 2.1 Analyze had to reach the
 * render pass's state container to ask a question about declarations.
 * Parameterized on the two views they actually read, they are callable from
 * either side: `CodeGenState` delegates, and an analyzer passes what its
 * `IAnalysisContext` carries.
 *
 * Deliberately NOT the per-file `typeRegistry`, and that omission is the point
 * -- see `CodeGenState.getVariableTypeInfo`, which layers the registry on top
 * of these for codegen. #1432 is what happens when an analyzer gets the
 * registry: it reads the PREVIOUS run's variables, and a signed array
 * subscript reaches generated C with the transpile reporting success.
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
   * (getCNextVariableTypeName) go through it, instead of each repeating the
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
   * Strip trailing pointer stars from a C type string (e.g., "font_t*" → "font_t").
   * Uses string operations instead of regex to avoid SonarCloud ReDoS flag (S5852).
   */
  static stripTrailingPointers(type: string): string {
    let end = type.length;
    while (end > 0 && type[end - 1] === "*") {
      end--;
    }
    return type.slice(0, end).trim();
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
   * Declared type text of a C-Next variable as the SymbolTable records it --
   * the same spelling a declaration in THIS file puts in a scope frame
   * ("u32", "f32", "u8[4]").
   *
   * Issue #1220: the essential-type analyzers resolve a name against the
   * lexical scope frames first and fall back to here, so a declaration that
   * arrives through an #include is as visible to them as a local one. Without
   * it, E0800/E0802/E0804/E0805/E0807/E0810 all passed silently the moment
   * their operand crossed a file boundary.
   *
   * Deliberately does NOT consult the per-file typeRegistry. That map is
   * cleared by CodeGenerator.generate(), which runs AFTER the analyzers, so
   * during analysis it still holds the PREVIOUS file's variables and would
   * answer for a name the current file never imported.
   */
  static typeNameOf(symbolTable: SymbolTable, name: string): string | null {
    const symbol = DeclaredVariableFacts.symbolOf(symbolTable, name);
    if (!symbol) return null;
    // #1322: WITH its dimensions. `IDeclaredVar.typeText` records `u32[4]` for
    // a lexical declaration, and every chain walk reads array-ness off the type
    // text, so the run-wide fallback has to say the same thing or an imported
    // array reads as a scalar -- which is how `sharedArray.element_count`
    // across an include was rejected while the same line in-file was accepted.
    // The join matches the lexical spelling on purpose: one encoding, read by
    // one `elementType`, whichever source answered.
    const base = TypeResolver.getTypeName(symbol.type);
    const dimensions = symbol.arrayDimensions ?? [];
    return base + dimensions.map((d) => `[${d}]`).join("");
  }
  /**
   * What a variable's type is according to what the program DECLARES -- the
   * answer that does not depend on which file has been generated.
   *
   * #1432. This is the tail of `getVariableTypeInfo` above, split out rather
   * than copied, so the symbol-table half stays one decision: a change to how
   * a C struct global is read reaches codegen and the analyzers together.
   * What codegen has and 2.1 does not is the `typeRegistry` probe, and that is
   * the whole difference between the two methods.
   *
   * An analyzer that probed the registry got the PREVIOUS RUN's answer, because
   * nothing clears it between runs and `ServeCommand` holds a static
   * transpiler. A function-local `u8 idx` left by one run made a file-scope
   * `i32 idx` in the next look unsigned, and E0850 -- which exists to reject a
   * signed array subscript, undefined behavior in C -- did not fire. The
   * transpile reported success.
   *
   * `getCNextVariableTypeName` and `getCNextConstValue` were already written
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

    // Issue #978: Fall back to C symbols for external struct globals from .h headers.
    // Only return type info for struct-typed variables — returning info for all
    // C types would cause regressions (e.g., array indexing misread as bit extraction).
    const cSymbol = symbolTable.getCSymbol(name);
    if (cSymbol?.kind === "variable" && cSymbol.type) {
      const baseType = DeclaredVariableFacts.stripTrailingPointers(
        cSymbol.type,
      );
      if (
        symbolTable.isTypedefStructType(baseType) ||
        symbolTable.getStructFields(baseType)
      ) {
        return {
          baseType,
          bitWidth: 0,
          isArray: cSymbol.isArray || false,
          isConst: cSymbol.isConst || false,
          isPointer: cSymbol.type.endsWith("*"),
        };
      }
    }

    return undefined;
  }
}

export default DeclaredVariableFacts;
