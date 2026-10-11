/**
 * Initialization Analyzer
 * Detects use of uninitialized variables (Rust-style E0381 errors)
 *
 * Phases:
 * 1. Linear code tracking
 * 2. Control flow (if/else branches)
 * 3. Loop analysis
 * 4. Bindings from 1.4 (`IProgram.bindValue`, #2004)
 * 5. Function parameters (always initialized)
 * 7. Per-field struct tracking
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import IInitializationError from "./types/IInitializationError";
import IDeclarationInfo from "./types/IDeclarationInfo";
import ExpressionUtils from "../../utils/ExpressionUtils";
import ParserUtils from "../../utils/ParserUtils";
import analyzePostfixOps from "../../utils/PostfixAnalysisUtils";
import ESourceLanguage from "../../utils/types/ESourceLanguage";
import ScopeUtils from "../../utils/ScopeUtils";
import ChainRoot from "../../utils/ChainRoot";
import ExpressionShape from "../../utils/ExpressionShape";
import StatementChildren from "../../utils/StatementChildren";
import StatementWrites from "../../utils/StatementWrites";
import LoweredStatements from "../../utils/LoweredStatements";
import type TExpression from "../../types/syntax/TExpression";
import invariant from "../../utils/invariant";
import type ISourcePosition from "../../utils/types/ISourcePosition";
import type ILocalDeclaration from "../../types/ILocalDeclaration";
import type TChainRoot from "../../types/TChainRoot";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type TStatement from "../../types/syntax/TStatement";
import type IAnalysisContext from "./types/IAnalysisContext";

/**
 * #2004: what initialization state is kept for -- the declaration 1.4 binds a
 * spelling to: a function-local declaration itself, or a file-scope variable
 * or scope member by its C name
 */
type TInitKey = ILocalDeclaration | string;

/**
 * Tracks the initialization state of a variable
 */
interface IVariableState {
  /** Where the variable was declared */
  declaration: IDeclarationInfo;
  /** Whether the variable has been initialized */
  initialized: boolean;
  /** Type of the variable (for struct field tracking) */
  typeName: string | null;
  /** For structs: which fields have been initialized */
  initializedFields: Set<string>;
  /** Is this a struct type? */
  isStruct: boolean;
  /** Is this a string type? (string<N> or string) */
  isStringType: boolean;
}

/**
 * Listener that walks the parse tree and tracks initialization
 */
class InitializationListener extends CNextListener {
  private readonly analyzer: InitializationAnalyzer;

  /** Stack of saved states before each if statement */
  private readonly savedStates: Map<TInitKey, IVariableState>[] = [];

  /** Track when we're inside a function call's argument list */
  private inFunctionCallArgs: number = 0;

  /** Track nesting depth inside functions/methods (0 = global level) */
  private functionDepth: number = 0;

  constructor(analyzer: InitializationAnalyzer) {
    super();
    this.analyzer = analyzer;
  }

  // ========================================================================
  // Scope Entry/Exit
  // ========================================================================

  override enterFunctionDeclaration = (
    _ctx: Parser.FunctionDeclarationContext,
  ): void => {
    this.functionDepth++;
  };

  override exitFunctionDeclaration = (
    _ctx: Parser.FunctionDeclarationContext,
  ): void => {
    this.functionDepth--;
  };

  // ========================================================================
  // Variable Declarations
  // ========================================================================

  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    // Skip global variables - they're already handled by createGlobalScope()
    if (this.functionDepth === 0) {
      return;
    }

    const name = ctx.IDENTIFIER().getText();
    const { line, column } = ParserUtils.getPosition(ctx);
    const hasInitializer = ctx.expression() !== null;

    // Get type name for struct tracking
    const typeCtx = ctx.type();
    let typeName: string | null = null;
    if (typeCtx.userType()) {
      typeName = typeCtx.userType()!.IDENTIFIER().getText();
    }

    // Check if this is a string type (string<N> or string)
    const isStringType = typeCtx.stringType() !== null;

    // #2004: state is kept for the declaration 1.4 framed, the one a use of
    // this name binds to
    const key = this.analyzer.framedDeclaration(ctx.IDENTIFIER().symbol);
    invariant(
      key !== null,
      `1.4 frames every declaration in a function body ('${name}')`,
    );

    this.analyzer.declareVariable(
      key,
      { name, line, column },
      hasInitializer,
      typeName,
      isStringType,
    );
  };

  // ========================================================================
  // Assignments
  // ========================================================================

  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    const targetCtx = ctx.assignmentTarget();
    const baseId = targetCtx.IDENTIFIER()?.getText();
    if (!baseId) {
      return;
    }

    // #2004: what 1.4 binds the target to, from the target's own root --
    // `global.x` is the file-scope variable and `this.x` the scope member,
    // even where a local of the name shadows it (#2001)
    const key = this.analyzer.bindingKey(
      ChainRoot.ofTarget(targetCtx),
      baseId,
      ParserUtils.getPosition(targetCtx),
    );
    if (key === null) {
      return;
    }

    // Resolve the assignment target ONCE (single source of truth)
    const target = this._resolveAssignmentTarget(
      baseId,
      targetCtx.postfixTargetOp(),
    );

    // Issue #1012: Compound assignment reads the LHS before writing.
    // Check if the assignment operator is a compound operator (not simple `<-`).
    const isCompoundAssignment = ctx.assignmentOperator().ASSIGN() === null;
    if (isCompoundAssignment) {
      const { line, column } = ParserUtils.getPosition(ctx);
      this.analyzer.checkRead(
        key,
        target.varName,
        line,
        column,
        target.fieldName,
      );
    }

    // Record the assignment to the resolved target
    this.analyzer.recordAssignment(key, target.fieldName);
  };

  /**
   * Resolve an assignment target to its variable name and optional field name.
   * Single classification path used by both read checks and assignment recording.
   */
  private _resolveAssignmentTarget(
    baseId: string,
    postfixOps: Parser.PostfixTargetOpContext[],
  ): { varName: string; fieldName?: string } {
    // Simple variable: x <- value (no postfix ops)
    if (postfixOps.length === 0) {
      return { varName: baseId };
    }

    // Analyze postfix operations
    const { identifiers, hasSubscript } = analyzePostfixOps(baseId, postfixOps);

    // Member access: p.x <- value (struct field)
    if (identifiers.length >= 2 && !hasSubscript) {
      return { varName: identifiers[0], fieldName: identifiers[1] };
    }

    // Array access or mixed: arr[i] <- value or arr[i].field <- value
    // Consider the array/base as a whole
    return { varName: baseId };
  }

  // ========================================================================
  // Function Call Arguments (ADR-006: pass-by-reference may initialize)
  // ========================================================================

  override enterArgumentList = (_ctx: Parser.ArgumentListContext): void => {
    // When inside function call arguments, variables passed may be output params
    // We don't error on uninitialized reads, and we mark them as initialized after
    this.inFunctionCallArgs++;
  };

  override exitArgumentList = (ctx: Parser.ArgumentListContext): void => {
    this.inFunctionCallArgs--;

    // Mark any simple identifiers passed as arguments as initialized
    // (they might be output parameters that the function writes to)
    for (const expr of ctx.expression()) {
      // Walk down to find simple identifiers
      this.markArgumentsAsInitialized(expr);
    }
  };

  /**
   * Mark simple identifier arguments as initialized.
   * Only marks truly simple identifiers (not complex expressions like `a + b`).
   */
  private markArgumentsAsInitialized(expr: Parser.ExpressionContext): void {
    const identifier = ExpressionUtils.extractIdentifier(expr);
    if (!identifier) return;
    const key = this.analyzer.bindingKey(
      null,
      identifier,
      ParserUtils.getPosition(expr),
    );
    if (key !== null) {
      this.analyzer.recordAssignment(key);
    }
  }

  // ========================================================================
  // Variable Reads (in expressions)
  // ========================================================================

  override enterPrimaryExpression = (
    ctx: Parser.PrimaryExpressionContext,
  ): void => {
    if (this._shouldSkipReadCheck()) return;
    if (!ctx.IDENTIFIER()) return;

    const name = ctx.IDENTIFIER()!.getText();
    const { line, column } = ParserUtils.getPosition(ctx);
    const key = this.analyzer.bindingKey(null, name, { line, column });
    if (key === null) return;

    // Check if this is part of a postfixExpression with member access
    const parent = ctx.parent as Parser.PostfixExpressionContext | undefined;
    if (this._handlePostfixExpression(parent, key, name, line, column)) {
      return;
    }

    this.analyzer.checkRead(key, name, line, column);
  };

  /**
   * Check if we should skip read checking in current context
   */
  private _shouldSkipReadCheck(): boolean {
    return this.inFunctionCallArgs > 0;
  }

  /**
   * Handle postfix expression member access. Returns true if handled.
   */
  private _handlePostfixExpression(
    parent: Parser.PostfixExpressionContext | undefined,
    key: TInitKey,
    name: string,
    line: number,
    column: number,
  ): boolean {
    if (!parent?.postfixOp || parent.postfixOp().length === 0) {
      return false;
    }

    const ops = parent.postfixOp();

    // Check if we should skip for .length on non-string types
    if (this._shouldSkipLengthCheck(key, ops)) {
      return true;
    }

    // If the first postfixOp is a member access, check the field
    const firstOpText = ops[0].getText();
    if (firstOpText.startsWith(".")) {
      const fieldName = firstOpText.slice(1);
      this.analyzer.checkRead(key, name, line, column, fieldName);
      return true;
    }

    return false;
  }

  /**
   * Issue #196 Bug 2: Check if we should skip init check for .length
   * on non-string types (compile-time property)
   */
  private _shouldSkipLengthCheck(
    key: TInitKey,
    ops: Parser.PostfixOpContext[],
  ): boolean {
    const varState = this.analyzer.lookupVariableState(key);
    const isStringType = varState?.isStringType ?? false;

    if (isStringType) return false;

    const lastOp = ops.at(-1)!.getText();
    if (lastOp !== ".length") return false;

    const firstOpText = ops[0].getText();
    // Skip if: direct .length or array element .length
    // Don't skip for struct member access (.field.length)
    return ops.length === 1 || firstOpText.startsWith("[");
  }

  // ========================================================================
  // Control Flow: If Statements
  // ========================================================================

  override enterIfStatement = (_ctx: Parser.IfStatementContext): void => {
    // Save current state before entering if
    const stateBefore = this.analyzer.cloneScopeState();
    this.savedStates.push(stateBefore);
  };

  override exitIfStatement = (ctx: Parser.IfStatementContext): void => {
    const stateBefore = this.savedStates.pop();
    if (!stateBefore) return;

    // Check if there's an else clause (#2003: the lowered `if` says)
    const hasElse = this.analyzer.lowered("if", ctx).whenFalse !== null;

    if (hasElse) {
      // With else: the tree walker processes both branches in order.
      // If a variable is initialized in both branches, it ends up initialized.
      // If only one branch initializes it, it may or may not be initialized
      // depending on which branch ran last in the traversal.
      // For now, we'll trust the final state - this is optimistic but
      // often correct for the common pattern where both branches initialize.
      // (A more precise analysis would track both branches separately)
      // Don't restore - keep whatever state the branches produced.
    } else {
      // No else: the if might not execute, so restore to state before if
      // Any initializations inside the if are not guaranteed
      this.analyzer.restoreFromState(stateBefore);
    }
  };

  // ========================================================================
  // Control Flow: Loops
  // ========================================================================

  override enterWhileStatement = (_ctx: Parser.WhileStatementContext): void => {
    // Save state before loop - we'll restore after because loop might not run
    this.savedStates.push(this.analyzer.cloneScopeState());
  };

  override exitWhileStatement = (_ctx: Parser.WhileStatementContext): void => {
    // Loops are conservative: we assume they might not run at all
    // So we restore state to before the loop
    const stateBeforeLoop = this.savedStates.pop();
    if (stateBeforeLoop) {
      this.analyzer.restoreFromState(stateBeforeLoop);
    }
  };

  override enterForStatement = (_ctx: Parser.ForStatementContext): void => {
    // Save state before loop
    this.savedStates.push(this.analyzer.cloneScopeState());
  };

  /**
   * Check if a for-loop is deterministic (will definitely run at least once)
   * A loop is deterministic if it has the form: for (var <- 0; var < CONSTANT; ...)
   * where CONSTANT > 0. Its parts are the lowered `for`'s (#2003).
   */
  private isDeterministicForLoop(
    loop: Extract<TStatement, { kind: "for" }>,
  ): boolean {
    const { init, condition } = loop;
    if (!init || !condition) return false;

    // The init, a declaration or an assignment, starts at 0
    const start = init.kind === "assignment" ? init.value : init.initializer;
    if (!InitializationListener.isLiteral(start, /^0$/)) return false;

    // The condition is var < POSITIVE_CONSTANT
    if (
      condition.kind !== "binary" ||
      condition.operators.length !== 1 ||
      condition.operators[0] !== "<"
    ) {
      return false;
    }
    const [left, bound] = condition.operands;
    return (
      left.kind === "identifier" &&
      InitializationListener.isLiteral(bound, /^\d+$/) &&
      Number.parseInt(bound.written, 10) > 0
    );
  }

  private static isLiteral(
    expression: TExpression | null,
    text: RegExp,
  ): boolean {
    return expression?.kind === "literal" && text.test(expression.text);
  }

  override exitForStatement = (ctx: Parser.ForStatementContext): void => {
    const stateBeforeLoop = this.savedStates.pop();
    if (stateBeforeLoop) {
      const isDeterministic = this.isDeterministicForLoop(
        this.analyzer.lowered("for", ctx),
      );
      if (isDeterministic) {
        // Deterministic loop - preserve initialization (loop WILL run)
        this.analyzer.mergeInitializationState(stateBeforeLoop);
      } else {
        // Non-deterministic loop - conservative restore (loop might not run)
        this.analyzer.restoreFromState(stateBeforeLoop);
      }
    }
  };
}

/**
 * Analyzes C-Next AST for use-before-initialization errors
 */
class InitializationAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  private errors: IInitializationError[] = [];

  private states = new Map<TInitKey, IVariableState>();

  /** The program's lowered statements, for the listener's roles (#2003) */
  private statements: LoweredStatements | null = null;

  /** The lowered `kind` statement a parse node starts (#2003) */
  public lowered<K extends TStatement["kind"]>(
    kind: K,
    ctx: Parameters<typeof ParserUtils.getPosition>[0],
  ): Extract<TStatement, { kind: K }> {
    invariant(this.statements !== null, "lowered() read outside analyze()");
    return this.statements.at(kind, ParserUtils.getPosition(ctx));
  }

  /**
   * C-Next struct fields from current file (collected at analysis time).
   * External struct fields from C/C++ headers are accessed via CodeGenState.
   */
  private cnextStructFields: Map<string, Set<string>> = new Map();

  /**
   * Get struct fields for a given struct type.
   * Checks C-Next structs first, then falls back to CodeGenState for external structs.
   */
  private getStructFields(structName: string): ReadonlySet<string> | undefined {
    // Check C-Next structs from current file first
    const cnextFields = this.cnextStructFields.get(structName);
    if (cnextFields) {
      return cnextFields;
    }

    // Check external structs from CodeGenState
    return this.context.program.externalStructFields().get(structName);
  }

  /**
   * Check if a type name is a known struct.
   */
  private isKnownStruct(typeName: string): boolean {
    return this.getStructFields(typeName) !== undefined;
  }

  /**
   * Issue #503: Check if a type name is a C++ class/struct
   * C++ classes with default constructors are automatically initialized.
   *
   * @param typeName The type name to check
   * @returns true if the type is from C++ (has constructor-based init)
   */
  private isCppClass(typeName: string): boolean {
    const symbols = this.context.symbolTable.getOverloads(typeName);
    for (const sym of symbols) {
      if (sym.sourceLanguage === ESourceLanguage.Cpp) {
        // C++ classes and structs have default constructors
        if (sym.kind === "struct" || sym.kind === "class") {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Analyze a parsed program for initialization errors
   * @param tree The parsed program AST
   * @param program The same program, lowered (1.2): its statements' children
   * @returns Array of initialization errors
   */
  public analyze(
    tree: Parser.ProgramContext,
    program: IProgramSyntax,
  ): IInitializationError[] {
    this.errors = [];
    this.states = new Map();
    this.statements = new LoweredStatements(program);
    // Clear C-Next struct fields from previous analysis (external fields come from CodeGenState)
    this.cnextStructFields = new Map();

    // First pass: collect struct definitions from current file
    this.collectStructDefinitions(tree);

    // Create global scope with all global/namespace variable declarations
    this.createGlobalScope(tree, program);

    // Second pass: analyze initialization
    const listener = new InitializationListener(this);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Create the global scope with all top-level variable declarations
   * Global variables are considered "initialized" (zero-init by ADR-015)
   */
  private createGlobalScope(
    tree: Parser.ProgramContext,
    program: IProgramSyntax,
  ): void {
    for (const decl of tree.declaration()) {
      this._processGlobalVariable(decl);
      this._processScopeMembers(decl, program);
    }
  }

  /**
   * Process a global variable declaration
   */
  private _processGlobalVariable(decl: Parser.DeclarationContext): void {
    const varDecl = decl.variableDeclaration();
    if (!varDecl) return;

    const name = varDecl.IDENTIFIER().getText();
    const { line, column } = ParserUtils.getPosition(varDecl);
    const typeName = this._extractUserTypeName(varDecl.type());

    // Globals are always initialized (zero-init or explicit)
    this.declareVariable(
      ScopeUtils.getTranspiledCName({ name, scopePath: "" }),
      { name, line, column },
      true,
      typeName,
    );
  }

  /**
   * Process scope member variable declarations (ADR-016)
   * Issue #1019: Scope members require explicit initialization like locals
   */
  private _processScopeMembers(
    decl: Parser.DeclarationContext,
    program: IProgramSyntax,
  ): void {
    const scopeDecl = decl.scopeDeclaration();
    if (!scopeDecl) return;
    const { line, column } = ParserUtils.getPosition(scopeDecl);
    const lowered = program.declarations.find(
      ({ declaration }) =>
        declaration.kind === "scope" &&
        declaration.span.line === line &&
        declaration.span.column === column,
    )?.declaration;
    invariant(
      lowered?.kind === "scope",
      `1.2 lowers every scope ('${scopeDecl.IDENTIFIER().getText()}')`,
    );

    // #1298: the whole scope PATH, not its leaf name, so a nested scope keeps
    // its outer components when its members are qualified.
    // No `??` fallback: `IProgram.scopePathOf` returns `string` and already
    // answers the bare name on a miss, so a second fallback here is a guard
    // that cannot fire and reads as if the method could answer null.
    const scopePath = this.context.program.scopePathOf(
      scopeDecl.IDENTIFIER().getText(),
    );

    // Phase 1: Find all members assigned in any scope function
    const assignedMembers = this._findAssignedScopeMembers(lowered);

    // Phase 2: Process each member with assignment info
    for (const member of scopeDecl.scopeMember()) {
      this._processScopeMemberVariable(member, scopePath, assignedMembers);
    }
  }

  /**
   * Scan all functions in a scope to find which members are assigned.
   * Issue #1019: A member assigned in ANY function is considered initialized
   * for reads in other functions within the same scope.
   */
  private _findAssignedScopeMembers(
    scopeDecl: Extract<TDeclarationSyntax, { kind: "scope" }>,
  ): Set<TInitKey> {
    const assigned = new Set<TInitKey>();

    for (const member of scopeDecl.members) {
      if (member.declaration.kind !== "function") continue;
      // Scan the function body for assignments to scope members
      this._collectAssignments(member.declaration.body.statements, assigned);
    }

    return assigned;
  }

  /**
   * Recursively collect the members assigned in statements, and in every
   * statement nested inside them (#2003: `critical` and `forever` included).
   */
  private _collectAssignments(
    statements: readonly TStatement[],
    assigned: Set<TInitKey>,
  ): void {
    for (const statement of statements) {
      this._collectDirectAssignment(statement, assigned);
      this._collectAssignments(StatementChildren.of(statement), assigned);
    }
  }

  /**
   * Collect the assignments the statement itself performs: an assignment
   * statement, or a `for` header's init and update (#2010).
   */
  private _collectDirectAssignment(
    statement: TStatement,
    assigned: Set<TInitKey>,
  ): void {
    for (const { target } of StatementWrites.of(statement)) {
      const head = ExpressionShape.headOf(target);
      if (!head.identifier) continue;

      // #2004: what 1.4 binds the target to -- a local, parameter or `for`
      // variable of the name, or `global.x`, is not this scope's member
      const key = this.bindingKey(head.root, head.identifier.name, target.span);
      if (key !== null) {
        assigned.add(key);
      }
    }
  }

  /**
   * Process a single scope member variable
   */
  private _processScopeMemberVariable(
    member: Parser.ScopeMemberContext,
    scopePath: string,
    assignedMembers: Set<TInitKey>,
  ): void {
    const memberVar = member.variableDeclaration();
    if (!memberVar) return;

    const varName = memberVar.IDENTIFIER().getText();
    const fullName = ScopeUtils.qualifyInScope(varName, scopePath); // Transpiled C name
    const { line, column } = ParserUtils.getPosition(memberVar);
    const typeName = this._extractUserTypeName(memberVar.type());

    // Issue #1019: Scope members are initialized if they have an inline
    // initializer OR are assigned in any function within the scope
    const hasInlineInit = memberVar.expression() !== null;
    const isAssignedInScope = assignedMembers.has(fullName);
    const hasInitializer = hasInlineInit || isAssignedInScope;

    this.declareVariable(
      fullName,
      { name: varName, line, column },
      hasInitializer,
      typeName,
    );
  }

  /**
   * Extract user type name from a type context
   */
  private _extractUserTypeName(typeCtx: Parser.TypeContext): string | null {
    return typeCtx.userType()?.IDENTIFIER().getText() ?? null;
  }

  /**
   * Collect struct definitions from current file to know their fields.
   * This supplements the external struct fields from CodeGenState.
   */
  private collectStructDefinitions(tree: Parser.ProgramContext): void {
    for (const decl of tree.declaration()) {
      const structDecl = decl.structDeclaration();
      if (structDecl) {
        const structName = structDecl.IDENTIFIER().getText();
        const fields = new Set<string>();

        for (const member of structDecl.structMember()) {
          const fieldName = member.IDENTIFIER().getText();
          fields.add(fieldName);
        }

        this.cnextStructFields.set(structName, fields);
      }
    }
  }

  // ========================================================================
  // Binding (#2004: 1.4's decision, not this analyzer's)
  // ========================================================================

  /** The declaration 1.4 framed for a declaring identifier, by its span */
  public framedDeclaration(identifier: {
    line: number;
    column: number;
  }): ILocalDeclaration | null {
    const frame = this.context.program.lexicalFrameAt(
      this.context.sourceFile,
      identifier,
    );
    return (
      frame.declarations.find(
        (d) =>
          d.span.line === identifier.line &&
          d.span.column === identifier.column,
      ) ?? null
    );
  }

  /**
   * What `IProgram.bindValue` binds a spelling to at a position, as a state
   * key; null for a name with no state here (a function, a scope, a header's)
   */
  public bindingKey(
    root: TChainRoot,
    name: string,
    at: ISourcePosition,
  ): TInitKey | null {
    const binding = this.context.program.bindValue(
      this.context.sourceFile,
      root,
      name,
      at,
    );
    if (binding?.kind === "local") return binding.declaration;
    if (binding?.kind === "variable") return binding.symbol.fullyQualifiedCName;
    return null;
  }

  // ========================================================================
  // Variable Tracking
  // ========================================================================

  /**
   * Start tracking a declaration. A parameter or `for` variable is never
   * tracked: its caller or its header initializes it, and an untracked key
   * reads as initialized.
   */
  public declareVariable(
    key: TInitKey,
    declaration: IDeclarationInfo,
    hasInitializer: boolean,
    typeName: string | null,
    isStringType: boolean = false,
  ): void {
    const isStruct = typeName !== null && this.isKnownStruct(typeName);
    const fields = isStruct
      ? this.getStructFields(typeName)!
      : new Set<string>();

    // Issue #503: C++ classes with default constructors are automatically initialized
    const isCppClassType = typeName !== null && this.isCppClass(typeName);
    const isInitialized = hasInitializer || isCppClassType;

    this.states.set(key, {
      declaration,
      initialized: isInitialized,
      typeName,
      isStruct,
      isStringType,
      // If initialized with full struct initializer or C++ class, all fields are initialized
      initializedFields: isInitialized ? new Set(fields) : new Set(),
    });
  }

  /**
   * Record that a variable (or field) has been assigned
   */
  public recordAssignment(key: TInitKey, field?: string): void {
    const state = this.states.get(key);
    if (!state) return;
    if (field) {
      this.recordFieldAssignment(state, field);
    } else {
      this.recordWholeAssignment(state);
    }
  }

  /**
   * Handle field-level assignment.
   */
  private recordFieldAssignment(state: IVariableState, field: string): void {
    state.initializedFields.add(field);
    // Check if all fields are now initialized
    if (!state.isStruct || !state.typeName) return;

    const allFields = this.getStructFields(state.typeName);
    if (!allFields) return;

    const allInitialized = [...allFields].every((f) =>
      state.initializedFields.has(f),
    );
    if (allInitialized) {
      state.initialized = true;
    }
  }

  /**
   * Handle whole-variable assignment.
   */
  private recordWholeAssignment(state: IVariableState): void {
    state.initialized = true;
    // Mark all fields as initialized too
    if (!state.isStruct || !state.typeName) return;

    const fields = this.getStructFields(state.typeName);
    if (fields) {
      state.initializedFields = new Set(fields);
    }
  }

  /**
   * Check if a variable (or field) is used before initialization
   * SonarCloud S3776: Refactored to use helper methods.
   */
  public checkRead(
    key: TInitKey,
    name: string,
    line: number,
    column: number,
    field?: string,
  ): void {
    const state = this.states.get(key);

    if (!state) {
      // Variable not found - let undefined variable handling deal with it
      return;
    }

    if (field) {
      this.checkFieldRead(name, line, column, field, state);
    } else if (!state.initialized) {
      this.addError(name, line, column, state.declaration, false);
    }
  }

  /**
   * Check field read for uninitialized access.
   * SonarCloud S3776: Extracted from checkRead().
   */
  private checkFieldRead(
    name: string,
    line: number,
    column: number,
    field: string,
    state: IVariableState,
  ): void {
    if (state.isStruct && state.typeName) {
      this.checkStructFieldRead(name, line, column, field, state);
      return;
    }

    if (state.isStringType) {
      this.checkStringPropertyRead(name, line, column, field, state);
    }
    // Other types: .field is a compile-time property, no check needed
  }

  /**
   * Check struct field read for initialization.
   */
  private checkStructFieldRead(
    name: string,
    line: number,
    column: number,
    field: string,
    state: IVariableState,
  ): void {
    const structFieldSet = this.getStructFields(state.typeName!);
    if (!structFieldSet?.has(field)) return;

    if (!state.initializedFields.has(field)) {
      this.addError(`${name}.${field}`, line, column, state.declaration, false);
    }
  }

  /**
   * Check string property read for initialization.
   */
  private checkStringPropertyRead(
    name: string,
    line: number,
    column: number,
    field: string,
    state: IVariableState,
  ): void {
    const runtimeProperties = ["length", "capacity", "size"];
    if (runtimeProperties.includes(field) && !state.initialized) {
      this.addError(name, line, column, state.declaration, false);
    }
  }

  /**
   * Public method to look up variable state
   * Issue #196 Bug 2: Used by visitor to check if variable is string type
   */
  public lookupVariableState(key: TInitKey): IVariableState | null {
    return this.states.get(key) ?? null;
  }

  // ========================================================================
  // Control Flow
  // ========================================================================

  /**
   * Clone the current scope state for branch analysis
   */
  public cloneScopeState(): Map<TInitKey, IVariableState> {
    return new Map(
      [...this.states].map(([key, state]) => [
        key,
        { ...state, initializedFields: new Set(state.initializedFields) },
      ]),
    );
  }

  /**
   * Restore initialization state from a saved snapshot
   * Used for control flow analysis to "undo" branch changes
   */
  public restoreFromState(savedState: Map<TInitKey, IVariableState>): void {
    for (const [key, saved] of savedState) {
      this.states.set(key, {
        ...saved,
        initializedFields: new Set(saved.initializedFields),
      });
    }
  }

  /**
   * Merge initialization state from a saved snapshot
   * Used for deterministic loops where initialization inside the loop
   * should be preserved (the loop WILL run at least once)
   */
  public mergeInitializationState(
    beforeState: Map<TInitKey, IVariableState>,
  ): void {
    for (const [key, beforeVar] of beforeState) {
      const current = this.states.get(key);
      if (!current) continue;
      for (const field of beforeVar.initializedFields) {
        current.initializedFields.add(field);
      }
    }
  }

  // ========================================================================
  // Error Reporting
  // ========================================================================

  private addError(
    variable: string,
    line: number,
    column: number,
    declaration: IDeclarationInfo,
    mayBeUninitialized: boolean,
  ): void {
    const certainty = mayBeUninitialized ? "possibly " : "";
    this.errors.push({
      code: "E0381",
      variable,
      line,
      column,
      declaration,
      mayBeUninitialized,
      message: `use of ${certainty}uninitialized variable '${variable}'`,
    });
  }
}

export default InitializationAnalyzer;
