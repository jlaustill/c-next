/**
 * How 2.3 passes a call's argument, which 2.2 plans the type it is written
 * against from (#1991)
 */
interface IArgumentPassing {
  /** The parameter it binds to, when the callee declares one */
  readonly param:
    | { readonly baseType: string; readonly isArray?: boolean }
    | undefined;
  /** To a C function, by value, or by reference */
  readonly mode: "c" | "value" | "reference";
}

export default IArgumentPassing;
