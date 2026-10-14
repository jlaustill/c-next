/**
 * How 2.3 writes one struct initializer (ADR-014, #1991): `{}` with the
 * fields assigned after, for a C++ class with a constructor (#517); a plain
 * designated initializer; or a compound literal.
 */
type TStructInitializerForm = "cppClass" | "designated" | "compound";

export default TStructInitializerForm;
