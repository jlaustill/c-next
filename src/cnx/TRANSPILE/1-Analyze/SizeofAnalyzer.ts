/**
 * ADR-023's `sizeof` operand: E0601, E0602.
 *
 * #1322. Two throws in `SizeofResolver`, both carrying their code inside the
 * message text (`Error[E0601]: …`) and reaching the user as `1:0` -- a code
 * spelled into prose is not a code the tooling can see, which is why neither
 * appeared in `docs/error-codes.md` under its own row until now.
 *
 * ## E0601: the same spelling, opposite answers
 *
 * `sizeof(data)` measures the array when `data` is a local, and a POINTER when
 * it is a parameter -- ADR-006 passes arrays by reference, so the parameter is
 * a pointer whatever its declared dimensions say. The rule is therefore about
 * where the name is DECLARED, not about its type, which is why it asks the
 * enclosing function's own parameter list rather than the frames: a local
 * array of the same name and shape is fine. Both come from 1.2's syntax, not
 * the parse tree (#1991).
 *
 * ## E0602: what a side effect actually is
 *
 * MISRA C:2012 Rule 13.6. Codegen tested the operand's TEXT for each of eleven
 * assignment operators before walking the tree for a call. Assignment is a
 * STATEMENT in this grammar, so none of those eleven could ever appear inside
 * a `sizeof` operand and all eleven were dead -- eleven lines that read as a
 * rule. A call is the only side effect an expression can have, and that is the
 * whole check here.
 */

import type IParameterSyntax from "../../types/syntax/IParameterSyntax";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type ISourceSpan from "../../types/ISourceSpan";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../types/syntax/TExpression";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionCalls from "../../utils/ExpressionCalls";
import ExpressionNodes from "../../utils/ExpressionNodes";
import ExpressionShape from "../../utils/ExpressionShape";
import ISizeofError from "./types/ISizeofError";

type TSizeof = Extract<TExpression, { readonly kind: "sizeof" }>;

class SizeofAnalyzer {
  private readonly found: ISizeofError[] = [];

  public analyze(program: IProgramSyntax): ISizeofError[] {
    for (const member of program.declarations) {
      this.declaration(member.declaration);
    }
    return this.found;
  }

  private declaration(declaration: TDeclarationSyntax): void {
    if (declaration.kind === "scope") {
      for (const member of declaration.members) {
        this.declaration(member.declaration);
      }
      return;
    }
    const parameters =
      declaration.kind === "function" ? (declaration.parameters ?? []) : [];
    for (const part of DeclarationParts.of(declaration)) {
      for (const expr of ExpressionNodes.of(part)) {
        if (expr.kind === "sizeof") this.check(expr, parameters);
      }
    }
  }

  private check(
    sizeOf: TSizeof,
    parameters: readonly IParameterSyntax[],
  ): void {
    const bareName = sizeOf.type?.kind === "user" ? sizeOf.type.text : null;
    const operand = sizeOf.expression;
    const name =
      bareName ??
      (operand === null ? null : ExpressionShape.simpleIdentifier(operand));
    const parameter =
      name === null ? undefined : parameters.find((p) => p.name === name);
    if (parameter?.type.kind === "array") {
      this.report(
        sizeOf.span,
        "E0601",
        `sizeof() on array parameter '${name}' measures a pointer, not the array`,
        `An array parameter is passed by reference (ADR-006), so its size is the pointer's. Use ${name}.element_count for the count, or sizeof(elementType) * ${name}.element_count for the bytes.`,
      );
      return;
    }
    if (operand !== null && ExpressionCalls.containsCall(operand)) {
      this.report(
        operand.span,
        "E0602",
        "sizeof() operand must not have side effects",
        "MISRA C:2012 Rule 13.6: `sizeof` does not evaluate its operand, so a call inside it never runs. Compute the value first and take the size of that.",
      );
    }
  }

  private report(
    at: ISourceSpan,
    code: string,
    message: string,
    helpText: string,
  ): void {
    this.found.push({
      code,
      line: at.line,
      column: at.column,
      message,
      helpText,
    });
  }
}

export default SizeofAnalyzer;
