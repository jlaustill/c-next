import type IFunctionSymbol from "./symbols/IFunctionSymbol";
import type ILocalDeclaration from "./ILocalDeclaration";
import type IVariableSymbol from "./symbols/IVariableSymbol";

/**
 * What a value name means at a position (#1668): the one place a spelling
 * becomes a declaration, for typing and emission alike.
 */
type TValueBinding =
  | {
      readonly kind: "local";
      readonly declaration: ILocalDeclaration;
      readonly scopePath: string;
    }
  /** A file-scope global or a scope member, by C-name identity */
  | { readonly kind: "variable"; readonly symbol: IVariableSymbol }
  /**
   * A C-Next function named where a value is (#1760 review): it has no value
   * to fold or type, but it decides which function the name is, so a global
   * of the same name cannot answer instead (ADR-057)
   */
  | { readonly kind: "function"; readonly symbol: IFunctionSymbol }
  /** A C-Next scope name, as the root of `Scope.member` */
  | { readonly kind: "scope"; readonly scopePath: string }
  /** A name a C or C++ header declares */
  | { readonly kind: "foreign"; readonly name: string };

export default TValueBinding;
