import invariant from "./invariant";
import type ILocalDeclaration from "../types/ILocalDeclaration";

/**
 * #1934: the C identifier a bound local is emitted under, as 1.4 settled it
 * (ADR-057). The one place that reads it off the declaration.
 */
const emittedLocalName = (declaration: ILocalDeclaration): string => {
  const { emittedName } = declaration;
  invariant(emittedName !== null, "1.4 settled every local it binds");
  return emittedName;
};

export default emittedLocalName;
