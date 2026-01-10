# Specification: Create Tickets for Uncovered Tests

## Overview

This task involves creating tracking tickets for all uncovered test cases documented in `coverage.md`. Each ticket represents a missing test that needs to be written to achieve the project's goal of 100% language coverage before v1 release. When tests are written and they discover bugs, the failing test should be merged first, with a separate ticket created to fix the bug.

## Workflow Type

**Type**: feature

**Rationale**: This is a systematic feature workflow that involves creating structured tickets for test implementation work. Each ticket represents discrete, well-defined work with clear acceptance criteria.

## Task Scope

### Services Involved
- **main** (primary) - TypeScript-based C-Next compiler with Jest testing

### This Task Will:
- [ ] Parse all uncovered test cases from `coverage.md`
- [ ] Create individual tickets for each missing test case
- [ ] Group tickets by category for organization
- [ ] Define clear acceptance criteria for each ticket
- [ ] Establish the test-first bug handling workflow

### Out of Scope:
- Actually writing the tests (separate tickets will handle that)
- Fixing bugs discovered by tests (separate tickets for bug fixes)
- Modifying the C-Next grammar or compiler

## Service Context

### Main Service

**Tech Stack:**
- Language: TypeScript
- Testing: Jest
- Parser: ANTLR4 (antlr4ng)
- Key directories: `src/` (source), `tests/` (test files)

**Entry Point:** `src/index.ts`

**How to Run:**
```bash
npm run dev
```

**Test Command:**
```bash
npm test
```

## Files to Modify

| File | Service | What to Change |
|------|---------|---------------|
| `coverage.md` | main | Update as tests are written (in subsequent tickets) |
| `.auto-claude/tickets/` | main | Create new ticket files |

## Files to Reference

These files show patterns to follow:

| File | Pattern to Copy |
|------|----------------|
| `coverage.md` | Source of truth for uncovered tests |
| `tests/` directory structure | Naming conventions and organization |
| Existing `.cnx` test files | Test file format and structure |

## Patterns to Follow

### Ticket Format Pattern

Each ticket should follow this structure:

```markdown
# Ticket: [Category] - [Test Name]

## Description
Write test for [specific context/feature] in C-Next.

## Test Category
[Category from coverage.md]

## Context Being Tested
[Specific context from coverage.md table]

## Acceptance Criteria
- [ ] Test file created in `tests/[category]/[test-name].cnx`
- [ ] Test passes (or fails if it reveals a bug - see workflow)
- [ ] `coverage.md` updated: `[ ]` changed to `[x]` with test file reference
- [ ] Jest test runner passes

## Bug Handling
If this test reveals a bug:
1. Merge the failing test first
2. Create a separate ticket to fix the bug
3. The bug fix ticket should reference this test
```

**Key Points:**
- Each ticket covers exactly one test case
- Tests are grouped by category matching coverage.md structure
- Bug handling workflow is included in each ticket

## Requirements

### Functional Requirements

1. **Ticket Creation**
   - Description: Create one ticket per uncovered test case in coverage.md
   - Acceptance: All `[ ]` entries have corresponding tickets

2. **Test + Coverage Update**
   - Description: Each ticket scope includes writing the test AND updating coverage.md
   - Acceptance: Ticket acceptance criteria includes coverage.md update

3. **Bug Workflow Documentation**
   - Description: Document the test-first bug handling approach
   - Acceptance: Each ticket includes bug handling instructions

### Edge Cases

1. **Test reveals a bug** - Merge failing test first, create separate bug ticket
2. **Duplicate test contexts** - Ensure unique test file names across categories
3. **ERROR test cases** - These test expected compiler errors, handle appropriately

## Development Environment

### Start Services

```bash
npm install
npm test  # Run existing tests
```

### Required Environment Variables
- None required for testing

## Success Criteria

The task is complete when:

1. [ ] All uncovered test cases from coverage.md have corresponding tickets
2. [ ] Tickets are organized by category
3. [ ] Each ticket includes clear acceptance criteria
4. [ ] Bug handling workflow is documented in each ticket
5. [ ] Ticket format is consistent and actionable

## QA Acceptance Criteria

**CRITICAL**: These criteria must be verified by the QA Agent before sign-off.

### Verification Checks
| Check | What to Verify |
|-------|----------------|
| Ticket count | Number of tickets matches number of `[ ]` entries in coverage.md |
| Category coverage | All categories in coverage.md are represented |
| Ticket completeness | Each ticket has description, criteria, and bug workflow |
| No duplicates | No duplicate tickets for same test case |

### QA Sign-off Requirements
- [ ] All uncovered tests have tickets
- [ ] Tickets are properly categorized
- [ ] Acceptance criteria are clear and testable
- [ ] Bug handling workflow is documented
- [ ] No missing or duplicate tickets

---

## Uncovered Test Cases (Extracted from coverage.md)

### Category 1: Primitive Types

#### u8
| Test Case | Priority |
|-----------|----------|
| Array element type (multi-dim) | Medium |
| In bitwise operation | Medium |
| As loop counter | Medium |
| In ternary expression | Medium |
| With clamp modifier | Medium |
| With wrap modifier | Medium |
| In scope declaration | Medium |

#### u16
| Test Case | Priority |
|-----------|----------|
| Array element type (multi-dim) | Medium |
| In bitwise operation | Medium |
| As loop counter | Medium |
| In ternary expression | Medium |
| With const modifier | Medium |
| With clamp modifier | Medium |
| With wrap modifier | Medium |
| In scope declaration | Medium |

#### u64
| Test Case | Priority |
|-----------|----------|
| Array element type | Medium |
| Array element type (multi-dim) | Medium |
| In arithmetic expression | Medium |
| In comparison | Medium |
| In bitwise operation | Medium |
| As loop counter | Medium |
| In ternary expression | Medium |
| With const modifier | Medium |
| With clamp modifier | Medium |
| With wrap modifier | Medium |
| In scope declaration | Medium |
| In register field | Medium |

#### i8
| Test Case | Priority |
|-----------|----------|
| Array element type | Medium |
| In arithmetic expression | Medium |
| In comparison | Medium |
| Negative literal assignment | Medium |
| With const modifier | Medium |
| With clamp modifier | Medium |
| With wrap modifier | Medium |

#### i16
| Test Case | Priority |
|-----------|----------|
| Array element type | Medium |
| In arithmetic expression | Medium |
| In comparison | Medium |
| With const modifier | Medium |
| With clamp modifier | Medium |
| With wrap modifier | Medium |

#### i32
| Test Case | Priority |
|-----------|----------|
| Array element type | Medium |

#### i64
| Test Case | Priority |
|-----------|----------|
| Array element type | Medium |
| In arithmetic expression | Medium |
| In comparison | Medium |
| Negative literal assignment | Medium |
| With const modifier | Medium |
| With clamp modifier | Medium |
| With wrap modifier | Medium |

#### f32 (ALL MISSING - HIGH PRIORITY)
| Test Case | Priority |
|-----------|----------|
| Global variable declaration | High |
| Global variable with init | High |
| Local variable declaration | High |
| Local variable with init | High |
| Function parameter | High |
| Function return type | High |
| Struct member | High |
| Array element type | High |
| In arithmetic expression | High |
| In comparison | High |
| Literal with decimal | High |
| Literal with f32 suffix | High |

#### f64 (ALL MISSING - HIGH PRIORITY)
| Test Case | Priority |
|-----------|----------|
| Global variable declaration | High |
| Global variable with init | High |
| Local variable declaration | High |
| Local variable with init | High |
| Function parameter | High |
| Function return type | High |
| Struct member | High |
| Array element type | High |
| In arithmetic expression | High |
| In comparison | High |
| Literal with decimal | High |
| Literal with f64 suffix | High |

#### Boolean
| Test Case | Priority |
|-----------|----------|
| Function parameter | High |
| Function return type | High |
| Struct member | Medium |
| Array element type | Medium |

### Category 2: Assignment Operators

#### Compound Assignment
| Test Case | Operator | Priority |
|-----------|----------|----------|
| Bit index | +<- | Medium |
| this.member | -<- | Medium |
| global.member | -<- | Medium |
| this.member | *<- | Medium |
| global.member | *<- | Medium |
| this.member | /<- | Medium |
| global.member | /<- | Medium |
| this.member | %<- | Medium |
| global.member | %<- | Medium |
| this.member | &<- | Medium |
| global.member | &<- | Medium |
| this.member | \|<- | Medium |
| global.member | \|<- | Medium |
| this.member | ^<- | Medium |
| global.member | ^<- | Medium |
| this.member | <<<- | Medium |
| global.member | <<<- | Medium |
| this.member | >><- | Medium |
| global.member | >><- | Medium |

### Category 3: Comparison Operators

| Test Case | Priority |
|-----------|----------|
| Float = Float | High |
| Float = Literal | High |
| Float != Float | High |
| u8 < u8 | Medium |
| u16 < u16 | Medium |
| u64 < u64 | Medium |
| i8 < i8 | Medium |
| i16 < i16 | Medium |
| i64 < i64 | Medium |
| f32 < f32 | High |
| f64 < f64 | High |
| Literal < Integer | Low |
| u8 > u8 | Medium |
| u16 > u16 | Medium |
| u64 > u64 | Medium |
| i8 > i8 | Medium |
| i16 > i16 | Medium |
| i64 > i64 | Medium |
| f32 > f32 | High |
| f64 > f64 | High |
| Other types <= | Medium |
| Other types >= | Medium |

### Category 4: Arithmetic Operators

| Test Case | Priority |
|-----------|----------|
| u8 + u8 | Medium |
| u16 + u16 | Medium |
| u64 + u64 | Medium |
| i8 + i8 | Medium |
| i16 + i16 | Medium |
| i64 + i64 | Medium |
| f32 + f32 | High |
| f64 + f64 | High |
| u8 - u8 | Medium |
| u16 - u16 | Medium |
| u64 - u64 | Medium |
| i8 - i8 | Medium |
| i16 - i16 | Medium |
| i64 - i64 | Medium |
| f32 - f32 | High |
| f64 - f64 | High |
| f32 * f32 | High |
| f64 * f64 | High |
| f32 / f32 | High |
| f64 / f64 | High |
| Division by zero (ERROR) | Medium |
| Modulo by zero (ERROR) | Medium |

### Category 5: Bitwise Operators

| Test Case | Priority |
|-----------|----------|
| u8 & u8 | Medium |
| u16 & u16 | Medium |
| u64 & u64 | Medium |
| i8 & i8 | Medium |
| i16 & i16 | Medium |
| i32 & i32 | Medium |
| i64 & i64 | Medium |
| & with hex literal | Low |
| & with binary literal | Low |
| u8 \| u8 | Medium |
| u16 \| u16 | Medium |
| u64 \| u64 | Medium |
| \| with hex literal | Low |
| \| with binary literal | Low |
| u8 ^ u8 | Medium |
| u16 ^ u16 | Medium |
| u64 ^ u64 | Medium |
| ~u8 | Medium |
| ~u16 | Medium |
| ~u64 | Medium |
| ~i8 | Medium |
| ~i16 | Medium |
| ~i32 | Medium |
| ~i64 | Medium |
| u8 << amount | Medium |
| u16 << amount | Medium |
| u64 << amount | Medium |
| Shift by variable | Medium |
| Shift beyond width (ERROR) | Medium |
| u8 >> amount | Medium |
| u16 >> amount | Medium |
| u64 >> amount | Medium |
| i32 >> amount (arithmetic) | Medium |
| Right shift by variable | Medium |

### Category 6: Logical Operators

| Test Case | Priority |
|-----------|----------|
| && as standalone expression | Low |
| && short-circuit evaluation | Medium |
| && chained (a && b && c) | Medium |
| \|\| as standalone expression | Low |
| \|\| short-circuit evaluation | Medium |
| \|\| chained | Medium |
| ! in ternary condition | Medium |
| Double negation (!!) | Low |

### Category 7: Control Flow

#### if Statement
| Test Case | Priority |
|-----------|----------|
| Nested if | Medium |
| Non-boolean condition (ERROR) | Medium |

#### while Loop
| Test Case | Priority |
|-----------|----------|
| Nested while | Medium |
| While inside if | Medium |
| While inside scope | Medium |
| Non-boolean condition (ERROR) | Medium |
| Infinite while (while true) | Low |

#### do-while Loop
| Test Case | Priority |
|-----------|----------|
| Nested do-while | Medium |
| do-while inside if | Low |

#### for Loop
| Test Case | Priority |
|-----------|----------|
| For with compound update | Medium |
| For with multiple init | Low |
| For with empty init | Low |
| For with empty condition | Low |
| For with empty update | Low |
| For inside if | Medium |
| For inside scope | Medium |
| Non-boolean condition (ERROR) | Medium |

#### switch Statement
| Test Case | Priority |
|-----------|----------|
| Hex literal cases | Low |
| Char literal cases | Medium |
| Nested switch | Low |
| Switch inside loop | Medium |
| Switch inside scope | Medium |

#### critical Block
| Test Case | Priority |
|-----------|----------|
| Nested critical | Low |
| Critical in loop | Medium |
| Critical in if | Medium |

### Category 8: Ternary Operator

| Test Case | Priority |
|-----------|----------|
| In function argument | Medium |
| With function calls as values | Medium |

### Category 9: Struct Declaration

| Test Case | Priority |
|-----------|----------|
| As function return | Medium |
| Struct in scope | Medium |

### Category 10: Enum Declaration

| Test Case | Priority |
|-----------|----------|
| Enum as function parameter | Medium |
| Enum as function return | Medium |
| Cast to integer | Medium |

### Category 11: Bitmap Declaration

| Test Case | Priority |
|-----------|----------|
| bitmap24 | Medium |
| bitmap32 | Medium |
| As struct member | Medium |

### Category 12: Register Declaration

| Test Case | Priority |
|-----------|----------|
| w1c access modifier | Medium |
| w1s access modifier | Medium |
| Bit range access | Medium |
| Bitfield members | Medium |
| Read from wo (ERROR) | Medium |

### Category 13: Scope Declaration

| Test Case | Priority |
|-----------|----------|
| Scope with structs | Medium |
| private visibility | Medium |
| public visibility | Medium |
| Nested scopes | Low |

#### Scoped Types (this.Type)
| Test Case | Priority |
|-----------|----------|
| this.Type declaration | Medium |
| this.Type as parameter | Medium |
| this.Type as return | Medium |
| this.Type as variable | Medium |

#### Qualified Types (Scope.Type)
| Test Case | Priority |
|-----------|----------|
| Scope.Type as parameter | Medium |
| Scope.Type as return | Medium |

### Category 14: Functions

(No missing tests in this category)

### Category 15: Callbacks

| Test Case | Priority |
|-----------|----------|
| Array of callbacks | Medium |
| Callback as struct member | Medium |

### Category 16: Arrays

| Test Case | Priority |
|-----------|----------|
| Out of bounds (ERROR) | Medium |

### Category 17: Bit Indexing

| Test Case | Priority |
|-----------|----------|
| On u8 | Medium |
| On u16 | Medium |
| On u64 | Medium |
| Variable index | Medium |
| Expression index | Medium |
| Out of bounds index (ERROR) | Medium |

### Category 18: Strings

| Test Case | Priority |
|-----------|----------|
| As struct member | Medium |
| Array of strings | Medium |

### Category 19: Const Modifier

| Test Case | Priority |
|-----------|----------|
| Struct member | Medium |

### Category 20: Atomic Modifier

| Test Case | Priority |
|-----------|----------|
| With clamp | Medium |
| With wrap | Medium |
| In scope | Medium |
| As struct member | Medium |
| In critical section | Medium |

### Category 21: Overflow Modifiers

#### clamp (Saturating)
| Test Case | Priority |
|-----------|----------|
| u8 clamp | Medium |
| u16 clamp | Medium |
| u64 clamp | Medium |
| i8 clamp | Medium |
| i16 clamp | Medium |
| i64 clamp | Medium |
| Compound sub | Medium |
| Compound mul | Medium |
| With atomic | Medium |
| Underflow to min | Medium |

#### wrap (Wrapping)
| Test Case | Priority |
|-----------|----------|
| u8 wrap | Medium |
| u16 wrap | Medium |
| u64 wrap | Medium |
| i8 wrap | Medium |
| i16 wrap | Medium |
| i64 wrap | Medium |
| Compound sub | Medium |
| Compound mul | Medium |
| With atomic | Medium |

### Category 22: Type Casting

| Test Case | Priority |
|-----------|----------|
| Enum to int cast | Medium |

### Category 23: sizeof Operator

| Test Case | Priority |
|-----------|----------|
| Local array | Medium |
| Struct member | Medium |
| In expression | Medium |
| In array size | Medium |

### Category 24: Preprocessor

| Test Case | Priority |
|-----------|----------|
| Nested #ifdef | Low |

### Category 25: Comments

| Test Case | Priority |
|-----------|----------|
| Comment in expression | Low |

### Category 26: Initialization

| Test Case | Priority |
|-----------|----------|
| Loop init | Medium |
| Switch branch init | Medium |
| Partial branch init (ERROR) | Medium |

### Category 27: References

| Test Case | Priority |
|-----------|----------|
| Array pass by ref | Medium |
| Multiple output params | Medium |
| Ref in loop | Medium |

### Category 28: NULL Interop

| Test Case | Priority |
|-----------|----------|
| NULL in while | Medium |
| NULL in ternary | Medium |

### Category 29: Static Allocation

| Test Case | Priority |
|-----------|----------|
| Static string buffer | Medium |

### Category 30: C Interoperability

| Test Case | Priority |
|-----------|----------|
| Call C function | Medium |
| Use C typedef | Medium |
| Use C macro constant | Medium |
| Volatile qualifier | Medium |

### Category 30a: Volatile Modifier (ALL MISSING)

| Test Case | Priority |
|-----------|----------|
| Global variable | Medium |
| Local variable | Medium |
| Struct member | Medium |
| Register field (implied) | Medium |
| With const | Medium |
| With atomic | Medium |

### Category 31: ISR Type

| Test Case | Priority |
|-----------|----------|
| ISR as parameter | Medium |
| ISR in struct | Medium |
| ISR invocation | Medium |

### Category 32: Literals

#### Integer Literals
| Test Case | Priority |
|-----------|----------|
| Binary (0b) bit mask | Low |
| With u8 suffix | High |
| With u16 suffix | High |
| With u32 suffix | High |
| With i8 suffix | High |
| With i16 suffix | High |
| With i32 suffix | High |

#### Float Literals
| Test Case | Priority |
|-----------|----------|
| Decimal (3.14) variable init | High |
| Scientific (1e-5) variable init | High |
| With f32 suffix | High |
| With f64 suffix | High |

#### String Literals
| Test Case | Priority |
|-----------|----------|
| Escape sequences | Medium |

#### Character Literals (ALL MISSING - HIGH PRIORITY)
| Test Case | Priority |
|-----------|----------|
| Variable init | High |
| Array element | High |
| Comparison | High |
| In switch case | High |
| Escape sequences | High |

### Category 33: Generic Types (ALL MISSING - LOW PRIORITY)

| Test Case | Priority |
|-----------|----------|
| Type<Arg> declaration | Low |
| Type<Arg1, Arg2> | Low |
| Generic function | Low |
| Generic struct | Low |
| Numeric type parameter | Low |

### Category 34: Expression Contexts

#### Nested/Complex Expressions
| Test Case | Priority |
|-----------|----------|
| Ternary in function arg | Medium |
| Ternary in array index | Medium |
| Multiple operators same precedence | Medium |

#### Statement Nesting
| Test Case | Priority |
|-----------|----------|
| if inside if | Medium |
| while inside if | Medium |
| while inside while | Medium |
| for inside if | Medium |
| switch inside if | Medium |
| switch inside loop | Medium |
| critical inside if | Medium |
| critical inside loop | Medium |
| 3+ levels of nesting | Low |

---

## Summary Statistics

| Priority | Count |
|----------|-------|
| High | ~60 |
| Medium | ~180 |
| Low | ~25 |
| **Total Tickets Needed** | **~265** |

### High Priority Categories
1. Float types (f32, f64) - 24 tests
2. Character literals - 5 tests
3. Type-suffixed integer literals - 6 tests
4. Boolean as function param/return - 2 tests
5. Float comparisons - 6 tests
6. Float arithmetic - 8 tests
7. Float literals - 4 tests
