import type IStructFieldInfo from "../../../types/symbols/IStructFieldInfo";
import type TType from "../../../types/TType";

/**
 * What a constant name's facts read of the program's files, beside the binder
 * (#1175): the same answers for 1.4's settling and every later pass.
 */
interface IFileConstantFacts {
  /** ADR-057: whether a qualified type name is a scope type `sourceFile` sees */
  isScopeTypeVisibleFrom(sourceFile: string, qualifiedName: string): boolean;
  /** Whether `sourceFile` includes a C or C++ header, so a name may be a macro */
  reachesForeignHeader(sourceFile: string): boolean;
  /** #2076: a header struct's fields; undefined for a name no header's struct has */
  headerStructFields(
    structName: string,
  ): ReadonlyMap<string, IStructFieldInfo> | undefined;
  /** #2076: `ForeignTypeFacts.typeBits` of a header's C type, for the run's target */
  headerTypeBits(cType: string): number | null;
  /** #1975 review: `TypeHead.header` over the run's headers */
  headerTypeHead(name: string): TType | null;
}

export default IFileConstantFacts;
