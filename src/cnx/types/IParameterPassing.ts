/** How C declares one cnx parameter, and so how a call passes it */
interface IParameterPassing {
  /** The C parameter is the value itself: no `*` or `&` is added */
  readonly byValue: boolean;
  /** #895: a C callback typedef takes it through a pointer, so `T*` in C++ too */
  readonly typedefPointer: boolean;
  /** #895: the typedef's `const` */
  readonly typedefConst: boolean;
  /**
   * What a call writes for the argument. An opaque handle is a pointer
   * parameter whose argument is the handle's own value (ADR-030 / #1722).
   */
  readonly argument: "value" | "reference";
}

export default IParameterPassing;
