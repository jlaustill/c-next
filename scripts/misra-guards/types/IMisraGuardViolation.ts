/** A compliance claim whose guard is missing or does not exist */
interface IMisraGuardViolation {
  readonly id: string;
  readonly detail: string;
}

export default IMisraGuardViolation;
