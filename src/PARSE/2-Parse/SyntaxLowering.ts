/**
 * The parse tree as plain data (#1932). The target: 1.2 Parse lowers each
 * expression and type once, here, and every pass from 2.2 on reads the result
 * instead of a parse node, because the tree is gone before 2.2 (owner ruling
 * on #1932, docs/architecture/README.md §2). Today each caller lowers on
 * demand -- 1.3, 2.1, `OperandTyper` and, as a stopgap, `CodeGenWalker` --
 * until 1.2's artifact carries the lowered form (a later slice of #1932).
 *
 * Lowering decides nothing. It records what was written, in the grammar's
 * shape minus its pass-through levels -- see `TExpression` -- and leaves every
 * question about meaning to the pass that owns it.
 */
import type { ParserRuleContext, ParseTree } from "antlr4ng";
import * as Parser from "./grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import ChainRoot from "../../utils/ChainRoot";
import invariant from "../../utils/invariant";
import type ISyntaxNode from "../../types/syntax/ISyntaxNode";
import type TBinaryLevel from "../../types/syntax/TBinaryLevel";
import BINARY_OPERATORS from "../../types/syntax/BINARY_OPERATORS";
import type TBinaryOperator from "../../types/syntax/TBinaryOperator";
import type TExpressionOf from "../../types/syntax/TExpressionOf";
import type TExpression from "../../types/syntax/TExpression";
import type TLiteralKind from "../../types/syntax/TLiteralKind";
import type TPostfixOpSyntax from "../../types/syntax/TPostfixOpSyntax";
import type TTemplateArgumentSyntax from "../../types/syntax/TTemplateArgumentSyntax";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";

const BINARY_OPERATOR_SET: ReadonlySet<string> = new Set(BINARY_OPERATORS);

type TArrayElementAccessors = Pick<
  Parser.ArrayTypeContext,
  | "primitiveType"
  | "userType"
  | "stringType"
  | "scopedType"
  | "qualifiedType"
  | "globalType"
>;

class SyntaxLowering {
  static expression(ctx: Parser.ExpressionContext): TExpression {
    return SyntaxLowering.ternary(ctx.ternaryExpression());
  }

  /**
   * An assignment target as the postfix chain it spells: `this.x[i].y` is a
   * `this` root followed by `.x`, `[i]` and `.y`, the shape an expression's
   * chain has, so one chain walk types both.
   */
  static assignmentTarget(ctx: Parser.AssignmentTargetContext): TExpression {
    const identifier = ctx.IDENTIFIER();
    const named =
      identifier !== null && identifier.symbol.tokenIndex >= 0
        ? identifier
        : null;
    const ops = ctx
      .postfixTargetOp()
      .map((op) => SyntaxLowering.postfixTargetOp(op));
    const root = ChainRoot.ofTarget(ctx);
    if (root === null) {
      // The arm without a root starts with its IDENTIFIER, and recovery never invents
      // one there: 0 of 14,888 recovered targets in a seeded run (#1949 review)
      invariant(
        named !== null,
        "an assignment target without a root starts with a written name",
      );
      const head: TExpression = {
        kind: "identifier",
        name: named.getText(),
        span: ParserUtils.getSpan({
          start: named.symbol,
          stop: named.symbol,
        }),
        written: named.getText(),
      };
      if (ops.length === 0) return head;
      return {
        kind: "postfix",
        primary: head,
        ops,
        ...SyntaxLowering.node(ctx),
      };
    }
    const rootToken = (ctx.THIS() ?? ctx.GLOBAL())!.symbol;
    const first: TPostfixOpSyntax = named
      ? {
          kind: "member",
          name: named.getText(),
          nameSpan: ParserUtils.getSpan({
            start: named.symbol,
            stop: named.symbol,
          }),
          span: ParserUtils.getSpan({
            start: named.symbol,
            stop: named.symbol,
          }),
          written: `.${named.getText()}`,
        }
      : { kind: "missing", ...SyntaxLowering.node(ctx) };
    return {
      kind: "postfix",
      primary: {
        kind: "root",
        root,
        span: ParserUtils.getSpan({ start: rootToken, stop: rootToken }),
        written: root,
      },
      ops: [first, ...ops],
      ...SyntaxLowering.node(ctx),
    };
  }

  private static postfixTargetOp(
    ctx: Parser.PostfixTargetOpContext,
  ): TPostfixOpSyntax {
    const node = SyntaxLowering.node(ctx);
    const identifier = ctx.IDENTIFIER();
    if (identifier) {
      if (identifier.symbol.tokenIndex < 0) return { kind: "missing", ...node };
      return {
        kind: "member",
        name: identifier.getText(),
        nameSpan: ParserUtils.getSpan({
          start: identifier.symbol,
          stop: identifier.symbol,
        }),
        ...node,
      };
    }
    const indexes = ctx.expression().map((e) => SyntaxLowering.expression(e));
    if (indexes.length === 1) {
      return { kind: "subscript", indexes: [indexes[0]], ...node };
    }
    if (indexes.length === 2) {
      return { kind: "subscript", indexes: [indexes[0], indexes[1]], ...node };
    }
    return { kind: "missing", ...node };
  }

  /**
   * An `expression`, a precedence level or a unary operand: what a caller
   * holding an operand rather than an `expression` lowers (a shift amount, one
   * level of a composite).
   */
  static expressionNode(node: ParserRuleContext): TExpression {
    if (node instanceof Parser.ExpressionContext) {
      return SyntaxLowering.expression(node);
    }
    if (node instanceof Parser.UnaryExpressionContext) {
      return SyntaxLowering.unary(node);
    }
    if (node instanceof Parser.PostfixExpressionContext) {
      return SyntaxLowering.postfix(node);
    }
    if (node instanceof Parser.PrimaryExpressionContext) {
      return SyntaxLowering.primary(node);
    }
    if (node instanceof Parser.TernaryExpressionContext) {
      return SyntaxLowering.ternary(node);
    }
    if (node instanceof Parser.AssignmentTargetContext) {
      return SyntaxLowering.assignmentTarget(node);
    }
    return SyntaxLowering.binary(node, SyntaxLowering.levelOf(node));
  }

  static type(ctx: Parser.TypeContext): TTypeSyntax {
    const array = ctx.arrayType();
    if (array) return SyntaxLowering.arrayType(array);
    if (ctx.VOID()) return { kind: "void", ...SyntaxLowering.typeNode(ctx) };
    return SyntaxLowering.namedType(ctx, ctx);
  }

  private static levelOf(node: ParserRuleContext): TBinaryLevel {
    if (node instanceof Parser.OrExpressionContext) return "or";
    if (node instanceof Parser.AndExpressionContext) return "and";
    if (node instanceof Parser.EqualityExpressionContext) return "equality";
    if (node instanceof Parser.RelationalExpressionContext) return "relational";
    if (node instanceof Parser.BitwiseOrExpressionContext) return "bitwiseOr";
    if (node instanceof Parser.BitwiseXorExpressionContext) return "bitwiseXor";
    if (node instanceof Parser.BitwiseAndExpressionContext) return "bitwiseAnd";
    if (node instanceof Parser.ShiftExpressionContext) return "shift";
    if (node instanceof Parser.AdditiveExpressionContext) return "additive";
    invariant(
      node instanceof Parser.MultiplicativeExpressionContext,
      `an expression-level node, not ${node.constructor.name}`,
    );
    return "multiplicative";
  }

  private static ternary(ctx: Parser.TernaryExpressionContext): TExpression {
    const parts = ctx.orExpression();
    if (parts.length === 0) return SyntaxLowering.missing(ctx);
    if (parts.length === 3) {
      return {
        kind: "ternary",
        condition: SyntaxLowering.expressionNode(parts[0]),
        whenTrue: SyntaxLowering.expressionNode(parts[1]),
        whenFalse: SyntaxLowering.expressionNode(parts[2]),
        ...SyntaxLowering.node(ctx),
      };
    }
    return SyntaxLowering.expressionNode(parts[0]);
  }

  /**
   * One left-associative binary level: its operands are rule contexts and its
   * operators the terminals between them
   */
  private static binary(
    ctx: ParserRuleContext,
    level: TBinaryLevel,
  ): TExpression {
    const children: ParseTree[] = ctx.children;
    if (children.length === 1) {
      return SyntaxLowering.expressionNode(children[0] as ParserRuleContext);
    }
    const operands: TExpression[] = [];
    const operators: TBinaryOperator[] = [];
    children.forEach((child, i) => {
      if (i % 2 === 0) {
        operands.push(
          SyntaxLowering.expressionNode(child as ParserRuleContext),
        );
        return;
      }
      const operator = child.getText();
      invariant(
        SyntaxLowering.isBinaryOperator(operator),
        `every operator of a binary expression level is a C-Next binary operator, not '${operator}'`,
      );
      operators.push(operator);
    });
    return {
      kind: "binary",
      level,
      operands,
      operators,
      ...SyntaxLowering.node(ctx),
    };
  }

  private static isBinaryOperator(text: string): text is TBinaryOperator {
    return BINARY_OPERATOR_SET.has(text);
  }

  private static unary(ctx: Parser.UnaryExpressionContext): TExpression {
    const postfix = ctx.postfixExpression();
    if (postfix) return SyntaxLowering.postfix(postfix);
    const operand = ctx.unaryExpression();
    if (!operand) return SyntaxLowering.missing(ctx);
    return {
      kind: "unary",
      operator: SyntaxLowering.unaryOperator(ctx),
      operand: SyntaxLowering.unary(operand),
      ...SyntaxLowering.node(ctx),
    };
  }

  private static unaryOperator(
    ctx: Parser.UnaryExpressionContext,
  ): TExpressionOf<"unary">["operator"] {
    if (ctx.MINUS()) return "-";
    if (ctx.BITNOT()) return "~";
    if (ctx.BITAND()) return "&";
    invariant(ctx.NOT(), "a unary expression has an operator or is postfix");
    return "!";
  }

  private static postfix(ctx: Parser.PostfixExpressionContext): TExpression {
    const primary = SyntaxLowering.primary(ctx.primaryExpression());
    const ops = ctx.postfixOp();
    if (ops.length === 0) return primary;
    return {
      kind: "postfix",
      primary,
      ops: ops.map((op) => SyntaxLowering.postfixOp(op)),
      ...SyntaxLowering.node(ctx),
    };
  }

  private static postfixOp(ctx: Parser.PostfixOpContext): TPostfixOpSyntax {
    const node = SyntaxLowering.node(ctx);
    const identifier = ctx.IDENTIFIER();
    if (identifier) {
      // a name the parser conjured to recover was never written
      if (identifier.symbol.tokenIndex < 0) return { kind: "missing", ...node };
      return {
        kind: "member",
        name: identifier.getText(),
        nameSpan: ParserUtils.getSpan({
          start: identifier.symbol,
          stop: identifier.symbol,
        }),
        ...node,
      };
    }
    const indexes = ctx.expression().map((e) => SyntaxLowering.expression(e));
    if (indexes.length === 1) {
      return { kind: "subscript", indexes: [indexes[0]], ...node };
    }
    if (indexes.length === 2) {
      return { kind: "subscript", indexes: [indexes[0], indexes[1]], ...node };
    }
    if (!ctx.LPAREN()) return { kind: "missing", ...node };
    return {
      kind: "call",
      arguments: (ctx.argumentList()?.expression() ?? []).map((e) =>
        SyntaxLowering.expression(e),
      ),
      ...node,
    };
  }

  private static primary(ctx: Parser.PrimaryExpressionContext): TExpression {
    const sizeOf = ctx.sizeofExpression();
    if (sizeOf) return SyntaxLowering.sizeOf(sizeOf);
    const cast = ctx.castExpression();
    if (cast) {
      return {
        kind: "cast",
        type: SyntaxLowering.type(cast.type()),
        operand: SyntaxLowering.unaryOrMissing(cast.unaryExpression(), cast),
        ...SyntaxLowering.node(cast),
      };
    }
    const struct = ctx.structInitializer();
    if (struct) return SyntaxLowering.structInitializer(struct);
    const array = ctx.arrayInitializer();
    if (array) return SyntaxLowering.arrayInitializer(array);
    const literal = ctx.literal();
    if (literal) return SyntaxLowering.literal(literal);
    const inner = ctx.expression();
    if (inner) {
      return {
        kind: "parenthesized",
        expression: SyntaxLowering.expression(inner),
        ...SyntaxLowering.node(ctx),
      };
    }
    if (ctx.THIS() || ctx.GLOBAL()) {
      return {
        kind: "root",
        root: ctx.THIS() ? "this" : "global",
        ...SyntaxLowering.node(ctx),
      };
    }
    const identifier = ctx.IDENTIFIER();
    if (!identifier) return SyntaxLowering.missing(ctx);
    return {
      kind: "identifier",
      name: identifier.getText(),
      ...SyntaxLowering.node(ctx),
    };
  }

  private static sizeOf(ctx: Parser.SizeofExpressionContext): TExpression {
    const type = ctx.type();
    const expression = ctx.expression();
    return {
      kind: "sizeof",
      type: type ? SyntaxLowering.type(type) : null,
      expression: expression ? SyntaxLowering.expression(expression) : null,
      ...SyntaxLowering.node(ctx),
    };
  }

  private static structInitializer(
    ctx: Parser.StructInitializerContext,
  ): TExpression {
    return {
      kind: "structInitializer",
      // A field the parser recovered without a name initializes nothing
      fields: (ctx.fieldInitializerList()?.fieldInitializer() ?? [])
        .filter((field) => field.IDENTIFIER() !== null)
        .map((field) => ({
          name: field.IDENTIFIER().getText(),
          value: SyntaxLowering.expressionOrMissing(field.expression(), field),
          ...SyntaxLowering.node(field),
        })),
      ...SyntaxLowering.node(ctx),
    };
  }

  private static arrayInitializer(
    ctx: Parser.ArrayInitializerContext,
  ): TExpression {
    const fill = ctx.expression();
    return {
      kind: "arrayInitializer",
      elements: ctx
        .arrayInitializerElement()
        .map((element) => SyntaxLowering.arrayElement(element)),
      fill: fill ? SyntaxLowering.expression(fill) : null,
      ...SyntaxLowering.node(ctx),
    };
  }

  private static arrayElement(
    ctx: Parser.ArrayInitializerElementContext,
  ): TExpression {
    const expression = ctx.expression();
    if (expression) return SyntaxLowering.expression(expression);
    const struct = ctx.structInitializer();
    if (struct) return SyntaxLowering.structInitializer(struct);
    const array = ctx.arrayInitializer();
    if (!array) return SyntaxLowering.missing(ctx);
    return SyntaxLowering.arrayInitializer(array);
  }

  private static literal(ctx: Parser.LiteralContext): TExpression {
    return {
      kind: "literal",
      literalKind: SyntaxLowering.literalKind(ctx),
      text: ctx.getText(),
      ...SyntaxLowering.node(ctx),
    };
  }

  private static literalKind(ctx: Parser.LiteralContext): TLiteralKind {
    if (ctx.SUFFIXED_DECIMAL()) return "suffixedDecimal";
    if (ctx.SUFFIXED_HEX()) return "suffixedHex";
    if (ctx.SUFFIXED_BINARY()) return "suffixedBinary";
    if (ctx.SUFFIXED_FLOAT()) return "suffixedFloat";
    if (ctx.INTEGER_LITERAL()) return "integer";
    if (ctx.HEX_LITERAL()) return "hex";
    if (ctx.BINARY_LITERAL()) return "binary";
    if (ctx.FLOAT_LITERAL()) return "float";
    if (ctx.STRING_LITERAL()) return "string";
    if (ctx.CHAR_LITERAL()) return "char";
    if (ctx.TRUE()) return "true";
    if (ctx.FALSE()) return "false";
    invariant(ctx.C_NULL(), "a literal is one of the grammar's literal tokens");
    return "null";
  }

  private static arrayType(ctx: Parser.ArrayTypeContext): TTypeSyntax {
    const elementCtx =
      ctx.primitiveType() ??
      ctx.userType() ??
      ctx.stringType() ??
      ctx.scopedType() ??
      ctx.qualifiedType() ??
      ctx.globalType();
    return {
      kind: "array",
      element: elementCtx
        ? SyntaxLowering.namedType(ctx, elementCtx)
        : { kind: "missing", ...SyntaxLowering.typeNode(ctx) },
      dimensions: ctx.arrayTypeDimension().map((dimension) => {
        const size = dimension.expression();
        return size ? SyntaxLowering.expression(size) : null;
      }),
      ...SyntaxLowering.typeNode(ctx),
    };
  }

  /**
   * A non-array type. `accessors` is the context holding the alternative --
   * the type itself, or an array type for its element -- and `at` the node
   * the result describes.
   */
  private static namedType(
    accessors: TArrayElementAccessors &
      Partial<Pick<Parser.TypeContext, "templateType">>,
    at: ParserRuleContext,
  ): TTypeSyntax {
    const node = SyntaxLowering.typeNode(at);
    const primitive = accessors.primitiveType();
    if (primitive) {
      return { kind: "primitive", name: primitive.getText(), ...node };
    }
    const string = accessors.stringType();
    if (string) {
      return {
        kind: "string",
        capacity: string.INTEGER_LITERAL()?.getText() ?? null,
        ...node,
      };
    }
    const scoped = accessors.scopedType();
    if (scoped) {
      return { kind: "scoped", name: scoped.IDENTIFIER().getText(), ...node };
    }
    const global = accessors.globalType();
    if (global) {
      return { kind: "global", name: global.IDENTIFIER().getText(), ...node };
    }
    const qualified = accessors.qualifiedType();
    if (qualified) {
      return {
        kind: "qualified",
        path: qualified.IDENTIFIER().map((id) => id.getText()),
        ...node,
      };
    }
    const template = accessors.templateType?.();
    if (template) return SyntaxLowering.templateType(template);
    const user = accessors.userType();
    if (!user) return { kind: "missing", ...node };
    return { kind: "user", name: user.IDENTIFIER().getText(), ...node };
  }

  private static templateType(ctx: Parser.TemplateTypeContext): TTypeSyntax {
    return {
      kind: "template",
      name: ctx.IDENTIFIER().getText(),
      arguments: ctx
        .templateArgumentList()
        .templateArgument()
        .map((argument) => SyntaxLowering.templateArgument(argument)),
      ...SyntaxLowering.typeNode(ctx),
    };
  }

  private static templateArgument(
    ctx: Parser.TemplateArgumentContext,
  ): TTemplateArgumentSyntax {
    const node = SyntaxLowering.node(ctx);
    const template = ctx.templateType();
    if (template) {
      return {
        kind: "type",
        type: SyntaxLowering.templateType(template),
        ...node,
      };
    }
    const primitive = ctx.primitiveType();
    if (primitive) {
      return {
        kind: "type",
        type: {
          kind: "primitive",
          name: primitive.getText(),
          ...SyntaxLowering.typeNode(primitive),
        },
        ...node,
      };
    }
    const identifier = ctx.IDENTIFIER();
    if (identifier)
      return { kind: "name", name: identifier.getText(), ...node };
    const integer = ctx.INTEGER_LITERAL();
    if (!integer) {
      return {
        kind: "type",
        type: { kind: "missing", ...SyntaxLowering.typeNode(ctx) },
        ...node,
      };
    }
    return { kind: "integer", text: integer.getText(), ...node };
  }

  /*
   * A recovered tree (see `TExpression`'s `missing`) can leave null where the
   * generated getter's type says a node is required.
   */
  private static expressionOrMissing(
    ctx: Parser.ExpressionContext | null,
    parent: ParserRuleContext,
  ): TExpression {
    return ctx
      ? SyntaxLowering.expression(ctx)
      : SyntaxLowering.missing(parent);
  }

  private static unaryOrMissing(
    ctx: Parser.UnaryExpressionContext | null,
    parent: ParserRuleContext,
  ): TExpression {
    return ctx ? SyntaxLowering.unary(ctx) : SyntaxLowering.missing(parent);
  }

  /** Where the parser recovered from an error: see `TExpression`'s `missing` */
  static missing(ctx: ParserRuleContext): TExpression {
    return { kind: "missing", ...SyntaxLowering.node(ctx) };
  }

  static node(ctx: ParserRuleContext): ISyntaxNode {
    return {
      span: ParserUtils.getSpan(ctx),
      written: SyntaxLowering.asWritten(ctx),
    };
  }

  private static typeNode(
    ctx: ParserRuleContext,
  ): ISyntaxNode & { readonly text: string } {
    return { ...SyntaxLowering.node(ctx), text: ctx.getText() };
  }

  /**
   * A node's source text, spaces and all: `getText()` joins tokens, so
   * `word - -1` would read back as `word--1`
   */
  private static asWritten(ctx: ParserRuleContext): string {
    const stream = ctx.start?.inputStream;
    return stream && ctx.start && ctx.stop
      ? stream.getTextFromRange(ctx.start.start, ctx.stop.stop)
      : ctx.getText();
  }
}

export default SyntaxLowering;
