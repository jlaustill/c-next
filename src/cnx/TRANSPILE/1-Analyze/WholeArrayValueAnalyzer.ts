/**
 * ADR-014: an array's whole value is ADR-035's list (E0866) wherever a whole
 * array is taken -- a declaration, a field, an assignment target and a
 * parameter (#1760 review, 2026-09-28). A declaration's is 1.2's `ArrayForm`
 * and `ArrayDeclarationAnalyzer`; every other position is here.
 *
 * #1782: an assignment target was asked only whether a struct initializer
 * stood there. Another array, a scalar, or a list of the wrong length was
 * emitted as a C array assignment (`a = b;`), which C rejects, at exit 0. A
 * field given another array (`{ data: src }`) compiled with a warning and
 * initialized one element from a pointer; a field's short list was C's
 * partial initialization, which MISRA C:2012 Rule 9.3 forbids.
 *
 * What is accepted is `ExpressionShape.givesWholeArray`, the declaration's
 * rule; a list is counted by `ArrayListCount`, the declaration's count.
 */

import ArrayListCount from "./helpers/ArrayListCount";
import StructInitializerType from "./helpers/StructInitializerType";
import ExpressionChildren from "../../utils/ExpressionChildren";
import ExpressionShape from "../../utils/ExpressionShape";
import TypeText from "../../utils/TypeText";
import type IValuePosition from "../../types/IValuePosition";
import type IValuePositions from "../../types/IValuePositions";
import type TExpression from "../../types/syntax/TExpression";
import type IArrayDeclarationError from "./types/IArrayDeclarationError";

class WholeArrayValueAnalyzer {
  public analyze(positions: IValuePositions): IArrayDeclarationError[] {
    const found: IArrayDeclarationError[] = [];
    // A value's operands stand in its position too; only the value is asked
    const asked = new Set<TExpression>();
    for (const [value, at] of positions.positions) {
      if (asked.has(value) || !StructInitializerType.takesWholeArrayAt(at)) {
        continue;
      }
      WholeArrayValueAnalyzer.markAsked(value, asked);
      // An argument passes an array by reference, so an array value is one.
      // What else an argument takes is #2157's; a struct initializer is not.
      const site = positions.sites.get(value)?.site;
      if (site?.kind === "argument" && value.kind !== "structInitializer") {
        continue;
      }
      found.push(...WholeArrayValueAnalyzer.check(value, at));
    }
    return found.sort((a, b) => a.line - b.line || a.column - b.column);
  }

  private static check(
    value: TExpression,
    at: IValuePosition,
  ): IArrayDeclarationError[] {
    if (value.kind === "arrayInitializer") {
      return ArrayListCount.mismatches(
        value,
        at.dimensions.map((size) => (typeof size === "number" ? size : null)),
      );
    }
    const element =
      at.typeText === null ? null : TypeText.withoutDimensions(at.typeText);
    if (ExpressionShape.givesWholeArray(value, element)) return [];
    return [
      {
        code: "E0866",
        line: value.span.line,
        column: value.span.column,
        message: `An array must be given a list, not '${value.written}'`,
        helpText:
          "Write the elements out in brackets, or set them one at a time (ADR-035).",
      },
    ];
  }

  private static markAsked(value: TExpression, asked: Set<TExpression>): void {
    asked.add(value);
    for (const child of ExpressionChildren.of(value)) {
      WholeArrayValueAnalyzer.markAsked(child, asked);
    }
  }
}

export default WholeArrayValueAnalyzer;
