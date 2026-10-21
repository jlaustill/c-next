/**
 * File types supported by the transpiler
 */
enum EFileType {
  CNext = "cnext",
  /** `.cnx` in any case but lowercase (#1833, E0518), or `.cnext` (#2167, E0519) */
  RejectedCNext = "rejected_cnext",
  CHeader = "c_header",
  CppHeader = "cpp_header",
  CSource = "c_source",
  CppSource = "cpp_source",
  Unknown = "unknown",
}

export default EFileType;
