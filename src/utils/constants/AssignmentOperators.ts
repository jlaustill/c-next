/**
 * Maps C-Next assignment operators to C assignment operators.
 *
 * C-Next uses `<-` for assignment (to distinguish from `=` equality),
 * with compound variants like `+<-`, `-<-`, etc.
 */
const ASSIGNMENT_OPERATOR_MAP: Readonly<Record<string, string>> = {
  "<-": "=",
  "+<-": "+=",
  "-<-": "-=",
  "*<-": "*=",
  "/<-": "/=",
  "%<-": "%=",
  "&<-": "&=",
  "|<-": "|=",
  "^<-": "^=",
  "<<<-": "<<=",
  ">><-": ">>=",
};

export default ASSIGNMENT_OPERATOR_MAP;
