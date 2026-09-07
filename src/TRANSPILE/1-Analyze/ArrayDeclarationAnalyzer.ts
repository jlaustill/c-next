/**
 * ADR-035 array initializers and ADR-036 declaration shape:
 * E0866, E0874, E0875, E0876.
 *
 * #1322. Five throws in `output/` -- `VariableDeclHelper` for a C-style
 * declaration, two in `CodeGenerator` for a C-style and an unbounded
 * parameter, two in `ArrayInitHelper` for the fill-all form with an inferred
 * size and for an initializer of the wrong length -- plus the string array
 * arm of E0866, which `StringDeclarationAnalyzer` carried because that
 * family moved first. Every fact is in the parse tree: where the brackets
 * are, whether a dimension has an expression, how many elements a list has.
 *
 * ## One count, every element type
 *
 * "The initializer has the declared number of elements" was decided twice:
 * for string arrays here in 2.1 (E0866) and for everything else in codegen,
 * which counted the elements it had just generated. One rule now, with the
 * declared dimensions read off the type and the elements counted off the
 * list -- at EVERY level. Codegen counted the outer list only, so
 * `u8[2][2] m <- [[1, 2, 3], [4, 5]]` was accepted and reached C as an
 * excess-elements initializer.
 *
 * ## Two holes closed, probed
 *
 * - `u8[2] b <- a` (an array initialized from another array) emitted
 *   `uint8_t b[2] = a;`, which C rejects. The string analyzer already said
 *   "must be initialized by a list" for a string array; it is said for every
 *   array now. A string LITERAL into a `u8` array is the exception ADR-035
 *   makes (`u8[] message <- "Hello"`).
 * - The nested count above.
 *
 * ## Reproduced, not closed, stated
 *
 * Codegen rejected the C-style form (`u8 arr[4]`) for a variable declaration
 * and a parameter, and accepted it for a scope member, a struct member and a
 * `for` header's declaration -- thirty-one fixtures use it in a scope or a
 * struct, and a unit test pins the scope case as intended. ADR-036 names the
 * prefix form as the only one; this pass rejects exactly where codegen did
 * and records the rest for the ADR's owner, since closing it is a language
 * change on code the corpus treats as valid.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";
import CodeGenState from "../../transpiler/state/CodeGenState";
import ArrayDimensionParser from "../../utils/ArrayDimensionParser";
import ParserUtils from "../../utils/ParserUtils";
import IArrayDeclarationError from "./types/IArrayDeclarationError";

/** A declared dimension: its size when it can be known here, else null. */
type TDimension = number | null;

class ArrayDeclarationListener extends CNextListener {
  private readonly found: IArrayDeclarationError[] = [];

  public errors(): IArrayDeclarationError[] {
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
      const base = typeCtx.getText().replace(/\[.*$/, "");
      const existing = ArrayDeclarationListener.dimensionText(
        typeCtx.arrayType()?.arrayTypeDimension() ?? [],
      );
      const after = ArrayDeclarationListener.dimensionText(trailing);
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
    if (!arrayType || !expression) return;
    this.checkInitializer(arrayType, expression);
  };

  override enterParameter = (ctx: Parser.ParameterContext): void => {
    // `main(string args[])` is the language's own form for the command-line
    // args (ADR-030), lowered to `argv` -- the one trailing `[]` that is not
    // C-style. The same criterion codegen lowers it with, asked once.
    const fn = ctx.parent?.parent;
    if (
      fn instanceof Parser.FunctionDeclarationContext &&
      ParserUtils.isMainFunctionWithArgs(
        fn.IDENTIFIER().getText(),
        fn.parameterList(),
      )
    ) {
      return;
    }
    const trailing = ctx.arrayDimension();
    const name = ctx.IDENTIFIER().getText();
    const typeText = ctx.type().getText();
    if (trailing.length > 0) {
      const after = ArrayDeclarationListener.dimensionText(trailing);
      this.report(
        ctx,
        "E0874",
        `C-style array parameter is not allowed. Use '${typeText}${after} ${name}' instead of '${typeText} ${name}${after}'`,
        "C-Next puts every array dimension in the type, before the name (ADR-036).",
      );
      return;
    }
    const dims = ctx.type().arrayType()?.arrayTypeDimension() ?? [];
    if (dims.some((d) => d.expression() === null)) {
      this.report(
        ctx,
        "E0875",
        "Unbounded array parameters are not allowed. All dimensions must have explicit sizes for memory safety.",
        "A parameter's dimensions are what the callee can trust; write the size, e.g. `u8[8] data` (ADR-036).",
      );
    }
  };

  /**
   * ADR-035: an array's initializer is a list with one element per slot at
   * every level, or the fill-all form `[v*]` for a level, or -- for a `u8`
   * array -- a string literal. An inferred size (`u8[]`) is fixed by the list,
   * so nothing to count there; the fill-all form cannot fix one.
   */
  private checkInitializer(
    arrayType: Parser.ArrayTypeContext,
    expression: Parser.ExpressionContext,
  ): void {
    const dimensions = arrayType.arrayTypeDimension();
    const inferred = dimensions.some((d) => d.expression() === null);
    const initializer = ArrayDeclarationListener.arrayInitializerOf(expression);

    if (initializer === null) {
      const isStringLiteral = /^".*"$/.test(expression.getText().trim());
      const isByteArray = arrayType.primitiveType()?.getText() === "u8";
      if (isStringLiteral && isByteArray) return; // `u8[] s <- "Hello"` (ADR-035)
      this.report(
        expression,
        "E0866",
        `An array must be initialized by a list, not '${expression.getText()}'`,
        "Write the elements out in brackets, or declare it empty and assign the elements afterwards (ADR-035).",
      );
      return;
    }

    if (inferred && initializer.STAR() !== null) {
      this.report(
        expression,
        "E0876",
        `Fill-all syntax ${expression.getText()} requires explicit array size`,
        "An inferred size comes from counting the elements, and the fill-all form has none to count; write the dimension (ADR-035).",
      );
      return;
    }

    const sizes: TDimension[] = dimensions.map((d) => {
      const expr = d.expression();
      return expr === null ? null : ArrayDeclarationListener.constantOf(expr);
    });
    this.checkLevel(initializer, sizes, 0);
  }

  /** Count one level of a nested list against its dimension, then descend. */
  private checkLevel(
    initializer: Parser.ArrayInitializerContext,
    sizes: readonly TDimension[],
    level: number,
  ): void {
    if (initializer.STAR() !== null) return; // fill-all covers this level
    const elements = initializer.arrayInitializerElement();
    const declared = sizes[level];
    if (declared !== null && declared !== undefined) {
      if (elements.length !== declared) {
        this.report(
          initializer,
          "E0866",
          `Array size mismatch: declared [${declared}] but the initializer has ${elements.length} element(s)${level > 0 ? ` at nesting level ${level + 1}` : ""}`,
          "Give one element per slot, or use the fill-all form such as [0*] (ADR-035).",
        );
        return;
      }
    }
    if (level + 1 >= sizes.length) return;
    for (const element of elements) {
      // A nested list parses as an `expression` element (the first
      // alternative that fits), so it is found by descending, not by asking
      // for the `arrayInitializer` alternative.
      const expression = element.expression();
      const nested =
        element.arrayInitializer() ??
        (expression === null
          ? null
          : ArrayDeclarationListener.arrayInitializerOf(expression));
      if (nested) this.checkLevel(nested, sizes, level + 1);
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
    dims: readonly (
      | Parser.ArrayDimensionContext
      | Parser.ArrayTypeDimensionContext
    )[],
  ): string {
    return dims.map((d) => `[${d.expression()?.getText() ?? ""}]`).join("");
  }

  private static constantOf(expr: Parser.ExpressionContext): number | null {
    return (
      ArrayDimensionParser.parseSingleDimension(expr, {
        constValues: new Map(CodeGenState.program?.constValues() ?? []),
        typeWidths: TYPE_WIDTH,
      }) ?? null
    );
  }

  private report(
    at: ParserRuleContext,
    code: string,
    message: string,
    helpText: string,
  ): void {
    const { line, column } = ParserUtils.getPosition(at);
    this.found.push({ code, line, column, message, helpText });
  }
}

class ArrayDeclarationAnalyzer {
  public analyze(tree: Parser.ProgramContext): IArrayDeclarationError[] {
    const listener = new ArrayDeclarationListener();
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default ArrayDeclarationAnalyzer;
