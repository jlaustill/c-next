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
import generateRegisterMacros from "./RegisterMacroGenerator";

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

  // Type resolver for scoped bitmaps (e.g., GPIO7Pins -> Teensy4_GPIO7Pins)
  const resolveType = (regType: string): string | undefined => {
    const scopedTypeName = `${scopeName}_${regType}`;
    return input.symbols?.knownBitmaps.has(scopedTypeName)
      ? scopedTypeName
      : undefined;
  };

  const lines: string[] = [
    `/* Register: ${fullName} @ ${baseAddress} */`,
    ...generateRegisterMacros(
      node.registerMember(),
      fullName,
      baseAddress,
      orchestrator,
      resolveType,
    ),
    "",
  ];

  return {
    code: lines.join("\n"),
    effects: [],
  };
};

export default generateScopedRegister;
