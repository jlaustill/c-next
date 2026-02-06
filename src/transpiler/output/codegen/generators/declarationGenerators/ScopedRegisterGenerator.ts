/**
 * ScopedRegisterGenerator - ADR-004 Scoped Register Generation
 *
 * Generates C #define macros from C-Next register declarations within scopes.
 *
 * Example:
 *   scope Teensy4 { register GPIO7 @ 0x42004000 { ... } }
 *   ->
 *   #define Teensy4_GPIO7_DR (*(volatile uint32_t*)(0x42004000 + 0x00))
 */
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";

/**
 * Generate a #define macro for a single register member.
 * (Shared pattern with RegisterGenerator)
 */
function generateRegisterMemberDefine(
  fullName: string,
  member: Parser.RegisterMemberContext,
  baseAddress: string,
  orchestrator: IOrchestrator,
  resolveType?: (typeName: string) => string,
): string {
  const regName = member.IDENTIFIER().getText();
  let regType = orchestrator.generateType(member.type());
  const access = member.accessModifier().getText();
  const offset = orchestrator.generateExpression(member.expression());

  if (resolveType) {
    regType = resolveType(regType);
  }

  let cast = `volatile ${regType}*`;
  if (access === "ro") {
    cast = `volatile ${regType} const *`;
  }

  return `#define ${fullName}_${regName} (*(${cast})(${baseAddress} + ${offset}))`;
}

/**
 * Generate register macros with scope prefix.
 */
const generateScopedRegister = (
  node: Parser.RegisterDeclarationContext,
  scopeName: string,
  input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const name = node.IDENTIFIER().getText();
  const fullName = `${scopeName}_${name}`; // Teensy4_GPIO7
  const baseAddress = orchestrator.generateExpression(node.expression());

  const lines: string[] = [];
  lines.push(`/* Register: ${fullName} @ ${baseAddress} */`);

  // Generate individual #define for each register member with its offset
  for (const member of node.registerMember()) {
    // Resolve scoped bitmap types (e.g., GPIO7Pins -> Teensy4_GPIO7Pins)
    const resolveType = (typeName: string): string => {
      const scopedTypeName = `${scopeName}_${typeName}`;
      if (input.symbols?.knownBitmaps.has(scopedTypeName)) {
        return scopedTypeName;
      }
      return typeName;
    };

    lines.push(
      generateRegisterMemberDefine(
        fullName,
        member,
        baseAddress,
        orchestrator,
        resolveType,
      ),
    );
  }

  lines.push("");

  return {
    code: lines.join("\n"),
    effects: [],
  };
};

export default generateScopedRegister;
