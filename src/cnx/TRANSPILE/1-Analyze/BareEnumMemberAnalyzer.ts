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

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import type ISourcePosition from "../../utils/types/ISourcePosition";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionChildren from "../../utils/ExpressionChildren";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import OperandTyper from "../../utils/OperandTyper";
import EnumMemberSuggestion from "./helpers/EnumMemberSuggestion";
import ValuePositions from "./helpers/ValuePositions";
import IBareEnumMemberError from "./types/IBareEnumMemberError";
import UndeclaredValueAnalyzer from "./UndeclaredValueAnalyzer";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IValuePosition from "../../types/IValuePosition";

/** The enum a position names, or null when it names none */
type TExpected = string | null;

type TIdentifier = Extract<TExpression, { kind: "identifier" }>;

/**
 * Top down over 1.2's syntax (#1991), the enum each value's position names:
 * a declaration or assignment of an enum type, a return from a function of
 * one, a field of one. A comparison, a subscript, a call argument and a
 * `for` clause name none; an array initializer, a ternary and an operator
 * hand their own position on to what they hold.
 */
class ExpectedEnums {
  private readonly expected = new Map<TExpression, TExpected>();
  private readonly forClauses = new Set<object>();

  private constructor(
    private readonly context: IAnalysisContext,
    private readonly positions: ReadonlyMap<TExpression, IValuePosition>,
  ) {}

  static of(
    program: IProgramSyntax,
    context: IAnalysisContext,
    positions: ReadonlyMap<TExpression, IValuePosition>,
  ): ReadonlyMap<TExpression, TExpected> {
    const walk = new ExpectedEnums(context, positions);
    for (const member of program.declarations) {
      walk.declaration(member.declaration);
    }
    return walk.expected;
  }

  private declaration(declaration: TDeclarationSyntax): void {
    if (declaration.kind === "scope") {
      for (const member of declaration.members) {
        this.declaration(member.declaration);
      }
      return;
    }
    if (declaration.kind === "variableDeclaration") {
      this.variable(declaration);
      return;
    }
    if (declaration.kind !== "function") return;
    const statements = StatementNodes.in(declaration);
    for (const statement of statements) {
      if (statement.kind !== "for") continue;
      if (statement.init) this.forClauses.add(statement.init);
      if (statement.update) this.forClauses.add(statement.update);
    }
    for (const statement of statements) {
      if (statement.kind === "variableDeclaration") {
        if (!this.forClauses.has(statement)) this.variable(statement);
      } else if (statement.kind === "return" && statement.value) {
        this.place(
          statement.value,
          this.enumOfWritten(declaration.returnType, declaration.span),
        );
      }
    }
    for (const site of StatementNodes.assignments(declaration)) {
      if (this.forClauses.has(site)) continue;
      this.place(site.value, this.targetEnum(site.target));
    }
  }

  private variable(declaration: IVariableDeclarationSyntax): void {
    if (!declaration.initializer) return;
    this.place(
      declaration.initializer,
      this.enumOfWritten(declaration.type, declaration.span),
    );
  }

  private place(expr: TExpression, expected: TExpected): void {
    this.expected.set(expr, expected);
    switch (expr.kind) {
      case "postfix":
        this.place(expr.primary, expected);
        for (const op of expr.ops) {
          if (op.kind === "subscript") {
            for (const index of op.indexes) this.place(index, null);
          } else if (op.kind === "call") {
            for (const argument of op.arguments) this.place(argument, null);
          }
        }
        return;
      case "binary": {
        const compares =
          expr.level === "equality" || expr.level === "relational";
        for (const operand of expr.operands) {
          this.place(operand, compares ? null : expected);
        }
        return;
      }
      case "structInitializer":
        for (const field of expr.fields) {
          this.place(field.value, this.fieldEnum(field.value));
        }
        return;
      default:
        for (const child of ExpressionChildren.of(expr)) {
          this.place(child, expected);
        }
    }
  }

  private fieldEnum(value: TExpression): TExpected {
    const field = ValuePositions.at(this.positions, value).typeText;
    return field !== null && this.context.symbols.knownEnums.has(field)
      ? field
      : null;
  }

  /** A bit range's target type names no enum: it writes bits */
  private targetEnum(target: TExpression): TExpected {
    return (
      OperandTyper.typeOfTarget(target, this.context)?.enumTypeName ?? null
    );
  }

  private enumOfWritten(type: TTypeSyntax, at: ISourcePosition): TExpected {
    return (
      OperandTyper.typeOfWritten(type, this.context, at)?.enumTypeName ?? null
    );
  }
}

class BareEnumMemberAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  /** #1991: reads 1.2's syntax, not the parse tree */
  public analyze(
    program: IProgramSyntax,
    positions: ReadonlyMap<TExpression, IValuePosition>,
  ): IBareEnumMemberError[] {
    const expected = ExpectedEnums.of(program, this.context, positions);
    const expressions = program.declarations
      .flatMap((member) => DeclarationParts.of(member.declaration))
      .flatMap(ExpressionNodes.of);
    // A chain's head and an assignment's target name a value; they are not one.
    const notValues = new Set<TExpression>();
    for (const expr of expressions) {
      if (expr.kind === "postfix") notValues.add(expr.primary);
    }
    for (const member of program.declarations) {
      for (const site of StatementNodes.assignments(member.declaration)) {
        notValues.add(site.target);
      }
    }
    const found: IBareEnumMemberError[] = [];
    for (const expr of expressions) {
      if (expr.kind !== "identifier" || notValues.has(expr)) continue;
      const error = this.check(expr, expected.get(expr) ?? null);
      if (error !== null) found.push(error);
    }
    return found.sort((a, b) => a.line - b.line || a.column - b.column);
  }

  private check(
    identifier: TIdentifier,
    expected: TExpected,
  ): IBareEnumMemberError | null {
    const symbols = this.context.symbols;
    const name = identifier.name;
    const declaring = EnumMemberSuggestion.enumsDeclaring(name, symbols);
    if (declaring.length === 0) return null;
    const scopePath = OperandTyper.scopePathAt(identifier.span, this.context);
    if (
      UndeclaredValueAnalyzer.isDeclaredValue(
        name,
        identifier.span,
        scopePath,
        this.context,
      )
    ) {
      return null;
    }
    if (expected !== null && symbols.enumMembers.get(expected)?.has(name)) {
      return null;
    }
    return {
      code: "E0424",
      line: identifier.span.line,
      column: identifier.span.column,
      message: EnumMemberSuggestion.message(name, declaring),
      helpText:
        "A bare enum member is accepted only where its enum is already named -- a declaration or assignment of that type, a return from a function of that type, a field of that type. Elsewhere, qualify it (ADR-017).",
    };
  }
}

export default BareEnumMemberAnalyzer;
