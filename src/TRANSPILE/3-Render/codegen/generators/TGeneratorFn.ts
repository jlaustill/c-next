/**
 * Generator function signature.
 *
 * A pure function that transforms one node of the program into generated code
 * + effects.
 *
 * `T` is deliberately UNCONSTRAINED. It was `T extends ParserRuleContext`,
 * which is exactly the coupling #1445 box 3 removes: a generator is a function
 * from "the thing being rendered" to text, and nothing about that requires the
 * thing to be a parse node. `generateEnum` and `generateBitmap` are the two
 * that need it -- both are `TGeneratorFn<string>`, because a declared NAME is
 * all either reads before looking the declaration up in `input.symbols`, and
 * the old constraint would have forbidden saying so. Dropping it is what lets
 * this module stop naming `antlr4ng` while the declaration generators that
 * still take a context keep working unchanged.
 *
 * `generateLiteral` is NOT the example here, though an earlier draft of this
 * comment named it: it left the family entirely, to `(text, state)`, and is
 * not assignable to `TGeneratorFn<string>` -- parameter 2 of this type is
 * `IGeneratorInput`. A reader who followed that example to
 * `invokeGenerator(generateLiteral, ...)` would get an error about
 * `IGeneratorInput` and `IGeneratorState`, which points at the arity rather
 * than at the type-parameter story the sentence was telling.
 *
 * **What the relaxation costs.** Two generators sharing `string` are mutually
 * substitutable at the type level, so a dispatch swap between the enum and the
 * bitmap compiles. That is the registry's erasure surviving in a narrower
 * form, and it is caught only by each generator's `invariant` on an unknown
 * key, at run time. See `CodeGenerator.invokeGenerator`.
 *
 * @param node - The node to generate code for
 * @param input - Read-only context (symbols, types, config)
 * @param state - Current generation state (scope, indent, etc.)
 * @param orchestrator - For delegating to other generators or utilities
 * @returns Generated code and any side effects
 */
import IGeneratorInput from "./IGeneratorInput";
import IGeneratorState from "./IGeneratorState";
import IGeneratorOutput from "./IGeneratorOutput";
import IOrchestrator from "./IOrchestrator";

type TGeneratorFn<T> = (
  node: T,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
) => IGeneratorOutput;

export default TGeneratorFn;
