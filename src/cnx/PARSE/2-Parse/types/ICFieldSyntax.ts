import type ICDeclaratorSyntax from "./ICDeclaratorSyntax";

interface ICFieldSyntax {
  /** The specifier-qualifier list, as written */
  readonly type: string;
  readonly declarator: ICDeclaratorSyntax;
}

export default ICFieldSyntax;
