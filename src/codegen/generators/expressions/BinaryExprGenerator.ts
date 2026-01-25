/**
 * Binary Expression Generator (ADR-053 A2)
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
import * as Parser from "../../../antlr_parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";

/**
 * Issue #235: Try to parse a string as a numeric constant.
 * Returns the numeric value if it's a simple integer literal, undefined otherwise.
 * Handles decimal, hex (0x), and binary (0b) formats.
 */
const tryParseNumericLiteral = (code: string): number | undefined => {
  const trimmed = code.trim();

  // Decimal integer (including negative)
  if (/^-?\d+$/.exec(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // Hex literal
  if (/^0[xX][0-9a-fA-F]+$/.exec(trimmed)) {
    return parseInt(trimmed, 16);
  }

  // Binary literal
  if (/^0[bB][01]+$/.exec(trimmed)) {
    return parseInt(trimmed.substring(2), 2);
  }

  return undefined;
};

/**
 * Issue #235: Evaluate a constant arithmetic expression.
 * Returns the result if all operands are numeric and evaluation succeeds,
 * undefined otherwise (falls back to non-folded code).
 */
const tryFoldConstants = (
  operandCodes: string[],
  operators: string[],
): number | undefined => {
  // Parse all operands as numbers
  const values = operandCodes.map(tryParseNumericLiteral);

  // If any operand is not a constant, we can't fold
  if (values.some((v) => v === undefined)) {
    return undefined;
  }

  // Evaluate left-to-right with the operators
  let result = values[0] as number;
  for (let i = 0; i < operators.length; i++) {
    const op = operators[i];
    const rightValue = values[i + 1] as number;

    switch (op) {
      case "*":
        result = result * rightValue;
        break;
      case "/":
        // Avoid division by zero - let C compiler handle it
        if (rightValue === 0) {
          return undefined;
        }
        // Integer division (truncate toward zero like C)
        result = Math.trunc(result / rightValue);
        break;
      case "%":
        // Avoid modulo by zero
        if (rightValue === 0) {
          return undefined;
        }
        result = result % rightValue;
        break;
      case "+":
        result = result + rightValue;
        break;
      case "-":
        result = result - rightValue;
        break;
      default:
        // Unknown operator - don't fold
        return undefined;
    }
  }

  return result;
};

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

    // Check if comparing different enum types
    if (leftEnumType && rightEnumType && leftEnumType !== rightEnumType) {
      throw new Error(
        `Error: Cannot compare ${leftEnumType} enum to ${rightEnumType} enum`,
      );
    }

    // Check if comparing enum to integer
    if (leftEnumType && orchestrator.isIntegerExpression(exprs[1])) {
      throw new Error(`Error: Cannot compare ${leftEnumType} enum to integer`);
    }
    if (rightEnumType && orchestrator.isIntegerExpression(exprs[0])) {
      throw new Error(`Error: Cannot compare integer to ${rightEnumType} enum`);
    }

    // ADR-045: Check for string comparison
    const leftIsString = orchestrator.isStringExpression(exprs[0]);
    const rightIsString = orchestrator.isStringExpression(exprs[1]);

    if (leftIsString || rightIsString) {
      // Generate strcmp for string comparison - needs string.h
      effects.push({ type: "include", header: "string" });

      const leftResult = generateRelationalExpr(
        exprs[0],
        input,
        state,
        orchestrator,
      );
      const rightResult = generateRelationalExpr(
        exprs[1],
        input,
        state,
        orchestrator,
      );
      effects.push(...leftResult.effects, ...rightResult.effects);

      const fullText = node.getText();
      const isNotEqual = fullText.includes("!=");
      const cmpOp = isNotEqual ? "!= 0" : "== 0";

      return {
        code: `strcmp(${leftResult.code}, ${rightResult.code}) ${cmpOp}`,
        effects,
      };
    }
  }

  // Build the expression, transforming = to ==
  // Issue #152: Extract operators in order from parse tree children
  const operators = orchestrator.getOperatorsFromChildren(node);
  const firstResult = generateRelationalExpr(
    exprs[0],
    input,
    state,
    orchestrator,
  );
  effects.push(...firstResult.effects);
  let result = firstResult.code;

  for (let i = 1; i < exprs.length; i++) {
    // ADR-001: C-Next uses = for equality, transpile to ==
    // C-Next uses != for inequality, keep as !=
    const rawOp = operators[i - 1] || "=";
    const op = rawOp === "=" ? "==" : rawOp;

    const exprResult = generateRelationalExpr(
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
 * Generate C code for a relational expression.
 */
const generateRelationalExpr = (
  node: Parser.RelationalExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const exprs = node.bitwiseOrExpression();

  if (exprs.length === 1) {
    return generateBitwiseOrExpr(exprs[0], input, state, orchestrator);
  }

  // Issue #152: Extract operators in order from parse tree children
  const operators = orchestrator.getOperatorsFromChildren(node);
  const firstResult = generateBitwiseOrExpr(
    exprs[0],
    input,
    state,
    orchestrator,
  );
  effects.push(...firstResult.effects);
  let result = firstResult.code;

  for (let i = 1; i < exprs.length; i++) {
    const op = operators[i - 1] || "<";
    const exprResult = generateBitwiseOrExpr(
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
  const foldedResult = tryFoldConstants(operandCodes, operators);
  if (foldedResult !== undefined) {
    return { code: String(foldedResult), effects };
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
  const foldedResult = tryFoldConstants(operandCodes, operators);
  if (foldedResult !== undefined) {
    return { code: String(foldedResult), effects: [] };
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
