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
 *
 * Issue #1100: Subscript access no longer forces pointer semantics on its
 * own. A scalar parameter subscripted with a single index is bit-indexing
 * (ADR-007), not array access, so it stays eligible for pass-by-value.
 * Only genuine array parameters (`isArray`, from explicit `T[N]` syntax,
 * ADR-006) are excluded — via the isArray check below.
 */

import * as Parser from "../parser/grammar/CNextParser";
import CodeGenState from "../../state/CodeGenState";
import SymbolRegistry from "../../state/SymbolRegistry";
import ScopeUtils from "../../../utils/ScopeUtils";
import TransitiveModificationPropagator from "./helpers/TransitiveModificationPropagator";
import StatementExpressionCollector from "./helpers/StatementExpressionCollector";
import ChildStatementCollector from "./helpers/ChildStatementCollector";
import AssignmentTargetExtractor from "./helpers/AssignmentTargetExtractor";
import ExpressionUtils from "../../../utils/ExpressionUtils";
import QualifiedCName from "../../../utils/QualifiedCName";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";

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
    PassByValueAnalyzer.propagateModifications();

    // Phase 3: Determine which parameters can pass by value
    PassByValueAnalyzer.computePassByValueParams();
  }

  /**
   * Phase 2: run transitive modification propagation with the project's
   * standard callee resolver.
   *
   * Both this analyzer and CodeGenerator.analyzeModificationsOnly propagate,
   * and both must answer "does this callee modify its parameter?" the same way.
   * They share this one entry rather than each passing their own resolver --
   * two call sites that merely agree today are a latent divergence.
   */
  static propagateModifications(): void {
    TransitiveModificationPropagator.propagate(
      CodeGenState.functionCallGraph,
      CodeGenState.functionParamLists,
      CodeGenState.modifiedParameters,
      PassByValueAnalyzer.calleeMayMutateParameter,
    );
  }

  /**
   * Whether this call invokes a value rather than a named function.
   *
   * An ADR-029 callback is called through a parameter (`cb(value)`), a scope
   * field (`listener(s)`) or a struct field (`config.listener(s)`). The name
   * recorded in the call graph is that value's, so no declaration will ever
   * match it -- which is a different fact from "this function is declared
   * somewhere this build cannot see".
   */
  private static calleeIsIndirectCall(
    callerName: string,
    callee: string,
  ): boolean {
    const root = QualifiedCName.split(callee)[0];
    const callerParameters =
      CodeGenState.functionParamLists.get(callerName) ?? [];
    if (callerParameters.includes(callee) || callerParameters.includes(root)) {
      return true;
    }
    if (
      PassByValueAnalyzer.nameIsValueSymbol(callee) ||
      PassByValueAnalyzer.nameIsValueSymbol(root)
    ) {
      return true;
    }

    // A scope field is indexed under its transpiled name (`Bus__listener`),
    // while the call graph records the bare name the source used, so qualify
    // with the caller's own scope before giving up.
    const callerScope = QualifiedCName.split(callerName)[0];
    if (!callerScope || callerScope === callerName) return false;
    return PassByValueAnalyzer.nameIsValueSymbol(
      QualifiedCName.fromParts([callerScope, root]),
    );
  }

  /**
   * Whether a name resolves to a variable rather than a function -- a scope
   * field or global holding a callback.
   */
  private static nameIsValueSymbol(name: string): boolean {
    const symbols = CodeGenState.symbolTable?.getOverloadsByCName(name) ?? [];
    return symbols.some((symbol) => symbol.kind === "variable");
  }

  /**
   * Issue #1178: answer "may this callee mutate the caller's argument through
   * this parameter?" for a callee that is not a C-Next function in this build.
   *
   * The propagator reaches here only when `functionParamLists` has no entry for
   * the callee. That used to mean "assume pure", which applied auto-const on the
   * strength of an absent answer. A C or C++ declaration is a definitive answer,
   * so consult it; only a callee nothing knows about falls back to the safe
   * assumption that it mutates.
   */
  private static calleeMayMutateParameter(
    callerName: string,
    callee: string,
    paramIndex: number,
  ): boolean {
    // ADR-029: an indirect call invokes a *value* -- a callback parameter, a
    // scope field, a struct field -- not a function name. Nothing will ever
    // declare it, so failing safe would fire on every callback that forwards
    // one of its caller's parameters, by construction rather than by accident.
    // Keep the pre-#1178 answer there; resolving the callback's declared
    // target is tracked separately.
    if (PassByValueAnalyzer.calleeIsIndirectCall(callerName, callee)) {
      return false;
    }

    const symbols = CodeGenState.symbolTable?.getOverloadsByCName(callee) ?? [];
    let sawCandidate = false;

    // Fold across every overload rather than answering from the first one.
    // Returning on the first match made the answer depend on declaration order
    // in the header: `store(const Sample&)` declared before
    // `store(Sample&, bool)` claimed the call could not mutate, for a call that
    // can only resolve to the second. Any candidate that may mutate wins.
    for (const symbol of symbols) {
      if (symbol.kind !== "function") continue;
      // getOverloadsByCName spans all three languages. A C-Next IFunctionSymbol
      // also has kind "function", but its IParameterInfo.type is a TType
      // object rather than a string, so the structural read below would be a
      // lie for it -- and typeIsIndirect would call .replace() on an object.
      // This method's premise is "not a C-Next function in this build", so say
      // so rather than letting the cast paper over it.
      if (symbol.sourceLanguage === ESourceLanguage.CNext) continue;
      const parameters = (
        symbol as {
          parameters?: ReadonlyArray<{
            type?: string;
            isArray?: boolean;
            isConst?: boolean;
          }>;
        }
      ).parameters;
      const parameter = parameters?.[paramIndex];
      if (!parameter) continue;
      sawCandidate = true;
      if (
        PassByValueAnalyzer.parameterCarriesIndirection(
          parameter.type ?? "",
          parameter.isArray ?? false,
          parameter.isConst ?? false,
        )
      ) {
        return true;
      }
    }

    // Nothing declares this callee at this position -- withhold auto-const
    // rather than assume purity. Explicit rather than a fallthrough.
    return !sawCandidate;
  }

  /**
   * Whether a C/C++ parameter lets the callee change something the caller can
   * observe.
   *
   * A by-value parameter is a copy, so it cannot. An array, pointer or
   * reference can -- unless the declaration says const, in which case the
   * callee may not write through it and auto-const on the caller's parameter
   * is still sound.
   */
  private static parameterCarriesIndirection(
    type: string,
    isArray: boolean,
    isConst: boolean,
  ): boolean {
    if (isConst) return false;
    if (isArray) return true;
    return PassByValueAnalyzer.typeIsIndirect(type);
  }

  /**
   * Follow typedef aliases looking for pointer or reference indirection.
   * A typedef can hide it entirely (`typedef struct spi_device_t
   * *spi_device_handle_t`), so the alias chain is followed rather than the
   * spelling pattern-matched. Bounded so a self-referential chain cannot spin.
   */
  private static typeIsIndirect(type: string): boolean {
    let current = type;
    const seen = new Set<string>();
    for (let hop = 0; hop < 8; hop++) {
      if (/[*&]/.test(current)) return true;
      const bare = current
        .replace(/\b(const|volatile|struct|union|enum)\b/g, "")
        .trim();
      // Both exits mean the chain is known and unfinished, exactly as running
      // out of hops does below -- so they answer the same way. An empty type is
      // unknown rather than by-value for the same reason. Neither is reachable
      // from valid C (a self-referential typedef is ill-formed and
      // ICParameterInfo.type is a required string), so nothing observable turns
      // on it; they are aligned so the three exits do not read as disagreeing.
      if (!bare || seen.has(bare)) return true;
      seen.add(bare);
      const alias = PassByValueAnalyzer.resolveTypedefTarget(bare);
      // Deliberate exception: an alias this build never parsed (uint8_t,
      // size_t) is treated as a plain value. Calling it indirection would
      // reintroduce exactly the #957/#995 false positives measured for #1178.
      if (alias === null) return false;
      current = alias;
    }
    // Out of hops means the chain is known and unfinished, not unknown --
    // answering "by value" here would be the same collapse of "I cannot tell"
    // into "it is pure" that #1178 removes one level up.
    return true;
  }

  /**
   * The underlying type of a C/C++ typedef, or null when the name is not a
   * typedef this build has seen.
   */
  private static resolveTypedefTarget(name: string): string | null {
    const symbols = CodeGenState.symbolTable?.getOverloadsByCName(name) ?? [];
    for (const symbol of symbols) {
      if (symbol.kind !== "type") continue;
      const aliased = (symbol as { type?: string }).type;
      if (typeof aliased === "string" && aliased.length > 0) return aliased;
    }
    return null;
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
            const fullName = QualifiedCName.fromParts([scopeName, funcName]);
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

    // 2. Walk all expressions in this statement for function calls
    for (const expr of StatementExpressionCollector.collectAll(stmt)) {
      PassByValueAnalyzer.walkExpressionForCalls(funcName, paramSet, expr);
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

    const { baseIdentifier } = AssignmentTargetExtractor.extract(target);

    // Track as modified parameter (covers both `x <- value` and subscripted
    // writes like `x[i] <- value` / `x[4] <- true` — both change x's value,
    // so x must pass by pointer for the caller to observe the change)
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

    // ADR-070: `(void) f(cfg);` is a castExpression wrapping the call, so the
    // call is a level deeper than a bare `f(cfg);`. Without this the explicit
    // discard would hide the callee from modification tracking and the caller's
    // parameter would be inferred const even though the callee mutates it.
    const cast = primary.castExpression();
    if (cast?.unaryExpression()) {
      PassByValueAnalyzer.walkUnaryExpressionForCalls(
        funcName,
        paramSet,
        cast.unaryExpression()!,
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
   * Issue #797: Resolve bare function names to scope-qualified names when inside a scope.
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

    const bareCalleeName = primary.IDENTIFIER()!.getText();
    const resolvedCalleeName = PassByValueAnalyzer.resolveCalleeNameInScope(
      funcName,
      bareCalleeName,
    );
    PassByValueAnalyzer.recordCallsFromArgList(
      funcName,
      paramSet,
      resolvedCalleeName,
      firstOp,
    );
  }

  /**
   * Issue #797: Resolve a bare function name to its scope-qualified name.
   * When inside a scope, bare calls like `fillData()` should resolve to `Scope_fillData`.
   *
   * Uses SymbolRegistry for proper scope-aware resolution instead of string parsing.
   */
  private static resolveCalleeNameInScope(
    callerFuncName: string,
    bareCalleeName: string,
  ): string {
    // Try to resolve using SymbolRegistry (new type system)
    const callerScope = SymbolRegistry.getScopeByCFunctionName(callerFuncName);
    if (callerScope) {
      // Use SymbolRegistry.resolveFunction to find the callee in scope chain
      const callee = SymbolRegistry.resolveFunction(
        bareCalleeName,
        callerScope,
      );
      if (callee) {
        // ScopeUtils.getTranspiledCName is the single encoder for symbol identity.
        // Not QualifiedNameGenerator: this is the logic layer, and depcruise's
        // logic-cannot-import-output rule (severity: error) forbids reaching into
        // output/codegen for it.
        return ScopeUtils.getTranspiledCName(callee);
      }
    }

    // Fallback to legacy string-based lookup for backward compatibility
    // (handles functions from C headers, external functions, etc.)
    const separatorIndex = callerFuncName.indexOf(QualifiedCName.SEPARATOR);
    if (separatorIndex === -1) {
      return bareCalleeName;
    }

    const scopePrefix = callerFuncName.substring(
      0,
      separatorIndex + QualifiedCName.SEPARATOR.length,
    );
    const qualifiedName = scopePrefix + bareCalleeName;

    if (CodeGenState.functionParamLists.has(qualifiedName)) {
      return qualifiedName;
    }

    return bareCalleeName;
  }

  /**
   * Handle scope-qualified calls: Scope.method(...) or global.Scope.method(...)
   * Track member accesses to build the transpiled C name (e.g., Storage_load)
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

    for (const [opIndex, op] of postfixOps.entries()) {
      if (op.IDENTIFIER()) {
        memberNames.push(op.IDENTIFIER()!.getText());
      } else if (op.LPAREN()) {
        // Issue #1210: a bare call is `IDENTIFIER (args)`, so its parenthesis
        // is the *first* postfix op. handleSimpleFunctionCall has already
        // recorded that call, resolved through ADR-057 scope rules; recording
        // it again here under the raw bare name produced a second entry that
        // functionParamLists -- keyed by transpiled C name -- can never match.
        //
        // `global.f(x)` and `Scope.f(x)` are unaffected: there an identifier op
        // precedes the parenthesis, so opIndex > 0 and the chain is genuinely
        // qualified.
        if (opIndex > 0 && memberNames.length >= 1) {
          const calleeName = QualifiedCName.fromParts(memberNames);
          PassByValueAnalyzer.recordCallsFromArgList(
            funcName,
            paramSet,
            calleeName,
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
      const scopeName = QualifiedCName.split(funcName)[0];
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
          // - Not an array (array parameters always decay to pointers, ADR-006)
          // - Not modified (a subscripted bit-write, e.g. `x[4] <- true`, counts
          //   as a modification and is already tracked in `modified` above)
          const isSmallPrimitive = SMALL_PRIMITIVES.has(paramSig.baseType);
          const isArray = paramSig.isArray ?? false;
          const isModified = modified.has(paramName);

          if (isSmallPrimitive && !isArray && !isModified) {
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
