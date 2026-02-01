/**
 * Target platform capabilities for code generation
 * Determines which atomic instructions and features are available
 */

interface ITargetCapabilities {
  wordSize: 8 | 16 | 32;
  hasLdrexStrex: boolean;
  hasBasepri: boolean;
}

export default ITargetCapabilities;
