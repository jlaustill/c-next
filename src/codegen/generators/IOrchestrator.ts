/**
 * Interface that CodeGenerator implements to orchestrate generators.
 *
 * Provides:
 * - Access to read-only input and current state
 * - Effect processing to update mutable state
 * - Utility methods needed by generators
 *
 * This abstraction enables:
 * - Testing generators with mock orchestrators
 * - Gradual migration via "strangler fig" pattern
 */
import IGeneratorInput from "./IGeneratorInput";
import IGeneratorState from "./IGeneratorState";
import TGeneratorEffect from "./TGeneratorEffect";

interface IOrchestrator {
  // === State Access ===

  /** Get the immutable input context */
  getInput(): IGeneratorInput;

  /** Get a snapshot of the current generation state */
  getState(): IGeneratorState;

  // === Effect Processing ===

  /** Process effects returned by a generator, updating internal state */
  applyEffects(effects: readonly TGeneratorEffect[]): void;

  // === Utilities ===

  /** Get the current indentation string */
  getIndent(): string;

  /** Resolve an identifier to its fully-scoped name */
  resolveIdentifier(name: string): string;
}

export default IOrchestrator;
