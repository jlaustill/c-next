import type TDeclarationSyntax from "../types/syntax/TDeclarationSyntax";
import type IAssignmentSyntax from "../types/syntax/IAssignmentSyntax";
import type TStatement from "../types/syntax/TStatement";
import StatementChildren from "./StatementChildren";
import StatementWrites from "./StatementWrites";

/**
 * Every lowered statement in a declaration, in source order (#1991): the
 * nested ones, and a `for`'s init, which 1.2 lowers as a statement but
 * `StatementChildren` does not list, because it is not one of the loop's
 * children.
 */
class StatementNodes {
  static in(declaration: TDeclarationSyntax): readonly TStatement[] {
    return StatementNodes.of(StatementNodes.roots(declaration));
  }

  /** A declaration's outermost statements: a function's body, each scope member's */
  static roots(declaration: TDeclarationSyntax): readonly TStatement[] {
    if (declaration.kind === "scope") {
      return declaration.members.flatMap((member) =>
        StatementNodes.roots(member.declaration),
      );
    }
    return declaration.kind === "function" ? declaration.body.statements : [];
  }

  /**
   * Every assignment site, in source order: each statement's own writes
   * (`StatementWrites`), so a `for` header's init and update are counted once,
   * at the loop, ahead of its body. Not `in(...).flatMap(StatementWrites.of)`:
   * `in` lists a `for`'s init as a statement too, which would count it twice.
   */
  static assignments(
    declaration: TDeclarationSyntax,
  ): readonly IAssignmentSyntax[] {
    const walk = (
      statements: readonly TStatement[],
    ): readonly IAssignmentSyntax[] =>
      statements.flatMap((statement) => [
        ...StatementWrites.of(statement),
        ...walk(StatementChildren.of(statement)),
      ]);
    return walk(StatementNodes.roots(declaration));
  }

  static of(statements: readonly TStatement[]): readonly TStatement[] {
    return statements.flatMap((statement) => [
      statement,
      ...(statement.kind === "for" && statement.init !== null
        ? [statement.init]
        : []),
      ...StatementNodes.of(StatementChildren.of(statement)),
    ]);
  }
}

export default StatementNodes;
