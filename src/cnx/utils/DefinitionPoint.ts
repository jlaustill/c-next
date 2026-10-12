import type ISourceSpan from "../types/ISourceSpan";
import type ISourcePosition from "./types/ISourcePosition";

/**
 * #1643 (ADR-030): a declaration is defined once it closes -- after its
 * initializer -- whatever declares it: a local, a `for` variable, a parameter,
 * a global or a scope member. The one place that point is decided.
 */
class DefinitionPoint {
  /** Where a declaration spanning `declaration` becomes defined */
  static of(
    declaration: Pick<ISourceSpan, "endLine" | "endColumn">,
  ): ISourcePosition {
    return { line: declaration.endLine, column: declaration.endColumn };
  }

  /** Whether a declaration spanning `declaration` is defined at `at` */
  static isDefinedAt(
    declaration: Pick<ISourceSpan, "endLine" | "endColumn">,
    at: Pick<ISourcePosition, "line" | "column">,
  ): boolean {
    return (
      declaration.endLine < at.line ||
      (declaration.endLine === at.line && declaration.endColumn <= at.column)
    );
  }
}

export default DefinitionPoint;
