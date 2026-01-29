/**
 * SymbolCollectorContext
 * Shared context for C and C++ symbol collectors using composition.
 *
 * Extracted from CSymbolCollector and CppSymbolCollector to reduce duplication.
 */

import ICollectorContext from "./types/ICollectorContext";
import SymbolTable from "./SymbolTable";

/**
 * Factory and utilities for symbol collector context
 */
class SymbolCollectorContext {
  /**
   * Create a new collector context
   */
  static create(
    sourceFile: string,
    symbolTable?: SymbolTable,
  ): ICollectorContext {
    return {
      sourceFile,
      symbols: [],
      warnings: [],
      symbolTable: symbolTable ?? null,
    };
  }

  /**
   * Reset context for reuse (clears symbols and warnings)
   */
  static reset(ctx: ICollectorContext): void {
    ctx.symbols = [];
    ctx.warnings = [];
  }
}

export default SymbolCollectorContext;
