import type ICppClassSyntax from "./ICppClassSyntax";
import type ICppEnumSyntax from "./ICppEnumSyntax";

/** A class or enum a C++ declaration's specifiers define, in source order (#1991) */
type TCppTypeSpecifierSyntax =
  | { readonly kind: "class"; readonly class: ICppClassSyntax }
  | { readonly kind: "enum"; readonly enum: ICppEnumSyntax };

export default TCppTypeSpecifierSyntax;
