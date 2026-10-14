/**
 * #1975 review, #2078: a type named where a value goes.
 *
 * A chain that starts at a type -- `u32`, `Point`, `Geo.Box`, a header's
 * `Cfg` -- answers ADR-058's length properties of it and of its fields' types
 * (`Point.y.byte_length`), and names no value. `Point.x`, `Point.z.byte_length`
 * and `u32.foo` reached the C as written, at exit 0, and gcc rejected them.
 *
 * Error code:
 * - E0897: a chain that names a type does not end reading a length of it
 */
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import OperandTyper from "../../utils/OperandTyper";
import type ITypeNameValueError from "./types/ITypeNameValueError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IOperandType from "../../types/IOperandType";
import type TExpression from "../../types/syntax/TExpression";

class TypeNameValueAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  /** Every chain, read or written; a chain's head is asked as the chain */
  public analyze(program: IProgramSyntax): ITypeNameValueError[] {
    const found: ITypeNameValueError[] = [];
    for (const member of program.declarations) {
      for (const part of DeclarationParts.of(member.declaration)) {
        const nodes = ExpressionNodes.of(part);
        const heads = new Set(
          nodes.flatMap((node) =>
            node.kind === "postfix" ? [node.primary] : [],
          ),
        );
        for (const expr of nodes) {
          if (heads.has(expr)) continue;
          if (expr.kind !== "postfix" && expr.kind !== "identifier") continue;
          const error = this.check(expr);
          if (error !== null) found.push(error);
        }
      }
    }
    return found;
  }

  private check(chain: TExpression): ITypeNameValueError | null {
    const misnamed = OperandTyper.typeNamedAsValue(chain, this.context);
    if (misnamed === null) return null;
    const { at, type } = misnamed;
    const subject = TypeNameValueAnalyzer.spelling(type);
    const span = at?.span ?? chain.span;
    return {
      code: "E0897",
      line: span.line,
      column: span.column,
      message:
        at?.kind === "member"
          ? `Type '${subject}' has no field or length property '${at.name}'`
          : `'${subject}' names a type, not a value`,
      helpText:
        "A type answers its length properties and its fields' types do (Point.byte_length, Point.x.bit_length, ADR-058); a value is read from a variable of the type.",
    };
  }

  private static spelling(type: IOperandType): string {
    const dimensions = type.dimensions.map((d) => `[${d}]`).join("");
    return `${type.typeName ?? type.cType ?? type.category}${dimensions}`;
  }
}

export default TypeNameValueAnalyzer;
