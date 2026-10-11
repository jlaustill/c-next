import type BINARY_OPERATORS from "./BINARY_OPERATORS";

/** One of `BINARY_OPERATORS` */
type TBinaryOperator = (typeof BINARY_OPERATORS)[number];

export default TBinaryOperator;
