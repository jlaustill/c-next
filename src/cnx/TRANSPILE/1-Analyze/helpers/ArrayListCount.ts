import ExpressionShape from "../../../utils/ExpressionShape";
import TypeCheckUtils from "../../../utils/TypeCheckUtils";
import type TExpression from "../../../types/syntax/TExpression";
import type IArrayDeclarationError from "../types/IArrayDeclarationError";

type TArrayInitializer = Extract<TExpression, { kind: "arrayInitializer" }>;
type TSize = number | string | null;

/**
 * ADR-035, E0866: a list has one element per slot at every level, or the
 * fill-all form `[v*]` for a level. A declaration's list and a field's, an
 * assignment target's or an argument's are checked by this one rule (#1782),
 * each against the sizes its own position takes; a size that does not fold is
 * not counted. A row is a whole array (ADR-014), so an element at a level
 * with dimensions left is a list too -- or, for a `u8` row, a string literal
 * -- and a string array's slot is a string literal (#2195). A size is a
 * folded number, the spelling of one that does not fold (a C macro), or null
 * for none; a fill-all other than `[0*]` needs a folded size, since C has no
 * initializer that repeats a value an unknown number of times (#2196).
 */
class ArrayListCount {
  static mismatches(
    initializer: TArrayInitializer,
    sizes: readonly TSize[],
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

  /** A fill-all other than `[0*]` for a size that does not fold */
  private static unfoldedFill(
    fill: TExpression,
    size: string,
  ): IArrayDeclarationError {
    return {
      code: "E0866",
      line: fill.span.line,
      column: fill.span.column,
      message: `A fill-all [${fill.written}*] needs a size C-Next can fold, and '${size}' does not`,
      helpText:
        "Write the elements out, fill with [0*], or size the array with a C-Next constant (ADR-035).",
    };
  }

  /** A string array's slot given something other than a string literal */
  private static notAStringLiteral(value: TExpression): IArrayDeclarationError {
    return {
      code: "E0866",
      line: value.span.line,
      column: value.span.column,
      message: `A string array's element in a list must be a string literal, not '${value.written}'`,
      helpText:
        "Write the string out as a literal, or set the element on its own (ADR-035).",
    };
  }

  /** Count one level of a nested list against its dimension, then descend. */
  private static checkLevel(
    initializer: TArrayInitializer,
    sizes: readonly TSize[],
    elementType: string | null,
    level: number,
    found: IArrayDeclarationError[],
  ): void {
    // A fill-all covers this level; its value fills every slot of it
    const fill = initializer.fill;
    const elements = fill === null ? initializer.elements : [fill];
    const declared = sizes[level];
    if (fill !== null && typeof declared === "string" && fill.written !== "0") {
      found.push(ArrayListCount.unfoldedFill(fill, declared));
      return;
    }
    if (
      fill === null &&
      typeof declared === "number" &&
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
      } else if (level + 1 < sizes.length) {
        if (!ExpressionShape.givesWholeArray(element, elementType)) {
          found.push(ArrayListCount.notAList(element));
        }
      } else if (
        elementType !== null &&
        TypeCheckUtils.isSizedStringName(elementType) &&
        !ExpressionShape.isStringLiteral(element)
      ) {
        found.push(ArrayListCount.notAStringLiteral(element));
      }
    }
  }
}

export default ArrayListCount;
