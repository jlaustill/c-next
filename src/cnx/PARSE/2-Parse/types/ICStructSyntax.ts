import type ICFieldSyntax from "./ICFieldSyntax";

interface ICStructSyntax {
  readonly tag: string | null;
  readonly isUnion: boolean;
  /** Whether a field is a bit-field (`uint32_t a : 3`), which C packs */
  readonly hasBitField: boolean;
  /**
   * #1975 review: a member with no name, `union { ... };` or `struct { ...
   * };`, whose fields the struct holds but `fields` does not list
   */
  readonly hasUnnamedMember: boolean;
  readonly hasBody: boolean;
  readonly fields: readonly ICFieldSyntax[];
}

export default ICStructSyntax;
