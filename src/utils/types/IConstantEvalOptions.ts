import type IFoldedConstant from "../../transpiler/types/IFoldedConstant";

/**
 * What the one constant evaluator (`ArrayDimensionParser`) may look up.
 * Built by `ConstantFold`, so every caller supplies the same set.
 */
interface IConstantEvalOptions {
  /**
   * A bare name's compile-time value where the expression is written, or
   * undefined when the name binds to anything that has none -- a variable, a
   * parameter, a const that does not fold, a C macro (#1664 review).
   */
  constantOf?: (name: string) => IFoldedConstant | undefined;
  /** Type names to their bit widths, for `sizeof` */
  typeWidths?: Record<string, number>;
}

export default IConstantEvalOptions;
