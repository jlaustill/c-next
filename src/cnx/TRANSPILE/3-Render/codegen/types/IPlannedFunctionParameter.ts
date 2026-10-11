import type IPlannedType from "./IPlannedType";

/**
 * A function parameter as the function CONTEXT needs it -- the registry of
 * what each parameter is, which every later access consults.
 *
 * #1445: `FunctionContextManager` read this off a `ParameterContext`. It asks
 * the same node three questions -- the name, whether it is an array, and what
 * its type is -- and everything it decides afterwards comes from
 * `CodeGenState` and the callback typedef.
 *
 * ## Why this is not `IPlannedParameter`
 *
 * That record serves ADR-006's SIGNATURE adapter and this one serves the
 * parameter registry, and they genuinely disagree about two things:
 *
 * - **`isArray`.** Here it means either spelling. The signature adapter means
 *   only `u8[4] p`, because that is the only spelling it ever sees: a C-style
 *   `u8 p[4]` is E0874 in pass 2.1, with one exemption -- `main(string args[])`
 *   -- and the main-with-args path emits `int argc, char *argv[]` outright
 *   without consulting the adapter. So the two notions differ on exactly one
 *   parameter in the language, and both are right for their reader.
 * - **The dimensions.** The adapter wants C text (`"SIZE"` folded to `"6"`);
 *   this wants numbers for ADR-036 bounds checking, with a slot kept for a
 *   dimension that did not fold so dimension i still matches subscript i.
 *
 * Two records deriving different facts is not the duplication CLAUDE.md
 * forbids -- deriving the SAME fact twice would be, and the .c/.h version of
 * that is #1639.
 */
interface IPlannedFunctionParameter {
  readonly name: string;

  /** An explicit `const` modifier in the source. */
  readonly isConst: boolean;

  /** Either array spelling -- see the note above on why that differs. */
  readonly isArray: boolean;

  /**
   * The dimensions, folded to values, with `UNRESOLVED_DIMENSION` for a slot
   * that did not fold. Empty when the parameter is not an array.
   */
  readonly arrayDimensions: readonly number[];

  /** A bounded string's capacity, at the top level or as an array's element. */
  readonly stringCapacity: number | undefined;

  /** The type's alternatives, classified once by the one ladder. */
  readonly type: IPlannedType;
}

export default IPlannedFunctionParameter;
