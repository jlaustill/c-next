import BoundDeclaration from "./BoundDeclaration";
import ConstantExpression from "./ConstantExpression";
import type TExpression from "../../../types/syntax/TExpression";
import type IAnalysisContext from "../types/IAnalysisContext";

/**
 * Whether a value is zero however it is spelled: `0`, `0x0`, `0b0`, `false`,
 * or a const that folds to one, as the name binds where it is written. C
 * zero-fills what an initializer leaves out, so a write-1 register bit (E0872)
 * and an array's fill-all for a size C-Next cannot fold (#2196) both turn on
 * this one fact, not on the two spellings `"0"` and `"false"`.
 */
class ZeroValue {
  static of(
    expr: TExpression,
    at: TExpression,
    context: IAnalysisContext,
  ): boolean {
    const text = expr.written.trim();
    if (text === "false") return true;
    // #1322 review: the flat map again -- and this one decides whether a
    // register write clears a `wo` bit, so the wrong scope's const changed
    // which diagnostic fired. `isFalseConst` below was already scope-aware.
    const value = ConstantExpression.valueAt(expr, context);
    if (value !== null) return value === 0;
    return ZeroValue.isFalseConst(text, at, context);
  }

  /**
   * `const bool NAME <- false`, as the name binds here: a const local, a
   * scope member or a file-scope const, through Program's one binder (#1668)
   */
  private static isFalseConst(
    name: string,
    at: TExpression,
    context: IAnalysisContext,
  ): boolean {
    if (!/^[A-Za-z_]\w*$/.test(name)) return false;
    const binding = context.program.bindValue(
      context.sourceFile,
      null,
      name,
      at.span,
    );
    const declared = BoundDeclaration.of(binding);
    return (
      declared !== null &&
      declared.isConst &&
      declared.initialValue?.trim() === "false"
    );
  }
}

export default ZeroValue;
