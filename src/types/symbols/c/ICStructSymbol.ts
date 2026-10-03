import type ICBaseSymbol from "./ICBaseSymbol";
import type ICFieldInfo from "./ICFieldInfo";

/**
 * Symbol representing a C struct or union type definition.
 */
interface ICStructSymbol extends ICBaseSymbol {
  /** Discriminator narrowed to "struct" */
  readonly kind: "struct";

  /** Whether this is a union (true) or struct (false) */
  readonly isUnion: boolean;

  /** Map of field name to field metadata (only populated if SymbolTable was provided) */
  readonly fields?: ReadonlyMap<string, ICFieldInfo>;

  /** Whether this struct requires 'struct' keyword when referenced */
  readonly needsStructKeyword?: boolean;
}

export default ICStructSymbol;
