/**
 * Where a variable declaration is written (#2073): at file scope, as a scope
 * member, as a statement in a function or method body, or as a `for` header's
 * loop variable.
 */
type TVariableSite = "file" | "scopeMember" | "statement" | "forHeader";

export default TVariableSite;
