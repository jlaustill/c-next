/**
 * Generated C, read as text: whether an expression is one operand as it
 * stands, or needs parentheses to be one where it meets a tighter operator.
 *
 * The one home for that decision (#1760 second review). A C cast and a
 * bit write's mask each spliced an expression beside an operator: the cast
 * as `(float)x << 1`, which shifted a float, and the mask as `a | b & mask`,
 * which wrote bits outside the range. Each had or needed its own check.
 */
class CExpression {
  /**
   * `expr` as one operand: parenthesized when it has an operator outside
   * brackets and literals, as it stands otherwise, so an operand that is
   * already one (a name, a call, a literal) is not wrapped
   */
  static operand(expr: string): string {
    return CExpression.hasOperator(expr) ? `(${expr})` : expr;
  }

  /**
   * Whether generated C has an operator outside brackets and literals. The
   * generator spaces every binary and ternary operator, and nothing else at
   * that depth, so such a space is one.
   */
  private static hasOperator(expr: string): boolean {
    let depth = 0;
    let quote: string | null = null;
    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i];
      if (quote !== null) {
        if (ch === "\\") i++;
        else if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if ("([{".includes(ch)) {
        depth++;
      } else if (")]}".includes(ch)) {
        depth--;
      } else if (depth === 0 && /\s/.test(ch)) {
        return true;
      }
    }
    return false;
  }
}

export default CExpression;
