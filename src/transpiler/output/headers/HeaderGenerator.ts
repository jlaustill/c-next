/**
 * Header Generator (Facade)
 *
 * Delegates to CHeaderGenerator or CppHeaderGenerator based on mode.
 * Maintains backward-compatible API.
 */

import IHeaderSymbol from "./types/IHeaderSymbol";
import SymbolTable from "../../logic/symbols/SymbolTable";
import HeaderSymbolAdapter from "./adapters/HeaderSymbolAdapter";
import IHeaderOptions from "../codegen/types/IHeaderOptions";
import IHeaderTypeInput from "./generators/IHeaderTypeInput";
import CHeaderGenerator from "./CHeaderGenerator";
import CppHeaderGenerator from "./CppHeaderGenerator";

/** Pass-by-value parameter info from CodeGenerator */
type TPassByValueParams = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * Facade that delegates header generation to the appropriate generator
 */
class HeaderGenerator {
  private readonly cGenerator: CHeaderGenerator;
  private readonly cppGenerator: CppHeaderGenerator;

  constructor() {
    this.cGenerator = new CHeaderGenerator();
    this.cppGenerator = new CppHeaderGenerator();
  }

  /**
   * Generate a header file from symbols
   *
   * @param symbols - Array of symbols to include in header
   * @param filename - Output filename (used for include guard)
   * @param options - Header generation options (includes cppMode)
   * @param typeInput - Optional type information for full definitions
   * @param passByValueParams - Map of function names to pass-by-value parameter names
   * @param allKnownEnums - All known enum names from entire compilation
   * @param sourcePath - Optional source file path for header comment
   */
  generate(
    symbols: IHeaderSymbol[],
    filename: string,
    options: IHeaderOptions = {},
    typeInput?: IHeaderTypeInput,
    passByValueParams?: TPassByValueParams,
    allKnownEnums?: ReadonlySet<string>,
    sourcePath?: string,
  ): string {
    const generator = options.cppMode ? this.cppGenerator : this.cGenerator;

    return generator.generate(
      symbols,
      filename,
      options,
      typeInput,
      passByValueParams,
      allKnownEnums,
      sourcePath,
    );
  }

  /**
   * Generate header from a symbol table, filtering by source file
   */
  generateFromSymbolTable(
    symbolTable: SymbolTable,
    sourceFile: string,
    options: IHeaderOptions = {},
  ): string {
    const tSymbols = symbolTable.getTSymbolsByFile(sourceFile);
    const headerSymbols = HeaderSymbolAdapter.fromTSymbols(tSymbols);
    const basename = sourceFile.replace(/\.[^.]+$/, "");
    const headerName = `${basename}.h`;

    return this.generate(headerSymbols, headerName, options);
  }

  /**
   * Generate header for all C-Next symbols in the symbol table
   */
  generateCNextHeader(
    symbolTable: SymbolTable,
    filename: string,
    options: IHeaderOptions = {},
  ): string {
    const tSymbols = symbolTable.getAllTSymbols();
    const headerSymbols = HeaderSymbolAdapter.fromTSymbols(tSymbols);
    return this.generate(headerSymbols, filename, options);
  }
}

export default HeaderGenerator;
