/**
 * Result from building a base identifier
 */
interface IBaseIdentifierResult {
  /** The built identifier string */
  result: string;
  /** The first identifier in the chain */
  firstId: string;
}

export default IBaseIdentifierResult;
