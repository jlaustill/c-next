import type IHeaderDeclarationRecord from "../../1-Discover/types/IHeaderDeclarationRecord";

/**
 * #1991: where 1.1 reads a header's cached declarations, by the header's path.
 * Null is a miss; a throw is a read that failed.
 */
type THeaderDeclarationCache = (
  path: string,
) => IHeaderDeclarationRecord | null;

export default THeaderDeclarationCache;
