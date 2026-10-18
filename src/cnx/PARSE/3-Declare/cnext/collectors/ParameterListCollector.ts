/**
 * Each of one file's functions' parameter names, in declaration order, by
 * the function's transpiled C name (#1825): ADR-006's per-file half, which
 * `Program` merges.
 *
 * Collected in 1.3 Declare because a parameter list is spelled in the file's
 * own declarations. ADR-071 retired the walk that also recorded which
 * parameters each body writes: a parameter's `mut` decides its signature now.
 */

import type IProgramSyntax from "../../../../types/syntax/IProgramSyntax";
import type IFunctionDeclarationSyntax from "../../../../types/syntax/IFunctionDeclarationSyntax";
import ScopeUtils from "../../../../utils/ScopeUtils";

class ParameterListCollector {
  /** @param scopePathOf the path of a scope this file declares, by name */
  static collect(
    program: IProgramSyntax,
    scopePathOf: (scopeName: string) => string,
  ): ReadonlyMap<string, ReadonlyArray<string>> {
    const lists = new Map<string, ReadonlyArray<string>>();
    const record = (name: string, fn: IFunctionDeclarationSyntax): void => {
      lists.set(
        name,
        (fn.parameters ?? []).map((param) => param.name),
      );
    };
    for (const member of program.declarations) {
      const declaration = member.declaration;
      if (declaration.kind === "function")
        record(declaration.name, declaration);
      if (declaration.kind !== "scope") continue;
      // #1298: the whole scope PATH, so qualification keeps every outer part
      const scopePath = scopePathOf(declaration.name);
      for (const inner of declaration.members) {
        if (inner.declaration.kind === "function") {
          record(
            ScopeUtils.qualifyInScope(inner.declaration.name, scopePath),
            inner.declaration,
          );
        }
      }
    }
    return lists;
  }
}

export default ParameterListCollector;
