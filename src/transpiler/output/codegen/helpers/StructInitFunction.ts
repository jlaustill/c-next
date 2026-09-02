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
import ICallbackFieldInit from "../types/ICallbackFieldInit";

/**
 * Compliance annotation for the emitted declarations (C-Next standard: codegen
 * whose shape is dictated by a safety standard says which rule shaped it).
 * One line above the block -- the declarations are contiguous and share a
 * single reason, so repeating it per prototype would add noise, not tracing.
 */
const RULE_8_4_ANNOTATION =
  "/* MISRA C:2012 Rule 8.4: declaration for the ADR-029 generated init function (the definition has external linkage and would otherwise be undeclared). */";

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
   * The `.c` definition: returns a compound literal with every callback field
   * set to the function its type was defined from.
   */
  static definition(
    structName: string,
    callbackFields: readonly ICallbackFieldInit[],
  ): string {
    const lines: string[] = [
      `${StructInitFunction.signature(structName)} {`,
      `    return (${structName}){`,
    ];

    for (let i = 0; i < callbackFields.length; i++) {
      const field = callbackFields[i];
      const comma = i < callbackFields.length - 1 ? "," : "";
      lines.push(`        .${field.fieldName} = ${field.callbackType}${comma}`);
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
