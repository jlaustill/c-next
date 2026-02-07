/**
 * Dependencies needed for simple identifier resolution
 */

import TParameterInfo from "./TParameterInfo";

interface ISimpleIdentifierDeps {
  /** Get parameter info by name */
  getParameterInfo(name: string): TParameterInfo | undefined;

  /** Resolve parameter to its output form */
  resolveParameter(name: string, paramInfo: TParameterInfo): string;

  /** Check if identifier is a local variable */
  isLocalVariable(name: string): boolean;

  /** Resolve bare identifier (local -> scope -> global priority) */
  resolveBareIdentifier(name: string, isLocal: boolean): string | null;
}

export default ISimpleIdentifierDeps;
