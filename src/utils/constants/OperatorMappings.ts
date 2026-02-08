/**
 * Operator mapping from C-Next assignment operators to C assignment operators.
 * Used by assignment handling and control flow generation.
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
