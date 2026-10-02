/**
 * One cppcheck finding attributed to a MISRA rule, as
 * `MisraBaseline.parseViolations` reads it from a cppcheck output line.
 */
interface IMisraViolation {
  /** The path cppcheck reported the finding against. */
  file: string;
  /** The rule, spelled as cppcheck's addon spells it: `misra-c2012-14.4`. */
  ruleId: string;
  /** The whole output line, for reporting. */
  raw: string;
}

export default IMisraViolation;
