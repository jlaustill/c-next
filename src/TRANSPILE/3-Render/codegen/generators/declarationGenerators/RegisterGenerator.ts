/**
 * RegisterGenerator - ADR-004 Register Binding Generation
 *
 * Generates C #define macros from C-Next register declarations, at file scope
 * or inside a scope.
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
 *
 * ## One generator, parameterized by scope
 *
 * #1445: there were two, `generateRegister` and `generateScopedRegister`, and
 * they were the same function. The only difference was the prefix -- the bare
 * name at file scope, `QualifiedNameGenerator.forMember(path, name)` inside a
 * scope -- and `forMember("", name)` returns `name`, so the file-scope case IS
 * the scoped case with an empty path (verified: `qualifyInScope("GPIO7", "")`
 * -> `"GPIO7"`). Two spellings of one decision that had to be kept in step by
 * hand is the duplicate-path shape CLAUDE.md names, and the scoped file's own
 * comment already claimed the two paths "share one macro generator with no
 * divergence to keep in step" -- true of the macros, not of the wrapper around
 * them.
 */
import * as Parser from "../../../../../transpiler/logic/parser/grammar/CNextParser";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import IPlannedRegisterMember from "../../../../../transpiler/types/IPlannedRegisterMember";
import type TRegisterAccessMode from "../../../../../transpiler/types/TRegisterAccessMode";
import TGeneratorFn from "../TGeneratorFn";
import generateRegisterMacros from "./RegisterMacroGenerator";
import RegisterBlockPlacement from "./RegisterBlockPlacement";
import QualifiedNameGenerator from "../../utils/QualifiedNameGenerator";

/**
 * Decide what each member's `#define` needs, so the formatter takes no nodes.
 *
 * No scoped-bitmap resolver here, deliberately. `orchestrator.generateType`
 * already applies ADR-057 qualification through the one TypeBinding ladder, so
 * a bare `Flags` inside `scope Chip` arrives as `Chip__Flags` and an explicit
 * `global.Flags` arrives as `Flags`.
 *
 * A resolver on the scoped path used to re-qualify that ALREADY-resolved name
 * and probe the re-qualified key first, which is the post-pass ADR-057
 * forbids: by then `global.Flags` and a bare `Flags` are byte-identical, so a
 * scope-local `Chip__Flags` captured the global reference and the register was
 * typed with a bitmap whose bit names differ. It was deleted before this
 * function existed (#1472); the note stays because "do not re-qualify" is the
 * rule this function has to keep, not a change it made.
 *
 * `cType` and `offset` are bound to locals rather than written inline in the
 * literal: both call the orchestrator, which registers effects on
 * `CodeGenState`, so written inline their order would be pinned by the order
 * the four FIELDS happen to appear -- and re-sorting an object literal reads
 * as cosmetic.
 */
function planMembers(
  members: readonly Parser.RegisterMemberContext[],
  orchestrator: IOrchestrator,
): IPlannedRegisterMember[] {
  return members.map((member) => {
    const cType = orchestrator.generateType(member.type());
    const offset = orchestrator.generateExpression(member.expression());
    return {
      name: member.IDENTIFIER().getText(),
      cType,
      access: member.accessModifier().getText() as TRegisterAccessMode,
      offset,
    };
  });
}

/**
 * Generate C #define macros from a C-Next register declaration.
 *
 * ADR-004: Registers provide hardware abstraction with access control.
 * Access modifiers: ro (read-only), wo (write-only), rw (read-write default)
 *
 * @param declaringScopePath the enclosing scope's path, `""` at file scope
 */
const registerGeneratorFor =
  (
    declaringScopePath: string,
  ): TGeneratorFn<Parser.RegisterDeclarationContext> =>
  (
    node: Parser.RegisterDeclarationContext,
    _input: IGeneratorInput,
    _state: IGeneratorState,
    orchestrator: IOrchestrator,
  ): IGeneratorOutput => {
    const fullName = QualifiedNameGenerator.forMember(
      declaringScopePath,
      node.IDENTIFIER().getText(),
    );
    const baseAddress = orchestrator.generateExpression(node.expression());

    const lines: string[] = [
      `/* Register: ${fullName} @ ${baseAddress} */`,
      ...generateRegisterMacros(
        planMembers(node.registerMember(), orchestrator),
        fullName,
        baseAddress,
      ),
      "",
    ];

    return {
      code: RegisterBlockPlacement.place(fullName, lines.join("\n")),
      effects: [],
    };
  };

export default registerGeneratorFor;
