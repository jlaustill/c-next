import type TDeclarationSyntax from "../types/syntax/TDeclarationSyntax";
import type TStatement from "../types/syntax/TStatement";
import StatementChildren from "./StatementChildren";

/**
 * Every lowered statement in a declaration, in source order (#1991): the
 * nested ones, and a `for`'s init, which 1.2 lowers as a statement but
 * `StatementChildren` does not list, because it is not one of the loop's
 * children.
 */
class StatementNodes {
  static in(declaration: TDeclarationSyntax): readonly TStatement[] {
    if (declaration.kind === "scope") {
      return declaration.members.flatMap((member) =>
        StatementNodes.in(member.declaration),
      );
    }
    return declaration.kind === "function"
      ? StatementNodes.of(declaration.body.statements)
      : [];
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
