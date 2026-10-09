/** The grammar's `assignmentOperator` alternatives (ADR-001) */
const ASSIGNMENT_OPERATORS = [
  "<-",
  "+<-",
  "-<-",
  "*<-",
  "/<-",
  "%<-",
  "&<-",
  "|<-",
  "^<-",
  "<<<-",
  ">><-",
] as const;

export default ASSIGNMENT_OPERATORS;
