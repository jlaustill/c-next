import type ILocalDeclaration from "../../types/ILocalDeclaration";
import type IVariableSymbol from "../../types/symbols/IVariableSymbol";
import type ISourcePosition from "./ISourcePosition";

/**
 * #1643: when a declaration counts as defined at `at` --
 * `DefinitionPoint.isDefinedAt`, the one rule binding follows
 */
type TDefinedAt = (
  declaration: ILocalDeclaration | IVariableSymbol,
  at: Pick<ISourcePosition, "line" | "column">,
) => boolean;

export default TDefinedAt;
