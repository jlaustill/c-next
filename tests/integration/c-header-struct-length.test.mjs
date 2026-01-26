/**
 * Integration test for Issue #45: Fix CodeGenerator to use SymbolTable for type resolution
 * Tests that .length property works on struct members from C headers
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Project from "../../dist/project/Project.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, "../..");

// Configure project with C header and C-Next source
const config = {
  srcDirs: [join(rootDir, "tests/primitives")],
  includeDirs: [join(rootDir, "tests/include")],
  outDir: "/tmp/c-next-test",
  files: [
    join(rootDir, "tests/include/TestConfig.h"),
    join(rootDir, "tests/primitives/length-property-c-header-struct.test.cnx"),
  ],
  preprocess: false,
};

const project = new Project(config);

// Debug: Check file discovery
console.log("Discovering files...");
const discoveredFiles = project.discoverFiles();
console.log("Discovered files:");
for (const file of discoveredFiles) {
  console.log(`  - ${file.type}: ${file.path}`);
}

// Compile the project
console.log("\nCompiling project with C header...");
const result = await project.compile();

// Debug: Check what's in the symbol table
const symbolTable = project.getSymbolTable();
console.log("\n=== DEBUG: SymbolTable Contents ===");
console.log("Total symbols:", symbolTable.size);
const appConfigSymbols = symbolTable.getOverloads("AppConfig");
console.log("AppConfig symbols:", appConfigSymbols.length);
for (const sym of appConfigSymbols) {
  console.log(`  - ${sym.kind}: ${sym.name} from ${sym.sourceFile}`);
}
const fields = symbolTable.getStructFields("AppConfig");
if (fields) {
  console.log("AppConfig fields:", fields.size);
  for (const [fieldName, fieldInfo] of fields) {
    console.log(`  - ${fieldName}: ${fieldInfo.type}`);
  }
} else {
  console.log("AppConfig fields: NONE");
}
console.log("===================================\n");

if (!result.success) {
  console.error("Compilation failed:");
  console.error("Errors:", result.errors);
  console.error("Conflicts:", result.conflicts);
  process.exit(1);
}

// Read the generated C file
const outputFile = join(
  config.outDir,
  "length-property-c-header-struct.test.c",
);
const generatedCode = readFileSync(outputFile, "utf-8");

console.log("Generated code:");
console.log(generatedCode);

// Validate that .length properties resolved to correct values
const checks = [
  {
    pattern: /uint8_t magic_bits = 32/,
    description: "config.magic.length should be 32",
  },
  {
    pattern: /uint8_t version_bits = 16/,
    description: "config.version.length should be 16",
  },
  {
    pattern: /uint8_t flags_bits = 8/,
    description: "config.flags.length should be 8",
  },
  {
    pattern: /uint8_t timestamp_bits = 64/,
    description: "config.timestamp.length should be 64",
  },
  {
    // Issue #235: Constant folding now evaluates 32 / 8 to 4
    pattern: /uint8_t bytesNeeded = 4/,
    description: "config.magic.length / 8 should be folded to 4",
  },
];

let passed = 0;
let failed = 0;

for (const check of checks) {
  if (check.pattern.test(generatedCode)) {
    console.log(`✓ PASS: ${check.description}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${check.description}`);
    failed++;
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
}

console.log("\n✓ All checks passed!");
