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
import IGeneratorOutput from "../IGeneratorOutput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import RegisterHelper from "./RegisterHelper";

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
    let regType = orchestrator.generateType(member.type());

    // Check if the type is a scoped bitmap (e.g., GPIO7Pins -> Teensy4_GPIO7Pins)
    const scopedTypeName = `${scopeName}_${regType}`;
    if (input.symbols?.knownBitmaps.has(scopedTypeName)) {
      regType = scopedTypeName;
    }

    lines.push(
      RegisterHelper.generateMemberDefine(
        fullName,
        member,
        regType,
        baseAddress,
        orchestrator,
      ),
    );
  }

  return RegisterHelper.buildOutput(lines);
};

export default generateScopedRegister;
