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
 *
 * E0359 (#1283 review): except where C-Next spells every element. ADR-029
 * gives each element of a callback array its default function, and each
 * element of an array of a struct with a default that struct's default, so
 * the count must be one C-Next reads (`ElementCount`). A header macro of plain
 * integer arithmetic is; a `sizeof`, a cast or a macro it cannot see is not.
 */
import { ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import ConstExprLowering from "../../utils/ConstExprLowering";
import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import ConstantEvaluator from "../../utils/ConstantEvaluator";
import ConstantFold from "../../utils/ConstantFold";
import ParserUtils from "../../utils/ParserUtils";
import ElementCount from "../../utils/ElementCount";
import StructDefault from "../../utils/StructDefault";
import type TType from "../../types/TType";
import type TConstExpr from "../../types/TConstExpr";
import type ILexicalFrame from "../../types/ILexicalFrame";
import type ISourcePosition from "../../utils/types/ISourcePosition";
import ConstantDiagnostics from "./helpers/ConstantDiagnostics";
import type IAnalysisContext from "./types/IAnalysisContext";
import type TConstResult from "../../types/TConstResult";
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

  /** The dimension's fold, after reporting any E0909 / E0910 it earns */
  private check(
    expression: Parser.ExpressionContext | null,
  ): TConstResult["kind"] | null {
    if (!expression) return null; // an unsized `[]` is E0892's
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
      return result.kind;
    }
    if (result.kind !== "notConstant") return result.kind;
    const why = ConstantDiagnostics.why(result);
    if (why === null) return result.kind;
    this.found.push({
      code: "E0909",
      ...at,
      message: `Array dimension must be known at compile time: ${why}`,
      helpText:
        "An array's size is built from literals, consts, sizeof and casts (ADR-023). C-Next has no variable-length arrays",
    });
    return result.kind;
  }
}

class ConstantDimensionAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(tree: Parser.ProgramContext): IConstantDimensionError[] {
    const listener = new ConstantDimensionListener(this.context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return [...listener.errors(), ...this.unreadableCounts()];
  }

  /**
   * E0359, asked of every array this file declares as 1.3 resolved it (#1283
   * review): the element type is the one rendering spells, whatever syntax
   * named it -- `Nested`, `this.Nested`, `Outer.Nested` -- and whichever side
   * of the name the dimensions are written on, so 2.1 rejects exactly the
   * arrays whose defaults 3 could not spell.
   */
  private unreadableCounts(): IConstantDimensionError[] {
    const { program, sourceFile, symbols } = this.context;
    const facts = StructDefault.factsOf(symbols);
    const found: IConstantDimensionError[] = [];
    const checkArray = (
      type: TType,
      dimensions: ReadonlyArray<TConstExpr | null> | undefined,
      owner: string | null,
      declaredAt: ISourcePosition,
    ): void => {
      const element = StructDefault.spelledElement(
        type,
        owner,
        facts,
        symbols.knownEnums,
      );
      if (element === null) return;
      for (const dimension of dimensions ?? []) {
        const error =
          dimension === null
            ? null
            : this.unreadable(dimension, element, declaredAt);
        if (error) found.push(error);
      }
    };

    for (const symbol of program.symbolsInFile(sourceFile)) {
      if (symbol.kind === "struct") {
        for (const field of symbol.fields.values()) {
          checkArray(
            field.type,
            field.dimensionExprs,
            symbol.fullyQualifiedCName,
            symbol.span,
          );
        }
      } else if (symbol.kind === "variable") {
        checkArray(symbol.type, symbol.arrayDimensionExprs, null, symbol.span);
      }
    }

    const walk = (frame: ILexicalFrame): void => {
      for (const local of frame.declarations) {
        if (local.kind === "local") {
          checkArray(local.type, local.arrayDimensionExprs, null, local.span);
        }
      }
      frame.children.forEach(walk);
    };
    walk(program.lexicalFrameAt(sourceFile, { line: 0, column: 0 }));

    return found;
  }

  /** E0359 for a dimension naming a value C-Next cannot read, else null */
  private unreadable(
    dimension: TConstExpr,
    element: string,
    declaredAt: ISourcePosition,
  ): IConstantDimensionError | null {
    const { program, sourceFile } = this.context;
    const folded = ConstantEvaluator.evaluate(
      dimension,
      ConstantFold.environment(program, sourceFile),
    );
    if (folded.kind !== "foreign") return null; // E0909 / E0910 are the walk's
    if (ElementCount.of(dimension, program, sourceFile) !== null) return null;

    const culprit = ConstantDimensionAnalyzer.namesIn(dimension).find(
      (name) => ElementCount.of(name, program, sourceFile) === null,
    );
    const at = culprit?.at ?? declaredAt;
    return {
      code: "E0359",
      line: at.line,
      column: at.column,
      message: `Array of '${element}' must have a size C-Next can read: ADR-029 gives every element its default, so C-Next spells each one, and it cannot read the value of '${culprit ? culprit.path.join(".") : "its size"}'`,
      helpText:
        "Size it with a C-Next const, or a header macro of plain integer arithmetic (`#define N 3`, `#define M (N - 1)`)",
    };
  }

  private static namesIn(
    expr: TConstExpr,
  ): Extract<TConstExpr, { kind: "name" }>[] {
    switch (expr.kind) {
      case "name":
        return [expr];
      case "cast":
      case "unary":
        return ConstantDimensionAnalyzer.namesIn(expr.operand);
      case "binary":
        return [expr.left, expr.right].flatMap(
          ConstantDimensionAnalyzer.namesIn,
        );
      case "ternary":
        return [expr.condition, expr.whenTrue, expr.whenFalse].flatMap(
          ConstantDimensionAnalyzer.namesIn,
        );
      default:
        return [];
    }
  }
}

export default ConstantDimensionAnalyzer;
