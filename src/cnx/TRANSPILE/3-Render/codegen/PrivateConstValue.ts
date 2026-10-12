import type IProgram from "../../../types/IProgram";
import type IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import ScopeUtils from "../../../utils/ScopeUtils";

/** An unsuffixed decimal float literal, which C reads as the same value */
const PLAIN_FLOAT = /^\d+\.\d+(?:[eE][+-]?\d+)?$/;

/**
 * #1739: what a private scope const is written as where it is used, or null
 * when it is emitted as its object instead (ADR-016) -- the one decision the
 * use sites and the declaration's own emission both read.
 *
 * The value is the one 1.4 settled, which is the value the const sizes an
 * array with, so a use and a dimension cannot disagree. Its initializer's text
 * was substituted here before and re-read where the use was: `M <- N * 2`
 * meant the scope's N in a dimension and the global N in a function, and
 * `this.N + 1` reached C as written.
 *
 * An integer with a value is inlined as its digits, or -- when its initializer
 * is one unsuffixed literal -- as that literal is spelled (`0xAB`), which is
 * the same value. A float is inlined only as such a literal. Anything else (a
 * bool, an enum, a string, a const with no value) is emitted.
 */
class PrivateConstValue {
  static inlined(program: IProgram | null, cName: string): string | null {
    const symbol = program?.symbolByCName(cName);
    if (symbol?.kind !== "variable" || !PrivateConstValue.canInline(symbol)) {
      return null;
    }
    const settled = program!.settledConstOf(cName);
    const expr = symbol.initialValueExpr!;
    if (settled?.kind === "value") {
      const plainLiteral = expr.kind === "literal" && expr.typeName === null;
      return plainLiteral ? symbol.initialValue! : settled.digits;
    }
    if (
      settled?.kind === "float" &&
      expr.kind === "other" &&
      PLAIN_FLOAT.test(expr.spelling)
    ) {
      return expr.spelling;
    }
    return null;
  }

  /** Issue #282/#500: a private, scalar scope const with an initializer */
  private static canInline(symbol: IVariableSymbol): boolean {
    return (
      !ScopeUtils.isGlobalScopePath(symbol.scopePath) &&
      symbol.visibility === "private" &&
      symbol.isConst &&
      !symbol.isArray &&
      symbol.initialValueExpr !== undefined &&
      symbol.initialValue !== undefined
    );
  }
}

export default PrivateConstValue;
