/**
 * File types supported by the transpiler
 */
enum EFileType {
  CNext = "cnext",
  CHeader = "c_header",
  CppHeader = "cpp_header",
  CSource = "c_source",
  CppSource = "cpp_source",
  Unknown = "unknown",
}

export default EFileType;
