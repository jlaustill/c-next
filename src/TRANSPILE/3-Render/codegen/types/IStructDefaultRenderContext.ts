import type IStructDefaultFacts from "../../../../types/IStructDefaultFacts";

/** What `StructDefaultInitializer` needs to spell a struct's default (#1283). */
interface IStructDefaultRenderContext extends IStructDefaultFacts {
  readonly cppMode: boolean;
  /** ADR-017: the zero enumerator of an enum type, or null for a non-enum. */
  readonly enumZeroOf: (typeName: string) => string | null;
}

export default IStructDefaultRenderContext;
