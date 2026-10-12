import type ICFieldSyntax from "./ICFieldSyntax";

interface ICStructSyntax {
  readonly tag: string | null;
  readonly isUnion: boolean;
  readonly hasBody: boolean;
  readonly fields: readonly ICFieldSyntax[];
}

export default ICStructSyntax;
