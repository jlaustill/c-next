/**
 * Unit tests for DependencyGraph
 */

import { describe, it, expect, beforeEach } from "vitest";
import DependencyGraph from "../DependencyGraph";

describe("resolveToposortReverse", () => {
  const mockFn = () => [new Set(["a"])];

  it("should use direct export when available (vitest case)", () => {
    const mod = { toposortReverse: mockFn };
    expect(DependencyGraph.resolveToposortReverse(mod)).toBe(mockFn);
  });

  it("should fall back to default export (tsx case)", () => {
    const mod = { default: { toposortReverse: mockFn } };
    expect(DependencyGraph.resolveToposortReverse(mod)).toBe(mockFn);
  });
});

describe("DependencyGraph", () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  describe("addFile", () => {
    it("should add a file to the graph", () => {
      graph.addFile("a.cnx");
      expect(graph.size()).toBe(1);
    });

    it("should not duplicate files", () => {
      graph.addFile("a.cnx");
      graph.addFile("a.cnx");
      expect(graph.size()).toBe(1);
    });
  });

  describe("addDependency", () => {
    it("should add both files to the graph", () => {
      graph.addDependency("a.cnx", "b.cnx");
      expect(graph.size()).toBe(2);
    });

    it("should handle multiple dependencies", () => {
      graph.addDependency("a.cnx", "b.cnx");
      graph.addDependency("a.cnx", "c.cnx");
      expect(graph.size()).toBe(3);
    });
  });

  describe("getSortedFiles", () => {
    it("should return empty array for empty graph", () => {
      expect(graph.getSortedFiles()).toEqual([]);
    });

    it("should return single file for single node", () => {
      graph.addFile("a.cnx");
      expect(graph.getSortedFiles()).toEqual(["a.cnx"]);
    });

    it("should sort dependency before dependent", () => {
      // a depends on b, so b should come first
      graph.addDependency("a.cnx", "b.cnx");
      const sorted = graph.getSortedFiles();

      const bIndex = sorted.indexOf("b.cnx");
      const aIndex = sorted.indexOf("a.cnx");
      expect(bIndex).toBeLessThan(aIndex);
    });

    it("should handle chain of dependencies", () => {
      // a -> b -> c (a depends on b, b depends on c)
      graph.addDependency("a.cnx", "b.cnx");
      graph.addDependency("b.cnx", "c.cnx");

      const sorted = graph.getSortedFiles();

      const cIndex = sorted.indexOf("c.cnx");
      const bIndex = sorted.indexOf("b.cnx");
      const aIndex = sorted.indexOf("a.cnx");

      expect(cIndex).toBeLessThan(bIndex);
      expect(bIndex).toBeLessThan(aIndex);
    });

    it("should handle diamond dependencies", () => {
      // a -> b, a -> c, b -> d, c -> d
      graph.addDependency("a.cnx", "b.cnx");
      graph.addDependency("a.cnx", "c.cnx");
      graph.addDependency("b.cnx", "d.cnx");
      graph.addDependency("c.cnx", "d.cnx");

      const sorted = graph.getSortedFiles();

      const dIndex = sorted.indexOf("d.cnx");
      const bIndex = sorted.indexOf("b.cnx");
      const cIndex = sorted.indexOf("c.cnx");
      const aIndex = sorted.indexOf("a.cnx");

      // d must come before b and c
      expect(dIndex).toBeLessThan(bIndex);
      expect(dIndex).toBeLessThan(cIndex);
      // b and c must come before a
      expect(bIndex).toBeLessThan(aIndex);
      expect(cIndex).toBeLessThan(aIndex);
    });

    it("should handle independent files", () => {
      graph.addFile("a.cnx");
      graph.addFile("b.cnx");
      graph.addFile("c.cnx");

      const sorted = graph.getSortedFiles();
      expect(sorted).toHaveLength(3);
      expect(sorted).toContain("a.cnx");
      expect(sorted).toContain("b.cnx");
      expect(sorted).toContain("c.cnx");
    });

    it("should handle cycle and add warning", () => {
      // a -> b -> a (cycle)
      graph.addDependency("a.cnx", "b.cnx");
      graph.addDependency("b.cnx", "a.cnx");

      const sorted = graph.getSortedFiles();

      // Should still return files (not throw)
      expect(sorted).toHaveLength(2);
      expect(sorted).toContain("a.cnx");
      expect(sorted).toContain("b.cnx");

      // Should have a warning
      const warnings = graph.getWarnings();
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain("Circular dependency");
    });
  });

  describe("utility methods", () => {
    it("isEmpty should return true for empty graph", () => {
      expect(graph.isEmpty()).toBe(true);
    });

    it("isEmpty should return false for non-empty graph", () => {
      graph.addFile("a.cnx");
      expect(graph.isEmpty()).toBe(false);
    });

    it("clear should reset the graph", () => {
      graph.addFile("a.cnx");
      graph.addDependency("b.cnx", "c.cnx");
      graph.clear();
      expect(graph.isEmpty()).toBe(true);
      expect(graph.size()).toBe(0);
    });
  });
});

describe("collectDependentsOf (#1399 review)", () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph();
  });

  it("returns a seed even with no edges", () => {
    graph.addFile("a");
    expect([...graph.collectDependentsOf(new Set(["a"]))]).toEqual(["a"]);
  });

  it("returns nothing when no file reaches a seed", () => {
    graph.addDependency("a", "b");
    expect(graph.collectDependentsOf(new Set(["z"])).has("a")).toBe(false);
  });

  it("finds a direct includer", () => {
    graph.addDependency("app", "header-owner");
    const reaching = graph.collectDependentsOf(new Set(["header-owner"]));
    expect(reaching.has("app")).toBe(true);
  });

  it("finds a transitive includer — the defect this exists for", () => {
    // app -> bridge -> owner. The one-hop version saw nothing foreign in `app`
    // and wrongly kept the diagnostics enabled there.
    graph.addDependency("app", "bridge");
    graph.addDependency("bridge", "owner");
    const reaching = graph.collectDependentsOf(new Set(["owner"]));
    expect(reaching.has("app")).toBe(true);
    expect(reaching.has("bridge")).toBe(true);
  });

  it("leaves a sibling that does not reach the seed alone", () => {
    // The whole value of the precondition is that it is not all-or-nothing:
    // a file off the path keeps its diagnostics.
    graph.addDependency("entry", "tainted");
    graph.addDependency("entry", "clean");
    graph.addDependency("tainted", "owner");
    const reaching = graph.collectDependentsOf(new Set(["owner"]));
    expect(reaching.has("tainted")).toBe(true);
    expect(reaching.has("entry")).toBe(true);
    expect(reaching.has("clean")).toBe(false);
  });

  it("terminates on a cycle and still reports what reaches the seed", () => {
    // Include cycles are tolerated with a warning (#1167), so this cannot
    // assume a DAG.
    graph.addDependency("a", "b");
    graph.addDependency("b", "a");
    graph.addDependency("b", "owner");
    const reaching = graph.collectDependentsOf(new Set(["owner"]));
    expect(reaching.has("a")).toBe(true);
    expect(reaching.has("b")).toBe(true);
  });

  it("returns a cycle that reaches nothing as not reaching", () => {
    graph.addDependency("a", "b");
    graph.addDependency("b", "a");
    expect(graph.collectDependentsOf(new Set(["owner"])).has("a")).toBe(false);
  });

  it("handles an empty seed set", () => {
    graph.addDependency("a", "b");
    expect(graph.collectDependentsOf(new Set()).size).toBe(0);
  });
});
