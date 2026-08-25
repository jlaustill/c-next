import type SymbolTable from "./SymbolTable";
import type TSymbol from "../../types/symbols/TSymbol";

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
    return symbolTable
      .getTSymbolsByFile(sourcePath)
      .filter((symbol) => PublicInterface.isHeaderVisible(symbol));
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
   * Whether this symbol contributes a declaration to the generated header.
   */
  private static isHeaderVisible(symbol: TSymbol): boolean {
    if (!symbol.isExported) {
      return false;
    }

    // A scope is a container, not a declaration. Its members are collected as
    // symbols in their own right, and no header path emits anything for kind
    // "scope". Counting it would produce a header holding only include guards
    // for a scope whose members are all private — and, once the `.c` includes
    // whatever header exists, a self-include of that empty file.
    if (symbol.kind === "scope") {
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
}

export default PublicInterface;
