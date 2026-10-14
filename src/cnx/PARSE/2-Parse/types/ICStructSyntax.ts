import type ICFieldSyntax from "./ICFieldSyntax";

interface ICStructSyntax {
  readonly tag: string | null;
  readonly isUnion: boolean;
  /** Whether a field is a bit-field (`uint32_t a : 3`), which C packs */
  readonly hasBitField: boolean;
  readonly hasBody: boolean;
  readonly fields: readonly ICFieldSyntax[];
}

export default ICStructSyntax;
