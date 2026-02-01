import ESymbolKind from "../../../../utils/types/ESymbolKind";
import IBaseSymbol from "./IBaseSymbol";

/**
 * Symbol representing a scope (namespace) definition.
 * Scopes group related functions and can control member visibility.
 */
interface IScopeSymbol extends IBaseSymbol {
  /** Discriminant for type narrowing */
  kind: ESymbolKind.Namespace;

  /** List of member names within this scope */
  members: string[];

  /** Visibility of each member (public or private) */
  memberVisibility: Map<string, "public" | "private">;
}

export default IScopeSymbol;
