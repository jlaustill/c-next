import * as Parser from "../logic/parser/grammar/CNextParser";

/**
 * The type-alternative accessors every type-bearing parse context exposes.
 *
 * `arrayType`'s six element alternatives (grammar/CNext.g4:549-556) are a
 * SUBSET of `type`'s eight (:475-485) -- `type` adds `templateType` and `void`,
 * which this interface does not expose and TypeBinding does not resolve. Within
 * the six, a TypeContext and an ArrayTypeContext are structurally the same
 * shape, which is what lets one resolver recurse from an array into its element
 * type instead of each caller re-deriving the element separately.
 *
 * The two extras are why `resolveName` returning null is not the same event on
 * a TypeContext as on an ArrayTypeContext: on the former it also means
 * "template or void", which every caller handles for itself.
 *
 * Declared once. It was previously spelled out identically in TypeUtils and in
 * TypeGenerationHelper -- one type, two declarations, which is the same
 * duplicate-decision problem as the resolvers that consume it (#1285).
 */
interface ITypeAccessors {
  primitiveType(): Parser.PrimitiveTypeContext | null;
  userType(): Parser.UserTypeContext | null;
  stringType(): Parser.StringTypeContext | null;
  scopedType(): Parser.ScopedTypeContext | null;
  qualifiedType(): Parser.QualifiedTypeContext | null;
  globalType(): Parser.GlobalTypeContext | null;
  /** Present on TypeContext, absent on ArrayTypeContext -- arrays do not nest. */
  arrayType?(): Parser.ArrayTypeContext | null;
}

export default ITypeAccessors;
