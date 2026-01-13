# C-Next Testing Workflow

**Purpose:** Step-by-step guide for writing comprehensive, bug-finding tests in C-Next.

This workflow was developed during the 2026-01-11 postfix chain testing session, where we created 11 comprehensive tests, found 2 bugs (1 fixed, 1 documented), and increased coverage from 60% to 62%.

---

## Testing Philosophy

**"We don't work around bugs in C-Next, we tackle them HEAD-ON!"**

When tests expose bugs:

1. ✅ **DO:** Fix the bug at its source (grammar, code generator, semantic checks)
2. ✅ **DO:** Document bugs thoroughly if they can't be fixed immediately
3. ❌ **DON'T:** Work around bugs with alternative test patterns
4. ❌ **DON'T:** Skip tests because they expose issues

**Goal:** Write tests so comprehensive that they EXPOSE bugs in high-risk code.

---

## Workflow Steps

### Phase 1: Analysis & Planning

#### Step 1: Review Coverage Documentation

```bash
# Read the coverage matrix
cat docs/coverage.md
```

**Look for:**

- Sections with many `[ ]` (untested) checkboxes
- Areas marked as "sparse" or low coverage percentages
- Complex features mentioned in ADRs but not thoroughly tested
- Code paths that interact with multiple features

**Output:** Identify 2-3 high-risk areas to test

#### Step 2: Analyze the Source Code

```bash
# Find the relevant code in src/codegen/CodeGenerator.ts
grep -n "functionName" src/codegen/CodeGenerator.ts
```

**Evaluate risk by:**

- **Lines of code:** 100+ lines = high complexity
- **Conditional logic:** Many if/else branches = high bug potential
- **State tracking:** Complex variable interactions = high risk
- **Feature interactions:** Code that touches multiple language features = highest risk

**Example from postfix chains:**

```
Lines 5850-6285 (435 lines!)
- Multiple nested conditions
- State tracking (isRegisterChain, currentMemberIsArray, etc.)
- Interactions: arrays + structs + registers + bitmaps + bit indexing
→ HIGHEST RISK CODE IN TRANSPILER
```

**Output:** Understand the complexity and potential failure modes

#### Step 3: Create Test Plan

List all scenarios the code should handle:

**Template:**

```markdown
## Test Plan: [Feature Name]

### Basic Cases (2-3 tests)

- [ ] Simple 1-2 level usage
- [ ] Basic read and write operations
- [ ] Common use cases

### Complex Cases (3-5 tests)

- [ ] Deep nesting (3+ levels)
- [ ] Feature interactions (arrays + structs, etc.)
- [ ] Edge cases at boundaries

### Edge Cases (2-3 tests)

- [ ] Maximum limits (indices, nesting depth)
- [ ] Boundary conditions
- [ ] Const expressions, special values

### Stress Tests (1-2 tests)

- [ ] Ultimate complexity test (7+ levels, all features)
- [ ] Performance/correctness under load

### Error Cases (1-2 tests)

- [ ] Expected semantic errors
- [ ] Constraint violations
```

**Output:** Comprehensive test checklist (aim for 8-15 tests)

---

### Phase 2: Test Creation

#### Step 4: Create Test Directory

```bash
mkdir -p tests/[feature-name]
cd tests/[feature-name]
```

#### Step 5: Write Tests Progressively

**Start simple, increase complexity:**

1. **Basic test** - Verify parser accepts syntax

   ```cnx
   // [feature-name]-basic.test.cnx
   // Simplest possible usage
   ```

2. **Intermediate tests** - Add one complexity layer at a time

   ```cnx
   // [feature-name]-2-level.test.cnx
   // [feature-name]-3-level.test.cnx
   ```

3. **Complex tests** - Combine multiple features

   ```cnx
   // [feature-name]-complex.test.cnx
   // Mix feature with arrays, structs, registers, etc.
   ```

4. **Stress test** - Push to maximum complexity
   ```cnx
   // [feature-name]-ultimate.test.cnx
   // 7+ level nesting, every feature combination
   ```

**Naming Convention:**

- `[feature]-basic.test.cnx` - Simplest case
- `[feature]-[aspect].test.cnx` - Specific scenario
- `[feature]-ultimate.test.cnx` - Maximum complexity
- `[feature]-error-[case].test.cnx` - Expected errors

#### Step 6: Run Tests Incrementally

```bash
# Run full test suite
npm test
```

**Watch for:**

- Parser errors → Grammar issues
- Wrong generated C → Code generator issues
- Semantic errors → Validation logic issues

**Output:** Tests that expose bugs! 🎯

---

### Phase 3: Bug Discovery & Resolution

#### Step 7: Document Bugs Immediately

When a test exposes a bug, create documentation:

```bash
# Create bug report
touch BUG-DISCOVERED-[feature].md
```

**Template:**

````markdown
# BUGS DISCOVERED: [Feature] Issues

**Discovered by:** [Test suite name]
**Date:** YYYY-MM-DD
**Testing Coverage:** [Lines X-Y in FileName.ts]

---

## Bug #1: [Short Description] - STATUS

### Issue

[Clear explanation of wrong behavior]

### Reproduction

```cnx
// Minimal test case
```
````

### Generated (WRONG)

```c
// Wrong output
```

### Expected (CORRECT)

```c
// Correct output
```

### Root Cause

[File:line reference and explanation]

### Status

✅ FIXED / 🔶 PARTIAL / ❌ BLOCKED

### Fix Applied (if fixed)

[What was changed and where]

---

[Repeat for each bug discovered]

````

**Output:** Complete bug documentation

#### Step 8: Tackle Bugs HEAD-ON

**Grammar Bugs:**
```bash
# Edit grammar
vim grammar/CNext.g4

# Rebuild parser
npm run antlr

# Type-check TypeScript
npm run typecheck

# Test fix
cnext [test-file].cnx
````

**Code Generator Bugs:**

```bash
# Edit code generator
vim src/codegen/CodeGenerator.ts

# Type-check changes
npm run typecheck

# Test fix
cnext [test-file].cnx

# Compare output
diff [test].c [test].expected.c
```

**Document if can't fix immediately:**

- Add TODO comment in code referencing bug doc
- Keep old logic with explanation
- Update bug doc with workaround

**Output:** Either fixed bug or documented blocker

---

### Phase 4: Documentation & Cleanup

#### Step 9: Create Expected Output Files

For tests that pass:

```bash
cd tests/[feature]

# Generate and save expected output
for test in *.test.cnx; do
  if cnext "$test" && [ -f "${test%.test.cnx}.c" ]; then
    cp "${test%.test.cnx}.c" "${test%.test.cnx}.expected.c"
    echo "Created ${test%.test.cnx}.expected.c"
  fi
done
```

**Output:** `.expected.c` files for snapshot testing

#### Step 10: Create Test Directory README

```bash
touch tests/[feature]/README.md
```

**Template:**

```markdown
# [Feature] Tests

**Created:** YYYY-MM-DD
**Purpose:** [What code this tests]

## Status

### ✅ Passing Tests (N)

1. **test-name.test.cnx** - Description

### 🔶 Blocked by Bug (N)

2. **test-name.test.cnx** - Description
   **Bug:** [Reference to bug doc]

### ⚠️ Expected Errors (N)

3. **test-name.test.cnx** - Description (semantic constraint)

## Test Coverage

[Summary of what's covered]

## Related Documentation

- **Bug Report:** `/BUG-DISCOVERED-[feature].md`
- **Coverage:** `/docs/coverage.md` (Section X.Y)
- **Grammar:** `grammar/CNext.g4` lines X-Y
- **Code:** `src/codegen/FileName.ts` lines X-Y
```

**Output:** Clear test directory documentation

#### Step 11: Update coverage.md

**Add at top:**

```markdown
## Recent Updates

**YYYY-MM-DD: [Feature] Testing**

- ✅ Added N new test files targeting lines X-Y
- ✅ Fixed [bug description]
- 🔶 Discovered [bug description]
- 📊 Coverage increased from X% to Y%
- 📄 See [bug doc] for details
```

**Add test section:**

```markdown
### X.Y [Feature] Testing

| Context        | Status | Test File                    |
| -------------- | ------ | ---------------------------- |
| Basic usage    | [x]    | `[feature]/basic.test.cnx`   |
| Complex chains | [x]    | `[feature]/complex.test.cnx` |

...

**Note:** Tests created YYYY-MM-DD. [Bug status summary]
```

**Update statistics:**

- Test count: old → new (+N)
- Coverage percentage: old% → new%
- Add feature category if new
- Update file count table
- Update "Last updated" date

**Output:** coverage.md reflects all changes

#### Step 12: Clean Up

```bash
# Remove temporary test files from root
rm -f test-*.cnx test-*.c test-*.md

# Verify no debug code left
grep -r "console.error\|console.log\|DEBUG" src/

# Check git status
git status

# Verify only intended files are modified/added
git diff --stat
```

**Output:** Clean working directory

---

### Phase 5: Commit & Document

#### Step 13: Review Before Commit

**Checklist:**

- [ ] All temporary files removed
- [ ] No debug code in source
- [ ] Expected output files created for passing tests
- [ ] Test README created
- [ ] coverage.md updated (Recent Updates + section + statistics)
- [ ] Bug documentation complete
- [ ] Grammar/code changes clean and minimal
- [ ] git status shows only intended changes

#### Step 14: Create Commit Message

**Template:**

```
Add comprehensive [feature] testing (N tests)

Tests:
- Created N test files in tests/[feature]/
- Coverage: [basic/complex/edge/stress] scenarios
- Target: lines X-Y in FileName.ts (M lines)

Bugs Found:
- ✅ Fixed: [bug description]
- 🔶 Documented: [bug description in BUG-DISCOVERED-*.md]

Coverage:
- Test count: old → new (+N)
- Overall coverage: X% → Y% (+Z%)
- [Feature] coverage: ~[%]

Files:
- Modified: grammar/CNext.g4 (lines X-Y)
- Modified: src/codegen/FileName.ts (explanation)
- Modified: docs/coverage.md (sections + stats)
- Added: tests/[feature]/ (N tests + 3 expected + README)
- Added: BUG-DISCOVERED-[feature].md

No regressions: All 248 existing tests still pass.
```

#### Step 15: Commit & Push

```bash
# Stage all changes
git add -A

# Commit with detailed message
git commit -F commit-message.txt

# Push to remote
git push origin main
```

---

## Success Metrics

A successful test session should achieve:

✅ **Test Quality:**

- 8-15 comprehensive tests covering feature thoroughly
- Basic → Complex → Ultimate progression
- Tests expose bugs (that's the goal!)

✅ **Bug Discovery:**

- At least 1 bug found in high-risk code
- Bugs either fixed or thoroughly documented
- No workarounds - tackle HEAD-ON

✅ **Documentation:**

- coverage.md fully updated
- Bug report created (if bugs found)
- Test README explains status
- Commit message tells complete story

✅ **Code Quality:**

- No debug code left
- No regressions (existing tests pass)
- Changes are minimal and focused
- Expected output files for passing tests

✅ **Coverage Increase:**

- +2% or more overall coverage
- High-risk area goes from sparse → comprehensive

---

## Example: Postfix Chain Testing (2026-01-11)

**Following this workflow resulted in:**

📊 **Metrics:**

- 11 comprehensive tests created
- 435 lines of high-risk code tested (lines 5850-6285)
- Coverage: 60% → 62% (+2%)
- Test count: 251 → 262 (+11)

🐛 **Bugs Found:**

- ✅ Grammar bug (lines 485-486) - FIXED
- 🔶 Code generator order scrambling - DOCUMENTED

📄 **Documentation:**

- coverage.md: Updated with section 34.3, statistics, recent updates
- BUG-DISCOVERED-postfix-chains.md: Complete bug documentation
- tests/postfix-chains/README.md: Test status and purpose

✅ **Quality:**

- 0 regressions (all 248 existing tests pass)
- 3 tests passing immediately
- 6 tests blocked by documented bug
- 2 tests correctly trigger semantic errors

**Time Investment:** ~3 hours
**Value Delivered:** Exposed critical bugs in most complex code, permanent regression protection

---

## Tips for Success

### DO:

- ✅ Start with coverage.md review to find gaps
- ✅ Analyze source code to understand risk
- ✅ Create 8-15 tests (not just 2-3)
- ✅ Progress from simple → complex → ultimate
- ✅ Fix bugs at their source (grammar, codegen)
- ✅ Document bugs immediately when found
- ✅ Update coverage.md comprehensively
- ✅ Create expected output for passing tests
- ✅ Write detailed commit messages

### DON'T:

- ❌ Skip coverage.md review
- ❌ Write only happy-path tests
- ❌ Work around bugs instead of fixing them
- ❌ Leave debug code in source
- ❌ Forget to update coverage.md
- ❌ Commit without expected output files
- ❌ Write vague commit messages
- ❌ Rush - thorough testing takes time

### Remember:

**"The goal is to find bugs, not to make tests pass."**

If your tests don't expose any bugs, you're probably not testing thoroughly enough!

---

## Quick Reference

```bash
# Phase 1: Analysis
cat docs/coverage.md                    # Review coverage
grep -n "feature" src/codegen/*.ts     # Analyze code

# Phase 2: Test Creation
mkdir -p tests/[feature]               # Create directory
vim tests/[feature]/basic.test.cnx     # Write tests
npm test                               # Run tests

# Phase 3: Bug Resolution
vim grammar/CNext.g4                   # Fix grammar
vim BUG-DISCOVERED-[feature].md       # Document bugs

# Phase 4: Documentation
cp test.c test.expected.c              # Create expected outputs
vim tests/[feature]/README.md          # Document tests
vim docs/coverage.md                    # Update coverage

# Phase 5: Commit
rm test-*.cnx test-*.c                 # Clean up
git add -A                             # Stage changes
git commit -m "..."                    # Commit
git push                               # Push
```

---

**Last Updated:** 2026-01-11
**Author:** Testing methodology developed during postfix chain testing session
