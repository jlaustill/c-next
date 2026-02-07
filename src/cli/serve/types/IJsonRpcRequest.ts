/**
 * JSON-RPC 2.0 Request structure
 */
interface IJsonRpcRequest {
  /** Request identifier for correlation */
  id: number | string;
  /** Method name to invoke */
  method: string;
  /** Optional parameters */
  params?: Record<string, unknown>;
}

export default IJsonRpcRequest;
