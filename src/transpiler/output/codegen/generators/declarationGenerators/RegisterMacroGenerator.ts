/**
 * RegisterMacroGenerator - Shared logic for register #define macro generation
 *
 * Extracts common logic from RegisterGenerator and ScopedRegisterGenerator
 * for generating C #define macros from C-Next register members.
 */
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import IOrchestrator from "../IOrchestrator";

/**
 * Optional type resolver for scoped types.
 * Returns resolved type name if found, undefined to use original type.
 */
type TTypeResolver = (originalType: string) => string | undefined;

/**
 * Generate #define macros for register members.
 *
 * @param members - Register member declarations from AST
 * @param prefix - Prefix for macro names (e.g., "GPIO7" or "Teensy4_GPIO7")
 * @param baseAddress - Base address expression string
 * @param orchestrator - Code generation orchestrator
 * @param typeResolver - Optional callback to resolve scoped types
 * @returns Array of #define lines
 */
function generateRegisterMacros(
  members: Parser.RegisterMemberContext[],
  prefix: string,
  baseAddress: string,
  orchestrator: IOrchestrator,
  typeResolver?: TTypeResolver,
): string[] {
  const lines: string[] = [];

  for (const member of members) {
    const regName = member.IDENTIFIER().getText();
    let regType = orchestrator.generateType(member.type());
    const access = member.accessModifier().getText();
    const offset = orchestrator.generateExpression(member.expression());

    // Apply optional type resolution (for scoped bitmaps)
    if (typeResolver) {
      const resolved = typeResolver(regType);
      if (resolved) {
        regType = resolved;
      }
    }

    // Determine qualifiers based on access mode
    let cast = `volatile ${regType}*`;
    if (access === "ro") {
      cast = `volatile ${regType} const *`;
    }

    // Generate: #define PREFIX_REGNAME (*(volatile type*)(base + offset))
    lines.push(
      `#define ${prefix}_${regName} (*(${cast})(${baseAddress} + ${offset}))`,
    );
  }

  return lines;
}

export default generateRegisterMacros;
