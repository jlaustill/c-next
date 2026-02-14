/**
 * TypedefCollector - Collects typedef symbols from C parse trees.
 */

import type ICTypedefSymbol from "../../../../types/symbols/c/ICTypedefSymbol";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";

class TypedefCollector {
  /**
   * Collect a typedef symbol.
   *
   * @param name Typedef name
   * @param baseType The underlying type
   * @param sourceFile Source file path
   * @param line Source line number
   */
  static collect(
    name: string,
    baseType: string,
    sourceFile: string,
    line: number,
  ): ICTypedefSymbol {
    return {
      kind: "type",
      name,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.C,
      isExported: true,
      type: baseType,
    };
  }
}

export default TypedefCollector;
