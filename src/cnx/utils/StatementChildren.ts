import type TStatement from "../types/syntax/TStatement";

/**
 * The statements nested directly inside a statement, in source order (#2003).
 * Which child is which is the lowered statement's own shape (`TStatement`,
 * from `StatementLowering`); a walker that needs only every nested statement
 * asks here. A `for`'s init and update are its own parts, not nested
 * statements. Every kind has an arm, so a new kind does not compile until it
 * is placed.
 */
class StatementChildren {
  static of(statement: TStatement): readonly TStatement[] {
    switch (statement.kind) {
      case "if":
        return statement.whenFalse === null
          ? [statement.whenTrue]
          : [statement.whenTrue, statement.whenFalse];
      case "while":
      case "for":
        return [statement.body];
      case "doWhile":
      case "forever":
      case "critical":
        return statement.body.statements;
      case "switch":
        return [
          ...statement.cases.flatMap(
            (switchCase) => switchCase.body.statements,
          ),
          ...(statement.defaultCase?.body.statements ?? []),
        ];
      case "block":
        return statement.statements;
      case "variableDeclaration":
      case "constructorDeclaration":
      case "assignment":
      case "expression":
      case "return":
      case "missing":
        return [];
      default: {
        const unplaced: never = statement;
        return unplaced;
      }
    }
  }
}

export default StatementChildren;
