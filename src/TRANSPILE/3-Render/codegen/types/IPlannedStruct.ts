import type IPlannedStructField from "./IPlannedStructField";

/**
 * A struct declaration, reduced to its name and its fields (#1445 box 3).
 *
 * The generator's remaining job is the one it should have: deciding which
 * fields are callbacks (ADR-029), which need an explicit zero (ADR-017), and
 * whether tracked dimensions from the symbols override the written ones
 * (ADR-036). None of that is a question about the tree.
 */
interface IPlannedStruct {
  readonly name: string;
  readonly fields: readonly IPlannedStructField[];
}

export default IPlannedStruct;
