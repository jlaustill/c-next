/**
 * RegisterGenerator - ADR-004 Register Binding Generation
 *
 * Generates C #define macros from C-Next register declarations.
 * Registers map named memory locations to typed volatile pointers.
 *
 * Example:
 *   register GPIO7 @ 0x42004000 {
 *     ro u32 DR @ 0x00;
 *     wo u32 DR_SET @ 0x04;
 *   }
 *   ->
 *   // Register: GPIO7 @ 0x42004000
 *   #define GPIO7_DR (*(volatile uint32_t const *)(0x42004000 + 0x00))
 *   #define GPIO7_DR_SET (*(volatile uint32_t*)(0x42004000 + 0x04))
 */
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";

/**
 * Generate a #define macro for a single register member.
 * (Shared pattern with ScopedRegisterGenerator)
 */
function generateRegisterMemberDefine(
  fullName: string,
  member: Parser.RegisterMemberContext,
  baseAddress: string,
  orchestrator: IOrchestrator,
): string {
  const regName = member.IDENTIFIER().getText();
  const regType = orchestrator.generateType(member.type());
  const access = member.accessModifier().getText();
  const offset = orchestrator.generateExpression(member.expression());

  let cast = `volatile ${regType}*`;
  if (access === "ro") {
    cast = `volatile ${regType} const *`;
  }

  return `#define ${fullName}_${regName} (*(${cast})(${baseAddress} + ${offset}))`;
}

/**
 * Generate C #define macros from a C-Next register declaration.
 *
 * ADR-004: Registers provide hardware abstraction with access control.
 * Access modifiers: ro (read-only), wo (write-only), rw (read-write default)
 */
const generateRegister: TGeneratorFn<Parser.RegisterDeclarationContext> = (
  node: Parser.RegisterDeclarationContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const name = node.IDENTIFIER().getText();
  const baseAddress = orchestrator.generateExpression(node.expression());

  const lines: string[] = [];
  lines.push(`/* Register: ${name} @ ${baseAddress} */`);

  // Generate individual #define for each register member with its offset
  // This handles non-contiguous register layouts correctly (like i.MX RT1062)
  for (const member of node.registerMember()) {
    lines.push(
      generateRegisterMemberDefine(name, member, baseAddress, orchestrator),
    );
  }

  lines.push("");

  return {
    code: lines.join("\n"),
    effects: [],
  };
};

export default generateRegister;
