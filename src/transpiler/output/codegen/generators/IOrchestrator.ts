/**
 * Interface that CodeGenerator implements to orchestrate generators.
 *
 * Provides:
 * - Access to read-only input and current state
 * - Effect processing to update mutable state
 * - Utility methods needed by generators
 * - Code generation delegation methods
 *
 * This abstraction enables:
 * - Testing generators with mock orchestrators
 * - Gradual migration via "strangler fig" pattern
 */
import IGeneratorInput from "./IGeneratorInput";
import IGeneratorState from "./IGeneratorState";
import TGeneratorEffect from "./TGeneratorEffect";
import TTypeInfo from "../types/TTypeInfo";
import * as Parser from "../../../logic/parser/grammar/CNextParser";
import { ParserRuleContext } from "antlr4ng";

interface IOrchestrator {
  // === State Access ===

  /** Get the immutable input context */
  getInput(): IGeneratorInput;

  /** Get a snapshot of the current generation state */
  getState(): IGeneratorState;

  // === Effect Processing ===

  /** Process effects returned by a generator, updating internal state */
  applyEffects(effects: readonly TGeneratorEffect[]): void;

  // === Utilities ===

  /** Get the current indentation string */
  getIndent(): string;

  /** Resolve an identifier to its fully-scoped name */
  resolveIdentifier(name: string): string;

  // === Expression Generation (ADR-053 A2) ===
  // These methods allow extracted generators to call back into CodeGenerator
  // for parts not yet extracted, enabling incremental "strangler fig" migration.

  /** Generate a C expression from any expression context */
  generateExpression(ctx: Parser.ExpressionContext): string;

  /**
   * Issue #477: Generate a C expression with a specific expected type context.
   * Used by return statements to resolve unqualified enum values.
   */
  generateExpressionWithExpectedType(
    ctx: Parser.ExpressionContext,
    expectedType: string | null,
  ): string;

  /** Generate type translation (C-Next type -> C type) */
  generateType(ctx: Parser.TypeContext): string;

  /** Generate a unary expression */
  generateUnaryExpr(ctx: Parser.UnaryExpressionContext): string;

  /** Generate a postfix expression */
  generatePostfixExpr(ctx: Parser.PostfixExpressionContext): string;

  /** Generate the full precedence chain from or-expression down */
  generateOrExpr(ctx: Parser.OrExpressionContext): string;

  // === Type Utilities ===

  /** Check if a type name is a known struct */
  isKnownStruct(typeName: string): boolean;

  /** Check if a type is a float type (f32, f64, float, double) */
  isFloatType(typeName: string): boolean;

  /** Check if a type is an integer type */
  isIntegerType(typeName: string): boolean;

  /** Check if a function is defined in C-Next (vs C headers) */
  isCNextFunction(name: string): boolean;

  /** Issue #322: Check if a type is a struct type */
  isStructType(typeName: string): boolean;

  /** Get the raw type name without C conversion */
  getTypeName(ctx: Parser.TypeContext): string;

  /** Try to evaluate a constant expression at compile time */
  tryEvaluateConstant(ctx: Parser.ExpressionContext): number | undefined;

  /** Get zero initializer for a type (e.g., "0", "{0}", "false") */
  getZeroInitializer(typeCtx: Parser.TypeContext, isArray: boolean): string;

  // === Expression Analysis ===

  /** Get the enum type of an expression, if any */
  getExpressionEnumType(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): string | null;

  /** Check if an expression is an integer literal or variable */
  isIntegerExpression(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): boolean;

  /** Check if an expression is a string type */
  isStringExpression(ctx: Parser.RelationalExpressionContext): boolean;

  /** Get type of additive expression for shift validation */
  getAdditiveExpressionType(
    ctx: Parser.AdditiveExpressionContext,
  ): string | null;

  /** Extract operators from parse tree children in correct order */
  getOperatorsFromChildren(ctx: ParserRuleContext): string[];

  // === Validation ===

  /** Validate cross-scope member visibility (ADR-016) */
  validateCrossScopeVisibility(
    scopeName: string,
    memberName: string,
    isGlobalAccess?: boolean,
  ): void;

  /** Validate shift amount is within type bounds */
  validateShiftAmount(
    leftType: string,
    rightExpr: Parser.AdditiveExpressionContext,
    op: string,
    ctx: Parser.ShiftExpressionContext,
  ): void;

  /** Validate ternary condition is a comparison (ADR-022) */
  validateTernaryCondition(condition: Parser.OrExpressionContext): void;

  /** Validate no nested ternary expressions (ADR-022) */
  validateNoNestedTernary(
    expr: Parser.OrExpressionContext,
    branchName: string,
  ): void;

  /** Validate that a literal value fits in the target type */
  validateLiteralFitsType(literal: string, typeName: string): void;

  /** Validate type conversion is allowed */
  validateTypeConversion(targetType: string, sourceType: string | null): void;

  // === Function Call Helpers (ADR-053 A2 Phase 5) ===

  /** Get simple identifier from expression, or null if complex */
  getSimpleIdentifier(ctx: Parser.ExpressionContext): string | null;

  /** Generate function argument with pass-by-reference handling */
  generateFunctionArg(
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ): string;

  /** Check if a value is const (for const-to-non-const validation) */
  isConstValue(name: string): boolean;

  /** Get known enums set for pass-by-value detection */
  getKnownEnums(): ReadonlySet<string>;

  /** Issue #304: Check if we're generating C++ output */
  isCppMode(): boolean;

  /** Issue #304: Check if a type is a C++ enum class (needs :: syntax and explicit casts) */
  isCppEnumClass(typeName: string): boolean;

  /** Issue #304: Get the expression type */
  getExpressionType(ctx: Parser.ExpressionContext): string | null;

  /** Issue #269: Check if a parameter is pass-by-value (small unmodified primitive) */
  isParameterPassByValue(funcName: string, paramIndex: number): boolean;

  // === Statement Generation (ADR-053 A3) ===

  /** Generate a block (curly braces with statements) */
  generateBlock(ctx: Parser.BlockContext): string;

  /** Generate a single statement */
  generateStatement(ctx: Parser.StatementContext): string;

  /**
   * Issue #250: Flush pending temp variable declarations.
   * Returns declarations as a single string and clears the pending list.
   * Used by control flow generators to capture temps from conditions
   * before generating loop/if bodies.
   */
  flushPendingTempDeclarations(): string;

  /** Get indentation string for current level */
  indent(text: string): string;

  // === Statement Validation (ADR-053 A3) ===

  /** Validate no early exits (return/break) in critical blocks (ADR-050) */
  validateNoEarlyExits(ctx: Parser.BlockContext): void;

  /** Validate switch statement (ADR-025) */
  validateSwitchStatement(
    ctx: Parser.SwitchStatementContext,
    switchExpr: Parser.ExpressionContext,
  ): void;

  /** Validate condition is a boolean expression (ADR-027, Issue #884) */
  validateConditionIsBoolean(
    ctx: Parser.ExpressionContext,
    conditionType: string,
  ): void;

  /** Validate no function calls in condition (Issue #254, E0702) */
  validateConditionNoFunctionCall(
    ctx: Parser.ExpressionContext,
    conditionType: string,
  ): void;

  /** Validate no function calls in ternary condition (Issue #254, E0702) */
  validateTernaryConditionNoFunctionCall(ctx: Parser.OrExpressionContext): void;

  // === Control Flow Helpers (ADR-053 A3) ===

  /** Generate an assignment target */
  generateAssignmentTarget(ctx: Parser.AssignmentTargetContext): string;

  /** Generate array dimensions */
  generateArrayDimensions(dims: Parser.ArrayDimensionContext[]): string;

  /** Generate single array dimension */
  generateArrayDimension(dim: Parser.ArrayDimensionContext): string;

  // === strlen Optimization (ADR-053 A3) ===

  /** Count string length accesses for caching */
  countStringLengthAccesses(ctx: Parser.ExpressionContext): Map<string, number>;

  /** Count block length accesses */
  countBlockLengthAccesses(
    ctx: Parser.BlockContext,
    counts: Map<string, number>,
  ): void;

  /** Setup length cache and return declarations */
  setupLengthCache(counts: Map<string, number>): string;

  /** Clear length cache */
  clearLengthCache(): void;

  /** Register a local variable */
  registerLocalVariable(name: string): void;

  // === Declaration Generation (ADR-053 A4) ===

  /** Generate parameter list for function signature */
  generateParameterList(ctx: Parser.ParameterListContext): string;

  /** Get the length of a string literal (excluding quotes and null terminator) */
  getStringLiteralLength(literal: string): number;

  /** Get string concatenation operands if expression is a concat */
  getStringConcatOperands(ctx: Parser.ExpressionContext): {
    left: string;
    right: string;
    leftCapacity: number;
    rightCapacity: number;
  } | null;

  /** Get substring operands if expression is a substring call */
  getSubstringOperands(ctx: Parser.ExpressionContext): {
    source: string;
    start: string;
    length: string;
    sourceCapacity: number;
  } | null;

  /** Get the capacity of a string expression (for validation) */
  getStringExprCapacity(exprCode: string): number | null;

  // === Parameter Management ===

  /** Set current function parameters for pointer semantics (ADR-006) */
  setParameters(paramList: Parser.ParameterListContext | null): void;

  /** Clear current function parameters */
  clearParameters(): void;

  /** Check if a callback type is used as a struct field type */
  isCallbackTypeUsedAsFieldType(funcName: string): boolean;

  // === Scope Management ===

  /** Set the current scope name for prefixing */
  setCurrentScope(name: string | null): void;

  /** Issue #269: Set the current function name for pass-by-value lookup */
  setCurrentFunctionName(name: string | null): void;

  /** Issue #477: Get the current function's return type for enum inference */
  getCurrentFunctionReturnType(): string | null;

  /** Issue #477: Set the current function's return type for enum inference */
  setCurrentFunctionReturnType(returnType: string | null): void;

  // === Function Body Management ===

  /** Enter function body - clears local variables and sets inFunctionBody flag */
  enterFunctionBody(): void;

  /** Exit function body - clears local variables and inFunctionBody flag */
  exitFunctionBody(): void;

  /** Set the main function args parameter name for translation */
  setMainArgsName(name: string | null): void;

  /** Check if this is main function with args parameter */
  isMainFunctionWithArgs(
    name: string,
    paramList: Parser.ParameterListContext | null,
  ): boolean;

  /** Generate callback typedef for a function */
  generateCallbackTypedef(funcName: string): string | null;

  /**
   * Issue #268: Update symbol parameters with auto-const info based on modification tracking.
   * Call this after generating function body but before clearing modifiedParameters.
   */
  updateFunctionParamsAutoConst(functionName: string): void;

  /**
   * Issue #268: Mark a parameter as modified for auto-const tracking.
   * Used when a parameter is passed to a function that modifies its corresponding parameter.
   */
  markParameterModified(paramName: string): void;

  /**
   * Issue #268: Check if a callee function's parameter at given index is modified.
   * Returns true if the callee modifies that parameter (should not have const).
   * Returns false if unmodified or unknown (callee not yet processed).
   */
  isCalleeParameterModified(funcName: string, paramIndex: number): boolean;

  /**
   * Issue #268: Check if a name is a parameter of the current function.
   */
  isCurrentParameter(name: string): boolean;

  // === Postfix Expression Helpers (Issue #644) ===

  /** Generate a primary expression */
  generatePrimaryExpr(ctx: Parser.PrimaryExpressionContext): string;

  /** Check if a name is a known scope */
  isKnownScope(name: string): boolean;

  /** Check if a symbol is a C++ scope symbol (namespace, class, enum) */
  isCppScopeSymbol(name: string): boolean;

  /** Get the separator for scope access (:: for C++, _ for C-Next) */
  getScopeSeparator(isCppAccess: boolean): string;

  /** Get struct field info for .length calculations */
  getStructFieldInfo(
    structType: string,
    fieldName: string,
  ): { type: string; dimensions?: (number | string)[] } | null;

  /** Get member type info for struct access chains */
  getMemberTypeInfo(structType: string, memberName: string): TTypeInfo | null;

  /** Generate a bit mask for bit range access */
  generateBitMask(width: string, is64Bit?: boolean): string;

  /** Add a pending temp variable declaration (for float bit indexing) */
  addPendingTempDeclaration(declaration: string): void;

  /** Register a float bit shadow variable */
  registerFloatBitShadow(shadowName: string): void;

  /** Mark a float shadow as having current value (skip redundant memcpy) */
  markFloatShadowCurrent(shadowName: string): void;

  /** Check if a float shadow has been declared */
  hasFloatBitShadow(shadowName: string): boolean;

  /** Check if a float shadow has current value */
  isFloatShadowCurrent(shadowName: string): boolean;
}

export default IOrchestrator;
