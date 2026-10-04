/**
 * Issue #1178: resolving a callee the C-Next call graph cannot see.
 *
 * The propagator reaches ModificationFacts' resolver only when
 * functionParamLists has no entry for the callee. Before #1178 that returned
 * "not modified", which is the same answer as "the callee is pure" -- so
 * auto-const was applied on the strength of an absent answer.
 *
 * These cover what the resolver decides from a C declaration, and the fail-safe
 * for a callee nothing declares.
 */

import { describe, it, expect, beforeEach } from "vitest";
import ModificationFacts from "../ModificationFacts";
import SymbolTable from "../../3-Declare/SymbolTable";
import ESourceLanguage from "../../../utils/types/ESourceLanguage";
import type TCSymbol from "../../../types/symbols/c/TCSymbol";
import type ICallGraphEntry from "../../../types/ICallGraphEntry";
import TestSourceSpan from "../../../types/__testUtils__/testSourceSpan";

interface IParameterShape {
  name: string;
  type: string;
  isConst: boolean;
  isArray: boolean;
}

const declareCFunction = (
  name: string,
  parameters: IParameterShape[],
): TCSymbol =>
  ({
    kind: "function",
    name,
    sourceFile: "sink.h",
    span: TestSourceSpan.at(1),
    sourceLanguage: ESourceLanguage.C,
    visibility: "public",
    type: "void",
    parameters,
  }) as TCSymbol;

const declareCTypedef = (name: string, aliased: string): TCSymbol =>
  ({
    kind: "type",
    name,
    sourceFile: "sink.h",
    span: TestSourceSpan.at(1),
    sourceLanguage: ESourceLanguage.C,
    visibility: "public",
    type: aliased,
  }) as TCSymbol;

let symbolTable = new SymbolTable();

/**
 * What production supplies when no C-Next symbol is in play: a value is a
 * variable the table declares.
 */
const isValueSymbol = (name: string): boolean =>
  symbolTable
    .getOverloadsByCName(name)
    .some((symbol) => symbol.kind === "variable");

/**
 * Propagate one caller's calls and report which of its parameters came back
 * marked as modified (auto-const withheld).
 */
const modifiedAfterPropagation = (
  caller: string,
  params: string[],
  calls: ICallGraphEntry[],
): ReadonlySet<string> => {
  const modifiedParameters = new Map([[caller, new Set<string>()]]);
  ModificationFacts.propagate(
    new Map([[caller, calls]]),
    new Map([[caller, params]]),
    modifiedParameters,
    symbolTable,
    isValueSymbol,
  );
  return modifiedParameters.get(caller)!;
};

/**
 * Drive one forwarded call through the propagator. The caller is known; the
 * callee deliberately is not, so the propagator must fall through to the
 * resolver.
 */
const callerParameterIsModified = (callee: string): boolean =>
  modifiedAfterPropagation(
    "Caller__forward",
    ["value"],
    [{ callee, paramIndex: 0, argParamName: "value" }],
  ).has("value");

describe("ModificationFacts callee resolution (#1178)", () => {
  beforeEach(() => {
    symbolTable = new SymbolTable();
  });

  it("keeps auto-const when the C parameter is passed by value", () => {
    symbolTable.addCSymbol(
      declareCFunction("c_read_value", [
        { name: "v", type: "uint8_t", isConst: false, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("c_read_value")).toBe(false);
  });

  it("withholds auto-const when the C parameter is a pointer", () => {
    symbolTable.addCSymbol(
      declareCFunction("c_bump", [
        { name: "s", type: "Sample*", isConst: false, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("c_bump")).toBe(true);
  });

  it("keeps auto-const for a pointer to const, which cannot be written through", () => {
    symbolTable.addCSymbol(
      declareCFunction("c_read", [
        { name: "s", type: "Sample*", isConst: true, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("c_read")).toBe(false);
  });

  it("withholds auto-const when the C parameter is an array", () => {
    symbolTable.addCSymbol(
      declareCFunction("c_fill", [
        { name: "buffer", type: "uint8_t", isConst: false, isArray: true },
      ]),
    );

    expect(callerParameterIsModified("c_fill")).toBe(true);
  });

  it("sees through a typedef that hides the pointer", () => {
    // typedef struct spi_device_t *spi_device_handle_t;
    symbolTable.addCSymbol(
      declareCTypedef("spi_device_handle_t", "struct spi_device_t*"),
    );
    symbolTable.addCSymbol(
      declareCFunction("spi_send", [
        {
          name: "handle",
          type: "spi_device_handle_t",
          isConst: false,
          isArray: false,
        },
      ]),
    );

    expect(callerParameterIsModified("spi_send")).toBe(true);
  });

  it("does not treat a typedef of a plain value as indirection", () => {
    symbolTable.addCSymbol(declareCTypedef("byte_t", "unsigned char"));
    symbolTable.addCSymbol(
      declareCFunction("take_byte", [
        { name: "b", type: "byte_t", isConst: false, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("take_byte")).toBe(false);
  });

  it("terminates on a self-referential typedef chain", () => {
    symbolTable.addCSymbol(declareCTypedef("loop_a", "loop_b"));
    symbolTable.addCSymbol(declareCTypedef("loop_b", "loop_a"));
    symbolTable.addCSymbol(
      declareCFunction("take_loop", [
        { name: "v", type: "loop_a", isConst: false, isArray: false },
      ]),
    );

    // Terminating on a repeat means the chain is unfinished, not by-value, so
    // it fails safe like hop exhaustion.
    expect(callerParameterIsModified("take_loop")).toBe(true);
  });

  it("fails safe when nothing declares the callee", () => {
    // The whole point of #1178: absent knowledge must not read as "pure".
    expect(callerParameterIsModified("nobody_declares_this")).toBe(true);
  });

  it("fails safe when the declaration has no parameter at that position", () => {
    symbolTable.addCSymbol(declareCFunction("c_no_args", []));

    expect(callerParameterIsModified("c_no_args")).toBe(true);
  });

  it("gives up on an alias chain longer than the hop bound", () => {
    // Nine distinct links: termination here comes from the hop limit rather
    // than the repeat guard, so the bound itself is exercised.
    const links = [
      "link0",
      "link1",
      "link2",
      "link3",
      "link4",
      "link5",
      "link6",
      "link7",
      "link8",
    ];
    links.forEach((name, index) => {
      const target = index === links.length - 1 ? "uint8_t*" : links[index + 1];
      symbolTable.addCSymbol(declareCTypedef(name, target));
    });
    symbolTable.addCSymbol(
      declareCFunction("take_deep_alias", [
        { name: "v", type: "link0", isConst: false, isArray: false },
      ]),
    );

    // Out of hops means the chain is known and unfinished, not unknown, so the
    // bound fails safe rather than asserting "by value".
    expect(callerParameterIsModified("take_deep_alias")).toBe(true);
  });

  it("folds across overloads instead of answering from the first", () => {
    // Declaration order must not decide the answer. The const overload is
    // declared first; the mutating one still wins.
    symbolTable.addCSymbol(
      declareCFunction("store", [
        { name: "s", type: "Sample*", isConst: true, isArray: false },
      ]),
    );
    symbolTable.addCSymbol(
      declareCFunction("store", [
        { name: "s", type: "Sample*", isConst: false, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("store")).toBe(true);
  });

  it("gives the same answer when the overloads are declared in the other order", () => {
    symbolTable.addCSymbol(
      declareCFunction("store", [
        { name: "s", type: "Sample*", isConst: false, isArray: false },
      ]),
    );
    symbolTable.addCSymbol(
      declareCFunction("store", [
        { name: "s", type: "Sample*", isConst: true, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("store")).toBe(true);
  });

  it("keeps auto-const when every overload takes the parameter by value", () => {
    symbolTable.addCSymbol(
      declareCFunction("emit", [
        { name: "v", type: "uint8_t", isConst: false, isArray: false },
      ]),
    );
    symbolTable.addCSymbol(
      declareCFunction("emit", [
        { name: "v", type: "uint16_t", isConst: false, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("emit")).toBe(false);
  });

  describe("indirect (ADR-029 callback) invocation", () => {
    const declareCVariable = (name: string): TCSymbol =>
      ({
        kind: "variable",
        name,
        sourceFile: "sink.h",
        span: TestSourceSpan.at(1),
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        type: "void*",
      }) as TCSymbol;

    it("keeps auto-const when the callee is one of the caller's parameters", () => {
      // `void forward(handler cb, u8 value) { cb(value); }` -- `cb` is a value,
      // so no declaration will ever match it. Failing safe here fired on every
      // callback by construction.
      const modified = modifiedAfterPropagation(
        "forward",
        ["cb", "value"],
        [{ callee: "cb", paramIndex: 0, argParamName: "value" }],
      );

      expect(modified.has("value")).toBe(false);
    });

    it("keeps auto-const when the callee is a variable rather than a function", () => {
      symbolTable.addCSymbol(declareCVariable("listener"));

      expect(callerParameterIsModified("listener")).toBe(false);
    });

    it("still fails safe for a name that is neither parameter nor variable", () => {
      // The guard must not swallow the case #1178 exists for.
      expect(callerParameterIsModified("undeclared_function")).toBe(true);
    });
  });

  it("ignores a C-Next symbol, whose parameter types are not strings", () => {
    // getOverloadsByCName spans all three languages and a C-Next
    // IFunctionSymbol also has kind "function", but its IParameterInfo.type is
    // a TType object. Reading it as a string reached .replace() on an object,
    // turning a clean "Symbol conflict" diagnostic into an internal crash.
    const cnextFunction = {
      kind: "function",
      name: "emit",
      scopePath: "",
      sourceFile: "a.cnx",
      span: TestSourceSpan.at(1),
      sourceLanguage: ESourceLanguage.CNext,
      visibility: "public",
      body: undefined,
      returnType: { kind: "primitive", primitive: "void" },
      parameters: [
        {
          name: "b",
          type: { kind: "primitive", primitive: "u8" },
          isConst: false,
          isArray: false,
        },
      ],
    } as unknown as Parameters<SymbolTable["addTSymbol"]>[0];
    symbolTable.addTSymbol(cnextFunction);

    // Must not throw, and must fall through to the fail-safe rather than
    // answering from a shape it cannot read.
    expect(() => callerParameterIsModified("emit")).not.toThrow();
    expect(callerParameterIsModified("emit")).toBe(true);
  });
});
