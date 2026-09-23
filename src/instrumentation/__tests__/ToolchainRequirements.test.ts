/**
 * Issue #1143's accumulator, extracted from `CodeGenState` by #1452.
 *
 * It had no unit coverage at all before the move -- the only thing watching it
 * was the banner line in 96 fixture snapshots, which can only fail on the
 * requirements a fixture happens to incur. These pin the four properties the
 * consumers depend on and a fixture cannot reach: dedup, the caller-supplied
 * source path, the defensive copy, and a reset that clears BOTH maps.
 */
import { describe, it, expect, beforeEach } from "vitest";
import ToolchainRequirements from "../ToolchainRequirements";

describe("ToolchainRequirements (#1143, moved by #1452)", () => {
  beforeEach(() => {
    ToolchainRequirements.reset();
  });

  describe("record", () => {
    it("reports a key recorded with no site at all", () => {
      // HelperGenerator and the two C++ initializer sites record bare keys.
      ToolchainRequirements.record("cpp-compound-literal");

      expect(ToolchainRequirements.collect()).toEqual([
        { key: "cpp-compound-literal", sites: [] },
      ]);
    });

    it("accumulates distinct sites under one key", () => {
      ToolchainRequirements.record("cpp-compound-literal", [
        { sourcePath: "a.cnx", line: 1 },
      ]);
      ToolchainRequirements.record("cpp-compound-literal", [
        { sourcePath: "a.cnx", line: 9 },
      ]);

      const [requirement] = ToolchainRequirements.collect();
      expect(requirement.sites).toEqual([
        { sourcePath: "a.cnx", line: 1 },
        { sourcePath: "a.cnx", line: 9 },
      ]);
    });

    it("does not record the same site twice", () => {
      // Two emitters can incur one requirement at one line; the banner must
      // not name it twice.
      ToolchainRequirements.record("cpp-compound-literal", [
        { sourcePath: "a.cnx", line: 1 },
      ]);
      ToolchainRequirements.record("cpp-compound-literal", [
        { sourcePath: "a.cnx", line: 1 },
      ]);

      expect(ToolchainRequirements.collect()[0].sites).toHaveLength(1);
    });

    it("keeps the same line in different files apart", () => {
      // Negative control for the dedup above: a body comparing only `line`
      // passes every row so far and fails this one.
      ToolchainRequirements.record("cpp-compound-literal", [
        { sourcePath: "a.cnx", line: 1 },
      ]);
      ToolchainRequirements.record("cpp-compound-literal", [
        { sourcePath: "b.cnx", line: 1 },
      ]);

      expect(ToolchainRequirements.collect()[0].sites).toHaveLength(2);
    });

    it("keeps separate keys separate", () => {
      // Negative control: a sink that merged everything into one bucket passes
      // all of the above.
      ToolchainRequirements.record("cpp-compound-literal", [
        { sourcePath: "a.cnx", line: 1 },
      ]);
      ToolchainRequirements.record("cpp-designated-initializer", [
        { sourcePath: "a.cnx", line: 2 },
      ]);

      expect(
        ToolchainRequirements.collect().map((requirement) => requirement.key),
      ).toEqual(["cpp-compound-literal", "cpp-designated-initializer"]);
    });
  });

  describe("collect", () => {
    it("hands out a copy, so a consumer cannot edit the record", () => {
      // Two consumers read this -- the banner and ITranspilerResult -- and the
      // banner formats what it is given. Returning the live array would let
      // the first reader change what the second one sees.
      ToolchainRequirements.record("cpp-compound-literal", [
        { sourcePath: "a.cnx", line: 1 },
      ]);

      const first = ToolchainRequirements.collect();
      (first[0].sites as { sourcePath: string; line: number }[]).push({
        sourcePath: "forged.cnx",
        line: 99,
      });

      expect(ToolchainRequirements.collect()[0].sites).toEqual([
        { sourcePath: "a.cnx", line: 1 },
      ]);
    });
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
    it("clears BOTH maps", () => {
      // #1143's leak: a reset that cleared one map attributed one file's CMSIS
      // or C11 cost to every later file. Asserting both in one test is
      // deliberate -- split, a reset that forgot the deferred map would still
      // show one green row.
      ToolchainRequirements.record("cpp-compound-literal", [
        { sourcePath: "a.cnx", line: 1 },
      ]);
      ToolchainRequirements.noteDeferredSite("irq_wrappers", "a.cnx", 1);

      ToolchainRequirements.reset();

      expect(ToolchainRequirements.collect()).toEqual([]);
      expect(ToolchainRequirements.takeDeferredSites("irq_wrappers")).toEqual(
        [],
      );
    });
  });
});
