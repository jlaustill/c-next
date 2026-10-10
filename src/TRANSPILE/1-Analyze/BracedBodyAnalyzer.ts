/**
 * E0716: an `if`, `else`, `while` or `for` body must be a braced block (#1090).
 *
 * MISRA C:2012 Rule 15.6 requires the body of every selection and iteration
 * statement to be a compound statement, and ADR-027 records it as enforced.
 * `do`-`while` and `forever` already take a `block` in the grammar; these four
 * take a `statement`, so an unbraced body parsed and passed through to the C.
 * An unbraced declaration was worse (#1795): C rejects it, and its name stayed
 * in scope after the `if`.
 *
 * `else if` is the one unbraced `else` body allowed: the `if` is the chain,
 * and each of its own bodies is checked here.
 *
 * 1.2's syntax already says whether a body is a block, so this reads it and
 * holds no parse tree.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type TStatement from "../../types/syntax/TStatement";
import IBracedBodyError from "./types/IBracedBodyError";

type TBodyKeyword = "if" | "else" | "while" | "for";

class BracedBodyAnalyzer {
  private readonly found: IBracedBodyError[] = [];

  public analyze(program: IProgramSyntax): IBracedBodyError[] {
    for (const { declaration } of program.declarations) {
      this.declaration(declaration);
    }
    return this.found;
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
    for (const statement of statements) this.statement(statement);
  }

  private statement(statement: TStatement): void {
    switch (statement.kind) {
      case "if":
        this.body("if", statement.whenTrue);
        if (statement.whenFalse?.kind === "if") {
          this.statement(statement.whenFalse);
        } else if (statement.whenFalse !== null) {
          this.body("else", statement.whenFalse);
        }
        return;
      case "while":
        this.body("while", statement.body);
        return;
      case "for":
        this.body("for", statement.body);
        return;
      case "doWhile":
      case "forever":
      case "critical":
        this.statements(statement.body.statements);
        return;
      case "switch":
        for (const switchCase of statement.cases) {
          this.statements(switchCase.body.statements);
        }
        if (statement.defaultCase !== null) {
          this.statements(statement.defaultCase.body.statements);
        }
        return;
      case "block":
        this.statements(statement.statements);
        return;
      default:
        return;
    }
  }

  private body(keyword: TBodyKeyword, body: TStatement): void {
    if (body.kind !== "block" && body.kind !== "missing") {
      const { line, column } = body.span;
      this.found.push({
        code: "E0716",
        line,
        column,
        message: `'${keyword}' body must be a braced block`,
        helpText: `Wrap the body in braces: \`${keyword === "else" ? "else" : `${keyword} (...)`} { ... }\` (MISRA C:2012 Rule 15.6)`,
      });
    }
    this.statement(body);
  }
}

export default BracedBodyAnalyzer;
