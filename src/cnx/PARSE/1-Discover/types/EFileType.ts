/**
 * File types supported by the transpiler
 */
enum EFileType {
  CNext = "cnext",
  /** #1833: a C-Next extension in any case but lowercase -- E0518 */
  MiscasedCNext = "miscased_cnext",
  CHeader = "c_header",
  CppHeader = "cpp_header",
  CSource = "c_source",
  CppSource = "cpp_source",
  Unknown = "unknown",
}

export default EFileType;
