/**
 * ADR-029's per-file half: where one file names what may be a function, in a
 * position a C callback could be expected (#1825).
 *
 * Two shapes, both from #895: a variable declared with an initializer
 * (`PointCallback cb <- my_handler;`) and a call argument
 * (`global.widget_set_flush_cb(w, my_flush);`). Neither is a callback yet --
 * that needs the C header's typedef, and whether the name is a function at all
 * needs every file's declarations (#1544) -- so 1.4 decides
 * (`CallbackCompatibility`), and this records only what the file spells.
 *
 * This walk sat in 2.1 Analyze inside `FunctionCallAnalyzer`, and the
 * orchestrator ran the whole analyzer over every tree, diagnostics discarded,
 * for the map it filled as a side effect.
 */

import type TCallbackUse from "../../../../types/TCallbackUse";
import type IFunctionDeclarationSyntax from "../../../../types/syntax/IFunctionDeclarationSyntax";
import type IProgramSyntax from "../../../../types/syntax/IProgramSyntax";
import type TExpression from "../../../../types/syntax/TExpression";
import type TStatement from "../../../../types/syntax/TStatement";
import ExpressionShape from "../../../../utils/ExpressionShape";
import ScopeUtils from "../../../../utils/ScopeUtils";
import StatementChildren from "../../../../utils/StatementChildren";

class CallbackUseCollector {
  /**
   * @param scopePathOf the path of a scope this file declares, by name
   * @returns every candidate use, in source order
   */
  static collect(
    program: IProgramSyntax,
    scopePathOf: (scopeName: string) => string,
  ): TCallbackUse[] {
    const uses: TCallbackUse[] = [];
    for (const { declaration } of program.declarations) {
      if (declaration.kind === "function") {
        CallbackUseCollector.scanFunction(uses, declaration, "");
        continue;
      }
      // Issue #895: every member function of a scope, which may name its
      // siblings as `this.member`.
      if (declaration.kind === "scope") {
        const scopePath = scopePathOf(declaration.name);
        for (const member of declaration.members) {
          if (member.declaration.kind === "function") {
            CallbackUseCollector.scanFunction(
              uses,
              member.declaration,
              scopePath,
            );
          }
        }
      }
    }
    return uses;
  }

  /**
   * @param scopePath the scope the function is a member of, which `this.`
   *        names; `""` for a standalone function
   */
  private static scanFunction(
    uses: TCallbackUse[],
    funcDecl: IFunctionDeclarationSyntax,
    scopePath: string,
  ): void {
    CallbackUseCollector.scanStatements(
      uses,
      funcDecl.body.statements,
      scopePath,
    );
  }

  /**
   * Scan statements, recursing into every statement they hold (#2003).
   */
  private static scanStatements(
    uses: TCallbackUse[],
    statements: readonly TStatement[],
    scopePath: string,
  ): void {
    for (const statement of statements) {
      if (statement.kind === "variableDeclaration") {
        // Check variable declarations for callback assignments
        CallbackUseCollector.recordInitializer(uses, statement, scopePath);
      } else if (statement.kind === "expression") {
        // Check expression statements for function calls with callback
        // arguments
        CallbackUseCollector.recordArguments(
          uses,
          statement.expression,
          scopePath,
        );
      } else {
        CallbackUseCollector.scanStatements(
          uses,
          StatementChildren.of(statement),
          scopePath,
        );
      }
    }
  }

  /**
   * `PointCallback cb <- my_handler;` -- a declaration whose initializer names
   * what may be a function.
   */
  private static recordInitializer(
    uses: TCallbackUse[],
    varDecl: Extract<TStatement, { kind: "variableDeclaration" }>,
    scopePath: string,
  ): void {
    if (!varDecl.initializer) return;
    const functionName = CallbackUseCollector.functionReference(
      varDecl.initializer,
      scopePath,
    );
    if (!functionName) return;
    uses.push({
      kind: "initializer",
      functionName,
      typeName: varDecl.type.text,
    });
  }

  /**
   * Issue #895: `global.widget_set_flush_cb(w, my_flush)` -- a call whose
   * arguments name what may be functions. Whether the callee is a C function
   * and the parameter a function pointer typedef is 1.4's question.
   */
  private static recordArguments(
    uses: TCallbackUse[],
    expr: TExpression,
    scopePath: string,
  ): void {
    const callInfo = CallbackUseCollector.extractCallInfo(expr);
    if (!callInfo) return;
    for (const [argIndex, arg] of callInfo.args.entries()) {
      const functionName = CallbackUseCollector.functionReference(
        arg,
        scopePath,
      );
      if (!functionName) continue;
      uses.push({
        kind: "argument",
        functionName,
        callee: callInfo.funcName,
        argIndex,
      });
    }
  }

  /**
   * The lookup key of a function reference -- the transpiled C name it spells
   * -- or null if the expression is not one. Matches:
   *   - Bare identifiers: "my_handler"
   *   - Qualified scope names: "MyScope.handler"
   *   - Self-scope reference: "this.handler", in the enclosing scope
   *   - Global scope reference: "global.ScopeName.handler"
   */
  private static functionReference(
    expr: TExpression,
    scopePath: string,
  ): string | null {
    const view = ExpressionShape.postfixView(expr);
    if (!view) return null;
    const members: string[] = [];
    for (const op of view.ops) {
      if (op.kind !== "member") return null;
      members.push(op.name);
    }
    const { primary } = view;
    if (primary.kind === "identifier") {
      if (members.length > 1) return null;
      return members.length === 0
        ? primary.name
        : ScopeUtils.qualifyPathInScope([primary.name, ...members], "");
    }
    if (primary.kind !== "root") return null;
    // this.member -> CurrentScope.member (Issue #895), outside a scope nothing
    if (primary.root === "this") {
      return members.length === 1 && scopePath
        ? ScopeUtils.qualifyInScope(members[0], scopePath)
        : null;
    }
    // global.Scope.member -> Scope.member (Issue #895)
    return members.length === 2
      ? ScopeUtils.qualifyPathInScope(members, "")
      : null;
  }

  /**
   * The function name and arguments of a call statement's expression, or
   * null if it is not a call on a name or a `global.` path.
   */
  private static extractCallInfo(
    expr: TExpression,
  ): { funcName: string; args: readonly TExpression[] } | null {
    if (expr.kind !== "postfix") return null;
    const { primary } = expr;
    // For 'global', the path starts empty and gets built from member access
    let path: string[];
    if (primary.kind === "identifier") {
      path = [primary.name];
    } else if (primary.kind === "root" && primary.root === "global") {
      path = [];
    } else {
      return null;
    }
    for (const op of expr.ops) {
      if (op.kind === "member") {
        // Member access: one more component of the qualified name
        path.push(op.name);
      } else if (op.kind === "call") {
        if (path.length === 0) return null;
        return {
          funcName: ScopeUtils.qualifyPathInScope(path, ""),
          args: op.arguments,
        };
      }
    }
    return null;
  }
}

export default CallbackUseCollector;
