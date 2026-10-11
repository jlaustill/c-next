/**
 * The ways a declared identifier can break an ADR-063 rule.
 *
 * A leading underscore is deliberately absent: it is legal (ADR-063), because
 * injectivity of `Scope__member` constrains only the separator's left boundary.
 *
 * "trailing" and "consecutive" break part 1 (the underscore rule, E0201);
 * "reserved-prefix" breaks part 2 (the reserved transpiler namespace, E0202).
 * They are carried in one union because a single classifier and a single walk
 * decide both — see IdentifierSyntaxAnalyzer.
 */
type TIdentifierViolation = "trailing" | "consecutive" | "reserved-prefix";

export default TIdentifierViolation;
