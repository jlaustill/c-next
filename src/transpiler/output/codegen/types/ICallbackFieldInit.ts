/**
 * One callback field of a struct, as the ADR-029 init function initialises it.
 *
 * Shared by the generator that discovers the field and the module that spells
 * the init function, so the two cannot describe the same field differently.
 */
interface ICallbackFieldInit {
  /** Field name as declared on the struct */
  readonly fieldName: string;

  /** Callback type name -- also the default function assigned to the field */
  readonly callbackType: string;
}

export default ICallbackFieldInit;
