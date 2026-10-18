/**
 * E0917's text (#1823, ADR-036): a `for` header declares one scalar loop
 * variable. 1.2 reports an array or a string written there; 2.1 reports a
 * header typedef that names an array, which only the symbols can tell. One
 * wording for both.
 */
class ForHeaderVariable {
  static readonly HELP =
    "A for header declares one scalar loop variable (ADR-036); declare it before the loop and use it inside.";

  static message(isArray: boolean, name: string): string {
    return `${isArray ? "An array" : "A string"} is not a for loop variable: declare '${name}' before the loop`;
  }
}

export default ForHeaderVariable;
