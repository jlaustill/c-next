/**
 * Unit tests for StandaloneContextBuilder
 * Issue #591: Tests for standalone context building logic
 *
 * Targets 100% coverage by testing all branches:
 * - processHeaders with/without debug mode
 * - processHeaders with/without header include directives
 * - processHeaders with/without errors
 * - processCNextIncludes with/without errors
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import StandaloneContextBuilder from "../StandaloneContextBuilder";
import IncludeResolver from "../../data/IncludeResolver";
import IncludeTreeWalker from "../../data/IncludeTreeWalker";
import IDiscoveredFile from "../../data/types/IDiscoveredFile";
import EFileType from "../../data/types/EFileType";

// Mock the dependencies
vi.mock("../../data/IncludeResolver", () => ({
  default: {
    resolveHeadersTransitively: vi.fn(),
  },
}));

vi.mock("../../data/IncludeTreeWalker", () => ({
  default: {
    walk: vi.fn(),
  },
}));

/**
 * Creates a mock transpiler for testing
 */
function createMockTranspiler(options?: {
  debugMode?: boolean;
  includeDirs?: string[];
  processedHeaders?: Set<string>;
}) {
  return {
    collectHeaderSymbols: vi.fn(),
    collectCNextSymbols: vi.fn(),
    getIncludeDirs: vi.fn().mockReturnValue(options?.includeDirs ?? ["/inc"]),
    setHeaderIncludeDirective: vi.fn(),
    addWarning: vi.fn(),
    getProcessedHeaders: vi
      .fn()
      .mockReturnValue(options?.processedHeaders ?? new Set()),
    isDebugMode: vi.fn().mockReturnValue(options?.debugMode ?? false),
  };
}

/**
 * Creates a mock IDiscoveredFile
 */
function createMockFile(
  path: string,
  type: EFileType = EFileType.CHeader,
): IDiscoveredFile {
  const extensions: Record<EFileType, string> = {
    [EFileType.CHeader]: ".h",
    [EFileType.CppHeader]: ".hpp",
    [EFileType.CNext]: ".cnx",
    [EFileType.CSource]: ".c",
    [EFileType.CppSource]: ".cpp",
    [EFileType.Unknown]: "",
  };
  return {
    path,
    type,
    extension: extensions[type],
  };
}

describe("StandaloneContextBuilder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // build() - Main entry point
  // ==========================================================================

  describe("build()", () => {
    it("should call processHeaders and processCNextIncludes", () => {
      const transpiler = createMockTranspiler();
      const resolved = {
        headers: [createMockFile("/path/types.h")],
        cnextIncludes: [createMockFile("/path/shared.cnx", EFileType.CNext)],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: resolved.headers,
        warnings: [],
      });

      // Capture the walk callback for later testing
      vi.mocked(IncludeTreeWalker.walk).mockImplementation(() => {});

      StandaloneContextBuilder.build(transpiler, resolved);

      // Verify resolveHeadersTransitively was called
      expect(IncludeResolver.resolveHeadersTransitively).toHaveBeenCalledWith(
        resolved.headers,
        ["/inc"],
        expect.objectContaining({
          processedPaths: transpiler.getProcessedHeaders(),
        }),
      );

      // Verify walk was called with cnextIncludes
      expect(IncludeTreeWalker.walk).toHaveBeenCalledWith(
        resolved.cnextIncludes,
        ["/inc"],
        expect.any(Function),
      );
    });
  });

  // ==========================================================================
  // processHeaders - Header processing logic
  // ==========================================================================

  describe("processHeaders()", () => {
    it("should process headers from resolveHeadersTransitively", () => {
      const transpiler = createMockTranspiler();
      const header = createMockFile("/path/types.h");
      const resolved = {
        headers: [header],
        cnextIncludes: [],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [header],
        warnings: [],
      });

      StandaloneContextBuilder.build(transpiler, resolved);

      expect(transpiler.collectHeaderSymbols).toHaveBeenCalledWith(header);
    });

    it("should set header include directive when present", () => {
      const transpiler = createMockTranspiler();
      const header = createMockFile("/path/types.h");
      const directive = '#include "types.h"';
      const resolved = {
        headers: [header],
        cnextIncludes: [],
        warnings: [],
        headerIncludeDirectives: new Map([[header.path, directive]]),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [header],
        warnings: [],
      });

      StandaloneContextBuilder.build(transpiler, resolved);

      expect(transpiler.setHeaderIncludeDirective).toHaveBeenCalledWith(
        header.path,
        directive,
      );
    });

    it("should NOT set header include directive when not present", () => {
      const transpiler = createMockTranspiler();
      const header = createMockFile("/path/types.h");
      const resolved = {
        headers: [header],
        cnextIncludes: [],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(), // Empty map
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [header],
        warnings: [],
      });

      StandaloneContextBuilder.build(transpiler, resolved);

      expect(transpiler.setHeaderIncludeDirective).not.toHaveBeenCalled();
    });

    it("should add warnings from header resolution", () => {
      const transpiler = createMockTranspiler();
      const resolved = {
        headers: [],
        cnextIncludes: [],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      const headerWarnings = [
        'Warning: #include "missing.h" not found',
        "Warning: Could not read header /bad/path.h",
      ];

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [],
        warnings: headerWarnings,
      });

      StandaloneContextBuilder.build(transpiler, resolved);

      expect(transpiler.addWarning).toHaveBeenCalledTimes(2);
      expect(transpiler.addWarning).toHaveBeenCalledWith(headerWarnings[0]);
      expect(transpiler.addWarning).toHaveBeenCalledWith(headerWarnings[1]);
    });

    it("should catch and report errors from collectHeaderSymbols", () => {
      const transpiler = createMockTranspiler();
      const header = createMockFile("/path/bad.h");
      const resolved = {
        headers: [header],
        cnextIncludes: [],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [header],
        warnings: [],
      });

      const testError = new Error("Parse failed");
      transpiler.collectHeaderSymbols.mockImplementation(() => {
        throw testError;
      });

      // Should not throw
      expect(() =>
        StandaloneContextBuilder.build(transpiler, resolved),
      ).not.toThrow();

      // Should add warning with error message
      expect(transpiler.addWarning).toHaveBeenCalledWith(
        `Failed to process header ${header.path}: ${testError}`,
      );
    });

    it("should process multiple headers in order", () => {
      const transpiler = createMockTranspiler();
      const header1 = createMockFile("/path/base.h");
      const header2 = createMockFile("/path/derived.h");
      const resolved = {
        headers: [header1, header2],
        cnextIncludes: [],
        warnings: [],
        headerIncludeDirectives: new Map([
          [header1.path, '#include "base.h"'],
          [header2.path, '#include "derived.h"'],
        ]),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [header1, header2],
        warnings: [],
      });

      const callOrder: string[] = [];
      transpiler.collectHeaderSymbols.mockImplementation(
        (h: IDiscoveredFile) => {
          callOrder.push(h.path);
        },
      );

      StandaloneContextBuilder.build(transpiler, resolved);

      expect(callOrder).toEqual([header1.path, header2.path]);
    });

    it("should pass debug callback when debug mode is enabled", () => {
      const transpiler = createMockTranspiler({ debugMode: true });
      const resolved = {
        headers: [],
        cnextIncludes: [],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [],
        warnings: [],
      });

      // Spy on console.log to verify debug callback works
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      StandaloneContextBuilder.build(transpiler, resolved);

      // Get the options passed to resolveHeadersTransitively
      const call = vi.mocked(IncludeResolver.resolveHeadersTransitively).mock
        .calls[0];
      const options = call[2];

      // onDebug should be defined when debug mode is on
      expect(options?.onDebug).toBeDefined();

      // Call the debug callback to verify it logs
      options?.onDebug?.("test message");
      expect(consoleSpy).toHaveBeenCalledWith("[DEBUG] test message");

      consoleSpy.mockRestore();
    });

    it("should NOT pass debug callback when debug mode is disabled", () => {
      const transpiler = createMockTranspiler({ debugMode: false });
      const resolved = {
        headers: [],
        cnextIncludes: [],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [],
        warnings: [],
      });

      StandaloneContextBuilder.build(transpiler, resolved);

      // Get the options passed to resolveHeadersTransitively
      const call = vi.mocked(IncludeResolver.resolveHeadersTransitively).mock
        .calls[0];
      const options = call[2];

      // onDebug should be undefined when debug mode is off
      expect(options?.onDebug).toBeUndefined();
    });

    it("should pass processedHeaders to resolveHeadersTransitively", () => {
      const processedHeaders = new Set(["/already/processed.h"]);
      const transpiler = createMockTranspiler({ processedHeaders });
      const resolved = {
        headers: [],
        cnextIncludes: [],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [],
        warnings: [],
      });

      StandaloneContextBuilder.build(transpiler, resolved);

      const call = vi.mocked(IncludeResolver.resolveHeadersTransitively).mock
        .calls[0];
      expect(call[2]?.processedPaths).toBe(processedHeaders);
    });

    it("should spread includeDirs into array for resolveHeadersTransitively", () => {
      const includeDirs = ["/dir1", "/dir2"];
      const transpiler = createMockTranspiler({ includeDirs });
      const resolved = {
        headers: [],
        cnextIncludes: [],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [],
        warnings: [],
      });

      StandaloneContextBuilder.build(transpiler, resolved);

      const call = vi.mocked(IncludeResolver.resolveHeadersTransitively).mock
        .calls[0];
      expect(call[1]).toEqual(["/dir1", "/dir2"]);
    });
  });

  // ==========================================================================
  // processCNextIncludes - C-Next include processing logic
  // ==========================================================================

  describe("processCNextIncludes()", () => {
    it("should call walk with cnextIncludes and includeDirs", () => {
      const transpiler = createMockTranspiler({ includeDirs: ["/inc"] });
      const cnxFile = createMockFile("/path/shared.cnx", EFileType.CNext);
      const resolved = {
        headers: [],
        cnextIncludes: [cnxFile],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [],
        warnings: [],
      });

      StandaloneContextBuilder.build(transpiler, resolved);

      expect(IncludeTreeWalker.walk).toHaveBeenCalledWith(
        [cnxFile],
        ["/inc"],
        expect.any(Function),
      );
    });

    it("should call collectCNextSymbols for each file in walk callback", () => {
      const transpiler = createMockTranspiler();
      const cnxFile = createMockFile("/path/shared.cnx", EFileType.CNext);
      const resolved = {
        headers: [],
        cnextIncludes: [cnxFile],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [],
        warnings: [],
      });

      // Capture and invoke the walk callback
      vi.mocked(IncludeTreeWalker.walk).mockImplementation(
        (includes, _dirs, callback) => {
          for (const include of includes) {
            callback(include as IDiscoveredFile);
          }
        },
      );

      StandaloneContextBuilder.build(transpiler, resolved);

      expect(transpiler.collectCNextSymbols).toHaveBeenCalledWith(cnxFile);
    });

    it("should catch errors and add warning in walk callback", () => {
      const transpiler = createMockTranspiler();
      const cnxFile = createMockFile("/path/broken.cnx", EFileType.CNext);
      const resolved = {
        headers: [],
        cnextIncludes: [cnxFile],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [],
        warnings: [],
      });

      const testError = new Error("Syntax error");
      transpiler.collectCNextSymbols.mockImplementation(() => {
        throw testError;
      });

      // Capture and invoke the walk callback
      vi.mocked(IncludeTreeWalker.walk).mockImplementation(
        (includes, _dirs, callback) => {
          for (const include of includes) {
            callback(include as IDiscoveredFile);
          }
        },
      );

      // Should not throw
      expect(() =>
        StandaloneContextBuilder.build(transpiler, resolved),
      ).not.toThrow();

      expect(transpiler.addWarning).toHaveBeenCalledWith(
        `Failed to process C-Next include ${cnxFile.path}: ${testError}`,
      );
    });

    it("should return false from walk callback on error to stop branch traversal", () => {
      const transpiler = createMockTranspiler();
      const cnxFile = createMockFile("/path/broken.cnx", EFileType.CNext);
      const resolved = {
        headers: [],
        cnextIncludes: [cnxFile],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [],
        warnings: [],
      });

      const testError = new Error("Syntax error");
      transpiler.collectCNextSymbols.mockImplementation(() => {
        throw testError;
      });

      let callbackResult: boolean | void = undefined;
      vi.mocked(IncludeTreeWalker.walk).mockImplementation(
        (includes, _dirs, callback) => {
          for (const include of includes) {
            callbackResult = callback(include as IDiscoveredFile);
          }
        },
      );

      StandaloneContextBuilder.build(transpiler, resolved);

      expect(callbackResult).toBe(false);
    });

    it("should process multiple C-Next includes", () => {
      const transpiler = createMockTranspiler();
      const cnxFile1 = createMockFile("/path/shared1.cnx", EFileType.CNext);
      const cnxFile2 = createMockFile("/path/shared2.cnx", EFileType.CNext);
      const resolved = {
        headers: [],
        cnextIncludes: [cnxFile1, cnxFile2],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [],
        warnings: [],
      });

      const processedFiles: string[] = [];
      vi.mocked(IncludeTreeWalker.walk).mockImplementation(
        (includes, _dirs, callback) => {
          for (const include of includes) {
            callback(include as IDiscoveredFile);
            processedFiles.push((include as IDiscoveredFile).path);
          }
        },
      );

      StandaloneContextBuilder.build(transpiler, resolved);

      expect(processedFiles).toEqual([cnxFile1.path, cnxFile2.path]);
      expect(transpiler.collectCNextSymbols).toHaveBeenCalledTimes(2);
    });
  });

  // ==========================================================================
  // Integration scenarios
  // ==========================================================================

  describe("integration scenarios", () => {
    it("should handle mixed headers and C-Next includes", () => {
      const transpiler = createMockTranspiler();
      const header = createMockFile("/path/types.h");
      const cnxFile = createMockFile("/path/shared.cnx", EFileType.CNext);
      const resolved = {
        headers: [header],
        cnextIncludes: [cnxFile],
        warnings: [],
        headerIncludeDirectives: new Map([[header.path, '#include "types.h"']]),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [header],
        warnings: [],
      });

      vi.mocked(IncludeTreeWalker.walk).mockImplementation(
        (includes, _dirs, callback) => {
          for (const include of includes) {
            callback(include as IDiscoveredFile);
          }
        },
      );

      StandaloneContextBuilder.build(transpiler, resolved);

      expect(transpiler.collectHeaderSymbols).toHaveBeenCalledWith(header);
      expect(transpiler.setHeaderIncludeDirective).toHaveBeenCalledWith(
        header.path,
        '#include "types.h"',
      );
      expect(transpiler.collectCNextSymbols).toHaveBeenCalledWith(cnxFile);
    });

    it("should handle empty inputs", () => {
      const transpiler = createMockTranspiler();
      const resolved = {
        headers: [],
        cnextIncludes: [],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [],
        warnings: [],
      });

      // Should not throw
      expect(() =>
        StandaloneContextBuilder.build(transpiler, resolved),
      ).not.toThrow();

      expect(transpiler.collectHeaderSymbols).not.toHaveBeenCalled();
      expect(transpiler.collectCNextSymbols).not.toHaveBeenCalled();
    });

    it("should continue processing after header error", () => {
      const transpiler = createMockTranspiler();
      const header1 = createMockFile("/path/bad.h");
      const header2 = createMockFile("/path/good.h");
      const resolved = {
        headers: [header1, header2],
        cnextIncludes: [],
        warnings: [],
        headerIncludeDirectives: new Map<string, string>(),
      };

      vi.mocked(IncludeResolver.resolveHeadersTransitively).mockReturnValue({
        headers: [header1, header2],
        warnings: [],
      });

      let callCount = 0;
      transpiler.collectHeaderSymbols.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error("First header failed");
        }
      });

      StandaloneContextBuilder.build(transpiler, resolved);

      // Should have tried to process both headers
      expect(transpiler.collectHeaderSymbols).toHaveBeenCalledTimes(2);
      // Should have added warning for the first one
      expect(transpiler.addWarning).toHaveBeenCalledWith(
        expect.stringContaining("bad.h"),
      );
    });
  });
});
