/**
 * An array dimension that is not a constant expression: E0909, E0910
 * (#1175; ADR-023 "no VLAs", ADR-044 "Values fixed at compile time").
 *
 * Every dimension, wherever the grammar has one -- a declaration at any
 * scope, a struct field, a parameter, a `for` header -- because the check
 * listens on the dimension nodes themselves rather than on the declarations
 * that hold them. A rule enforced at some positions and silent at others is
 * how this card's defects survived: a parameter-sized local reached C as an
 * initialized variable-length array, at exit 0.
 *
 * A dimension C can evaluate and C-Next cannot (a header macro) is C's, and
 * passes. One that has no value is rejected here, so render never sees it.
 */
import { ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import ConstExprLowering from "../../utils/ConstExprLowering";
import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import ConstantEvaluator from "../../utils/ConstantEvaluator";
import ConstantFold from "../../utils/ConstantFold";
import ParserUtils from "../../utils/ParserUtils";
import ConstantDiagnostics from "./helpers/ConstantDiagnostics";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IConstantDimensionError from "./types/IConstantDimensionError";

class ConstantDimensionListener extends CNextListener {
  private readonly found: IConstantDimensionError[] = [];

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  constructor(private readonly context: IAnalysisContext) {
    super();
  }

  public errors(): IConstantDimensionError[] {
    return this.found;
  }

  override enterArrayTypeDimension = (
    ctx: Parser.ArrayTypeDimensionContext,
  ): void => {
    this.check(ctx.expression());
  };

  override enterArrayDimension = (ctx: Parser.ArrayDimensionContext): void => {
    this.check(ctx.expression());
  };

  private check(expression: Parser.ExpressionContext | null): void {
    if (!expression) return; // an unsized `[]` is E0892's
    const result = ConstantEvaluator.evaluate(
      ConstExprLowering.lower(SyntaxLowering.expression(expression)),
      ConstantFold.environment(this.context.program, this.context.sourceFile),
    );
    const at = ParserUtils.getPosition(expression);
    if (result.kind === "overflow") {
      this.found.push({
        code: "E0910",
        ...at,
        message: `Array dimension overflows ${result.typeName} at compile time: the arithmetic would clamp or wrap (ADR-044)`,
        helpText: ConstantDiagnostics.OVERFLOW_HELP,
      });
      return;
    }
    if (result.kind !== "notConstant") return;
    const why = ConstantDiagnostics.why(result);
    if (why === null) return;
    this.found.push({
      code: "E0909",
      ...at,
      message: `Array dimension must be known at compile time: ${why}`,
      helpText:
        "An array's size is built from literals, consts, sizeof and casts (ADR-023). C-Next has no variable-length arrays",
    });
  }
}

class ConstantDimensionAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(tree: Parser.ProgramContext): IConstantDimensionError[] {
    const listener = new ConstantDimensionListener(this.context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default ConstantDimensionAnalyzer;
