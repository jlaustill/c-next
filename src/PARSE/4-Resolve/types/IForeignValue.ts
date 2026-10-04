/**
 * A value a C or C++ header declares, as 1.4 needs it for a constant
 * expression (#1175): a variable's element type and dimensions, which a
 * length property measures; or a function. Neither is a constant expression
 * in C -- not even an `extern const` object -- so neither is a dimension.
 */
type IForeignValue =
  | {
      readonly kind: "variable";
      /** The element's C type, which C-Next does not measure */
      readonly type: string;
      /** Empty for a scalar */
      readonly dimensions: ReadonlyArray<number | string>;
    }
  | { readonly kind: "function" };

export default IForeignValue;
