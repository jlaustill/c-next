/**
 * TypeValidator - Handles compile-time validation of types, assignments, and control flow
 * Static class using CodeGenState for all state access.
 * Issue #63: Validation logic separated for independent testing
 */
import { existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import * as Parser from "../../logic/parser/grammar/CNextParser";
import CodeGenState from "../../state/CodeGenState";
import TypeResolver from "./TypeResolver";
import ExpressionUtils from "../../../utils/ExpressionUtils";
// SonarCloud S3776: Extracted literal parsing to reduce complexity
import LiteralEvaluator from "./helpers/LiteralEvaluator";

/**
 * ADR-010: Implementation file extensions that should NOT be #included
 */
const IMPLEMENTATION_EXTENSIONS = new Set([
  ".c",
  ".cpp",
  ".cc",
  ".cxx",
  ".c++",
]);

/**
 * TypeValidator class - validates types, assignments, and control flow at compile time.
 * All methods are static - uses CodeGenState for state access.
 */
class TypeValidator {
  // ========================================================================
  // Include Validation (ADR-010)
  // ========================================================================

  /**
   * ADR-010: Validate that #include doesn't include implementation files
   */
  static validateIncludeNotImplementationFile(
    includeText: string,
    lineNumber: number,
  ): void {
    const angleMatch = /#\s*include\s*<([^>]+)>/.exec(includeText);
    const quoteMatch = /#\s*include\s*"([^"]+)"/.exec(includeText);

    const includePath = angleMatch?.[1] || quoteMatch?.[1];
    if (!includePath) {
      return;
    }

    const ext = includePath
      .substring(includePath.lastIndexOf("."))
      .toLowerCase();

    if (IMPLEMENTATION_EXTENSIONS.has(ext)) {
      throw new Error(
        `E0503: Cannot #include implementation file '${includePath}'. ` +
          `Only header files (.h, .hpp) are allowed. Line ${lineNumber}`,
      );
    }
  }

  /**
   * E0504: Validate that a .cnx alternative doesn't exist for a .h/.hpp include
   */
  static validateIncludeNoCnxAlternative(
    includeText: string,
    lineNumber: number,
    sourcePath: string | null,
    includePaths: string[],
    fileExists: (path: string) => boolean = existsSync,
  ): void {
    const parsed = TypeValidator._parseIncludeDirective(includeText);
    if (!parsed) return;
    if (parsed.path.endsWith(".cnx")) return;
    if (!TypeValidator._isHeaderFile(parsed.path)) return;

    const cnxPath = parsed.path.replace(/\.(h|hpp)$/i, ".cnx");

    if (parsed.isQuoted) {
      TypeValidator._checkQuotedIncludeForCnx(
        parsed.path,
        cnxPath,
        sourcePath,
        lineNumber,
        fileExists,
      );
    } else {
      TypeValidator._checkAngleIncludeForCnx(
        parsed.path,
        cnxPath,
        includePaths,
        lineNumber,
        fileExists,
      );
    }
  }

  private static _parseIncludeDirective(
    includeText: string,
  ): { path: string; isQuoted: boolean } | null {
    const angleMatch = /#\s*include\s*<([^>]+)>/.exec(includeText);
    const quoteMatch = /#\s*include\s*"([^"]+)"/.exec(includeText);

    if (quoteMatch) return { path: quoteMatch[1], isQuoted: true };
    if (angleMatch) return { path: angleMatch[1], isQuoted: false };
    return null;
  }

  private static _isHeaderFile(path: string): boolean {
    const ext = path.substring(path.lastIndexOf(".")).toLowerCase();
    return ext === ".h" || ext === ".hpp";
  }

  private static _checkQuotedIncludeForCnx(
    includePath: string,
    cnxPath: string,
    sourcePath: string | null,
    lineNumber: number,
    fileExists: (path: string) => boolean,
  ): void {
    if (!sourcePath) return;

    const sourceDir = dirname(sourcePath);
    const fullCnxPath = resolve(sourceDir, cnxPath);
    if (fileExists(fullCnxPath)) {
      throw new Error(
        `E0504: Found #include "${includePath}" but '${cnxPath}' exists at the same location.\n` +
          `       Use #include "${cnxPath}" instead to use the C-Next version. Line ${lineNumber}`,
      );
    }
  }

  private static _checkAngleIncludeForCnx(
    includePath: string,
    cnxPath: string,
    includePaths: string[],
    lineNumber: number,
    fileExists: (path: string) => boolean,
  ): void {
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

  // ========================================================================
  // Bitmap Field Validation (ADR-034)
  // ========================================================================

  static validateBitmapFieldLiteral(
    expr: Parser.ExpressionContext,
    width: number,
    fieldName: string,
  ): void {
    const text = expr.getText().trim();
    const maxValue = (1 << width) - 1;

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

  static checkArrayBounds(
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
        } else if (dimensions[i] > 0 && constValue >= dimensions[i]) {
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

  static validateCallbackAssignment(
    expectedType: string,
    valueExpr: Parser.ExpressionContext,
    fieldName: string,
    isCallbackTypeUsedAsFieldType: (funcName: string) => boolean,
  ): void {
    const valueText = valueExpr.getText();

    if (!CodeGenState.knownFunctions.has(valueText)) {
      return;
    }

    const expectedInfo = CodeGenState.callbackTypes.get(expectedType);
    const valueInfo = CodeGenState.callbackTypes.get(valueText);

    if (!expectedInfo || !valueInfo) {
      return;
    }

    if (!TypeValidator.callbackSignaturesMatch(expectedInfo, valueInfo)) {
      throw new Error(
        `Error: Function '${valueText}' signature does not match callback type '${expectedType}'`,
      );
    }

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

  static callbackSignaturesMatch(
    a: {
      returnType: string;
      parameters: {
        type: string;
        isConst: boolean;
        isPointer: boolean;
        isArray: boolean;
      }[];
    },
    b: {
      returnType: string;
      parameters: {
        type: string;
        isConst: boolean;
        isPointer: boolean;
        isArray: boolean;
      }[];
    },
  ): boolean {
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

  static checkConstAssignment(identifier: string): string | null {
    const paramInfo = CodeGenState.currentParameters.get(identifier);
    if (paramInfo?.isConst) {
      return `cannot assign to const parameter '${identifier}'`;
    }

    const scopedName = CodeGenState.resolveIdentifier(identifier);

    const typeInfo = CodeGenState.getVariableTypeInfo(scopedName);
    if (typeInfo?.isConst) {
      return `cannot assign to const variable '${identifier}'`;
    }

    return null;
  }

  static isConstValue(identifier: string): boolean {
    const paramInfo = CodeGenState.currentParameters.get(identifier);
    if (paramInfo?.isConst) {
      return true;
    }

    const typeInfo = CodeGenState.getVariableTypeInfo(identifier);
    if (typeInfo?.isConst) {
      return true;
    }

    return false;
  }

  // ========================================================================
  // Scope Identifier Validation (ADR-016)
  // ========================================================================

  static validateBareIdentifierInScope(
    identifier: string,
    isLocalVariable: boolean,
    isKnownStruct: (name: string) => boolean,
  ): void {
    const currentScope = CodeGenState.currentScope;

    if (!currentScope) {
      return;
    }

    if (isLocalVariable) {
      return;
    }

    const scopeMembers = CodeGenState.getScopeMembers(currentScope);
    if (scopeMembers?.has(identifier)) {
      throw new Error(
        `Error: Use 'this.${identifier}' to access scope member '${identifier}' inside scope '${currentScope}'`,
      );
    }

    if (CodeGenState.symbols!.knownRegisters.has(identifier)) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access register '${identifier}' inside scope '${currentScope}'`,
      );
    }

    if (
      CodeGenState.knownFunctions.has(identifier) &&
      !identifier.startsWith(currentScope + "_")
    ) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access global function '${identifier}' inside scope '${currentScope}'`,
      );
    }

    if (CodeGenState.symbols!.knownEnums.has(identifier)) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access global enum '${identifier}' inside scope '${currentScope}'`,
      );
    }

    if (isKnownStruct(identifier)) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access global struct '${identifier}' inside scope '${currentScope}'`,
      );
    }

    const typeInfo = CodeGenState.getVariableTypeInfo(identifier);
    if (typeInfo && !identifier.includes("_")) {
      throw new Error(
        `Error: Use 'global.${identifier}' to access global variable '${identifier}' inside scope '${currentScope}'`,
      );
    }
  }

  static resolveBareIdentifier(
    identifier: string,
    isLocalVariable: boolean,
    isKnownStruct: (name: string) => boolean,
  ): string | null {
    if (isLocalVariable) {
      return null;
    }

    const currentScope = CodeGenState.currentScope;

    if (currentScope) {
      const scopeResolved = TypeValidator._resolveScopeMember(
        identifier,
        currentScope,
      );
      if (scopeResolved) return scopeResolved;
    }

    if (
      TypeValidator._isKnownGlobalIdentifier(
        identifier,
        currentScope,
        isKnownStruct,
      )
    ) {
      return currentScope ? identifier : null;
    }

    return null;
  }

  private static _resolveScopeMember(
    identifier: string,
    currentScope: string,
  ): string | null {
    const scopeMembers = CodeGenState.getScopeMembers(currentScope);
    if (scopeMembers?.has(identifier)) {
      return `${currentScope}_${identifier}`;
    }

    const scopedFuncName = `${currentScope}_${identifier}`;
    if (CodeGenState.knownFunctions.has(scopedFuncName)) {
      return scopedFuncName;
    }

    return null;
  }

  private static _isKnownGlobalIdentifier(
    identifier: string,
    currentScope: string | null,
    isKnownStruct: (name: string) => boolean,
  ): boolean {
    const typeInfo = CodeGenState.getVariableTypeInfo(identifier);
    if (typeInfo && !identifier.includes("_")) {
      return true;
    }

    if (
      CodeGenState.knownFunctions.has(identifier) &&
      !identifier.startsWith(currentScope + "_")
    ) {
      return true;
    }

    return (
      CodeGenState.symbols!.knownEnums.has(identifier) ||
      isKnownStruct(identifier) ||
      CodeGenState.symbols!.knownRegisters.has(identifier)
    );
  }

  static resolveForMemberAccess(identifier: string): string | null {
    if (CodeGenState.symbols!.knownScopes.has(identifier)) {
      return identifier;
    }
    return null;
  }

  // ========================================================================
  // Critical Section Validation (ADR-050)
  // ========================================================================

  static validateNoEarlyExits(ctx: Parser.BlockContext): void {
    for (const stmt of ctx.statement()) {
      TypeValidator._validateStatementForEarlyExit(stmt);
    }
  }

  private static _validateStatementForEarlyExit(
    stmt: Parser.StatementContext,
  ): void {
    if (stmt.returnStatement()) {
      throw new Error(
        `E0853: Cannot use 'return' inside critical section - would leave interrupts disabled`,
      );
    }

    if (stmt.block()) {
      TypeValidator.validateNoEarlyExits(stmt.block()!);
    }

    if (stmt.ifStatement()) {
      TypeValidator._validateIfStatementForEarlyExit(stmt.ifStatement()!);
    }

    TypeValidator._validateLoopForEarlyExit(stmt);
  }

  private static _validateIfStatementForEarlyExit(
    ifStmt: Parser.IfStatementContext,
  ): void {
    for (const innerStmt of ifStmt.statement()) {
      if (innerStmt.returnStatement()) {
        throw new Error(
          `E0853: Cannot use 'return' inside critical section - would leave interrupts disabled`,
        );
      }
      if (innerStmt.block()) {
        TypeValidator.validateNoEarlyExits(innerStmt.block()!);
      }
    }
  }

  private static _validateLoopForEarlyExit(
    stmt: Parser.StatementContext,
  ): void {
    if (stmt.whileStatement()) {
      TypeValidator._checkLoopBodyForReturn(stmt.whileStatement()!.statement());
    }
    if (stmt.forStatement()) {
      TypeValidator._checkLoopBodyForReturn(stmt.forStatement()!.statement());
    }
    if (stmt.doWhileStatement()) {
      TypeValidator.validateNoEarlyExits(stmt.doWhileStatement()!.block());
    }
  }

  private static _checkLoopBodyForReturn(
    loopStmt: Parser.StatementContext,
  ): void {
    if (loopStmt.returnStatement()) {
      throw new Error(
        `E0853: Cannot use 'return' inside critical section - would leave interrupts disabled`,
      );
    }
    if (loopStmt.block()) {
      TypeValidator.validateNoEarlyExits(loopStmt.block()!);
    }
  }

  // ========================================================================
  // Switch Statement Validation (ADR-025)
  // ========================================================================

  static validateSwitchStatement(
    ctx: Parser.SwitchStatementContext,
    switchExpr: Parser.ExpressionContext,
  ): void {
    const cases = ctx.switchCase();
    const defaultCase = ctx.defaultCase();
    const totalClauses = cases.length + (defaultCase ? 1 : 0);

    const exprType = TypeResolver.getExpressionType(switchExpr);
    if (exprType === "bool") {
      throw new Error(
        "Error: Cannot switch on boolean type (MISRA 16.7). Use if/else instead.",
      );
    }

    if (totalClauses < 2) {
      throw new Error(
        "Error: Switch requires at least 2 clauses (MISRA 16.6). Use if statement for single case.",
      );
    }

    const seenValues = new Set<string>();
    for (const caseCtx of cases) {
      for (const labelCtx of caseCtx.caseLabel()) {
        const labelValue = TypeValidator.getCaseLabelValue(labelCtx);
        if (seenValues.has(labelValue)) {
          throw new Error(
            `Error: Duplicate case value '${labelValue}' in switch statement.`,
          );
        }
        seenValues.add(labelValue);
      }
    }

    if (exprType && CodeGenState.symbols!.knownEnums.has(exprType)) {
      TypeValidator.validateEnumExhaustiveness(
        ctx,
        exprType,
        cases,
        defaultCase,
      );
    }
  }

  static validateEnumExhaustiveness(
    ctx: Parser.SwitchStatementContext,
    enumTypeName: string,
    cases: Parser.SwitchCaseContext[],
    defaultCase: Parser.DefaultCaseContext | null,
  ): void {
    const enumVariants = CodeGenState.symbols!.enumMembers.get(enumTypeName);
    if (!enumVariants) return;

    const totalVariants = enumVariants.size;

    let explicitCaseCount = 0;
    for (const caseCtx of cases) {
      explicitCaseCount += caseCtx.caseLabel().length;
    }

    if (defaultCase) {
      const defaultCount = TypeValidator.getDefaultCount(defaultCase);

      if (defaultCount !== null) {
        const covered = explicitCaseCount + defaultCount;
        if (covered !== totalVariants) {
          throw new Error(
            `Error: switch covers ${covered} of ${totalVariants} ${enumTypeName} variants ` +
              `(${explicitCaseCount} explicit + default(${defaultCount})). ` +
              `Expected ${totalVariants}.`,
          );
        }
      }
    } else if (explicitCaseCount !== totalVariants) {
      const missing = totalVariants - explicitCaseCount;
      throw new Error(
        `Error: Non-exhaustive switch on ${enumTypeName}: covers ${explicitCaseCount} of ${totalVariants} variants, missing ${missing}.`,
      );
    }
  }

  static getDefaultCount(ctx: Parser.DefaultCaseContext): number | null {
    const intLiteral = ctx.INTEGER_LITERAL();
    if (intLiteral) {
      return Number.parseInt(intLiteral.getText(), 10);
    }
    return null;
  }

  static getCaseLabelValue(ctx: Parser.CaseLabelContext): string {
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
      const hasNeg = ctx.children && ctx.children[0]?.getText() === "-";
      const value = BigInt(num);
      return String(hasNeg ? -value : value);
    }
    if (ctx.HEX_LITERAL()) {
      const hex = ctx.HEX_LITERAL()!.getText();
      const hasNeg = ctx.children && ctx.children[0]?.getText() === "-";
      const value = BigInt(hex);
      return String(hasNeg ? -value : value);
    }
    if (ctx.BINARY_LITERAL()) {
      const bin = ctx.BINARY_LITERAL()!.getText();
      return String(BigInt(bin));
    }
    if (ctx.CHAR_LITERAL()) {
      return ctx.CHAR_LITERAL()!.getText();
    }
    return "";
  }

  // ========================================================================
  // Ternary Validation (ADR-022)
  // ========================================================================

  static validateTernaryCondition(ctx: Parser.OrExpressionContext): void {
    const text = ctx.getText();

    if (ctx.andExpression().length > 1) {
      return;
    }

    const andExpr = ctx.andExpression(0);
    if (!andExpr) {
      throw new Error(
        `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`,
      );
    }

    if (andExpr.equalityExpression().length > 1) {
      return;
    }

    const equalityExpr = andExpr.equalityExpression(0);
    if (!equalityExpr) {
      throw new Error(
        `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`,
      );
    }

    if (equalityExpr.relationalExpression().length > 1) {
      return;
    }

    const relationalExpr = equalityExpr.relationalExpression(0);
    if (!relationalExpr) {
      throw new Error(
        `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`,
      );
    }

    if (relationalExpr.bitwiseOrExpression().length > 1) {
      return;
    }

    throw new Error(
      `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`,
    );
  }

  static validateNoNestedTernary(
    ctx: Parser.OrExpressionContext,
    branchName: string,
  ): void {
    const text = ctx.getText();
    if (text.includes("?") && text.includes(":")) {
      throw new Error(
        `Error: Nested ternary not allowed in ${branchName}. Use if/else instead.`,
      );
    }
  }

  // ========================================================================
  // Do-While Validation (ADR-027)
  // ========================================================================

  static validateDoWhileCondition(ctx: Parser.ExpressionContext): void {
    const ternaryExpr = ctx.ternaryExpression();
    const orExprs = ternaryExpr.orExpression();

    if (orExprs.length !== 1) {
      throw new Error(
        `Error E0701: do-while condition must be a boolean expression, not a ternary (MISRA C:2012 Rule 14.4)`,
      );
    }

    const orExpr = orExprs[0];
    const text = orExpr.getText();

    if (orExpr.andExpression().length > 1) {
      return;
    }

    const andExpr = orExpr.andExpression(0);
    if (!andExpr) {
      throw new Error(
        `Error E0701: do-while condition must be a boolean expression (comparison or logical operation), not '${text}' (MISRA C:2012 Rule 14.4)`,
      );
    }

    if (andExpr.equalityExpression().length > 1) {
      return;
    }

    const equalityExpr = andExpr.equalityExpression(0);
    if (!equalityExpr) {
      throw new Error(
        `Error E0701: do-while condition must be a boolean expression (comparison or logical operation), not '${text}' (MISRA C:2012 Rule 14.4)`,
      );
    }

    if (equalityExpr.relationalExpression().length > 1) {
      return;
    }

    const relationalExpr = equalityExpr.relationalExpression(0);
    if (!relationalExpr) {
      throw new Error(
        `Error E0701: do-while condition must be a boolean expression (comparison or logical operation), not '${text}' (MISRA C:2012 Rule 14.4)`,
      );
    }

    if (relationalExpr.bitwiseOrExpression().length > 1) {
      return;
    }

    const bitwiseOrExpr = relationalExpr.bitwiseOrExpression(0);
    if (bitwiseOrExpr && TypeValidator._isBooleanExpression(bitwiseOrExpr)) {
      return;
    }

    throw new Error(
      `Error E0701: do-while condition must be a boolean expression (comparison or logical operation), not '${text}' (MISRA C:2012 Rule 14.4)\n  help: use explicit comparison: ${text} > 0 or ${text} != 0`,
    );
  }

  private static _isBooleanExpression(
    ctx: Parser.BitwiseOrExpressionContext,
  ): boolean {
    const text = ctx.getText();

    if (text === "true" || text === "false") {
      return true;
    }

    if (text.startsWith("!")) {
      return true;
    }

    const typeInfo = CodeGenState.getVariableTypeInfo(text);
    if (typeInfo?.baseType === "bool") {
      return true;
    }

    return false;
  }

  // ========================================================================
  // Function Call in Condition Validation (Issue #254)
  // ========================================================================

  static validateConditionNoFunctionCall(
    ctx: Parser.ExpressionContext,
    conditionType: string,
  ): void {
    if (ExpressionUtils.hasFunctionCall(ctx)) {
      const text = ctx.getText();
      throw new Error(
        `Error E0702: Function call in '${conditionType}' condition is not allowed (MISRA C:2012 Rule 13.5)\n` +
          `  expression: ${text}\n` +
          `  help: store the function result in a variable first`,
      );
    }
  }

  static validateTernaryConditionNoFunctionCall(
    ctx: Parser.OrExpressionContext,
  ): void {
    if (ExpressionUtils.hasFunctionCallInOr(ctx)) {
      const text = ctx.getText();
      throw new Error(
        `Error E0702: Function call in 'ternary' condition is not allowed (MISRA C:2012 Rule 13.5)\n` +
          `  expression: ${text}\n` +
          `  help: store the function result in a variable first`,
      );
    }
  }

  // ========================================================================
  // Shift Amount Validation (MISRA C:2012 Rule 12.2)
  // ========================================================================

  static validateShiftAmount(
    leftType: string,
    rightExpr: Parser.AdditiveExpressionContext,
    op: string,
    ctx: Parser.ShiftExpressionContext,
  ): void {
    const typeWidth = TypeValidator._getTypeWidth(leftType);
    if (!typeWidth) return;

    const shiftAmount = TypeValidator._evaluateShiftAmount(rightExpr);
    if (shiftAmount === null) return;

    if (shiftAmount < 0) {
      throw new Error(
        `Error: Negative shift amount (${shiftAmount}) is undefined behavior\n` +
          `  Type: ${leftType}\n` +
          `  Expression: ${ctx.getText()}\n` +
          `  Shift amounts must be non-negative`,
      );
    }

    if (shiftAmount >= typeWidth) {
      throw new Error(
        `Error: Shift amount (${shiftAmount}) exceeds type width (${typeWidth} bits) for type '${leftType}'\n` +
          `  Expression: ${ctx.getText()}\n` +
          `  Shift amount must be < ${typeWidth} for ${typeWidth}-bit types\n` +
          `  This violates MISRA C:2012 Rule 12.2 and causes undefined behavior`,
      );
    }
  }

  private static _getTypeWidth(type: string): number | null {
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
        return null;
    }
  }

  private static _evaluateShiftAmount(
    ctx: Parser.AdditiveExpressionContext,
  ): number | null {
    const multExprs = ctx.multiplicativeExpression();
    if (multExprs.length !== 1) return null;

    const multExpr = multExprs[0];
    const unaryExprs = multExpr.unaryExpression();
    if (unaryExprs.length !== 1) return null;

    return TypeValidator._evaluateUnaryExpression(unaryExprs[0]);
  }

  private static _evaluateUnaryExpression(
    ctx: Parser.UnaryExpressionContext,
  ): number | null {
    const unaryText = ctx.getText();
    const isNegative = unaryText.startsWith("-");

    const postfixExpr = ctx.postfixExpression();
    if (postfixExpr) {
      return TypeValidator._evaluateLiteralFromPostfix(postfixExpr, isNegative);
    }

    const nestedUnary = ctx.unaryExpression();
    if (nestedUnary) {
      const nestedValue = TypeValidator._evaluateUnaryExpression(nestedUnary);
      return LiteralEvaluator.applySign(nestedValue, isNegative);
    }

    return null;
  }

  private static _evaluateLiteralFromPostfix(
    postfixExpr: Parser.PostfixExpressionContext,
    isNegative: boolean,
  ): number | null {
    const primaryExpr = postfixExpr.primaryExpression();
    if (!primaryExpr) return null;

    const literal = primaryExpr.literal();
    if (!literal) return null;

    const text = literal.getText();
    const value = LiteralEvaluator.parseLiteral(text);
    return LiteralEvaluator.applySign(value, isNegative);
  }

  // ========================================================================
  // Integer Assignment Validation (ADR-024)
  // ========================================================================

  static validateIntegerAssignment(
    targetType: string,
    expressionText: string,
    sourceType: string | null,
    isCompound: boolean,
  ): void {
    if (isCompound) {
      return;
    }

    if (!TypeResolver.isIntegerType(targetType)) {
      return;
    }

    const trimmed = expressionText.trim();

    const isDecimalLiteral = /^-?\d+$/.exec(trimmed);
    const isHexLiteral = /^0[xX][0-9a-fA-F]+$/.exec(trimmed);
    const isBinaryLiteral = /^0[bB][01]+$/.exec(trimmed);

    if (isDecimalLiteral || isHexLiteral || isBinaryLiteral) {
      TypeResolver.validateLiteralFitsType(trimmed, targetType);
    } else {
      TypeResolver.validateTypeConversion(targetType, sourceType);
    }
  }
}

export default TypeValidator;
