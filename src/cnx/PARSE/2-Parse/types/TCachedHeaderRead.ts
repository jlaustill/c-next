import type IHeaderDeclarationRecord from "../../1-Discover/types/IHeaderDeclarationRecord";

/** #1991: one header's cache read: the record it found, or what it threw */
type TCachedHeaderRead =
  | { readonly kind: "cached"; readonly record: IHeaderDeclarationRecord }
  | { readonly kind: "failed"; readonly error: unknown };

export default TCachedHeaderRead;
