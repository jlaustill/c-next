/**
 * Error reported by ReturnValueUseAnalyzer (ADR-070, E0708).
 */
interface IReturnValueUseError {
  line: number;
  column: number;
  code: string;
  message: string;
  helpText: string;
}

export default IReturnValueUseError;
