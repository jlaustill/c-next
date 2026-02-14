/**
 * IHeaderSymbol - Normalized symbol interface for header generation.
 *
 * ADR-055 Phase 5: This interface works with both TSymbol and ISymbol,
 * providing a consistent view for header generation regardless of source.
 *
 * Header generation needs a subset of symbol information:
 * - Name and kind for categorization
 * - Type information for declarations
 * - Export status for filtering
 * - Array/const/atomic modifiers for variable declarations
 * - Parameters for function signatures
 */

import TSymbolKind from "../../../types/symbol-kinds/TSymbolKind";
import IParameterSymbol from "../../../../utils/types/IParameterSymbol";

interface IHeaderSymbol {
  /** Symbol name */
  readonly name: string;

  /** Symbol kind */
  readonly kind: TSymbolKind;

  /** Type of the symbol (e.g., "void", "u32", "Point") */
  readonly type?: string;

  /** Whether this symbol is exported/public */
  readonly isExported: boolean;

  /** Whether this variable is const */
  readonly isConst?: boolean;

  /** Whether this variable is atomic (volatile in C) */
  readonly isAtomic?: boolean;

  /** Whether this is an array */
  readonly isArray?: boolean;

  /** Array dimensions (e.g., ["10"] or ["10", "20"]) */
  readonly arrayDimensions?: readonly string[];

  /** Function parameters for signature generation */
  readonly parameters?: readonly IParameterSymbol[];

  /** Function signature for display */
  readonly signature?: string;

  /** Parent namespace or class name */
  readonly parent?: string;

  /** Access modifier for register members */
  readonly accessModifier?: string;

  /** Source file (for debugging/logging) */
  readonly sourceFile?: string;

  /** Source line (for debugging/logging) */
  readonly sourceLine?: number;
}

export default IHeaderSymbol;
