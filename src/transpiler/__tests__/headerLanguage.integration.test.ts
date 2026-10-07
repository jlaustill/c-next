/**
 * #1844: a header's language is decided once, by 1.1 Discover, on the text a C
 * compile meets, and every later stage reads that answer.
 *
 * Owner rulings: a run's C/C++ mode is detected, not declared -- any C++ header
 * makes the whole run C++ (#1428) -- except that a config which says
 * `cppRequired: false` asked for C, and C++ met there is still E0507 (#1844).
 * The text judged is the C-preprocessed one (#1542, ruling 4).
 *
 * Every test runs twice against the same cache: the second, warm, run is where
 * #1851 lived -- it re-sniffed the RAW text a cold run had preprocessed away.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Transpiler from "../Transpiler";
import Preprocessor from "../../PARSE/1-Discover/preprocessor/Preprocessor";
import NodeFileSystem from "../../PARSE/1-Discover/NodeFileSystem";
import type ITranspilerResult from "../types/ITranspilerResult";

/** C++ that exists only in the raw text: the preprocessor removes it. */
const CPP_PREPROCESSED_AWAY = `#define FEATURE 0
#if FEATURE != 0
namespace Hidden { int x; }
#endif
int helper(void);
`;

/**
 * C++ that exists only in the preprocessed text: `name##space` is no C++ token
 * until it is pasted, so the raw text reads as C.
 */
const CPP_ONLY_AFTER_PREPROCESSING = `#define USE_SCOPE 1
#define PASTE(a, b) a##b
#if USE_SCOPE
PASTE(name, space) Shown { int y; }
#endif
int helper(void);
`;

const errorsOf = (result: ITranspilerResult): string =>
  result.errors.map((e) => e.message).join("\n");

const emitted = (result: ITranspilerResult, ext: ".c" | ".cpp"): boolean =>
  result.outputFiles.some((f) => f.endsWith(ext));

describe("a header's language is decided once, in 1.1 (#1844)", () => {
  let dir: string;
  const preprocessorAvailable = new Preprocessor(
    NodeFileSystem.instance,
  ).isAvailable();

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-header-language-"));
    // A project root, so the cache is on and the second run is warm.
    writeFileSync(join(dir, "cnext.config.json"), "{}");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** Write the headers, include `entry` from main.cnx, and run cold then warm. */
  const coldThenWarm = async (
    headers: Record<string, string>,
    entry: string,
    cppRequired?: boolean,
  ): Promise<readonly [ITranspilerResult, ITranspilerResult]> => {
    for (const [name, text] of Object.entries(headers)) {
      writeFileSync(join(dir, name), text);
    }
    writeFileSync(
      join(dir, "main.cnx"),
      `#include "${entry}"\n\nvoid main() { }\n`,
    );
    const config = {
      input: join(dir, "main.cnx"),
      includeDirs: [dir],
      outDir: dir,
      headerOutDir: dir,
      noCache: false,
      target: "host",
      ...(cppRequired === undefined ? {} : { cppRequired }),
    };
    const run = () =>
      new Transpiler(config, NodeFileSystem.instance).transpile({
        kind: "files",
      });
    const cold = await run();
    const warm = await run();
    return [cold, warm] as const;
  };

  describe("a run that does not say", () => {
    it("is C++ when it includes a .hpp", async () => {
      const runs = await coldThenWarm(
        { "utils.hpp": "int helper();" },
        "utils.hpp",
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".cpp")).toBe(true);
        expect(emitted(result, ".c")).toBe(false);
      }
    });

    it("is C++ when a .h holds C++", async () => {
      const runs = await coldThenWarm(
        { "types.h": "enum Status : uint8_t { OK, ERR };" },
        "types.h",
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".cpp")).toBe(true);
      }
    });

    it("is C++ when the C++ is reached through a C header", async () => {
      const runs = await coldThenWarm(
        {
          "outer.h": '#include "inner.hpp"\nint outer(void);\n',
          "inner.hpp": "int inner();",
        },
        "outer.h",
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".cpp")).toBe(true);
      }
    });

    it("is C when every header is C (negative control)", async () => {
      const runs = await coldThenWarm(
        { "plain.h": "typedef int MyInt;" },
        "plain.h",
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".c")).toBe(true);
        expect(emitted(result, ".cpp")).toBe(false);
      }
    });

    it("judges the preprocessed text: C++ removed by #if is C, cold and warm (#1851)", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(
        { "cfg.h": CPP_PREPROCESSED_AWAY },
        "cfg.h",
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".c")).toBe(true);
      }
    });

    it("judges the preprocessed text: C++ made by the preprocessor is C++", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(
        { "paste.h": CPP_ONLY_AFTER_PREPROCESSING },
        "paste.h",
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".cpp")).toBe(true);
      }
    });
  });

  describe("a run whose config says cppRequired: false", () => {
    it("rejects a .hpp with E0507, cold and warm", async () => {
      const runs = await coldThenWarm(
        { "utils.hpp": "int helper();" },
        "utils.hpp",
        false,
      );

      for (const result of runs) {
        expect(result.success).toBe(false);
        expect(errorsOf(result)).toContain("error[E0507]: C++ header");
        expect(errorsOf(result)).toContain("utils.hpp");
      }
    });

    it("rejects C++ reached through a C header with E0507", async () => {
      const runs = await coldThenWarm(
        {
          "outer.h": '#include "inner.hpp"\nint outer(void);\n',
          "inner.hpp": "int inner();",
        },
        "outer.h",
        false,
      );

      for (const result of runs) {
        expect(result.success).toBe(false);
        expect(errorsOf(result)).toContain("inner.hpp");
        // #1542 owner ruling: at main.cnx's own include of the C header
        expect(result.errors[0]).toMatchObject({
          sourcePath: join(dir, "main.cnx"),
          line: 1,
          column: 0,
        });
      }
    });

    it("rejects C++ the preprocessor makes, with E0507", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(
        { "paste.h": CPP_ONLY_AFTER_PREPROCESSING },
        "paste.h",
        false,
      );

      for (const result of runs) {
        expect(result.success).toBe(false);
        expect(errorsOf(result)).toContain("error[E0507]: C++ syntax");
      }
    });

    it("accepts C++ the preprocessor removes, cold and warm (#1851)", async (ctx) => {
      if (!preprocessorAvailable) ctx.skip();

      const runs = await coldThenWarm(
        { "cfg.h": CPP_PREPROCESSED_AWAY },
        "cfg.h",
        false,
      );

      for (const result of runs) {
        expect(errorsOf(result)).toBe("");
        expect(emitted(result, ".c")).toBe(true);
      }
    });
  });

  it("a run that says cppRequired: true is C++ with only C headers", async () => {
    const runs = await coldThenWarm(
      { "plain.h": "typedef int MyInt;" },
      "plain.h",
      true,
    );

    for (const result of runs) {
      expect(errorsOf(result)).toBe("");
      expect(emitted(result, ".cpp")).toBe(true);
    }
  });
});
