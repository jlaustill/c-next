/**
 * ADRs not yet cleaned against the rewrite test (issue #1403).
 *
 * This list exists to shrink. It is deliberately NOT a permanent exemption
 * mechanism: an entry that no longer has violations FAILS the gate, so the file
 * cannot quietly keep names that stopped meaning anything. When it is empty,
 * delete it and the branch in AdrIndependence that reads it.
 *
 * The point of landing the gate before the cleanup is that five of these were
 * written AFTER the un-testable version of the rule was already in CLAUDE.md.
 * The drift is ongoing, so the cleanup needs a floor under it while it runs.
 *
 * 40 files, 336 violations at the time of writing. A hand audit of the same
 * corpus found 29 -- it missed eight ADRs whose Implementation sections are
 * organized under a `### CodeGenerator` heading, which is exactly the kind of
 * thing a person skims past and a grep does not.
 */
const ADR_INDEPENDENCE_BASELINE: readonly string[] = [
  // Tier 1 -- the ADR's subject IS the implementation. These move to
  // docs/architecture/ or docs/implementation/ rather than being edited.
  "adr-011-vscode-extension.md",
  "adr-012-static-analysis.md",
  "adr-048-cli-executable.md",
  "adr-055-symbol-parser-architecture.md",
  "adr-060-vscode-extension-separation.md",
  "adr-065-codegenerator-decomposition.md",

  // Tier 2 -- language ADRs naming transpiler internals in the body or in
  // References. The decision stays; the passage is restated in terms of
  // observable behavior.
  "adr-010-c-interoperability.md",
  "adr-013-const-qualifier.md",
  "adr-016-scope.md",
  "adr-022-conditional-expressions.md",
  "adr-030-forward-declarations.md",
  "adr-036-multidimensional-arrays.md",
  "adr-044-primitive-types.md",
  "adr-046-nullable-c-interop.md",
  "adr-047-nullable-types.md",
  "adr-051-division-by-zero.md",
  "adr-062-sink-aware-array-auto-const.md",
  "adr-063-identifier-syntax.md",
  "adr-066-do178c-compliance.md",
  "adr-067-all-paths-return.md",
  "adr-068-forever-loops.md",
  "adr-069-dead-code-reachability.md",
  "adr-070-return-value-use.md",
  "adr-111-safe-hardware-abstraction.md",

  // Tier 3 -- TypeScript sketching an algorithm the ADR decides. Replaced by
  // the C-Next or generated C that shows the same thing.
];

export default ADR_INDEPENDENCE_BASELINE;
