# ADR-109: CodeGenerator Decomposition

## Status

**Research**

## Context

`CodeGenerator.ts` is 10,570 lines with several massive methods:

| Method                 | Lines | Responsibility                  |
| ---------------------- | ----- | ------------------------------- |
| `generateAssignment`   | 1,646 | Assignment statement generation |
| `_generatePostfixExpr` | 818   | Postfix expression handling     |
| `generateVariableDecl` | 508   | Variable declaration generation |
| `trackVariableType`    | 322   | Type tracking for variables     |
| `generateMemberAccess` | 301   | Member access resolution        |

This violates basic maintainability principles and makes unit testing impractical. Issue #414 (unit tests for CodeGenerator) led to this investigation.

## Research: How Production Compilers Handle This

### LLVM: Multi-Stage Pipeline

**Source:** [LLVM Code Generator](https://llvm.org/docs/CodeGenerator.html)

LLVM uses a seven-stage pipeline where each stage has a single responsibility:

1. Instruction Selection (SelectionDAG)
2. Scheduling and Formation
3. SSA-based Optimizations
4. Register Allocation
5. Prolog/Epilog Insertion
6. Late Optimizations
7. Code Emission

**Key pattern:** Target-independent algorithms depend only on abstract interfaces. TableGen-driven descriptions reduce boilerplate.

**Problems encountered:** SelectionDAG became so complex that GlobalISel was created as a replacement - but after a decade, migration is still incomplete because "new optimizations are continually being implemented on the SDAG side."

### Roslyn (C#): Feature-Based Rewriters

**Source:** [Lowering in the C# Compiler](https://mattwarren.org/2017/05/25/Lowering-in-the-C-Compiler/)

Roslyn organizes code generation by language feature under `/src/Compilers/CSharp/Portable/Lowering/`:

```
Lowering/
├── AsyncRewriter/      # async/await → state machine
├── IteratorRewriter/   # yield → state machine
├── LambdaRewriter/     # lambdas → methods + closures
├── LocalRewriter/      # foreach, using, lock → primitives
└── StateMachineRewriter/
```

**Key pattern:** Each complex feature gets its own rewriter that transforms it into simpler constructs.

**Problems encountered:** "The complexity that arose from combining the concerns of compiler detail and quirks with trying to get the generation job done made for exceedingly complex code." Feature interactions create ordering dependencies.

### TypeScript: Dumb Emitter + Smart Transformers

**Source:** [TypeScript Codebase Emitter](https://github.com/microsoft/TypeScript/wiki/Codebase-Compiler-Emitter)

TypeScript separates concerns sharply:

- **Transformers** modify the AST before emission
- **Emitter** is "dumb" - just prints whatever AST it receives
- Pipeline: `Notification → Substitution → Comments → SourceMaps → Emit`

**Key insight:** "It's possible that a bug in emission is actually that the AST isn't set up the way that you'd like it."

**Problems encountered:** The type checker is a single 25,000-line file that "no one besides Microsoft really understands."

### Babel: Visitor Pattern + Plugins

**Source:** [Babel Plugin Handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md)

Babel uses the visitor pattern where each node type has its own handler:

```javascript
visitor: {
  Identifier(path) { /* handle identifiers */ },
  BinaryExpression(path) { /* handle binary ops */ }
}
```

**Problems encountered:**

- Plugin ordering matters - 12% of bug reports are ordering issues
- The "expression problem" - easy to add operations, hard to add node types
- Virtual dispatch prevents inlining, hurting performance

### Common Themes Across All Compilers

1. **Feature interactions** cause complexity regardless of architecture
2. **Ordering sensitivity** creates implicit dependencies
3. **The "big file" problem** appears everywhere (TypeScript's 25k-line checker)
4. **Simple dispatch beats visitors** when node types are fixed

## Analysis: What generateAssignment Actually Does

Analysis revealed 25 distinct assignment patterns, currently implemented as nested if-else chains with 55 return statements:

**Bitmap operations (3):**

- `bitmap_field_single_bit` - `flags.Running <- true`
- `bitmap_field_multi_bit` - `flags.Mode <- 3`
- `bitmap_array_element_field` - `arr[i].Field <- val`

**Register operations (5):**

- `register_bit` - `GPIO7_DR[3] <- true`
- `register_bit_range` - `GPIO7_DR[0, 4] <- val`
- `register_member_bitmap` - `MOTOR.CTRL.Running <- true`
- `register_write_only` - no read-modify-write needed
- `register_memory_mapped` - byte-aligned MMIO optimization

**Scoped register operations (2):**

- `scoped_register_bit` - `Teensy4.GPIO7.DR[bit] <- val`
- `scoped_register_bitmap` - `Scope.Register.Member.Field <- val`

**Integer bit operations (4):**

- `integer_bit` - `flags[3] <- true`
- `integer_bit_range` - `value[0, 4] <- 5`
- `struct_member_bit` - `item.byte[7] <- true`
- `array_element_bit` - `matrix[i][j][bit] <- true`

**String operations (4):**

- `string_simple` - `str <- "hello"`
- `string_struct_field` - `config.name <- "test"`
- `string_array_element` - `names[0] <- "first"`
- `string_struct_array` - `config.names[0] <- "first"`

**Array operations (2):**

- `array_element` - `arr[i] <- val`
- `array_slice` - `arr[offset, length] <- source`

**Special operations (2):**

- `atomic_rmw` - atomic read-modify-write
- `overflow_clamp` - saturating arithmetic

**Access patterns (3):**

- `global_member` - `global.counter <- val`
- `this_member` - `this.value <- val`
- `member_chain` - `a.b.c[i].d <- val`

**Base case (1):**

- `simple` - `x <- val`

## Decision

Decompose `generateAssignment` using a **classifier + handler + utils** pattern:

```
┌──────────────────────────────────────────────────────────────┐
│                    Main Entry Point                          │
│  generateAssignment(parseCtx, deps) → GenerationResult       │
└──────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Context   │     │   Validation    │     │  Classifier │
│   Builder   │     │                 │     │             │
│  (~200 loc) │     │   (~100 loc)    │     │  (~80 loc)  │
└─────────────┘     └─────────────────┘     └─────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Handler Registry                          │
│  25 handlers, each 5-15 lines, using utils                   │
└──────────────────────────────────────────────────────────────┘
                              │
       ┌──────────────────────┼──────────────────────┐
       ▼                      ▼                      ▼
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│  BitUtils   │     │  StringUtils    │     │  MmioUtils  │
└─────────────┘     └─────────────────┘     └─────────────┘
```

### Why This Pattern

1. **Not visitor pattern** - C-Next has a fixed set of constructs; we don't need extensibility for new node types
2. **Not Roslyn-style rewriters** - our assignments don't need lowering to simpler forms
3. **Classification is explicit** - the priority order is visible and auditable
4. **Utils are maximally reusable** - `BitUtils.singleBitWrite()` serves 9+ handlers

### Component Responsibilities

**Context Builder** (`buildAssignmentContext`):

- Extracts target structure from parse tree (identifiers, subscripts, prefixes)
- Resolves target type from registry/symbols
- Maps C-Next operators to C operators
- Generates value expression
- Output: immutable `AssignmentContext` object

**Validator** (`validateAssignment`):

- Const assignment checks
- Enum type compatibility
- Type conversion validation
- Compound operator restrictions
- Array bounds (compile-time)
- Throws descriptive errors

**Classifier** (`classifyAssignment`):

- Pure function: `AssignmentContext → AssignmentKind`
- Priority-based matching (most specific first)
- Returns one of 25 assignment kinds

**Handlers** (one per `AssignmentKind`):

- Each 5-15 lines
- Extracts specific info from context
- Calls utils to generate code
- Returns code string

**Utils** (`BitUtils`, `StringUtils`, `MmioUtils`, `TargetUtils`):

- Pure functions with primitive inputs
- Trivially testable
- Shared across multiple handlers

### Utils Specification

```typescript
class BitUtils {
  static boolToInt(value: string): string;
  static mask(width: number | string): string;
  static singleBitWrite(
    target: string,
    offset: number | string,
    value: string,
  ): string;
  static multiBitWrite(
    target: string,
    offset: number | string,
    width: number | string,
    value: string,
  ): string;
  static writeOnlyBitWrite(
    target: string,
    offset: number | string,
    value: string,
  ): string;
  static oneForType(typeName: string): string; // '1' vs '1ULL' for 64-bit
}

class StringUtils {
  static copyWithNull(target: string, value: string, capacity: number): string;
  static copy(target: string, value: string, capacity: number): string;
}

class MmioUtils {
  static volatileWrite(
    baseAddr: string,
    offset: number | string,
    value: string,
    widthBits: number,
  ): string;
}

class TargetUtils {
  static joinPath(parts: string[], separator: "." | "_" | "->" | "::"): string;
  static subscript(base: string, indices: string[]): string;
}
```

### AssignmentContext Interface

```typescript
interface AssignmentContext {
  target: {
    hasGlobalPrefix: boolean;
    hasThisPrefix: boolean;
    identifiers: string[];
    subscripts: SubscriptInfo[];
  };

  targetType: {
    baseType: string;
    isArray: boolean;
    isString: boolean;
    isBitmap: boolean;
    isRegister: boolean;
    isAtomic: boolean;
    isEnum: boolean;
    overflowBehavior: "clamp" | "wrap";
    arrayDimensions?: number[];
    stringCapacity?: number;
    bitmapTypeName?: string;
  } | null;

  operator: {
    cnextOp: string;
    cOp: string;
    isCompound: boolean;
  };

  value: string;

  scope: {
    currentScope: string | null;
  };
}
```

## Implementation Plan

### Phase 1: Extract Utils (Low Risk)

1. Create `src/codegen/utils/BitUtils.ts` with pure functions
2. Create `src/codegen/utils/StringUtils.ts`
3. Create `src/codegen/utils/MmioUtils.ts`
4. Write comprehensive unit tests for each util
5. **No changes to CodeGenerator yet**

### Phase 2: Create AssignmentGenerator Shell

1. Create `src/codegen/generators/statements/AssignmentGenerator.ts`
2. Define `AssignmentContext` interface
3. Implement `buildAssignmentContext()` - extracts from parse tree
4. Implement `classifyAssignment()` - returns kind
5. Wire up to call existing `generateAssignment()` as fallback
6. Add integration tests

### Phase 3: Migrate Handlers Incrementally

1. Start with simplest: `simple` handler
2. Add `string_simple`, `string_array_element`
3. Add `integer_bit`, `integer_bit_range`
4. Add bitmap handlers
5. Add register handlers
6. Each migration: add handler, add tests, remove code from old method

### Phase 4: Remove Legacy Code

1. Delete migrated code from `generateAssignment()`
2. Update CodeGenerator to delegate to AssignmentGenerator
3. Final cleanup and documentation

## Testing Strategy

| Layer           | Test Type            | Coverage Target            |
| --------------- | -------------------- | -------------------------- |
| Utils           | Unit                 | 100% - pure functions      |
| Handlers        | Unit                 | 100% - mock context        |
| Classifier      | Unit                 | 100% - all 25 kinds        |
| Validator       | Unit                 | All error paths            |
| Context Builder | Integration          | Representative parse trees |
| End-to-end      | Existing `.test.cnx` | No regressions             |

## Consequences

### Positive

- Each component independently testable
- Adding new assignment patterns = add kind + handler
- Shared logic in utils (BitUtils serves 9 handlers)
- Classification priority is explicit and auditable
- Estimated reduction: 1,646 lines → ~600 lines total

### Negative

- Context building still has some complexity (~200 lines)
- Classification priority order is implicit knowledge
- Migration requires careful incremental approach

### Risks

- Subtle behavioral differences during migration
- Priority order bugs if new kinds added incorrectly

### Mitigations

- Comprehensive existing test suite catches regressions
- Each handler tested in isolation before integration
- Classification tests cover all 25 kinds explicitly

## Future Work

Apply same pattern to `_generatePostfixExpr` (818 lines) - though it has additional complexity due to stateful chain processing. May need a "postfix chain context" object that gets passed between operations.

## Appendix: Example Handler Implementations

These examples show how handlers would use the utils:

```typescript
// BitUtils - shared across 9+ handlers
class BitUtils {
  static boolToInt(value: string): string {
    if (value === "true") return "1";
    if (value === "false") return "0";
    return `(${value} ? 1 : 0)`;
  }

  static mask(width: number): string {
    const mask = (1 << width) - 1;
    return `0x${mask.toString(16).toUpperCase()}`;
  }

  static singleBitWrite(target: string, offset: number, value: string): string {
    const boolVal = BitUtils.boolToInt(value);
    return `${target} = (${target} & ~(1 << ${offset})) | (${boolVal} << ${offset});`;
  }
}

// Example handlers using utils
const handlers = {
  bitmap_field_single_bit: (ctx) => {
    const target = resolveTarget(ctx);
    const fieldInfo = getBitmapFieldInfo(ctx);
    return BitUtils.singleBitWrite(target, fieldInfo.offset, ctx.value);
  },

  string_simple: (ctx) => {
    const target = resolveTarget(ctx);
    const capacity = ctx.targetType.stringCapacity;
    return `strncpy(${target}, ${ctx.value}, ${capacity}); ${target}[${capacity}] = '\\0';`;
  },

  simple: (ctx) => {
    const target = resolveTarget(ctx);
    return `${target} ${ctx.operator.cOp} ${ctx.value};`;
  },
};
```

## References

- Issue #414: Unit tests for CodeGenerator.ts
- [LLVM Code Generator](https://llvm.org/docs/CodeGenerator.html)
- [LLVM: The Bad Parts](https://www.npopov.com/2026/01/11/LLVM-The-bad-parts.html)
- [Lowering in the C# Compiler](https://mattwarren.org/2017/05/25/Lowering-in-the-C-Compiler/)
- [TypeScript Codebase Emitter](https://github.com/microsoft/TypeScript/wiki/Codebase-Compiler-Emitter)
- [Babel Plugin Handbook](https://github.com/jamiebuilds/babel-handbook/blob/master/translations/en/plugin-handbook.md)
- [Expression Problem](https://eli.thegreenplace.net/2016/the-expression-problem-and-its-solutions/)
