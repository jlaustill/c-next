/**
 * One field of a struct, as the ADR-029 init function initializes it.
 *
 * Shared by the generator that discovers the field and the module that spells
 * the init function, so the two cannot describe the same field differently.
 *
 * #1557: this was `ICallbackFieldInit` and carried only the callback fields, so
 * the generated compound literal named a subset of the struct. C zero-fills the
 * rest and says nothing; C++ reports `-Wmissing-field-initializers`, which no
 * one saw because the no-warnings check ran in C mode only.
 */
interface IStructFieldInit {
  /** Field name as declared on the struct */
  readonly fieldName: string;

  /**
   * The initializer expression for this field: the default function for a
   * callback field, and the type's zero value for every other field.
   */
  readonly initializer: string;
}

export default IStructFieldInit;
