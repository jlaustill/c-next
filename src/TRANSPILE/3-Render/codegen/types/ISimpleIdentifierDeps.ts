import type ISourcePosition from "../../../../utils/types/ISourcePosition";
/**
 * Dependencies needed for simple identifier resolution
 */

import TParameterInfo from "../../../../types/TParameterInfo";

interface ISimpleIdentifierDeps {
  /** Get parameter info by name */
  getParameterInfo(name: string): TParameterInfo | undefined;

  /** Resolve parameter to its output form */
  resolveParameter(name: string, paramInfo: TParameterInfo): string;

  /**
   * Resolve bare identifier (local -> scope -> global priority), bound at the
   * reference's position (#1668)
   */
  resolveBareIdentifier(name: string, at: ISourcePosition): string | null;
}

export default ISimpleIdentifierDeps;
