import type TSyntaxPart from "../../../types/syntax/TSyntaxPart";

/** A type or expression 2.3 writes, and the scope it is written in (`null` at file level) */
interface IWrittenPart {
  readonly part: TSyntaxPart;
  readonly scope: string | null;
}

export default IWrittenPart;
