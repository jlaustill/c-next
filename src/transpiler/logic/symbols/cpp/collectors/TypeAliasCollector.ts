/**
 * TypeAliasCollector - Extracts type alias declarations from C++ parse trees.
 *
 * Handles C++ using declarations (using X = Y).
 * Produces ICppTypeAliasSymbol instances.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ICppTypeAliasSymbol from "../../../../types/symbols/cpp/ICppTypeAliasSymbol";

class TypeAliasCollector {
  /**
   * Collect an alias declaration (using X = Y) and return an ICppTypeAliasSymbol.
   *
   * @param aliasDecl The alias declaration context
   * @param sourceFile Source file path
   * @param line Line number
   * @param currentNamespace Optional current namespace
   * @returns The type alias symbol or null if no name
   */
  static collect(
    aliasDecl: any,
    sourceFile: string,
    line: number,
    currentNamespace?: string,
  ): ICppTypeAliasSymbol | null {
    const identifier = aliasDecl.Identifier?.();
    if (!identifier) return null;

    const name = identifier.getText();

    return {
      kind: "type",
      name,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      parent: currentNamespace,
    };
  }
}

export default TypeAliasCollector;
