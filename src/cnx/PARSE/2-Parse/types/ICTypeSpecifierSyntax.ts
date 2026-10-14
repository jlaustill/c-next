/** One type specifier, as written; `typedefName` when it names a typedef */
interface ICTypeSpecifierSyntax {
  readonly text: string;
  readonly typedefName: string | null;
}

export default ICTypeSpecifierSyntax;
