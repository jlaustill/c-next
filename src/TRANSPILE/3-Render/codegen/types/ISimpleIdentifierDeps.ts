import type ISourcePosition from "../../../../utils/types/ISourcePosition";
/**
 * Dependencies needed for simple identifier resolution
 */

import type IBoundParameter from "../../../types/IBoundParameter";

interface ISimpleIdentifierDeps {
  /** The parameter a name binds to at `at` (#1969) */
  getParameter(name: string, at: ISourcePosition): IBoundParameter | undefined;

  /** Resolve parameter to its output form, under its C name there (#1290) */
  resolveParameter(parameter: IBoundParameter): string;

  /**
   * Resolve bare identifier (local -> scope -> global priority), bound at the
   * reference's position (#1668)
   */
  resolveBareIdentifier(name: string, at: ISourcePosition): string | null;
}

export default ISimpleIdentifierDeps;
