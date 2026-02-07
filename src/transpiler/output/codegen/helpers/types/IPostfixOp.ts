/**
 * Postfix operator info (abstracted from parser context)
 * Used by CppMemberHelper for testable C++ member conversion logic
 */
type IPostfixOp = {
  hasExpression: boolean;
  hasIdentifier: boolean;
  hasArgumentList: boolean;
  textEndsWithParen: boolean;
};

export default IPostfixOp;
