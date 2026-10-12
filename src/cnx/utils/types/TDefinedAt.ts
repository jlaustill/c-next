import type ISourceSpan from "../../types/ISourceSpan";
import type ISourcePosition from "./ISourcePosition";

/**
 * #1643: when a declaration spanning `declaration` counts as defined at
 * `at` -- `DefinitionPoint.isDefinedAt`, the one rule binding follows
 */
type TDefinedAt = (
  declaration: Pick<ISourceSpan, "endLine" | "endColumn">,
  at: Pick<ISourcePosition, "line" | "column">,
) => boolean;

export default TDefinedAt;
