/**
 * Assignment operator mapping from C-Next to C.
 *
 * Shared between AssignmentContextBuilder and ControlFlowGenerator
 * to avoid duplication.
 */

/** Maps C-Next assignment operators to C assignment operators */
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
