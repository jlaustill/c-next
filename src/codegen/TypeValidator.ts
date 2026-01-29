/**
 * TypeValidator - Handles compile-time validation of types, assignments, and control flow
 * Extracted from CodeGenerator for better separation of concerns
 * Issue #63: Validation logic separated for independent testing
 */
import { dirname, resolve, join } from "node:path";
import * as Parser from "../antlr_parser/grammar/CNextParser";
import ISymbolInfo from "./generators/ISymbolInfo";
import SymbolTable from "../symbol_resolution/SymbolTable";
import TTypeInfo from "./types/TTypeInfo";
import TParameterInfo from "./types/TParameterInfo";
import ICallbackTypeInfo from "./types/ICallbackTypeInfo";
import ITypeValidatorDeps from "./types/ITypeValidatorDeps";
import TypeResolver from "./TypeResolver";

/**
 * ADR-010: Implementation file extensions that should NOT be #included
 */
const IMPLEMENTATION_EXTENSIONS = [".c", ".cpp", ".cc", ".cxx", ".c++"];

/**
 * TypeValidator class - validates types, assignments, and control flow at compile time
 */
class TypeValidator {
  private symbols: ISymbolInfo | null;
  private symbolTable: SymbolTable | null;
  private typeRegistry: Map<string, TTypeInfo>;
  private typeResolver: TypeResolver;
  private callbackTypes: Map<string, ICallbackTypeInfo>;
  private knownFunctions: Set<string>;
  private knownGlobals: Set<string>;
  private getCurrentScopeFn: () => string | null;
  private getScopeMembersFn: () => Map<string, Set<string>>;
  private getCurrentParametersFn: () => Map<string, TParameterInfo>;
  private getLocalVariablesFn: () => Set<string>;
  private resolveIdentifierFn: (name: string) => string;
  private getExpressionTypeFn: (ctx: unknown) => string | null;

  constructor(deps: ITypeValidatorDeps) {
    this.symbols = deps.symbols;
    this.symbolTable = deps.symbolTable;
    this.typeRegistry = deps.typeRegistry;
    this.typeResolver = deps.typeResolver;
    this.callbackTypes = deps.callbackTypes;
    this.knownFunctions = deps.knownFunctions;
    this.knownGlobals = deps.knownGlobals;
    this.getCurrentScopeFn = deps.getCurrentScope;
    this.getScopeMembersFn = deps.getScopeMembers;
    this.getCurrentParametersFn = deps.getCurrentParameters;
    this.getLocalVariablesFn = deps.getLocalVariables;
    this.resolveIdentifierFn = deps.resolveIdentifier;
    this.getExpressionTypeFn = deps.getExpressionType;
  }

  // ========================================================================
  // Include Validation (ADR-010)
  // ========================================================================

  /**
   * ADR-010: Validate that #include doesn't include implementation files
   */
  validateIncludeNotImplementationFile(
    includeText: string,
    lineNumber: number,
  ): void {
    // Extract the file path from #include directive
    // Match both <file> and "file" forms
    const angleMatch = /#\s*include\s*<([^>]+)>/.exec(includeText);
    const quoteMatch = /#\s*include\s*"([^"]+)"/.exec(includeText);

    const includePath = angleMatch?.[1] || quoteMatch?.[1];
    if (!includePath) {
      return; // Malformed include, let other validation handle it
    }

    // Get the file extension (lowercase for case-insensitive comparison)
    const ext = includePath
      .substring(includePath.lastIndexOf("."))
      .toLowerCase();

    if (IMPLEMENTATION_EXTENSIONS.includes(ext)) {
      throw new Error(
        `E0503: Cannot #include implementation file '${includePath}'. ` +
          `Only header files (.h, .hpp) are allowed. Line ${lineNumber}`,
      );
    }
  }

  /**
   * E0504: Validate that a .cnx alternative doesn't exist for a .h/.hpp include
   * This helps during codebase migration by alerting developers when they should
   * be using the C-Next version of a file instead of the C header.
   *
   * @param includeText - The full #include directive text
   * @param lineNumber - Line number for error reporting
   * @param sourcePath - Path to the source file (for resolving relative includes)
   * @param includePaths - Array of directories to search for includes
   * @param fileExists - Function to check if a file exists (injectable for testing)
   */
  validateIncludeNoCnxAlternative(
    includeText: string,
    lineNumber: number,
    sourcePath: string | null,
    includePaths: string[],
    fileExists: (path: string) => boolean = (p) => require("fs").existsSync(p),
  ): void {
    // Extract the file path from #include directive
    const angleMatch = /#\s*include\s*<([^>]+)>/.exec(includeText);
    const quoteMatch = /#\s*include\s*"([^"]+)"/.exec(includeText);

    const includePath = angleMatch?.[1] || quoteMatch?.[1];
    if (!includePath) {
      return; // Malformed include, let other validation handle it
    }

    // Skip if already a .cnx include
    if (includePath.endsWith(".cnx")) {
      return;
    }

    // Only check .h and .hpp files
    const ext = includePath
      .substring(includePath.lastIndexOf("."))
      .toLowerCase();
    if (ext !== ".h" && ext !== ".hpp") {
      return;
    }

    // Build the .cnx alternative path
    const cnxPath = includePath.replace(/\.(h|hpp)$/i, ".cnx");

    if (quoteMatch) {
      // Quoted include: resolve relative to source file's directory
      if (sourcePath) {
        const sourceDir = dirname(sourcePath);
        const fullCnxPath = resolve(sourceDir, cnxPath);
        if (fileExists(fullCnxPath)) {
          throw new Error(
            `E0504: Found #include "${includePath}" but '${cnxPath}' exists at the same location.\n` +
              `       Use #include "${cnxPath}" instead to use the C-Next version. Line ${lineNumber}`,
          );
        }
      }
    } else if (angleMatch) {
      // Angle bracket include: search through include paths
      for (const searchDir of includePaths) {
        const fullCnxPath = join(searchDir, cnxPath);
        if (fileExists(fullCnxPath)) {
          throw new Error(
            `E0504: Found #include <${includePath}> but '${cnxPath}' exists at the same location.\n` +
              `       Use #include <${cnxPath}> instead to use the C-Next version. Line ${lineNumber}`,
          );
        }
      }
    }
  }

  // ========================================================================
  // Bitmap Field Validation (ADR-034)
  // ========================================================================

  /**
   * ADR-034: Validate that a literal value fits in a bitmap field
   */
  validateBitmapFieldLiteral(
    expr: Parser.ExpressionContext,
    width: number,
    fieldName: string,
  ): void {
    const text = expr.getText().trim();
    const maxValue = (1 << width) - 1;

    // Check for integer literals
    let value: number | null = null;

    if (/^\d+$/.exec(text)) {
      value = Number.parseInt(text, 10);
    } else if (/^0[xX][0-9a-fA-F]+$/.exec(text)) {
      value = Number.parseInt(text, 16);
    } else if (/^0[bB][01]+$/.exec(text)) {
      value = Number.parseInt(text.substring(2), 2);
    }

    if (value !== null && value > maxValue) {
      throw new Error(
        `Error: Value ${value} exceeds ${width}-bit field '${fieldName}' maximum of ${maxValue}`,
      );
    }
  }

  // ========================================================================
  // Array Bounds Validation (ADR-036)
  // ========================================================================

  /**
   * ADR-036: Check array bounds at compile time for constant indices.
   * Throws an error if the constant index is out of bounds.
   */
  checkArrayBounds(
    arrayName: string,
    dimensions: number[],
    indexExprs: Parser.ExpressionContext[],
    line: number,
    tryEvaluateConstant: (ctx: Parser.ExpressionContext) => number | undefined,
  ): void {
    for (let i = 0; i < indexExprs.length && i < dimensions.length; i++) {
      const constValue = tryEvaluateConstant(indexExprs[i]);
      if (constValue !== undefined) {
        if (constValue < 0) {
          throw new Error(
            `Array index out of bounds: ${constValue} is negative for '${arrayName}' dimension ${i + 1} (line ${line})`,
          );
        } else if (constValue >= dimensions[i]) {
          throw new Error(
            `Array index out of bounds: ${constValue} >= ${dimensions[i]} for '${arrayName}' dimension ${i + 1} (line ${line})`,
          );
        }
      }
    }
  }

  // ========================================================================
  // Callback Assignment Validation (ADR-029)
  // ========================================================================

  /**
   * ADR-029: Validate callback assignment with nominal typing
   * - If value IS a callback type used as a field type: must match exactly (nominal typing)
   * - If value is just a function (not used as a type): signature must match
   */
  validateCallbackAssignment(
    expectedType: string,
    valueExpr: Parser.ExpressionContext,
    fieldName: string,
    isCallbackTypeUsedAsFieldType: (funcName: string) => boolean,
  ): void {
    const valueText = valueExpr.getText();

    // Check if the value is a known function
    if (!this.knownFunctions.has(valueText)) {
      // Not a function name - could be a variable holding a callback
      // Skip validation for now (C compiler will catch type mismatches)
      return;
    }

    const expectedInfo = this.callbackTypes.get(expectedType);
    const valueInfo = this.callbackTypes.get(valueText);

    if (!expectedInfo || !valueInfo) {
      // Shouldn't happen, but guard against it
      return;
    }

    // First check if signatures match
    if (!this.callbackSignaturesMatch(expectedInfo, valueInfo)) {
      throw new Error(
        `Error: Function '${valueText}' signature does not match callback type '${expectedType}'`,
      );
    }

    // Nominal typing: if the value function is used as a field type somewhere,
    // it can only be assigned to fields of that same type
    if (
      isCallbackTypeUsedAsFieldType(valueText) &&
      valueText !== expectedType
    ) {
      throw new Error(
        `Error: Cannot assign '${valueText}' to callback field '${fieldName}' ` +
          `(expected ${expectedType} type, got ${valueText} type - nominal typing)`,
      );
    }
  }

  /**
   * ADR-029: Check if two callback signatures match
   */
  callbackSignaturesMatch(a: ICallbackTypeInfo, b: ICallbackTypeInfo): boolean {
    if (a.returnType !== b.returnType) return false;
    if (a.parameters.length !== b.parameters.length) return false;

    for (let i = 0; i < a.parameters.length; i++) {
      const pa = a.parameters[i];
      const pb = b.parameters[i];
      if (pa.type !== pb.type) return false;
      if (pa.isConst !== pb.isConst) return false;
      if (pa.isPointer !== pb.isPointer) return false;
      if (pa.isArray !== pb.isArray) return false;
    }

    return true;
  }

  // ========================================================================
  // Const Assignment Validation (ADR-013)
  // ========================================================================

  /**
   * ADR-013: Check if assigning to an identifier would violate const rules.
   * Returns error message if const, null if mutable.
   */
  checkConstAssignment(identifier: string): string | null {
    // Check if it's a const parameter
    const paramInfo = this.getCurrentParametersFn().get(identifier);
    if (paramInfo?.isConst) {
      return `cannot assign to const parameter '${identifier}'`;
    }

    // Resolve identifier to scoped name for proper lookup
    const scopedName = this.resolveIdentifierFn(identifier);

    // Check if it's a const variable
    const typeInfo = this.typeRegistry.get(scopedName);
    if (typeInfo?.isConst) {
      return `cannot assign to const variable '${identifier}'`;
    }

    return null; // Mutable, assignment OK
  }

  /**
   * ADR-013: Check if an argument is const (variable or parameter)
   */
  isConstValue(identifier: string): boolean {
    // Check if it's a const parameter
    const paramInfo = this.getCurrentParametersFn().get(identifier);
    if (paramInfo?.isConst) {
      return true;
    }

    // Check if it's a const variable
    const typeInfo = this.typeRegistry.get(identifier);
    if (typeInfo?.isConst) {
      return true;
    }

    return false;
  }

  // ========================================================================
  // Scope Identifier Validation (ADR-016)
  // ========================================================================

  /**
   * ADR-016: Validate that bare identifiers inside scopes are only used for local variables.
   * Throws an error if a bare identifier references a scope member or global.
   */
  validateBareIdentifierInScope(
    identifier: string,
    isLocalVariable: boolean,
    isKnownStruct: (name: string) => boolean,
  ): void {
    const currentScope = this.getCurrentScopeFn();

    // Only enforce inside scopes
    if (!currentScope) {
      return;
    }

    // Local variables and parameters are allowed as bare identifiers
    if (isLocalVariable) {
      return;
    }

    // Check if this identifier is a scope member
    const scopeMembers = this.getScopeMembersFn().get(currentScope);
    if (scopeMembers?.has(identifier)) {
      throw new Error(
        `Error: Use 'this.${identifier}' to access scope member '${identifier}' inside scope '${currentScope}'`,
      );
    }

    // Check if this is a known global (register, function, enum, struct)
    if (this.symbols!.knownRegisters.has(identifier)) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access register '${identifier}' inside scope '${currentScope}'`,
      );
    }

    if (
      this.knownFunctions.has(identifier) &&
      !identifier.startsWith(currentScope + "_")
    ) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access global function '${identifier}' inside scope '${currentScope}'`,
      );
    }

    if (this.symbols!.knownEnums.has(identifier)) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access global enum '${identifier}' inside scope '${currentScope}'`,
      );
    }

    if (isKnownStruct(identifier)) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access global struct '${identifier}' inside scope '${currentScope}'`,
      );
    }

    // Check if this identifier exists as a global variable in the type registry
    // (but not a scoped variable - those would have Scope_ prefix)
    const typeInfo = this.typeRegistry.get(identifier);
    if (typeInfo && !identifier.includes("_")) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access global variable '${identifier}' inside scope '${currentScope}'`,
      );
    }
  }

  /**
   * Resolve a bare identifier to its qualified name using priority:
   * 1. Local variables/parameters (return null - no transformation needed)
   * 2. Scope members (return Scope_identifier)
   * 3. Global variables/functions (return identifier)
   *
   * Returns null if no transformation needed, the resolved name otherwise.
   * Used by implicit scope resolution feature.
   */
  resolveBareIdentifier(
    identifier: string,
    isLocalVariable: boolean,
    isKnownStruct: (name: string) => boolean,
  ): string | null {
    // Priority 1: Local variables and parameters - no transformation
    if (isLocalVariable) {
      return null;
    }

    const currentScope = this.getCurrentScopeFn();

    // Priority 2: If inside a scope, check scope members
    if (currentScope) {
      const scopeMembers = this.getScopeMembersFn().get(currentScope);
      if (scopeMembers?.has(identifier)) {
        return `${currentScope}_${identifier}`;
      }

      // Check if it's a scope function (exists as Scope_identifier in knownFunctions)
      const scopedFuncName = `${currentScope}_${identifier}`;
      if (this.knownFunctions.has(scopedFuncName)) {
        return scopedFuncName;
      }
    }

    // Priority 3: Global resolution
    // Check global variables in type registry (no underscore = global)
    const typeInfo = this.typeRegistry.get(identifier);
    if (typeInfo && !identifier.includes("_")) {
      return currentScope ? identifier : null; // Only transform if inside scope
    }

    // Check global functions (but not ones already prefixed with current scope)
    if (
      this.knownFunctions.has(identifier) &&
      !identifier.startsWith(currentScope + "_")
    ) {
      return currentScope ? identifier : null;
    }

    // Check known types (enums, structs, registers) - these are valid as identifiers
    if (this.symbols!.knownEnums.has(identifier)) {
      return currentScope ? identifier : null;
    }

    if (isKnownStruct(identifier)) {
      return currentScope ? identifier : null;
    }

    if (this.symbols!.knownRegisters.has(identifier)) {
      return currentScope ? identifier : null;
    }

    // Not found anywhere - let it pass through (may be enum member or error later)
    return null;
  }

  /**
   * Resolve an identifier that appears before a '.' (member access).
   * Prioritizes scope names for Scope.member() calls.
   *
   * Returns the resolved name or null if not a scope.
   */
  resolveForMemberAccess(identifier: string): string | null {
    // For member access, check if it's a scope name first
    if (this.symbols!.knownScopes.has(identifier)) {
      return identifier;
    }
    return null;
  }

  // ========================================================================
  // Critical Section Validation (ADR-050)
  // ========================================================================

  /**
   * ADR-050: Validate no early exits inside critical block
   * return, break, continue would leave interrupts disabled
   */
  validateNoEarlyExits(ctx: Parser.BlockContext): void {
    for (const stmt of ctx.statement()) {
      if (stmt.returnStatement()) {
        throw new Error(
          `E0853: Cannot use 'return' inside critical section - would leave interrupts disabled`,
        );
      }
      // Recursively check nested blocks
      if (stmt.block()) {
        this.validateNoEarlyExits(stmt.block()!);
      }
      // Check inside if statements
      if (stmt.ifStatement()) {
        for (const innerStmt of stmt.ifStatement()!.statement()) {
          if (innerStmt.returnStatement()) {
            throw new Error(
              `E0853: Cannot use 'return' inside critical section - would leave interrupts disabled`,
            );
          }
          if (innerStmt.block()) {
            this.validateNoEarlyExits(innerStmt.block()!);
          }
        }
      }
      // Check inside while/for/do-while loops for return
      if (stmt.whileStatement()) {
        const loopStmt = stmt.whileStatement()!.statement();
        if (loopStmt.returnStatement()) {
          throw new Error(
            `E0853: Cannot use 'return' inside critical section - would leave interrupts disabled`,
          );
        }
        if (loopStmt.block()) {
          this.validateNoEarlyExits(loopStmt.block()!);
        }
      }
      if (stmt.forStatement()) {
        const loopStmt = stmt.forStatement()!.statement();
        if (loopStmt.returnStatement()) {
          throw new Error(
            `E0853: Cannot use 'return' inside critical section - would leave interrupts disabled`,
          );
        }
        if (loopStmt.block()) {
          this.validateNoEarlyExits(loopStmt.block()!);
        }
      }
      if (stmt.doWhileStatement()) {
        // do-while uses block directly, not statement
        const loopBlock = stmt.doWhileStatement()!.block();
        this.validateNoEarlyExits(loopBlock);
      }
    }
  }

  // ========================================================================
  // Switch Statement Validation (ADR-025)
  // ========================================================================

  /**
   * ADR-025: Validate switch statement for MISRA compliance
   */
  validateSwitchStatement(
    ctx: Parser.SwitchStatementContext,
    switchExpr: Parser.ExpressionContext,
  ): void {
    const cases = ctx.switchCase();
    const defaultCase = ctx.defaultCase();
    const totalClauses = cases.length + (defaultCase ? 1 : 0);

    // MISRA 16.7: No boolean switches (use if/else instead)
    const exprType = this.getExpressionTypeFn(switchExpr);
    if (exprType === "bool") {
      throw new Error(
        "Error: Cannot switch on boolean type (MISRA 16.7). Use if/else instead.",
      );
    }

    // MISRA 16.6: Minimum 2 clauses required
    if (totalClauses < 2) {
      throw new Error(
        "Error: Switch requires at least 2 clauses (MISRA 16.6). Use if statement for single case.",
      );
    }

    // Check for duplicate case values
    const seenValues = new Set<string>();
    for (const caseCtx of cases) {
      for (const labelCtx of caseCtx.caseLabel()) {
        const labelValue = this.getCaseLabelValue(labelCtx);
        if (seenValues.has(labelValue)) {
          throw new Error(
            `Error: Duplicate case value '${labelValue}' in switch statement.`,
          );
        }
        seenValues.add(labelValue);
      }
    }

    // ADR-025: Enum exhaustiveness checking
    if (exprType && this.symbols!.knownEnums.has(exprType)) {
      this.validateEnumExhaustiveness(ctx, exprType, cases, defaultCase);
    }
  }

  /**
   * ADR-025: Validate enum switch exhaustiveness with default(n) counting
   */
  validateEnumExhaustiveness(
    ctx: Parser.SwitchStatementContext,
    enumTypeName: string,
    cases: Parser.SwitchCaseContext[],
    defaultCase: Parser.DefaultCaseContext | null,
  ): void {
    const enumVariants = this.symbols!.enumMembers.get(enumTypeName);
    if (!enumVariants) return; // Shouldn't happen if knownEnums has it

    const totalVariants = enumVariants.size;

    // Count explicit cases (each || alternative counts as 1)
    let explicitCaseCount = 0;
    for (const caseCtx of cases) {
      explicitCaseCount += caseCtx.caseLabel().length;
    }

    if (defaultCase) {
      // Check for default(n) syntax
      const defaultCount = this.getDefaultCount(defaultCase);

      if (defaultCount !== null) {
        // default(n) mode: explicit + n must equal total variants
        const covered = explicitCaseCount + defaultCount;
        if (covered !== totalVariants) {
          throw new Error(
            `Error: switch covers ${covered} of ${totalVariants} ${enumTypeName} variants ` +
              `(${explicitCaseCount} explicit + default(${defaultCount})). ` +
              `Expected ${totalVariants}.`,
          );
        }
      }
      // Plain default: no exhaustiveness check needed
    } else if (explicitCaseCount !== totalVariants) {
      // No default: must cover all variants explicitly
      const missing = totalVariants - explicitCaseCount;
      throw new Error(
        `Error: Non-exhaustive switch on ${enumTypeName}: covers ${explicitCaseCount} of ${totalVariants} variants, missing ${missing}.`,
      );
    }
  }

  /**
   * Get the count from default(n) syntax, or null for plain default
   */
  getDefaultCount(ctx: Parser.DefaultCaseContext): number | null {
    const intLiteral = ctx.INTEGER_LITERAL();
    if (intLiteral) {
      return Number.parseInt(intLiteral.getText(), 10);
    }
    return null;
  }

  /**
   * Get the string representation of a case label for duplicate checking
   */
  getCaseLabelValue(ctx: Parser.CaseLabelContext): string {
    if (ctx.qualifiedType()) {
      const qt = ctx.qualifiedType()!;
      return qt
        .IDENTIFIER()
        .map((id) => id.getText())
        .join(".");
    }
    if (ctx.IDENTIFIER()) {
      return ctx.IDENTIFIER()!.getText();
    }
    if (ctx.INTEGER_LITERAL()) {
      const num = ctx.INTEGER_LITERAL()!.getText();
      // Check if minus token exists (first child would be '-')
      const hasNeg = ctx.children && ctx.children[0]?.getText() === "-";
      const value = BigInt(num);
      return String(hasNeg ? -value : value);
    }
    if (ctx.HEX_LITERAL()) {
      // Normalize hex to decimal for comparison
      const hex = ctx.HEX_LITERAL()!.getText();
      // Check if minus token exists (first child would be '-')
      const hasNeg = ctx.children && ctx.children[0]?.getText() === "-";
      const value = BigInt(hex); // BigInt handles 0x prefix natively
      return String(hasNeg ? -value : value);
    }
    if (ctx.BINARY_LITERAL()) {
      // Normalize binary to decimal for comparison
      const bin = ctx.BINARY_LITERAL()!.getText();
      return String(BigInt(bin)); // BigInt handles 0b prefix natively
    }
    if (ctx.CHAR_LITERAL()) {
      return ctx.CHAR_LITERAL()!.getText();
    }
    return "";
  }

  // ========================================================================
  // Ternary Validation (ADR-022)
  // ========================================================================

  /**
   * ADR-022: Validate that ternary condition is a boolean expression
   * Must be a comparison or logical operation, not just a value
   */
  validateTernaryCondition(ctx: Parser.OrExpressionContext): void {
    // Check if the condition contains a comparison or logical operator
    const text = ctx.getText();

    // If it has && or ||, it's a logical expression (valid)
    if (ctx.andExpression().length > 1) {
      return; // Has || operator - valid
    }

    const andExpr = ctx.andExpression(0);
    if (!andExpr) {
      throw new Error(
        `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`,
      );
    }

    if (andExpr.equalityExpression().length > 1) {
      return; // Has && operator - valid
    }

    const equalityExpr = andExpr.equalityExpression(0);
    if (!equalityExpr) {
      throw new Error(
        `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`,
      );
    }

    if (equalityExpr.relationalExpression().length > 1) {
      return; // Has = or != operator - valid
    }

    const relationalExpr = equalityExpr.relationalExpression(0);
    if (!relationalExpr) {
      throw new Error(
        `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`,
      );
    }

    if (relationalExpr.bitwiseOrExpression().length > 1) {
      return; // Has <, >, <=, >= operator - valid
    }

    // No comparison or logical operators found - just a value
    throw new Error(
      `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`,
    );
  }

  /**
   * ADR-022: Validate that expression does not contain a nested ternary
   */
  validateNoNestedTernary(
    ctx: Parser.OrExpressionContext,
    branchName: string,
  ): void {
    const text = ctx.getText();
    // Check for ternary pattern: something ? something : something
    if (text.includes("?") && text.includes(":")) {
      throw new Error(
        `Error: Nested ternary not allowed in ${branchName}. Use if/else instead.`,
      );
    }
  }

  // ========================================================================
  // Do-While Validation (ADR-027)
  // ========================================================================

  /**
   * ADR-027: Validate that do-while condition is a boolean expression (E0701)
   * Must be a comparison, logical operation, or boolean variable - not just a value.
   * This enforces MISRA C:2012 Rule 14.4.
   */
  validateDoWhileCondition(ctx: Parser.ExpressionContext): void {
    // Unwrap: ExpressionContext -> TernaryExpressionContext -> OrExpressionContext
    const ternaryExpr = ctx.ternaryExpression();
    const orExprs = ternaryExpr.orExpression();

    // For do-while, we expect a non-ternary expression (single orExpression)
    if (orExprs.length !== 1) {
      throw new Error(
        `Error E0701: do-while condition must be a boolean expression, not a ternary (MISRA C:2012 Rule 14.4)`,
      );
    }

    const orExpr = orExprs[0];
    const text = orExpr.getText();

    // If it has || operator, it's valid (logical expression)
    if (orExpr.andExpression().length > 1) {
      return;
    }

    const andExpr = orExpr.andExpression(0);
    if (!andExpr) {
      throw new Error(
        `Error E0701: do-while condition must be a boolean expression (comparison or logical operation), not '${text}' (MISRA C:2012 Rule 14.4)`,
      );
    }

    // If it has && operator, it's valid
    if (andExpr.equalityExpression().length > 1) {
      return;
    }

    const equalityExpr = andExpr.equalityExpression(0);
    if (!equalityExpr) {
      throw new Error(
        `Error E0701: do-while condition must be a boolean expression (comparison or logical operation), not '${text}' (MISRA C:2012 Rule 14.4)`,
      );
    }

    // If it has = or != operator, it's valid
    if (equalityExpr.relationalExpression().length > 1) {
      return;
    }

    const relationalExpr = equalityExpr.relationalExpression(0);
    if (!relationalExpr) {
      throw new Error(
        `Error E0701: do-while condition must be a boolean expression (comparison or logical operation), not '${text}' (MISRA C:2012 Rule 14.4)`,
      );
    }

    // If it has <, >, <=, >= operator, it's valid
    if (relationalExpr.bitwiseOrExpression().length > 1) {
      return;
    }

    // Check if it's a unary ! (negation) expression - that's valid on booleans
    const bitwiseOrExpr = relationalExpr.bitwiseOrExpression(0);
    if (bitwiseOrExpr && this.isBooleanExpression(bitwiseOrExpr)) {
      return;
    }

    // No comparison or logical operators found - just a value
    throw new Error(
      `Error E0701: do-while condition must be a boolean expression (comparison or logical operation), not '${text}' (MISRA C:2012 Rule 14.4)\n  help: use explicit comparison: ${text} > 0 or ${text} != 0`,
    );
  }

  /**
   * Check if an expression resolves to a boolean type.
   * This includes: boolean literals, boolean variables, negation of booleans, function calls returning bool.
   */
  private isBooleanExpression(ctx: Parser.BitwiseOrExpressionContext): boolean {
    const text = ctx.getText();

    // Check for boolean literals
    if (text === "true" || text === "false") {
      return true;
    }

    // Check for negation (! operator) - valid for boolean expressions
    if (text.startsWith("!")) {
      return true;
    }

    // Check if it's a known boolean variable
    const typeInfo = this.typeRegistry.get(text);
    if (typeInfo?.baseType === "bool") {
      return true;
    }

    return false;
  }

  // ========================================================================
  // Function Call in Condition Validation (Issue #254)
  // ========================================================================

  /**
   * Issue #254: Validate that condition does not contain function calls (E0702)
   * MISRA C:2012 Rule 13.5 forbids function calls in conditions because:
   * - Short-circuit evaluation may skip the function call
   * - Side effects become unpredictable
   */
  validateConditionNoFunctionCall(
    ctx: Parser.ExpressionContext,
    conditionType: string,
  ): void {
    if (this.hasPostfixFunctionCall(ctx)) {
      const text = ctx.getText();
      throw new Error(
        `Error E0702: Function call in '${conditionType}' condition is not allowed (MISRA C:2012 Rule 13.5)\n` +
          `  expression: ${text}\n` +
          `  help: store the function result in a variable first`,
      );
    }
  }

  /**
   * Issue #254: Validate that ternary condition does not contain function calls (E0702)
   * Used for ternary expressions where condition is OrExpressionContext
   */
  validateTernaryConditionNoFunctionCall(
    ctx: Parser.OrExpressionContext,
  ): void {
    if (this.hasPostfixFunctionCallInOrExpr(ctx)) {
      const text = ctx.getText();
      throw new Error(
        `Error E0702: Function call in 'ternary' condition is not allowed (MISRA C:2012 Rule 13.5)\n` +
          `  expression: ${text}\n` +
          `  help: store the function result in a variable first`,
      );
    }
  }

  /**
   * Issue #254: Check if expression contains a function call (postfix with argumentList)
   * Adapted from CodeGenerator.hasPostfixFunctionCall
   */
  private hasPostfixFunctionCall(expr: Parser.ExpressionContext): boolean {
    const ternary = expr.ternaryExpression();
    if (!ternary) return false;

    for (const or of ternary.orExpression()) {
      if (this.hasPostfixFunctionCallInOrExpr(or)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Issue #254: Check if orExpression contains a function call
   */
  private hasPostfixFunctionCallInOrExpr(
    or: Parser.OrExpressionContext,
  ): boolean {
    for (const and of or.andExpression()) {
      for (const eq of and.equalityExpression()) {
        for (const rel of eq.relationalExpression()) {
          for (const bor of rel.bitwiseOrExpression()) {
            for (const bxor of bor.bitwiseXorExpression()) {
              for (const band of bxor.bitwiseAndExpression()) {
                for (const shift of band.shiftExpression()) {
                  for (const add of shift.additiveExpression()) {
                    for (const mult of add.multiplicativeExpression()) {
                      for (const unary of mult.unaryExpression()) {
                        if (this.hasPostfixFunctionCallInUnary(unary)) {
                          return true;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Issue #366: Recursively check unaryExpression for function calls.
   * Handles unary operators (!, -, ~, &) that wrap function calls,
   * including arbitrary nesting like !!isReady() or -~getValue().
   */
  private hasPostfixFunctionCallInUnary(
    unary: Parser.UnaryExpressionContext,
  ): boolean {
    // Recurse through nested unary operators (!, -, ~, &) until we reach postfixExpression
    const nestedUnary = unary.unaryExpression();
    if (nestedUnary) {
      return this.hasPostfixFunctionCallInUnary(nestedUnary);
    }

    // Base case: check postfixExpression
    const postfix = unary.postfixExpression();
    if (postfix) {
      for (const op of postfix.postfixOp()) {
        if (op.argumentList() || op.getText().startsWith("(")) {
          return true;
        }
      }
    }
    return false;
  }

  // ========================================================================
  // Shift Amount Validation (MISRA C:2012 Rule 12.2)
  // ========================================================================

  /**
   * Validate shift amount doesn't exceed type width (MISRA C:2012 Rule 12.2).
   * Shifting by an amount >= type width is undefined behavior.
   */
  validateShiftAmount(
    leftType: string,
    rightExpr: Parser.AdditiveExpressionContext,
    op: string,
    ctx: Parser.ShiftExpressionContext,
  ): void {
    // Get type width in bits
    const typeWidth = this.getTypeWidth(leftType);
    if (!typeWidth) return; // Unknown type, skip validation

    // Try to evaluate shift amount if it's a constant
    const shiftAmount = this.evaluateShiftAmount(rightExpr);
    if (shiftAmount === null) return; // Not a constant, skip validation

    // Check for negative shift (undefined behavior)
    if (shiftAmount < 0) {
      throw new Error(
        `Error: Negative shift amount (${shiftAmount}) is undefined behavior\n` +
          `  Type: ${leftType}\n` +
          `  Expression: ${ctx.getText()}\n` +
          `  Shift amounts must be non-negative`,
      );
    }

    // Check if shift amount >= type width (undefined behavior)
    if (shiftAmount >= typeWidth) {
      throw new Error(
        `Error: Shift amount (${shiftAmount}) exceeds type width (${typeWidth} bits) for type '${leftType}'\n` +
          `  Expression: ${ctx.getText()}\n` +
          `  Shift amount must be < ${typeWidth} for ${typeWidth}-bit types\n` +
          `  This violates MISRA C:2012 Rule 12.2 and causes undefined behavior`,
      );
    }
  }

  /**
   * Get the bit width of a primitive type.
   */
  private getTypeWidth(type: string): number | null {
    switch (type) {
      case "u8":
      case "i8":
        return 8;
      case "u16":
      case "i16":
        return 16;
      case "u32":
      case "i32":
        return 32;
      case "u64":
      case "i64":
        return 64;
      default:
        return null; // Unknown type
    }
  }

  /**
   * Try to evaluate a shift amount expression to get its numeric value.
   * Returns null if not a constant or cannot be evaluated.
   */
  private evaluateShiftAmount(
    ctx: Parser.AdditiveExpressionContext,
  ): number | null {
    // For now, handle simple literals only
    const multExprs = ctx.multiplicativeExpression();
    if (multExprs.length !== 1) return null; // Not a simple literal

    const multExpr = multExprs[0];
    const unaryExprs = multExpr.unaryExpression();
    if (unaryExprs.length !== 1) return null;

    const unaryExpr = unaryExprs[0];

    // Check for unary minus (negative literal)
    const unaryText = unaryExpr.getText();
    const isNegative = unaryText.startsWith("-");

    const postfixExpr = unaryExpr.postfixExpression();
    if (!postfixExpr) {
      // Might be a nested unary expression like -(-5)
      const nestedUnary = unaryExpr.unaryExpression();
      if (nestedUnary) {
        const nestedValue = this.evaluateUnaryExpression(nestedUnary);
        if (nestedValue !== null) {
          return isNegative ? -nestedValue : nestedValue;
        }
      }
      return null;
    }

    const primaryExpr = postfixExpr.primaryExpression();
    if (!primaryExpr) return null;

    const literal = primaryExpr.literal();
    if (!literal) return null;

    const text = literal.getText();
    let value: number | null = null;

    // Handle different number formats
    if (text.startsWith("0x") || text.startsWith("0X")) {
      // Hex literal
      value = Number.parseInt(text.slice(2), 16);
    } else if (text.startsWith("0b") || text.startsWith("0B")) {
      // Binary literal
      value = Number.parseInt(text.slice(2), 2);
    } else {
      // Decimal literal (strip any type suffix)
      const numMatch = text.match(/^\d+/);
      if (numMatch) {
        value = Number.parseInt(numMatch[0], 10);
      }
    }

    if (value !== null && isNegative) {
      value = -value;
    }

    return value;
  }

  /**
   * Helper to evaluate a unary expression recursively.
   */
  private evaluateUnaryExpression(
    ctx: Parser.UnaryExpressionContext,
  ): number | null {
    const unaryText = ctx.getText();
    const isNegative = unaryText.startsWith("-");

    const postfixExpr = ctx.postfixExpression();
    if (postfixExpr) {
      const primaryExpr = postfixExpr.primaryExpression();
      if (!primaryExpr) return null;

      const literal = primaryExpr.literal();
      if (!literal) return null;

      const text = literal.getText();
      let value: number | null = null;

      if (text.startsWith("0x") || text.startsWith("0X")) {
        value = Number.parseInt(text.slice(2), 16);
      } else if (text.startsWith("0b") || text.startsWith("0B")) {
        value = Number.parseInt(text.slice(2), 2);
      } else {
        const numMatch = /^\d+/.exec(text);
        if (numMatch) {
          value = Number.parseInt(numMatch[0], 10);
        }
      }

      if (value !== null && isNegative) {
        value = -value;
      }

      return value;
    }

    // Recursive unary
    const nestedUnary = ctx.unaryExpression();
    if (nestedUnary) {
      const nestedValue = this.evaluateUnaryExpression(nestedUnary);
      if (nestedValue !== null) {
        return isNegative ? -nestedValue : nestedValue;
      }
    }

    return null;
  }
}

export default TypeValidator;
