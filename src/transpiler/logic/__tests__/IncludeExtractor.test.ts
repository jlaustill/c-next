/**
 * Unit tests for IncludeExtractor
 */

import { describe, it, expect } from "vitest";
import IncludeExtractor from "../IncludeExtractor";
import CNextSourceParser from "../parser/CNextSourceParser";

describe("IncludeExtractor", () => {
  describe("collectUserIncludes", () => {
    it("extracts and transforms .cnx includes to .h", () => {
      const source = `
        #include "types.cnx"
        #include "utils.cnx"

        void main() {}
      `;
      const { tree } = CNextSourceParser.parse(source);
      const includes = IncludeExtractor.collectUserIncludes(tree);

      expect(includes).toHaveLength(2);
      // Verify the includes contain the transformed .h extension
      expect(includes[0]).toContain("types.h");
      expect(includes[1]).toContain("utils.h");
    });

    it("transforms angle-bracket .cnx includes", () => {
      const source = `
        #include <system.cnx>

        void main() {}
      `;
      const { tree } = CNextSourceParser.parse(source);
      const includes = IncludeExtractor.collectUserIncludes(tree);

      expect(includes).toHaveLength(1);
      expect(includes[0]).toContain("system.h");
      expect(includes[0]).toContain("<");
    });

    it("ignores non-.cnx includes", () => {
      const source = `
        #include "types.h"
        #include <stdio.h>
        #include "utils.cnx"

        void main() {}
      `;
      const { tree } = CNextSourceParser.parse(source);
      const includes = IncludeExtractor.collectUserIncludes(tree);

      expect(includes).toHaveLength(1);
      expect(includes[0]).toContain("utils.h");
    });

    it("returns empty array when no .cnx includes", () => {
      const source = `
        #include "types.h"
        #include <stdio.h>

        void main() {}
      `;
      const { tree } = CNextSourceParser.parse(source);
      const includes = IncludeExtractor.collectUserIncludes(tree);

      expect(includes).toHaveLength(0);
    });

    it("returns empty array for source with no includes", () => {
      const source = `
        void main() {}
      `;
      const { tree } = CNextSourceParser.parse(source);
      const includes = IncludeExtractor.collectUserIncludes(tree);

      expect(includes).toHaveLength(0);
    });

    it("handles mixed include styles", () => {
      const source = `
        #include "local.cnx"
        #include <system.h>
        #include "other.cnx"
        #include <lib.cnx>

        void main() {}
      `;
      const { tree } = CNextSourceParser.parse(source);
      const includes = IncludeExtractor.collectUserIncludes(tree);

      expect(includes).toHaveLength(3);
      // Verify each transformed include is present
      const combined = includes.join(" ");
      expect(combined).toContain("local.h");
      expect(combined).toContain("other.h");
      expect(combined).toContain("lib.h");
    });

    it("does not include original .cnx extension in output", () => {
      const source = `
        #include "test.cnx"

        void main() {}
      `;
      const { tree } = CNextSourceParser.parse(source);
      const includes = IncludeExtractor.collectUserIncludes(tree);

      expect(includes).toHaveLength(1);
      expect(includes[0]).not.toContain(".cnx");
      expect(includes[0]).toContain(".h");
    });
  });
});
