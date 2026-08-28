/**
 * Binary Expression Generator
 *
 * Generates C code for binary expressions in the operator precedence chain:
 * - Logical: || (or), && (and)
 * - Equality: = (becomes ==), != with ADR-017 enum safety and ADR-045 string strcmp
 * - Relational: <, >, <=, >=
 * - Bitwise: |, ^, &
 * - Shift: <<, >> with validation
 * - Arithmetic: +, -, *, /, %
 *
 * Issue #235: Includes constant folding for compile-time constant expressions.
 */
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import BinaryExprUtils from "./BinaryExprUtils";
import { ParserRuleContext } from "antlr4ng";
import TypeResolver from "../../TypeResolver";
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";
import CodeGenState from "../../../../state/CodeGenState";

/**
 * Generator context passed to child generators.
 */
interface IGeneratorContext {
  input: IGeneratorInput;
  state: IGeneratorState;
  orchestrator: IOrchestrator;
}

/**
 * Generic child expression generator function type
 */
type TChildGenerator<T> = (
  child: T,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
) => IGeneratorOutput;

/**
 * Accumulate binary expressions with operators into a single result.
 * Handles the common pattern of: first + (op + rest)*
 */
function accumulateBinaryExprs<T>(
  exprs: T[],
  operators: string[],
  defaultOp: string,
  generateChild: TChildGenerator<T>,
  ctx: IGeneratorContext,
  mapOperator?: (op: string) => string,
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [];
  const { input, state, orchestrator } = ctx;

  const firstResult = generateChild(exprs[0], input, state, orchestrator);
  effects.push(...firstResult.effects);
  let result = firstResult.code;

  for (let i = 1; i < exprs.length; i++) {
    const rawOp = operators[i - 1] || defaultOp;
    const op = mapOperator ? mapOperator(rawOp) : rawOp;

    const exprResult = generateChild(exprs[i], input, state, orchestrator);
    effects.push(...exprResult.effects);
    result += ` ${op} ${exprResult.code}`;
  }

  return { code: result, effects };
}

/**
 * Generate C code for an OR expression (lowest precedence binary op).
 */
const generateOrExpr = (
  node: Parser.OrExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const parts: string[] = [];

  for (const andExpr of node.andExpression()) {
    const result = generateAndExpr(andExpr, input, state, orchestrator);
    parts.push(result.code);
    effects.push(...result.effects);
  }

  return { code: parts.join(" || "), effects };
};

/**
 * Generate C code for an AND expression.
 */
const generateAndExpr = (
  node: Parser.AndExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const parts: string[] = [];

  for (const eqExpr of node.equalityExpression()) {
    const result = generateEqualityExpr(eqExpr, input, state, orchestrator);
    parts.push(result.code);
    effects.push(...result.effects);
  }

  return { code: parts.join(" && "), effects };
};

/**
 * Generate C code for an equality expression.
 * ADR-001: = becomes == in C
 * ADR-017: Enum type safety validation
 * ADR-045: String comparison via strcmp()
 * Issue #1032: Clear expectedType for comparison operands
 */
const generateEqualityExpr = (
  node: Parser.EqualityExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const exprs = node.relationalExpression();

  if (exprs.length === 1) {
    return generateRelationalExpr(exprs[0], input, state, orchestrator);
  }

  // ADR-017: Validate enum type safety for comparisons
  if (exprs.length >= 2) {
    const leftEnumType = orchestrator.getExpressionEnumType(exprs[0]);
    const rightEnumType = orchestrator.getExpressionEnumType(exprs[1]);
    const leftIsInteger = orchestrator.isIntegerExpression(exprs[0]);
    const rightIsInteger = orchestrator.isIntegerExpression(exprs[1]);
    BinaryExprUtils.validateEnumComparison(
      leftEnumType,
      rightEnumType,
      leftIsInteger,
      rightIsInteger,
    );

    // ADR-045: Check for string comparison
    const leftIsString = orchestrator.isStringExpression(exprs[0]);
    const rightIsString = orchestrator.isStringExpression(exprs[1]);

    if (leftIsString || rightIsString) {
      // Generate strcmp for string comparison - needs string.h
      effects.push({ type: "include", header: "string" });

      // Issue #1032: Clear expectedType for equality comparisons.
      // Use CodeGenState.withoutExpectedType() to clear the global state that
      // generators read via getState(). The passed state is not used for
      // expectedType lookup - generators read from CodeGenState directly.
      const [leftResult, rightResult] = CodeGenState.withoutExpectedType(() => [
        generateRelationalExpr(exprs[0], input, state, orchestrator),
        generateRelationalExpr(exprs[1], input, state, orchestrator),
      ]);
      effects.push(...leftResult.effects, ...rightResult.effects);

      const fullText = node.getText();
      const isNotEqual = fullText.includes("!=");

      return {
        code: BinaryExprUtils.generateStrcmpCode(
          leftResult.code,
          rightResult.code,
          isNotEqual,
        ),
        effects,
      };
    }
  }

  // Build the expression, transforming = to ==
  // Issue #152: Extract operators in order from parse tree children
  // ADR-001: C-Next uses = for equality, transpile to ==
  const operators = orchestrator.getOperatorsFromChildren(node);

  // Issue #1032: Clear expectedType for equality comparisons.
  // The U suffix for MISRA 7.2 compliance applies to assignments, not comparisons.
  // Use CodeGenState.withoutExpectedType() to clear the global state that
  // generators read via getState(). The passed state is not used for
  // expectedType lookup - generators read from CodeGenState directly.
  return CodeGenState.withoutExpectedType(() =>
    accumulateBinaryExprs(
      exprs,
      operators,
      "=",
      generateRelationalExpr,
      { input, state, orchestrator },
      BinaryExprUtils.mapEqualityOperator,
    ),
  );
};

/**
 * Generate C code for a relational expression.
 * Issue #1032: Clear expectedType for comparison operands - MISRA 7.2 suffix
 * should not apply to comparisons, only to assignments. This prevents
 * `i32 < 0` from becoming `signedIdx < 0U` which changes comparison semantics.
 */
const generateRelationalExpr = (
  node: Parser.RelationalExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const exprs = node.bitwiseOrExpression();

  if (exprs.length === 1) {
    return generateBitwiseOrExpr(exprs[0], input, state, orchestrator);
  }

  // Issue #152: Extract operators in order from parse tree children
  const operators = orchestrator.getOperatorsFromChildren(node);

  // Issue #1032: Clear expectedType for relational comparisons.
  // The U suffix for MISRA 7.2 compliance applies to assignments, not comparisons.
  // Comparing `i32 < 0` should NOT generate `signedIdx < 0U` because that
  // changes semantics due to C's integer promotion rules.
  // Use CodeGenState.withoutExpectedType() to clear the global state that
  // generators read via getState(). The passed state is not used for
  // expectedType lookup - generators read from CodeGenState directly.
  return CodeGenState.withoutExpectedType(() =>
    accumulateBinaryExprs(exprs, operators, "<", generateBitwiseOrExpr, {
      input,
      state,
      orchestrator,
    }),
  );
};

/**
 * Generate C code for a bitwise OR expression.
 */
const generateBitwiseOrExpr = (
  node: Parser.BitwiseOrExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const parts: string[] = [];

  for (const xorExpr of node.bitwiseXorExpression()) {
    const result = generateBitwiseXorExpr(xorExpr, input, state, orchestrator);
    parts.push(result.code);
    effects.push(...result.effects);
  }

  return { code: parts.join(" | "), effects };
};

/**
 * Generate C code for a bitwise XOR expression.
 */
const generateBitwiseXorExpr = (
  node: Parser.BitwiseXorExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const parts: string[] = [];

  for (const andExpr of node.bitwiseAndExpression()) {
    const result = generateBitwiseAndExpr(andExpr, input, state, orchestrator);
    parts.push(result.code);
    effects.push(...result.effects);
  }

  return { code: parts.join(" ^ "), effects };
};

/**
 * Generate C code for a bitwise AND expression.
 */
const generateBitwiseAndExpr = (
  node: Parser.BitwiseAndExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const parts: string[] = [];

  for (const shiftExpr of node.shiftExpression()) {
    const result = generateShiftExpr(shiftExpr, input, state, orchestrator);
    parts.push(result.code);
    effects.push(...result.effects);
  }

  return { code: parts.join(" & "), effects };
};

/**
 * Generate C code for a shift expression.
 * Includes validation of shift amounts.
 */
const generateShiftExpr = (
  node: Parser.ShiftExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const exprs = node.additiveExpression();

  if (exprs.length === 1) {
    return generateAdditiveExpr(exprs[0], input, state, orchestrator);
  }

  // Issue #152: Extract operators in order from parse tree children
  const operators = orchestrator.getOperatorsFromChildren(node);
  const firstResult = generateAdditiveExpr(
    exprs[0],
    input,
    state,
    orchestrator,
  );
  effects.push(...firstResult.effects);
  let result = firstResult.code;

  // Get type of left operand for shift validation
  const leftType = orchestrator.getAdditiveExpressionType(exprs[0]);

  for (let i = 1; i < exprs.length; i++) {
    const op = operators[i - 1] || "<<";

    // Validate shift amount if we can determine the left operand type
    if (leftType) {
      orchestrator.validateShiftAmount(leftType, exprs[i], op, node);
    }

    const exprResult = generateAdditiveExpr(
      exprs[i],
      input,
      state,
      orchestrator,
    );
    effects.push(...exprResult.effects);
    result += ` ${op} ${exprResult.code}`;
  }

  return { code: result, effects };
};

/**
 * Issue #1152: C-Next operators that have a saturating helper.
 *
 * Only `+ - *` can overflow into a helper. Unsigned division and modulo cannot
 * overflow at all, and the sole signed case (`INT_MIN / -1`) is left to the
 * existing safe-division path rather than folded in here.
 */
// Partial: an operator outside this map yields undefined, which the chain
// guard below relies on. Typing it as a total Record made that lookup appear
// to always produce a string, so the guard read as dead code (S7765).
const CLAMP_HELPER_FOR_OPERATOR: Readonly<Partial<Record<string, string>>> = {
  "+": "add",
  "-": "sub",
  "*": "mul",
};

/**
 * Issue #1152: Fold a chain of operands into saturating helper calls when the
 * expression's operands are of a `clamp` integer type.
 *
 * `clamp` is C-Next's default overflow behavior (ADR-044), but it used to apply
 * only to compound assignment (`+<-`), so `c <- a + b` wrapped while
 * `c +<- b` saturated -- and `wrap` was indistinguishable from `clamp` in every
 * expression. Routing here makes the modifier mean the same thing wherever the
 * arithmetic is written, which is what lets a bounds guard built from
 * saturating values be trusted (#231).
 *
 * Returns null when the expression should be emitted as plain C: a float or
 * other natively-handled type, a `wrap` type, or operands whose type cannot be
 * resolved.
 */
const tryClampOperands = (
  node: ParserRuleContext,
  operandCodes: readonly string[],
  operators: readonly string[],
  defaultOperator: string,
  effects: TGeneratorEffect[],
): string | null => {
  const cnxType = TypeResolver.getCompositeIntegerType(node);
  if (cnxType === null) return null;
  if (TypeCheckUtils.usesNativeArithmetic(cnxType)) return null;
  if (TypeResolver.getCompositeOverflowBehavior(node) !== "clamp") return null;

  // Every operator in the chain must have a helper; a mixed chain such as
  // `a * b / c` is left alone rather than clamped in part, which would be
  // harder to reason about than not clamping at all.
  const chain = operandCodes.slice(1).map((_, index) => {
    return CLAMP_HELPER_FOR_OPERATOR[operators[index] ?? defaultOperator];
  });
  if (chain.includes(undefined)) {
    return null;
  }

  let code = operandCodes[0];
  chain.forEach((helperOperation, index) => {
    effects.push({
      type: "helper",
      operation: helperOperation!,
      cnxType,
    });
    code = `cnx_clamp_${helperOperation}_${cnxType}(${code}, ${operandCodes[index + 1]})`;
  });
  return code;
};

/**
 * Generate C code for an additive expression.
 * Issue #235: Includes constant folding for compile-time constant expressions.
 */
const generateAdditiveExpr = (
  node: Parser.AdditiveExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const exprs = node.multiplicativeExpression();

  if (exprs.length === 1) {
    return generateMultiplicativeExpr(exprs[0], input, state, orchestrator);
  }

  // Issue #152: Extract operators in order from parse tree children
  const operators = orchestrator.getOperatorsFromChildren(node);

  // Generate code for all operands
  const operandResults = exprs.map((expr) =>
    generateMultiplicativeExpr(expr, input, state, orchestrator),
  );
  const operandCodes = operandResults.map((r) => r.code);
  operandResults.forEach((r) => effects.push(...r.effects));

  // Issue #235: Try constant folding for compile-time constant expressions
  const foldedResult = BinaryExprUtils.tryFoldConstants(
    operandCodes,
    operators,
  );
  if (foldedResult !== undefined) {
    return { code: String(foldedResult), effects };
  }

  // Issue #1152: saturate when the operands are of a clamp integer type
  const clamped = tryClampOperands(node, operandCodes, operators, "+", effects);
  if (clamped !== null) {
    return { code: clamped, effects };
  }

  // Fall back to standard code generation
  let result = operandCodes[0];
  for (let i = 1; i < operandCodes.length; i++) {
    const op = operators[i - 1] || "+";
    result += ` ${op} ${operandCodes[i]}`;
  }

  return { code: result, effects };
};

/**
 * Generate C code for a multiplicative expression.
 * This is the bottom of the binary chain - delegates to unary via orchestrator.
 * Issue #235: Includes constant folding for compile-time constant expressions.
 */
const generateMultiplicativeExpr = (
  node: Parser.MultiplicativeExpressionContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const exprs = node.unaryExpression();

  if (exprs.length === 1) {
    // Delegate to orchestrator for unary expression
    // This allows CodeGenerator to handle unary until it's extracted
    return { code: orchestrator.generateUnaryExpr(exprs[0]), effects: [] };
  }

  // Issue #152: Extract operators in order from parse tree children
  const operators = orchestrator.getOperatorsFromChildren(node);

  // Generate code for all operands
  const operandCodes = exprs.map((expr) =>
    orchestrator.generateUnaryExpr(expr),
  );

  // Issue #235: Try constant folding for compile-time constant expressions
  const foldedResult = BinaryExprUtils.tryFoldConstants(
    operandCodes,
    operators,
  );
  if (foldedResult !== undefined) {
    return { code: String(foldedResult), effects: [] };
  }

  // Issue #1152: saturate when the operands are of a clamp integer type
  const effects: TGeneratorEffect[] = [];
  const clamped = tryClampOperands(node, operandCodes, operators, "*", effects);
  if (clamped !== null) {
    return { code: clamped, effects };
  }

  // Fall back to standard code generation
  let result = operandCodes[0];
  for (let i = 1; i < operandCodes.length; i++) {
    const op = operators[i - 1] || "*";
    result += ` ${op} ${operandCodes[i]}`;
  }

  return { code: result, effects: [] };
};

// Export all generators as a single object (lint requirement: no named exports)
const binaryExprGenerators = {
  generateOrExpr,
  generateAndExpr,
  generateEqualityExpr,
  generateRelationalExpr,
  generateBitwiseOrExpr,
  generateBitwiseXorExpr,
  generateBitwiseAndExpr,
  generateShiftExpr,
  generateAdditiveExpr,
  generateMultiplicativeExpr,
};

export default binaryExprGenerators;
