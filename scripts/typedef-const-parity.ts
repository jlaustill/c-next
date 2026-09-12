#!/usr/bin/env tsx
/**
 * #1552: an ADR-029 `_fp` typedef must carry the same const its function's own
 * prototype carries.
 *
 * When it does not, the two are incompatible pointer types. Assigning the
 * function to a variable of its own type warns; and when the declaring file
 * and a using file disagree, both emit the typedef and one translation unit
 * holds two incompatible definitions of one name, which gcc rejects outright
 * with `error: conflicting types`. The transpiler exits 0 either way, so
 * nothing surfaces it but a compiler -- and only for the fixtures that compile.
 *
 * ## Why a corpus scan rather than fixtures alone
 *
 * The property is cross-file, and the contexts were already occupied while the
 * property was untested: `docs/scope-context-matrix.md` showed ADR-029 with
 * every cell `ok`, including all four `imported direct` rows. The fixture
 * occupying them exercised a function taking NO parameters, so auto-const had
 * nothing to qualify and its two emitted typedefs were byte-identical -- a
 * redefinition rather than a conflict. Coverage of contexts and coverage of
 * behavior read the same green (#1552). Of 32 function-as-type typedefs in the
 * corpus at the time, only 7 took a pointer parameter and none of those had a
 * modifying body.
 *
 * So this asks the question of every typedef the corpus actually generates,
 * rather than of the ones somebody remembered to write a fixture for.
 *
 * ## It reads GENERATED files, never the snapshots
 *
 * Same reason `headers:standalone` does: `.expected.*` files can be stale, and
 * some are compared by nothing (#1521). The generated `.h`/`.hpp` is what the
 * transpiler currently claims, so it is what gets checked.
 *
 * ## Scoping
 *
 * A typedef and the prototype it must match are routinely in DIFFERENT files --
 * that is the defect this exists to catch. But two unrelated fixtures may each
 * declare a `record`, so a corpus-wide index keyed on the bare function name
 * would compare one fixture's typedef against another's prototype. Pairing is
 * therefore per directory, which is how a fixture and its helpers are grouped.
 *
 * Usage:
 *   npm run typedef-const:parity        -- report
 *   npm run typedef-const:parity:check  -- fail on any disagreement
 */

import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import chalk from "chalk";

import FileScanner from "./utils/FileScanner";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** A `_fp` typedef, or a function prototype, reduced to what this gate compares. */
interface ISignature {
  readonly functionName: string;
  readonly file: string;
  readonly line: number;
  /** Per-positional-parameter: does it carry a leading `const`? */
  readonly constFlags: readonly boolean[];
  readonly text: string;
}

interface IDisagreement {
  readonly functionName: string;
  readonly typedef: ISignature;
  readonly prototype: ISignature;
  readonly parameterIndex: number;
}

/**
 * Split a C parameter list on top-level commas.
 *
 * Depth-aware because a parameter can itself be a function pointer, whose own
 * parameter list contains commas. Splitting naively merges two parameters into
 * one and silently shifts every positional comparison after it.
 */
function splitParameters(parameterList: string): string[] {
  const parameters: string[] = [];
  let depth = 0;
  let current = "";

  for (const character of parameterList) {
    if (character === "(" || character === "[") {
      depth += 1;
    } else if (character === ")" || character === "]") {
      depth -= 1;
    }

    if (character === "," && depth === 0) {
      parameters.push(current);
      current = "";
      continue;
    }
    current += character;
  }

  if (current.trim().length > 0) {
    parameters.push(current);
  }
  return parameters;
}

/**
 * `const` flags for each positional parameter, or null if the list is one this
 * gate cannot compare positionally.
 *
 * `(void)` is an empty list, not a one-parameter list. A `...` variadic tail is
 * not a parameter either.
 */
function constFlagsOf(parameterList: string): readonly boolean[] | null {
  const trimmed = parameterList.trim();
  if (trimmed === "" || trimmed === "void") {
    return [];
  }

  const flags: boolean[] = [];
  for (const parameter of splitParameters(trimmed)) {
    const text = parameter.trim();
    if (text === "...") {
      continue;
    }
    if (text === "") {
      return null;
    }
    flags.push(/^const\b/.test(text));
  }
  return flags;
}

/** Balanced-paren extraction of the argument list that starts at `openIndex`. */
function parameterListAt(text: string, openIndex: number): string | null {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    if (text[index] === "(") {
      depth += 1;
    } else if (text[index] === ")") {
      depth -= 1;
      if (depth === 0) {
        return text.slice(openIndex + 1, index);
      }
    }
  }
  return null;
}

const TYPEDEF_PATTERN = /^\s*typedef\s+.*\(\s*\*\s*([A-Za-z_]\w*)_fp\s*\)\s*\(/;
const PROTOTYPE_PATTERN =
  /^\s*(?:extern\s+)?[A-Za-z_][\w\s*]*?\b([A-Za-z_]\w*)\s*\(/;

/**
 * Collect every `_fp` typedef and every function prototype in one header.
 *
 * A typedef line is recognized first: `typedef void (*record_fp)(...)` also
 * matches the prototype shape, and classifying it as a prototype would compare
 * the typedef against itself and always agree.
 */
function collectFrom(file: string): {
  typedefs: ISignature[];
  prototypes: ISignature[];
} {
  const typedefs: ISignature[] = [];
  const prototypes: ISignature[] = [];
  const lines = readFileSync(file, "utf8").split("\n");

  lines.forEach((line, index) => {
    if (line.trim().startsWith("//") || line.trim().startsWith("*")) {
      return;
    }

    const typedefMatch = TYPEDEF_PATTERN.exec(line);
    if (typedefMatch) {
      const open = line.indexOf("(", line.indexOf(`${typedefMatch[1]}_fp`));
      const list = open === -1 ? null : parameterListAt(line, open);
      const flags = list === null ? null : constFlagsOf(list);
      if (flags) {
        typedefs.push({
          functionName: typedefMatch[1],
          file,
          line: index + 1,
          constFlags: flags,
          text: line.trim(),
        });
      }
      return;
    }

    if (!line.trimEnd().endsWith(";")) {
      return;
    }
    const prototypeMatch = PROTOTYPE_PATTERN.exec(line);
    if (!prototypeMatch) {
      return;
    }
    const open = line.indexOf("(");
    const list = parameterListAt(line, open);
    const flags = list === null ? null : constFlagsOf(list);
    if (flags) {
      prototypes.push({
        functionName: prototypeMatch[1],
        file,
        line: index + 1,
        constFlags: flags,
        text: line.trim(),
      });
    }
  });

  return { typedefs, prototypes };
}

/** Pair typedefs with prototypes within one fixture directory. */
function disagreementsIn(files: readonly string[]): IDisagreement[] {
  const typedefs: ISignature[] = [];
  const prototypesByName = new Map<string, ISignature>();

  for (const file of files) {
    const collected = collectFrom(file);
    typedefs.push(...collected.typedefs);
    for (const prototype of collected.prototypes) {
      if (!prototypesByName.has(prototype.functionName)) {
        prototypesByName.set(prototype.functionName, prototype);
      }
    }
  }

  const disagreements: IDisagreement[] = [];
  for (const typedef of typedefs) {
    const prototype = prototypesByName.get(typedef.functionName);
    // A typedef whose function has no prototype in this fixture is not a
    // disagreement: the prototype is what it must match, and there is none to
    // contradict. `main` is the common case -- it emits no header prototype.
    if (!prototype) {
      continue;
    }
    if (prototype.constFlags.length !== typedef.constFlags.length) {
      continue;
    }
    typedef.constFlags.forEach((isConst, parameterIndex) => {
      if (isConst !== prototype.constFlags[parameterIndex]) {
        disagreements.push({
          functionName: typedef.functionName,
          typedef,
          prototype,
          parameterIndex,
        });
      }
    });
  }
  return disagreements;
}

function main(): void {
  const check = process.argv.includes("check");

  const headers = [
    ...FileScanner.findFiles(join(rootDir, "tests"), ".h"),
    ...FileScanner.findFiles(join(rootDir, "tests"), ".hpp"),
    ...FileScanner.findFiles(join(rootDir, "examples"), ".h"),
    ...FileScanner.findFiles(join(rootDir, "examples"), ".hpp"),
  ].filter((file) => !file.includes(".expected."));

  const byDirectory = new Map<string, string[]>();
  for (const header of headers) {
    const directory = dirname(header);
    const group = byDirectory.get(directory);
    if (group) {
      group.push(header);
    } else {
      byDirectory.set(directory, [header]);
    }
  }

  let typedefCount = 0;
  const disagreements: IDisagreement[] = [];
  for (const files of byDirectory.values()) {
    for (const file of files) {
      typedefCount += collectFrom(file).typedefs.length;
    }
    disagreements.push(...disagreementsIn(files));
  }

  console.log(
    `Checked ${typedefCount} \`_fp\` typedef(s) across ${byDirectory.size} ` +
      `directory/directories; ${disagreements.length} disagree with their prototype.`,
  );

  for (const disagreement of disagreements) {
    const { typedef, prototype, functionName, parameterIndex } = disagreement;
    console.log(
      chalk.red(
        `\n  ${functionName}: parameter ${parameterIndex} const-ness differs`,
      ),
    );
    console.log(
      chalk.red(
        `    typedef   ${relative(rootDir, typedef.file)}:${typedef.line}\n` +
          `              ${typedef.text}`,
      ),
    );
    console.log(
      chalk.red(
        `    prototype ${relative(rootDir, prototype.file)}:${prototype.line}\n` +
          `              ${prototype.text}`,
      ),
    );
  }

  if (check && disagreements.length > 0) {
    console.log(
      chalk.red(
        "\nAn ADR-029 `_fp` typedef must carry the same const its function's " +
          "prototype carries. Both typedef emitters derive it from one fact " +
          "(`CodeGenState.isParameterModifiedAnywhere`); a disagreement means " +
          "something re-derived it instead.",
      ),
    );
    process.exitCode = 1;
    return;
  }
  console.log(
    chalk.green("\nEvery `_fp` typedef agrees with its function's prototype."),
  );
}

main();
