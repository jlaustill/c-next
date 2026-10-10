/** One field of a struct whose ADR-029 default is not zero (#1283). */
type TFieldDefault =
  | { readonly kind: "callback"; readonly functionName: string }
  | { readonly kind: "struct"; readonly structName: string };

interface IStructFieldDefault {
  readonly fieldName: string;
  readonly value: TFieldDefault;
}

export default IStructFieldDefault;
