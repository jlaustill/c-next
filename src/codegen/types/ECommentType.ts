/**
 * Comment type enumeration (ADR-043)
 */
enum ECommentType {
  Line = "line", // //
  Block = "block", // /* */
  Doc = "doc", // ///
}

export default ECommentType;
