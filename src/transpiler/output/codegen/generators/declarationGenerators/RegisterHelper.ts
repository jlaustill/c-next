/**
 * RegisterHelper - Shared utilities for register generation
 *
 * Extracts common logic between RegisterGenerator and ScopedRegisterGenerator
 * to reduce code duplication.
 */
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import IOrchestrator from "../IOrchestrator";
import IGeneratorOutput from "../IGeneratorOutput";

/**
 * Generate a single register member #define macro.
 *
 * @param fullName - Base name for the register (e.g., "GPIO7" or "Teensy4_GPIO7")
 * @param member - Register member parse context
 * @param regType - Resolved C type for the register
 * @param baseAddress - Base address expression
 * @param orchestrator - Code generator orchestrator
 * @returns The #define line
 */
function generateRegisterMemberDefine(
  fullName: string,
  member: Parser.RegisterMemberContext,
  regType: string,
  baseAddress: string,
  orchestrator: IOrchestrator,
): string {
  const regName = member.IDENTIFIER().getText();
  const access = member.accessModifier().getText();
  const offset = orchestrator.generateExpression(member.expression());

  // Determine qualifiers based on access mode
  let cast = `volatile ${regType}*`;
  if (access === "ro") {
    cast = `volatile ${regType} const *`;
  }

  return `#define ${fullName}_${regName} (*(${cast})(${baseAddress} + ${offset}))`;
}

/**
 * Build the standard return output for register generators.
 */
function buildRegisterOutput(lines: string[]): IGeneratorOutput {
  lines.push("");
  return {
    code: lines.join("\n"),
    effects: [],
  };
}

/**
 * Static utility class for register generation helpers.
 */
class RegisterHelper {
  static generateMemberDefine = generateRegisterMemberDefine;
  static buildOutput = buildRegisterOutput;
}

export default RegisterHelper;
