/**
 * MISRA C:2012 Rule 17.7 helper (#847): the value returned by a non-void
 * function shall be used, or explicitly cast to `(void)`.
 *
 * C-Next lets a non-void function be called as a bare statement, discarding
 * its result (e.g. `Counter.next();`, `printf(...)`). The generated C must mark
 * that discard with a `(void)` cast to stay MISRA-compliant. This helper owns
 * the two decisions used by the expression-statement code path:
 *
 *   1. Is the whole statement a single discarded function call?
 *   2. Does the called function return a value (so the cast is required)?
 *
 * Calls that the transpiler lowers itself (string `strncpy`/`strncat`, slice
 * `memcpy`) do not flow through here — they are cast at their emission sites
 * (StringUtils, ArrayHandlers).
 */
import * as Parser from "../../../logic/parser/grammar/CNextParser";
import CodeGenState from "../../../state/CodeGenState";
import StdlibFunctions from "../../../constants/StdlibFunctions";
import ExpressionUnwrapper from "../../../../utils/ExpressionUnwrapper";

/** C-Next built-in functions that return a value (ADR-051). */
const NON_VOID_BUILTINS: ReadonlySet<string> = new Set([
  "safe_div",
  "safe_mod",
]);

class ReturnValueCast {
  /**
   * True when `calleeName` names a function whose return value is discarded by
   * being called as a statement. Resolution order:
   *  - C-Next built-ins (safe_div/safe_mod) return a value.
   *  - C-Next functions: use the tracked return type (void → no cast).
   *  - Known stdlib/framework functions: use the curated void list.
   *  - Anything else (unknown external C): treated as void — we can't justify a
   *    cast we can't prove is needed.
   */
  static returnsNonVoid(calleeName: string): boolean {
    if (NON_VOID_BUILTINS.has(calleeName)) {
      return true;
    }
    const cnextReturnType = CodeGenState.getFunctionReturnType(calleeName);
    if (cnextReturnType !== undefined) {
      return cnextReturnType !== "void";
    }
    return StdlibFunctions.returnsNonVoid(calleeName);
  }

  /**
   * True when the expression is a single top-level function call (no binary
   * operators around it, and the outermost postfix operation is a call). This
   * mirrors PostfixExpressionGenerator's op classification: a call op is one
   * that is neither member access (`.name`) nor subscript (`[expr]`).
   */
  static isBareCallStatement(expr: Parser.ExpressionContext): boolean {
    const postfix = ExpressionUnwrapper.getPostfixExpression(expr);
    if (!postfix) {
      return false;
    }
    const ops = postfix.postfixOp();
    if (ops.length === 0) {
      return false;
    }
    const lastOp = ops[ops.length - 1];
    return !lastOp.IDENTIFIER() && lastOp.expression().length === 0;
  }

  /**
   * Decide whether an expression-statement needs a `(void)` cast prefix.
   *
   * @param expr - the statement's expression
   * @param calleeName - the resolved C name of the outermost call generated
   *   while emitting `expr` (recorded by CallExprGenerator), or null
   */
  static shouldVoidCast(
    expr: Parser.ExpressionContext,
    calleeName: string | null,
  ): boolean {
    if (!calleeName) {
      return false;
    }
    if (!ReturnValueCast.isBareCallStatement(expr)) {
      return false;
    }
    return ReturnValueCast.returnsNonVoid(calleeName);
  }
}

export default ReturnValueCast;
