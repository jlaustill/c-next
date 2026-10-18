import type TExpression from "../../../types/syntax/TExpression";
import type IArrayDeclarationError from "../types/IArrayDeclarationError";

type TArrayInitializer = Extract<TExpression, { kind: "arrayInitializer" }>;

/**
 * ADR-035, E0866: a list has one element per slot at every level, or the
 * fill-all form `[v*]` for a level. A declaration's list and a field's or an
 * assignment target's are counted by this one rule (#1782), each against the
 * sizes its own position takes; a size that does not fold is not counted.
 */
class ArrayListCount {
  static mismatches(
    initializer: TArrayInitializer,
    sizes: readonly (number | null)[],
  ): IArrayDeclarationError[] {
    const found: IArrayDeclarationError[] = [];
    ArrayListCount.checkLevel(initializer, sizes, 0, found);
    return found;
  }

  /** Count one level of a nested list against its dimension, then descend. */
  private static checkLevel(
    initializer: TArrayInitializer,
    sizes: readonly (number | null)[],
    level: number,
    found: IArrayDeclarationError[],
  ): void {
    if (initializer.fill !== null) return; // fill-all covers this level
    const elements = initializer.elements;
    const declared = sizes[level];
    if (
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
        ArrayListCount.checkLevel(element, sizes, level + 1, found);
      }
    }
  }
}

export default ArrayListCount;
