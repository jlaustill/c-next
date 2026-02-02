/**
 * AnalyzerContextBuilder
 * Issue #591: Extracted from Transpiler.transpileSource() to reduce complexity
 *
 * Builds the context needed for running semantic analyzers, specifically
 * converting struct field information from the symbol table format to
 * the analyzer-compatible format.
 */

import SymbolTable from "../symbols/SymbolTable";

/**
 * Builds analyzer context from symbol table data.
 *
 * The analyzer requires struct fields as Map<string, Set<string>> (structName -> fieldNames)
 * while the symbol table stores more detailed IStructFieldInfo. This builder handles
 * the conversion, including Issue #355's requirement to exclude array fields.
 */
class AnalyzerContextBuilder {
  /**
   * Build external struct fields map for analyzer from symbol table.
   *
   * Converts the symbol table's detailed struct field info to the simpler
   * format needed by InitializationAnalyzer.
   *
   * Issue #355: Excludes array fields from init checking since the analyzer
   * can't prove loop-based array initialization is complete.
   *
   * @param symbolTable - Symbol table containing struct definitions
   * @returns Map of struct name to set of non-array field names
   */
  static buildExternalStructFields(
    symbolTable: SymbolTable,
  ): Map<string, Set<string>> {
    const externalStructFields = new Map<string, Set<string>>();
    const allStructFields = symbolTable.getAllStructFields();

    for (const [structName, fieldMap] of allStructFields) {
      const nonArrayFields = new Set<string>();
      for (const [fieldName, fieldInfo] of fieldMap) {
        // Only include non-array fields in init checking
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
}

export default AnalyzerContextBuilder;
