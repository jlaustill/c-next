/**
 * ADR-006's per-file half: what one file's functions do to their own
 * parameters, and which calls they pass them to (#1825).
 *
 * Collected in 1.3 Declare because every fact here is spelled in the file's own
 * function bodies: a parameter list, a direct write to a parameter, a call that
 * forwards one. Whether that call's callee modifies the parameter it receives is
 * a different question -- the callee is routinely in another file -- and is
 * 1.4's (`ModificationFacts`), which is why a bare callee is recorded as written
 * rather than resolved (`IDeclaredCall`).
 *
 * This walk sat in 2.2 Plan as the collection half of `PassByValueAnalyzer`,
 * and the orchestrator ran it ahead of 1.4 to feed `Program.build` -- a fact
 * 1.4 owns, computed by a later pass's code because `PARSE/` may not import
 * `TRANSPILE/`. The analyzer kept its render-time query half.
 *
 * Issue #1100: Subscript access no longer forces pointer semantics on its
 * own. A scalar parameter subscripted with a single index is bit-indexing
 * (ADR-007), not array access, so it stays eligible for pass-by-value.
 * Only genuine array parameters (`isArray`, from explicit `T[N]` syntax,
 * ADR-006) are excluded -- by `Program`, which decides eligibility.
 */

import type IModificationCollector from "../types/IModificationCollector";
import type IFileModifications from "../../../../types/IFileModifications";
import * as Parser from "../../../2-Parse/grammar/CNextParser";
import ScopeUtils from "../../../../utils/ScopeUtils";
import StatementExpressionCollector from "../../../../utils/ast/StatementExpressionCollector";
import ChildStatementCollector from "../../../../utils/ast/ChildStatementCollector";
import AssignmentTargetExtractor from "../../../../utils/ast/AssignmentTargetExtractor";
import ExpressionUtils from "../../../../utils/ExpressionUtils";

class ModificationCollector {
  /**
   * Walk all functions to collect:
   * - Parameter lists (for call graph resolution)
   * - Direct modifications (param <- value)
   * - Function calls where params are passed as arguments
   *
   * @param scopePathOf the path of a scope this file declares, by name
   */
  static collect(
    tree: Parser.ProgramContext,
    scopePathOf: (scopeName: string) => string,
  ): IFileModifications {
    const collect: IModificationCollector = {
      modifiedParameters: new Map(),
      functionParamLists: new Map(),
      functionCallGraph: new Map(),
    };

    for (const decl of tree.declaration()) {
      // Handle scope-level functions
      if (decl.scopeDeclaration()) {
        const scopeDecl = decl.scopeDeclaration()!;
        // #1298: the whole scope PATH, so qualification keeps every outer
        // component.
        const scopePath = scopePathOf(scopeDecl.IDENTIFIER().getText());

        for (const member of scopeDecl.scopeMember()) {
          if (member.functionDeclaration()) {
            const funcDecl = member.functionDeclaration()!;
            const funcName = funcDecl.IDENTIFIER().getText();
            const fullName = ScopeUtils.qualifyInScope(funcName, scopePath);
            ModificationCollector.analyzeFunctionForModifications(
              collect,
              fullName,
              scopePath,
              funcDecl,
            );
          }
        }
      }

      // Handle top-level functions
      if (decl.functionDeclaration()) {
        const funcDecl = decl.functionDeclaration()!;
        const name = funcDecl.IDENTIFIER().getText();
        ModificationCollector.analyzeFunctionForModifications(
          collect,
          name,
          "",
          funcDecl,
        );
      }
    }

    return {
      functionParamLists: collect.functionParamLists,
      modifiedParameters: collect.modifiedParameters,
      calls: collect.functionCallGraph,
    };
  }

  /**
   * Analyze a single function for parameter modifications and call graph edges.
   */
  private static analyzeFunctionForModifications(
    collect: IModificationCollector,
    funcName: string,
    scopePath: string,
    funcDecl: Parser.FunctionDeclarationContext,
  ): void {
    // Collect parameter names
    const paramNames: string[] = [];
    const paramList = funcDecl.parameterList();
    if (paramList) {
      for (const param of paramList.parameter()) {
        paramNames.push(param.IDENTIFIER().getText());
      }
    }
    collect.functionParamLists.set(funcName, paramNames);

    // Initialize modified set
    collect.modifiedParameters.set(funcName, new Set());
    collect.functionCallGraph.set(funcName, []);

    // Walk the function body to find modifications and calls
    const block = funcDecl.block();
    if (block) {
      ModificationCollector.walkBlockForModifications(
        collect,
        funcName,
        scopePath,
        paramNames,
        block,
      );
    }
  }

  /**
   * Walk a block to find parameter modifications and function calls.
   */
  private static walkBlockForModifications(
    collect: IModificationCollector,
    funcName: string,
    scopePath: string,
    paramNames: string[],
    block: Parser.BlockContext,
  ): void {
    const paramSet = new Set(paramNames);

    for (const stmt of block.statement()) {
      ModificationCollector.walkStatementForModifications(
        collect,
        funcName,
        scopePath,
        paramSet,
        stmt,
      );
    }
  }

  /**
   * Walk a statement recursively looking for modifications and calls.
   * Issue #566: Refactored to use helper methods for expression and child collection.
   */
  private static walkStatementForModifications(
    collect: IModificationCollector,
    funcName: string,
    scopePath: string,
    paramSet: Set<string>,
    stmt: Parser.StatementContext,
  ): void {
    // 1. Check for parameter modifications via assignment targets
    if (stmt.assignmentStatement()) {
      ModificationCollector.trackAssignmentModifications(
        collect,
        funcName,
        paramSet,
        stmt,
      );
    }

    // 2. Walk all expressions in this statement for function calls
    for (const expr of StatementExpressionCollector.collectAll(stmt)) {
      ModificationCollector.walkExpressionForCalls(
        collect,
        funcName,
        scopePath,
        paramSet,
        expr,
      );
    }

    // 3. Recurse into child statements and blocks
    const { statements, blocks } = ChildStatementCollector.collectAll(stmt);
    for (const childStmt of statements) {
      ModificationCollector.walkStatementForModifications(
        collect,
        funcName,
        scopePath,
        paramSet,
        childStmt,
      );
    }
    for (const block of blocks) {
      ModificationCollector.walkBlockForModifications(
        collect,
        funcName,
        scopePath,
        [...paramSet],
        block,
      );
    }
  }

  /**
   * Track assignment modifications for parameter const inference.
   * SonarCloud S3776: Extracted from walkStatementForModifications().
   */
  private static trackAssignmentModifications(
    collect: IModificationCollector,
    funcName: string,
    paramSet: Set<string>,
    stmt: Parser.StatementContext,
  ): void {
    const assign = stmt.assignmentStatement()!;
    const target = assign.assignmentTarget();

    const { baseIdentifier } = AssignmentTargetExtractor.extract(target);

    // Track as modified parameter (covers both `x <- value` and subscripted
    // writes like `x[i] <- value` / `x[4] <- true` — both change x's value,
    // so x must pass by pointer for the caller to observe the change)
    if (baseIdentifier && paramSet.has(baseIdentifier)) {
      collect.modifiedParameters.get(funcName)!.add(baseIdentifier);
    }
  }

  /**
   * Walk an expression tree to find function calls where parameters are passed.
   * Uses recursive descent through the expression hierarchy.
   */
  private static walkExpressionForCalls(
    collect: IModificationCollector,
    funcName: string,
    scopePath: string,
    paramSet: Set<string>,
    expr: Parser.ExpressionContext,
  ): void {
    // Expression -> TernaryExpression -> OrExpression -> ... -> PostfixExpression
    const ternary = expr.ternaryExpression();
    if (ternary) {
      // Walk all orExpression children
      for (const orExpr of ternary.orExpression()) {
        ModificationCollector.walkOrExpressionForCalls(
          collect,
          funcName,
          scopePath,
          paramSet,
          orExpr,
        );
      }
    }
  }

  /**
   * Generic walker for orExpression trees.
   * Walks through the expression hierarchy and calls the handler for each unaryExpression.
   */
  private static walkOrExpression(
    orExpr: Parser.OrExpressionContext,
    handler: (unaryExpr: Parser.UnaryExpressionContext) => void,
  ): void {
    ExpressionUtils.collectUnaryFromOrExpr(orExpr).forEach(handler);
  }

  /**
   * Walk an orExpression tree for function calls.
   */
  private static walkOrExpressionForCalls(
    collect: IModificationCollector,
    funcName: string,
    scopePath: string,
    paramSet: Set<string>,
    orExpr: Parser.OrExpressionContext,
  ): void {
    ModificationCollector.walkOrExpression(
      orExpr,
      (unaryExpr: Parser.UnaryExpressionContext) => {
        ModificationCollector.walkUnaryExpressionForCalls(
          collect,
          funcName,
          scopePath,
          paramSet,
          unaryExpr,
        );
      },
    );
  }

  /**
   * Walk a unaryExpression tree for function calls.
   */
  private static walkUnaryExpressionForCalls(
    collect: IModificationCollector,
    funcName: string,
    scopePath: string,
    paramSet: Set<string>,
    unaryExpr: Parser.UnaryExpressionContext,
  ): void {
    // Recurse into nested unary
    if (unaryExpr.unaryExpression()) {
      ModificationCollector.walkUnaryExpressionForCalls(
        collect,
        funcName,
        scopePath,
        paramSet,
        unaryExpr.unaryExpression()!,
      );
      return;
    }

    // Check postfix expression
    const postfix = unaryExpr.postfixExpression();
    if (postfix) {
      ModificationCollector.walkPostfixExpressionForCalls(
        collect,
        funcName,
        scopePath,
        paramSet,
        postfix,
      );
    }
  }

  /**
   * Walk a postfixExpression for function calls.
   * This is where function calls are found: primaryExpr followed by '(' args ')'
   */
  private static walkPostfixExpressionForCalls(
    collect: IModificationCollector,
    funcName: string,
    scopePath: string,
    paramSet: Set<string>,
    postfix: Parser.PostfixExpressionContext,
  ): void {
    const primary = postfix.primaryExpression();
    const postfixOps = postfix.postfixOp();

    // Handle simple function calls: IDENTIFIER followed by '(' ... ')'
    ModificationCollector.handleSimpleFunctionCall(
      collect,
      funcName,
      scopePath,
      paramSet,
      primary,
      postfixOps,
    );

    // Issue #365: Handle scope-qualified calls: Scope.method(...) or global.Scope.method(...)
    ModificationCollector.handleScopeQualifiedCalls(
      collect,
      funcName,
      scopePath,
      paramSet,
      primary,
      postfixOps,
    );

    // Recurse into primary expression if it's a parenthesized expression
    if (primary.expression()) {
      ModificationCollector.walkExpressionForCalls(
        collect,
        funcName,
        scopePath,
        paramSet,
        primary.expression()!,
      );
    }

    // ADR-070: `(void) f(cfg);` is a castExpression wrapping the call, so the
    // call is a level deeper than a bare `f(cfg);`. Without this the explicit
    // discard would hide the callee from modification tracking and the caller's
    // parameter would be inferred const even though the callee mutates it.
    const cast = primary.castExpression();
    if (cast?.unaryExpression()) {
      ModificationCollector.walkUnaryExpressionForCalls(
        collect,
        funcName,
        scopePath,
        paramSet,
        cast.unaryExpression()!,
      );
    }

    // Walk arguments in any postfix function call ops (for nested calls)
    ModificationCollector.walkPostfixOpsRecursively(
      collect,
      funcName,
      scopePath,
      paramSet,
      postfixOps,
    );
  }

  /**
   * Handle simple function calls: IDENTIFIER followed by '(' ... ')'
   *
   * Issue #797 resolves a bare name inside a scope to the scope's own function
   * when it declares one. That needs every file's declarations, so the name is
   * recorded as written and 1.4 resolves it (#1825).
   */
  private static handleSimpleFunctionCall(
    collect: IModificationCollector,
    funcName: string,
    scopePath: string,
    paramSet: Set<string>,
    primary: Parser.PrimaryExpressionContext,
    postfixOps: Parser.PostfixOpContext[],
  ): void {
    if (!primary.IDENTIFIER() || postfixOps.length === 0) return;

    const firstOp = postfixOps[0];
    if (!firstOp.LPAREN()) return;

    ModificationCollector.recordCallsFromArgList(
      collect,
      funcName,
      scopePath,
      paramSet,
      primary.IDENTIFIER()!.getText(),
      true,
      firstOp,
    );
  }

  /**
   * Handle scope-qualified calls: Scope.method(...) or global.Scope.method(...)
   * Track member accesses to build the transpiled C name (e.g., Storage_load)
   */
  private static handleScopeQualifiedCalls(
    collect: IModificationCollector,
    funcName: string,
    scopePath: string,
    paramSet: Set<string>,
    primary: Parser.PrimaryExpressionContext,
    postfixOps: Parser.PostfixOpContext[],
  ): void {
    if (postfixOps.length === 0) return;

    const memberNames = ModificationCollector.collectInitialMemberNames(
      scopePath,
      primary,
    );

    for (const [opIndex, op] of postfixOps.entries()) {
      if (op.IDENTIFIER()) {
        memberNames.push(op.IDENTIFIER()!.getText());
      } else if (op.LPAREN()) {
        // Issue #1210: a bare call is `IDENTIFIER (args)`, so its parenthesis
        // is the *first* postfix op. handleSimpleFunctionCall has already
        // recorded that call, for 1.4 to resolve through ADR-057 scope rules;
        // recording it again here under the raw bare name produced a second
        // entry that functionParamLists -- keyed by transpiled C name -- can
        // never match.
        //
        // `global.f(x)` and `Scope.f(x)` are unaffected: there an identifier op
        // precedes the parenthesis, so opIndex > 0 and the chain is genuinely
        // qualified.
        if (opIndex > 0 && memberNames.length >= 1) {
          const calleeName = ScopeUtils.qualifyPathInScope(memberNames, "");
          ModificationCollector.recordCallsFromArgList(
            collect,
            funcName,
            scopePath,
            paramSet,
            calleeName,
            false,
            op,
          );
        }
        memberNames.length = 0; // Reset for potential chained calls
      } else if (op.expression().length > 0) {
        memberNames.length = 0; // Array subscript breaks scope chain
      }
    }
  }

  /**
   * Collect initial member names from primary expression for scope resolution.
   * Issue #561: When 'this' is used, resolve to the enclosing scope -- its path,
   * as the caller was collected under, rather than decoded back out of the
   * function's C name (#1285: a name is built from a scope, never split into one).
   */
  private static collectInitialMemberNames(
    scopePath: string,
    primary: Parser.PrimaryExpressionContext,
  ): string[] {
    const memberNames: string[] = [];
    const primaryId = primary.IDENTIFIER()?.getText();

    if (primaryId && primaryId !== "global") {
      memberNames.push(primaryId);
    } else if (primary.THIS() && scopePath) {
      memberNames.push(scopePath);
    }
    return memberNames;
  }

  /**
   * Record function calls to the call graph from an argument list.
   * Also recurses into argument expressions.
   */
  private static recordCallsFromArgList(
    collect: IModificationCollector,
    funcName: string,
    scopePath: string,
    paramSet: Set<string>,
    calleeName: string,
    calleeIsBare: boolean,
    op: Parser.PostfixOpContext,
  ): void {
    const argList = op.argumentList();
    if (!argList) return;

    const args = argList.expression();
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const argName = ExpressionUtils.extractIdentifier(arg);
      if (argName && paramSet.has(argName)) {
        collect.functionCallGraph.get(funcName)!.push({
          callee: calleeName,
          calleeIsBare,
          paramIndex: i,
          argParamName: argName,
        });
      }
      ModificationCollector.walkExpressionForCalls(
        collect,
        funcName,
        scopePath,
        paramSet,
        arg,
      );
    }
  }

  /**
   * Walk postfix ops recursively for nested calls and array subscripts.
   */
  private static walkPostfixOpsRecursively(
    collect: IModificationCollector,
    funcName: string,
    scopePath: string,
    paramSet: Set<string>,
    postfixOps: Parser.PostfixOpContext[],
  ): void {
    for (const op of postfixOps) {
      if (op.argumentList()) {
        for (const argExpr of op.argumentList()!.expression()) {
          ModificationCollector.walkExpressionForCalls(
            collect,
            funcName,
            scopePath,
            paramSet,
            argExpr,
          );
        }
      }
      for (const expr of op.expression()) {
        ModificationCollector.walkExpressionForCalls(
          collect,
          funcName,
          scopePath,
          paramSet,
          expr,
        );
      }
    }
  }
}

export default ModificationCollector;
