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
import * as Parser from "../../../2-Parse/grammar/CNextParser";
import ExpressionUnwrapper from "../../../../utils/ExpressionUnwrapper";
import ScopeUtils from "../../../../utils/ScopeUtils";

class CallbackUseCollector {
  /**
   * @param scopePathOf the path of a scope this file declares, by name
   * @returns every candidate use, in source order
   */
  static collect(
    tree: Parser.ProgramContext,
    scopePathOf: (scopeName: string) => string,
  ): TCallbackUse[] {
    const uses: TCallbackUse[] = [];
    for (const decl of tree.declaration()) {
      const funcDecl = decl.functionDeclaration();
      if (funcDecl) {
        CallbackUseCollector.scanFunction(uses, funcDecl, "");
        continue;
      }

      // Issue #895: every member function of a scope, which may name its
      // siblings as `this.member`.
      const scopeDecl = decl.scopeDeclaration();
      if (scopeDecl) {
        const scopePath = scopePathOf(scopeDecl.IDENTIFIER().getText());
        for (const member of scopeDecl.scopeMember()) {
          const memberFunc = member.functionDeclaration();
          if (memberFunc) {
            CallbackUseCollector.scanFunction(uses, memberFunc, scopePath);
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
    funcDecl: Parser.FunctionDeclarationContext,
    scopePath: string,
  ): void {
    const block = funcDecl.block();
    if (!block) return;
    CallbackUseCollector.scanBlock(uses, block, scopePath);
  }

  /**
   * Recursively scan all statements in a block.
   */
  private static scanBlock(
    uses: TCallbackUse[],
    block: Parser.BlockContext,
    scopePath: string,
  ): void {
    for (const stmt of block.statement()) {
      CallbackUseCollector.scanStatement(uses, stmt, scopePath);
    }
  }

  /**
   * Scan a single statement, recursing into nested blocks
   * (if/while/for/do-while/switch/critical).
   */
  private static scanStatement(
    uses: TCallbackUse[],
    stmt: Parser.StatementContext,
    scopePath: string,
  ): void {
    // Check variable declarations for callback assignments
    const varDecl = stmt.variableDeclaration();
    if (varDecl) {
      CallbackUseCollector.recordInitializer(uses, varDecl, scopePath);
      return;
    }

    // Check expression statements for function calls with callback arguments
    const exprStmt = stmt.expressionStatement();
    if (exprStmt) {
      CallbackUseCollector.recordArguments(
        uses,
        exprStmt.expression(),
        scopePath,
      );
      return;
    }

    // Recurse into nested blocks/statements
    const ifStmt = stmt.ifStatement();
    if (ifStmt) {
      for (const child of ifStmt.statement()) {
        CallbackUseCollector.scanStatement(uses, child, scopePath);
      }
      return;
    }

    const whileStmt = stmt.whileStatement();
    if (whileStmt) {
      CallbackUseCollector.scanStatement(
        uses,
        whileStmt.statement(),
        scopePath,
      );
      return;
    }

    const forStmt = stmt.forStatement();
    if (forStmt) {
      CallbackUseCollector.scanStatement(uses, forStmt.statement(), scopePath);
      return;
    }

    const doWhileStmt = stmt.doWhileStatement();
    if (doWhileStmt) {
      CallbackUseCollector.scanBlock(uses, doWhileStmt.block(), scopePath);
      return;
    }

    const switchStmt = stmt.switchStatement();
    if (switchStmt) {
      for (const caseCtx of switchStmt.switchCase()) {
        CallbackUseCollector.scanBlock(uses, caseCtx.block(), scopePath);
      }
      const defaultCtx = switchStmt.defaultCase();
      if (defaultCtx) {
        CallbackUseCollector.scanBlock(uses, defaultCtx.block(), scopePath);
      }
      return;
    }

    const criticalStmt = stmt.criticalStatement();
    if (criticalStmt) {
      CallbackUseCollector.scanBlock(uses, criticalStmt.block(), scopePath);
      return;
    }

    // A statement can itself be a block
    const nestedBlock = stmt.block();
    if (nestedBlock) {
      CallbackUseCollector.scanBlock(uses, nestedBlock, scopePath);
    }
  }

  /**
   * `PointCallback cb <- my_handler;` -- a declaration whose initializer names
   * what may be a function.
   */
  private static recordInitializer(
    uses: TCallbackUse[],
    varDecl: Parser.VariableDeclarationContext,
    scopePath: string,
  ): void {
    const expr = varDecl.expression();
    if (!expr) return;

    const functionName = CallbackUseCollector.functionReference(
      expr,
      scopePath,
    );
    if (!functionName) return;

    uses.push({
      kind: "initializer",
      functionName,
      typeName: varDecl.type().getText(),
    });
  }

  /**
   * Issue #895: `global.widget_set_flush_cb(w, my_flush)` -- a call whose
   * arguments name what may be functions. Whether the callee is a C function
   * and the parameter a function pointer typedef is 1.4's question.
   */
  private static recordArguments(
    uses: TCallbackUse[],
    expr: Parser.ExpressionContext,
    scopePath: string,
  ): void {
    // Uses ExpressionUnwrapper, which validates that the expression is
    // "simple" (single term at each level), so a complex one yields nothing.
    const postfix = ExpressionUnwrapper.getPostfixExpression(expr);
    if (!postfix) return;

    const callInfo = CallbackUseCollector.extractCallInfo(postfix);
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
    expr: Parser.ExpressionContext,
    scopePath: string,
  ): string | null {
    const text = expr.getText();

    // Pattern 1: this.member -> CurrentScope.member (Issue #895)
    const thisMatch = /^this\.(\w+)$/.exec(text);
    if (thisMatch) {
      if (!scopePath) {
        return null; // this.member outside scope context
      }
      return ScopeUtils.qualifyInScope(thisMatch[1], scopePath);
    }

    // Pattern 2: global.Scope.member -> Scope.member (Issue #895)
    const globalMatch = /^global\.(\w+)\.(\w+)$/.exec(text);
    if (globalMatch) {
      return ScopeUtils.qualifyPathInScope(
        [globalMatch[1], globalMatch[2]],
        "",
      );
    }

    // Pattern 3: Bare identifier or simple Scope.member. An identifier cannot
    // start with a digit, and `\w` alone would read `5` as one.
    const simpleMatch = /^([A-Za-z_]\w*)(?:\.(\w+))?$/.exec(text);
    if (simpleMatch) {
      return simpleMatch[2]
        ? ScopeUtils.qualifyPathInScope([simpleMatch[1], simpleMatch[2]], "")
        : simpleMatch[1];
    }

    return null;
  }

  /**
   * Extract function name and arguments from a postfix expression.
   * Returns null if not a function call.
   */
  private static extractCallInfo(
    postfix: Parser.PostfixExpressionContext,
  ): { funcName: string; args: Parser.ExpressionContext[] } | null {
    const primary = postfix.primaryExpression();
    const ops = postfix.postfixOp();

    // Start with primary expression (identifier or 'global')
    const ident = primary.IDENTIFIER();
    const globalKw = primary.GLOBAL();

    // Early return: neither identifier nor global keyword means not a function call
    if (!ident && !globalKw) {
      return null;
    }

    // Build function name from primary + member access ops
    // For 'global' keyword, the path starts empty and gets built from member access
    const path: string[] = ident ? [ident.getText()] : [];
    let argListOp: Parser.PostfixOpContext | null = null;

    // Walk postfix ops to find function name and call
    for (const op of ops) {
      if (op.IDENTIFIER()) {
        // Member access: one more component of the qualified name
        path.push(op.IDENTIFIER()!.getText());
      } else if (op.argumentList() || op.getText().startsWith("(")) {
        // Found the call - this op has the arguments
        argListOp = op;
        break;
      }
    }

    if (!argListOp || path.length === 0) return null;
    const funcName = ScopeUtils.qualifyPathInScope(path, "");

    // Extract arguments
    const argList = argListOp.argumentList();
    const args = argList?.expression() ?? [];

    return { funcName, args };
  }
}

export default CallbackUseCollector;
