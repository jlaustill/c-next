/**
 * TypeAliasCollector - Extracts type alias declarations from C++ parse trees.
 *
 * Handles C++ using declarations (using X = Y).
 * Produces ICppTypeAliasSymbol instances.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ICppTypeAliasSymbol from "../../../../types/symbols/cpp/ICppTypeAliasSymbol";
import type ISourceSpan from "../../../../types/ISourceSpan";

class TypeAliasCollector {
  /**
   * Collect an alias declaration (using X = Y) and return an ICppTypeAliasSymbol.
   *
   * @param aliasDecl The alias declaration context
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   * @param currentNamespace Optional current namespace
   * @returns The type alias symbol or null if no name
   */
  static collect(
    aliasDecl: any,
    sourceFile: string,
    span: ISourceSpan,
    currentNamespace?: string,
  ): ICppTypeAliasSymbol | null {
    const identifier = aliasDecl.Identifier?.();
    if (!identifier) return null;

    const name = identifier.getText();

    return {
      kind: "type",
      name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.Cpp,
      visibility: "public",
      parent: currentNamespace,
    };
  }
}

export default TypeAliasCollector;
