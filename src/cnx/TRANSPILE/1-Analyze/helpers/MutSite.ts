/**
 * The declaration a written binding needs `mut` on (ADR-071). A local's
 * declaration is in the file being analyzed; a global or a scope member may be
 * in an included one.
 */

import type IMutSite from "../../../types/IMutSite";
import type TValueBinding from "../../../types/TValueBinding";
import type IAnalysisContext from "../types/IAnalysisContext";

class MutSite {
  static of(
    binding: TValueBinding | null,
    context: IAnalysisContext,
  ): IMutSite | undefined {
    if (binding?.kind === "local") {
      const at = binding.declaration.extent;
      return {
        sourcePath: context.sourceFile,
        line: at.line,
        column: at.column,
      };
    }
    if (binding?.kind === "variable") {
      const symbol = binding.symbol;
      return {
        sourcePath: symbol.sourceFile,
        line: symbol.span.line,
        column: symbol.span.column,
      };
    }
    return undefined;
  }
}

export default MutSite;
