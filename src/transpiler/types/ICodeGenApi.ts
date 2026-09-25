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
import type TTypeInfo from "./TTypeInfo";

interface ICodeGenApi {
  /** Generate atomic read-modify-write operation */
  generateAtomicRMW(
    target: string,
    op: string,
    value: string,
    typeInfo: TTypeInfo,
  ): string;

  /** Generate float bit write operation (returns null if not applicable) */
  generateFloatBitWrite(
    name: string,
    typeInfo: TTypeInfo,
    bitIndex: string,
    width: string | null,
    value: string,
  ): string | null;

  /** Get type info for struct member */
  getMemberTypeInfo(structType: string, fieldName: string): TTypeInfo | null;

  /** Check if name is a known scope */
  isKnownScope(name: string): boolean;

  /** Check if name is a known struct */
  isKnownStruct(name: string): boolean;
}

export default ICodeGenApi;
