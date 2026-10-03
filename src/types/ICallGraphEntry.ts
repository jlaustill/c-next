/**
 * One call, as transitive modification analysis needs to see it.
 *
 * A shared contract rather than codegen's own type: #1511 makes the call graph
 * a fact `Program` holds, and `transpiler/types/` is the layer every other one
 * may depend on. It was declared inside `CodeGenState`, which `state/` could
 * not have exported to a `types/` consumer without inverting the layering.
 */
interface ICallGraphEntry {
  callee: string;
  paramIndex: number;
  argParamName: string;
}

export default ICallGraphEntry;
