/**
 * An expression's parse tree as a `TConstExpr` (#1175, #1669), so a value can
 * be computed from it after the tree is gone.
 *
 * Lowered from the TREE, never from `getText()`: ANTLR joins tokens with no
 * separator, and the joined text re-lexes as different tokens -- `1 - -1`
 * becomes `1--1`, `(A < -1)` becomes `(A<-1)`. The tree already has the
 * operators and operands apart, so no text is ever re-read.
 *
 * Lowering decides nothing about values. A name stays a name, a call stays a
 * call, and `ConstantEvaluator` says what each is worth.
 */
import * as Parser from "../PARSE/2-Parse/grammar/CNextParser";
import ParserUtils from "./ParserUtils";
import invariant from "./invariant";
import ConstantEvaluator from "./ConstantEvaluator";
import LiteralUtils from "./LiteralUtils";
import LengthProperty from "./LengthProperty";
import ELEMENT_STEP from "../types/ELEMENT_STEP";
import type IConstantEnvironment from "./types/IConstantEnvironment";
import type { ParserRuleContext } from "antlr4ng";
import type TConstExpr from "../types/TConstExpr";

type TBinaryOp = Extract<TConstExpr, { kind: "binary" }>["op"];
type TOtherWhat = Extract<TConstExpr, { kind: "other" }>["what"];

const BINARY_OPS: ReadonlySet<string> = new Set<TBinaryOp>([
  "*",
  "/",
  "%",
  "+",
  "-",
  "<<",
  ">>",
  "&",
  "^",
  "|",
  "<",
  ">",
  "<=",
  ">=",
  "=",
  "!=",
  "&&",
  "||",
]);

/** A suffixed literal: its value, and the type its suffix names */
const SUFFIXED = /^(.+?)([uUiI](?:8|16|32|64))$/;

class ConstExprLowering {
  /**
   * What an expression written here is worth, as an integer: the 2.x entry,
   * where the tree is in hand. Undefined when it has no value -- a runtime
   * operand, a C macro -- which is a real answer, not a failure.
   */
  static valueOf(
    ctx: Parser.ExpressionContext,
    env: IConstantEnvironment,
  ): number | undefined {
    const result = ConstantEvaluator.evaluate(
      ConstExprLowering.lower(ctx),
      env,
    );
    return result.kind === "value"
      ? ConstantEvaluator.toNumber(result.value)
      : undefined;
  }

  static lower(ctx: Parser.ExpressionContext): TConstExpr {
    return ConstExprLowering.ternary(ctx.ternaryExpression());
  }

  /**
   * Any expression-level node: what a caller holding an operand rather than
   * an `expression` lowers (a shift amount, a slice bound, a subscript)
   */
  static lowerNode(node: ParserRuleContext): TConstExpr {
    if (node instanceof Parser.ExpressionContext) {
      return ConstExprLowering.lower(node);
    }
    if (node instanceof Parser.TernaryExpressionContext) {
      return ConstExprLowering.ternary(node);
    }
    if (node instanceof Parser.PostfixExpressionContext) {
      return ConstExprLowering.postfix(node);
    }
    if (node instanceof Parser.PrimaryExpressionContext) {
      return ConstExprLowering.primary(node);
    }
    if (node instanceof Parser.LiteralContext) {
      return ConstExprLowering.literal(node);
    }
    return ConstExprLowering.chain(node);
  }

  private static ternary(ternary: Parser.TernaryExpressionContext): TConstExpr {
    const parts = ternary.orExpression();
    if (parts.length === 3) {
      return {
        kind: "ternary",
        condition: ConstExprLowering.chain(parts[0]),
        whenTrue: ConstExprLowering.chain(parts[1]),
        whenFalse: ConstExprLowering.chain(parts[2]),
      };
    }
    return ConstExprLowering.chain(parts[0]);
  }

  /**
   * One left-associative binary level, `a op b op c` as `(a op b) op c`. Every
   * level from `||` down to `*` has this shape: its operands are rule contexts
   * and its operators the terminals between them.
   */
  private static chain(ctx: ParserRuleContext): TConstExpr {
    if (ctx instanceof Parser.UnaryExpressionContext) {
      return ConstExprLowering.unary(ctx);
    }
    const children = ctx.children;
    let result = ConstExprLowering.chain(children[0] as ParserRuleContext);
    for (let i = 1; i + 1 < children.length; i += 2) {
      const op = children[i].getText();
      invariant(
        ConstExprLowering.isBinaryOp(op),
        `every operator of a binary expression level is a C-Next binary operator, not '${op}'`,
      );
      result = {
        kind: "binary",
        op,
        left: result,
        right: ConstExprLowering.chain(children[i + 1] as ParserRuleContext),
      };
    }
    return result;
  }

  private static isBinaryOp(op: string): op is TBinaryOp {
    return BINARY_OPS.has(op);
  }

  private static unary(ctx: Parser.UnaryExpressionContext): TConstExpr {
    const postfix = ctx.postfixExpression();
    if (postfix) return ConstExprLowering.postfix(postfix);
    if (ctx.BITAND()) return ConstExprLowering.other("address", ctx);
    let op: "-" | "~" | "!" = "!";
    if (ctx.MINUS()) op = "-";
    else if (ctx.BITNOT()) op = "~";
    return {
      kind: "unary",
      op,
      operand: ConstExprLowering.unary(ctx.unaryExpression()!),
    };
  }

  /**
   * A name, possibly qualified (`this.N`, `Scope.N`, `EColor.COUNT`,
   * `buf.element_count`). A subscript or a call anywhere in the chain makes it
   * something no constant contains.
   */
  private static postfix(ctx: Parser.PostfixExpressionContext): TConstExpr {
    const primary = ctx.primaryExpression();
    const ops = ctx.postfixOp();
    if (ops.length === 0) return ConstExprLowering.primary(primary);
    // ADR-058: a length property is the same for every element, so before
    // one a subscript is a step into the element, whatever its index
    const last = ops.at(-1)!.IDENTIFIER()?.getText();
    const measured = last !== undefined && LengthProperty.isLength(last);
    const blocking = ops.find(
      (op) =>
        op.DOT() === null && !(measured && ConstExprLowering.isElement(op)),
    );
    if (blocking) {
      return ConstExprLowering.other(
        blocking.LBRACKET() ? "subscript" : "call",
        ctx,
      );
    }
    const root = ConstExprLowering.root(primary);
    const head = primary.IDENTIFIER()?.getText();
    if (root === null && head === undefined) {
      return ConstExprLowering.other("member", ctx);
    }
    return {
      kind: "name",
      root,
      path: [
        ...(head === undefined ? [] : [head]),
        ...ops.map((op) =>
          op.DOT() === null ? ELEMENT_STEP : op.IDENTIFIER()!.getText(),
        ),
      ],
      at: ParserUtils.getPosition(ctx),
    };
  }

  /** `[i]`, not a bit range `[start, width]` */
  private static isElement(op: Parser.PostfixOpContext): boolean {
    return op.LBRACKET() !== null && op.expression().length === 1;
  }

  private static root(
    ctx: Parser.PrimaryExpressionContext,
  ): "this" | "global" | null {
    if (ctx.THIS()) return "this";
    if (ctx.GLOBAL()) return "global";
    return null;
  }

  private static primary(ctx: Parser.PrimaryExpressionContext): TConstExpr {
    const sizeOf = ctx.sizeofExpression();
    if (sizeOf) {
      return {
        kind: "sizeof",
        typeName: (sizeOf.type() ?? sizeOf.expression())!.getText(),
      };
    }
    const cast = ctx.castExpression();
    if (cast) {
      return {
        kind: "cast",
        typeName: cast.type().getText(),
        operand: ConstExprLowering.unary(cast.unaryExpression()),
      };
    }
    if (ctx.structInitializer() || ctx.arrayInitializer()) {
      return ConstExprLowering.other("initializer", ctx);
    }
    const literal = ctx.literal();
    if (literal) return ConstExprLowering.literal(literal);
    const expression = ctx.expression();
    if (expression) return ConstExprLowering.lower(expression);
    // A bare name, or `this` / `global` alone, which name no value
    return {
      kind: "name",
      root: ConstExprLowering.root(ctx),
      path: ctx.IDENTIFIER() ? [ctx.IDENTIFIER()!.getText()] : [],
      at: ParserUtils.getPosition(ctx),
    };
  }

  private static literal(ctx: Parser.LiteralContext): TConstExpr {
    if (ctx.TRUE() || ctx.FALSE()) {
      return {
        kind: "literal",
        digits: ctx.TRUE() ? "1" : "0",
        typeName: "bool",
      };
    }
    // ADR-044: there is no octal literal, so a leading zero is E0912 in 2.1;
    // until then it has no value, suffixed (`010u8`) or not
    if (
      (ctx.INTEGER_LITERAL() || ctx.SUFFIXED_DECIMAL()) &&
      LiteralUtils.hasLeadingZero(ctx.getText())
    ) {
      return ConstExprLowering.other("leadingZero", ctx);
    }
    if (ctx.SUFFIXED_DECIMAL() || ctx.SUFFIXED_HEX() || ctx.SUFFIXED_BINARY()) {
      const match = SUFFIXED.exec(ctx.getText());
      invariant(
        match,
        `a suffixed integer literal ends in its suffix: ${ctx.getText()}`,
      );
      return {
        kind: "literal",
        digits: BigInt(match[1]).toString(),
        typeName: match[2].toLowerCase(),
      };
    }
    if (ctx.INTEGER_LITERAL() || ctx.HEX_LITERAL() || ctx.BINARY_LITERAL()) {
      return {
        kind: "literal",
        digits: BigInt(ctx.getText()).toString(),
        typeName: null,
      };
    }
    if (ctx.FLOAT_LITERAL() || ctx.SUFFIXED_FLOAT()) {
      return ConstExprLowering.other("float", ctx);
    }
    if (ctx.STRING_LITERAL()) return ConstExprLowering.other("string", ctx);
    if (ctx.CHAR_LITERAL()) return ConstExprLowering.other("character", ctx);
    return ConstExprLowering.other("address", ctx);
  }

  private static other(what: TOtherWhat, ctx: ParserRuleContext): TConstExpr {
    return {
      kind: "other",
      what,
      spelling: ctx.getText(),
      at: ParserUtils.getPosition(ctx),
    };
  }
}

export default ConstExprLowering;
