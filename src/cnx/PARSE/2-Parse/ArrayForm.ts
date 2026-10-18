/**
 * ADR-035 array initializers and ADR-036 declaration shape, as written:
 * E0866 (an initializer that is not a list), E0874, E0875, E0876, E0892,
 * and E0917 (an array declared in a `for` header, #1823).
 *
 * Where the brackets are, whether a dimension has an expression, and whether
 * an initializer is a list are syntax, so 1.2 reports them with the file's
 * other parse errors (#1991), off the tree only 1.2 holds. Counting a list
 * against its declared size needs the size's value, which is 2.1's
 * `ArrayDeclarationAnalyzer`.
 *
 * ## Reproduced, not closed, stated
 *
 * Codegen rejected the C-style form (`u8 arr[4]`) for a variable declaration
 * and a parameter, and accepted it for a scope member and a struct member --
 * thirty-one fixtures use it in a scope or a struct, and a unit test pins the
 * scope case as intended. A `for` header declares a scalar loop variable, so
 * an array there is E0917 in either spelling (#1823). ADR-036 names the
 * prefix form as the only one; this rejects exactly where codegen did and
 * records the rest for the ADR's owner, since closing it is a language change
 * on code the corpus treats as valid.
 */
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "./grammar/CNextListener";
import * as Parser from "./grammar/CNextParser";
import SyntaxLowering from "./SyntaxLowering";
import ProgramLowering from "./ProgramLowering";
import MainSignature from "../../utils/MainSignature";
import ExpressionShape from "../../utils/ExpressionShape";
import ParserUtils from "../../utils/ParserUtils";
import CodedErrorText from "../../utils/CodedErrorText";
import type ITranspileError from "../../types/ITranspileError";

class ArrayFormListener extends CNextListener {
  private readonly found: ITranspileError[] = [];

  public errors(): ITranspileError[] {
    return this.found;
  }

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    // A scope member reaches its own generator, which never rejected the
    // C-style form -- reproduced, see the class comment.
    const isScopeMember = ctx.parent instanceof Parser.ScopeMemberContext;
    const trailing = ctx.arrayDimension();
    const identifier = ctx.IDENTIFIER();
    const typeCtx = ctx.type();
    if (!identifier || !typeCtx) return; // the constructor-call form
    if (trailing.length > 0 && !isScopeMember) {
      const type = SyntaxLowering.type(typeCtx);
      const base = type.kind === "array" ? type.element.text : type.text;
      const existing = ArrayFormListener.dimensionText(
        typeCtx.arrayType()?.arrayTypeDimension() ?? [],
      );
      const after = ArrayFormListener.dimensionText(trailing);
      this.report(
        ctx,
        "E0874",
        `C-style array declaration is not allowed. Use '${base}${existing}${after} ${identifier.getText()}' instead of '${base}${existing} ${identifier.getText()}${after}'`,
        "C-Next puts every array dimension in the type, before the name (ADR-036).",
      );
      return;
    }
    const arrayType = typeCtx.arrayType();
    const expression = ctx.expression();
    const dimensions = [
      ...(arrayType?.arrayTypeDimension() ?? []),
      ...trailing,
    ];
    if (
      this.checkEmptyDimensions(dimensions, identifier.getText(), !!expression)
    ) {
      return;
    }
    if (!arrayType || !expression) return;
    this.checkInitializer(arrayType, expression);
  };

  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    if (!ctx.type().arrayType() && ctx.arrayDimension().length === 0) return;
    this.report(
      ctx,
      "E0917",
      `An array is not a for loop variable: declare '${ctx.IDENTIFIER().getText()}' before the loop`,
      "A for header declares one scalar loop variable (ADR-036); declare the array before the loop and index it inside.",
    );
  };

  override enterStructMember = (ctx: Parser.StructMemberContext): void => {
    const dimensions = [
      ...(ctx.type().arrayType()?.arrayTypeDimension() ?? []),
      ...ctx.arrayDimension(),
    ];
    this.checkEmptyDimensions(dimensions, ctx.IDENTIFIER().getText(), false);
  };

  override enterParameter = (ctx: Parser.ParameterContext): void => {
    // `main(string args[])` is the language's own form for the command-line
    // args (ADR-030), lowered to `argv` -- the one trailing `[]` that is not
    // C-style. The same criterion codegen lowers it with, asked once.
    const fn = ctx.parent?.parent;
    if (
      fn instanceof Parser.FunctionDeclarationContext &&
      MainSignature.takesArgs(
        fn.IDENTIFIER().getText(),
        ProgramLowering.parameters(fn.parameterList()),
      )
    ) {
      return;
    }
    const trailing = ctx.arrayDimension();
    const name = ctx.IDENTIFIER().getText();
    const typeText = ctx.type().getText();
    if (trailing.length > 0) {
      const after = ArrayFormListener.dimensionText(trailing);
      this.report(
        ctx,
        "E0874",
        `C-style array parameter is not allowed. Use '${typeText}${after} ${name}' instead of '${typeText} ${name}${after}'`,
        "C-Next puts every array dimension in the type, before the name (ADR-036).",
      );
      return;
    }
    const dimensions = ctx.type().arrayType()?.arrayTypeDimension() ?? [];
    if (dimensions.some((dimension) => dimension.expression() === null)) {
      this.report(
        ctx,
        "E0875",
        "Unbounded array parameters are not allowed. All dimensions must have explicit sizes for memory safety.",
        "A parameter's dimensions are what the callee can trust; write the size, e.g. `u8[8] data` (ADR-036).",
      );
    }
  };

  /**
   * #1822 (ADR-035): every dimension states its size, except the single
   * dimension of a one-dimensional variable initialized by a list -- or, for
   * `u8`, a string literal -- whose size is the number of elements. Which
   * initializer is accepted is E0866's; this asks only whether there is one
   * to count. Returns whether anything was reported.
   */
  private checkEmptyDimensions(
    dimensions: readonly (
      | Parser.ArrayDimensionContext
      | Parser.ArrayTypeDimensionContext
    )[],
    name: string,
    hasInitializer: boolean,
  ): boolean {
    if (dimensions.length === 1 && hasInitializer) return false;
    let reported = false;
    dimensions.forEach((dim, index) => {
      if (dim.expression() !== null) return;
      this.report(
        dim,
        "E0892",
        `Array '${name}' leaves dimension ${index + 1} without a size`,
        "Write the size. Only a one-dimensional array initialized by a list (or, for u8, a string literal) may leave it out, and its size is the number of elements (ADR-035).",
      );
      reported = true;
    });
    return reported;
  }

  /**
   * ADR-035: an array's initializer is a list, or -- for a `u8` array -- a
   * string literal. An inferred size (`u8[]`) is fixed by counting the list,
   * so the fill-all form `[v*]`, which has nothing to count, cannot fix one.
   */
  private checkInitializer(
    arrayType: Parser.ArrayTypeContext,
    expression: Parser.ExpressionContext,
  ): void {
    const written = SyntaxLowering.node(expression).written;
    const initializer = ArrayFormListener.arrayInitializerOf(expression);
    if (initializer === null) {
      const isStringLiteral = ExpressionShape.isStringLiteral(
        SyntaxLowering.expression(expression),
      );
      const isByteArray = arrayType.primitiveType()?.getText() === "u8";
      if (isStringLiteral && isByteArray) return; // `u8[] s <- "Hello"` (ADR-035)
      this.report(
        expression,
        "E0866",
        `An array must be initialized by a list, not '${written}'`,
        "Write the elements out in brackets, or declare it empty and assign the elements afterwards (ADR-035).",
      );
      return;
    }
    const inferred = arrayType
      .arrayTypeDimension()
      .some((dimension) => dimension.expression() === null);
    if (inferred && initializer.STAR() !== null) {
      this.report(
        expression,
        "E0876",
        `Fill-all syntax ${written} requires explicit array size`,
        "An inferred size comes from counting the elements, and the fill-all form has none to count; write the dimension (ADR-035).",
      );
    }
  }

  /** The `[...]` an expression IS, descending through single-child levels. */
  private static arrayInitializerOf(
    expression: Parser.ExpressionContext,
  ): Parser.ArrayInitializerContext | null {
    let node: ParserRuleContext = expression;
    while (node.getChildCount() === 1) {
      const child = node.getChild(0);
      if (!(child instanceof ParserRuleContext)) break;
      node = child;
      if (node instanceof Parser.ArrayInitializerContext) return node;
    }
    return null;
  }

  private static dimensionText(
    dimensions: readonly (
      | Parser.ArrayDimensionContext
      | Parser.ArrayTypeDimensionContext
    )[],
  ): string {
    return dimensions
      .map((d) => {
        const size = d.expression();
        return `[${size === null ? "" : SyntaxLowering.node(size).written}]`;
      })
      .join("");
  }

  private report(
    at: ParserRuleContext,
    code: string,
    message: string,
    helpText: string,
  ): void {
    const position = ParserUtils.getPosition(at);
    this.found.push({
      line: position.line,
      column: position.column,
      message: CodedErrorText.of(code, message),
      helpText,
      severity: "error",
    });
  }
}

class ArrayForm {
  /** Every array-shape error in a tree that parsed */
  static errorsIn(tree: Parser.ProgramContext): ITranspileError[] {
    const listener = new ArrayFormListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default ArrayForm;
