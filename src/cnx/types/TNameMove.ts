/**
 * #1643 review: why a local is emitted under a C name other than its own.
 * `hidesFileScope` is ADR-057's: a plain name would hide the file-scope one.
 * `readsEnclosing` is #1643's: its initializer reads the enclosing local it
 * shadows, which C would not let a plain name do.
 */
type TNameMove = "hidesFileScope" | "readsEnclosing";

export default TNameMove;
