import type EHeaderLanguage from "./EHeaderLanguage";

/**
 * #985, #1844: one header's own part of the translation unit 1.1 preprocessed
 * from every `.cnx` file's C includes, and the language 1.1 judged it.
 */
interface IRecoveredSlice {
  readonly text: string;
  readonly language: EHeaderLanguage;
  /**
   * The unit's include through which the compile entered it, or null for a
   * file met before any include (the toolchain's predefined macros)
   */
  readonly directive: string | null;
}

export default IRecoveredSlice;
