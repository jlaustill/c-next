/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ==========================================================================
    // 3-Layer Architecture Rules (Issue #572)
    // ==========================================================================
    // Architecture: Transpiler orchestrates data/, logic/, output/
    //
    // Allowed dependencies:
    //   - Transpiler.ts → data/, logic/, output/ (orchestrator)
    //   - output/ → logic/ (code gen needs parser types, symbols)
    //   - Any layer → utils/ (shared utilities)
    //   - Any layer → lib/types/ (shared public types)
    //
    // Forbidden dependencies:
    //   - data/ → logic/, output/ (data layer is independent)
    //   - logic/ → output/ (logic should not depend on output)
    // ==========================================================================

    {
      name: "data-cannot-import-logic",
      comment: "Data layer must not depend on logic layer",
      severity: "error",
      from: { path: "^src/transpiler/data/" },
      to: { path: "^src/transpiler/logic/" },
    },
    {
      name: "data-cannot-import-output",
      comment: "Data layer must not depend on output layer",
      severity: "error",
      from: { path: "^src/transpiler/data/" },
      to: { path: "^src/transpiler/output/" },
    },
    {
      name: "logic-cannot-import-output",
      comment:
        "Logic layer must not depend on output layer. " +
        "If you need shared types, move them to transpiler/types/.",
      severity: "error",
      from: { path: "^src/transpiler/logic/" },
      to: { path: "^src/transpiler/output/" },
    },

    // ==========================================================================
    // General Best Practices
    // ==========================================================================

    {
      name: "no-circular",
      comment: "No circular dependencies allowed",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment:
        "Files that are not reachable from the entry points. " +
        "Consider removing or connecting them.",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          // Test files are allowed to be orphans
          "\\.test\\.ts$",
          // Type definition files
          "\\.d\\.ts$",
          // Generated parser files
          "grammar/.*\\.ts$",
        ],
      },
      to: {},
    },
    {
      name: "no-deprecated-core",
      comment: "Don't use deprecated Node.js core modules",
      severity: "warn",
      from: {},
      to: { dependencyTypes: ["deprecated"] },
    },
    {
      name: "not-to-unresolvable",
      comment: "Don't import modules that cannot be resolved",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-non-package-json",
      comment: "Don't import packages not in package.json",
      severity: "error",
      from: {},
      to: {
        dependencyTypes: ["npm-no-pkg", "npm-unknown"],
      },
    },
    {
      name: "not-to-dev-dep",
      comment: "Don't import devDependencies from production code",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: ["\\.test\\.ts$", "__tests__/"],
      },
      to: { dependencyTypes: ["npm-dev"] },
    },
  ],
  options: {
    doNotFollow: {
      path: ["node_modules"],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["main", "types", "typings"],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
    // Exclude generated parser files from analysis (they have known issues)
    exclude: [
      "src/transpiler/logic/parser/grammar/.*",
      "src/transpiler/logic/parser/c/grammar/.*",
      "src/transpiler/logic/parser/cpp/grammar/.*",
    ],
    // Focus on the transpiler architecture
    focus: "^src/transpiler/",
  },
};
