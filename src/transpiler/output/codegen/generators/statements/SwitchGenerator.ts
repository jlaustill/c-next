/**
 * Switch Statement Generators (ADR-053 A3)
 *
 * Generates C code for switch statements (ADR-025):
 * - switch statement dispatch
 * - case labels (including fall-through with ||)
 * - default case
 */
import {
  SwitchStatementContext,
  SwitchCaseContext,
  CaseLabelContext,
  DefaultCaseContext,
  BlockContext,
} from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";

/**
 * Generate case/default block body: statements + break + closing brace.
 */
function generateCaseBlockBody(
  block: BlockContext,
  lines: string[],
  orchestrator: IOrchestrator,
): void {
  const statements = block.statement();
  for (const stmt of statements) {
    const stmtCode = orchestrator.generateStatement(stmt);
    if (stmtCode) {
      lines.push(orchestrator.indent(orchestrator.indent(stmtCode)));
    }
  }

  lines.push(
    orchestrator.indent(orchestrator.indent("break;")),
    orchestrator.indent("}"),
  );
}

/**
 * Check if minus token is the first child (for negative literals).
 */
function hasNegativePrefix(node: CaseLabelContext): boolean {
  return node.children !== null && node.children[0]?.getText() === "-";
}

/**
 * Issue #471: Try to resolve an unqualified identifier as an enum member.
 * Returns the prefixed enum member if found, null otherwise.
 */
function tryResolveEnumMember(
  id: string,
  switchEnumType: string,
  symbols: IGeneratorInput["symbols"],
): string | null {
  if (!symbols) return null;
  const members = symbols.enumMembers.get(switchEnumType);
  return members?.has(id) ? `${switchEnumType}_${id}` : null;
}

/**
 * Issue #477: Check if identifier matches any enum member when switch is not on enum.
 * Throws error with helpful suggestion if found.
 */
function rejectUnqualifiedEnumMember(
  id: string,
  symbols: IGeneratorInput["symbols"],
  node: CaseLabelContext,
): void {
  if (!symbols) return;

  const matchingEnums: string[] = [];
  for (const [enumName, members] of symbols.enumMembers) {
    if (members.has(id)) {
      matchingEnums.push(enumName);
    }
  }

  if (matchingEnums.length === 0) return;

  const suggestion =
    matchingEnums.length === 1
      ? `did you mean '${matchingEnums[0]}.${id}'?`
      : `exists in: ${matchingEnums.join(", ")}. Use qualified access.`;
  const line = node.start?.line ?? 0;
  const col = node.start?.column ?? 0;
  throw new Error(
    `${line}:${col} error[E0424]: '${id}' is not defined; ${suggestion}`,
  );
}

/**
 * Generate code for a binary literal case label.
 * Converts binary to hex for cleaner C output.
 */
function generateBinaryLiteralCode(binText: string, hasNeg: boolean): string {
  // Issue #114: Use BigInt to preserve precision for values > 2^53
  const value = BigInt(binText); // BigInt handles 0b prefix natively
  const hexStr = value.toString(16).toUpperCase();
  // Add ULL suffix for values that exceed 32-bit range
  const suffix = value > 0xffffffffn ? "ULL" : "";
  return `${hasNeg ? "-" : ""}0x${hexStr}${suffix}`;
}

/**
 * Generate code for qualified type case label (e.g., EState.IDLE → EState_IDLE).
 * SonarCloud S3776: Extracted from generateCaseLabel().
 */
function generateQualifiedTypeLabel(node: CaseLabelContext): string | null {
  const qt = node.qualifiedType();
  if (!qt) return null;
  const parts = qt.IDENTIFIER();
  return parts.map((id) => id.getText()).join("_");
}

/**
 * Generate code for identifier case label (const or enum member).
 * SonarCloud S3776: Extracted from generateCaseLabel().
 */
function generateIdentifierLabel(
  node: CaseLabelContext,
  input: IGeneratorInput,
  switchEnumType?: string,
): string | null {
  const idNode = node.IDENTIFIER();
  if (!idNode) return null;

  const id = idNode.getText();

  // Issue #471: Resolve unqualified enum member with type prefix
  if (switchEnumType) {
    const resolved = tryResolveEnumMember(id, switchEnumType, input.symbols);
    if (resolved) return resolved;
  } else {
    // Issue #477: Reject unqualified enum members in non-enum switch context
    rejectUnqualifiedEnumMember(id, input.symbols, node);
  }

  return id;
}

/**
 * Generate code for numeric literal case labels.
 * SonarCloud S3776: Extracted from generateCaseLabel().
 */
function generateNumericLabel(node: CaseLabelContext): string | null {
  const hasNeg = hasNegativePrefix(node);

  if (node.INTEGER_LITERAL()) {
    const num = node.INTEGER_LITERAL()!.getText();
    return hasNeg ? `-${num}` : num;
  }

  if (node.HEX_LITERAL()) {
    const hex = node.HEX_LITERAL()!.getText();
    return hasNeg ? `-${hex}` : hex;
  }

  if (node.BINARY_LITERAL()) {
    const binText = node.BINARY_LITERAL()!.getText();
    return generateBinaryLiteralCode(binText, hasNeg);
  }

  if (node.CHAR_LITERAL()) {
    return node.CHAR_LITERAL()!.getText();
  }

  return null;
}

/**
 * Generate C code for a case label.
 *
 * Handles:
 * - Qualified types (EState.IDLE → EState_IDLE)
 * - Plain identifiers (including unqualified enum members)
 * - Integer literals (with optional minus)
 * - Hex literals
 * - Binary literals (converted to hex)
 * - Character literals
 *
 * Issue #471: When switchEnumType is provided, unqualified identifiers that are
 * members of that enum are resolved with the enum type prefix.
 * SonarCloud S3776: Refactored to use helper functions.
 */
const generateCaseLabel = (
  node: CaseLabelContext,
  input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
  switchEnumType?: string,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // qualifiedType - for enum values like EState.IDLE
  const qualifiedCode = generateQualifiedTypeLabel(node);
  if (qualifiedCode !== null) {
    return { code: qualifiedCode, effects };
  }

  // IDENTIFIER - const variable or plain enum member
  const identifierCode = generateIdentifierLabel(node, input, switchEnumType);
  if (identifierCode !== null) {
    return { code: identifierCode, effects };
  }

  // Numeric literals
  const numericCode = generateNumericLabel(node);
  if (numericCode !== null) {
    return { code: numericCode, effects };
  }

  return { code: "", effects };
};

/**
 * Generate C code for a switch case.
 *
 * Handles multiple labels (|| expansion) and generates proper indentation.
 *
 * Issue #471: switchEnumType is passed to case label generation for
 * resolving unqualified enum members.
 */
const generateSwitchCase = (
  node: SwitchCaseContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  switchEnumType?: string,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const labels = node.caseLabel();
  const block = node.block();
  const lines: string[] = [];

  // Generate case labels - expand || to multiple C case labels
  for (let i = 0; i < labels.length; i++) {
    const labelResult = generateCaseLabel(
      labels[i],
      input,
      state,
      orchestrator,
      switchEnumType,
    );
    effects.push(...labelResult.effects);

    if (i < labels.length - 1) {
      // Multiple labels: just the label without body
      lines.push(orchestrator.indent(`case ${labelResult.code}:`));
    } else {
      // Last label: attach the block
      lines.push(orchestrator.indent(`case ${labelResult.code}: {`));
    }
  }

  // Generate block contents (without the outer braces - we added them above)
  generateCaseBlockBody(block, lines, orchestrator);

  return { code: lines.join("\n"), effects };
};

/**
 * Generate C code for a default case.
 */
const generateDefaultCase = (
  node: DefaultCaseContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const block = node.block();
  const lines: string[] = [];

  // Note: default(n) count is for compile-time validation only,
  // not included in generated C
  lines.push(orchestrator.indent("default: {"));

  // Generate block contents
  generateCaseBlockBody(block, lines, orchestrator);

  return { code: lines.join("\n"), effects };
};

/**
 * Generate C code for a switch statement (ADR-025).
 *
 * Issue #471: Determines the enum type of the switch expression and passes
 * it to case generation for resolving unqualified enum members.
 */
const generateSwitch = (
  node: SwitchStatementContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const switchExpr = node.expression();
  const exprCode = orchestrator.generateExpression(switchExpr);

  // ADR-025: Semantic validation
  orchestrator.validateSwitchStatement(node, switchExpr);

  // Issue #471: Get the enum type of the switch expression for case label resolution
  const switchEnumType = orchestrator.getExpressionEnumType(switchExpr);

  // Build the switch statement
  const lines: string[] = [`switch (${exprCode}) {`];

  // Generate cases
  for (const caseCtx of node.switchCase()) {
    const caseResult = generateSwitchCase(
      caseCtx,
      input,
      state,
      orchestrator,
      switchEnumType ?? undefined,
    );
    lines.push(caseResult.code);
    effects.push(...caseResult.effects);
  }

  // Generate default case
  const defaultCtx = node.defaultCase();
  if (defaultCtx) {
    // Explicit default from source
    const defaultResult = generateDefaultCase(
      defaultCtx,
      input,
      state,
      orchestrator,
    );
    lines.push(defaultResult.code);
    effects.push(...defaultResult.effects);
  } else {
    // Issue #855: MISRA C:2012 Rule 16.4 - every switch shall have a default
    // Generate empty default case for compliance
    lines.push(orchestrator.indent("default: {"));
    lines.push(orchestrator.indent(orchestrator.indent("break;")));
    lines.push(orchestrator.indent("}"));
  }

  lines.push("}");

  return { code: lines.join("\n"), effects };
};

// Export all switch generators
const switchGenerators = {
  generateSwitch,
  generateSwitchCase,
  generateCaseLabel,
  generateDefaultCase,
};

export default switchGenerators;
