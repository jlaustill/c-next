import type TValueBinding from "./TValueBinding";

/**
 * What a name in a constant expression reads (#1735 review): the binding its
 * chain reaches -- `Scope.N` is the member's own, as `N` is -- and the part of
 * the chain past it (`.type_byte_length`)
 */
interface IConstTarget {
  readonly binding: TValueBinding;
  readonly rest: ReadonlyArray<string>;
}

export default IConstTarget;
