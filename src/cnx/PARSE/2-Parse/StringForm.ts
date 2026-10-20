/**
 * ADR-045's string declaration forms (#1322, #1991): a capacity is written or
 * can be inferred (E0862), and a file-scope string is initialized only by a
 * literal (E0863). Both read only how the declaration is written, so 1.2
 * reports them. Whether the initializer fits is 2.1's (E0864/E0865).
 *
 * The declarations judged are `VariableDeclarations.ruled`, the same walk 2.1
 * uses (#2073). A `for` header's string is E0917, not one of these.
 */
import ExpressionShape from "../../utils/ExpressionShape";
import CodedErrorText from "../../utils/CodedErrorText";
import VariableDeclarations from "../../utils/VariableDeclarations";
import type ISourceSpan from "../../types/ISourceSpan";
import type ITranspileError from "../../types/ITranspileError";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IVariableDeclarationSite from "../../types/syntax/IVariableDeclarationSite";
import type TExpression from "../../types/syntax/TExpression";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";

type TStringTypeSyntax = Extract<TTypeSyntax, { kind: "string" }>;

class StringFormCheck {
  private readonly found: ITranspileError[] = [];

  public errors(): ITranspileError[] {
    return this.found;
  }

  public variable(entry: IVariableDeclarationSite): void {
    const declaration = entry.declaration;
    const type = declaration.type;
    const isArray = type.kind === "array";
    const stringType = type.kind === "array" ? type.element : type;
    if (stringType.kind !== "string") return;
    const initializer = declaration.initializer;
    if (stringType.capacity === null) {
      this.checkInferred(
        stringType,
        isArray,
        !declaration.modifiers.mut,
        declaration.modifiers.atomic,
        initializer,
      );
      return;
    }
    if (isArray || initializer === null) return;
    if (entry.site === "statement") return; // inside a function
    if (ExpressionShape.isStringLiteral(initializer)) return;
    this.report(
      initializer.span,
      "E0863",
      `A string at file scope may only be initialized by a literal, not '${initializer.written}'`,
      "Copying, concatenating and extracting a substring all need runtime calls, which C cannot make before `main`. Move the declaration into a function, or initialize it empty and assign later.",
    );
  }

  /** A string with no capacity: only a const one, from a literal */
  private checkInferred(
    stringType: TStringTypeSyntax,
    isArray: boolean,
    isReadOnly: boolean,
    isAtomic: boolean,
    initializer: TExpression | null,
  ): void {
    if (isArray) {
      this.report(
        stringType.span,
        "E0862",
        "A string array requires an explicit capacity",
        "Write the element capacity, e.g. string<64>[4].",
      );
      return;
    }
    if (!isReadOnly && isAtomic) {
      this.report(
        stringType.span,
        "E0862",
        "An `atomic` string requires an explicit capacity",
        "`atomic` makes a binding writable (ADR-071), and only a read-only string can have its capacity inferred. Give it a capacity: `atomic string<64>`.",
      );
      return;
    }
    if (!isReadOnly) {
      this.report(
        stringType.span,
        "E0862",
        "A `mut` string requires an explicit capacity",
        "Write the capacity, e.g. string<64>. Only a read-only string can have one inferred.",
      );
      return;
    }
    if (initializer === null) {
      this.report(
        stringType.span,
        "E0862",
        "A read-only string without a capacity requires an initializer to infer it from",
        "Write the capacity, e.g. string<64>, or initialize it with a literal.",
      );
      return;
    }
    if (!ExpressionShape.isStringLiteral(initializer)) {
      this.report(
        initializer.span,
        "E0862",
        "A read-only string without a capacity requires a string literal to infer it from",
        "Write the capacity, e.g. string<64>. A capacity can only be inferred from a literal.",
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
      line: at.line,
      column: at.column,
      message: CodedErrorText.of(code, message),
      helpText,
      severity: "error",
    });
  }
}

class StringForm {
  /** Every string-declaration form error in a file that parsed, lowered */
  static errorsIn(program: IProgramSyntax): ITranspileError[] {
    const check = new StringFormCheck();
    for (const entry of VariableDeclarations.ruled(program)) {
      check.variable(entry);
    }
    return check.errors();
  }
}

export default StringForm;
