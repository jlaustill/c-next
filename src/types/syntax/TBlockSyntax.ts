import type ISyntaxNode from "./ISyntaxNode";
import type TStatement from "./TStatement";

/** `{ ... }`: its statements, in order */
type TBlockSyntax = ISyntaxNode & {
  readonly statements: readonly TStatement[];
};

export default TBlockSyntax;
