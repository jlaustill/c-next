/**
 * Header Generator (Facade)
 *
 * Delegates to CHeaderGenerator or CppHeaderGenerator based on mode.
 * Maintains backward-compatible API.
 */

import ISymbol from "../../../utils/types/ISymbol";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import SymbolTable from "../../logic/symbols/SymbolTable";
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
   */
  generate(
    symbols: ISymbol[],
    filename: string,
    options: IHeaderOptions = {},
    typeInput?: IHeaderTypeInput,
    passByValueParams?: TPassByValueParams,
    allKnownEnums?: ReadonlySet<string>,
  ): string {
    const generator = options.cppMode ? this.cppGenerator : this.cGenerator;

    return generator.generate(
      symbols,
      filename,
      options,
      typeInput,
      passByValueParams,
      allKnownEnums,
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
    const symbols = symbolTable.getSymbolsByFile(sourceFile);
    const basename = sourceFile.replace(/\.[^.]+$/, "");
    const headerName = `${basename}.h`;

    return this.generate(symbols, headerName, options);
  }

  /**
   * Generate header for all C-Next symbols in the symbol table
   */
  generateCNextHeader(
    symbolTable: SymbolTable,
    filename: string,
    options: IHeaderOptions = {},
  ): string {
    const symbols = symbolTable.getSymbolsByLanguage(ESourceLanguage.CNext);
    return this.generate(symbols, filename, options);
  }
}

export default HeaderGenerator;
