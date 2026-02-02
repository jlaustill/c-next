/**
 * Grouped symbols by kind for header generation
 */

import ISymbol from "../../../../utils/types/ISymbol";

interface IGroupedSymbols {
  structs: ISymbol[];
  classes: ISymbol[];
  functions: ISymbol[];
  variables: ISymbol[];
  enums: ISymbol[];
  types: ISymbol[];
  bitmaps: ISymbol[];
}

export default IGroupedSymbols;
