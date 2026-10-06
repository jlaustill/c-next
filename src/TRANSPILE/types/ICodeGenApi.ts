/**
 * Interface for CodeGenerator methods accessible via the render state's
 * `generator` slot.
 *
 * Defines the subset of CodeGenerator methods needed by assignment handlers.
 *
 * #1452 box 4: this carried a `state` member for one revision and NOTHING read
 * it -- handlers reach the state through `IAssignmentContext.state` and
 * generators through `IOrchestrator.state`, both of which the caller already
 * holds. It also closed a cycle, because the state holds a `generator` of this
 * type, so the two modules imported each other. A member that no caller needs
 * is not a channel; it is a second way to ask, which is what this card removes.
 */
import type IFloatBitWrite from "../../types/IFloatBitWrite";
import type TTypeInfo from "../../types/TTypeInfo";

interface ICodeGenApi {
  /**
   * Generate atomic read-modify-write operation. `clampOp` is the ADR-044
   * helper the inner operation saturates with, or null for plain arithmetic.
   */
  generateAtomicRMW(
    target: string,
    op: string,
    value: string,
    typeInfo: TTypeInfo,
    clampOp: string | null,
  ): string;

  /** Generate a float bit write through a union (ADR-007) */
  generateFloatBitWrite(bitWrite: IFloatBitWrite): string;

  /** Check if name is a known scope */
  isKnownScope(name: string): boolean;

  /** Check if name is a known struct */
  isKnownStruct(name: string): boolean;
}

export default ICodeGenApi;
