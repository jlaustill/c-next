/**
 * EnumCollector - Extracts enum declarations from C++ parse trees.
 *
 * Produces ICppEnumSymbol instances with optional bit width for typed enums.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ICppEnumSymbol from "../../../../types/symbols/cpp/ICppEnumSymbol";
import SymbolTable from "../../SymbolTable";
import SymbolUtils from "../../SymbolUtils";
import type ISourceSpan from "../../../../types/ISourceSpan";

class EnumCollector {
  /**
   * Collect an enum specifier and return an ICppEnumSymbol.
   *
   * @param enumSpec The enum specifier context
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   * @param currentNamespace Optional current namespace
   * @param symbolTable Optional symbol table for storing bit width
   * @returns The enum symbol or null if no name
   */
  static collect(
    enumSpec: any,
    sourceFile: string,
    span: ISourceSpan,
    currentNamespace?: string,
    symbolTable?: SymbolTable | null,
  ): ICppEnumSymbol | null {
    const enumHead = enumSpec.enumHead?.();
    if (!enumHead) return null;

    const identifier = enumHead.Identifier?.();
    if (!identifier) return null;

    const name = identifier.getText();
    const fullName = currentNamespace ? `${currentNamespace}::${name}` : name;

    // Extract bit width for typed enums (e.g., enum EPressureType : uint8_t)
    let bitWidth: number | undefined;
    if (symbolTable) {
      const enumbase = enumHead.enumbase?.();
      if (enumbase) {
        const typeSpecSeq = enumbase.typeSpecifierSeq?.();
        if (typeSpecSeq) {
          const typeName = typeSpecSeq.getText();
          const width = SymbolUtils.getTypeWidth(typeName);
          if (width > 0) {
            symbolTable.addEnumBitWidth(fullName, width);
            bitWidth = width;
          }
        }
      }
    }

    return {
      kind: "enum",
      name: fullName,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
      bitWidth,
    };
  }
}

export default EnumCollector;
