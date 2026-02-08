/**
 * Dependencies required by ArrayAccessHelper for code generation.
 * Allows the helper to request includes and access state without
 * direct coupling to CodeGenerator.
 */
import TIncludeHeader from "../generators/TIncludeHeader";

type IArrayAccessDeps = {
  /** Generate a bit mask for the given width */
  generateBitMask(width: string, is64Bit?: boolean): string;
  /** Request an include header */
  requireInclude(header: TIncludeHeader): void;
  /** Check if we're in a function body */
  isInFunctionBody(): boolean;
  /** Register a float shadow variable, returns true if newly registered */
  registerFloatShadow(shadowName: string, shadowType: string): boolean;
  /** Check if shadow is current (already synced) */
  isShadowCurrent(shadowName: string): boolean;
  /** Mark shadow as current */
  markShadowCurrent(shadowName: string): void;
};

export default IArrayAccessDeps;
