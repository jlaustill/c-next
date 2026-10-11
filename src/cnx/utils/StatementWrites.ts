import type IAssignmentSyntax from "../types/syntax/IAssignmentSyntax";
import type TStatement from "../types/syntax/TStatement";

/**
 * The assignments a statement performs itself, in source order (#2010): an
 * assignment statement, or a `for` header's init and update. Not those of the
 * statements nested inside it (`StatementChildren`). Every kind has an arm, so
 * a new kind does not compile until it is placed.
 */
class StatementWrites {
  static of(statement: TStatement): readonly IAssignmentSyntax[] {
    switch (statement.kind) {
      case "assignment":
        return [statement];
      case "for": {
        const writes: IAssignmentSyntax[] = [];
        if (statement.init?.kind === "assignment") writes.push(statement.init);
        if (statement.update !== null) writes.push(statement.update);
        return writes;
      }
      case "variableDeclaration":
      case "constructorDeclaration":
      case "expression":
      case "if":
      case "while":
      case "doWhile":
      case "forever":
      case "switch":
      case "return":
      case "critical":
      case "block":
      case "missing":
        return [];
      default: {
        const unplaced: never = statement;
        return unplaced;
      }
    }
  }
}

export default StatementWrites;
