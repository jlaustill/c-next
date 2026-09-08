/**
 * ADR-017 bare enum members: E0424.
 *
 * #1322. Four throws in `output/` -- two arms in `CodeGenerator`, one in
 * `SwitchGenerator` for a case label, one in `ControlFlowGenerator` for a
 * return -- decided whether an enum member written BARE (`RED` rather than
 * `Color.RED`) stands where something names its enum. Two of them reported
 * `1:0`; the other two computed a position and spent it on the message.
 *
 * ## The rule is about POSITION, and codegen decided it by control flow
 *
 * Codegen carried an `expectedType` set by whichever generator was running --
 * a declaration's type, an assignment target's type, a function's return type,
 * a struct field's type, an array's element type -- cleared by a comparison,
 * and suppressed inside a call's arguments. A bare member resolved when that
 * type was an enum declaring it, and was rejected otherwise. The same decision
 * is made here from the parse tree: walk up from the identifier to the nearest
 * node that ESTABLISHES a type, and stop early at the nodes that cleared or
 * suppressed one. The table is the one CLAUDE.md records under "Enum
 * `expectedType` Contexts", reproduced rather than redrawn:
 *
 *   establishes   variable initializer, plain and compound assignment, return,
 *                 struct-initializer field, array-initializer element,
 *                 ternary arm (inherits)
 *   clears        `=`/`!=`/`<`/`>`/`<=`/`>=` operands, a subscript, an array
 *                 dimension, a `for` header's declaration or update
 *   suppresses    a call's arguments
 *
 * The `for` header and a `forUpdate` are listed as codegen had them -- those
 * generators never set an expected type, so `for (Color c <- RED; …)` was
 * rejected. Reproduced, not closed: closing it is a behavior change on a
 * position the corpus never exercises.
 *
 * ## One hole closed, probed
 *
 * `Color c <- YELLOW` with `YELLOW` declared only by `Status` resolved nothing
 * (the expected enum has no such member) and codegen then emitted the bare
 * name into C, exit 0. Here it is E0424 with the enums that do declare it.
 *
 * ## What "bare" means
 *
 * A name is a bare enum member only when nothing else declares it: a local,
 * parameter, const, function or register of the same spelling wins, exactly
 * as codegen resolved a declared name before ever asking the enums. That
 * predicate is E0427's, shared rather than restated.
 */

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../transpiler/state/CodeGenState";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import EnumMemberSuggestion from "./helpers/EnumMemberSuggestion";
import EnumValueResolver from "./EnumValueResolver";
import IBareEnumMemberError from "./types/IBareEnumMemberError";
import IScopeFrame from "./types/IScopeFrame";
import OperandTypeResolver from "./OperandTypeResolver";
import ScopeFrameResolver from "./ScopeFrameResolver";
import UndeclaredValueAnalyzer from "./UndeclaredValueAnalyzer";
import TypeText from "./helpers/TypeText";

/** A type name as written at the position that establishes it, or null. */
type TExpected = string | null;

class BareEnumMemberListener extends CNextListener {
  private readonly found: IBareEnumMemberError[] = [];
  private readonly types: OperandTypeResolver;
  private readonly values: EnumValueResolver;

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
    this.types = new OperandTypeResolver(scopes);
    this.values = new EnumValueResolver(scopes);
  }

  public errors(): IBareEnumMemberError[] {
    return this.found;
  }

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const symbols = CodeGenState.symbols;
    const primary = ctx.primaryExpression();
    const name = primary?.IDENTIFIER()?.getText();
    if (!symbols || !primary || name === undefined) return;
    // `name(...)` is a call, and `name.x` / `name[i]` is a chain rooted in a
    // declared value; a bare member has no operations.
    if (ctx.postfixOp().length > 0) return;

    const declaring = EnumMemberSuggestion.enumsDeclaring(name, symbols);
    if (declaring.length === 0) return;

    const frame = this.scopes.frameFor(ctx);
    if (
      UndeclaredValueAnalyzer.isDeclaredValue(
        name,
        frame,
        frame.scopePath,
        this.scopes,
      )
    ) {
      return;
    }

    const expected = this.expectedEnum(ctx, frame);
    if (expected !== null && symbols.enumMembers.get(expected)?.has(name)) {
      return;
    }
    const { line, column } = ParserUtils.getPosition(primary);
    this.found.push({
      code: "E0424",
      line,
      column,
      message: EnumMemberSuggestion.message(name, declaring),
      helpText:
        "A bare enum member is accepted only where its enum is already named -- a declaration or assignment of that type, a return from a function of that type, a field of that type. Elsewhere, qualify it (ADR-017).",
    });
  };

  /**
   * The enum a bare member at `node` is resolved against, or null when the
   * position names none. Walks up to the nearest establishing node, stopping
   * early at the nodes that clear or suppress the expected type.
   */
  private expectedEnum(node: ParserRuleContext, frame: IScopeFrame): TExpected {
    const text = this.expectedTypeText(node, frame);
    return text === null ? null : this.values.enumTypeNameFor(text, frame);
  }

  /**
   * The declared type text the position at `node` is generated under -- the
   * codegen `expectedType` -- or null. Type texts are as WRITTEN (`Color`,
   * `this.Mode`, `Lib.State`); the caller resolves them.
   */
  private expectedTypeText(
    node: ParserRuleContext,
    frame: IScopeFrame,
  ): TExpected {
    let cursor: ParserRuleContext | null = node.parent;
    while (cursor) {
      const answer = this.establishedBy(cursor, frame);
      if (answer !== undefined) return answer;
      cursor = cursor.parent;
    }
    return null;
  }

  /**
   * What `cursor` says about the expected type of its child, or undefined when
   * it says nothing and the walk continues upward.
   *
   * Deliberately does NOT take the child it is answering about. Every arm here
   * establishes or clears a type for the whole node -- a comparison clears for
   * both operands, an array element establishes for all of them -- so no arm
   * has ever needed to know WHICH child asked. The parameter was threaded
   * anyway and silenced with a `void`, which is a signal turned off rather
   * than acted on. If an arm ever does need it (an argument's index would),
   * thread it then, to that arm.
   */
  private establishedBy(
    cursor: ParserRuleContext,
    frame: IScopeFrame,
  ): TExpected | undefined {
    // --- clears and suppressions ------------------------------------------
    // A postfix operation: a subscript index (`size_t`) or a call's argument
    // list (suppressed, #872). One test covers both -- an argument list is
    // always inside the `(...)` op, so a separate check for it never ran.
    if (cursor instanceof Parser.PostfixOpContext) return null;
    if (
      cursor instanceof Parser.ArrayDimensionContext ||
      cursor instanceof Parser.ArrayTypeDimensionContext
    ) {
      return null;
    }
    if (
      (cursor instanceof Parser.EqualityExpressionContext &&
        cursor.relationalExpression().length > 1) ||
      (cursor instanceof Parser.RelationalExpressionContext &&
        cursor.bitwiseOrExpression().length > 1)
    ) {
      return null;
    }
    if (
      cursor instanceof Parser.ForVarDeclContext ||
      cursor instanceof Parser.ForAssignmentContext ||
      cursor instanceof Parser.ForUpdateContext
    ) {
      return null;
    }

    // --- establishing nodes -----------------------------------------------------
    if (cursor instanceof Parser.VariableDeclarationContext) {
      return BareEnumMemberListener.declaredTypeText(cursor.type());
    }
    if (cursor instanceof Parser.AssignmentStatementContext) {
      return this.assignmentTargetType(cursor.assignmentTarget(), frame);
    }
    if (cursor instanceof Parser.ReturnStatementContext) {
      return BareEnumMemberListener.enclosingFunctionType(cursor);
    }
    if (cursor instanceof Parser.FieldInitializerContext) {
      return this.fieldType(cursor, frame);
    }
    if (cursor instanceof Parser.ArrayInitializerContext) {
      // An element is generated under the array's ELEMENT type, which is the
      // declared type with its dimensions removed -- what the walk above this
      // node answers, since `declaredTypeText` strips them.
      return this.expectedTypeText(cursor, frame);
    }
    if (cursor instanceof Parser.StructInitializerContext) {
      // Reached from a field: the struct's type, explicit or inherited.
      return this.structTypeOf(cursor, frame);
    }
    if (
      cursor instanceof Parser.StatementContext ||
      cursor instanceof Parser.BlockContext ||
      cursor instanceof Parser.FunctionDeclarationContext ||
      cursor instanceof Parser.ScopeDeclarationContext ||
      cursor instanceof Parser.ProgramContext
    ) {
      return null;
    }
    return undefined;
  }

  /** The type of an assignment's target, spelled as declared, or null. */
  private assignmentTargetType(
    target: Parser.AssignmentTargetContext,
    frame: IScopeFrame,
  ): TExpected {
    // A slice or bit-range write (`arr[off, len] <- v`) has no element
    // expected type; codegen's resolver answered null for it.
    if (target.postfixTargetOp().some((op) => op.expression().length === 2)) {
      return null;
    }
    return this.types.typeOfAssignmentTarget(target, frame);
  }

  /** The type of the field a `name: value` initializer sets, or null. */
  private fieldType(
    field: Parser.FieldInitializerContext,
    frame: IScopeFrame,
  ): TExpected {
    const initializer = field.parent?.parent;
    if (!(initializer instanceof Parser.StructInitializerContext)) return null;
    const structText = this.structTypeOf(initializer, frame);
    if (structText === null) return null;
    const fieldName = field.IDENTIFIER().getText();
    for (const spelling of BareEnumMemberListener.structSpellings(
      structText,
      frame,
    )) {
      const type = CodeGenState.getStructFieldType(spelling, fieldName);
      if (type !== undefined) return type;
    }
    return null;
  }

  /**
   * The spellings a struct type text is looked up under: `this.X` is the
   * enclosing scope's `X`, `global.X` is file scope, a bare `X` inside a scope
   * is tried as the scope's before file scope (ADR-057's order).
   */
  private static structSpellings(text: string, frame: IScopeFrame): string[] {
    const here = frame.scopePath;
    if (text.startsWith("this.")) {
      return here === "" ? [] : [`${here}.${text.slice(5)}`];
    }
    if (text.startsWith("global.")) return [text.slice(7)];
    if (here !== "" && !text.includes(".")) return [`${here}.${text}`, text];
    return [text];
  }

  /**
   * The struct type an initializer builds, which is always the one its
   * position declares -- #1322 removed the written-type alternative, so there
   * is no second source to prefer over it.
   */
  private structTypeOf(
    initializer: Parser.StructInitializerContext,
    frame: IScopeFrame,
  ): TExpected {
    return this.expectedTypeText(initializer, frame);
  }

  /** A declaration's type as written, without its array dimensions. */
  private static declaredTypeText(type: Parser.TypeContext): string {
    return TypeText.withoutDimensions(type.getText());
  }

  private static enclosingFunctionType(node: ParserRuleContext): TExpected {
    let cursor: ParserRuleContext | null = node.parent;
    while (cursor) {
      if (cursor instanceof Parser.FunctionDeclarationContext) {
        return cursor.type().getText();
      }
      cursor = cursor.parent;
    }
    return null;
  }
}

class BareEnumMemberAnalyzer {
  public analyze(tree: Parser.ProgramContext): IBareEnumMemberError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new BareEnumMemberListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default BareEnumMemberAnalyzer;
