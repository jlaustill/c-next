import type TConstExpr from "./TConstExpr";
import type TType from "./TType";

/**
 * A const's initializer as written, with the type that holds its value and
 * the file it is written in, which its own names bind in (#1268 review)
 */
interface IConstInitializer {
  readonly expr: TConstExpr;
  readonly type: TType;
  /** Null for a local's: the file the name that reaches it is written in */
  readonly sourceFile: string | null;
}

export default IConstInitializer;
