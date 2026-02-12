/**
 * Initialization Analyzer
 * Detects use of uninitialized variables (Rust-style E0381 errors)
 *
 * Phases:
 * 1. Linear code tracking
 * 2. Control flow (if/else branches)
 * 3. Loop analysis
 * 4. Scope tracking
 * 5. Function parameters (always initialized)
 * 7. Per-field struct tracking
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IInitializationError from "./types/IInitializationError";
import IDeclarationInfo from "./types/IDeclarationInfo";
import ScopeStack from "./ScopeStack";
import ExpressionUtils from "../../../utils/ExpressionUtils";
import ParserUtils from "../../../utils/ParserUtils";
import analyzePostfixOps from "../../../utils/PostfixAnalysisUtils";
import SymbolTable from "../symbols/SymbolTable";
import CodeGenState from "../../state/CodeGenState";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import ESymbolKind from "../../../utils/types/ESymbolKind";

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
  private readonly savedStates: Map<string, IVariableState>[] = [];

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
    ctx: Parser.FunctionDeclarationContext,
  ): void => {
    this.functionDepth++;
    this.analyzer.enterScope();

    // Declare parameters as initialized
    const paramList = ctx.parameterList();
    if (paramList) {
      for (const param of paramList.parameter()) {
        const name = param.IDENTIFIER().getText();
        const { line, column } = ParserUtils.getPosition(param);

        // Get type name for struct tracking
        const typeCtx = param.type();
        let typeName: string | null = null;
        if (typeCtx.userType()) {
          typeName = typeCtx.userType()!.IDENTIFIER().getText();
        }

        this.analyzer.declareParameter(name, line, column, typeName);
      }
    }
  };

  override exitFunctionDeclaration = (
    _ctx: Parser.FunctionDeclarationContext,
  ): void => {
    this.analyzer.exitScope();
    this.functionDepth--;
  };

  override enterBlock = (_ctx: Parser.BlockContext): void => {
    this.analyzer.enterScope();
  };

  override exitBlock = (_ctx: Parser.BlockContext): void => {
    this.analyzer.exitScope();
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

    this.analyzer.declareVariable(
      name,
      line,
      column,
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
    const postfixOps = targetCtx.postfixTargetOp();

    if (!baseId) {
      return;
    }

    // Simple variable assignment: x <- value (no postfix ops)
    if (postfixOps.length === 0) {
      this.analyzer.recordAssignment(baseId);
      return;
    }

    // Analyze postfix operations
    const { identifiers, hasSubscript } = analyzePostfixOps(baseId, postfixOps);

    // Member access: p.x <- value (struct field)
    if (identifiers.length >= 2 && !hasSubscript) {
      const varName = identifiers[0];
      const fieldName = identifiers[1];
      this.analyzer.recordAssignment(varName, fieldName);
    } else {
      // Array access or mixed: arr[i] <- value or arr[i].field <- value
      // Consider the array/base as a whole initialized
      this.analyzer.recordAssignment(baseId);
    }
  };

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
    if (identifier) {
      this.analyzer.recordAssignment(identifier);
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

    // Check if this is part of a postfixExpression with member access
    const parent = ctx.parent as Parser.PostfixExpressionContext | undefined;
    if (this._handlePostfixExpression(parent, name, line, column)) {
      return;
    }

    this.analyzer.checkRead(name, line, column);
  };

  /**
   * Check if we should skip read checking in current context
   */
  private _shouldSkipReadCheck(): boolean {
    return this.analyzer.isInWriteContext() || this.inFunctionCallArgs > 0;
  }

  /**
   * Handle postfix expression member access. Returns true if handled.
   */
  private _handlePostfixExpression(
    parent: Parser.PostfixExpressionContext | undefined,
    name: string,
    line: number,
    column: number,
  ): boolean {
    if (!parent?.postfixOp || parent.postfixOp().length === 0) {
      return false;
    }

    const ops = parent.postfixOp();

    // Check if we should skip for .length on non-string types
    if (this._shouldSkipLengthCheck(name, ops)) {
      return true;
    }

    // If the first postfixOp is a member access, check the field
    const firstOpText = ops[0].getText();
    if (firstOpText.startsWith(".")) {
      const fieldName = firstOpText.slice(1);
      this.analyzer.checkRead(name, line, column, fieldName);
      return true;
    }

    return false;
  }

  /**
   * Issue #196 Bug 2: Check if we should skip init check for .length
   * on non-string types (compile-time property)
   */
  private _shouldSkipLengthCheck(
    name: string,
    ops: Parser.PostfixOpContext[],
  ): boolean {
    const varState = this.analyzer.lookupVariableState(name);
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

    // Check if there's an else clause
    const hasElse = ctx.ELSE() !== null;

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
   * where CONSTANT > 0
   */
  private isDeterministicForLoop(ctx: Parser.ForStatementContext): boolean {
    const init = ctx.forInit();
    const cond = ctx.expression();

    if (!init || !cond) return false;

    // Check if init is a variable declaration starting at 0
    const forVarDecl = init.forVarDecl();
    if (forVarDecl) {
      const initExpr = forVarDecl.expression();
      if (!initExpr) return false;
      const initText = initExpr.getText();
      if (initText !== "0") return false;
    } else {
      // forAssignment case: check if assigning 0
      const forAssign = init.forAssignment();
      if (!forAssign) return false;
      const assignExpr = forAssign.expression();
      if (!assignExpr) return false;
      const assignText = assignExpr.getText();
      if (assignText !== "0") return false;
    }

    // Check if condition is var < POSITIVE_CONSTANT
    const condText = cond.getText();
    // Match patterns like "i<4" or "ti<3" (no spaces in AST getText())
    const match = /^\w+<(\d+)$/.exec(condText);
    if (!match) return false;
    const bound = Number.parseInt(match[1], 10);
    return bound > 0;
  }

  override exitForStatement = (ctx: Parser.ForStatementContext): void => {
    const stateBeforeLoop = this.savedStates.pop();
    if (stateBeforeLoop) {
      const isDeterministic = this.isDeterministicForLoop(ctx);
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
  private errors: IInitializationError[] = [];

  private scopeStack: ScopeStack<IVariableState> = new ScopeStack();

  /**
   * C-Next struct fields from current file (collected at analysis time).
   * External struct fields from C/C++ headers are accessed via CodeGenState.
   */
  private cnextStructFields: Map<string, Set<string>> = new Map();

  /** Track if we're processing a write target (left side of assignment) */
  private inWriteContext: boolean = false;

  /** Symbol table for checking C++ types (Issue #503) */
  private symbolTable: SymbolTable | null = null;

  /**
   * @deprecated Use CodeGenState.getExternalStructFields() instead.
   * This method is kept for backwards compatibility but is now a no-op
   * since external struct fields are read directly from CodeGenState.
   */
  public registerExternalStructFields(
    _externalFields: Map<string, Set<string>>,
  ): void {
    // External struct fields are now read from CodeGenState.getExternalStructFields()
    // This method is kept for API compatibility but does nothing.
  }

  /**
   * Get struct fields for a given struct type.
   * Checks C-Next structs first, then falls back to CodeGenState for external structs.
   */
  private getStructFields(structName: string): Set<string> | undefined {
    // Check C-Next structs from current file first
    const cnextFields = this.cnextStructFields.get(structName);
    if (cnextFields) {
      return cnextFields;
    }

    // Check external structs from CodeGenState
    return CodeGenState.getExternalStructFields().get(structName);
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
    if (!this.symbolTable) {
      return false;
    }

    const symbols = this.symbolTable.getOverloads(typeName);
    for (const sym of symbols) {
      if (sym.sourceLanguage === ESourceLanguage.Cpp) {
        // C++ classes and structs have default constructors
        if (sym.kind === ESymbolKind.Struct || sym.kind === ESymbolKind.Class) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Analyze a parsed program for initialization errors
   * @param tree The parsed program AST
   * @param symbolTable Optional symbol table for C++ type detection
   * @returns Array of initialization errors
   */
  public analyze(
    tree: Parser.ProgramContext,
    symbolTable?: SymbolTable,
  ): IInitializationError[] {
    this.errors = [];
    this.scopeStack = new ScopeStack();
    this.symbolTable = symbolTable ?? null;
    // Clear C-Next struct fields from previous analysis (external fields come from CodeGenState)
    this.cnextStructFields = new Map();

    // First pass: collect struct definitions from current file
    this.collectStructDefinitions(tree);

    // Create global scope with all global/namespace variable declarations
    this.createGlobalScope(tree);

    // Second pass: analyze initialization
    const listener = new InitializationListener(this);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Create the global scope with all top-level variable declarations
   * Global variables are considered "initialized" (zero-init by ADR-015)
   */
  private createGlobalScope(tree: Parser.ProgramContext): void {
    this.enterScope(); // Create global scope

    for (const decl of tree.declaration()) {
      this._processGlobalVariable(decl);
      this._processScopeMembers(decl);
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
    this.declareVariable(name, line, column, true, typeName);
  }

  /**
   * Process scope member variable declarations (ADR-016)
   */
  private _processScopeMembers(decl: Parser.DeclarationContext): void {
    const scopeDecl = decl.scopeDeclaration();
    if (!scopeDecl) return;

    const scopeName = scopeDecl.IDENTIFIER().getText();
    for (const member of scopeDecl.scopeMember()) {
      this._processScopeMemberVariable(member, scopeName);
    }
  }

  /**
   * Process a single scope member variable
   */
  private _processScopeMemberVariable(
    member: Parser.ScopeMemberContext,
    scopeName: string,
  ): void {
    const memberVar = member.variableDeclaration();
    if (!memberVar) return;

    const varName = memberVar.IDENTIFIER().getText();
    const fullName = `${scopeName}_${varName}`; // Mangled name
    const { line, column } = ParserUtils.getPosition(memberVar);
    const typeName = this._extractUserTypeName(memberVar.type());

    // Register with both raw name and mangled name for scope resolution
    this.declareVariable(varName, line, column, true, typeName);
    this.declareVariable(fullName, line, column, true, typeName);
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
  // Scope Management (delegated to ScopeStack)
  // ========================================================================

  /**
   * Enter a new scope (function, block, etc.)
   */
  public enterScope(): void {
    this.scopeStack.enterScope();
  }

  /**
   * Exit the current scope
   */
  public exitScope(): void {
    this.scopeStack.exitScope();
  }

  // ========================================================================
  // Variable Tracking
  // ========================================================================

  /**
   * Declare a variable (may or may not be initialized)
   */
  public declareVariable(
    name: string,
    line: number,
    column: number,
    hasInitializer: boolean,
    typeName: string | null,
    isStringType: boolean = false,
  ): void {
    if (!this.scopeStack.hasActiveScope()) {
      // Global scope - create implicit scope
      this.enterScope();
    }

    const isStruct = typeName !== null && this.isKnownStruct(typeName);
    const fields = isStruct
      ? this.getStructFields(typeName)!
      : new Set<string>();

    // Issue #503: C++ classes with default constructors are automatically initialized
    const isCppClassType = typeName !== null && this.isCppClass(typeName);
    const isInitialized = hasInitializer || isCppClassType;

    const state: IVariableState = {
      declaration: { name, line, column },
      initialized: isInitialized,
      typeName,
      isStruct,
      isStringType,
      // If initialized with full struct initializer or C++ class, all fields are initialized
      initializedFields: isInitialized ? new Set(fields) : new Set(),
    };

    this.scopeStack.declare(name, state);
  }

  /**
   * Record that a variable (or field) has been assigned
   * SonarCloud S3776: Refactored to use helper methods.
   */
  public recordAssignment(name: string, field?: string): void {
    this.scopeStack.update(name, (state) => {
      if (field) {
        this.recordFieldAssignment(state, field);
      } else {
        this.recordWholeAssignment(state);
      }
      return state;
    });
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
    name: string,
    line: number,
    column: number,
    field?: string,
  ): void {
    const state = this.scopeStack.lookup(name);

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
  public lookupVariableState(name: string): IVariableState | null {
    return this.scopeStack.lookup(name);
  }

  // ========================================================================
  // Control Flow (using ScopeStack's clone/restore)
  // ========================================================================

  /**
   * Clone the current scope state for branch analysis
   */
  public cloneScopeState(): Map<string, IVariableState> {
    return this.scopeStack.cloneState((state) => ({
      ...state,
      initializedFields: new Set(state.initializedFields),
    }));
  }

  /**
   * Restore initialization state from a saved snapshot
   * Used for control flow analysis to "undo" branch changes
   */
  public restoreFromState(savedState: Map<string, IVariableState>): void {
    this.scopeStack.restoreState(savedState, (_current, saved) => ({
      ...saved,
      initializedFields: new Set(saved.initializedFields),
    }));
  }

  /**
   * Merge initialization state from a saved snapshot
   * Used for deterministic loops where initialization inside the loop
   * should be preserved (the loop WILL run at least once)
   */
  public mergeInitializationState(
    beforeState: Map<string, IVariableState>,
  ): void {
    // For each variable, keep current init state but merge in any fields
    // that were initialized before the loop
    for (const [name, beforeVar] of beforeState) {
      this.scopeStack.update(name, (currentState) => {
        for (const field of beforeVar.initializedFields) {
          currentState.initializedFields.add(field);
        }
        return currentState;
      });
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

  // ========================================================================
  // Write Context Tracking
  // ========================================================================

  public setWriteContext(inWrite: boolean): void {
    this.inWriteContext = inWrite;
  }

  public isInWriteContext(): boolean {
    return this.inWriteContext;
  }

  // ========================================================================
  // Function Parameters
  // ========================================================================

  /**
   * Declare function parameters (always initialized by caller)
   */
  public declareParameter(
    name: string,
    line: number,
    column: number,
    typeName: string | null,
  ): void {
    if (!this.scopeStack.hasActiveScope()) {
      this.enterScope();
    }

    const isStruct = typeName !== null && this.isKnownStruct(typeName);
    const fields = isStruct
      ? this.getStructFields(typeName)!
      : new Set<string>();

    const state: IVariableState = {
      declaration: { name, line, column },
      initialized: true, // Parameters are always initialized by caller
      typeName,
      isStruct,
      isStringType: false, // Not tracked for parameters since they're always initialized
      initializedFields: new Set(fields), // All fields initialized
    };

    this.scopeStack.declare(name, state);
  }
}

export default InitializationAnalyzer;
