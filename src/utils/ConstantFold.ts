/**
 * #1664 review of #1668's C11: how every pass folds a constant, from 1.4 on.
 *
 * A name's value is its bound declaration's: the binder decides what a
 * spelling means (a local, then the enclosing scope's member, then a
 * file-scope global -- ADR-057), and only a const that folded has a value.
 * The folds used to be handed maps of the consts that had folded, keyed by
 * name. A name bound to anything else -- a parameter, a variable, a const
 * that did not fold, a scope const declared further down -- was simply
 * absent, so the same spelling one level out answered instead: a false
 * E0854 on `arr[N]` for a parameter `N`, a scope array sized by the global's
 * `N`. Asking the binder has no such fallthrough.
 *
 * #1175: what is folded is an expression's plain-data form, by the one
 * evaluator (`ConstantEvaluator`), never its text. Each name in it carries
 * where it is written, so the environment needs only the file.
 */
import ConstantEvaluator from "./ConstantEvaluator";
import ConstExprPrinter from "./ConstExprPrinter";
import TypeCheckUtils from "./TypeCheckUtils";
import TTypeUtils from "./TTypeUtils";
import UNRESOLVED_DIMENSION from "../types/UNRESOLVED_DIMENSION";
import type IConstantEnvironment from "./types/IConstantEnvironment";
import type IProgram from "../types/IProgram";
import type TConstExpr from "../types/TConstExpr";
import type TConstResult from "../types/TConstResult";
import type TType from "../types/TType";

class ConstantFold {
  /** What a name is worth where it is written in `sourceFile`: the program's answer */
  static environment(
    program: IProgram,
    sourceFile: string,
  ): IConstantEnvironment {
    return { valueOf: (name) => program.constantValueOf(sourceFile, name) };
  }

  /**
   * #1175: a dimension as C writes it, decided once for the .c (render) and
   * the .h (1.4's settled symbol). Its value; the C for one only C can
   * evaluate (a header macro), written from its structure; null when it has
   * none, which 2.1 Analyze reports (E0909, E0910) before anything emits it.
   * A value past what a `number` holds exactly is its digits, so the two
   * files still write the same.
   */
  static settled(
    expr: TConstExpr,
    env: IConstantEnvironment,
  ): number | string | null {
    const result = ConstantEvaluator.evaluate(expr, env);
    if (result.kind === "value") {
      return (
        ConstantEvaluator.toNumber(result.value) ?? result.value.toString()
      );
    }
    return result.kind === "foreign" ? ConstExprPrinter.toC(expr, env) : null;
  }

  /** `settled` as a symbol records it: UNRESOLVED_DIMENSION for none */
  static dimension(
    expr: TConstExpr,
    env: IConstantEnvironment,
  ): number | string {
    return ConstantFold.settled(expr, env) ?? UNRESOLVED_DIMENSION;
  }

  /**
   * #1175: a const's value, from what its initializer evaluated to -- when
   * the declared type holds it. `const u8 B <- 300` has no value, whatever
   * E0868 says of it, and neither does a float or other non-integer const.
   */
  static declaredValue(result: TConstResult, type: TType): number | undefined {
    if (result.kind !== "value") return undefined;
    const typeName = ConstantFold.typeNameOf(type);
    const range =
      typeName === null ? null : TypeCheckUtils.integerRange(typeName);
    if (range === null || result.value < range[0] || result.value > range[1]) {
      return undefined;
    }
    return ConstantEvaluator.toNumber(result.value);
  }

  /** A declared type's C-Next name, for the range a folded value must fit */
  static typeNameOf(type: TType): string | null {
    return TTypeUtils.isPrimitive(type) ? type.primitive : null;
  }
}

export default ConstantFold;
