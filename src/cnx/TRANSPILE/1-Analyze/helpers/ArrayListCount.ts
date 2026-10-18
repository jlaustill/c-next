import ExpressionShape from "../../../utils/ExpressionShape";
import type TExpression from "../../../types/syntax/TExpression";
import type IArrayDeclarationError from "../types/IArrayDeclarationError";

type TArrayInitializer = Extract<TExpression, { kind: "arrayInitializer" }>;

/**
 * ADR-035, E0866: a list has one element per slot at every level, or the
 * fill-all form `[v*]` for a level. A declaration's list and a field's, an
 * assignment target's or an argument's are checked by this one rule (#1782),
 * each against the sizes its own position takes; a size that does not fold is
 * not counted. A row is a whole array (ADR-014), so an element at a level
 * with dimensions left is a list too -- or, for a `u8` row, a string literal
 * (#2195).
 */
class ArrayListCount {
  static mismatches(
    initializer: TArrayInitializer,
    sizes: readonly (number | null)[],
    elementType: string | null,
  ): IArrayDeclarationError[] {
    const found: IArrayDeclarationError[] = [];
    ArrayListCount.checkLevel(initializer, sizes, elementType, 0, found);
    return found;
  }

  /** An array (or a row) given something other than ADR-035's list */
  static notAList(value: TExpression): IArrayDeclarationError {
    return {
      code: "E0866",
      line: value.span.line,
      column: value.span.column,
      message: `An array must be given a list, not '${value.written}'`,
      helpText:
        "Write the elements out in brackets, or set them one at a time (ADR-035).",
    };
  }

  /** Count one level of a nested list against its dimension, then descend. */
  private static checkLevel(
    initializer: TArrayInitializer,
    sizes: readonly (number | null)[],
    elementType: string | null,
    level: number,
    found: IArrayDeclarationError[],
  ): void {
    // A fill-all covers this level; its value fills every slot of it
    const fill = initializer.fill;
    const elements = fill === null ? initializer.elements : [fill];
    const declared = sizes[level];
    if (
      fill === null &&
      declared !== null &&
      declared !== undefined &&
      elements.length !== declared
    ) {
      const where = level > 0 ? ` at nesting level ${level + 1}` : "";
      found.push({
        code: "E0866",
        line: initializer.span.line,
        column: initializer.span.column,
        message: `Array size mismatch: declared [${declared}] but the initializer has ${elements.length} element(s)${where}`,
        helpText:
          "Give one element per slot, or use the fill-all form such as [0*] (ADR-035).",
      });
      return;
    }
    for (const element of elements) {
      if (element.kind === "arrayInitializer") {
        ArrayListCount.checkLevel(
          element,
          sizes,
          elementType,
          level + 1,
          found,
        );
      } else if (
        level + 1 < sizes.length &&
        !ExpressionShape.givesWholeArray(element, elementType)
      ) {
        found.push(ArrayListCount.notAList(element));
      }
    }
  }
}

export default ArrayListCount;
