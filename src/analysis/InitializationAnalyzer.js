"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitializationAnalyzer = void 0;
const antlr4ng_1 = require("antlr4ng");
const CNextListener_1 = require("../parser/grammar/CNextListener");
/**
 * Listener that walks the parse tree and tracks initialization
 */
class InitializationListener extends CNextListener_1.CNextListener {
  analyzer;
  /** Stack of saved states before each if statement */
  savedStates = [];
  /** Track when we're inside a function call's argument list */
  inFunctionCallArgs = 0;
  /** Track nesting depth inside functions/methods (0 = global level) */
  functionDepth = 0;
  constructor(analyzer) {
    super();
    this.analyzer = analyzer;
  }
  // ========================================================================
  // Scope Entry/Exit
  // ========================================================================
  enterFunctionDeclaration = (ctx) => {
    this.functionDepth++;
    this.analyzer.enterScope();
    // Declare parameters as initialized
    const paramList = ctx.parameterList();
    if (paramList) {
      for (const param of paramList.parameter()) {
        const name = param.IDENTIFIER().getText();
        const line = param.start?.line ?? 0;
        const column = param.start?.column ?? 0;
        // Get type name for struct tracking
        const typeCtx = param.type();
        let typeName = null;
        if (typeCtx.userType()) {
          typeName = typeCtx.userType().IDENTIFIER().getText();
        }
        this.analyzer.declareParameter(name, line, column, typeName);
      }
    }
  };
  exitFunctionDeclaration = (_ctx) => {
    this.analyzer.exitScope();
    this.functionDepth--;
  };
  enterBlock = (_ctx) => {
    this.analyzer.enterScope();
  };
  exitBlock = (_ctx) => {
    this.analyzer.exitScope();
  };
  // ========================================================================
  // Variable Declarations
  // ========================================================================
  enterVariableDeclaration = (ctx) => {
    // Skip global variables - they're already handled by createGlobalScope()
    if (this.functionDepth === 0) {
      return;
    }
    const name = ctx.IDENTIFIER().getText();
    const line = ctx.start?.line ?? 0;
    const column = ctx.start?.column ?? 0;
    const hasInitializer = ctx.expression() !== null;
    // Get type name for struct tracking
    const typeCtx = ctx.type();
    let typeName = null;
    if (typeCtx.userType()) {
      typeName = typeCtx.userType().IDENTIFIER().getText();
    }
    this.analyzer.declareVariable(name, line, column, hasInitializer, typeName);
  };
  // ========================================================================
  // Assignments
  // ========================================================================
  enterAssignmentStatement = (ctx) => {
    const targetCtx = ctx.assignmentTarget();
    // Simple variable assignment: x <- value
    if (
      targetCtx.IDENTIFIER() &&
      !targetCtx.memberAccess() &&
      !targetCtx.arrayAccess()
    ) {
      const name = targetCtx.IDENTIFIER().getText();
      this.analyzer.recordAssignment(name);
    }
    // Member access: p.x <- value (only first-level field)
    if (targetCtx.memberAccess()) {
      const memberCtx = targetCtx.memberAccess();
      const identifiers = memberCtx.IDENTIFIER();
      if (identifiers.length >= 2) {
        const varName = identifiers[0].getText();
        const fieldName = identifiers[1].getText();
        this.analyzer.recordAssignment(varName, fieldName);
      }
    }
    // Array access: arr[i] <- value
    if (targetCtx.arrayAccess()) {
      const arrayName = targetCtx.arrayAccess().IDENTIFIER().getText();
      // Array element assignment initializes that element, but for simplicity
      // we'll consider the array as a whole. More granular tracking would be complex.
      this.analyzer.recordAssignment(arrayName);
    }
  };
  // ========================================================================
  // Function Call Arguments (ADR-006: pass-by-reference may initialize)
  // ========================================================================
  enterArgumentList = (_ctx) => {
    // When inside function call arguments, variables passed may be output params
    // We don't error on uninitialized reads, and we mark them as initialized after
    this.inFunctionCallArgs++;
  };
  exitArgumentList = (ctx) => {
    this.inFunctionCallArgs--;
    // Mark any simple identifiers passed as arguments as initialized
    // (they might be output parameters that the function writes to)
    for (const expr of ctx.expression()) {
      // Walk down to find simple identifiers
      this.markArgumentsAsInitialized(expr);
    }
  };
  /**
   * Recursively find and mark simple identifier arguments as initialized
   */
  markArgumentsAsInitialized(expr) {
    // Navigate through expression layers to find primary expression
    const ternary = expr.ternaryExpression();
    if (!ternary) return;
    const orExprs = ternary.orExpression();
    if (orExprs.length === 0) return;
    const or = orExprs[0];
    if (!or) return;
    const and = or.andExpression(0);
    if (!and) return;
    const eq = and.equalityExpression(0);
    if (!eq) return;
    const rel = eq.relationalExpression(0);
    if (!rel) return;
    const bor = rel.bitwiseOrExpression(0);
    if (!bor) return;
    const bxor = bor.bitwiseXorExpression(0);
    if (!bxor) return;
    const band = bxor.bitwiseAndExpression(0);
    if (!band) return;
    const shift = band.shiftExpression(0);
    if (!shift) return;
    const add = shift.additiveExpression(0);
    if (!add) return;
    const mult = add.multiplicativeExpression(0);
    if (!mult) return;
    const unary = mult.unaryExpression(0);
    if (!unary) return;
    const postfix = unary.postfixExpression();
    if (!postfix) return;
    const primary = postfix.primaryExpression();
    if (!primary) return;
    // Found primary expression - check if it's a simple identifier
    if (primary.IDENTIFIER()) {
      const name = primary.IDENTIFIER().getText();
      this.analyzer.recordAssignment(name);
    }
  }
  // ========================================================================
  // Variable Reads (in expressions)
  // ========================================================================
  enterPrimaryExpression = (ctx) => {
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
      const name = ctx.IDENTIFIER().getText();
      const line = ctx.start?.line ?? 0;
      const column = ctx.start?.column ?? 0;
      this.analyzer.checkRead(name, line, column);
    }
  };
  enterMemberAccess = (ctx) => {
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
      const line = ctx.start?.line ?? 0;
      const column = ctx.start?.column ?? 0;
      // Check if the specific field is initialized
      this.analyzer.checkRead(varName, line, column, fieldName);
    }
  };
  // ========================================================================
  // Control Flow: If Statements
  // ========================================================================
  enterIfStatement = (_ctx) => {
    // Save current state before entering if
    const stateBefore = this.analyzer.cloneScopeState();
    this.savedStates.push(stateBefore);
  };
  exitIfStatement = (ctx) => {
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
  enterWhileStatement = (_ctx) => {
    // Save state before loop - we'll restore after because loop might not run
    this.savedStates.push(this.analyzer.cloneScopeState());
  };
  exitWhileStatement = (_ctx) => {
    // Loops are conservative: we assume they might not run at all
    // So we restore state to before the loop
    const stateBeforeLoop = this.savedStates.pop();
    if (stateBeforeLoop) {
      this.analyzer.restoreFromState(stateBeforeLoop);
    }
  };
  enterForStatement = (_ctx) => {
    // Save state before loop
    this.savedStates.push(this.analyzer.cloneScopeState());
  };
  exitForStatement = (_ctx) => {
    // Same as while - conservative approach
    const stateBeforeLoop = this.savedStates.pop();
    if (stateBeforeLoop) {
      this.analyzer.restoreFromState(stateBeforeLoop);
    }
  };
}
/**
 * Analyzes C-Next AST for use-before-initialization errors
 */
class InitializationAnalyzer {
  errors = [];
  currentScope = null;
  /** Known struct types and their fields */
  structFields = new Map();
  /** Track if we're processing a write target (left side of assignment) */
  inWriteContext = false;
  /**
   * Analyze a parsed program for initialization errors
   * @param tree The parsed program AST
   * @returns Array of initialization errors
   */
  analyze(tree) {
    this.errors = [];
    this.currentScope = null;
    this.structFields.clear();
    // First pass: collect struct definitions
    this.collectStructDefinitions(tree);
    // Create global scope with all global/namespace variable declarations
    this.createGlobalScope(tree);
    // Second pass: analyze initialization
    const listener = new InitializationListener(this);
    antlr4ng_1.ParseTreeWalker.DEFAULT.walk(listener, tree);
    return this.errors;
  }
  /**
   * Create the global scope with all top-level variable declarations
   * Global variables are considered "initialized" (zero-init by ADR-015)
   */
  createGlobalScope(tree) {
    this.enterScope(); // Create global scope
    for (const decl of tree.declaration()) {
      // Global variable declarations
      const varDecl = decl.variableDeclaration();
      if (varDecl) {
        const name = varDecl.IDENTIFIER().getText();
        const line = varDecl.start?.line ?? 0;
        const column = varDecl.start?.column ?? 0;
        // Get type for struct tracking
        const typeCtx = varDecl.type();
        let typeName = null;
        if (typeCtx.userType()) {
          typeName = typeCtx.userType().IDENTIFIER().getText();
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
            const line = memberVar.start?.line ?? 0;
            const column = memberVar.start?.column ?? 0;
            const typeCtx = memberVar.type();
            let typeName = null;
            if (typeCtx.userType()) {
              typeName = typeCtx.userType().IDENTIFIER().getText();
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
  collectStructDefinitions(tree) {
    for (const decl of tree.declaration()) {
      const structDecl = decl.structDeclaration();
      if (structDecl) {
        const structName = structDecl.IDENTIFIER().getText();
        const fields = new Set();
        for (const member of structDecl.structMember()) {
          const fieldName = member.IDENTIFIER().getText();
          fields.add(fieldName);
        }
        this.structFields.set(structName, fields);
      }
    }
  }
  // ========================================================================
  // Scope Management
  // ========================================================================
  /**
   * Enter a new scope (function, block, etc.)
   */
  enterScope() {
    const newScope = {
      variables: new Map(),
      parent: this.currentScope,
    };
    this.currentScope = newScope;
  }
  /**
   * Exit the current scope
   */
  exitScope() {
    if (this.currentScope) {
      this.currentScope = this.currentScope.parent;
    }
  }
  // ========================================================================
  // Variable Tracking
  // ========================================================================
  /**
   * Declare a variable (may or may not be initialized)
   */
  declareVariable(name, line, column, hasInitializer, typeName) {
    if (!this.currentScope) {
      // Global scope - create implicit scope
      this.enterScope();
    }
    const isStruct = typeName !== null && this.structFields.has(typeName);
    const fields = isStruct ? this.structFields.get(typeName) : new Set();
    const state = {
      declaration: { name, line, column },
      initialized: hasInitializer,
      typeName,
      isStruct,
      // If initialized with full struct initializer, all fields are initialized
      initializedFields: hasInitializer ? new Set(fields) : new Set(),
    };
    this.currentScope.variables.set(name, state);
  }
  /**
   * Record that a variable (or field) has been assigned
   */
  recordAssignment(name, field) {
    const state = this.lookupVariable(name);
    if (state) {
      if (field) {
        // Field assignment
        state.initializedFields.add(field);
        // Check if all fields are now initialized
        if (state.isStruct && state.typeName) {
          const allFields = this.structFields.get(state.typeName);
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
          const fields = this.structFields.get(state.typeName);
          if (fields) {
            state.initializedFields = new Set(fields);
          }
        }
      }
    }
  }
  /**
   * Check if a variable (or field) is used before initialization
   */
  checkRead(name, line, column, field) {
    const state = this.lookupVariable(name);
    if (!state) {
      // Variable not found in any scope - this would be a different error
      // (undefined variable), not an initialization error
      return;
    }
    if (field) {
      // Reading a specific field
      if (!state.initializedFields.has(field)) {
        this.addError(
          `${name}.${field}`,
          line,
          column,
          state.declaration,
          false,
        );
      }
    } else if (!state.initialized) {
      // Reading the whole variable
      this.addError(name, line, column, state.declaration, false);
    }
  }
  /**
   * Look up a variable in the current scope chain
   */
  lookupVariable(name) {
    let scope = this.currentScope;
    while (scope) {
      if (scope.variables.has(name)) {
        return scope.variables.get(name);
      }
      scope = scope.parent;
    }
    return null;
  }
  // ========================================================================
  // Control Flow
  // ========================================================================
  /**
   * Clone the current scope state for branch analysis
   */
  cloneScopeState() {
    const clone = new Map();
    let scope = this.currentScope;
    while (scope) {
      for (const [name, state] of scope.variables) {
        if (!clone.has(name)) {
          clone.set(name, {
            ...state,
            initializedFields: new Set(state.initializedFields),
          });
        }
      }
      scope = scope.parent;
    }
    return clone;
  }
  /**
   * Restore initialization state from a saved snapshot
   * Used for control flow analysis to "undo" branch changes
   */
  restoreFromState(savedState) {
    for (const [name, savedVarState] of savedState) {
      const currentVar = this.lookupVariable(name);
      if (currentVar) {
        // Restore the initialization state from the saved snapshot
        currentVar.initialized = savedVarState.initialized;
        currentVar.initializedFields = new Set(savedVarState.initializedFields);
      }
    }
  }
  // ========================================================================
  // Error Reporting
  // ========================================================================
  addError(variable, line, column, declaration, mayBeUninitialized) {
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
  setWriteContext(inWrite) {
    this.inWriteContext = inWrite;
  }
  isInWriteContext() {
    return this.inWriteContext;
  }
  // ========================================================================
  // Function Parameters
  // ========================================================================
  /**
   * Declare function parameters (always initialized by caller)
   */
  declareParameter(name, line, column, typeName) {
    if (!this.currentScope) {
      this.enterScope();
    }
    const isStruct = typeName !== null && this.structFields.has(typeName);
    const fields = isStruct ? this.structFields.get(typeName) : new Set();
    const state = {
      declaration: { name, line, column },
      initialized: true, // Parameters are always initialized by caller
      typeName,
      isStruct,
      initializedFields: new Set(fields), // All fields initialized
    };
    this.currentScope.variables.set(name, state);
  }
}
exports.InitializationAnalyzer = InitializationAnalyzer;
exports.default = InitializationAnalyzer;
