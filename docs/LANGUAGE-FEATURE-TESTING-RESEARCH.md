# Language Feature Testing & Coverage Research

**Research Date:** 2026-01-12
**Goal:** Find tools and approaches for measuring **language feature coverage** rather than code coverage

---

## The Challenge

Traditional code coverage tools (Istanbul, nyc, c8) measure **which lines of transpiler code execute**, not **which language features are tested**. For C-Next, we need to know:

- ✅ Are all primitive types tested in all contexts?
- ✅ Are all operators tested with all valid type combinations?
- ✅ Are all control flow constructs tested?
- ✅ Are all grammar rules exercised?

**This requires a fundamentally different approach to coverage measurement.**

---

## How Major Compilers/Transpilers Approach This

### 1. TypeScript Approach

**Scale:** [~20,000 compiler test cases](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)

**Strategy:**

- Comprehensive test suite covering language features systematically
- Tests organized by language feature, not transpiler code paths
- [fourslash testing framework](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/) for editor integration
- Manual tracking of which features are tested (similar to your coverage.md!)

**Key Insight:** TypeScript doesn't use automated grammar coverage—they maintain **26 extensive test suites** that systematically cover language features.

### 2. Rust Compiler (rustc) Approach

**Initiative:** [Rust Specification Testing 2025](https://rust-lang.github.io/rust-project-goals/2025h1/spec-testing.html)

**Current State:**

> "The rust compiler currently has tests for many aspects of the language... these tests are largely contained in the ui test suite, are disorganized, and are intermingled."

**2025 Goal:**

> "Rust tests will be added and linked directly in the specification itself... reorganize test structure to make it more clear which tests are exercising guaranteed aspects of the language."

**Tools:**

- [compiletest](https://rustc-dev-guide.rust-lang.org/tests/compiletest.html) - test runner supporting multiple test suite styles
- [LLVM coverage instrumentation](https://rustc-dev-guide.rust-lang.org/llvm-coverage-instrumentation.html)
- ui tests, run-make tests, coverage tests

**Key Insight:** Even Rust (with decades of development) is **still working on organizing language feature tests** in 2025!

### 3. LLVM/Clang Approach

**Tools:** [lit + FileCheck](https://llvm.org/docs/TestingGuide.html)

**lit (LLVM Integrated Tester):**

- Lightweight test runner
- Executes tests in parallel
- [Supports coverage data per test case](https://llvm.org/docs/CommandGuide/lit.html)

**[FileCheck](https://llvm.org/docs/CommandGuide/FileCheck.html):**

- Pattern-matching file verifier
- Similar to grep but optimized for ordered multi-pattern matching
- Used to verify compiler output contains expected IR/assembly

**Test Organization:**

- Tests organized in `llvm/test` directory
- Each test exercises specific language features
- Uses RUN lines to execute compiler with specific flags
- CHECK: lines verify output

**Example Test Structure:**

```llvm
; RUN: llc < %s | FileCheck %s
; CHECK: expected output pattern
; CHECK-NOT: unwanted pattern
```

**Key Insight:** LLVM doesn't track "grammar coverage"—they have **organized test suites** where each test targets specific features, and FileCheck verifies correct code generation.

---

## Grammar-Based Testing Tools

### 1. Grammarinator (ANTLR v4)

**Repository:** [renatahodovan/grammarinator](https://github.com/renatahodovan/grammarinator)

**What it does:**

- Takes ANTLR v4 grammar as input
- Generates test cases automatically
- Can generate from scratch or mutate existing inputs
- Outputs Python3 or C++ test generator scripts

**Use Case:** Fuzzing and test case generation

**Limitation:** Generates valid inputs but doesn't track which grammar rules are covered

### 2. ANTLR Testing Frameworks

**[ANTLR Testing (Java/JUnit)](https://antlr-testing.sourceforge.net/):**

- Library for testing ANTLR-generated grammars
- Integrates with JUnit
- Helps verify parser behavior

**[Grun.Net (C#)](https://github.com/wiredwiz/Grun.Net):**

- Command-line and GUI testing tools
- Similar to ANTLR TestRig
- Visualizes parse trees

**[ANTLR Lab](http://lab.antlr.org/):**

- Online platform for testing grammars
- Interactive parse tree visualization

**Limitation:** These are parser testing tools, not feature coverage tools

### 3. ParserFuzz (2025 Research)

**Paper:** ["Parser Knows Best: Testing DBMS with Coverage-Guided Grammar-Rule Traversal"](https://arxiv.org/abs/2503.03893) (March 2025)

**Innovation:**

- **Grammar Edge Coverage** - tracks combinations between grammar rules
- Automatically extracts grammar rules from syntax definition files
- Uses code coverage as feedback to guide mutation
- Saturates grammar features systematically

**Key Metric:** Grammar edge = possible combinations between two non-terminal keywords

**This is the closest to "grammar coverage" found in research!**

---

## Property-Based Testing for Compilers

### Overview

Property-based testing generates random inputs and verifies properties hold:

**Frameworks:**

- [QuickCheck (Haskell)](https://hypothesis.works/articles/quickcheck-in-every-language/) - original (1999)
- [Hypothesis (Python)](https://hypothesis.works/articles/what-is-property-based-testing/) - most powerful
- [fast-check (TypeScript)](https://github.com/dubzzz/fast-check)
- [RapidCheck (C++)](https://github.com/emil-e/rapidcheck)

### Application to Compilers

**Properties to test:**

- Idempotency: `transpile(transpile(input)) == transpile(input)`
- Round-trip: `parse(generate(ast)) == ast`
- Equivalence: Multiple ways to express same thing produce same output
- Error consistency: Invalid inputs always produce errors

### Limitation for Feature Coverage

Property-based testing is **excellent for finding bugs** but **doesn't guarantee feature coverage**. Random generation might never hit rare language constructs.

---

## Compiler Fuzzing (Finding Bugs, Not Coverage)

### LegoFuzz (2025)

**Paper:** ["Interleaving Large Language Models for Compiler Testing"](https://arxiv.org/html/2508.18955) (2025)

**Achievement:** Found 66 compiler bugs in GCC and LLVM (30 miscompilation bugs)

**Approach:** LLM-based test generation exercising wide range of language features

### CSmith, YARPGen, etc.

**Purpose:** Generate complex valid programs to find compiler bugs

**Limitation:** Coverage is a side effect, not the goal. May not systematically cover all features.

---

## Existing Transpiler Testing Examples

### Babel Testing

**Tool:** [babel-plugin-tester](https://github.com/babel-utils/babel-plugin-tester)

**Approach:**

- Tests organized by plugin/transformation
- Input → Expected Output verification
- Works with Jest, Mocha, Vitest, etc.

**C-Next Parallel:** Your current test structure is very similar!

### Test Structure Pattern (Common Across Projects)

```
tests/
├── feature-category/
│   ├── feature-basic.test.cnx
│   ├── feature-advanced.test.cnx
│   ├── feature-error.test.cnx
│   └── feature-all-types.test.cnx
```

**This is exactly what you're already doing with coverage.md as the tracking mechanism!**

---

## The Verdict: What Actually Works

After researching how TypeScript (20K tests), Rust, LLVM, and others handle this:

### ❌ What Doesn't Exist (Surprisingly!)

**Automated Grammar Coverage Tools** for production transpilers don't really exist. Why?

1. **Grammar rules ≠ Language features**
   - One grammar rule might represent multiple features
   - Multiple grammar rules might combine for one feature

2. **Context matters**
   - Testing `u8` in isolation ≠ testing `u8` as function param
   - Grammar might accept both, but semantics differ

3. **Coverage explosion**
   - Testing all combinations of features = factorial complexity
   - Must prioritize important/common combinations

### ✅ What Actually Works

**1. Manual Feature Matrix (What You're Already Doing!)**

Your `coverage.md` is **exactly how major compilers track feature coverage:**

- Systematically enumerate features × contexts
- Track with checkboxes
- Write focused tests for each combination

**This is the industry standard approach!**

**2. Organized Test Suites + Test Runner**

- Tests organized by language feature
- Simple test runner (your current scripts are fine)
- Pattern: `.test.cnx` → `.expected.c` comparison

**3. Regression Suite**

- Keep all tests that ever passed
- Detect when features break

---

## Recommendations for C-Next

### Current State: Already Excellent! ✅

Your current approach is **exactly what successful compilers do:**

1. ✅ **Manual feature matrix** (coverage.md)
2. ✅ **Systematic test organization** (tests/ directory)
3. ✅ **Input/output comparison** (.test.cnx → .expected.c)
4. ✅ **Test discovery** (automated test runner)
5. ✅ **Issue tracking** (GitHub issues for gaps)

### Recommended Enhancements

#### 1. Enhanced Test Runner with Coverage Tracking

**Create a tool that:**

- Runs all tests (current behavior) ✅
- **Parses coverage.md** to extract checkboxes
- **Maps test files to checkboxes** using annotations
- **Reports which checkboxes have tests**
- **Reports which checkboxes are missing tests**

**Implementation:**

```typescript
// Test annotation in .test.cnx files
/* test-coverage: 1.1-u8-loop-counter */
/* test-coverage: 7-for-loop-basic */

// Tool parses annotations and updates coverage.md
```

#### 2. Grammar Rule Coverage (Nice to Have)

**Use ANTLR's parse tree listeners to track:**

- Which parser rules were visited during test execution
- Which rules never execute

**Implementation:**

```typescript
class CoverageListener extends CNextBaseListener {
  visitedRules = new Set<string>();

  enterEveryRule(ctx: ParserRuleContext) {
    this.visitedRules.add(ctx.constructor.name);
  }
}
```

**Output:** Report showing:

- ✅ `primary_expression` - visited 523 times
- ⚠️ `inline_assembly` - never visited
- ✅ `for_loop` - visited 47 times

**Benefit:** Identifies dead grammar rules or untested constructs

#### 3. FileCheck-Style Output Verification

**Instead of full .expected.c comparison:**

```cnx
// test.cnx
u8 main() {
    u8 x <- 255;
    return x;
}

// CHECK: uint8_t x = 255;
// CHECK: return x;
// CHECK-NOT: error
```

**Benefits:**

- Less brittle than full-file comparison
- Can check for specific patterns
- Ignore formatting differences

#### 4. Test Matrix Generator

**Auto-generate test templates from coverage.md:**

```bash
./scripts/generate-test-template.sh "1.1-u8-loop-counter"
# Creates: tests/primitives/u8-loop-counter.test.cnx (template)
```

**Template includes:**

- Test skeleton
- Coverage annotation comment
- TODOs for test implementation

---

## Practical Implementation Plan

### Phase 1: Enhanced Coverage Tracking (Week 1)

**Create:** `scripts/coverage-checker.ts`

**Features:**

1. Parse coverage.md → extract all checkboxes
2. Scan tests/ → find all .test.cnx files
3. Read coverage annotations from test files
4. Report:
   - Which checkboxes have tests
   - Which tests lack annotations
   - Which checkboxes have no tests

**Output:**

```
Coverage Report:
  Total checkboxes: 941
  With tests: 676 (72%)
  Without tests: 265 (28%)

Missing annotations:
  ⚠️  tests/bitwise/u8-bitwise-ops.test.cnx
     (Test exists but no coverage annotation)

Untested features (HIGH priority):
  ❌ 1.1-u16-loop-counter
  ❌ 1.2-i8-arithmetic
  ❌ 7-switch-nested
```

### Phase 2: Grammar Rule Coverage (Week 2) ✅ IMPLEMENTED

> **Implemented:** Issue #35 - See `scripts/grammar-coverage.ts`

**Commands:**

```bash
npm run coverage:grammar         # Generate GRAMMAR-COVERAGE.md
npm run coverage:grammar:check   # CI check with 80% threshold
npm run coverage:grammar:console # Console output only
```

**Current Status (95.2% combined coverage):**

- 91 parser rules, 88 covered (96.7%)
- 119 lexer rules, 112 covered (94.1%)

**Features:**

1. ✅ Instrument transpiler with ANTLR ParseTreeListener
2. ✅ Track which parser and lexer rules execute
3. ✅ Generate markdown and console reports
4. ✅ CI integration with configurable threshold

**Output:**

```
Grammar Rule Coverage:
  Total rules: 210
  Executed: 200 (95.2%)
  Never executed: 10 (4.8%)

Never Visited Parser Rules:
  ❌ globalMemberAccess
  ❌ genericType
  ❌ typeArgument
```

### Phase 3: FileCheck Integration (Week 3)

**Create:** `scripts/filecheck-runner.ts`

**Features:**

1. Parse CHECK: comments from test files
2. Run transpiler
3. Verify output matches CHECK patterns
4. More flexible than exact .expected.c comparison

**Benefits:**

- Easier to maintain tests
- Focus on important output characteristics
- Less affected by formatting changes

### Phase 4: Test Generator (Week 4)

**Create:** `scripts/generate-test.ts`

**Usage:**

```bash
./scripts/generate-test.ts \
  --section "1.1-u16-loop-counter" \
  --type "loop-counter" \
  --primitives "u16"
```

**Generates:**

```cnx
/* test-coverage: 1.1-u16-loop-counter */
/* test-execution */

u16 main() {
    u16 sum <- 0;
    for (u16 i <- 0; i < 100; i +<- 1) {
        sum +<- i;
    }
    return (sum = 4950) ? 0 : 1;
}
```

---

## Tool Comparison Matrix

| Tool/Approach                   | Measures             | Pros                        | Cons                  | Recommendation                  |
| ------------------------------- | -------------------- | --------------------------- | --------------------- | ------------------------------- |
| **Manual Matrix (coverage.md)** | Language features    | Industry standard, flexible | Manual tracking       | ✅ **Keep (already excellent)** |
| **Grammar Rule Coverage**       | Parser rules visited | Finds dead code             | Rules ≠ features      | ⚡ **Add (nice to have)**       |
| **Property-Based Testing**      | Random bug finding   | Finds edge cases            | No coverage guarantee | 🔶 **Consider for fuzzing**     |
| **FileCheck-style Tests**       | Output patterns      | Flexible, maintainable      | Initial setup         | ✅ **Adopt (enhance tests)**    |
| **Grammarinator**               | Test generation      | Auto-generates inputs       | Generic tests         | 🔶 **Consider for fuzzing**     |
| **Test Annotations**            | Feature→test mapping | Automated tracking          | Requires discipline   | ✅ **Implement (Phase 1)**      |
| **Code Coverage (nyc, c8)**     | Transpiler code      | Standard tooling            | Wrong metric          | ❌ **Not useful for features**  |

---

## Concrete Next Steps

### Week 1: Coverage Tracking Tool

```bash
# Create the tool
npm install --save-dev @types/markdown-it markdown-it

# Implement coverage-checker.ts (see appendix)

# Run it
npm run coverage:check
```

**Output:** Report showing test↔feature mapping

### Week 2: Add Test Annotations

```bash
# Add to existing tests
/* test-coverage: 1.1-u8-loop-counter, 7-for-loop-basic */

# Re-run coverage checker
npm run coverage:check
```

**Output:** Updated report with better mapping

### Week 3: Grammar Coverage

```typescript
// Add to transpiler
const coverageListener = new GrammarCoverageListener();
parser.addParseListener(coverageListener);

// After test run
coverageListener.report();
```

**Output:** Grammar rule usage statistics

### Week 4: FileCheck-style Tests

```bash
# Enhance test runner to support CHECK: comments
# Convert some tests to use CHECK: instead of .expected.c
# More maintainable, less brittle
```

---

## Appendix A: Coverage Checker Implementation Outline

```typescript
// scripts/coverage-checker.ts

interface CoverageItem {
  id: string; // e.g., "1.1-u8-loop-counter"
  section: string; // e.g., "1. Primitive Types"
  feature: string; // e.g., "As loop counter"
  type: string; // e.g., "u8"
  tested: boolean; // Has test file
  testFiles: string[]; // Which tests cover this
}

async function parseCoverageMarkdown(): Promise<CoverageItem[]> {
  // Parse coverage.md
  // Extract sections, subsections, table rows
  // Track checkbox state [x] vs [ ]
  // Generate unique IDs for each checkbox
}

async function scanTestFiles(): Promise<Map<string, string[]>> {
  // Find all .test.cnx files
  // Parse /* test-coverage: ... */ annotations
  // Map test file → coverage IDs
}

function generateReport(
  coverageItems: CoverageItem[],
  testMapping: Map<string, string[]>,
): void {
  // Calculate statistics
  // List untested features by priority
  // List tests without annotations
  // Suggest next tests to write
}

// Run it
parseCoverageMarkdown()
  .then((items) => scanTestFiles().then((tests) => ({ items, tests })))
  .then(({ items, tests }) => generateReport(items, tests));
```

---

## Sources

### ANTLR Testing

- [ANTLR Development Tools](https://www.antlr.org/tools.html)
- [Grammarinator](https://github.com/renatahodovan/grammarinator)
- [Grun.Net](https://github.com/wiredwiz/Grun.Net)
- [ANTLR Testing Library](https://antlr-testing.sourceforge.net/)

### Compiler Testing

- [LLVM Testing Infrastructure](https://llvm.org/docs/TestingGuide.html)
- [lit - LLVM Integrated Tester](https://llvm.org/docs/CommandGuide/lit.html)
- [FileCheck Documentation](https://llvm.org/docs/CommandGuide/FileCheck.html)
- [Rust Specification Testing (2025)](https://rust-lang.github.io/rust-project-goals/2025h1/spec-testing.html)
- [Rust compiletest](https://rustc-dev-guide.rust-lang.org/tests/compiletest.html)

### TypeScript

- [TypeScript 7 Progress (2025)](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)
- [TypeScript Testing Infrastructure](https://devblogs.microsoft.com/typescript/progress-on-typescript-7-december-2025/)

### Grammar Coverage Research

- [ParserFuzz Paper (2025)](https://arxiv.org/abs/2503.03893)
- [LegoFuzz Compiler Testing (2025)](https://arxiv.org/html/2508.18955)

### Property-Based Testing

- [QuickCheck in Every Language](https://hypothesis.works/articles/quickcheck-in-every-language/)
- [Hypothesis](https://hypothesis.works/articles/what-is-property-based-testing/)
- [fast-check (TypeScript)](https://github.com/dubzzz/fast-check)

### Transpiler Testing

- [babel-plugin-tester](https://github.com/babel-utils/babel-plugin-tester)

---

## Conclusion

**Your current approach is industry-standard and correct.** Major compilers (TypeScript, Rust, LLVM) use the same methodology:

1. ✅ Manual feature matrix (coverage.md)
2. ✅ Organized test suites
3. ✅ Systematic coverage tracking

**Enhancements to consider:**

- ⚡ Automated coverage↔test mapping
- ⚡ Grammar rule coverage reporting
- ⚡ FileCheck-style output verification
- ⚡ Test template generation

**Don't let "perfect" be the enemy of "good."** Your current system already puts you ahead of many transpiler projects!

---

**Report Compiled:** 2026-01-12
**Next Action:** Implement Phase 1 (Coverage Checker Tool)
