/**
 * A callback typedef a generated header owns, in the shape the header
 * generator consumes (ADR-029 Function-as-Type, issue #1164).
 *
 * Extracted from an inline anonymous type in `IHeaderTypeInput.callbackTypes`
 * (CLAUDE.md: two interfaces needing the same fields extract a shared type)
 * when `Transpiler._buildCallbackTypesForHeader()` needed the identical shape
 * -- it had its own inline copy that had drifted narrower (2 fields per
 * parameter instead of 6), a divergence TypeScript did not catch because the
 * wider object it actually built was assigned through a `.map()` call rather
 * than as a literal at the declaration site.
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
