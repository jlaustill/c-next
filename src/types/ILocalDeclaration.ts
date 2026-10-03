import type ISourceSpan from "./ISourceSpan";
import type TOverflowBehavior from "./TOverflowBehavior";
import type TType from "./TType";
import type TConstExpr from "./TConstExpr";

/**
 * One declaration inside a function: a local, a parameter, a `for` variable
 * or a constructor declaration (#1668, #1664).
 *
 * File-scope globals and scope members are NOT here: they are the
 * `IVariableSymbol`s they already are, reached by C-name identity. A local is
 * never a symbol table entry -- two functions may each declare an `i`.
 *
 * Built by 1.3 Declare from the parse tree, and settled by 1.4 Resolve: its
 * type made concrete, a const's value and its array dimensions folded in the
 * lexical environment. Plain data; no parse node.
 */
interface ILocalDeclaration {
  readonly name: string;
  readonly kind: "local" | "parameter" | "for" | "constructor";
  /** The declarator IDENTIFIER's span; a use binds only after it starts */
  readonly span: ISourceSpan;
  readonly type: TType;
  /** Leading first; a const name 1.4 could not fold stays its text */
  readonly arrayDimensions: ReadonlyArray<number | string>;
  /** #1175: each dimension as written, index-aligned; null where 1.3 already knew the size */
  readonly arrayDimensionExprs: ReadonlyArray<TConstExpr | null>;
  readonly isConst: boolean;
  readonly isAtomic: boolean;
  readonly isVolatile: boolean;
  /** ADR-044; `clamp` when unspecified, and for a parameter */
  readonly overflowBehavior: TOverflowBehavior;
  /** The initializer's text, or null */
  readonly initialValue: string | null;
  /** #1175: a const's initializer as written, which `constValue` folds from */
  readonly initialValueExpr: TConstExpr | null;
  /** #895: what the initializer calls (`VariableCollector.calleeOf`) */
  readonly initializerCallee: string | null;
  /** A const local's value, folded by 1.4 in the lexical environment */
  readonly constValue: number | null;
}

export default ILocalDeclaration;
