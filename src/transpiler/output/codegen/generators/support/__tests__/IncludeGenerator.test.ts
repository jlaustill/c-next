import { describe, expect, it, vi, beforeEach } from "vitest";
import includeGenerators from "../IncludeGenerator";
import CnxFileResolver from "../../../../../data/CnxFileResolver";

const {
  transformIncludeDirective,
  extractDefineName,
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

  // ==========================================================================
  // extractDefineName
  // ==========================================================================

  describe("extractDefineName", () => {
    it("extracts simple define name", () => {
      expect(extractDefineName("#define FOO")).toBe("FOO");
    });

    it("extracts define name with underscore", () => {
      expect(extractDefineName("#define _GUARD_H")).toBe("_GUARD_H");
    });

    it("extracts define name with numbers", () => {
      expect(extractDefineName("#define VERSION_2")).toBe("VERSION_2");
    });

    it("handles whitespace after #", () => {
      expect(extractDefineName("#  define MY_FLAG")).toBe("MY_FLAG");
    });

    it("handles extra whitespace before name", () => {
      expect(extractDefineName("#define   SPACED")).toBe("SPACED");
    });

    it("extracts name from define with value", () => {
      expect(extractDefineName("#define MAX_SIZE 100")).toBe("MAX_SIZE");
    });

    it("extracts name from function-like macro", () => {
      expect(extractDefineName("#define ADD(a,b) ((a)+(b))")).toBe("ADD");
    });

    it("returns unknown for invalid define", () => {
      expect(extractDefineName("not a define")).toBe("unknown");
    });

    it("returns unknown for empty string", () => {
      expect(extractDefineName("")).toBe("unknown");
    });

    it("returns unknown for malformed define", () => {
      expect(extractDefineName("#define 123invalid")).toBe("unknown");
    });
  });

  // ==========================================================================
  // transformIncludeDirective - angle bracket includes
  // ==========================================================================

  describe("transformIncludeDirective - angle brackets", () => {
    it("transforms angle bracket .cnx include to .h", () => {
      const result = transformIncludeDirective("#include <utils.cnx>", {
        sourcePath: null,
      });
      expect(result).toBe("#include <utils.h>");
    });

    it("transforms angle bracket include with path", () => {
      const result = transformIncludeDirective("#include <lib/utils.cnx>", {
        sourcePath: null,
      });
      expect(result).toBe("#include <lib/utils.h>");
    });

    it("handles whitespace in directive", () => {
      const result = transformIncludeDirective("#  include  <file.cnx>", {
        sourcePath: null,
      });
      expect(result).toBe("#  include  <file.h>");
    });

    it("resolves path from inputs when available", () => {
      vi.mocked(CnxFileResolver.findCnxFile).mockReturnValue(
        "/project/src/Display/utils.cnx",
      );
      vi.mocked(CnxFileResolver.getRelativePathFromInputs).mockReturnValue(
        "Display/utils.cnx",
      );

      const result = transformIncludeDirective("#include <utils.cnx>", {
        sourcePath: "/project/src/main.cnx",
        includeDirs: ["/project/src/Display"],
        inputs: ["/project/src"],
      });

      expect(result).toBe("#include <Display/utils.h>");
      expect(CnxFileResolver.findCnxFile).toHaveBeenCalledWith("utils", [
        "/project/src",
        "/project/src/Display",
      ]);
    });

    it("falls back to simple replacement when file not found", () => {
      vi.mocked(CnxFileResolver.findCnxFile).mockReturnValue(null);

      const result = transformIncludeDirective("#include <missing.cnx>", {
        sourcePath: "/project/src/main.cnx",
        inputs: ["/project/src"],
      });

      expect(result).toBe("#include <missing.h>");
    });

    it("falls back when relative path cannot be calculated", () => {
      vi.mocked(CnxFileResolver.findCnxFile).mockReturnValue(
        "/external/lib.cnx",
      );
      vi.mocked(CnxFileResolver.getRelativePathFromInputs).mockReturnValue(
        null,
      );

      const result = transformIncludeDirective("#include <lib.cnx>", {
        sourcePath: "/project/src/main.cnx",
        inputs: ["/project/src"],
      });

      expect(result).toBe("#include <lib.h>");
    });

    it("falls back when no inputs provided", () => {
      vi.mocked(CnxFileResolver.findCnxFile).mockReturnValue(
        "/project/lib.cnx",
      );

      const result = transformIncludeDirective("#include <lib.cnx>", {
        sourcePath: "/project/src/main.cnx",
        inputs: [],
      });

      expect(result).toBe("#include <lib.h>");
    });
  });

  // ==========================================================================
  // transformIncludeDirective - quote includes
  // ==========================================================================

  describe("transformIncludeDirective - quotes", () => {
    it("transforms quoted .cnx include to .h", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(true);

      const result = transformIncludeDirective('#include "helper.cnx"', {
        sourcePath: "/project/src/main.cnx",
      });

      expect(result).toBe('#include "helper.h"');
    });

    it("transforms quoted include with relative path", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(true);

      const result = transformIncludeDirective('#include "../lib/utils.cnx"', {
        sourcePath: "/project/src/main.cnx",
      });

      expect(result).toBe('#include "../lib/utils.h"');
    });

    it("skips validation when sourcePath is null", () => {
      const result = transformIncludeDirective('#include "file.cnx"', {
        sourcePath: null,
      });

      expect(result).toBe('#include "file.h"');
      expect(CnxFileResolver.cnxFileExists).not.toHaveBeenCalled();
    });

    it("throws error when .cnx file not found", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(false);

      expect(() =>
        transformIncludeDirective('#include "missing.cnx"', {
          sourcePath: "/project/src/main.cnx",
        }),
      ).toThrow(/Included C-Next file not found: missing.cnx/);
    });

    it("includes search path in error message", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(false);

      expect(() =>
        transformIncludeDirective('#include "missing.cnx"', {
          sourcePath: "/project/src/main.cnx",
        }),
      ).toThrow(/Searched at:/);
    });

    it("includes source file in error message", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(false);

      expect(() =>
        transformIncludeDirective('#include "missing.cnx"', {
          sourcePath: "/project/src/main.cnx",
        }),
      ).toThrow(/Referenced in:.*main\.cnx/);
    });
  });

  // ==========================================================================
  // transformIncludeDirective - non-.cnx includes
  // ==========================================================================

  describe("transformIncludeDirective - passthrough", () => {
    it("passes through angle bracket .h includes unchanged", () => {
      const result = transformIncludeDirective("#include <stdio.h>", {
        sourcePath: "/project/main.cnx",
      });
      expect(result).toBe("#include <stdio.h>");
    });

    it("passes through quoted .h includes unchanged", () => {
      const result = transformIncludeDirective('#include "myheader.h"', {
        sourcePath: "/project/main.cnx",
      });
      expect(result).toBe('#include "myheader.h"');
    });

    it("passes through system includes unchanged", () => {
      const result = transformIncludeDirective("#include <stdint.h>", {
        sourcePath: null,
      });
      expect(result).toBe("#include <stdint.h>");
    });

    it("passes through C++ headers unchanged", () => {
      const result = transformIncludeDirective("#include <vector>", {
        sourcePath: null,
      });
      expect(result).toBe("#include <vector>");
    });

    it("passes through non-include text unchanged", () => {
      const result = transformIncludeDirective("int x = 5;", {
        sourcePath: null,
      });
      expect(result).toBe("int x = 5;");
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

    it("throws E0501 for function-like macro", () => {
      const mockCtx = {
        getText: () => "#define ADD(a,b) ((a)+(b))",
        DEFINE_FUNCTION: () => ({
          getText: () => "#define ADD(a,b) ((a)+(b))",
        }),
        DEFINE_WITH_VALUE: () => null,
        DEFINE_FLAG: () => null,
        start: { line: 10 },
      };

      expect(() => processDefineDirective(mockCtx as any)).toThrow(/E0501/);
    });

    it("includes macro name in E0501 error", () => {
      const mockCtx = {
        getText: () => "#define SQUARE(x) ((x)*(x))",
        DEFINE_FUNCTION: () => ({ getText: () => "#define SQUARE(x)" }),
        DEFINE_WITH_VALUE: () => null,
        DEFINE_FLAG: () => null,
        start: { line: 1 },
      };

      expect(() => processDefineDirective(mockCtx as any)).toThrow(/SQUARE/);
    });

    it("suggests inline functions for E0501", () => {
      const mockCtx = {
        getText: () => "#define MAX(a,b)",
        DEFINE_FUNCTION: () => ({ getText: () => "#define MAX(a,b)" }),
        DEFINE_WITH_VALUE: () => null,
        DEFINE_FLAG: () => null,
        start: { line: 1 },
      };

      expect(() => processDefineDirective(mockCtx as any)).toThrow(
        /inline functions/,
      );
    });

    it("throws E0502 for value define", () => {
      const mockCtx = {
        getText: () => "#define MAX_SIZE 100",
        DEFINE_FUNCTION: () => null,
        DEFINE_WITH_VALUE: () => ({ getText: () => "#define MAX_SIZE 100" }),
        DEFINE_FLAG: () => null,
        start: { line: 15 },
      };

      expect(() => processDefineDirective(mockCtx as any)).toThrow(/E0502/);
    });

    it("includes macro name in E0502 error", () => {
      const mockCtx = {
        getText: () => "#define BUFFER_SIZE 256",
        DEFINE_FUNCTION: () => null,
        DEFINE_WITH_VALUE: () => ({ getText: () => "#define BUFFER_SIZE 256" }),
        DEFINE_FLAG: () => null,
        start: { line: 1 },
      };

      expect(() => processDefineDirective(mockCtx as any)).toThrow(
        /BUFFER_SIZE/,
      );
    });

    it("suggests const for E0502", () => {
      const mockCtx = {
        getText: () => "#define COUNT 10",
        DEFINE_FUNCTION: () => null,
        DEFINE_WITH_VALUE: () => ({ getText: () => "#define COUNT 10" }),
        DEFINE_FLAG: () => null,
        start: { line: 1 },
      };

      expect(() => processDefineDirective(mockCtx as any)).toThrow(
        /const u32 COUNT/,
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

    it("handles missing start line gracefully", () => {
      const mockCtx = {
        getText: () => "#define MACRO(x)",
        DEFINE_FUNCTION: () => ({ getText: () => "#define MACRO(x)" }),
        DEFINE_WITH_VALUE: () => null,
        DEFINE_FLAG: () => null,
        start: null,
      };

      expect(() => processDefineDirective(mockCtx as any)).toThrow(/Line 0/);
    });
  });

  // ==========================================================================
  // processConditionalDirective
  // ==========================================================================

  describe("processConditionalDirective", () => {
    it("passes through #ifdef directive", () => {
      const mockCtx = {
        getText: () => "#ifdef DEBUG\n",
      };

      const result = processConditionalDirective(mockCtx as any);
      expect(result).toBe("#ifdef DEBUG");
    });

    it("passes through #ifndef directive", () => {
      const mockCtx = {
        getText: () => "#ifndef GUARD_H\n",
      };

      const result = processConditionalDirective(mockCtx as any);
      expect(result).toBe("#ifndef GUARD_H");
    });

    it("passes through #else directive", () => {
      const mockCtx = {
        getText: () => "#else\n",
      };

      const result = processConditionalDirective(mockCtx as any);
      expect(result).toBe("#else");
    });

    it("passes through #endif directive", () => {
      const mockCtx = {
        getText: () => "#endif\n",
      };

      const result = processConditionalDirective(mockCtx as any);
      expect(result).toBe("#endif");
    });

    it("trims whitespace from directive", () => {
      const mockCtx = {
        getText: () => "  #ifdef FEATURE  \n",
      };

      const result = processConditionalDirective(mockCtx as any);
      expect(result).toBe("#ifdef FEATURE");
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
        sourcePath: null,
      });
      expect(result1).toBe("#include <file.h>");

      // .txt should not match (only .cnx)
      const result2 = transformIncludeDirective("#include <file.txt>", {
        sourcePath: null,
      });
      expect(result2).toBe("#include <file.txt>");
    });

    it("handles .cnx extension variations in quotes", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(true);

      const result = transformIncludeDirective('#include "file.cnx"', {
        sourcePath: "/project/main.cnx",
      });
      expect(result).toBe('#include "file.h"');

      // .txt should not match (only .cnx)
      const result2 = transformIncludeDirective('#include "file.txt"', {
        sourcePath: "/project/main.cnx",
      });
      expect(result2).toBe('#include "file.txt"');
    });

    it("handles deeply nested paths in angle brackets", () => {
      const result = transformIncludeDirective("#include <a/b/c/d/file.cnx>", {
        sourcePath: null,
      });
      expect(result).toBe("#include <a/b/c/d/file.h>");
    });

    it("handles special characters in file names", () => {
      vi.mocked(CnxFileResolver.cnxFileExists).mockReturnValue(true);

      const result = transformIncludeDirective('#include "file-name_v2.cnx"', {
        sourcePath: "/project/main.cnx",
      });
      expect(result).toBe('#include "file-name_v2.h"');
    });
  });
});
