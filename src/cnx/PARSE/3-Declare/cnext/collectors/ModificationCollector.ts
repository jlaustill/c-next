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
import type IFunctionDeclarationSyntax from "../../../../types/syntax/IFunctionDeclarationSyntax";
import type IProgramSyntax from "../../../../types/syntax/IProgramSyntax";
import type TExpression from "../../../../types/syntax/TExpression";
import type TPostfixOpSyntax from "../../../../types/syntax/TPostfixOpSyntax";
import type TStatement from "../../../../types/syntax/TStatement";
import ExpressionShape from "../../../../utils/ExpressionShape";
import ScopeUtils from "../../../../utils/ScopeUtils";
import StatementChildren from "../../../../utils/StatementChildren";
import StatementWrites from "../../../../utils/StatementWrites";

/** The function being walked: where its calls and modifications are recorded */
interface IWalk {
  readonly collect: IModificationCollector;
  readonly funcName: string;
  readonly scopePath: string;
  readonly paramSet: ReadonlySet<string>;
}

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
    program: IProgramSyntax,
    scopePathOf: (scopeName: string) => string,
  ): IFileModifications {
    const collect: IModificationCollector = {
      modifiedParameters: new Map(),
      functionParamLists: new Map(),
      functionCallGraph: new Map(),
    };

    for (const { declaration } of program.declarations) {
      // Handle scope-level functions
      if (declaration.kind === "scope") {
        // #1298: the whole scope PATH, so qualification keeps every outer
        // component.
        const scopePath = scopePathOf(declaration.name);
        for (const member of declaration.members) {
          if (member.declaration.kind === "function") {
            ModificationCollector.analyzeFunctionForModifications(
              collect,
              ScopeUtils.qualifyInScope(member.declaration.name, scopePath),
              scopePath,
              member.declaration,
            );
          }
        }
      }

      // Handle top-level functions
      if (declaration.kind === "function") {
        ModificationCollector.analyzeFunctionForModifications(
          collect,
          declaration.name,
          "",
          declaration,
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
    funcDecl: IFunctionDeclarationSyntax,
  ): void {
    // Collect parameter names
    const paramNames = (funcDecl.parameters ?? []).map((param) => param.name);
    collect.functionParamLists.set(funcName, paramNames);

    // Initialize modified set
    collect.modifiedParameters.set(funcName, new Set());
    collect.functionCallGraph.set(funcName, []);

    // Walk the function body to find modifications and calls
    ModificationCollector.walkStatements(
      { collect, funcName, scopePath, paramSet: new Set(paramNames) },
      funcDecl.body.statements,
    );
  }

  /**
   * Walk statements recursively looking for modifications and calls, into
   * every statement they hold (#2003).
   */
  private static walkStatements(
    walk: IWalk,
    statements: readonly TStatement[],
  ): void {
    for (const statement of statements) {
      // 1. Check for parameter modifications via assignment targets, a `for`
      // header's included (#2010)
      for (const write of StatementWrites.of(statement)) {
        ModificationCollector.trackAssignmentModifications(walk, write.target);
      }

      // 2. Walk all expressions in this statement for function calls
      for (const expr of ModificationCollector.expressionsOf(statement)) {
        ModificationCollector.walkExpressionForCalls(walk, expr);
      }

      // 3. Recurse into child statements
      ModificationCollector.walkStatements(
        walk,
        StatementChildren.of(statement),
      );
    }
  }

  /**
   * The expressions a statement holds itself -- not those of the statements
   * nested inside it, nor an assignment's target.
   */
  private static expressionsOf(statement: TStatement): TExpression[] {
    switch (statement.kind) {
      case "expression":
        return [statement.expression];
      case "assignment":
        return [statement.value];
      case "variableDeclaration":
        return statement.initializer ? [statement.initializer] : [];
      case "return":
        return statement.value ? [statement.value] : [];
      case "if":
      case "while":
      case "doWhile":
        return [statement.condition];
      case "switch":
        return [statement.subject];
      case "for": {
        const expressions: TExpression[] = [];
        if (statement.condition) expressions.push(statement.condition);
        if (statement.init?.kind === "assignment") {
          expressions.push(statement.init.value);
        } else if (statement.init?.initializer) {
          expressions.push(statement.init.initializer);
        }
        if (statement.update) expressions.push(statement.update.value);
        return expressions;
      }
      case "constructorDeclaration":
      case "forever":
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

  /**
   * Track assignment modifications for parameter const inference.
   * SonarCloud S3776: Extracted from walkStatementForModifications().
   */
  private static trackAssignmentModifications(
    walk: IWalk,
    target: TExpression,
  ): void {
    // #1290: a `global.`/`this.` target names a file-scope or scope member,
    // never a local or parameter -- even one spelled the same that shadows it
    const head = ExpressionShape.headOf(target);
    const baseIdentifier = head.root === null ? head.identifier?.name : null;

    // Track as modified parameter (covers both `x <- value` and subscripted
    // writes like `x[i] <- value` / `x[4] <- true` — both change x's value,
    // so x must pass by pointer for the caller to observe the change)
    if (baseIdentifier && walk.paramSet.has(baseIdentifier)) {
      walk.collect.modifiedParameters.get(walk.funcName)!.add(baseIdentifier);
    }
  }

  /**
   * Walk an expression tree to find function calls where parameters are
   * passed. Initializers are not searched.
   */
  private static walkExpressionForCalls(walk: IWalk, expr: TExpression): void {
    switch (expr.kind) {
      case "ternary":
        ModificationCollector.walkExpressionForCalls(walk, expr.condition);
        ModificationCollector.walkExpressionForCalls(walk, expr.whenTrue);
        ModificationCollector.walkExpressionForCalls(walk, expr.whenFalse);
        return;
      case "binary":
        for (const operand of expr.operands) {
          ModificationCollector.walkExpressionForCalls(walk, operand);
        }
        return;
      case "unary":
        ModificationCollector.walkExpressionForCalls(walk, expr.operand);
        return;
      default: {
        const view = ExpressionShape.postfixView(expr);
        if (view) {
          ModificationCollector.walkPostfixExpressionForCalls(
            walk,
            view.primary,
            view.ops,
          );
        }
      }
    }
  }

  /**
   * Walk a postfixExpression for function calls.
   * This is where function calls are found: primaryExpr followed by '(' args ')'
   */
  private static walkPostfixExpressionForCalls(
    walk: IWalk,
    primary: TExpression,
    postfixOps: readonly TPostfixOpSyntax[],
  ): void {
    // Handle simple function calls: IDENTIFIER followed by '(' ... ')'
    ModificationCollector.handleSimpleFunctionCall(walk, primary, postfixOps);

    // Issue #365: Handle scope-qualified calls: Scope.method(...) or global.Scope.method(...)
    ModificationCollector.handleScopeQualifiedCalls(walk, primary, postfixOps);

    // Recurse into primary expression if it's a parenthesized expression
    if (primary.kind === "parenthesized") {
      ModificationCollector.walkExpressionForCalls(walk, primary.expression);
    }

    // ADR-070: `(void) f(cfg);` is a cast wrapping the call. Without this the
    // explicit discard would hide the callee from modification tracking and
    // the caller's parameter would be inferred const even though the callee
    // mutates it.
    if (primary.kind === "cast") {
      ModificationCollector.walkExpressionForCalls(walk, primary.operand);
    }

    // Walk arguments in any postfix function call ops (for nested calls)
    ModificationCollector.walkPostfixOpsRecursively(walk, postfixOps);
  }

  /**
   * Handle simple function calls: IDENTIFIER followed by '(' ... ')'
   *
   * Issue #797 resolves a bare name inside a scope to the scope's own function
   * when it declares one. That needs every file's declarations, so the name is
   * recorded as written and 1.4 resolves it (#1825).
   */
  private static handleSimpleFunctionCall(
    walk: IWalk,
    primary: TExpression,
    postfixOps: readonly TPostfixOpSyntax[],
  ): void {
    const firstOp = postfixOps[0];
    if (primary.kind !== "identifier" || firstOp?.kind !== "call") return;
    ModificationCollector.recordCallsFromArgList(
      walk,
      primary.name,
      true,
      firstOp.arguments,
    );
  }

  /**
   * Handle scope-qualified calls: Scope.method(...) or global.Scope.method(...)
   * Track member accesses to build the transpiled C name (e.g., Storage_load)
   */
  private static handleScopeQualifiedCalls(
    walk: IWalk,
    primary: TExpression,
    postfixOps: readonly TPostfixOpSyntax[],
  ): void {
    if (postfixOps.length === 0) return;

    const memberNames = ModificationCollector.collectInitialMemberNames(
      walk.scopePath,
      primary,
    );

    for (const [opIndex, op] of postfixOps.entries()) {
      if (op.kind === "member") {
        memberNames.push(op.name);
      } else if (op.kind === "call") {
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
            walk,
            calleeName,
            false,
            op.arguments,
          );
        }
        memberNames.length = 0; // Reset for potential chained calls
      } else if (op.kind === "subscript") {
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
    primary: TExpression,
  ): string[] {
    if (primary.kind === "identifier") return [primary.name];
    if (primary.kind === "root" && primary.root === "this" && scopePath) {
      return [scopePath];
    }
    return [];
  }

  /**
   * Record function calls to the call graph from an argument list. The
   * arguments' own calls are walkPostfixOpsRecursively's, so each is recorded
   * once.
   */
  private static recordCallsFromArgList(
    walk: IWalk,
    calleeName: string,
    calleeIsBare: boolean,
    args: readonly TExpression[],
  ): void {
    for (const [i, arg] of args.entries()) {
      const argName = ExpressionShape.simpleIdentifier(arg);
      if (argName && walk.paramSet.has(argName)) {
        walk.collect.functionCallGraph.get(walk.funcName)!.push({
          callee: calleeName,
          calleeIsBare,
          paramIndex: i,
          argParamName: argName,
        });
      }
    }
  }

  /**
   * Walk postfix ops recursively for nested calls and array subscripts.
   */
  private static walkPostfixOpsRecursively(
    walk: IWalk,
    postfixOps: readonly TPostfixOpSyntax[],
  ): void {
    for (const op of postfixOps) {
      if (op.kind === "call") {
        for (const argExpr of op.arguments) {
          ModificationCollector.walkExpressionForCalls(walk, argExpr);
        }
      } else if (op.kind === "subscript") {
        for (const expr of op.indexes) {
          ModificationCollector.walkExpressionForCalls(walk, expr);
        }
      }
    }
  }
}

export default ModificationCollector;
