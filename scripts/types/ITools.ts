/**
 * Available validation tools on the system
 */
interface ITools {
  gcc: boolean;
  cppcheck: boolean;
  clangTidy: boolean;
  misra: boolean;
  flawfinder: boolean;
}

export default ITools;
