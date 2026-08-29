/**
 * ADR-049: Target platform capability map.
 *
 * Each entry states only what that target actually claims *differently* from
 * `DEFAULT_TARGET`. Spelling every field out per target made adding one
 * capability a nine-place edit (#1307 added two identifier-budget fields and
 * touched all eight entries plus the default), and a target that silently
 * matched the default was indistinguishable from one that had never been
 * reviewed.
 *
 * Lives in `constants/` rather than inside `CodeGenerator` so that whole-program
 * checks can resolve a target too. While this map was module-private to codegen,
 * the only handle `Transpiler` had was the `CodeGenState.targetCapabilities`
 * static — which codegen does not assign until Stage 5, one stage too late
 * (#1307 review).
 */

import type ITargetCapabilities from "../types/ITargetCapabilities";
import DEFAULT_TARGET from "./DEFAULT_TARGET";

const TARGET_CAPABILITIES: Record<string, ITargetCapabilities> = {
  teensy41: { ...DEFAULT_TARGET, hasLdrexStrex: true, hasBasepri: true },
  teensy40: { ...DEFAULT_TARGET, hasLdrexStrex: true, hasBasepri: true },
  "cortex-m7": { ...DEFAULT_TARGET, hasLdrexStrex: true, hasBasepri: true },
  "cortex-m4": { ...DEFAULT_TARGET, hasLdrexStrex: true, hasBasepri: true },
  "cortex-m3": { ...DEFAULT_TARGET, hasLdrexStrex: true, hasBasepri: true },
  "cortex-m0+": { ...DEFAULT_TARGET, hasLdrexStrex: true },
  "cortex-m0": { ...DEFAULT_TARGET },
  avr: { ...DEFAULT_TARGET, wordSize: 8 },
};

export default TARGET_CAPABILITIES;
