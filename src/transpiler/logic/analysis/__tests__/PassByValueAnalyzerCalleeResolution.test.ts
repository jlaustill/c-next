/**
 * Issue #1178: resolving a callee the C-Next call graph cannot see.
 *
 * The propagator reaches PassByValueAnalyzer's resolver only when
 * functionParamLists has no entry for the callee. Before #1178 that returned
 * "not modified", which is the same answer as "the callee is pure" -- so
 * auto-const was applied on the strength of an absent answer.
 *
 * These cover what the resolver decides from a C declaration, and the fail-safe
 * for a callee nothing declares.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import PassByValueAnalyzer from "../PassByValueAnalyzer.js";
import CodeGenState from "../../../state/CodeGenState.js";
import SymbolTable from "../../symbols/SymbolTable.js";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage.js";
import type TCSymbol from "../../../types/symbols/c/TCSymbol.js";

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
    sourceLine: 1,
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
    sourceLine: 1,
    sourceLanguage: ESourceLanguage.C,
    visibility: "public",
    type: aliased,
  }) as TCSymbol;

/**
 * Drive one forwarded call through the propagator and report whether the
 * caller's parameter came back marked as modified (auto-const withheld).
 */
const callerParameterIsModified = (callee: string): boolean => {
  CodeGenState.functionCallGraph.clear();
  CodeGenState.functionParamLists.clear();
  CodeGenState.modifiedParameters.clear();

  // The caller is known; the callee deliberately is not, so the propagator
  // must fall through to the resolver.
  CodeGenState.functionParamLists.set("Caller__forward", ["value"]);
  CodeGenState.modifiedParameters.set("Caller__forward", new Set());
  CodeGenState.functionCallGraph.set("Caller__forward", [
    { callee, paramIndex: 0, argParamName: "value" },
  ]);

  PassByValueAnalyzer.propagateModifications();

  return CodeGenState.modifiedParameters.get("Caller__forward")!.has("value");
};

describe("PassByValueAnalyzer callee resolution (#1178)", () => {
  beforeEach(() => {
    CodeGenState.symbolTable = new SymbolTable();
  });

  afterEach(() => {
    CodeGenState.reset();
    CodeGenState.symbolTable = new SymbolTable();
  });

  it("keeps auto-const when the C parameter is passed by value", () => {
    CodeGenState.symbolTable.addCSymbol(
      declareCFunction("c_read_value", [
        { name: "v", type: "uint8_t", isConst: false, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("c_read_value")).toBe(false);
  });

  it("withholds auto-const when the C parameter is a pointer", () => {
    CodeGenState.symbolTable.addCSymbol(
      declareCFunction("c_bump", [
        { name: "s", type: "Sample*", isConst: false, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("c_bump")).toBe(true);
  });

  it("keeps auto-const for a pointer to const, which cannot be written through", () => {
    CodeGenState.symbolTable.addCSymbol(
      declareCFunction("c_read", [
        { name: "s", type: "Sample*", isConst: true, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("c_read")).toBe(false);
  });

  it("withholds auto-const when the C parameter is an array", () => {
    CodeGenState.symbolTable.addCSymbol(
      declareCFunction("c_fill", [
        { name: "buffer", type: "uint8_t", isConst: false, isArray: true },
      ]),
    );

    expect(callerParameterIsModified("c_fill")).toBe(true);
  });

  it("sees through a typedef that hides the pointer", () => {
    // typedef struct spi_device_t *spi_device_handle_t;
    CodeGenState.symbolTable.addCSymbol(
      declareCTypedef("spi_device_handle_t", "struct spi_device_t*"),
    );
    CodeGenState.symbolTable.addCSymbol(
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
    CodeGenState.symbolTable.addCSymbol(
      declareCTypedef("byte_t", "unsigned char"),
    );
    CodeGenState.symbolTable.addCSymbol(
      declareCFunction("take_byte", [
        { name: "b", type: "byte_t", isConst: false, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("take_byte")).toBe(false);
  });

  it("terminates on a self-referential typedef chain", () => {
    CodeGenState.symbolTable.addCSymbol(declareCTypedef("loop_a", "loop_b"));
    CodeGenState.symbolTable.addCSymbol(declareCTypedef("loop_b", "loop_a"));
    CodeGenState.symbolTable.addCSymbol(
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
    CodeGenState.symbolTable.addCSymbol(declareCFunction("c_no_args", []));

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
      CodeGenState.symbolTable.addCSymbol(declareCTypedef(name, target));
    });
    CodeGenState.symbolTable.addCSymbol(
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
    CodeGenState.symbolTable.addCSymbol(
      declareCFunction("store", [
        { name: "s", type: "Sample*", isConst: true, isArray: false },
      ]),
    );
    CodeGenState.symbolTable.addCSymbol(
      declareCFunction("store", [
        { name: "s", type: "Sample*", isConst: false, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("store")).toBe(true);
  });

  it("gives the same answer when the overloads are declared in the other order", () => {
    CodeGenState.symbolTable.addCSymbol(
      declareCFunction("store", [
        { name: "s", type: "Sample*", isConst: false, isArray: false },
      ]),
    );
    CodeGenState.symbolTable.addCSymbol(
      declareCFunction("store", [
        { name: "s", type: "Sample*", isConst: true, isArray: false },
      ]),
    );

    expect(callerParameterIsModified("store")).toBe(true);
  });

  it("keeps auto-const when every overload takes the parameter by value", () => {
    CodeGenState.symbolTable.addCSymbol(
      declareCFunction("emit", [
        { name: "v", type: "uint8_t", isConst: false, isArray: false },
      ]),
    );
    CodeGenState.symbolTable.addCSymbol(
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
        sourceLine: 1,
        sourceLanguage: ESourceLanguage.C,
        visibility: "public",
        type: "void*",
      }) as TCSymbol;

    it("keeps auto-const when the callee is one of the caller's parameters", () => {
      // `void forward(handler cb, u8 value) { cb(value); }` -- `cb` is a value,
      // so no declaration will ever match it. Failing safe here fired on every
      // callback by construction.
      CodeGenState.functionCallGraph.clear();
      CodeGenState.functionParamLists.clear();
      CodeGenState.modifiedParameters.clear();
      CodeGenState.functionParamLists.set("forward", ["cb", "value"]);
      CodeGenState.modifiedParameters.set("forward", new Set());
      CodeGenState.functionCallGraph.set("forward", [
        { callee: "cb", paramIndex: 0, argParamName: "value" },
      ]);

      PassByValueAnalyzer.propagateModifications();

      expect(CodeGenState.modifiedParameters.get("forward")!.has("value")).toBe(
        false,
      );
    });

    it("keeps auto-const when the callee is a variable rather than a function", () => {
      CodeGenState.symbolTable.addCSymbol(declareCVariable("listener"));

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
      sourceLine: 1,
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
    } as unknown as Parameters<typeof CodeGenState.symbolTable.addTSymbol>[0];
    CodeGenState.symbolTable.addTSymbol(cnextFunction);

    // Must not throw, and must fall through to the fail-safe rather than
    // answering from a shape it cannot read.
    expect(() => callerParameterIsModified("emit")).not.toThrow();
    expect(callerParameterIsModified("emit")).toBe(true);
  });
});
