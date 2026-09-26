/**
 * ADR-049: settles a run's one target.
 *
 * Every program names exactly one target (ADR-049, "One target per program").
 * The rungs, highest first:
 *
 *   1. `#pragma target` in any file. Every file that declares one must
 *      declare an equal description; a file that declares none takes the
 *      program's.
 *   2. The target option.
 *   3. The fallback, `host`, until the missing-target error lands.
 *
 * Every name given -- in source or as the option -- must be a catalog name,
 * even when a higher rung decides: a misspelled `--target` is an error, not a
 * setting that happens to be overridden.
 */
import TargetDescriptions from "./TargetDescriptions";
import invariant from "../../utils/invariant";
import DeclarationSite from "../../utils/DeclarationSite";
import type ITranspileError from "../../lib/types/ITranspileError";
import type IRunTargetInputs from "../../transpiler/types/IRunTargetInputs";
import type ITargetDescription from "../../transpiler/types/ITargetDescription";
import type ITargetDirective from "../../transpiler/types/ITargetDirective";
import type TRunTarget from "../../transpiler/types/TRunTarget";

const FALLBACK_TARGET = "host";

/** One `#pragma target` that names a known target */
interface IDeclaredTarget {
  readonly name: string;
  readonly description: ITargetDescription;
  readonly sourcePath: string;
  readonly directive: ITargetDirective;
}

class RunTarget {
  static resolve(inputs: IRunTargetInputs): TRunTarget {
    const errors: ITranspileError[] = [];
    const declared: IDeclaredTarget[] = [];

    for (const file of inputs.files) {
      for (const directive of file.directives) {
        if (directive.key !== "target") {
          continue;
        }
        const name = directive.values[0];
        const description = inputs.catalog.get(name);
        if (description) {
          declared.push({
            name,
            description,
            sourcePath: file.sourcePath,
            directive,
          });
        } else {
          errors.push(
            RunTarget.unknown(name, inputs.catalog, {
              sourcePath: file.sourcePath,
              line: directive.line,
              column: directive.column,
            }),
          );
        }
      }
    }

    // Serve passes "" for "no target"; it names nothing.
    const option = inputs.option || undefined;
    const fromOption = option ? inputs.catalog.get(option) : undefined;
    if (option && !fromOption) {
      errors.push(RunTarget.unknown(option, inputs.catalog, null));
    }

    const first = declared[0];
    for (const other of declared.slice(1)) {
      if (!TargetDescriptions.equal(first.description, other.description)) {
        errors.push(RunTarget.conflict(first, other));
      }
    }

    if (errors.length > 0) {
      return { kind: "rejected", errors };
    }
    if (first) {
      return {
        kind: "resolved",
        name: first.name,
        source: "pragma",
        description: first.description,
      };
    }
    if (option && fromOption) {
      return {
        kind: "resolved",
        name: option,
        source: "option",
        description: fromOption,
      };
    }
    const fallback = inputs.catalog.get(FALLBACK_TARGET);
    invariant(fallback, `the target catalog defines '${FALLBACK_TARGET}'`);
    return {
      kind: "resolved",
      name: FALLBACK_TARGET,
      source: "fallback",
      description: fallback,
    };
  }

  /** E0510, at the pragma, or unplaced when the option named it */
  private static unknown(
    name: string,
    catalog: ReadonlyMap<string, ITargetDescription>,
    at: { sourcePath: string; line: number; column: number } | null,
  ): ITranspileError {
    return {
      line: at?.line ?? 1,
      column: at?.column ?? 0,
      ...(at ? { sourcePath: at.sourcePath } : {}),
      message: at
        ? `error[E0510]: '${name}' is not a known target`
        : `error[E0510]: the target option names '${name}', which is not a known target`,
      helpText: `Known targets: ${[...catalog.keys()].join(", ")}. Names match exactly (ADR-049).`,
      severity: "error",
    };
  }

  /** E0511, at the declaration that disagrees with the first */
  private static conflict(
    first: IDeclaredTarget,
    other: IDeclaredTarget,
  ): ITranspileError {
    return {
      line: other.directive.line,
      column: other.directive.column,
      sourcePath: other.sourcePath,
      message: `error[E0511]: this file declares target '${other.name}', but ${DeclarationSite.display(first.sourcePath, first.directive.line)} declares '${first.name}'`,
      helpText:
        "A program has exactly one target (ADR-049). Declare the same target in every file that declares one; a file that declares none takes the program's.",
      severity: "error",
    };
  }
}

export default RunTarget;
