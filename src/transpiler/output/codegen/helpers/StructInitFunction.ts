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
   * The `.c` definition: returns a compound literal naming EVERY field --
   * each callback set to the function its type was defined from, each other
   * field set to its type's zero value.
   *
   * #1557: this named the callback fields alone. C zero-fills the omitted ones
   * and warns about nothing, so the partial literal was invisible until the
   * no-warnings check started running in C++ mode, where the same construct is
   * `-Wmissing-field-initializers`.
   */
  static definition(
    structName: string,
    fields: readonly IStructFieldInit[],
  ): string {
    const lines: string[] = [
      `${StructInitFunction.signature(structName)} {`,
      `    return (${structName}){`,
    ];

    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];
      const comma = i < fields.length - 1 ? "," : "";
      lines.push(`        .${field.fieldName} = ${field.initializer}${comma}`);
    }

    lines.push(`    };`, `}`, "");

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
