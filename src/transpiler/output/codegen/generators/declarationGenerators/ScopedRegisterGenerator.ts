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
import QualifiedNameGenerator from "../../utils/QualifiedNameGenerator";

/**
 * Generate register macros with scope prefix.
 */
const generateScopedRegister = (
  node: Parser.RegisterDeclarationContext,
  declaringScopePath: string,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const name = node.IDENTIFIER().getText();
  const fullName = QualifiedNameGenerator.forMember(declaringScopePath, name); // Teensy4_GPIO7
  const baseAddress = orchestrator.generateExpression(node.expression());

  // No scoped-bitmap resolver here, deliberately. `orchestrator.generateType`
  // already applies ADR-057 qualification through the one TypeBinding ladder,
  // so a bare `Flags` inside `scope Chip` arrives as `Chip__Flags` and an
  // explicit `global.Flags` arrives as `Flags`.
  //
  // The resolver this replaced re-qualified that ALREADY-resolved name and
  // probed the re-qualified key first, which is the post-pass ADR-057 forbids:
  // by then `global.Flags` and a bare `Flags` are byte-identical, so a
  // scope-local `Chip__Flags` captured the global reference and the register
  // was typed with a bitmap whose bit names differ. Deleting it removes a
  // second qualification decision rather than patching both to agree, and the
  // scoped and unscoped register paths now share one macro generator with no
  // divergence to keep in step.
  const lines: string[] = [
    `/* Register: ${fullName} @ ${baseAddress} */`,
    ...generateRegisterMacros(
      node.registerMember(),
      fullName,
      baseAddress,
      orchestrator,
    ),
    "",
  ];

  return {
    code: lines.join("\n"),
    effects: [],
  };
};

export default generateScopedRegister;
