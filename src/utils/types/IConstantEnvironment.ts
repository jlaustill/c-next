import type TConstExpr from "../../types/TConstExpr";
import type TConstResult from "../../types/TConstResult";

/**
 * What a name in a constant expression is worth where it is written (#1175).
 *
 * The one thing `ConstantEvaluator` cannot decide by itself: a name means what
 * the binder says it means at its position (ADR-057), and only the pass
 * evaluating knows which declarations are in view. 1.4 Resolve answers while it
 * folds the program's consts and enum values; later passes answer from the
 * settled `Program`. Both answer through one chain resolver, so a name cannot
 * fold to one value in the .h and another in the .c.
 */
interface IConstantEnvironment {
  valueOf(name: Extract<TConstExpr, { kind: "name" }>): TConstResult;
}

export default IConstantEnvironment;
