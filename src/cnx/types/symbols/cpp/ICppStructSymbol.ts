import type ICppBaseSymbol from "./ICppBaseSymbol";
import type ICppFieldInfo from "./ICppFieldInfo";

/**
 * Symbol representing a C++ struct type definition.
 * In C++, structs are very similar to classes but with different default visibility.
 */
interface ICppStructSymbol extends ICppBaseSymbol {
  /** Discriminator narrowed to "struct" */
  readonly kind: "struct";

  /** Map of field name to field metadata (only populated if SymbolTable was provided) */
  readonly fields?: ReadonlyMap<string, ICppFieldInfo>;
}

export default ICppStructSymbol;
