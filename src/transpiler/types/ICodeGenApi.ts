/**
 * Interface for CodeGenerator methods accessible via CodeGenState.generator.
 *
 * Defines the subset of CodeGenerator methods needed by assignment handlers.
 * Handlers cast CodeGenState.generator to this interface.
 */
import type TTypeInfo from "./TTypeInfo";
import type RenderState from "../state/RenderState";

interface ICodeGenApi {
  /**
   * 2.3 Render's per-file working state (#1452 box 4).
   *
   * Handlers reach it through the orchestrator they were already given,
   * rather than through a static class. The remaining ambient hop is
   * `CodeGenState.generator` itself, which dissolves with the rest.
   */
  readonly state: RenderState;

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
