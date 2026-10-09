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
 * header's own data whether a struct has a default: only top-level structs
 * reach the generator that defines one, while the header's `structFields` map
 * also holds scope-nested structs, which are initialized at their declarations
 * but get no init function. Re-deriving the predicate on the header side
 * would declare `Scope__Nested_init` for a function nobody defines. The
 * existence decision is therefore recorded where it is made and read
 * everywhere else; only the spelling lives in this module.
 */
import ComplianceAnnotations from "../../../2-Plan/ComplianceAnnotations";

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
   * The `.c` definition: return the struct's ADR-029 default.
   *
   * #1283: the body is the same brace every declaration with no initializer
   * uses (`StructDefaultInitializer`), so calling this function and declaring
   * a variable cannot produce different values.
   *
   * @param structName - The struct being initialized
   * @param defaultBrace - The struct's default, from `StructDefaultInitializer`
   */
  static definition(structName: string, defaultBrace: string): string {
    return [
      `${StructInitFunction.signature(structName)} {`,
      `    ${structName} value = ${defaultBrace};`,
      `    return value;`,
      `}`,
      "",
    ].join("\n");
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
