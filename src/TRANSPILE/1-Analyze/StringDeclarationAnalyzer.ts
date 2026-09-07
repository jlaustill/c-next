/**
 * ADR-045 string declarations: E0862-E0866.
 *
 * #1322. Fourteen throws in `StringDeclHelper`, all reaching the user as `1:0`.
 *
 * ## Three messages that were one rule
 *
 * At file scope a string may be initialized by a LITERAL and by nothing else.
 * C has no place to run `strncpy` or `strncat` before `main`, so a copy from a
 * variable, a concatenation and a substring extraction are all impossible
 * there -- and all three threw, with three different messages, from three
 * different generation paths. Probed rather than assumed: a literal and an
 * absent initializer are accepted at file scope; those three are not.
 *
 * Written as one question about the initializer's FORM, the three collapse.
 *
 * ## Capacity is asked of the declaration, not of codegen
 *
 * The capacity rules -- an array needs `string<N>[M]`, a non-const needs
 * `string<N>`, a const without one needs a literal to infer from -- are all
 * properties of the declaration's own syntax. The fit rules need a source
 * capacity, which is `IDeclaredVar.stringCapacity`: a literal's is its length,
 * a variable's is what its declaration said.
 *
 * `CodeGenState.inFunctionBody` is what codegen asked for the file-scope
 * question. It is a generation-time cursor and does not exist when this pass
 * runs; the parse tree answers the same question by position.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";
import CodeGenState from "../../transpiler/state/CodeGenState";
import ArrayDimensionParser from "../../utils/ArrayDimensionParser";
import ExpressionUnwrapper from "../../utils/ExpressionUnwrapper";
import ParserUtils from "../../utils/ParserUtils";
import StringUtils from "../../utils/StringUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import IScopeFrame from "./types/IScopeFrame";
import IStringDeclarationError from "./types/IStringDeclarationError";
import ScopeFrameResolver from "./ScopeFrameResolver";

/** What a string-valued expression can hold, or null if it is not one. */
interface IStringSource {
  readonly capacity: number;
  readonly isLiteral: boolean;
}

class StringDeclarationListener extends CNextListener {
  private readonly found: IStringDeclarationError[] = [];

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
  }

  public errors(): IStringDeclarationError[] {
    return this.found;
  }

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    const typeCtx = ctx.type();
    const arrayType = typeCtx.arrayType?.();
    const stringCtx = arrayType?.stringType?.() ?? typeCtx.stringType();
    if (!stringCtx) return;

    const isArray = arrayType?.stringType?.() !== undefined;
    const declared = stringCtx.INTEGER_LITERAL();
    const expression = ctx.expression();
    const isConst = StringDeclarationListener.isConstDeclaration(ctx);

    if (
      !this.checkCapacityIsStated(
        ctx,
        stringCtx,
        declared,
        isArray,
        isConst,
        expression,
      )
    ) {
      return;
    }
    if (declared === null) return; // an inferred const capacity always fits

    const capacity = Number.parseInt(declared.getText(), 10);
    if (!expression) return;

    if (isArray) {
      // #1322: a string ARRAY's initializer -- a list, of the declared size --
      // is the same rule for every element type, and it is asked once, in
      // `ArrayDeclarationAnalyzer` (ADR-035, E0866). The capacity rules below
      // are about one string.
      return;
    }
    if (!this.checkFileScopeForm(ctx, expression)) return;
    this.checkFit(ctx, expression, capacity);
  };

  /**
   * A declaration has to state a capacity, or be a `const` this pass can infer
   * one from. Four throws, one question.
   */
  private checkCapacityIsStated(
    ctx: Parser.VariableDeclarationContext,
    stringCtx: Parser.StringTypeContext,
    declared: unknown,
    isArray: boolean,
    isConst: boolean,
    expression: Parser.ExpressionContext | null,
  ): boolean {
    if (declared !== null) return true;

    if (isArray) {
      this.report(
        stringCtx,
        "E0862",
        "A string array requires an explicit capacity",
        "Write the element capacity, e.g. string<64>[4].",
      );
      return false;
    }
    if (!isConst) {
      this.report(
        stringCtx,
        "E0862",
        "A non-const string requires an explicit capacity",
        "Write the capacity, e.g. string<64>. Only a `const` can have one inferred.",
      );
      return false;
    }
    if (!expression) {
      this.report(
        stringCtx,
        "E0862",
        "A const string without a capacity requires an initializer to infer it from",
        "Write the capacity, e.g. string<64>, or initialize it with a literal.",
      );
      return false;
    }
    if (StringDeclarationListener.literalOf(expression) === null) {
      this.report(
        expression,
        "E0862",
        "A const string without a capacity requires a string literal to infer it from",
        "Write the capacity, e.g. string<64>. A capacity can only be inferred from a literal.",
      );
      return false;
    }
    return true;
  }

  /**
   * At file scope a string may only be initialized by a literal.
   *
   * Returns false when it reported, so the fit checks below do not also fire on
   * an initializer that cannot be there at all.
   */
  private checkFileScopeForm(
    ctx: Parser.VariableDeclarationContext,
    expression: Parser.ExpressionContext,
  ): boolean {
    if (StringDeclarationListener.isInsideFunction(ctx)) return true;
    if (StringDeclarationListener.literalOf(expression) !== null) return true;

    this.report(
      expression,
      "E0863",
      `A string at file scope may only be initialized by a literal, not '${expression.getText()}'`,
      "Copying, concatenating and extracting a substring all need runtime calls, which C cannot make before `main`. Move the declaration into a function, or initialize it empty and assign later.",
    );
    return false;
  }

  /** The initializer has to fit the declared capacity. */
  private checkFit(
    ctx: Parser.VariableDeclarationContext,
    expression: Parser.ExpressionContext,
    capacity: number,
  ): void {
    const frame = this.scopes.frameFor(ctx);

    const substring = this.substringOf(expression, frame);
    if (substring !== null) {
      this.checkSubstring(expression, substring, capacity);
      return;
    }

    const concat = this.concatOf(expression, frame);
    if (concat !== null) {
      const required = concat[0] + concat[1];
      if (required > capacity) {
        this.report(
          expression,
          "E0864",
          `String concatenation requires capacity ${required}, but the declaration is string<${capacity}>`,
          `Widen the declaration to string<${required}>, or shorten the operands.`,
        );
      }
      return;
    }

    const source = this.stringSourceOf(expression, frame);
    if (source === null) return;

    if (source.isLiteral && source.capacity > capacity) {
      this.report(
        expression,
        "E0864",
        `String literal (${source.capacity} chars) exceeds string<${capacity}> capacity`,
        `Widen the declaration to string<${source.capacity}>, or shorten the literal.`,
      );
      return;
    }
    if (!source.isLiteral && source.capacity > capacity) {
      this.report(
        expression,
        "E0864",
        `Cannot initialize string<${capacity}> from string<${source.capacity}> -- the source may not fit`,
        `Widen the declaration to string<${source.capacity}>, or extract a substring of the source.`,
      );
    }
  }

  private checkSubstring(
    expression: Parser.ExpressionContext,
    substring: {
      start: number | null;
      length: number | null;
      sourceCapacity: number;
    },
    capacity: number,
  ): void {
    const { start, length, sourceCapacity } = substring;
    if (start !== null && length !== null && start + length > sourceCapacity) {
      this.report(
        expression,
        "E0865",
        `Substring bounds [${start}, ${length}] exceed the source string<${sourceCapacity}>`,
        "The bounds are counted in characters from zero; keep start + length within the source's capacity.",
      );
      return;
    }
    if (length !== null && length > capacity) {
      this.report(
        expression,
        "E0864",
        `Substring length ${length} exceeds destination string<${capacity}> capacity`,
        `Widen the declaration to string<${length}>, or take fewer characters.`,
      );
    }
  }

  // --- The facts the rules above are asked of ------------------------------

  /** A string-valued expression's capacity: a literal's length, or a declared one. */
  private stringSourceOf(
    expression: Parser.ExpressionContext,
    frame: IScopeFrame,
  ): IStringSource | null {
    const literal = StringDeclarationListener.literalOf(expression);
    if (literal !== null) {
      return { capacity: StringUtils.literalLength(literal), isLiteral: true };
    }
    const name = expression.getText();
    const capacity = this.capacityOfName(name, frame);
    return capacity === null ? null : { capacity, isLiteral: false };
  }

  /**
   * A declared string's capacity, from this file's frames or the run-wide view.
   *
   * Lexical FIRST so a local declaration still shadows an imported one -- the
   * shape `ScopeFrameResolver.typeOfName` established, written once here rather
   * than at each of the three places that ask.
   */
  private capacityOfName(name: string, frame: IScopeFrame): number | null {
    if (!/^[A-Za-z_]\w*$/.test(name)) return null;
    const declared = this.scopes.declarationOfNameLexical(name, frame);
    if (declared?.stringCapacity != null) return declared.stringCapacity;
    const info = CodeGenState.getVariableTypeInfo(name);
    return info?.isString && info.stringCapacity !== undefined
      ? info.stringCapacity
      : null;
  }

  /** `left + right` where BOTH operands are strings, as their capacities. */
  private concatOf(
    expression: Parser.ExpressionContext,
    frame: IScopeFrame,
  ): [number, number] | null {
    const additive = ExpressionUnwrapper.getAdditiveExpression(expression);
    if (!additive) return null;
    const operands = additive.multiplicativeExpression();
    // Exactly two operands, joined by `+` -- a `-` is not a concatenation, and
    // the token is checked rather than the text, which would match a hyphen
    // inside an identifier or a literal.
    if (operands.length !== 2 || additive.MINUS().length > 0) return null;

    const left = this.capacityOfOperand(operands[0], frame);
    const right = this.capacityOfOperand(operands[1], frame);
    return left !== null && right !== null ? [left, right] : null;
  }

  private capacityOfOperand(
    operand: ParserRuleContext,
    frame: IScopeFrame,
  ): number | null {
    const text = operand.getText();
    if (text.startsWith('"') && text.endsWith('"')) {
      return StringUtils.literalLength(text);
    }
    return this.capacityOfName(text, frame);
  }

  /** `src[start, length]`, or `src[i]` which is sugar for `src[i, 1]`. */
  private substringOf(
    expression: Parser.ExpressionContext,
    frame: IScopeFrame,
  ): {
    start: number | null;
    length: number | null;
    sourceCapacity: number;
  } | null {
    const postfix = ExpressionUnwrapper.getPostfixExpression(expression);
    if (!postfix) return null;
    const ops = postfix.postfixOp();
    if (ops.length !== 1) return null;

    const sourceName = postfix.primaryExpression()?.IDENTIFIER()?.getText();
    if (!sourceName) return null;

    const capacity = this.capacityOfName(sourceName, frame);
    if (capacity === null) return null;

    const subscripts = ops[0].expression();
    if (subscripts.length === 2) {
      return {
        start: StringDeclarationListener.constantOf(subscripts[0]),
        length: StringDeclarationListener.constantOf(subscripts[1]),
        sourceCapacity: capacity,
      };
    }
    if (subscripts.length === 1) {
      // `src[i]` is one character, which ADR-045 defines as `src[i, 1]`.
      return {
        start: StringDeclarationListener.constantOf(subscripts[0]),
        length: 1,
        sourceCapacity: capacity,
      };
    }
    return null;
  }

  // --- Static helpers -------------------------------------------------------

  /** The string literal an expression IS, or null. */
  private static literalOf(
    expression: Parser.ExpressionContext,
  ): string | null {
    const text = expression.getText();
    return text.startsWith('"') && text.endsWith('"') && text.length >= 2
      ? text
      : null;
  }

  private static isConstDeclaration(
    ctx: Parser.VariableDeclarationContext,
  ): boolean {
    return ctx.getText().startsWith("const");
  }

  /**
   * Whether the declaration sits inside a function body.
   *
   * `CodeGenState.inFunctionBody` is the generation-time cursor codegen asked;
   * position in the tree is the same fact, available now.
   */
  private static isInsideFunction(ctx: ParserRuleContext): boolean {
    let node: ParserRuleContext | null = ctx.parent;
    while (node) {
      if (node instanceof Parser.FunctionDeclarationContext) return true;
      node = node.parent;
    }
    return false;
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

class StringDeclarationAnalyzer {
  public analyze(tree: Parser.ProgramContext): IStringDeclarationError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new StringDeclarationListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default StringDeclarationAnalyzer;
