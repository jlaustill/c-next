/**
 * The declaration modifiers a variable is emitted with, already rendered.
 *
 * Every field is the C text INCLUDING its trailing space, or `""` -- so a
 * declaration is assembled by concatenation and an absent modifier
 * contributes nothing. `atomic` renders as `volatile ` because that is what
 * ADR-020 maps it to in C; it stays a separate field because the two cannot
 * both be present and the diagnostic that says so needs to know which was
 * written.
 *
 * #1445: extracted because `StringDeclHelper` declared it a second time, as
 * `IStringDeclModifiers`, with the same four string fields -- so the #1642 fix
 * (a bounded string with an initializer was dropping `atomic`/`volatile`) had
 * to be reasoned about across two declarations of one shape.
 *
 * ## Not to be confused with `IVariableFormatInput`'s `IVariableModifiers`
 *
 * That one holds the same four modifiers as BOOLEANS -- `isConst`, `isAtomic`,
 * `isVolatile`, `isExtern` -- for the formatter that decides their order. This
 * one holds the decided text. Both spellings are needed and the distinction is
 * which side of the ordering decision you are on; naming this one
 * `IVariableModifiers` too, as the deleted declaration effectively did, put two
 * different shapes under one name in one directory.
 */
interface IRenderedModifiers {
  /** `"const "` or `""` */
  const: string;
  /** `"volatile "` for the `atomic` modifier, or `""` */
  atomic: string;
  /** `"volatile "` for the `volatile` modifier, or `""` */
  volatile: string;
  /** `"extern "` for a top-level const in C++, or `""` */
  extern: string;
}

export default IRenderedModifiers;
