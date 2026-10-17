import type TValueBinding from "../../../types/TValueBinding";
import type TPostfixOpSyntax from "../../../types/syntax/TPostfixOpSyntax";

/** The declaration a written spelling reaches, and what follows it */
interface IWrittenBinding {
  readonly binding: TValueBinding | null;
  /** The member the binding is, as written: `x` in `S.x` */
  readonly name: string;
  /** What follows it: `[0]` in `S.x[0]` */
  readonly ops: readonly TPostfixOpSyntax[];
}

export default IWrittenBinding;
