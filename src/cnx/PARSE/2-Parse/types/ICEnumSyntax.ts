import type ISourceSpan from "../../../types/ISourceSpan";

interface ICEnumSyntax {
  readonly name: string | null;
  readonly members: readonly {
    readonly name: string;
    readonly span: ISourceSpan;
  }[];
}

export default ICEnumSyntax;
