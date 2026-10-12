import type IHeaderDeclaratorSyntax from "./IHeaderDeclaratorSyntax";

interface ICFieldSyntax {
  /** The specifier-qualifier list, as written */
  readonly type: string;
  readonly declarator: IHeaderDeclaratorSyntax;
}

export default ICFieldSyntax;
