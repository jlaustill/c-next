/**
 * Pass-By-Value Analyzer
 *
 * Extracted from CodeGenerator.ts (Issue #269, #558, #566, #579)
 *
 * Performs three-phase analysis to determine which function parameters
 * can be passed by value (as opposed to pointer):
 *
 * Phase 1: Collect function parameter lists and direct modifications
 * Phase 2: Transitive modification propagation (via TransitiveModificationPropagator)
 * Phase 3: Determine which parameters can pass by value
 *
 * A parameter can pass by value if:
 * 1. It's a small primitive type (u8, i8, u16, i16, u32, i32, u64, i64, bool)
 * 2. It's not modified (directly or transitively)
 * 3. It's not an array, struct, string, or callback
 * 4. It's not accessed via subscript (Issue #579)
 */

import * as Parser from "../parser/grammar/CNextParser";
import CodeGenState from "../../state/CodeGenState";
import TransitiveModificationPropagator from "./helpers/TransitiveModificationPropagator";
import StatementExpressionCollector from "./helpers/StatementExpressionCollector";
import ChildStatementCollector from "./helpers/ChildStatementCollector";
import AssignmentTargetExtractor from "./helpers/AssignmentTargetExtractor";
import ExpressionUtils from "../../../utils/ExpressionUtils";

/**
 * Small primitive types that are eligible for pass-by-value optimization.
 */
const SMALL_PRIMITIVES = new Set([
  "u8",
  "i8",
  "u16",
  "i16",
  "u32",
  "i32",
  "u64",
  "i64",
  "bool",
]);

/**
 * Static analyzer for determining pass-by-value eligibility.
 * All state is stored in CodeGenState - this class contains pure analysis logic.
 */
class PassByValueAnalyzer {
  /**
   * Main entry point: Analyze a program tree to determine pass-by-value parameters.
   * Updates CodeGenState with analysis results.
   */
  static analyze(tree: Parser.ProgramContext): void {
    // Reset analysis state
    CodeGenState.modifiedParameters.clear();
    CodeGenState.passByValueParams.clear();
    CodeGenState.functionCallGraph.clear();
    CodeGenState.functionParamLists.clear();

    // Phase 1: Collect function parameter lists and direct modifications
    PassByValueAnalyzer.collectFunctionParametersAndModifications(tree);

    // Issue #558: Inject cross-file data before transitive propagation
    PassByValueAnalyzer.injectCrossFileModifications();
    PassByValueAnalyzer.injectCrossFileParamLists();

    // Phase 2: Fixed-point iteration for transitive modifications
    TransitiveModificationPropagator.propagate(
      CodeGenState.functionCallGraph,
      CodeGenState.functionParamLists,
      CodeGenState.modifiedParameters,
    );

    // Phase 3: Determine which parameters can pass by value
    PassByValueAnalyzer.computePassByValueParams();
  }

  /**
   * Inject cross-file modification data into modifiedParameters.
   * SonarCloud S3776: Extracted from analyze().
   */
  private static injectCrossFileModifications(): void {
    if (!CodeGenState.pendingCrossFileModifications) return;

    for (const [
      funcName,
      params,
    ] of CodeGenState.pendingCrossFileModifications) {
      const existing = CodeGenState.modifiedParameters.get(funcName);
      if (existing) {
        for (const param of params) {
          existing.add(param);
        }
      } else {
        CodeGenState.modifiedParameters.set(funcName, new Set(params));
      }
    }
    CodeGenState.pendingCrossFileModifications = null; // Clear after use
  }

  /**
   * Inject cross-file parameter lists into functionParamLists.
   * SonarCloud S3776: Extracted from analyze().
   */
  private static injectCrossFileParamLists(): void {
    if (!CodeGenState.pendingCrossFileParamLists) return;

    for (const [funcName, params] of CodeGenState.pendingCrossFileParamLists) {
      if (!CodeGenState.functionParamLists.has(funcName)) {
        CodeGenState.functionParamLists.set(funcName, [...params]);
      }
    }
    CodeGenState.pendingCrossFileParamLists = null; // Clear after use
  }

  /**
   * Phase 1: Walk all functions to collect:
   * - Parameter lists (for call graph resolution)
   * - Direct modifications (param <- value)
   * - Function calls where params are passed as arguments
   *
   * Exposed as public for use by CodeGenerator.analyzeModificationsOnly()
   * which needs to run just this phase for cross-file analysis.
   */
  static collectFunctionParametersAndModifications(
    tree: Parser.ProgramContext,
  ): void {
    for (const decl of tree.declaration()) {
      // Handle scope-level functions
      if (decl.scopeDeclaration()) {
        const scopeDecl = decl.scopeDeclaration()!;
        const scopeName = scopeDecl.IDENTIFIER().getText();

        for (const member of scopeDecl.scopeMember()) {
          if (member.functionDeclaration()) {
            const funcDecl = member.functionDeclaration()!;
            const funcName = funcDecl.IDENTIFIER().getText();
            const fullName = `${scopeName}_${funcName}`;
            PassByValueAnalyzer.analyzeFunctionForModifications(
              fullName,
              funcDecl,
            );
          }
        }
      }

      // Handle top-level functions
      if (decl.functionDeclaration()) {
        const funcDecl = decl.functionDeclaration()!;
        const name = funcDecl.IDENTIFIER().getText();
        PassByValueAnalyzer.analyzeFunctionForModifications(name, funcDecl);
      }
    }
  }

  /**
   * Analyze a single function for parameter modifications and call graph edges.
   */
  private static analyzeFunctionForModifications(
    funcName: string,
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
    CodeGenState.functionParamLists.set(funcName, paramNames);

    // Initialize modified set
    CodeGenState.modifiedParameters.set(funcName, new Set());
    // Issue #579: Initialize subscript access tracking
    CodeGenState.subscriptAccessedParameters.set(funcName, new Set());
    CodeGenState.functionCallGraph.set(funcName, []);

    // Walk the function body to find modifications and calls
    const block = funcDecl.block();
    if (block) {
      PassByValueAnalyzer.walkBlockForModifications(
        funcName,
        paramNames,
        block,
      );
    }
  }

  /**
   * Walk a block to find parameter modifications and function calls.
   */
  private static walkBlockForModifications(
    funcName: string,
    paramNames: string[],
    block: Parser.BlockContext,
  ): void {
    const paramSet = new Set(paramNames);

    for (const stmt of block.statement()) {
      PassByValueAnalyzer.walkStatementForModifications(
        funcName,
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
    funcName: string,
    paramSet: Set<string>,
    stmt: Parser.StatementContext,
  ): void {
    // 1. Check for parameter modifications via assignment targets
    if (stmt.assignmentStatement()) {
      PassByValueAnalyzer.trackAssignmentModifications(
        funcName,
        paramSet,
        stmt,
      );
    }

    // 2. Walk all expressions in this statement for function calls and subscript access
    for (const expr of StatementExpressionCollector.collectAll(stmt)) {
      PassByValueAnalyzer.walkExpressionForCalls(funcName, paramSet, expr);
      // Issue #579: Also track subscript read access on parameters
      PassByValueAnalyzer.walkExpressionForSubscriptAccess(
        funcName,
        paramSet,
        expr,
      );
    }

    // 3. Recurse into child statements and blocks
    const { statements, blocks } = ChildStatementCollector.collectAll(stmt);
    for (const childStmt of statements) {
      PassByValueAnalyzer.walkStatementForModifications(
        funcName,
        paramSet,
        childStmt,
      );
    }
    for (const block of blocks) {
      PassByValueAnalyzer.walkBlockForModifications(
        funcName,
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
    funcName: string,
    paramSet: Set<string>,
    stmt: Parser.StatementContext,
  ): void {
    const assign = stmt.assignmentStatement()!;
    const target = assign.assignmentTarget();

    const { baseIdentifier, hasSingleIndexSubscript } =
      AssignmentTargetExtractor.extract(target);

    // Issue #579: Track subscript access on parameters (for write path)
    if (
      hasSingleIndexSubscript &&
      baseIdentifier &&
      paramSet.has(baseIdentifier)
    ) {
      CodeGenState.subscriptAccessedParameters
        .get(funcName)!
        .add(baseIdentifier);
    }

    // Track as modified parameter
    if (baseIdentifier && paramSet.has(baseIdentifier)) {
      CodeGenState.modifiedParameters.get(funcName)!.add(baseIdentifier);
    }
  }

  /**
   * Walk an expression tree to find function calls where parameters are passed.
   * Uses recursive descent through the expression hierarchy.
   */
  private static walkExpressionForCalls(
    funcName: string,
    paramSet: Set<string>,
    expr: Parser.ExpressionContext,
  ): void {
    // Expression -> TernaryExpression -> OrExpression -> ... -> PostfixExpression
    const ternary = expr.ternaryExpression();
    if (ternary) {
      // Walk all orExpression children
      for (const orExpr of ternary.orExpression()) {
        PassByValueAnalyzer.walkOrExpressionForCalls(
          funcName,
          paramSet,
          orExpr,
        );
      }
    }
  }

  /**
   * Issue #579: Walk an expression tree to find subscript access on parameters.
   * This tracks read access like `buf[i]` where buf is a parameter.
   * Parameters with subscript access must become pointers.
   */
  private static walkExpressionForSubscriptAccess(
    funcName: string,
    paramSet: Set<string>,
    expr: Parser.ExpressionContext,
  ): void {
    const ternary = expr.ternaryExpression();
    if (ternary) {
      for (const orExpr of ternary.orExpression()) {
        PassByValueAnalyzer.walkOrExpression(orExpr, (unaryExpr) => {
          PassByValueAnalyzer.handleSubscriptAccess(
            funcName,
            paramSet,
            unaryExpr,
          );
        });
      }
    }
  }

  /**
   * Issue #579: Handle subscript access on a unary expression.
   * Only tracks single-index subscript access (which could be array access).
   * Two-index subscript (e.g., value[start, width]) is always bit extraction,
   * so it doesn't require the parameter to become a pointer.
   */
  private static handleSubscriptAccess(
    funcName: string,
    paramSet: Set<string>,
    unaryExpr: Parser.UnaryExpressionContext,
  ): void {
    const postfixExpr = unaryExpr.postfixExpression();
    if (!postfixExpr) return;

    const primary = postfixExpr.primaryExpression();
    const ops = postfixExpr.postfixOp();

    // Check if primary is a parameter and there's subscript access
    const primaryId = primary.IDENTIFIER()?.getText();
    if (!primaryId || !paramSet.has(primaryId)) {
      return;
    }

    // Only track SINGLE-index subscript access (potential array access)
    // Two-index subscript like value[0, 8] is bit extraction, not array access
    const hasSingleIndexSubscript = ops.some(
      (op) => op.expression().length === 1,
    );
    if (hasSingleIndexSubscript) {
      CodeGenState.subscriptAccessedParameters.get(funcName)!.add(primaryId);
    }
  }

  /**
   * Generic walker for orExpression trees.
   * Walks through the expression hierarchy and calls the handler for each unaryExpression.
   * Used by both function call tracking and subscript access tracking.
   */
  private static walkOrExpression(
    orExpr: Parser.OrExpressionContext,
    handler: (unaryExpr: Parser.UnaryExpressionContext) => void,
  ): void {
    orExpr
      .andExpression()
      .flatMap((and) => and.equalityExpression())
      .flatMap((eq) => eq.relationalExpression())
      .flatMap((rel) => rel.bitwiseOrExpression())
      .flatMap((bor) => bor.bitwiseXorExpression())
      .flatMap((bxor) => bxor.bitwiseAndExpression())
      .flatMap((band) => band.shiftExpression())
      .flatMap((shift) => shift.additiveExpression())
      .flatMap((add) => add.multiplicativeExpression())
      .flatMap((mul) => mul.unaryExpression())
      .forEach(handler);
  }

  /**
   * Walk an orExpression tree for function calls.
   */
  private static walkOrExpressionForCalls(
    funcName: string,
    paramSet: Set<string>,
    orExpr: Parser.OrExpressionContext,
  ): void {
    PassByValueAnalyzer.walkOrExpression(orExpr, (unaryExpr) => {
      PassByValueAnalyzer.walkUnaryExpressionForCalls(
        funcName,
        paramSet,
        unaryExpr,
      );
    });
  }

  /**
   * Walk a unaryExpression tree for function calls.
   */
  private static walkUnaryExpressionForCalls(
    funcName: string,
    paramSet: Set<string>,
    unaryExpr: Parser.UnaryExpressionContext,
  ): void {
    // Recurse into nested unary
    if (unaryExpr.unaryExpression()) {
      PassByValueAnalyzer.walkUnaryExpressionForCalls(
        funcName,
        paramSet,
        unaryExpr.unaryExpression()!,
      );
      return;
    }

    // Check postfix expression
    const postfix = unaryExpr.postfixExpression();
    if (postfix) {
      PassByValueAnalyzer.walkPostfixExpressionForCalls(
        funcName,
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
    funcName: string,
    paramSet: Set<string>,
    postfix: Parser.PostfixExpressionContext,
  ): void {
    const primary = postfix.primaryExpression();
    const postfixOps = postfix.postfixOp();

    // Handle simple function calls: IDENTIFIER followed by '(' ... ')'
    PassByValueAnalyzer.handleSimpleFunctionCall(
      funcName,
      paramSet,
      primary,
      postfixOps,
    );

    // Issue #365: Handle scope-qualified calls: Scope.method(...) or global.Scope.method(...)
    PassByValueAnalyzer.handleScopeQualifiedCalls(
      funcName,
      paramSet,
      primary,
      postfixOps,
    );

    // Recurse into primary expression if it's a parenthesized expression
    if (primary.expression()) {
      PassByValueAnalyzer.walkExpressionForCalls(
        funcName,
        paramSet,
        primary.expression()!,
      );
    }

    // Walk arguments in any postfix function call ops (for nested calls)
    PassByValueAnalyzer.walkPostfixOpsRecursively(
      funcName,
      paramSet,
      postfixOps,
    );
  }

  /**
   * Handle simple function calls: IDENTIFIER followed by '(' ... ')'
   */
  private static handleSimpleFunctionCall(
    funcName: string,
    paramSet: Set<string>,
    primary: Parser.PrimaryExpressionContext,
    postfixOps: Parser.PostfixOpContext[],
  ): void {
    if (!primary.IDENTIFIER() || postfixOps.length === 0) return;

    const firstOp = postfixOps[0];
    if (!firstOp.LPAREN()) return;

    const calleeName = primary.IDENTIFIER()!.getText();
    PassByValueAnalyzer.recordCallsFromArgList(
      funcName,
      paramSet,
      calleeName,
      firstOp,
    );
  }

  /**
   * Handle scope-qualified calls: Scope.method(...) or global.Scope.method(...)
   * Track member accesses to build the mangled callee name (e.g., Storage_load)
   */
  private static handleScopeQualifiedCalls(
    funcName: string,
    paramSet: Set<string>,
    primary: Parser.PrimaryExpressionContext,
    postfixOps: Parser.PostfixOpContext[],
  ): void {
    if (postfixOps.length === 0) return;

    const memberNames = PassByValueAnalyzer.collectInitialMemberNames(
      funcName,
      primary,
    );

    for (const op of postfixOps) {
      if (op.IDENTIFIER()) {
        memberNames.push(op.IDENTIFIER()!.getText());
      } else if (op.LPAREN() && memberNames.length >= 1) {
        const calleeName = memberNames.join("_");
        PassByValueAnalyzer.recordCallsFromArgList(
          funcName,
          paramSet,
          calleeName,
          op,
        );
        memberNames.length = 0; // Reset for potential chained calls
      } else if (op.expression().length > 0) {
        memberNames.length = 0; // Array subscript breaks scope chain
      }
    }
  }

  /**
   * Collect initial member names from primary expression for scope resolution.
   * Issue #561: When 'this' is used, resolve to the current scope name from funcName.
   */
  private static collectInitialMemberNames(
    funcName: string,
    primary: Parser.PrimaryExpressionContext,
  ): string[] {
    const memberNames: string[] = [];
    const primaryId = primary.IDENTIFIER()?.getText();

    if (primaryId && primaryId !== "global") {
      memberNames.push(primaryId);
    } else if (primary.THIS()) {
      const scopeName = funcName.split("_")[0];
      if (scopeName && scopeName !== funcName) {
        memberNames.push(scopeName);
      }
    }
    return memberNames;
  }

  /**
   * Record function calls to the call graph from an argument list.
   * Also recurses into argument expressions.
   */
  private static recordCallsFromArgList(
    funcName: string,
    paramSet: Set<string>,
    calleeName: string,
    op: Parser.PostfixOpContext,
  ): void {
    const argList = op.argumentList();
    if (!argList) return;

    const args = argList.expression();
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const argName = ExpressionUtils.extractIdentifier(arg);
      if (argName && paramSet.has(argName)) {
        CodeGenState.functionCallGraph.get(funcName)!.push({
          callee: calleeName,
          paramIndex: i,
          argParamName: argName,
        });
      }
      PassByValueAnalyzer.walkExpressionForCalls(funcName, paramSet, arg);
    }
  }

  /**
   * Walk postfix ops recursively for nested calls and array subscripts.
   */
  private static walkPostfixOpsRecursively(
    funcName: string,
    paramSet: Set<string>,
    postfixOps: Parser.PostfixOpContext[],
  ): void {
    for (const op of postfixOps) {
      if (op.argumentList()) {
        for (const argExpr of op.argumentList()!.expression()) {
          PassByValueAnalyzer.walkExpressionForCalls(
            funcName,
            paramSet,
            argExpr,
          );
        }
      }
      for (const expr of op.expression()) {
        PassByValueAnalyzer.walkExpressionForCalls(funcName, paramSet, expr);
      }
    }
  }

  /**
   * Phase 3: Determine which parameters can pass by value.
   * A parameter passes by value if:
   * 1. It's a small primitive type (u8, i8, u16, i16, u32, i32, u64, i64, bool)
   * 2. It's not modified (directly or transitively)
   * 3. It's not an array, struct, string, or callback
   */
  private static computePassByValueParams(): void {
    for (const [funcName, paramNames] of CodeGenState.functionParamLists) {
      const passByValue = new Set<string>();
      const modified =
        CodeGenState.modifiedParameters.get(funcName) ?? new Set();

      // Get function declaration to check parameter types
      const funcSig = CodeGenState.functionSignatures.get(funcName);
      if (funcSig) {
        for (let i = 0; i < paramNames.length; i++) {
          const paramName = paramNames[i];
          const paramSig = funcSig.parameters[i];

          if (!paramSig) continue;

          // Check if eligible for pass-by-value:
          // - Is a small primitive type
          // - Not an array
          // - Not modified
          // - Not accessed via subscript (Issue #579)
          const isSmallPrimitive = SMALL_PRIMITIVES.has(paramSig.baseType);
          const isArray = paramSig.isArray ?? false;
          const isModified = modified.has(paramName);
          // Issue #579: Parameters with subscript access must become pointers
          const hasSubscriptAccess =
            CodeGenState.subscriptAccessedParameters
              .get(funcName)
              ?.has(paramName) ?? false;

          if (
            isSmallPrimitive &&
            !isArray &&
            !isModified &&
            !hasSubscriptAccess
          ) {
            passByValue.add(paramName);
          }
        }
      }

      CodeGenState.passByValueParams.set(funcName, passByValue);
    }
  }

  /**
   * Check if a parameter should be passed by value (by name).
   * Used internally during code generation.
   */
  static isParameterPassByValueByName(
    funcName: string,
    paramName: string,
  ): boolean {
    const passByValue = CodeGenState.passByValueParams.get(funcName);
    return passByValue?.has(paramName) ?? false;
  }

  /**
   * Issue #269: Check if a parameter should be passed by value (by index).
   * Part of IOrchestrator interface - used by CallExprGenerator.
   */
  static isParameterPassByValue(funcName: string, paramIndex: number): boolean {
    const paramList = CodeGenState.functionParamLists.get(funcName);
    if (!paramList || paramIndex < 0 || paramIndex >= paramList.length) {
      return false;
    }
    const paramName = paramList[paramIndex];
    return PassByValueAnalyzer.isParameterPassByValueByName(
      funcName,
      paramName,
    );
  }
}

export default PassByValueAnalyzer;
