/**
 * A callback typedef a generated header owns, in the shape the header
 * generator consumes (ADR-029 Function-as-Type, issue #1164).
 *
 * Extracted from an inline anonymous type in `IHeaderTypeInput.callbackTypes`
 * (CLAUDE.md: two interfaces needing the same fields extract a shared type)
 * when `IHeaderEmissionFacts.callbackTypesForHeader` needed the identical shape.
 */
interface IHeaderCallbackType {
  readonly typedefName: string;
  readonly returnType: string;
  readonly parameters: ReadonlyArray<{
    readonly type: string;
    readonly isStruct: boolean;
    readonly isConst?: boolean;
    readonly isArray?: boolean;
    readonly arrayDims?: string;
    readonly name?: string;
  }>;
}

export default IHeaderCallbackType;
