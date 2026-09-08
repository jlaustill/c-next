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
 * `frame.data[0].element_count` the subject is `frame.data[0]` -- which is why
 * `OperandTypeResolver` grew a bounded walk rather than this growing a second
 * one.
 *
 * ## A divergence this does NOT fix
 *
 * ADR-058 is `Implemented` and its property table gives structs `.bit_length`,
 * `.byte_length` and `.element_count`, with a worked `SensorReading` example.
 * The transpiler rejects all three. That is a real spec/implementation
 * divergence, and it is deliberately preserved here rather than closed: closing
 * it means deciding what `.byte_length` on a struct MEANS, and the ADR says
 * "with padding" without saying whose padding -- an ABI question the ADR does
 * not answer. Relocating faithfully keeps the behavior identical and leaves the
 * decision where it belongs.
 */

import { ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";
import CodeGenState from "../../transpiler/state/CodeGenState";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import PROPERTY_NAMES from "./helpers/PROPERTY_NAMES";
import ILengthPropertyError from "./types/ILengthPropertyError";
import OperandTypeResolver from "./OperandTypeResolver";
import ScopeFrameResolver from "./ScopeFrameResolver";

/** The CLI argument vector, which answers only `.element_count`. */
const ARGS_PARAMETER = "args";

class LengthPropertyListener extends CNextListener {
  private readonly found: ILengthPropertyError[] = [];
  private readonly types: OperandTypeResolver;

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
    this.types = new OperandTypeResolver(scopes);
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
    const property = last.IDENTIFIER()?.getText();
    if (property === undefined || !PROPERTY_NAMES.has(property)) return;

    const frame = this.scopes.frameFor(ctx);

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

    // A property name is only a property when it names nothing else. A scope
    // variable may be called `length` (#212), and `this.length` then reads it
    // -- so if the WHOLE chain resolves to a declared type, the last step was
    // a member access and no property rule applies. Asked for every name in
    // the set, not just `length`: `capacity` is as ordinary an identifier.
    if (this.types.typeOfPostfixPrefix(ctx, frame, 0) !== null) return;

    // The subject is the chain WITHOUT the property step.
    const subject = this.types.typeOfPostfixPrefix(ctx, frame, 1);
    if (subject === null) return; // unresolved -- another diagnostic's to report

    this.check(last, property, subject);
  };

  private check(
    at: Parser.PostfixOpContext,
    property: string,
    subject: string,
  ): void {
    const dimensions = LengthPropertyListener.dimensionCount(subject);
    const element = LengthPropertyListener.elementName(subject);
    // `string<N>` and the unsized `const string`, whose capacity is inferred.
    const isString = element === "string" || /^string\s*</.test(element);

    // ADR-058 deprecated `.length` outright: it named a different thing on a
    // string, an array and a scalar, and the four shape properties exist to
    // say which was meant. Rejected wherever it appears, so there is no
    // subject to judge.
    if (property === "length") {
      this.report(
        at,
        `'.length' is deprecated`,
        "Use .char_count for a string's length, .element_count for an array's, or .bit_length / .byte_length for a width (ADR-058).",
        "E0886",
      );
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

    if (property === "element_count") {
      if (dimensions === 0) {
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

    // `.bit_length` and `.byte_length` need a width. A string and an array of
    // sized elements both have one; a struct does not -- see the divergence
    // noted at the top of this file.
    if (isString) return;
    // An enum and a bitmap both have a fixed width; only a type nothing sizes
    // -- a struct, or a name this pass cannot see -- has none.
    if (
      TYPE_WIDTH[element] === undefined &&
      !CodeGenState.isKnownEnum(element) &&
      !CodeGenState.isKnownBitmap(element)
    ) {
      this.report(
        at,
        `Cannot determine .${property} for type '${subject}'`,
        "A length in bits is only defined for a primitive, a string, or an array of them.",
      );
    }
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

  /** How many array dimensions a declared type text still carries. */
  private static dimensionCount(typeText: string): number {
    return (typeText.match(/\[/g) ?? []).length;
  }

  /** The element name of a declared type text: `u8[4]` -> `u8`. */
  private static elementName(typeText: string): string {
    const open = typeText.indexOf("[");
    return (open === -1 ? typeText : typeText.slice(0, open)).trim();
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
  public analyze(tree: Parser.ProgramContext): ILengthPropertyError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new LengthPropertyListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default LengthPropertyAnalyzer;
