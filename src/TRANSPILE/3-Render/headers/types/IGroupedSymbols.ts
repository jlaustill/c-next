/**
 * Grouped symbols by kind for header generation
 */

import IHeaderSymbol from "./IHeaderSymbol";

interface IGroupedSymbols {
  structs: IHeaderSymbol[];
  classes: IHeaderSymbol[];
  functions: IHeaderSymbol[];
  variables: IHeaderSymbol[];
  enums: IHeaderSymbol[];
  types: IHeaderSymbol[];
  bitmaps: IHeaderSymbol[];
}

export default IGroupedSymbols;
