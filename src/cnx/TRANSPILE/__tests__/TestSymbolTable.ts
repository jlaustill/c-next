import Program from "../../PARSE/4-Resolve/Program";
import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import type TranspileState from "../TranspileState";

const installed = new WeakMap<TranspileState, SymbolTable>();

/**
 * A test's writable symbol table for a `TranspileState`. Production passes
 * after 1.4 read the table only off `state.program.symbolTable()` (#1991), so a
 * test that seeds symbols installs its table under a `Program`, the way 1.4
 * hands it on.
 */
class TestSymbolTable {
  static install(
    state: TranspileState,
    table: SymbolTable = new SymbolTable(),
  ): SymbolTable {
    installed.set(state, table);
    state.program = Program.build([], { cppMode: false, symbolTable: table });
    return table;
  }

  /** The table installed on `state`, installing an empty one if none is. */
  static of(state: TranspileState): SymbolTable {
    return installed.get(state) ?? TestSymbolTable.install(state);
  }
}

export default TestSymbolTable;
