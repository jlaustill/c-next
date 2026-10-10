import type IStructDefaultFacts from "../../../../types/IStructDefaultFacts";

/** What `StructDefaultInitializer` needs to spell a struct's default (#1283). */
interface IStructDefaultRenderContext extends IStructDefaultFacts {
  readonly cppMode: boolean;
  /** ADR-017: the zero enumerator of an enum type, or null for a non-enum. */
  readonly enumZeroOf: (typeName: string) => string | null;
  /**
   * A field's element count per dimension (`ElementCount`), empty for a
   * scalar; null where C-Next cannot read one, which 2.1 rejects (E0359)
   * wherever every element must be spelled.
   */
  readonly fieldElementCounts: (
    structName: string,
    fieldName: string,
  ) => readonly (number | null)[];
}

export default IStructDefaultRenderContext;
