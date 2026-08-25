/**
 * One parameter of an ADR-029 callback typedef, as both the `.c` and the `.h`
 * need to see it.
 *
 * The two files used to format this from separate data: the header was handed
 * only `{ type, isStruct }`, so it dropped `const` and array dimensions and
 * declared a typedef the implementation contradicted (#1164).
 */
interface ICallbackTypedefParameter {
  readonly type: string;
  readonly isStruct: boolean;
  readonly isConst?: boolean;
  readonly isArray?: boolean;
  readonly arrayDims?: string;
  readonly name?: string;
}

export default ICallbackTypedefParameter;
