/**
 * SPIKE #1431 — THROWAWAY. Deleted before this branch merges.
 *
 * A plain static sink, the same shape as `AdrProvenance`: it records that a question
 * was asked and what the three answers were, and decides nothing. Classification and
 * comparison live in the script-side consumer, so the probe cannot drift from what it
 * is probing.
 *
 * WHY IT MUST NOT ROT. `ITranspilerConfig.collectGrammarCoverage` is stored at
 * `Transpiler.ts:164` and never read, and `ITranspilerResult.grammarCoverage` is
 * declared and never assigned -- a probe hook that died with no gate noticing, which
 * is the `/* test-no-warnings *\/` shape (#1143) applied to instrumentation. So this
 * sink carries `askedCount`, and the consumer FAILS on a question whose count is
 * zero: a question never asked is not a question that agrees.
 */
import type IViewObservation from "./types/IViewObservation";

class ViewProbe {
  private static observations: IViewObservation[] = [];
  private static askedCounts: Map<string, number> = new Map();
  private static currentFile: string | null = null;
  private static currentPhase = "unknown";
  private static armed = false;

  /**
   * Off unless a driver turns it on. The transpiler must behave identically with the
   * probe disarmed, or the measurement changes what it measures.
   */
  static arm(on: boolean): void {
    ViewProbe.armed = on;
  }

  static isArmed(): boolean {
    return ViewProbe.armed;
  }

  /** Attribute subsequent observations to a file and a pass. */
  static beginFile(sourceFile: string | null, phase: string): void {
    ViewProbe.currentFile = sourceFile;
    ViewProbe.currentPhase = phase;
  }

  static setPhase(phase: string): void {
    ViewProbe.currentPhase = phase;
  }

  /**
   * Record one observation. Counted even when the three answers agree -- the count is
   * what distinguishes "agrees" from "never asked", and those are the two outcomes a
   * probe most easily confuses.
   */
  static record(
    question: string,
    key: string,
    live: string,
    asSpecified: string,
    asPrincipled: string,
    derivable = true,
  ): void {
    if (!ViewProbe.armed) {
      return;
    }
    ViewProbe.askedCounts.set(
      question,
      (ViewProbe.askedCounts.get(question) ?? 0) + 1,
    );
    ViewProbe.observations.push({
      question,
      key,
      sourceFile: ViewProbe.currentFile ?? "<none>",
      phase: ViewProbe.currentPhase,
      live,
      asSpecified,
      asPrincipled,
      derivable,
    });
  }

  /** Every observation recorded since the last reset. Not deduplicated: repetition is data. */
  static collect(): readonly IViewObservation[] {
    return ViewProbe.observations;
  }

  /** How many times each question was asked. A zero here fails the run. */
  static counts(): ReadonlyMap<string, number> {
    return ViewProbe.askedCounts;
  }

  static reset(): void {
    ViewProbe.observations = [];
    ViewProbe.askedCounts = new Map();
    ViewProbe.currentFile = null;
    ViewProbe.currentPhase = "unknown";
  }
}

export default ViewProbe;
