/**
 * How an argument passed by reference is written, and the C type that form
 * writes (#1991): 2.3 writes it this way, and 2.2 plans the C type from the
 * same answer.
 */
type TArgumentForm =
  /** A bare name: a parameter or an array as is, anything else by address */
  | { readonly kind: "identifier" }
  /** A member that is an array, which decays without `&` */
  | { readonly kind: "array-member" }
  /** C++: a member converted through a `cType` temporary (#256) */
  | { readonly kind: "member-temp"; readonly cType: string }
  /** An lvalue by address, a string's element cast to `cast*` (#246) */
  | { readonly kind: "lvalue"; readonly cast: string | null }
  /** A value, in C a `compoundLiteral` `&(T){value}` */
  | { readonly kind: "rvalue"; readonly compoundLiteral: string | null };

export default TArgumentForm;
