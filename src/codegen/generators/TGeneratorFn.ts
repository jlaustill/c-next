/**
 * Generator function signature.
 *
 * A pure function that transforms an AST node into generated code + effects.
 *
 * @param node - The AST node to generate code for
 * @param input - Read-only context (symbols, types, config)
 * @param state - Current generation state (scope, indent, etc.)
 * @param orchestrator - For delegating to other generators or utilities
 * @returns Generated code and any side effects
 */
import { ParserRuleContext } from "antlr4ng";
import IGeneratorInput from "./IGeneratorInput";
import IGeneratorState from "./IGeneratorState";
import IGeneratorOutput from "./IGeneratorOutput";
import IOrchestrator from "./IOrchestrator";

type TGeneratorFn<T extends ParserRuleContext> = (
  node: T,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
) => IGeneratorOutput;

export default TGeneratorFn;
