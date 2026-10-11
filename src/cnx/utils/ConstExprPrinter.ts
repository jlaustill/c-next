/**
 * The C for a constant expression only C can evaluate (#1175): an array
 * dimension naming a macro from an included header (`u8[BUF_SIZE + 1]`).
 *
 * Written from the expression's STRUCTURE, never from its source text. Every
 * part that has a value is written as that value, so a C-Next const (which C
 * cannot see) never reaches the C by name; operators are C's (`=` is `==`);
 * and a negative value is parenthesized, so no two tokens can join into one
 * (`1 - -1` must never become `1--1`). The .c and the .h both print a
 * dimension here, so they cannot disagree about it.
 */
import ConstantEvaluator from "./ConstantEvaluator";
import invariant from "./invariant";
import type IConstantEnvironment from "./types/IConstantEnvironment";
import type TConstExpr from "../types/TConstExpr";

/** The C-Next operators C spells differently */
const C_OPERATOR: Readonly<Record<string, string>> = { "=": "==" };

class ConstExprPrinter {
  static toC(expr: TConstExpr, env: IConstantEnvironment): string {
    const result = ConstantEvaluator.evaluate(expr, env);
    if (result.kind === "value") return result.value.toString();
    switch (expr.kind) {
      case "name":
        // Only a header's name is left unvalued here, and C spells it as is
        return expr.path.join(".");
      case "sizeof":
        return `sizeof(${env.cTypeName(expr.typeName, expr.at)})`;
      case "cast":
        return `(${env.cTypeName(expr.typeName, expr.at)})${ConstExprPrinter.operand(expr.operand, env)}`;
      case "unary":
        return `${expr.op}${ConstExprPrinter.operand(expr.operand, env)}`;
      case "binary":
        return `${ConstExprPrinter.operand(expr.left, env)} ${C_OPERATOR[expr.op] ?? expr.op} ${ConstExprPrinter.operand(expr.right, env)}`;
      case "ternary":
        return `(${ConstExprPrinter.toC(expr.condition, env)}) ? ${ConstExprPrinter.operand(expr.whenTrue, env)} : ${ConstExprPrinter.operand(expr.whenFalse, env)}`;
      default:
        invariant(
          false,
          `only an expression C can evaluate is printed, not a '${expr.kind}' -- 2.1 rejects one with no value first`,
        );
    }
  }

  /** An operand, parenthesized unless it is one token that cannot join another */
  private static operand(expr: TConstExpr, env: IConstantEnvironment): string {
    const text = ConstExprPrinter.toC(expr, env);
    return /^\w+$/.test(text) ? text : `(${text})`;
  }
}

export default ConstExprPrinter;
