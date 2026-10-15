import type TExpression from "../../../types/syntax/TExpression";
import type IAnalysisContext from "../types/IAnalysisContext";
import type ICCallee from "../types/ICCallee";

/**
 * The C function a call names: `f(a)` or `global.f(a)`, and nothing after the
 * call. A C-Next function of that name is C-Next's own, so it is not one.
 * E0895's pointer check and ADR-071's write tracking ask this one question.
 */
class CCallee {
  static of(expr: TExpression, context: IAnalysisContext): ICCallee | null {
    if (expr.kind !== "postfix") return null;
    const call = expr.ops.at(-1);
    if (call?.kind !== "call") return null;
    const name = CCallee.nameOf(expr);
    if (name === null) return null;
    if (context.program.symbolByCName(name)?.kind === "function") return null;
    for (const symbol of context.symbolTable.getCOverloads(name)) {
      if (symbol.kind === "function" && symbol.parameters) {
        return {
          name,
          arguments: call.arguments,
          parameters: symbol.parameters,
        };
      }
    }
    return null;
  }

  private static nameOf(
    expr: Extract<TExpression, { kind: "postfix" }>,
  ): string | null {
    const [first] = expr.ops;
    if (expr.primary.kind === "identifier" && expr.ops.length === 1) {
      return expr.primary.name;
    }
    const isGlobal =
      expr.primary.kind === "root" && expr.primary.root === "global";
    if (isGlobal && expr.ops.length === 2 && first.kind === "member") {
      return first.name;
    }
    return null;
  }
}

export default CCallee;
