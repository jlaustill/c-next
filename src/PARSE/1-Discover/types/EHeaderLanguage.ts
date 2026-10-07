/** #1844: the language 1.1 Discover judged a header to be written in. */
enum EHeaderLanguage {
  C = "c",
  Cpp = "cpp",
  /** Assembler (e.g. xtensa coreasm.h): not C, so no symbols are read from it */
  Assembler = "assembler",
}

export default EHeaderLanguage;
