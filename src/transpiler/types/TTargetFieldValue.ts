/**
 * ADR-049: the only values a target description may hold -- an unsigned
 * integer, a Boolean or a string -- so no reader has to evaluate code to learn
 * a target.
 */
type TTargetFieldValue = number | boolean | string;

export default TTargetFieldValue;
