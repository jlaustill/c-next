/**
 * TypedefCollector - Collects typedef symbols from C parse trees.
 */

import type ICTypedefSymbol from "../../../../types/symbols/c/ICTypedefSymbol";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import type ISourceSpan from "../../../../types/ISourceSpan";

class TypedefCollector {
  /**
   * Collect a typedef symbol.
   *
   * @param name Typedef name
   * @param baseType The underlying type
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   */
  static collect(
    name: string,
    baseType: string,
    sourceFile: string,
    span: ISourceSpan,
  ): ICTypedefSymbol {
    return {
      kind: "type",
      name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      type: baseType,
    };
  }
}

export default TypedefCollector;
