/** What `StructDefault` reads to decide a struct's ADR-029 default (#1283). */
interface IStructDefaultFacts {
  /** Struct C name -> field name -> field type C name, in declaration order. */
  readonly structFields: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** ADR-029: is this type name a function used as a type? */
  readonly isCallbackType: (typeName: string) => boolean;
  /** ADR-017 / #1971: an enum's zero enumerator, or null for a non-enum. */
  readonly enumZeroOf: (typeName: string) => string | null;
}

export default IStructDefaultFacts;
