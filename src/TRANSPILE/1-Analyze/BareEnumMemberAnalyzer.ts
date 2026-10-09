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

import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import StructInitializerType from "./helpers/StructInitializerType";
import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import EnumMemberSuggestion from "./helpers/EnumMemberSuggestion";
import IBareEnumMemberError from "./types/IBareEnumMemberError";
import UndeclaredValueAnalyzer from "./UndeclaredValueAnalyzer";
import type IAnalysisContext from "./types/IAnalysisContext";

/** A type name as written at the position that establishes it, or null. */
type TExpected = string | null;

class BareEnumMemberListener extends CNextListener {
  private readonly found: IBareEnumMemberError[] = [];

  public constructor(private readonly context: IAnalysisContext) {
    super();
  }

  public errors(): IBareEnumMemberError[] {
    return this.found;
  }

  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const symbols = this.context.symbols;
    const primary = ctx.primaryExpression();
    const name = primary?.IDENTIFIER()?.getText();
    if (!primary || name === undefined) return;
    // `name(...)` is a call, and `name.x` / `name[i]` is a chain rooted in a
    // declared value; a bare member has no operations.
    if (ctx.postfixOp().length > 0) return;

    const declaring = EnumMemberSuggestion.enumsDeclaring(name, symbols);
    if (declaring.length === 0) return;

    const scopePath = OperandTyper.scopePathAt(
      ParserUtils.getPosition(ctx),
      this.context,
    );
    if (
      UndeclaredValueAnalyzer.isDeclaredValue(
        name,
        ctx,
        scopePath,
        this.context,
      )
    ) {
      return;
    }

    const expected = this.expectedEnum(ctx, scopePath);
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
  private expectedEnum(node: ParserRuleContext, scopePath: string): TExpected {
    let cursor: ParserRuleContext | null = node.parent;
    while (cursor) {
      const answer = this.establishedBy(cursor, scopePath);
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
    scopePath: string,
  ): TExpected | undefined {
    if (BareEnumMemberListener.clearsExpected(cursor)) return null;

    // --- establishing nodes -----------------------------------------------------
    // #1668 review: each answers with the enum the typer gives the position's
    // type. The positions used to answer with the type as WRITTEN, qualified
    // here by hand -- `this.`, `global.`, then the enclosing scope -- beside
    // the typer's `TypeBinding`, which every other rule reads for the same
    // spelling.
    if (cursor instanceof Parser.VariableDeclarationContext) {
      return this.enumOfWritten(cursor.type(), cursor);
    }
    if (cursor instanceof Parser.AssignmentStatementContext) {
      return this.assignmentTargetEnum(cursor.assignmentTarget());
    }
    if (cursor instanceof Parser.ReturnStatementContext) {
      const fn = BareEnumMemberListener.enclosingFunction(cursor);
      return fn === null ? null : this.enumOfWritten(fn.type(), fn);
    }
    if (cursor instanceof Parser.FieldInitializerContext) {
      // #1668: the one field typing struct initializers share; a field's
      // type is recorded by its C name
      const field = StructInitializerType.fieldType(cursor, this.context);
      return field !== null && this.context.symbols.knownEnums.has(field)
        ? field
        : null;
    }
    if (cursor instanceof Parser.ArrayInitializerContext) {
      // An element is generated under the array's ELEMENT type: the enum the
      // walk above this node answers, which an array of it names too.
      return this.expectedEnum(cursor, scopePath);
    }
    if (cursor instanceof Parser.StructInitializerContext) {
      // Reached from a field: the struct's type, explicit or inherited.
      return this.structTypeOf(cursor, scopePath);
    }
    return undefined;
  }

  /**
   * Whether `cursor` clears the expected type of everything under it. Every
   * context class extends the rule context directly, so none of these is also
   * an establishing node, and which is tested first cannot matter.
   */
  private static clearsExpected(cursor: ParserRuleContext): boolean {
    return (
      // A postfix operation: a subscript index (`size_t`) or a call's
      // argument list (suppressed, #872). One test covers both -- an argument
      // list is always inside the `(...)` op, so a separate check never ran.
      cursor instanceof Parser.PostfixOpContext ||
      cursor instanceof Parser.ArrayDimensionContext ||
      cursor instanceof Parser.ArrayTypeDimensionContext ||
      BareEnumMemberListener.isComparison(cursor) ||
      cursor instanceof Parser.ForVarDeclContext ||
      cursor instanceof Parser.ForAssignmentContext ||
      cursor instanceof Parser.ForUpdateContext ||
      // A boundary no expected type crosses
      cursor instanceof Parser.StatementContext ||
      cursor instanceof Parser.BlockContext ||
      cursor instanceof Parser.FunctionDeclarationContext ||
      cursor instanceof Parser.ScopeDeclarationContext ||
      cursor instanceof Parser.ProgramContext
    );
  }

  /** An equality or relational level that compares, rather than passes one through */
  private static isComparison(cursor: ParserRuleContext): boolean {
    return (
      (cursor instanceof Parser.EqualityExpressionContext &&
        cursor.relationalExpression().length > 1) ||
      (cursor instanceof Parser.RelationalExpressionContext &&
        cursor.bitwiseOrExpression().length > 1)
    );
  }

  /** The enum an assignment's target holds, or null. */
  private assignmentTargetEnum(
    target: Parser.AssignmentTargetContext,
  ): TExpected {
    // A slice or bit-range write (`arr[off, len] <- v`) has no element
    // expected type; codegen's resolver answered null for it.
    if (target.postfixTargetOp().some((op) => op.expression().length === 2)) {
      return null;
    }
    return (
      OperandTyper.typeOfTarget(
        SyntaxLowering.assignmentTarget(target),
        this.context,
      )?.enumTypeName ?? null
    );
  }

  /** The enum a written type names, as the typer binds it where it is written */
  private enumOfWritten(
    type: Parser.TypeContext,
    at: ParserRuleContext,
  ): TExpected {
    return (
      OperandTyper.typeOfWritten(
        SyntaxLowering.type(type),
        this.context,
        ParserUtils.getPosition(at),
      )?.enumTypeName ?? null
    );
  }

  /**
   * The struct type an initializer builds, which is always the one its
   * position declares -- #1322 removed the written-type alternative, so there
   * is no second source to prefer over it.
   */
  private structTypeOf(
    initializer: Parser.StructInitializerContext,
    scopePath: string,
  ): TExpected {
    return this.expectedEnum(initializer, scopePath);
  }

  private static enclosingFunction(
    node: ParserRuleContext,
  ): Parser.FunctionDeclarationContext | null {
    let cursor: ParserRuleContext | null = node.parent;
    while (cursor) {
      if (cursor instanceof Parser.FunctionDeclarationContext) return cursor;
      cursor = cursor.parent;
    }
    return null;
  }
}

class BareEnumMemberAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(tree: Parser.ProgramContext): IBareEnumMemberError[] {
    const listener = new BareEnumMemberListener(this.context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default BareEnumMemberAnalyzer;
