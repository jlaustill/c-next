import type ISourceSpan from "../types/ISourceSpan";
import type ILocalDeclaration from "../types/ILocalDeclaration";
import type IVariableSymbol from "../types/symbols/IVariableSymbol";
import type ISourcePosition from "./types/ISourcePosition";

/**
 * #1643 (ADR-030): a declaration is defined once it closes -- after its
 * initializer -- whatever declares it: a local, a `for` variable, a parameter,
 * a global or a scope member. The one place that point is decided, and the one
 * place each kind's extent is chosen.
 */
class DefinitionPoint {
  /** Whether `declaration` is defined at `at` */
  static isDefinedAt(
    declaration: ILocalDeclaration | IVariableSymbol,
    at: Pick<ISourcePosition, "line" | "column">,
  ): boolean {
    const extent = DefinitionPoint.extentOf(declaration);
    return (
      extent.endLine < at.line ||
      (extent.endLine === at.line && extent.endColumn <= at.column)
    );
  }

  /**
   * The whole declaration, initializer included: a local records it as its
   * `extent`; a global's or member's `span` is the whole declaration
   * (VariableCollector), the one span it has
   */
  private static extentOf(
    declaration: ILocalDeclaration | IVariableSymbol,
  ): Pick<ISourceSpan, "endLine" | "endColumn"> {
    return "extent" in declaration ? declaration.extent : declaration.span;
  }
}

export default DefinitionPoint;
