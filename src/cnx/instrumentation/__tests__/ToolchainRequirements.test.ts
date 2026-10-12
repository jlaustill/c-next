/**
 * Issue #1143's accumulator, extracted from `CodeGenState` by #1452.
 *
 * It had no unit coverage at all before the move -- the only thing watching it
 * was the banner line in 96 fixture snapshots, which can only fail on the
 * requirements a fixture happens to incur. These pin the four properties the
 * consumers depend on and a fixture cannot reach: dedup, the caller-supplied
 * source path, and the reset. #1997 removed the key map, `record` and
 * `collect`: 2.2 Plan decides every key.
 */
import { describe, it, expect, beforeEach } from "vitest";
import ToolchainRequirements from "../ToolchainRequirements";

describe("ToolchainRequirements (#1143, moved by #1452)", () => {
  beforeEach(() => {
    ToolchainRequirements.reset();
  });

  describe("deferred sites", () => {
    it("attributes a site to the path the caller passed", () => {
      // #1452: this read `CodeGenState.sourcePath` off a global. The caller
      // supplies it now, which is the one change in behavior the move makes.
      ToolchainRequirements.noteDeferredSite("irq_wrappers", "motor.cnx", 12);

      expect(ToolchainRequirements.takeDeferredSites("irq_wrappers")).toEqual([
        { sourcePath: "motor.cnx", line: 12 },
      ]);
    });

    it("records a site with no line, for a request that cannot locate itself", () => {
      ToolchainRequirements.noteDeferredSite("irq_wrappers", "motor.cnx", null);

      expect(ToolchainRequirements.takeDeferredSites("irq_wrappers")).toEqual([
        { sourcePath: "motor.cnx", line: null },
      ]);
    });

    it("answers empty for a request nothing deferred", () => {
      expect(
        ToolchainRequirements.takeDeferredSites("float_static_assert"),
      ).toEqual([]);
    });

    it("records a repeated request at one site only", () => {
      ToolchainRequirements.noteDeferredSite("irq_wrappers", "motor.cnx", 12);
      ToolchainRequirements.noteDeferredSite("irq_wrappers", "motor.cnx", 12);

      expect(
        ToolchainRequirements.takeDeferredSites("irq_wrappers"),
      ).toHaveLength(1);
    });
  });

  describe("reset", () => {
    it("clears the deferred sites", () => {
      // #1143's leak: a reset that missed a map attributed one file's CMSIS or
      // C11 cost to every later file. Since #1997 the sites are the only map.
      ToolchainRequirements.noteDeferredSite("irq_wrappers", "a.cnx", 1);

      ToolchainRequirements.reset();

      expect(ToolchainRequirements.takeDeferredSites("irq_wrappers")).toEqual(
        [],
      );
    });
  });
});
