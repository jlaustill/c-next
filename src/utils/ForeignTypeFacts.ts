import type SymbolTable from "../PARSE/3-Declare/SymbolTable";
import type TCSymbol from "../transpiler/types/symbols/c/TCSymbol";
import type TCppSymbol from "../transpiler/types/symbols/cpp/TCppSymbol";

/**
 * What C-Next may read of a C or C++ header symbol's type.
 *
 * C symbols carry C type strings, and C-Next passes most of them through
 * untyped: typing every C variable misread array indexing as bit extraction
 * (#978). Two answers are both safe and needed, and this is their one owner,
 * read by 2.1 Analyze and 2.2 Plan alike:
 *
 * - a struct global's type (#978), so its fields can be walked;
 * - whether a scalar variable or a function result is floating (#1668). Without
 *   it `u32 i * cScale` read as integer arithmetic in both passes: E0810 could
 *   not see the mix, and codegen routed it into `cnx_clamp_mul_u32`, which
 *   truncated the float.
 *
 * A floating answer is given in C-Next spelling (`f32`/`f64`), so no caller has
 * to know that `float` and `double` are floating too.
 */
class ForeignTypeFacts {
  /** Typedef hops followed before giving up, so a cycle cannot loop. */
  private static readonly MAX_TYPEDEF_HOPS = 8;

  /**
   * The type C-Next may use for a C header variable: its struct type, or its
   * floating type. Null for anything else, including arrays and pointers of a
   * floating type.
   */
  static variableType(symbolTable: SymbolTable, name: string): string | null {
    const symbol = ForeignTypeFacts.foreignSymbol(symbolTable, name);
    if (symbol?.kind !== "variable" || !symbol.type) return null;

    const baseType = ForeignTypeFacts.stripTrailingPointers(symbol.type);
    if (ForeignTypeFacts.isStruct(symbolTable, baseType)) return baseType;
    if (symbol.isArray) return null;
    return ForeignTypeFacts.usableType(symbolTable, symbol.type);
  }

  /**
   * The type C-Next may use for a field of a C header struct, by the same
   * rule as `variableType`: its struct type, or its floating type. Null for an
   * array or pointer field, and for any field C-Next does not know.
   */
  static fieldType(
    symbolTable: SymbolTable,
    structType: string,
    field: string,
  ): string | null {
    const info = symbolTable.getStructFieldInfo(structType, field);
    if (!info?.type || info.arrayDimensions?.length) return null;
    return ForeignTypeFacts.usableType(symbolTable, info.type);
  }

  /**
   * A callee's result type: its C-Next declaration's when the caller has one,
   * else a C header function's floating result. 2.1's chain walk and 2.2's
   * composite typing both ask this, so they read one type for a call.
   */
  static returnTypeOf(
    declared: string | null | undefined,
    symbolTable: SymbolTable,
    name: string,
  ): string | null {
    return declared ?? ForeignTypeFacts.floatingReturnType(symbolTable, name);
  }

  /** A C header function's result type, when it is floating. */
  private static floatingReturnType(
    symbolTable: SymbolTable,
    name: string,
  ): string | null {
    const symbol = ForeignTypeFacts.foreignSymbol(symbolTable, name);
    if (symbol?.kind !== "function" || !symbol.type) return null;
    return ForeignTypeFacts.floatingType(symbolTable, symbol.type);
  }

  /** A scalar C type as C-Next may use it: a struct, or floating. */
  private static usableType(
    symbolTable: SymbolTable,
    cType: string,
  ): string | null {
    const baseType = ForeignTypeFacts.stripTrailingPointers(cType);
    if (ForeignTypeFacts.isStruct(symbolTable, baseType)) return baseType;
    if (cType.endsWith("*")) return null;
    return ForeignTypeFacts.floatingType(symbolTable, cType);
  }

  /**
   * A header symbol by name: C first, then C++ (a `.hpp` in `--cpp` mode).
   * Both carry the same `kind` and `type` string for the shapes read here.
   */
  private static foreignSymbol(
    symbolTable: SymbolTable,
    name: string,
  ): TCSymbol | TCppSymbol | undefined {
    return symbolTable.getCSymbol(name) ?? symbolTable.getCppSymbol(name);
  }

  private static isStruct(symbolTable: SymbolTable, type: string): boolean {
    return (
      symbolTable.isTypedefStructType(type) ||
      symbolTable.getStructFields(type) !== undefined
    );
  }

  /**
   * Strip trailing pointer stars from a C type string (e.g., "font_t*" → "font_t").
   * Uses string operations instead of regex to avoid SonarCloud ReDoS flag (S5852).
   */
  private static stripTrailingPointers(type: string): string {
    let end = type.length;
    while (end > 0 && type[end - 1] === "*") {
      end--;
    }
    return type.slice(0, end).trim();
  }

  /**
   * `f32` for C `float`, `f64` for `double`, following typedefs
   * (`float32_t`); null for a non-floating or pointer type.
   */
  private static floatingType(
    symbolTable: SymbolTable,
    cType: string,
  ): "f32" | "f64" | null {
    let type = ForeignTypeFacts.unqualified(cType);
    for (let hop = 0; hop < ForeignTypeFacts.MAX_TYPEDEF_HOPS; hop += 1) {
      if (type.includes("*")) return null;
      if (type === "float") return "f32";
      if (type === "double") return "f64";
      const typedef = ForeignTypeFacts.foreignSymbol(symbolTable, type);
      if (typedef?.kind !== "type" || !typedef.type) return null;
      type = ForeignTypeFacts.unqualified(typedef.type);
    }
    return null;
  }

  private static unqualified(cType: string): string {
    return cType
      .replace(/\b(?:const|volatile)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
}

export default ForeignTypeFacts;
