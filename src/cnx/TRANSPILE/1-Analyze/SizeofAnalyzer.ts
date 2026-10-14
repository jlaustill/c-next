/**
 * ADR-023: C-Next has no `sizeof` -- E0603.
 *
 * Owner ruling (#1975): the size of a type or of a value is ADR-058's
 * `.byte_length`, which C-Next decides itself: a struct's is its fields'
 * sizes together, without C padding, wherever the struct is declared. C's
 * `sizeof` answers with the C compiler's layout instead, so the same struct
 * had two sizes. The C spelling is parsed only so that it is rejected with a
 * code and a help naming the property, rather than as a parse error.
 *
 * E0601 (an array parameter's `sizeof` measured a pointer) and E0602 (an
 * operand with a side effect) were rules about `sizeof`'s operand; with no
 * `sizeof` there is no operand to judge, and they are retired.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import ISizeofError from "./types/ISizeofError";

class SizeofAnalyzer {
  public analyze(program: IProgramSyntax): ISizeofError[] {
    return program.declarations.flatMap(({ declaration }) =>
      DeclarationParts.of(declaration).flatMap((part) =>
        ExpressionNodes.of(part)
          .filter((expr) => expr.kind === "sizeof")
          .map((expr) => ({
            code: "E0603",
            line: expr.span.line,
            column: expr.span.column,
            message: "C-Next has no 'sizeof'",
            helpText:
              "A type's or a value's size in bytes is its .byte_length (ADR-058): u32.byte_length, buf.byte_length, Point.byte_length.",
          })),
      ),
    );
  }
}

export default SizeofAnalyzer;
