/**
 * RegisterMacroGenerator - Shared logic for register #define macro generation
 *
 * Extracts common logic from RegisterGenerator and ScopedRegisterGenerator
 * for generating C #define macros from C-Next register members.
 */
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import IOrchestrator from "../IOrchestrator";
import QualifiedCName from "../../../../../utils/QualifiedCName";

/**
 * Generate #define macros for register members.
 *
 * @param members - Register member declarations from AST
 * @param prefix - Prefix for macro names (e.g., "GPIO7" or "Teensy4_GPIO7")
 * @param baseAddress - Base address expression string
 * @param orchestrator - Code generation orchestrator
 * @returns Array of #define lines
 */
function generateRegisterMacros(
  members: Parser.RegisterMemberContext[],
  prefix: string,
  baseAddress: string,
  orchestrator: IOrchestrator,
): string[] {
  const lines: string[] = [];

  for (const member of members) {
    const regName = member.IDENTIFIER().getText();
    // `generateType` is the single ADR-057 resolution point for this name: it
    // qualifies a bare `Flags` to the enclosing scope's bitmap when one exists
    // and leaves an explicit `global.Flags` alone. Nothing may re-qualify the
    // result -- a scoped caller used to, and captured the `global.` form.
    const regType = orchestrator.generateType(member.type());
    const access = member.accessModifier().getText();
    const offset = orchestrator.generateExpression(member.expression());

    // Determine qualifiers based on access mode
    let cast = `volatile ${regType}*`;
    if (access === "ro") {
      cast = `volatile ${regType} const *`;
    }

    // Generate: #define PREFIX_REGNAME (*(volatile type*)(base + offset))
    lines.push(
      `#define ${QualifiedCName.fromParts([prefix, regName])} (*(${cast})(${baseAddress} + ${offset}))`,
    );
  }

  return lines;
}

export default generateRegisterMacros;
