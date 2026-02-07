/**
 * JSON-RPC 2.0 Response structure
 */
interface IJsonRpcResponse {
  /** Request identifier for correlation */
  id: number | string;
  /** Result on success */
  result?: unknown;
  /** Error on failure */
  error?: {
    code: number;
    message: string;
    /** Optional additional error context */
    data?: unknown;
  };
}

export default IJsonRpcResponse;
