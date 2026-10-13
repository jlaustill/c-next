import type ICHeaderSyntax from "./ICHeaderSyntax";
import type TParsedHeader from "./TParsedHeader";

/**
 * Issue #985 recovery, parsed (#1991): each slice 1.1 preprocessed as a
 * translation unit, as its own language and as C, and the macro names 1.1 found.
 */
interface IParsedRecovery {
  readonly slices: ReadonlyArray<{
    readonly path: string;
    readonly parsed: TParsedHeader;
    readonly asC: ICHeaderSyntax | null;
  }>;
  readonly macroNames: ReadonlySet<string>;
}

export default IParsedRecovery;
