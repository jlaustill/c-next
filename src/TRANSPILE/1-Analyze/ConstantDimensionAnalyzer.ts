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
import type IStructDefaultFacts from "../../types/IStructDefaultFacts";
import ConstantDiagnostics from "./helpers/ConstantDiagnostics";
import type IAnalysisContext from "./types/IAnalysisContext";
import type TConstResult from "../../types/TConstResult";
import type IConstantDimensionError from "./types/IConstantDimensionError";

class ConstantDimensionListener extends CNextListener {
  private readonly found: IConstantDimensionError[] = [];

  private readonly scopes: string[] = [];

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  constructor(private readonly context: IAnalysisContext) {
    super();
  }

  public errors(): IConstantDimensionError[] {
    return this.found;
  }

  override enterScopeDeclaration = (
    ctx: Parser.ScopeDeclarationContext,
  ): void => {
    this.scopes.push(ctx.IDENTIFIER().getText());
  };

  override exitScopeDeclaration = (): void => {
    this.scopes.pop();
  };

  override enterArrayTypeDimension = (
    ctx: Parser.ArrayTypeDimensionContext,
  ): void => {
    const expression = ctx.expression();
    if (this.check(expression) !== "foreign" || !expression) return;
    const element = this.everyElementSpelled(ctx);
    if (element === null) return;
    const count = ElementCount.of(
      ConstExprLowering.lower(SyntaxLowering.expression(expression)),
      this.context.program,
      this.context.sourceFile,
    );
    if (count !== null) return;
    this.found.push({
      code: "E0359",
      ...ParserUtils.getPosition(expression),
      message: `Array of '${element}' must have a size C-Next can read: ADR-029 gives every element its default, so C-Next spells each one, and it cannot read the value of '${expression.getText()}'`,
      helpText:
        "Size it with a C-Next const, or a header macro of plain integer arithmetic (`#define N 3`, `#define M (N - 1)`)",
    });
  };

  override enterArrayDimension = (ctx: Parser.ArrayDimensionContext): void => {
    this.check(ctx.expression());
  };

  /**
   * The element type of the array `dimension` sizes, when ADR-029 gives each
   * element a non-zero default: a callback, a struct with a default, or -- in
   * a struct with a default -- an enum, whose zero enumerator is spelled
   * (#1566). Null for every other array, whose aggregate zero needs no count.
   */
  private everyElementSpelled(
    dimension: Parser.ArrayTypeDimensionContext,
  ): string | null {
    const arrayType = dimension.parent as Parser.ArrayTypeContext;
    const element = this.typeName(arrayType);
    if (element === null) return null;
    const facts = this.structDefaultFacts();
    if (facts.isCallbackType(element)) return element;
    if (StructDefault.hasDefault(element, facts)) return element;
    if (!this.context.symbols.knownEnums.has(element)) return null;
    const struct = arrayType.parent?.parent;
    if (!(struct?.parent instanceof Parser.StructDeclarationContext)) {
      return null;
    }
    const owner = this.scopedName(struct.parent.IDENTIFIER().getText());
    return StructDefault.hasDefault(owner, facts) ? element : null;
  }

  /** An array's element type by its C name (ADR-016 `Scope__Type`) */
  private typeName(arrayType: Parser.ArrayTypeContext): string | null {
    const user = arrayType.userType();
    if (user) return user.IDENTIFIER().getText();
    const scoped = arrayType.scopedType();
    if (scoped) return this.scopedName(scoped.IDENTIFIER().getText());
    const global = arrayType.globalType();
    if (global) return global.IDENTIFIER().getText();
    const qualified = arrayType.qualifiedType();
    return qualified
      ? qualified
          .IDENTIFIER()
          .map((part) => part.getText())
          .join("__")
      : null;
  }

  private scopedName(name: string): string {
    return [...this.scopes, name].join("__");
  }

  /** The facts `StructDefault` reads, as `InitializationAnalyzer` asks them */
  private structDefaultFacts(): IStructDefaultFacts {
    const symbols = this.context.symbols;
    return {
      structFields: symbols.structFields,
      isCallbackType: (typeName) => symbols.functionReturnTypes.has(typeName),
    };
  }

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
    return listener.errors();
  }
}

export default ConstantDimensionAnalyzer;
