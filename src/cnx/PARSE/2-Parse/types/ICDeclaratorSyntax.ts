import type IExtractedParameter from "../shared/IExtractedParameter";

/** A declarator, as 1.3 reads it: its name and what it adds to the type */
interface ICDeclaratorSyntax {
  readonly name: string | null;
  /** A parameter list follows the name: a function or a function pointer */
  readonly isFunction: boolean;
  /** A `pointer` is spelled before the name (`*`, or clang's `^`) */
  readonly hasPointer: boolean;
  /** How many `*` that pointer spells */
  readonly pointerDepth: number;
  /** `(*name)(...)`: its parameter list as written; otherwise null */
  readonly functionPointerParams: string | null;
  readonly parameters: readonly IExtractedParameter[];
  readonly arrayDimensions: readonly (number | string)[];
}

export default ICDeclaratorSyntax;
