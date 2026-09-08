import { describe, expect, it, vi, beforeEach } from "vitest";
import includeGenerators from "../IncludeGenerator";
import CnxFileResolver from "../../../../../data/CnxFileResolver";

const {
  transformIncludeDirective,
  processDefineDirective,
  processConditionalDirective,
  processPreprocessorDirective,
} = includeGenerators;

// Mock CnxFileResolver for file system operations
vi.mock("../../../../../data/CnxFileResolver", () => ({
  default: {
    findCnxFile: vi.fn(),
    getRelativePathFromInputs: vi.fn(),
    cnxFileExists: vi.fn(),
  },
}));

describe("IncludeGenerator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("transformIncludeDirective - angle brackets", () => {
    // Issue #1467: `rewrites` is PathResolver's answer, arriving already
    // resolved. These tests assert that it is USED and that the fallback is
    // reached only when it has nothing to say -- not that this module can
    // resolve a path, which it no longer does and never could in production.
    const noRewrites = new Map<string, string>();

    it("transforms angle bracket .cnx include to .h", () => {
      const result = transformIncludeDirective("#include <utils.cnx>", {
        headerExtension: ".h",
        sourcePath: null,
        rewrites: noRewrites,
      });
      expect(result).toBe("#include <utils.h>");
    });

    it("transforms angle bracket include with path", () => {
      const result = transformIncludeDirective("#include <lib/utils.cnx>", {
        headerExtension: ".h",
        sourcePath: null,
        rewrites: noRewrites,
      });
      expect(result).toBe("#include <lib/utils.h>");
    });

    it("handles whitespace in directive", () => {
      const result = transformIncludeDirective("#  include  <file.cnx>", {
        headerExtension: ".h",
        sourcePath: null,
        rewrites: noRewrites,
      });
      expect(result).toBe("#  include  <file.h>");
    });

    it("names the resolved header, not the author's spelling", () => {
      const result = transformIncludeDirective("#include <utils.cnx>", {
        headerExtension: ".h",
        sourcePath: "/project/src/main.cnx",
        rewrites: new Map([["utils.cnx", "Display/utils.h"]]),
      });

      expect(result).toBe("#include <Display/utils.h>");
    });

    it("keeps a resolved path that is already what the author wrote", () => {
      const result = transformIncludeDirective("#include <Display/utils.cnx>", {
        headerExtension: ".h",
        sourcePath: "/project/src/main.cnx",
        rewrites: new Map([["Display/utils.cnx", "Display/utils.h"]]),
      });

      expect(result).toBe("#include <Display/utils.h>");
    });

    it("falls back to the extension swap when the resolver has no answer", () => {
      const result = transformIncludeDirective("#include <missing.cnx>", {
        headerExtension: ".h",
        sourcePath: "/project/src/main.cnx",
        rewrites: new Map([["other.cnx", "Elsewhere/other.h"]]),
      });

      expect(result).toBe("#include <missing.h>");
    });

    it("transforms angle bracket .cnx include to .hpp in C++ mode", () => {
      const result = transformIncludeDirective("#include <utils.cnx>", {
        sourcePath: null,
        headerExtension: ".hpp",
        rewrites: noRewrites,
      });
      expect(result).toBe("#include <utils.hpp>");
    });

    it("names the resolved .hpp header in C++ mode", () => {
      const result = transformIncludeDirective("#include <utils.cnx>", {
        sourcePath: "/project/src/main.cnx",
        headerExtension: ".hpp",
        rewrites: new Map([["utils.cnx", "Display/utils.hpp"]]),
      });

      expect(result).toBe("#include <Display/utils.hpp>");
    });

    it("falls back to .hpp in C++ mode when the resolver has no answer", () => {
      const result = transformIncludeDirective("#include <missing.cnx>", {
        sourcePath: "/project/src/main.cnx",
        headerExtension: ".hpp",
        rewrites: noRewrites,
      });

      expect(result).toBe("#include <missing.hpp>");
    });
  });

  // ==========================================================================
  // transformIncludeDirective - quote includes
  // ==========================================================================

  describe("transformIncludeDirective - quotes", () => {
    it("transforms quoted .cnx include to .h", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(true);

      const result = transformIncludeDirective('#include "helper.cnx"', {
        headerExtension: ".h",
        sourcePath: "/project/src/main.cnx",
        rewrites: new Map(),
      });

      expect(result).toBe('#include "helper.h"');
    });

    it("transforms quoted include with relative path", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(true);

      const result = transformIncludeDirective('#include "../lib/utils.cnx"', {
        headerExtension: ".h",
        sourcePath: "/project/src/main.cnx",
        rewrites: new Map(),
      });

      expect(result).toBe('#include "../lib/utils.h"');
    });

    it("skips validation when sourcePath is null", () => {
      const result = transformIncludeDirective('#include "file.cnx"', {
        headerExtension: ".h",
        sourcePath: null,
        rewrites: new Map(),
      });

      expect(result).toBe('#include "file.h"');
      expect(CnxFileResolver.cnxFileExists).not.toHaveBeenCalled();
    });

    // #1322: three cases pinning the `Included C-Next file not found` throw
    // stood here. It is E0506 in pass 2.1 now, reported at the directive rather
    // than as `1:0 Code generation failed: Error: …` with no code, and its
    // cases live in `1-Analyze/__tests__/IncludeDirectiveAnalyzer.test.ts`.
    // Transformation no longer consults the file system at all.

    it("transforms quoted .cnx include to .hpp in C++ mode", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(true);

      const result = transformIncludeDirective('#include "helper.cnx"', {
        sourcePath: "/project/src/main.cnx",
        headerExtension: ".hpp",
        rewrites: new Map(),
      });

      expect(result).toBe('#include "helper.hpp"');
    });

    it("transforms quoted include with relative path to .hpp in C++ mode", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(true);

      const result = transformIncludeDirective('#include "../lib/utils.cnx"', {
        sourcePath: "/project/src/main.cnx",
        headerExtension: ".hpp",
        rewrites: new Map(),
      });

      expect(result).toBe('#include "../lib/utils.hpp"');
    });
  });

  // ==========================================================================
  // transformIncludeDirective - non-.cnx includes
  // ==========================================================================

  describe("transformIncludeDirective - passthrough", () => {
    it("passes through angle bracket .h includes unchanged", () => {
      const result = transformIncludeDirective("#include <stdio.h>", {
        headerExtension: ".h",
        sourcePath: "/project/main.cnx",
        rewrites: new Map(),
      });
      expect(result).toBe("#include <stdio.h>");
    });

    it("passes through quoted .h includes unchanged", () => {
      const result = transformIncludeDirective('#include "myheader.h"', {
        headerExtension: ".h",
        sourcePath: "/project/main.cnx",
        rewrites: new Map(),
      });
      expect(result).toBe('#include "myheader.h"');
    });

    it("passes through system includes unchanged", () => {
      const result = transformIncludeDirective("#include <stdint.h>", {
        headerExtension: ".h",
        sourcePath: null,
        rewrites: new Map(),
      });
      expect(result).toBe("#include <stdint.h>");
    });

    it("passes through C++ headers unchanged", () => {
      const result = transformIncludeDirective("#include <vector>", {
        headerExtension: ".h",
        sourcePath: null,
        rewrites: new Map(),
      });
      expect(result).toBe("#include <vector>");
    });

    it("passes through non-include text unchanged", () => {
      const result = transformIncludeDirective("int x = 5;", {
        headerExtension: ".h",
        sourcePath: null,
        rewrites: new Map(),
      });
      expect(result).toBe("int x = 5;");
    });

    it("passes through .h includes unchanged even in C++ mode", () => {
      const result = transformIncludeDirective('#include "myheader.h"', {
        sourcePath: "/project/main.cnx",
        headerExtension: ".hpp",
        rewrites: new Map(),
      });
      expect(result).toBe('#include "myheader.h"');
    });
  });

  // ==========================================================================
  // processDefineDirective
  // ==========================================================================

  describe("processDefineDirective", () => {
    it("passes through flag-only define", () => {
      const mockCtx = {
        getText: () => "#define MY_FLAG\n",
        DEFINE_FUNCTION: () => null,
        DEFINE_WITH_VALUE: () => null,
        DEFINE_FLAG: () => ({ getText: () => "#define MY_FLAG" }),
        start: { line: 5 },
      };

      const result = processDefineDirective(mockCtx as any);
      expect(result).toBe("#define MY_FLAG");
    });

    // #1322: E0501 and E0502 are ADR-037 decisions and moved to pass 2.1's
    // DefineDirectiveAnalyzer, which parses real source instead of the
    // hand-built contexts these six tests mocked. What remains here is the
    // invariant that says so.
    it("asserts a function-like macro cannot reach codegen", () => {
      const mockCtx = {
        getText: () => "#define ADD(a,b) ((a)+(b))",
        DEFINE_FUNCTION: () => ({
          getText: () => "#define ADD(a,b) ((a)+(b))",
        }),
        DEFINE_WITH_VALUE: () => null,
        DEFINE_FLAG: () => null,
        start: { line: 10 },
      };

      expect(() => processDefineDirective(mockCtx as any)).toThrow(
        "E0501/E0502 reject this in pass 2.1",
      );
    });

    it("asserts a value define cannot reach codegen", () => {
      const mockCtx = {
        getText: () => "#define MAX_SIZE 100",
        DEFINE_FUNCTION: () => null,
        DEFINE_WITH_VALUE: () => ({ getText: () => "#define MAX_SIZE 100" }),
        DEFINE_FLAG: () => null,
        start: { line: 15 },
      };

      expect(() => processDefineDirective(mockCtx as any)).toThrow(
        "E0501/E0502 reject this in pass 2.1",
      );
    });

    it("returns null when no define token matched", () => {
      const mockCtx = {
        getText: () => "something else",
        DEFINE_FUNCTION: () => null,
        DEFINE_WITH_VALUE: () => null,
        DEFINE_FLAG: () => null,
        start: { line: 1 },
      };

      const result = processDefineDirective(mockCtx as any);
      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // processConditionalDirective
  // ==========================================================================

  describe("processConditionalDirective", () => {
    it.each([
      ["passes through #ifdef directive", "#ifdef DEBUG\n", "#ifdef DEBUG"],
      [
        "passes through #ifndef directive",
        "#ifndef GUARD_H\n",
        "#ifndef GUARD_H",
      ],
      ["passes through #else directive", "#else\n", "#else"],
      ["passes through #endif directive", "#endif\n", "#endif"],
      [
        "trims whitespace from directive",
        "  #ifdef FEATURE  \n",
        "#ifdef FEATURE",
      ],
    ])("%s", (_label, source, source2) => {
      const mockCtx = {
        getText: () => source,
      };

      const result = processConditionalDirective(mockCtx as any);
      expect(result).toBe(source2);
    });
  });

  // ==========================================================================
  // processPreprocessorDirective
  // ==========================================================================

  describe("processPreprocessorDirective", () => {
    it("delegates to processDefineDirective for defines", () => {
      const mockDefineCtx = {
        getText: () => "#define FLAG\n",
        DEFINE_FUNCTION: () => null,
        DEFINE_WITH_VALUE: () => null,
        DEFINE_FLAG: () => ({ getText: () => "#define FLAG" }),
        start: { line: 1 },
      };

      const mockCtx = {
        defineDirective: () => mockDefineCtx,
        conditionalDirective: () => null,
      };

      const result = processPreprocessorDirective(mockCtx as any);
      expect(result).toBe("#define FLAG");
    });

    it("delegates to processConditionalDirective for conditionals", () => {
      const mockCondCtx = {
        getText: () => "#ifdef TEST\n",
      };

      const mockCtx = {
        defineDirective: () => null,
        conditionalDirective: () => mockCondCtx,
      };

      const result = processPreprocessorDirective(mockCtx as any);
      expect(result).toBe("#ifdef TEST");
    });

    it("returns null for unrecognized directive", () => {
      const mockCtx = {
        defineDirective: () => null,
        conditionalDirective: () => null,
      };

      const result = processPreprocessorDirective(mockCtx as any);
      expect(result).toBeNull();
    });

    it("propagates error from define directive", () => {
      const mockDefineCtx = {
        getText: () => "#define FUNC(x)",
        DEFINE_FUNCTION: () => ({ getText: () => "#define FUNC(x)" }),
        DEFINE_WITH_VALUE: () => null,
        DEFINE_FLAG: () => null,
        start: { line: 5 },
      };

      const mockCtx = {
        defineDirective: () => mockDefineCtx,
        conditionalDirective: () => null,
      };

      expect(() => processPreprocessorDirective(mockCtx as any)).toThrow(
        /E0501/,
      );
    });
  });

  // ==========================================================================
  // Edge cases
  // ==========================================================================

  describe("edge cases", () => {
    it("handles .cnx extension variations in angle brackets", () => {
      // Only exact .cnx should match
      const result1 = transformIncludeDirective("#include <file.cnx>", {
        headerExtension: ".h",
        sourcePath: null,
        rewrites: new Map(),
      });
      expect(result1).toBe("#include <file.h>");

      // .txt should not match (only .cnx)
      const result2 = transformIncludeDirective("#include <file.txt>", {
        headerExtension: ".h",
        sourcePath: null,
        rewrites: new Map(),
      });
      expect(result2).toBe("#include <file.txt>");
    });

    it("handles .cnx extension variations in quotes", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(true);

      const result = transformIncludeDirective('#include "file.cnx"', {
        headerExtension: ".h",
        sourcePath: "/project/main.cnx",
        rewrites: new Map(),
      });
      expect(result).toBe('#include "file.h"');

      // .txt should not match (only .cnx)
      const result2 = transformIncludeDirective('#include "file.txt"', {
        headerExtension: ".h",
        sourcePath: "/project/main.cnx",
        rewrites: new Map(),
      });
      expect(result2).toBe('#include "file.txt"');
    });

    it("handles deeply nested paths in angle brackets", () => {
      const result = transformIncludeDirective("#include <a/b/c/d/file.cnx>", {
        headerExtension: ".h",
        sourcePath: null,
        rewrites: new Map(),
      });
      expect(result).toBe("#include <a/b/c/d/file.h>");
    });

    it("handles special characters in file names", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(true);

      const result = transformIncludeDirective('#include "file-name_v2.cnx"', {
        headerExtension: ".h",
        sourcePath: "/project/main.cnx",
        rewrites: new Map(),
      });
      expect(result).toBe('#include "file-name_v2.h"');
    });
  });
});
