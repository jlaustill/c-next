/**
 * NamespaceCollector - Extracts namespace declarations from C++ parse trees.
 *
 * Produces ICppNamespaceSymbol instances.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ICppNamespaceSymbol from "../../../../types/symbols/cpp/ICppNamespaceSymbol";

class NamespaceCollector {
  /**
   * Collect a namespace definition and return an ICppNamespaceSymbol.
   *
   * @param nsDef The namespace definition context
   * @param sourceFile Source file path
   * @param line Line number
   * @param currentNamespace Optional parent namespace name
   * @returns The namespace symbol
   */
  static collect(
    nsDef: any,
    sourceFile: string,
    line: number,
    currentNamespace?: string,
  ): ICppNamespaceSymbol | null {
    const identifier = nsDef.Identifier?.();
    const originalNs = nsDef.originalNamespaceName?.();

    const name = identifier?.getText() ?? originalNs?.getText();
    if (!name) return null;

    // Use full qualified name for nested namespaces
    const fullName = currentNamespace ? `${currentNamespace}::${name}` : name;

    return {
      kind: "namespace",
      name: fullName,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: true,
      parent: currentNamespace,
    };
  }

  /**
   * Get the full namespace name after processing this namespace definition.
   */
  static getFullNamespaceName(
    nsDef: any,
    currentNamespace?: string,
  ): string | undefined {
    const identifier = nsDef.Identifier?.();
    const originalNs = nsDef.originalNamespaceName?.();

    const name = identifier?.getText() ?? originalNs?.getText();
    if (!name) return currentNamespace;

    return currentNamespace ? `${currentNamespace}::${name}` : name;
  }
}

export default NamespaceCollector;
