/**
 * ADR-035: an array's list initializer has one element per slot at every
 * level (E0866), or the fill-all form `[v*]` for a level.
 *
 * #1322. Codegen counted the elements it had just generated, the outer list
 * only, so `u8[2][2] m <- [[1, 2, 3], [4, 5]]` was accepted and reached C as an
 * excess-elements initializer. One rule now, with the declared dimensions
 * read off the type and the elements counted off the list -- at EVERY level.
 *
 * A declared size is a value -- `u8[SIZE]` with a scope's own `SIZE` -- so
 * this is 2.1's. Whether the brackets, the sizes and the initializer are
 * written in an accepted form is syntax, and 1.2's `ArrayForm` reports it
 * (#1991): a declaration that reaches here is one 1.2 accepted.
 */

import ArrayListCount from "./helpers/ArrayListCount";
import ConstantExpression from "./helpers/ConstantExpression";
import StatementNodes from "../../utils/StatementNodes";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import IArrayDeclarationError from "./types/IArrayDeclarationError";
import type IAnalysisContext from "./types/IAnalysisContext";

type TDimension = number | string | null;

class ArrayDeclarationCheck {
  private readonly found: IArrayDeclarationError[] = [];

  constructor(private readonly context: IAnalysisContext) {}

  public errors(): IArrayDeclarationError[] {
    return this.found;
  }

  /** Every variable declaration: file scope, scope members, and statements */
  public declaration(declaration: TDeclarationSyntax): void {
    if (declaration.kind === "scope") {
      for (const member of declaration.members) {
        this.declaration(member.declaration);
      }
      return;
    }
    if (declaration.kind === "variableDeclaration") this.variable(declaration);
    if (declaration.kind !== "function") return;
    for (const statement of StatementNodes.of(declaration.body.statements)) {
      if (statement.kind === "variableDeclaration") this.variable(statement);
    }
  }

  private variable(declaration: IVariableDeclarationSyntax): void {
    const type = declaration.type;
    const initializer = declaration.initializer;
    if (type.kind !== "array" || initializer?.kind !== "arrayInitializer") {
      return;
    }
    const sizes: TDimension[] = type.dimensions.map((size) =>
      size === null
        ? null
        : (ConstantExpression.valueAt(size, this.context) ?? size.written),
    );
    this.found.push(
      ...ArrayListCount.mismatches(initializer, sizes, type.element.text),
    );
  }
}

class ArrayDeclarationAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  /** 1.2's declarations, in source order (#1991) */
  public analyze(program: IProgramSyntax): IArrayDeclarationError[] {
    const check = new ArrayDeclarationCheck(this.context);
    for (const member of program.declarations) {
      check.declaration(member.declaration);
    }
    return check.errors();
  }
}

export default ArrayDeclarationAnalyzer;
