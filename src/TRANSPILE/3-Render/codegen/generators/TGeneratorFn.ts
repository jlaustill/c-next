/**
 * Generator function signature.
 *
 * A pure function that transforms one node of the program into generated code
 * + effects.
 *
 * `T` is deliberately UNCONSTRAINED. It was `T extends ParserRuleContext`,
 * which is exactly the coupling #1445 box 3 removes: a generator is a function
 * from "the thing being rendered" to text, and nothing about that requires the
 * thing to be a parse node. `generateLiteral` already takes a `string` -- the
 * literal's text is its whole IR -- and the old constraint would have forbidden
 * saying so. Dropping it is what lets this module stop naming `antlr4ng` while
 * the six declaration generators that use it as their signature keep working
 * unchanged.
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
