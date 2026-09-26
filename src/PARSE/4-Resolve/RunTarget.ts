/**
 * ADR-049: settles a run's one target, and judges every pragma that says
 * anything about it.
 *
 * Every program names exactly one target (ADR-049, "One target per program").
 * The rungs, highest first:
 *
 *   1. Source: `#pragma target <name>`, or an inline description -- a file's
 *      description pragmas taken together. Every declaring file must declare
 *      an equal description; a file that declares none takes the program's.
 *      A program names its target or describes it, not both.
 *   2. The target option.
 *   3. The build system: PlatformIO's board for the environment being built.
 *
 * A program none of them names has no defined meaning, and is E0515.
 *
 * Every name given -- in source or as the option -- must be a catalog name,
 * even when a higher rung decides: a misspelled `--target` is an error, not a
 * setting that happens to be overridden.
 */
import TargetDescriptions from "./TargetDescriptions";
import DeclarationSite from "../../utils/DeclarationSite";
import TARGET_DESCRIPTION_FIELDS from "../../transpiler/constants/TARGET_DESCRIPTION_FIELDS";
import type ITranspileError from "../../lib/types/ITranspileError";
import type IRunTargetInputs from "../../transpiler/types/IRunTargetInputs";
import type ITargetDescription from "../../transpiler/types/ITargetDescription";
import type ITargetDirective from "../../transpiler/types/ITargetDirective";
import type TRunTarget from "../../transpiler/types/TRunTarget";
import type TTargetFieldValue from "../../transpiler/types/TTargetFieldValue";
import type IPlatformIOEnv from "../../transpiler/types/IPlatformIOEnv";
import type IPlatformIOProject from "../../transpiler/types/IPlatformIOProject";

/** The name a run reports for a target described inline */
const INLINE_NAME = "inline";

/**
 * The description pragmas: every schema field but the catalog-only ones
 * (`name`, and the optional toolchain fields).
 */
const DESCRIPTION_KEYS: readonly string[] = Object.entries(
  TARGET_DESCRIPTION_FIELDS,
)
  .filter(([field, spec]) => field !== "name" && !spec.optional)
  .map(([field]) => field);

const PRAGMA_KEYS: readonly string[] = ["target", ...DESCRIPTION_KEYS];

/** PlatformIO platforms whose boards are all one target */
const PLATFORM_TARGETS: ReadonlyMap<string, string> = new Map([
  ["atmelavr", "avr"],
  ["native", "host"],
]);

/** A position in a file */
interface ISite {
  readonly sourcePath: string;
  readonly line: number;
  readonly column: number;
}

/** One file's target declaration: a named target or an inline description */
interface IDeclaredTarget {
  readonly name: string;
  readonly inline: boolean;
  readonly description: ITargetDescription;
  readonly site: ISite;
}

class RunTarget {
  static resolve(inputs: IRunTargetInputs): TRunTarget {
    const errors: ITranspileError[] = [];
    const declared: IDeclaredTarget[] = [];
    for (const file of inputs.files) {
      RunTarget.readFile(file, inputs.catalog, declared, errors);
    }

    // Serve passes "" for "no target"; it names nothing.
    const option = inputs.option || undefined;
    const fromOption = option ? inputs.catalog.get(option) : undefined;
    if (option && !fromOption) {
      errors.push(RunTarget.unknown(option, inputs.catalog, null));
    }

    const first = declared[0];
    for (const other of declared.slice(1)) {
      if (
        first.inline !== other.inline ||
        !TargetDescriptions.equal(first.description, other.description)
      ) {
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
    const fromBuild = inputs.platformio
      ? RunTarget.fromPlatformIO(
          inputs.platformio,
          inputs.pioEnv,
          inputs.catalog,
        )
      : null;
    if (fromBuild) {
      return fromBuild;
    }
    return {
      kind: "rejected",
      errors: [
        RunTarget.unplaced(
          "E0515",
          "the program names no target",
          `A program has exactly one target (ADR-049). Name it with '#pragma target <name>', --target <name>, "target" in cnext.config.json, or the board of a PlatformIO environment. Known targets: ${[...inputs.catalog.keys()].join(", ")}.`,
        ),
      ],
    };
  }

  /**
   * The build-system rung: the board of the environment being built, else of
   * `default_envs`, else of every environment. A board that is a catalog name
   * names that target; otherwise `atmelavr` is avr and `native` is host. Null
   * when the file has no environments, so the rung says nothing.
   */
  private static fromPlatformIO(
    project: IPlatformIOProject,
    pioEnv: string | undefined,
    catalog: ReadonlyMap<string, ITargetDescription>,
  ): TRunTarget | null {
    let names = project.envs.map((env) => env.name);
    if (pioEnv) {
      names = [pioEnv];
    } else if (project.defaultEnvs.length > 0) {
      names = [...project.defaultEnvs];
    }
    if (names.length === 0) {
      return null;
    }

    const errors: ITranspileError[] = [];
    const mapped: {
      env: string;
      name: string;
      description: ITargetDescription;
    }[] = [];
    for (const envName of names) {
      const env = project.envs.find((candidate) => candidate.name === envName);
      const name = env ? RunTarget.boardTarget(env, catalog) : undefined;
      const description = name ? catalog.get(name) : undefined;
      if (name && description) {
        mapped.push({ env: envName, name, description });
      } else {
        errors.push(
          RunTarget.unplaced(
            "E0510",
            env
              ? `platformio.ini environment '${envName}' builds board '${env.board ?? "(none)"}', which is not a known target`
              : `platformio.ini has no environment '${envName}'`,
            `Name the target with '#pragma target <name>' or --target <name>. A board maps to a target when the catalog names it, or when its platform is atmelavr (avr) or native (host). Known targets: ${[...catalog.keys()].join(", ")}.`,
          ),
        );
      }
    }
    const first = mapped[0];
    for (const other of mapped.slice(1)) {
      if (!TargetDescriptions.equal(first.description, other.description)) {
        errors.push(
          RunTarget.unplaced(
            "E0511",
            `platformio.ini environments build different targets: '${first.name}' (env:${first.env}) and '${other.name}' (env:${other.env})`,
            "A program has exactly one target (ADR-049). Build one environment (--pio-env), set default_envs, or name the target with '#pragma target <name>'.",
          ),
        );
      }
    }
    if (errors.length > 0) {
      return { kind: "rejected", errors };
    }
    return {
      kind: "resolved",
      name: first.name,
      source: "platformio",
      description: first.description,
    };
  }

  /** The catalog name an environment's board or platform denotes */
  private static boardTarget(
    env: IPlatformIOEnv,
    catalog: ReadonlyMap<string, ITargetDescription>,
  ): string | undefined {
    if (env.board && catalog.has(env.board)) {
      return env.board;
    }
    return env.platform ? PLATFORM_TARGETS.get(env.platform) : undefined;
  }

  /** A diagnostic about the run rather than a line: placed on the entry file */
  private static unplaced(
    code: string,
    message: string,
    helpText: string,
  ): ITranspileError {
    return {
      line: 1,
      column: 0,
      message: `error[${code}]: ${message}`,
      helpText,
      severity: "error",
    };
  }

  /** One file's pragmas: its named targets, and its inline description */
  private static readFile(
    file: IRunTargetInputs["files"][number],
    catalog: ReadonlyMap<string, ITargetDescription>,
    declared: IDeclaredTarget[],
    errors: ITranspileError[],
  ): void {
    const fields = new Map<string, TTargetFieldValue>();
    const given = new Set<string>();
    let firstField: ISite | null = null;
    let fieldErrors = 0;

    for (const directive of file.directives) {
      const site = { sourcePath: file.sourcePath, ...directive };
      if (!PRAGMA_KEYS.includes(directive.key)) {
        errors.push(RunTarget.unknownKey(directive.key, site));
        continue;
      }
      if (directive.key === "target") {
        RunTarget.readName(directive, site, catalog, declared, errors);
        continue;
      }
      firstField ??= site;
      const problem = RunTarget.readField(directive, fields, given);
      if (problem) {
        errors.push(RunTarget.invalid(directive.key, problem, site));
        fieldErrors++;
      }
    }

    if (firstField) {
      RunTarget.readInline(
        fields,
        given,
        firstField,
        fieldErrors,
        declared,
        errors,
      );
    }
  }

  /** `#pragma target <name>`: a known name, or E0510 */
  private static readName(
    directive: ITargetDirective,
    site: ISite,
    catalog: ReadonlyMap<string, ITargetDescription>,
    declared: IDeclaredTarget[],
    errors: ITranspileError[],
  ): void {
    if (directive.values.length !== 1) {
      errors.push(
        RunTarget.invalid("target", "'target' takes exactly one value", site),
      );
      return;
    }
    const name = directive.values[0];
    const description = catalog.get(name);
    if (description) {
      declared.push({ name, inline: false, description, site });
    } else {
      errors.push(RunTarget.unknown(name, catalog, site));
    }
  }

  /** One description pragma's value, or why it cannot be one */
  private static readField(
    directive: ITargetDirective,
    fields: Map<string, TTargetFieldValue>,
    given: Set<string>,
  ): string | null {
    const field = directive.key;
    if (given.has(field)) {
      return `'${field}' is given twice`;
    }
    given.add(field);
    if (directive.values.length !== 1) {
      return `'${field}' takes exactly one value`;
    }
    const text = directive.values[0];
    const kind =
      TARGET_DESCRIPTION_FIELDS[field as keyof ITargetDescription].kind;
    let value: TTargetFieldValue | null = null;
    if (kind === "boolean" && (text === "true" || text === "false")) {
      value = text === "true";
    } else if (kind === "unsigned" && /^(0|[1-9]\d*)$/.test(text)) {
      value = Number(text);
    }
    if (value === null) {
      return `${field} must be ${kind === "boolean" ? "true or false" : "a decimal integer"}, not '${text}'`;
    }
    const problem = TargetDescriptions.fieldProblem(field, value);
    if (!problem) {
      fields.set(field, value);
    }
    return problem;
  }

  /** A file's description pragmas taken together: complete, or E0514 */
  private static readInline(
    fields: ReadonlyMap<string, TTargetFieldValue>,
    given: ReadonlySet<string>,
    site: ISite,
    fieldErrors: number,
    declared: IDeclaredTarget[],
    errors: ITranspileError[],
  ): void {
    const missing = DESCRIPTION_KEYS.filter((key) => !given.has(key));
    if (missing.length > 0) {
      errors.push({
        ...RunTarget.at(site),
        message: "error[E0514]: incomplete target description",
        helpText: `missing: ${missing.join(", ")}. Either use '#pragma target <name>' or give every field (ADR-049).`,
        severity: "error",
      });
      return;
    }
    if (fieldErrors > 0) {
      return;
    }
    const result = TargetDescriptions.check(
      new Map([["name", INLINE_NAME], ...fields]),
    );
    if ("errors" in result) {
      for (const error of result.errors) {
        errors.push(RunTarget.invalid("target description", error, site));
      }
      return;
    }
    declared.push({
      name: INLINE_NAME,
      inline: true,
      description: result.description,
      site,
    });
  }

  private static at(site: ISite): ISite {
    return {
      sourcePath: site.sourcePath,
      line: site.line,
      column: site.column,
    };
  }

  /** E0510, at the pragma, or unplaced when the option named it */
  private static unknown(
    name: string,
    catalog: ReadonlyMap<string, ITargetDescription>,
    site: ISite | null,
  ): ITranspileError {
    const helpText = `Known targets: ${[...catalog.keys()].join(", ")}. Names match exactly (ADR-049).`;
    if (!site) {
      return RunTarget.unplaced(
        "E0510",
        `the target option names '${name}', which is not a known target`,
        helpText,
      );
    }
    return {
      ...RunTarget.at(site),
      message: `error[E0510]: '${name}' is not a known target`,
      helpText,
      severity: "error",
    };
  }

  /** E0512, at a pragma whose key is not one of ADR-049's */
  private static unknownKey(key: string, site: ISite): ITranspileError {
    return {
      ...RunTarget.at(site),
      message: `error[E0512]: unknown pragma '${key}'`,
      helpText: `A pragma names the program's target (ADR-049). Its keys are: ${PRAGMA_KEYS.join(", ")}.`,
      severity: "error",
    };
  }

  /** E0513, at a pragma whose value is wrong in count, kind or range */
  private static invalid(
    key: string,
    problem: string,
    site: ISite,
  ): ITranspileError {
    return {
      ...RunTarget.at(site),
      message: `error[E0513]: invalid value for '${key}': ${problem}`,
      helpText:
        "An integer field takes decimal digits, a Boolean field takes true or false, and each key takes exactly one value (ADR-049).",
      severity: "error",
    };
  }

  /** E0511, at the declaration that disagrees with the first */
  private static conflict(
    first: IDeclaredTarget,
    other: IDeclaredTarget,
  ): ITranspileError {
    const label = (d: IDeclaredTarget): string =>
      d.inline ? "an inline target description" : `target '${d.name}'`;
    return {
      ...RunTarget.at(other.site),
      message: `error[E0511]: this file declares ${label(other)}, but ${DeclarationSite.display(first.site.sourcePath, first.site.line)} declares ${label(first)}`,
      helpText:
        first.inline === other.inline
          ? "A program has exactly one target (ADR-049). Declare the same target in every file that declares one; a file that declares none takes the program's."
          : "A program names its target or describes it inline, not both (ADR-049).",
      severity: "error",
    };
  }
}

export default RunTarget;
