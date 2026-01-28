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
} from "../../../antlr_parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";

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
  if (node.qualifiedType()) {
    const qt = node.qualifiedType()!;
    // Convert EState.IDLE to EState_IDLE for C
    const parts = qt.IDENTIFIER();
    return { code: parts.map((id) => id.getText()).join("_"), effects };
  }

  // IDENTIFIER - const variable or plain enum member
  if (node.IDENTIFIER()) {
    const id = node.IDENTIFIER()!.getText();

    // Issue #471: Resolve unqualified enum member with type prefix
    // If the switch expression is an enum type, check if this identifier
    // is a member of that enum and prefix it accordingly
    if (switchEnumType && input.symbols) {
      const members = input.symbols.enumMembers.get(switchEnumType);
      if (members && members.has(id)) {
        return { code: `${switchEnumType}_${id}`, effects };
      }
    }

    // Issue #477: Reject unqualified enum members in non-enum switch context
    // If switchEnumType is null (switching on non-enum like u8), but the
    // identifier is an enum member, this is an error.
    if (!switchEnumType && input.symbols) {
      const matchingEnums: string[] = [];
      for (const [enumName, members] of input.symbols.enumMembers) {
        if (members.has(id)) {
          matchingEnums.push(enumName);
        }
      }
      if (matchingEnums.length > 0) {
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
    }

    return { code: id, effects };
  }

  // Numeric literals (may have optional minus prefix)
  if (node.INTEGER_LITERAL()) {
    const num = node.INTEGER_LITERAL()!.getText();
    // Check if minus token exists (first child would be '-')
    const hasNeg = node.children && node.children[0]?.getText() === "-";
    return { code: hasNeg ? `-${num}` : num, effects };
  }

  if (node.HEX_LITERAL()) {
    const hex = node.HEX_LITERAL()!.getText();
    // Check if minus token exists (first child would be '-')
    const hasNeg = node.children && node.children[0]?.getText() === "-";
    return { code: hasNeg ? `-${hex}` : hex, effects };
  }

  if (node.BINARY_LITERAL()) {
    // Convert binary to hex for cleaner C output
    // Issue #114: Use BigInt to preserve precision for values > 2^53
    const binText = node.BINARY_LITERAL()!.getText();
    // Check if minus token exists (first child would be '-')
    const hasNeg = node.children && node.children[0]?.getText() === "-";
    const value = BigInt(binText); // BigInt handles 0b prefix natively
    const hexStr = (hasNeg ? -value : value).toString(16).toUpperCase();
    // Add ULL suffix for values that exceed 32-bit range
    const needsULL = value > 0xffffffffn;
    return {
      code: `${hasNeg ? "-" : ""}0x${hexStr}${needsULL ? "ULL" : ""}`,
      effects,
    };
  }

  if (node.CHAR_LITERAL()) {
    return { code: node.CHAR_LITERAL()!.getText(), effects };
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
  const statements = block.statement();
  for (const stmt of statements) {
    const stmtCode = orchestrator.generateStatement(stmt);
    if (stmtCode) {
      lines.push(orchestrator.indent(orchestrator.indent(stmtCode)));
    }
  }

  // Add break and close block
  lines.push(orchestrator.indent(orchestrator.indent("break;")));
  lines.push(orchestrator.indent("}"));

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
  const statements = block.statement();
  for (const stmt of statements) {
    const stmtCode = orchestrator.generateStatement(stmt);
    if (stmtCode) {
      lines.push(orchestrator.indent(orchestrator.indent(stmtCode)));
    }
  }

  // Add break and close block
  lines.push(orchestrator.indent(orchestrator.indent("break;")));
  lines.push(orchestrator.indent("}"));

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

  // Generate default if present
  const defaultCtx = node.defaultCase();
  if (defaultCtx) {
    const defaultResult = generateDefaultCase(
      defaultCtx,
      input,
      state,
      orchestrator,
    );
    lines.push(defaultResult.code);
    effects.push(...defaultResult.effects);
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
