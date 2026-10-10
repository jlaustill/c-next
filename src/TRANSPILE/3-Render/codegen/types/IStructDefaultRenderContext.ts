import type IStructDefaultFacts from "../../../../types/IStructDefaultFacts";

/** What `StructDefaultInitializer` needs to spell a struct's default (#1283). */
interface IStructDefaultRenderContext extends IStructDefaultFacts {
  readonly cppMode: boolean;
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
