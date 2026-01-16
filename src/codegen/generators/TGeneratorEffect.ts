/**
 * Side effects returned by generators instead of mutating state.
 *
 * Using a discriminated union enables:
 * - Exhaustive switch handling (TypeScript catches missing cases)
 * - Type-safe payloads per effect type
 * - Central effect processing in the orchestrator
 */
import TTypeInfo from "../types/TTypeInfo";
import TIncludeHeader from "./TIncludeHeader";

type TGeneratorEffect =
  | { type: "include"; header: TIncludeHeader }
  | { type: "isr" } // Needs ISR typedef
  | { type: "helper"; operation: string; cnxType: string } // Overflow clamp helper
  | { type: "safe-div"; operation: "div" | "mod"; cnxType: string } // Safe division helper
  | { type: "register-type"; name: string; info: TTypeInfo } // Register variable type
  | { type: "register-local"; name: string; isArray: boolean }; // Register local variable

export default TGeneratorEffect;
