/**
 * The ways a declared identifier can break the ADR-063 underscore rule.
 *
 * A leading underscore is deliberately absent: it is legal (ADR-063), because
 * injectivity of `Scope__member` constrains only the separator's left boundary.
 */
type TIdentifierViolation = "trailing" | "consecutive";

export default TIdentifierViolation;
