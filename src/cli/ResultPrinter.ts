/**
 * ResultPrinter
 * Prints transpiler compilation results
 */

import DeclarationSite from "../utils/DeclarationSite";
import ITranspilerResult from "../transpiler/types/ITranspilerResult";
import ToolchainRequirementUtils from "../utils/ToolchainRequirementUtils";
import type IRecordedRequirement from "../transpiler/types/IRecordedRequirement";
import type IToolchainRequirement from "../transpiler/types/IToolchainRequirement";
import type TOutputMode from "../transpiler/types/TOutputMode";

/** Column width for the requirement label in the toolchain report. */
const LABEL_WIDTH = 21;

/** Source sites shown per requirement before collapsing to a count. */
const SITE_LIMIT = 3;

/**
 * Print transpiler compilation results
 */
class ResultPrinter {
  /**
   * Print pipeline compilation result
   * @param result - Transpiler result to print
   */
  static print(result: ITranspilerResult): void {
    // Print warnings
    for (const warning of result.warnings) {
      console.warn(`Warning: ${warning}`);
    }

    // Print errors
    for (const error of result.errors) {
      // Format error with source path if available
      const location = error.sourcePath
        ? `${error.sourcePath}:${error.line}:${error.column}`
        : `${error.line}:${error.column}`;
      console.error(`Error: ${location} ${error.message}`);
    }

    // Summary
    if (result.success) {
      console.log("");
      console.log(`Compiled ${result.filesProcessed} files`);
      console.log(`Collected ${result.symbolsCollected} symbols`);
      console.log(`Generated ${result.outputFiles.length} output files:`);
      for (const file of result.outputFiles) {
        console.log(`  ${file}`);
      }
      ResultPrinter.printRequirements(result);
    } else {
      console.error("");
      console.error("Compilation failed");
    }
  }

  /**
   * Issue #1143: Report what THIS project needs from its toolchain.
   *
   * A static compatibility matrix can only say what C-Next might need. This
   * says what the code just transpiled actually needs, and where each cost came
   * from -- the number someone choosing a toolchain is really asking for.
   * Printed only when something exceeds the mode's baseline, so an ordinary
   * C99 project sees nothing.
   */
  private static printRequirements(result: ITranspilerResult): void {
    const recorded = result.requirements ?? [];
    const mode = ToolchainRequirementUtils.modeOf(recorded);
    const reportable = ToolchainRequirementUtils.reportable(recorded, mode);
    if (reportable.length === 0) return;

    const baseline = ToolchainRequirementUtils.lookup(
      ToolchainRequirementUtils.baselineKey(mode),
    );

    console.log("");
    console.log("Toolchain requirements for this project:");
    console.log("");
    ResultPrinter.printStandardSection(reportable, mode, baseline.standard);
    ResultPrinter.printCompilerSection(reportable, mode);
    ResultPrinter.printPlatformSection(reportable);

    console.log("");
    console.log("  See docs/compatibility.md for the full matrix.");
  }

  /**
   * Requirements whose cost is a later language standard than the baseline.
   *
   * A requirement that also names an extension gets a second line: GCC and
   * Clang accept it below the standard, so a reader already on that standard
   * must not be told they need an extension.
   */
  private static printStandardSection(
    reportable: readonly IRecordedRequirement[],
    mode: TOutputMode,
    baselineStandard: string,
  ): void {
    console.log("  Language standard");
    console.log(`    ${baselineStandard.padEnd(LABEL_WIDTH)}baseline`);

    for (const entry of reportable) {
      const requirement = ToolchainRequirementUtils.lookup(entry.key);
      if (requirement.platformLib !== null) continue;
      if (!ToolchainRequirementUtils.exceedsBaselineStandard(entry.key, mode)) {
        continue;
      }
      ResultPrinter.printLeaf(requirement.standard, requirement, entry);
      if (requirement.extensions.length > 0) {
        const note = `(or a GNU/Clang extension below ${requirement.standard})`;
        console.log(`    ${"".padEnd(LABEL_WIDTH)}  ${note}`);
      }
    }
  }

  /**
   * Requirements whose cost is an unconditional compiler extension.
   *
   * Extensions belonging to a requirement that also names a platform library
   * are deliberately left out: those live inside one arm of a #if chain, so
   * they are only needed when that arm is selected. Listing them here would
   * tell an AVR user they need ARM inline assembly.
   */
  private static printCompilerSection(
    reportable: readonly IRecordedRequirement[],
    mode: TOutputMode,
  ): void {
    // `unconditionalExtensions` owns the "does every target need this?"
    // decision, so this report and the per-file banner cannot answer it
    // differently -- they are the same question asked twice.
    const unconditionalNames = new Set<string>(
      ToolchainRequirementUtils.unconditionalExtensions(reportable),
    );
    const unconditional = reportable.filter((entry) => {
      const requirement = ToolchainRequirementUtils.lookup(entry.key);
      if (
        !requirement.extensions.some((name) => unconditionalNames.has(name))
      ) {
        return false;
      }
      // Already reported under Language standard, with its extension fallback
      // noted there -- no standard removes the need for the ones left here.
      //
      // Compared against the report's mode, not one inferred from the
      // requirement. Inferring it from `modes` is right only while every entry
      // reaching here is single-mode; one dual-mode entry with an extension
      // would be judged against the C++ baseline during a C transpile.
      return !ToolchainRequirementUtils.exceedsBaselineStandard(
        entry.key,
        mode,
      );
    });
    if (unconditional.length === 0) return;

    console.log("");
    console.log("  Compiler");
    for (const entry of unconditional) {
      ResultPrinter.printLeaf(
        "GNU/Clang extension",
        ToolchainRequirementUtils.lookup(entry.key),
        entry,
      );
    }
  }

  /**
   * Requirements that need a platform library.
   *
   * Sibling arms of one feature are printed as alternatives rather than as
   * separate costs: a critical section needs ARMv7-M *or* Arduino *or*
   * avr-libc *or* CMSIS, decided by the compiler, and listing them as four
   * independent requirements would misstate what the user has to provide.
   */
  private static printPlatformSection(
    reportable: readonly IRecordedRequirement[],
  ): void {
    const withPlatform = reportable.filter(
      (entry) =>
        ToolchainRequirementUtils.lookup(entry.key).platformLib !== null,
    );
    if (withPlatform.length === 0) return;

    console.log("");
    console.log("  Platform library");

    for (const [feature, group] of ResultPrinter.groupByFeature(withPlatform)) {
      if (group.length === 1) {
        const requirement = ToolchainRequirementUtils.lookup(group[0]!.key);
        ResultPrinter.printLeaf(
          requirement.platformLib ?? "",
          requirement,
          group[0]!,
        );
        continue;
      }
      ResultPrinter.printAlternatives(feature, group);
    }
  }

  /** Bucket requirements by the feature they belong to, preserving order. */
  private static groupByFeature(
    entries: readonly IRecordedRequirement[],
  ): ReadonlyMap<string, IRecordedRequirement[]> {
    const byFeature = new Map<string, IRecordedRequirement[]>();
    for (const entry of entries) {
      const feature = ToolchainRequirementUtils.lookup(entry.key).feature;
      const group = byFeature.get(feature);
      if (group === undefined) byFeature.set(feature, [entry]);
      else group.push(entry);
    }
    return byFeature;
  }

  /**
   * One feature satisfied by any of several platform libraries, chosen by the
   * compiler rather than by the user. Printing them as separate requirements
   * would tell an AVR user they need CMSIS.
   */
  private static printAlternatives(
    feature: string,
    group: readonly IRecordedRequirement[],
  ): void {
    console.log(`    ${"one of, by target".padEnd(LABEL_WIDTH)}${feature}`);
    for (const entry of group) {
      const requirement = ToolchainRequirementUtils.lookup(entry.key);
      const when =
        requirement.condition === null
          ? "always"
          : `when ${requirement.condition}`;
      const extensions =
        requirement.extensions.length > 0 ? "  [GNU/Clang extension]" : "";
      console.log(
        `      ${(requirement.platformLib ?? "").padEnd(LABEL_WIDTH - 2)}${when}${extensions}`,
      );
    }
    ResultPrinter.printSites(group[0]!);
  }

  /** One requirement row plus the source sites that incurred it. */
  private static printLeaf(
    label: string,
    requirement: IToolchainRequirement,
    entry: IRecordedRequirement,
  ): void {
    console.log(
      `    ${label.padEnd(LABEL_WIDTH)}${requirement.reason} - ${requirement.feature}`,
    );
    ResultPrinter.printSites(entry);
  }

  /**
   * Where a requirement came from: up to three source locations, or what the
   * user did to incur it when it has no single location.
   *
   * Some requirements are genuinely file-scoped rather than sited -- the
   * `--debug` panic helpers are incurred by a compiler flag plus any clamp
   * type, and the C++ initializer forms by a whole transpile mode. Attributing
   * those to an arbitrary line would invent precision the requirement does not
   * have, so the registry's `incurredBy` is shown instead. Reported in review
   * of #1153, where the absence of any explanation was the real gap.
   */
  private static printSites(entry: IRecordedRequirement): void {
    const indent = " ".repeat(LABEL_WIDTH + 6);
    const located = entry.sites.filter((site) => site.sourcePath.length > 0);

    if (located.length === 0) {
      const requirement = ToolchainRequirementUtils.lookup(entry.key);
      console.log(`${indent}from ${requirement.incurredBy}`);
      return;
    }

    for (const site of located.slice(0, SITE_LIMIT)) {
      const path = DeclarationSite.displayPath(site.sourcePath);
      const where = site.line === null ? path : `${path}:${site.line}`;
      console.log(`${indent}${where}`);
    }
    if (located.length > SITE_LIMIT) {
      console.log(`${indent}(+${located.length - SITE_LIMIT} more)`);
    }
  }
}

export default ResultPrinter;
