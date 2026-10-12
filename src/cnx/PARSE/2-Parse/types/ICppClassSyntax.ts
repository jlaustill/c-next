import type TCppMemberSyntax from "./TCppMemberSyntax";

/** A C++ class or struct specifier as 1.2 lowers it (#1991) */
interface ICppClassSyntax {
  /** Null for an anonymous one, `typedef struct { ... } T;` */
  readonly name: string | null;
  /** Null when the specifier has no member specification */
  readonly members: readonly TCppMemberSyntax[] | null;
}

export default ICppClassSyntax;
