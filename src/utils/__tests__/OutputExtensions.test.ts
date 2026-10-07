/**
 * Issue #1319: the mode -> extension decision has exactly one owner.
 *
 * Before this, nine sites across `data/`, `logic/`, `output/` and the
 * orchestrator each wrote `cppMode ? ".hpp" : ".h"` for themselves. They agreed
 * only because each had been hand-written the same way -- nothing made them
 * agree, and six defaulted the mode to `false`, so a site that was simply never
 * passed the value emitted `.h` in a C++ run with no diagnostic. Five went with
 * #1319; #1428 removed the sixth, and the pin below keeps the count at zero.
 *
 * Counting where the *fact* lived (the issue's own table said four places) does
 * not catch that. Sharing a detection function would not have caught it either:
 * CLAUDE.md is explicit that single source of truth means the decision, not just
 * the data, and a shared helper each caller feeds its own copy of the mode into
 * is still nine derivations. So the gate is on the derivation itself.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, it, expect } from "vitest";

import OutputExtensions from "../OutputExtensions";

const SRC_ROOT = join(__dirname, "..", "..");

/** The file that is allowed to map a mode to an extension. */
const OWNER = join("utils", "OutputExtensions.ts");

/**
 * A ternary selecting a C++ file extension against its C counterpart, in either
 * order -- `x ? ".hpp" : ".h"` and `x ? ".h" : ".hpp"` are the same decision.
 */
const MODE_TO_EXTENSION =
  /\?\s*"\.(?:hpp|cpp)"\s*:\s*"\.(?:h|c)"|\?\s*"\.(?:h|c)"\s*:\s*"\.(?:hpp|cpp)"/;

/**
 * Code lines only. A comment that quotes the shape -- including the one in
 * `OutputExtensions.ts` naming the residual default -- is prose about a
 * derivation, not one. Scanning raw file text counted it, and the file that
 * documents the rule became its own first offender.
 */
const codeOf = (source: string): string =>
  source
    .split("\n")
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join("\n");

/** This file: its self-test spells every shape below as a string. */
const PIN = join("utils", "__tests__", "OutputExtensions.test.ts");

/**
 * #1428: every way a site has answered "C" (or "C++") for a run without being
 * told. Case-insensitive so `isCppMode` counts; a member write such as
 * `state.cppMode = false` is a state's own reset, not a default, so the
 * `=` form only matches an identifier that does not follow a `.`.
 */
const SILENT_MODE_DEFAULTS: readonly RegExp[] = [
  // a `??` fallback anywhere in a mode's value: `cppMode ?? false`,
  // `cppMode: x ?? false`, `this.cppMode = cfg.cppRequired ?? false`,
  // `isCppMode: overrides?.isCppMode ?? vi.fn(() => false)`
  /\w*cppMode\s*[:=]?[^;,(){}]*?\?\?/gi,
  // a typed or untyped `=` default: `cppMode: boolean = false`, `cppMode = true`
  /(?<![.\w])\w*cppMode\s*(?::\s*boolean\s*)?=\s*(?:true|false)\b/gi,
  // a spread default, on one line or several: `{ cppMode: false, ...options }`
  /\w*cppMode\s*:\s*(?:true|false)\s*,\s*\.\.\./gi,
  // a truthy read of a mode that might not be there: `options?.cppMode`
  /\?\.\w*cppMode\b/gi,
  // a defaulted header options object, whose mode a caller then never stated
  /IHeaderOptions\s*=\s*\{\s*\}/g,
];

/**
 * The one exemption: the walk state's initial value, which `generate()`
 * overwrites with the program's mode before anything reads it. Its `reset()`
 * is a member write, which the forms above do not match.
 */
const STATE_INITIAL_VALUE = `${join("TRANSPILE", "TranspileState.ts")}: cppMode: boolean = false`;

const silentModeDefaultsIn = (code: string): string[] =>
  SILENT_MODE_DEFAULTS.flatMap((form) =>
    [...code.matchAll(form)].map((match) => match[0]),
  );

const tsFilesUnder = (dir: string, withTests: boolean): string[] => {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules") continue;
      if (entry === "__tests__" && !withTests) continue;
      found.push(...tsFilesUnder(full, withTests));
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) found.push(full);
  }
  return found;
};

describe("OutputExtensions (#1319)", () => {
  it("maps the declared mode to the extensions the run emits", () => {
    expect(OutputExtensions.forCppMode(true)).toEqual({
      source: ".cpp",
      header: ".hpp",
    });
    expect(OutputExtensions.forCppMode(false)).toEqual({
      source: ".c",
      header: ".h",
    });
  });

  it("has no ternary mode-to-extension derivation under src/", () => {
    // Named for what it checks, not for the guarantee one might want from it.
    // The regex catches a copy-paste of a deleted ternary -- the realistic
    // reintroduction -- and misses `if (cppMode) { ext = ".hpp"; }`, string
    // concatenation and template literals. `scripts/` is out of scope on
    // purpose: `test-utils.ts` derives both extensions the same way, and the
    // harness drives the CLI precisely so it does not import transpiler
    // internals, so that copy is an independent oracle rather than a tenth
    // derivation.
    const offenders = tsFilesUnder(SRC_ROOT, false)
      .filter((file) =>
        MODE_TO_EXTENSION.test(codeOf(readFileSync(file, "utf-8"))),
      )
      .filter((file) => !file.endsWith(OWNER))
      .map((file) => file.slice(SRC_ROOT.length + 1));

    expect(offenders).toEqual([]);
  });

  it("detects the shape it hunts for", () => {
    // Negative control, and the reason it is phrased against literals rather
    // than against the owner's source: a source-scanning gate has two failure
    // modes and only one is loud. "Are there offenders?" fails visibly when the
    // codebase regresses. "Does the pattern match anything at all?" fails
    // silently forever, because an empty offender list looks the same whether
    // the codebase is clean or the regex is broken. So assert on known
    // positives -- the exact forms deleted by #1319 -- and on a known negative.
    expect(MODE_TO_EXTENSION.test('cppMode ? ".hpp" : ".h"')).toBe(true);
    expect(MODE_TO_EXTENSION.test('cppMode ? ".cpp" : ".c"')).toBe(true);
    expect(MODE_TO_EXTENSION.test('this.cppMode ? ".hpp" : ".h"')).toBe(true);
    // Selecting between prepared values is the owner's shape, not a derivation.
    expect(MODE_TO_EXTENSION.test("cppMode ? CPP : C")).toBe(false);
  });

  it("has no silent mode default under src/, tests included (#1428)", () => {
    // The ternary scan above cannot see a DEFAULT, which is the other way a
    // site answers "C" without being told. #1319 removed five and #1428 the
    // last (the code generator's fallback for an omitted option), so this
    // expects none. Tests are scanned too: a helper that defaults the mode
    // lets every test calling it claim C without saying so. Whole-file text,
    // so a default split across lines is still one match.
    const found = tsFilesUnder(SRC_ROOT, true)
      .filter((file) => !file.endsWith(PIN))
      .flatMap((file) =>
        silentModeDefaultsIn(codeOf(readFileSync(file, "utf-8"))).map(
          (match) => `${file.slice(SRC_ROOT.length + 1)}: ${match}`,
        ),
      )
      .filter((entry) => entry !== STATE_INITIAL_VALUE);

    expect(found).toEqual([]);
  });

  it("has no mode on any options type (#1428)", () => {
    // An options field is a caller's argument: one that is optional lets a
    // partial object claim C, and one that is required is still a second
    // copy of 1.1's answer. Codegen and headers read the mode from Program.
    const optionTypes = [
      join(
        "TRANSPILE",
        "3-Render",
        "codegen",
        "types",
        "ICodeGeneratorOptions.ts",
      ),
      join("TRANSPILE", "3-Render", "codegen", "types", "IHeaderOptions.ts"),
    ];
    const carryingMode = optionTypes.filter((file) =>
      /cppMode/i.test(codeOf(readFileSync(join(SRC_ROOT, file), "utf-8"))),
    );

    expect(carryingMode).toEqual([]);
  });

  it("detects every silent-default shape it hunts for (#1428)", () => {
    // A pin that matches nothing passes as cleanly as one that holds.
    const caught = (code: string): boolean =>
      silentModeDefaultsIn(code).length > 0;

    expect(caught("this.host.state.cppMode = options?.cppMode ?? false;")).toBe(
      true,
    );
    expect(caught("this.cppMode = this.config.cppRequired ?? false;")).toBe(
      true,
    );
    expect(caught("isCppMode ?? false")).toBe(true);
    expect(caught("isCppMode: o?.isCppMode ?? vi.fn(() => false),")).toBe(true);
    expect(caught("static build(cppMode: boolean = false) {}")).toBe(true);
    expect(caught("const analyze = (cppMode = true) => cppMode;")).toBe(true);
    expect(caught("({\n  cppMode: false,\n  ...options,\n})")).toBe(true);
    expect(caught("generate(options: IHeaderOptions = {}) {}")).toBe(true);
    expect(caught("const generator = options?.cppMode ? cpp : c;")).toBe(true);

    // Negative controls: stating the mode, or a state reset, is not a default.
    expect(caught("state.cppMode = false;")).toBe(false);
    expect(caught("this.cppMode = false;")).toBe(false);
    expect(caught("({ cppMode: false, symbolInfo })")).toBe(false);
    expect(caught("({ ...options, cppMode: false })")).toBe(false);
    expect(caught("cppMode: program.cppMode(),")).toBe(false);
  });

  it("is reachable -- the owner is actually used", () => {
    // A gate on "nobody derives this" goes green if nobody needs it either.
    const callers = tsFilesUnder(SRC_ROOT, false)
      .filter((file) => !file.endsWith(OWNER))
      .filter((file) =>
        /OutputExtensions\.forCppMode\(/.test(readFileSync(file, "utf-8")),
      );

    expect(callers.length).toBeGreaterThan(0);
  });
});
