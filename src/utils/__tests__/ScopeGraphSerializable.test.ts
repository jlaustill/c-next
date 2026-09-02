/**
 * The symbol graph must be serializable (issue #1298).
 *
 * A symbol carries its scope as a live object, and the global scope is its own
 * parent, so the object graph is cyclic. Every consequence of that cycle is a
 * separate defect, and they share one cause:
 *
 * - `JsonCodec` recurses until the stack is exhausted, so no symbol graph can be
 *   cached, frozen, or written out.
 * - `ScopeUtils.getScopePath` walks the same chain, and its cycle guard is
 *   identity-based, so it neither terminates nor throws on a proxy chain.
 *
 * These tests assert the CAUSE is gone -- that no cycle is representable -- not
 * that a particular guard catches one. A guard that catches a cycle is evidence
 * the shape still admits cycles.
 */
import { describe, it, expect, beforeEach } from "vitest";
import ScopeUtils from "../ScopeUtils";
import SymbolRegistry from "../../transpiler/state/SymbolRegistry";
import JsonCodec from "../cache/JsonCodec";
import type TJsonValue from "../types/TJsonValue";

describe("symbol graph serializability (#1298)", () => {
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  it("encodes the global scope without exhausting the stack", () => {
    const global = SymbolRegistry.getGlobalScope();
    expect(() => JsonCodec.encode(global)).not.toThrow();
  });

  it("encodes a nested scope without exhausting the stack", () => {
    const inner = SymbolRegistry.getOrCreateScope("Outer.Inner");
    expect(() => JsonCodec.encode(inner)).not.toThrow();
  });

  it("round-trips a nested scope with its identity intact", () => {
    const inner = SymbolRegistry.getOrCreateScope("Outer.Inner");
    const revived = JsonCodec.decode(
      JsonCodec.encode(inner) as TJsonValue,
    ) as Record<string, unknown>;

    expect(revived.name).toBe("Inner");
    expect(revived.fullyQualifiedCName).toBe(inner.fullyQualifiedCName);
    expect(revived.cnxScopedName).toBe(inner.cnxScopedName);
  });

  it("encodes a scope built directly by ScopeUtils, not only registry-owned ones", () => {
    const outer = ScopeUtils.createScope("Outer", "");
    expect(() => JsonCodec.encode(outer)).not.toThrow();
  });
});
