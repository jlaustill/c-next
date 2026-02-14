import type ICppBaseSymbol from "./ICppBaseSymbol";

/**
 * Symbol representing a C++ namespace.
 */
interface ICppNamespaceSymbol extends ICppBaseSymbol {
  /** Discriminator narrowed to "namespace" */
  readonly kind: "namespace";
}

export default ICppNamespaceSymbol;
