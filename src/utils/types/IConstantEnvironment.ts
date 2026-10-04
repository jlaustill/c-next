import type TConstExpr from "../../types/TConstExpr";
import type TConstResult from "../../types/TConstResult";
import type ISourcePosition from "./ISourcePosition";

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
  /**
   * A C-Next type name as C spells it where it is written (`sizeof`, a cast):
   * ADR-057 qualifies a bare name to the scope type it means there (#1863
   * review: `sizeof(P)` inside scope S reached C as `P`, not `S__P`)
   */
  cTypeName(typeName: string, at: ISourcePosition): string;
}

export default IConstantEnvironment;
