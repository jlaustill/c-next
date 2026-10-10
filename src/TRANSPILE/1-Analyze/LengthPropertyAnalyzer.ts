/**
 * ADR-058 explicit length properties: E0867.
 *
 * #1322. Seventeen throws in `PostfixExpressionGenerator`, all reaching the
 * user as `1:0`, and ONE fixture in the whole corpus -- which was about the
 * removed `.length`, not about any of these. Seventeen rejections enforced by
 * code nothing exercised.
 *
 * ## Four of them were not diagnostics at all
 *
 * `Cannot determine .X for '<name>' - type not found in registry` appears four
 * times, once per property. The audit read them as user-facing; they are not.
 * An undeclared name is rejected by E0427 in this same pass, before codegen
 * runs -- probed: `undeclaredName.bit_length` reports E0427 at a real position.
 * What is left is a name that IS declared and whose type codegen cannot find,
 * which is the transpiler being wrong rather than the program. They are
 * `invariant()` calls now, not relocations.
 *
 * ## What the rule is
 *
 * A length property asks a question of the type it is applied to, and not every
 * type can answer: `.element_count` needs an array, `.char_count` needs a
 * string, `.bit_length` and `.byte_length` need a type whose width is known.
 * The question is asked of the chain WITHOUT the property step -- for
 * `frame.data[0].element_count` the subject is `frame.data[0]` -- which is the
 * one operand typer's chain step before the property (#1668), not a second
 * walk of this analyzer's own.
 *
 * ## Structs (#1535)
 *
 * A struct answers `.element_count` with its field count, and `.bit_length` /
 * `.byte_length` with its fields' sizes together, without C padding -- the
 * owner's ruling, ADR-058 resolved question 7. `LengthProperty` decides the
 * number, for this pass, render and 1.4's constants alike.
 */

import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import { ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import LengthProperty from "../../utils/LengthProperty";
import PROPERTY_NAMES from "../../utils/constants/PROPERTY_NAMES";
import ILengthPropertyError from "./types/ILengthPropertyError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type TExpression from "../../types/syntax/TExpression";
import type IOperandType from "../../types/IOperandType";

/** The CLI argument vector, which answers only `.element_count`. */
const ARGS_PARAMETER = "args";

class LengthPropertyListener extends CNextListener {
  private readonly found: ILengthPropertyError[] = [];

  public constructor(private readonly context: IAnalysisContext) {
    super();
  }

  public errors(): ILengthPropertyError[] {
    return this.found;
  }

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const ops = ctx.postfixOp();
    const last = ops.at(-1);
    if (last === undefined || last.DOT() === null) return;
    // Only a property's name can read one; the rest need no typing
    const name = last.IDENTIFIER()?.getText() ?? "";
    if (!PROPERTY_NAMES.has(name)) return;
    // #1976: a literal has no fields, so the name reads the property, and a
    // length property measures a declared value -- owner ruling: never a
    // literal. The typer leaves a string literal untyped, so without this the
    // chain had no subject and its C was `"Hello".char_count`.
    const chain = SyntaxLowering.expressionNode(ctx);
    if (LengthPropertyListener.rootsAtLiteral(chain)) {
      if (name === "length") {
        this.reportDeprecatedLength(last);
      } else {
        this.report(
          last,
          `.${name} is not available on a literal`,
          "A length property measures a declared value; declare one and ask it (ADR-058).",
        );
      }
      return;
    }
    // #1760 review: whether the name reads the property or a field named
    // like it is the typer's, on the step (ADR-058: a field is a field)
    const step = OperandTyper.chainOf(chain, this.context).steps.at(-1);
    const property = step?.property ?? null;
    if (property === null) return;

    if (LengthPropertyListener.subjectIsArgs(ctx, ops)) {
      if (property !== "element_count") {
        this.report(
          last,
          `.${property} is not available on 'args'`,
          "Use .element_count for the argument count.",
        );
      }
      return;
    }

    // The subject is the chain WITHOUT the property step: the typer's last
    // step is the property, and what it applies to is that step's `before`.
    // A scope variable may be called `length` (#212): `this.length` binds
    // the member at the chain's root, so there is no property step and no
    // subject, and no property rule applies.
    const subject = step?.before ?? null;
    if (subject === null) return; // unresolved -- another diagnostic's to report

    this.check(last, property, subject);
  };

  private check(
    at: Parser.PostfixOpContext,
    property: string,
    typed: IOperandType,
  ): void {
    const subject = LengthPropertyListener.spelling(typed);
    const dimensions = typed.dimensions.length;
    const element = typed.typeName ?? "";
    // `string<N>` and the unsized `const string`, whose capacity is inferred.
    const isString = OperandTyper.isString(typed);

    // ADR-058 deprecated `.length` outright: it named a different thing on a
    // string, an array and a scalar, and the four shape properties exist to
    // say which was meant. Rejected wherever it appears, so there is no
    // subject to judge.
    if (property === "length") {
      this.reportDeprecatedLength(at);
      return;
    }

    // ADR-045's storage properties describe a string's buffer: `.capacity` is
    // the declared `N`, `.size` that plus the null terminator. Nothing else
    // has a buffer.
    if (property === "capacity" || property === "size") {
      if (!isString) {
        this.report(
          at,
          `.${property} is only available on strings, not on '${subject}'`,
          "Use .element_count for an array's length, or .byte_length for a value's size in bytes (ADR-045).",
          "E0887",
        );
      }
      return;
    }

    // #1535: a struct answers all three -- its field count, and its fields'
    // sizes together, without C padding (ADR-058 resolved question 7)
    const lookup = (cName: string) => this.context.program.symbolByCName(cName);
    const struct = LengthProperty.struct(element, lookup);

    if (property === "element_count") {
      if (dimensions === 0 && struct === undefined) {
        this.report(
          at,
          `.element_count is only available on arrays, not on '${subject}'`,
          "A scalar has one value; use .bit_length or .byte_length for its width.",
        );
      }
      return;
    }

    if (property === "char_count") {
      if (!isString) {
        this.report(
          at,
          `.char_count is only available on strings, not on '${subject}'`,
          "Use .element_count for an array's length, or .bit_length for a scalar's width.",
        );
      }
      return;
    }

    // `.bit_length` and `.byte_length` need a width. A string, a struct whose
    // fields all have one, and an array of either have one.
    if (isString) return;
    if (struct !== undefined) {
      if (LengthProperty.structBits(struct, lookup) === null) {
        this.report(
          at,
          `Cannot determine .${property} for type '${subject}'`,
          "A struct's length is its fields' sizes together; a field from a C header has no size C-Next fixes.",
        );
      }
      return;
    }
    // An enum and a bitmap both have a fixed width; only a type nothing sizes
    // -- a struct, or a name this pass cannot see -- has none.
    if (
      TYPE_WIDTH[element] === undefined &&
      typed.enumTypeName === null &&
      typed.bitmapTypeName === null
    ) {
      this.report(
        at,
        `Cannot determine .${property} for type '${subject}'`,
        "A length in bits is only defined for a primitive, a string, or an array of them.",
      );
    }
  }

  private reportDeprecatedLength(at: Parser.PostfixOpContext): void {
    this.report(
      at,
      `'.length' is deprecated`,
      "Use .char_count for a string's length, .element_count for an array's, or .bit_length / .byte_length for a width (ADR-058).",
      "E0886",
    );
  }

  /** `"Hello"`, `(true)`, `"Hello"[0]`: a chain whose root is a literal */
  private static rootsAtLiteral(chain: TExpression): boolean {
    let root = chain.kind === "postfix" ? chain.primary : chain;
    while (root.kind === "parenthesized") root = root.expression;
    return root.kind === "literal";
  }

  /** `args` is a parameter, not a declaration this pass records. */
  private static subjectIsArgs(
    ctx: Parser.PostfixExpressionContext,
    ops: readonly Parser.PostfixOpContext[],
  ): boolean {
    return (
      ops.length === 1 &&
      ctx.primaryExpression()?.IDENTIFIER()?.getText() === ARGS_PARAMETER
    );
  }

  /** A subject as a message names it: `u32`, `u8[4]` */
  private static spelling(typed: IOperandType): string {
    const dimensions = typed.dimensions.map((d) => `[${d}]`).join("");
    return `${typed.typeName ?? typed.category}${dimensions}`;
  }

  /**
   * #1322: the code is a parameter now. This file owns three rules -- a shape
   * property used where the subject has none (E0867), the deprecated `.length`
   * (E0886), and a storage property off a string (E0887) -- because all three
   * need the same subject, resolved by the same walk. Defaulting keeps the
   * E0867 call sites reading as they did.
   */
  private report(
    at: Parser.PostfixOpContext,
    message: string,
    helpText: string,
    code = "E0867",
  ): void {
    const { line, column } = ParserUtils.getPosition(at);
    this.found.push({ code, line, column, message, helpText });
  }
}

class LengthPropertyAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(tree: Parser.ProgramContext): ILengthPropertyError[] {
    const listener = new LengthPropertyListener(this.context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default LengthPropertyAnalyzer;
