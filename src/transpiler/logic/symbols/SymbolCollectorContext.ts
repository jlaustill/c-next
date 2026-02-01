/**
 * SymbolCollectorContext
 * Shared context for C and C++ symbol collectors using composition.
 *
 * Extracted from CSymbolCollector and CppSymbolCollector to reduce duplication.
 */

import ICollectorContext from "./types/ICollectorContext";
import ISymbol from "../../../utils/types/ISymbol";
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

  /**
   * Get collected symbols
   */
  static getSymbols(ctx: ICollectorContext): ISymbol[] {
    return ctx.symbols;
  }

  /**
   * Get warnings generated during collection
   */
  static getWarnings(ctx: ICollectorContext): string[] {
    return ctx.warnings;
  }

  /**
   * Add a symbol to the context
   */
  static addSymbol(ctx: ICollectorContext, symbol: ISymbol): void {
    ctx.symbols.push(symbol);
  }

  /**
   * Add a warning to the context
   */
  static addWarning(ctx: ICollectorContext, message: string): void {
    ctx.warnings.push(message);
  }
}

export default SymbolCollectorContext;
