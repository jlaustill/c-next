/**
 * Output from every generator function.
 * Contains the generated code and any side effects.
 */
import TGeneratorEffect from "./TGeneratorEffect";

interface IGeneratorOutput {
  /** The generated C code */
  readonly code: string;

  /** Side effects to be processed by the orchestrator */
  readonly effects: readonly TGeneratorEffect[];
}

export default IGeneratorOutput;
