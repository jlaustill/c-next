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
import FunctionUtils from "../FunctionUtils";
import TTypeUtils from "../TTypeUtils";
import JsonCodec from "../cache/JsonCodec";
import type TJsonValue from "../types/TJsonValue";
import TestSourceSpan from "../../transpiler/types/__testUtils__/testSourceSpan";

/** A scope member, so a scope under test is a graph rather than a leaf. */
function makeInit(): ReturnType<typeof FunctionUtils.create> {
  return FunctionUtils.create({
    name: "init",
    scopePath: "Motor",
    parameters: [],
    returnType: TTypeUtils.createPrimitive("void"),
    visibility: "public",
    body: null,
    sourceFile: "motor.cnx",
    span: TestSourceSpan.at(1),
  });
}

describe("the symbol graph is serializable (#1298)", () => {
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

  it("encodes a scope that CONTAINS a registered function", () => {
    // The other half of the cycle, and the half an empty scope cannot reach
    // (#1298 review). A scope owns its members; the members must not own it
    // back. Restore `scope: IScopeSymbol` on IFunctionSymbol alone and this
    // recurses scope -> functions[0] -> scope, while every test above stays
    // green because none of them registers a member.
    const scope = SymbolRegistry.getOrCreateScope("Motor");
    SymbolRegistry.registerFunction(makeInit());

    expect(scope.functions).toHaveLength(1);
    expect(() => JsonCodec.encode(scope)).not.toThrow();
  });

  it("round-trips a scope with its member, both identities intact", () => {
    const scope = SymbolRegistry.getOrCreateScope("Motor");
    SymbolRegistry.registerFunction(makeInit());

    const revived = JsonCodec.decode(
      JsonCodec.encode(scope) as TJsonValue,
    ) as Record<string, unknown>;
    const functions = revived.functions as Array<Record<string, unknown>>;

    expect(functions).toHaveLength(1);
    expect(functions[0].fullyQualifiedCName).toBe("Motor__init");
    expect(functions[0].scopePath).toBe("Motor");
  });
});
