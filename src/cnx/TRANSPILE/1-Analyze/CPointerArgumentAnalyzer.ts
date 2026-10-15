/**
 * A C function's pointer parameter takes an object of the type it points to:
 * E0895.
 *
 * #1977, owner ruling: a struct handed to a C function's `const uint8_t*` is a
 * compile error. The C was `send_u8(&r, 12U)` -- exit 0, and an
 * incompatible-pointer conversion gcc 14 rejects -- with a byte count nobody
 * checks against the object. A `u32` handed to the same parameter was passed
 * as `w`, a pointer made from an integer. One rule covers both: the argument's
 * C type is the pointee's, or the parameter is `void*`. A read-only argument
 * also needs a parameter that points to const, or C could write to it: that
 * is a write, so it is ADR-071's E0900.
 *
 * E0896, owner ruling: C-Next cannot see how a C function uses its pointer --
 * one `u8` or `n` of them -- so it accepts both, and warns that the call is not
 * memory safe.
 *
 * Asked only where both sides are known: a C function (a C-Next function's
 * parameters are C-Next's own), a parameter of exactly one pointer, and an
 * argument the typer types as a declared value. A literal or an expression is
 * passed as a compound literal of the parameter's type.
 */

import OperandTyper from "../../utils/OperandTyper";
import CCallee from "./helpers/CCallee";
import WrittenBinding from "./helpers/WrittenBinding";
import CPointerParameter from "../../utils/CPointerParameter";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import CNEXT_TO_C_TYPE_MAP from "../../utils/constants/TypeMappings";
import type IOperandType from "../../types/IOperandType";
import type TValueBinding from "../../types/TValueBinding";
import type ICParameterInfo from "../../types/symbols/c/ICParameterInfo";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type IBaseAnalysisError from "./types/IBaseAnalysisError";
import type IAnalysisContext from "./types/IAnalysisContext";

class CPointerArgumentCheck {
  private readonly found: IBaseAnalysisError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): IBaseAnalysisError[] {
    return this.found;
  }

  /** `f(a, b)` or `global.f(a, b)`: a call by name, and nothing after it */
  public checkExpression(expr: TExpression): void {
    const callee = CCallee.of(expr, this.context);
    if (callee === null) return;
    const name = callee.name;
    callee.arguments.forEach((arg, index) => {
      const parameter = callee.parameters[index];
      const pointee = CPointerParameter.pointee(parameter?.type);
      if (pointee === null) {
        if (parameter !== undefined)
          this.rejectsReadOnlyArray(arg, name, index, parameter);
        return;
      }
      if (
        pointee !== "void" &&
        this.rejects(arg, name, index, parameter, pointee)
      ) {
        return;
      }
      this.report(
        arg,
        `C-Next cannot see how '${name}' uses parameter ${index + 1}, so passing '${arg.written}' to it is not memory safe`,
        `Consider converting '${name}' to C-Next.`,
        "E0896",
        "warning",
      );
    });
  }

  /** E0900, when a read-only array meets a C array parameter that is not const */
  private rejectsReadOnlyArray(
    arg: TExpression,
    name: string,
    index: number,
    parameter: ICParameterInfo,
  ): void {
    if (
      !CPointerParameter.writesThrough(parameter) ||
      CPointerArgumentAnalyzer.isConstRoot(
        WrittenBinding.ofExpression(arg, this.context)?.binding ?? null,
      ) !== true
    ) {
      return;
    }
    this.report(
      arg,
      `'${arg.written}' is read-only, and parameter ${index + 1} of '${name}' is ${parameter.isArray ? "an array" : "a reference"} '${name}' may write through`,
      `Declare '${arg.written}' \`mut\`, or declare the C parameter const.`,
      "E0900",
    );
  }

  /** E0895, when the argument is not what the pointer points to */
  private rejects(
    arg: TExpression,
    name: string,
    index: number,
    parameter: ICParameterInfo,
    pointee: string,
  ): boolean {
    const argType = CPointerArgumentAnalyzer.cTypeOf(
      OperandTyper.typeOf(arg, this.context),
    );
    if (
      argType !== null &&
      this.structIdentity(argType) !== this.structIdentity(pointee)
    ) {
      this.report(
        arg,
        `'${arg.written}' is ${argType}, and parameter ${index + 1} of '${name}' points to ${pointee}`,
        `A C pointer parameter takes an object of the type it points to; pass a ${pointee}, or an array of them.`,
      );
      return true;
    }
    // `&x` hands the callee x itself, so x is what the pointer may write.
    const objectType =
      argType ??
      (arg.kind === "unary" && arg.operator === "&"
        ? CPointerArgumentAnalyzer.cTypeOf(
            OperandTyper.typeOf(arg.operand, this.context),
          )
        : null);
    if (objectType === null) return false;
    const isConst = CPointerArgumentAnalyzer.isConstRoot(
      WrittenBinding.ofExpression(arg, this.context)?.binding ?? null,
    );
    if (isConst !== true || CPointerParameter.pointsToConst(parameter)) {
      return false;
    }
    this.report(
      arg,
      `'${arg.written}' is read-only ${objectType}, and parameter ${index + 1} of '${name}' is a pointer '${name}' may write through`,
      `Declare '${arg.written}' \`mut\`, or declare the C parameter const ${pointee}*.`,
      "E0900",
    );
    return true;
  }

  /** `widget_t` and the `_widget_t` it aliases are one type (#958) */
  private structIdentity(cType: string): string {
    return this.context.symbolTable.getStructTagForTypedef(cType) ?? cType;
  }

  private report(
    at: TExpression,
    message: string,
    helpText: string,
    code = "E0895",
    severity: IBaseAnalysisError["severity"] = "error",
  ) {
    this.found.push({
      code,
      line: at.span.line,
      column: at.span.column,
      message,
      helpText,
      severity,
    });
  }
}

class CPointerArgumentAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): IBaseAnalysisError[] {
    const check = new CPointerArgumentCheck(this.context);
    for (const member of program.declarations) {
      for (const part of DeclarationParts.of(member.declaration)) {
        for (const expr of ExpressionNodes.of(part))
          check.checkExpression(expr);
      }
    }
    return check.errors();
  }

  /** Whether the value a chain starts at is declared const; null if unknown */
  static isConstRoot(root: TValueBinding | null): boolean | null {
    switch (root?.kind) {
      case "local":
        return root.declaration.isConst;
      case "variable":
        return root.symbol.isConst;
      default:
        return null;
    }
  }

  /** A declared value's C type -- an array's is its element's -- or null */
  static cTypeOf(typed: IOperandType | null): string | null {
    if (typed?.form.kind !== "declared" || typed.typeName === null) {
      return null;
    }
    if (typed.stringCapacity !== null) return "char";
    return CNEXT_TO_C_TYPE_MAP[typed.typeName] ?? typed.typeName;
  }
}

export default CPointerArgumentAnalyzer;
