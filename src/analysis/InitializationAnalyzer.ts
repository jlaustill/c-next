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
import { CNextListener } from "../antlr_parser/grammar/CNextListener";
import * as Parser from "../antlr_parser/grammar/CNextParser";
import IInitializationError from "./types/IInitializationError";
import IDeclarationInfo from "./types/IDeclarationInfo";
import ScopeStack from "./ScopeStack";
import ExpressionUtils from "../utils/ExpressionUtils";
import ParserUtils from "../utils/ParserUtils";

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
  private analyzer: InitializationAnalyzer;

  /** Stack of saved states before each if statement */
  private savedStates: Map<string, IVariableState>[] = [];

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

    // Simple variable assignment: x <- value
    if (
      targetCtx.IDENTIFIER() &&
      !targetCtx.memberAccess() &&
      !targetCtx.arrayAccess()
    ) {
      const name = targetCtx.IDENTIFIER()!.getText();
      this.analyzer.recordAssignment(name);
    }

    // Member access: p.x <- value (struct field) or arr[i][j] <- value (multi-dim array)
    if (targetCtx.memberAccess()) {
      const memberCtx = targetCtx.memberAccess()!;
      const identifiers = memberCtx.IDENTIFIER();
      if (identifiers.length >= 2) {
        // Struct field access: p.x <- value
        const varName = identifiers[0].getText();
        const fieldName = identifiers[1].getText();
        this.analyzer.recordAssignment(varName, fieldName);
      } else if (identifiers.length === 1) {
        // Multi-dimensional array access: arr[i][j] <- value
        const varName = identifiers[0].getText();
        this.analyzer.recordAssignment(varName);
      }
    }

    // Array access: arr[i] <- value
    if (targetCtx.arrayAccess()) {
      const arrayName = targetCtx.arrayAccess()!.IDENTIFIER().getText();
      // Array element assignment initializes that element, but for simplicity
      // we'll consider the array as a whole. More granular tracking would be complex.
      this.analyzer.recordAssignment(arrayName);
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
    // Skip if we're in a write context (left side of assignment)
    if (this.analyzer.isInWriteContext()) {
      return;
    }

    // Skip if we're in function call arguments (might be output param)
    if (this.inFunctionCallArgs > 0) {
      return;
    }

    // Check for simple identifier
    if (ctx.IDENTIFIER()) {
      const name = ctx.IDENTIFIER()!.getText();
      const { line, column } = ParserUtils.getPosition(ctx);

      // Check if this is part of a postfixExpression with member access
      const parent = ctx.parent as Parser.PostfixExpressionContext | undefined;
      if (parent?.postfixOp && parent.postfixOp().length > 0) {
        const ops = parent.postfixOp();
        const firstOp = ops[0];
        const opText = firstOp.getText();

        // Issue #196 Bug 2: Skip init check for .length on non-string types
        // .length is a compile-time type property that doesn't read runtime values
        // BUT: struct.field.length where field is a string DOES need init check
        const varState = this.analyzer.lookupVariableState(name);
        const isStringType = varState?.isStringType ?? false;

        // Check if chain ends with .length on non-string type
        if (!isStringType) {
          const lastOp = ops[ops.length - 1].getText();
          if (lastOp === ".length") {
            const firstOpText = ops[0].getText();
            // Only skip if:
            // 1. Direct .length access on non-string variable (ops = [".length"])
            // 2. Array element .length access (ops = ["[...]", ".length"])
            // Do NOT skip for struct member access (ops = [".field", ".length"])
            // because the field might be a string type that needs init check
            if (ops.length === 1 || firstOpText.startsWith("[")) {
              // .length on non-string base or array element - compile-time, skip
              return;
            }
            // Fall through for struct member access - the member might be a string
          }
        }

        // If the first postfixOp is a member access (has '.'), check the field
        if (opText.startsWith(".")) {
          // Extract field name (remove the leading '.')
          const fieldName = opText.slice(1);
          // Check field-level initialization instead of whole variable
          this.analyzer.checkRead(name, line, column, fieldName);
          return;
        }
      }

      this.analyzer.checkRead(name, line, column);
    }
  };

  override enterMemberAccess = (ctx: Parser.MemberAccessContext): void => {
    // Skip if we're in a write context
    if (this.analyzer.isInWriteContext()) {
      return;
    }

    // Skip if we're in function call arguments
    if (this.inFunctionCallArgs > 0) {
      return;
    }

    const identifiers = ctx.IDENTIFIER();
    if (identifiers.length >= 2) {
      const varName = identifiers[0].getText();
      const fieldName = identifiers[1].getText();
      const { line, column } = ParserUtils.getPosition(ctx);

      // Check if the specific field is initialized
      this.analyzer.checkRead(varName, line, column, fieldName);
    }
  };

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
    const bound = parseInt(match[1], 10);
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

  /** Known struct types and their fields */
  private structFields: Map<string, Set<string>> = new Map();

  /** Track if we're processing a write target (left side of assignment) */
  private inWriteContext: boolean = false;

  /**
   * Register external struct fields from C/C++ headers
   * This allows the analyzer to recognize types defined in headers
   *
   * @param externalFields Map of struct name -> Set of field names
   */
  public registerExternalStructFields(
    externalFields: Map<string, Set<string>>,
  ): void {
    for (const [structName, fields] of externalFields) {
      this.structFields.set(structName, fields);
    }
  }

  /**
   * Analyze a parsed program for initialization errors
   * @param tree The parsed program AST
   * @returns Array of initialization errors
   */
  public analyze(tree: Parser.ProgramContext): IInitializationError[] {
    this.errors = [];
    this.scopeStack = new ScopeStack();
    // Don't clear structFields - external fields may have been registered

    // First pass: collect struct definitions
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
      // Global variable declarations
      const varDecl = decl.variableDeclaration();
      if (varDecl) {
        const name = varDecl.IDENTIFIER().getText();
        const { line, column } = ParserUtils.getPosition(varDecl);

        // Get type for struct tracking
        const typeCtx = varDecl.type();
        let typeName: string | null = null;
        if (typeCtx.userType()) {
          typeName = typeCtx.userType()!.IDENTIFIER().getText();
        }

        // Globals are always initialized (zero-init or explicit)
        this.declareVariable(name, line, column, true, typeName);
      }

      // Scope member variables (ADR-016: renamed from namespace)
      const scopeDecl = decl.scopeDeclaration();
      if (scopeDecl) {
        const scopeName = scopeDecl.IDENTIFIER().getText();
        for (const member of scopeDecl.scopeMember()) {
          const memberVar = member.variableDeclaration();
          if (memberVar) {
            const varName = memberVar.IDENTIFIER().getText();
            const fullName = `${scopeName}_${varName}`; // Mangled name
            const { line, column } = ParserUtils.getPosition(memberVar);

            const typeCtx = memberVar.type();
            let typeName: string | null = null;
            if (typeCtx.userType()) {
              typeName = typeCtx.userType()!.IDENTIFIER().getText();
            }

            // Also register with raw name for scope resolution
            this.declareVariable(varName, line, column, true, typeName);
            this.declareVariable(fullName, line, column, true, typeName);
          }
        }
      }
    }
  }

  /**
   * Collect struct definitions to know their fields
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

        this.structFields.set(structName, fields);
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

    const isStruct = typeName !== null && this.structFields.has(typeName);
    const fields = isStruct
      ? this.structFields.get(typeName)!
      : new Set<string>();

    const state: IVariableState = {
      declaration: { name, line, column },
      initialized: hasInitializer,
      typeName,
      isStruct,
      isStringType,
      // If initialized with full struct initializer, all fields are initialized
      initializedFields: hasInitializer ? new Set(fields) : new Set(),
    };

    this.scopeStack.declare(name, state);
  }

  /**
   * Record that a variable (or field) has been assigned
   */
  public recordAssignment(name: string, field?: string): void {
    const structFields = this.structFields;

    this.scopeStack.update(name, (state) => {
      if (field) {
        // Field assignment
        state.initializedFields.add(field);
        // Check if all fields are now initialized
        if (state.isStruct && state.typeName) {
          const allFields = structFields.get(state.typeName);
          if (allFields) {
            const allInitialized = [...allFields].every((f) =>
              state.initializedFields.has(f),
            );
            if (allInitialized) {
              state.initialized = true;
            }
          }
        }
      } else {
        // Whole variable assignment
        state.initialized = true;
        // Mark all fields as initialized too
        if (state.isStruct && state.typeName) {
          const fields = structFields.get(state.typeName);
          if (fields) {
            state.initializedFields = new Set(fields);
          }
        }
      }
      return state;
    });
  }

  /**
   * Check if a variable (or field) is used before initialization
   */
  public checkRead(
    name: string,
    line: number,
    column: number,
    field?: string,
  ): void {
    const state = this.scopeStack.lookup(name);

    if (!state) {
      // Variable not found in any scope - this would be a different error
      // (undefined variable), not an initialization error
      return;
    }

    if (field) {
      // Reading a specific field/property
      if (state.isStruct && state.typeName) {
        // Struct type: check if this is a real field
        const structFields = this.structFields.get(state.typeName);
        if (structFields && structFields.has(field)) {
          // This is a real struct field - check initialization
          if (!state.initializedFields.has(field)) {
            this.addError(
              `${name}.${field}`,
              line,
              column,
              state.declaration,
              false, // Definitely uninitialized
            );
          }
        }
        // else: field doesn't exist in struct, could be a type property like .length
        // Skip check - let code generator handle unknown field errors
      } else if (state.isStringType) {
        // String type: .length, .capacity, and .size are runtime properties that require initialization
        if (
          (field === "length" || field === "capacity" || field === "size") &&
          !state.initialized
        ) {
          this.addError(
            name,
            line,
            column,
            state.declaration,
            false, // Definitely uninitialized
          );
        }
      }
      // Other types (primitives): .field access is a type property (like .length for bit width)
      // which is always available at compile time, no init check needed
    } else if (!state.initialized) {
      // Reading the whole variable
      this.addError(
        name,
        line,
        column,
        state.declaration,
        false, // Definitely uninitialized
      );
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

    const isStruct = typeName !== null && this.structFields.has(typeName);
    const fields = isStruct
      ? this.structFields.get(typeName)!
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
