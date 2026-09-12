/**
 * StructInitFunction - the ADR-029 generated struct initializer.
 *
 * A struct with callback fields gets a generated `<Struct>_init(void)` that
 * returns the struct with every callback set to its default function. That is
 * a definition with external linkage, so MISRA C:2012 Rule 8.4 requires a
 * compatible declaration to be visible: the header declares it, the `.c`
 * defines it, and the `.c` includes that header (#1205).
 *
 * Both spellings live here. The declaration must not be produced by asking the
 * header's own data whether a struct has a callback field: the `.c` walks the
 * parse tree and only top-level structs reach this generator, while the
 * header's `structFields` map also holds scope-nested structs, which get no
 * init function at all (#1283). Re-deriving the predicate on the header side
 * would declare `Scope__Nested_init` for a function nobody defines. The
 * existence decision is therefore recorded where it is made and read
 * everywhere else; only the spelling lives in this module.
 */
import ComplianceAnnotations from "../../../../TRANSPILE/2-Plan/ComplianceAnnotations";
import IStructFieldInit from "../types/IStructFieldInit";

/**
 * Compliance annotation for the emitted declarations (C-Next standard: codegen
 * whose shape is dictated by a safety standard says which rule shaped it).
 * One line above the block -- the declarations are contiguous and share a
 * single reason, so repeating it per prototype would add noise, not tracing.
 */
const RULE_8_4_ANNOTATION = ComplianceAnnotations.render(
  ComplianceAnnotations.INIT_PROTOTYPE,
);

class StructInitFunction {
  /** Generated C name, e.g. `Controller` -> `Controller_init`. */
  static cName(structName: string): string {
    return `${structName}_init`;
  }

  /**
   * The one signature spelling, without a trailing `;` or ` {`.
   * The definition and the prototype are both built from this, so they cannot
   * drift in return type, name or parameter list.
   */
  static signature(structName: string): string {
    return `${structName} ${StructInitFunction.cName(structName)}(void)`;
  }

  /**
   * The `.c` definition: zero the whole struct, then assign only the fields
   * whose correct value is not zero.
   *
   * #1568: this was a compound literal naming each field with that type's zero
   * initializer, and the zero came from the helper that answers for a
   * *declaration* position. A designated initializer is a stricter position in
   * both directions -- `.data = 0` for an array is
   * `-Wmissing-braces`, and `.ticks = {0}` for a scalar typedef from a C header
   * is `braces around scalar initializer`. Neither shape exists in the corpus,
   * so both compiled green.
   *
   * Zeroing the aggregate once removes the question instead of answering it per
   * field: arrays, foreign typedefs and nested structs are all covered by the
   * one brace, and no array-ness has to be re-derived here. That matters beyond
   * the bug -- the field declaration reads array-ness from three sources, so a
   * per-field initializer would have had to re-derive all three and drift from
   * them.
   *
   * @param structName - The struct being initialized
   * @param zeroBrace - Aggregate zero for the current mode, from the orchestrator
   * @param assignments - Fields whose value is not zero, in declaration order
   */
  static definition(
    structName: string,
    zeroBrace: string,
    assignments: readonly IStructFieldInit[],
  ): string {
    const lines: string[] = [
      `${StructInitFunction.signature(structName)} {`,
      `    ${structName} value = ${zeroBrace};`,
    ];

    for (const field of assignments) {
      lines.push(`    value.${field.fieldName} = ${field.initializer};`);
    }

    lines.push(`    return value;`, `}`, "");

    return lines.join("\n");
  }

  /**
   * The header declarations, annotated as a block.
   *
   * Takes the struct names whose init functions the `.c` actually emitted --
   * not a predicate over the header's own field data -- so a declaration can
   * never outlive its definition.
   */
  static prototypeLines(structNames: readonly string[]): string[] {
    if (structNames.length === 0) {
      return [];
    }

    return [
      RULE_8_4_ANNOTATION,
      ...structNames.map((name) => `${StructInitFunction.signature(name)};`),
    ];
  }
}

export default StructInitFunction;
