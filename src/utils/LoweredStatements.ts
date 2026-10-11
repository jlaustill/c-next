import type IProgramSyntax from "../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../types/syntax/TDeclarationSyntax";
import type TStatement from "../types/syntax/TStatement";
import type ISourceSpan from "../types/ISourceSpan";
import StatementChildren from "./StatementChildren";
import invariant from "./invariant";

/** Where a statement starts */
type TStart = Pick<ISourceSpan, "line" | "column">;

/**
 * A program's lowered statements, found by kind and where they start (#2003).
 * A 2.1 listener that walks the parse tree for its expressions asks here for
 * a statement's parts by role -- whether an `if` has an `else`, which
 * statement is a loop's body -- so which child is which is decided once, by
 * `StatementLowering`, and every statement inside is reached through
 * `StatementChildren`.
 */
class LoweredStatements {
  private readonly byStart = new Map<string, TStatement>();

  constructor(program: IProgramSyntax) {
    for (const { declaration } of program.declarations) {
      this.declaration(declaration);
    }
  }

  /** The `kind` statement that starts at `start`; 1.2 lowered every one */
  at<K extends TStatement["kind"]>(
    kind: K,
    start: TStart,
  ): Extract<TStatement, { kind: K }> {
    const found = this.byStart.get(LoweredStatements.key(kind, start));
    invariant(
      found?.kind === kind,
      `1.2 lowered no ${kind} statement at ${start.line}:${start.column}`,
    );
    return found as Extract<TStatement, { kind: K }>;
  }

  /** Whether `statement` starts at `start` */
  static startsAt(statement: TStatement, start: TStart): boolean {
    return (
      statement.span.line === start.line &&
      statement.span.column === start.column
    );
  }

  private declaration(declaration: TDeclarationSyntax): void {
    if (declaration.kind === "scope") {
      for (const member of declaration.members) {
        this.declaration(member.declaration);
      }
    } else if (declaration.kind === "function") {
      this.statements(declaration.body.statements);
    }
  }

  private statements(statements: readonly TStatement[]): void {
    for (const statement of statements) {
      this.byStart.set(
        LoweredStatements.key(statement.kind, statement.span),
        statement,
      );
      this.statements(StatementChildren.of(statement));
    }
  }

  private static key(kind: TStatement["kind"], start: TStart): string {
    return `${kind}@${start.line}:${start.column}`;
  }
}

export default LoweredStatements;
