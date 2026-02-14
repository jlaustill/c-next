import type ICppBaseSymbol from "./ICppBaseSymbol";
import type ICppFieldInfo from "./ICppFieldInfo";

/**
 * Symbol representing a C++ class or struct type definition.
 */
interface ICppClassSymbol extends ICppBaseSymbol {
  /** Discriminator narrowed to "class" */
  readonly kind: "class";

  /** Map of field name to field metadata (only populated if SymbolTable was provided) */
  readonly fields?: ReadonlyMap<string, ICppFieldInfo>;
}

export default ICppClassSymbol;
