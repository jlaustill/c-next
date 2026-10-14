import type TTypeSyntax from "../../../types/syntax/TTypeSyntax";

/** A written type, and the scope it is written in (`null` at file level) */
interface ITypeSite {
  readonly type: TTypeSyntax;
  readonly scope: string | null;
}

export default ITypeSite;
