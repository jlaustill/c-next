import type ISourcePosition from "../../../../utils/types/ISourcePosition";
/**
 * Dependencies needed for simple identifier resolution
 */

import TParameterInfo from "../../../../types/TParameterInfo";

interface ISimpleIdentifierDeps {
  /** The parameter a name binds to at `at` (#1969) */
  getParameterInfo(
    name: string,
    at: ISourcePosition,
  ): TParameterInfo | undefined;

  /**
   * Resolve parameter to its output form, under the C name it binds to at
   * `at` (#1290)
   */
  resolveParameter(
    name: string,
    paramInfo: TParameterInfo,
    at: ISourcePosition,
  ): string;

  /**
   * Resolve bare identifier (local -> scope -> global priority), bound at the
   * reference's position (#1668)
   */
  resolveBareIdentifier(name: string, at: ISourcePosition): string | null;
}

export default ISimpleIdentifierDeps;
