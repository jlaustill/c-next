/**
 * A user-defined type as C spells it: ADR-046's `cstring` is `char*`, and a C
 * struct tag with no typedef takes the `struct` keyword (#834).
 */
function userCType(typeName: string, needsStructKeyword: boolean): string {
  // ADR-046: cstring maps to char* for C library interop
  if (typeName === "cstring") {
    return "char*";
  }
  if (needsStructKeyword) {
    return `struct ${typeName}`;
  }
  return typeName;
}

export default userCType;
