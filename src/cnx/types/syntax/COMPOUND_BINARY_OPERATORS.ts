import type TAssignmentOperator from "./TAssignmentOperator";
import type TBinaryOperator from "./TBinaryOperator";

/**
 * The binary operator each compound assignment applies: `x op<- y` is
 * `x <- x op y`, so a rule about `op` is a rule about `op<-` (#1770)
 */
const COMPOUND_BINARY_OPERATORS: Readonly<
  Record<Exclude<TAssignmentOperator, "<-">, TBinaryOperator>
> = {
  "+<-": "+",
  "-<-": "-",
  "*<-": "*",
  "/<-": "/",
  "%<-": "%",
  "&<-": "&",
  "|<-": "|",
  "^<-": "^",
  "<<<-": "<<",
  ">><-": ">>",
};

export default COMPOUND_BINARY_OPERATORS;
