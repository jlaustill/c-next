/**
 * MISRA C:2012's essential type categories (Rule 10.4), as C-Next uses them
 * (#1668, ruling 2): a named enum is its own category (with its name on the
 * operand), and so are character and Boolean. `none` is an operand with no
 * essential category of its own -- an unsuffixed integer literal, a struct,
 * a string, a whole bitmap, a callback -- or one the typer could not settle.
 */
type TEssentialCategory =
  | "signed"
  | "unsigned"
  | "floating"
  | "boolean"
  | "enum"
  | "character"
  | "none";

export default TEssentialCategory;
