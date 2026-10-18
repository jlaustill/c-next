import ExpressionShape from "../../utils/ExpressionShape";
import VariableDeclarations from "../../utils/VariableDeclarations";
import StringUtils from "../../utils/StringUtils";
import OperandTyper from "../../utils/OperandTyper";
import IStringDeclarationError from "./types/IStringDeclarationError";
import ConstantExpression from "./helpers/ConstantExpression";
import type IAnalysisContext from "./types/IAnalysisContext";
import type ISourceSpan from "../../types/ISourceSpan";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import type TExpression from "../../types/syntax/TExpression";
/**
 * ADR-045 string declarations: whether an initializer fits, E0864-E0865.
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
 * #1991: those capacity rules and the file-scope form are syntax, so 1.2's
 * `StringForm` reports them (E0862/E0863). This pass reads 1.2's declarations
 * and asks only whether an initializer fits (E0864/E0865). Both read
 * `VariableDeclarations.ruled` (#2073), so they judge the same declarations.
 */

/** What a string-valued expression can hold, or null if it is not one. */
interface ISubstring {
  readonly start: number | null;
  readonly length: number | null;
  readonly sourceCapacity: number;
}

interface IStringSource {
  readonly capacity: number;
  readonly isLiteral: boolean;
}

/** The declarations 1.2 returned, each string's initializer checked against its capacity */
class StringDeclarationCheck {
  private readonly found: IStringDeclarationError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IStringDeclarationError[] {
    return this.found;
  }

  public variable(declaration: IVariableDeclarationSyntax): void {
    const type = declaration.type;
    // An inferred const capacity always fits; a string array's elements are
    // checked where they are written
    if (type.kind !== "string" || type.capacity === null) return;
    const initializer = declaration.initializer;
    if (initializer === null) return;
    this.checkFit(
      declaration.span,
      initializer,
      Number.parseInt(type.capacity, 10),
    );
  }

  private checkFit(
    at: ISourceSpan,
    expression: TExpression,
    capacity: number,
  ): void {
    const substring = this.substringOf(expression, at);
    if (substring !== null) {
      this.checkSubstring(expression, substring, capacity);
      return;
    }
    const concat = this.concatOf(expression, at);
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
    const source = this.stringSourceOf(expression, at);
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
    expression: TExpression,
    substring: ISubstring,
    capacity: number,
  ): void {
    const start = substring.start;
    const length = substring.length;
    const sourceCapacity = substring.sourceCapacity;
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

  private stringSourceOf(
    expression: TExpression,
    at: ISourceSpan,
  ): IStringSource | null {
    if (
      expression.kind === "literal" &&
      ExpressionShape.isStringLiteral(expression)
    ) {
      return {
        capacity: StringUtils.literalLength(expression.text),
        isLiteral: true,
      };
    }
    const capacity = this.capacityOfOperand(expression, at);
    return capacity === null ? null : { capacity, isLiteral: false };
  }

  private capacityOfName(name: string, at: ISourceSpan): number | null {
    const t = OperandTyper.typeOfName(name, at, this.context);
    return t !== null && t.dimensions.length === 0 ? t.stringCapacity : null;
  }

  private concatOf(
    expression: TExpression,
    at: ISourceSpan,
  ): [number, number] | null {
    const operands = ExpressionShape.additionOperands(expression);
    if (operands === null) return null;
    const left = this.capacityOfConcatOperand(operands[0], at);
    const right = this.capacityOfConcatOperand(operands[1], at);
    return left !== null && right !== null ? [left, right] : null;
  }

  private capacityOfConcatOperand(
    operand: TExpression,
    at: ISourceSpan,
  ): number | null {
    if (
      operand.kind === "literal" &&
      ExpressionShape.isStringLiteral(operand)
    ) {
      return StringUtils.literalLength(operand.text);
    }
    return this.capacityOfOperand(operand, at);
  }

  /** A bare name's capacity; anything else has none this check can read */
  private capacityOfOperand(
    operand: TExpression,
    at: ISourceSpan,
  ): number | null {
    const name = ExpressionShape.simpleIdentifier(operand);
    return name === null ? null : this.capacityOfName(name, at);
  }

  private substringOf(
    expression: TExpression,
    at: ISourceSpan,
  ): ISubstring | null {
    const subscripted = ExpressionShape.subscriptedIdentifier(expression);
    if (subscripted === null) return null;
    const capacity = this.capacityOfName(subscripted.name, at);
    if (capacity === null) return null;
    const indexes = subscripted.indexes;
    return {
      start: this.constantOf(indexes[0]),
      length: indexes.length === 2 ? this.constantOf(indexes[1]) : 1,
      sourceCapacity: capacity,
    };
  }

  private constantOf(expr: TExpression): number | null {
    return ConstantExpression.valueAt(expr, this.context);
  }

  private report(
    at: TExpression,
    code: string,
    message: string,
    helpText: string,
  ): void {
    this.found.push({
      code,
      line: at.span.line,
      column: at.span.column,
      message,
      helpText,
    });
  }
}

class StringDeclarationAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): IStringDeclarationError[] {
    const check = new StringDeclarationCheck(this.context);
    for (const entry of VariableDeclarations.ruled(program)) {
      check.variable(entry.declaration);
    }
    return check.errors();
  }
}

export default StringDeclarationAnalyzer;
