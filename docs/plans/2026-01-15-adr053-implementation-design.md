# ADR-053 Implementation Design

## Overview

This document outlines the implementation plan for ADR-053 (Transpiler Pipeline Architecture). The plan prioritizes **architecture-first** refactoring of CodeGenerator.ts, followed by **parallel workstreams** for multiple developers.

## Goals

1. Break up `CodeGenerator.ts` (8,441 lines) into focused modules
2. Establish clean module boundaries enabling parallel development
3. Unify the two code paths (`transpiler.ts` and `Project.ts`) into a single pipeline
4. Implement caching in `.cnx/` directory per ADR-053

## Architecture: Functional-Core, Imperative-Shell

### Design Principles

- **Generator modules are pure-ish functions**: Take AST node + read-only context, return generated code + effects
- **Orchestrator manages state**: CodeGenerator becomes a thin conductor that owns mutable state
- **Effects replace mutations**: Instead of `this.needsStdint = true`, generators return `{ type: 'include', header: 'stdint' }`
- **Registry pattern for dispatch**: Generators call each other through a typed registry

### Core Types

```typescript
// ═══════════════════════════════════════════════════════════════
// INPUTS - Read-only, built before generation starts
// ═══════════════════════════════════════════════════════════════
interface IGeneratorInput {
  readonly symbolTable: SymbolTable;
  readonly typeRegistry: ReadonlyMap<string, TTypeInfo>;
  readonly functionSignatures: ReadonlyMap<string, IFunctionSignature>;
  readonly knownFunctions: ReadonlySet<string>;
  readonly knownStructs: ReadonlySet<string>;
  readonly constValues: ReadonlyMap<string, number>;
  readonly callbackTypes: ReadonlyMap<string, ICallbackTypeInfo>;
  readonly targetCapabilities: ITargetCapabilities;
  readonly debugMode: boolean;
}

// ═══════════════════════════════════════════════════════════════
// TRANSIENT STATE - Managed by orchestrator, passed as snapshot
// ═══════════════════════════════════════════════════════════════
interface IGeneratorState {
  readonly currentScope: string | null;
  readonly indentLevel: number;
  readonly inFunctionBody: boolean;
  readonly currentParameters: ReadonlyMap<string, TParameterInfo>;
  readonly localVariables: ReadonlySet<string>;
  readonly localArrays: ReadonlySet<string>;
  readonly expectedType: string | null;
}

// ═══════════════════════════════════════════════════════════════
// EFFECTS - Returned by generators, collected by orchestrator
// ═══════════════════════════════════════════════════════════════
type TGeneratorEffect =
  | { type: "include"; header: "stdint" | "stdbool" | "string" | "cmsis" }
  | { type: "helper"; name: string } // e.g., "cnx_clamp_u8_add"
  | { type: "safe-div"; name: string } // e.g., "cnx_safe_div_u32"
  | { type: "register-type"; name: string; info: TTypeInfo }
  | { type: "register-local"; name: string; isArray: boolean };

// ═══════════════════════════════════════════════════════════════
// OUTPUT - What every generator function returns
// ═══════════════════════════════════════════════════════════════
interface IGeneratorOutput {
  code: string;
  effects: TGeneratorEffect[];
}
```

### Generator Registry

Generators call each other through a typed registry:

```typescript
// src/codegen/generators/GeneratorRegistry.ts

export class GeneratorRegistry {
  private input: IGeneratorInput;
  private orchestrator: IOrchestrator;

  constructor(input: IGeneratorInput, orchestrator: IOrchestrator) {
    this.input = input;
    this.orchestrator = orchestrator;
  }

  // Type-safe dispatch methods
  expression(ctx: Parser.ExpressionContext): IGeneratorOutput {
    return generateExpression(ctx, this.input, this.getState(), this);
  }

  statement(ctx: Parser.StatementContext): IGeneratorOutput {
    return generateStatement(ctx, this.input, this.getState(), this);
  }

  declaration(ctx: Parser.DeclarationContext): IGeneratorOutput {
    return generateDeclaration(ctx, this.input, this.getState(), this);
  }

  // State access (read-only snapshot)
  private getState(): IGeneratorState {
    return this.orchestrator.getStateSnapshot();
  }

  // Helpers for common patterns
  indented<T>(fn: () => IGeneratorOutput): IGeneratorOutput {
    this.orchestrator.pushIndent();
    const result = fn();
    this.orchestrator.popIndent();
    return result;
  }

  inScope<T>(scopeName: string, fn: () => IGeneratorOutput): IGeneratorOutput {
    this.orchestrator.pushScope(scopeName);
    const result = fn();
    this.orchestrator.popScope();
    return result;
  }
}
```

### Generator Module Example

```typescript
// src/codegen/generators/StatementGenerator.ts

export function generateStatement(
  ctx: Parser.StatementContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  registry: GeneratorRegistry,
): IGeneratorOutput {
  const effects: TGeneratorEffect[] = [];

  if (ctx.ifStatement()) {
    return generateIf(ctx.ifStatement()!, input, state, registry);
  }

  if (ctx.assignmentStatement()) {
    const expr = registry.expression(ctx.assignmentStatement()!.expression()!);
    effects.push(...expr.effects);

    return {
      code: `${target} = ${expr.code};`,
      effects,
    };
  }

  // ... etc
}
```

## Module Structure

```
src/codegen/
├── CodeGenerator.ts          # Slim orchestrator (~500 lines)
├── generators/
│   ├── GeneratorRegistry.ts  # Dispatch + helpers
│   ├── types.ts              # IGeneratorInput, IGeneratorOutput, etc.
│   │
│   │  # ═══ Declaration Generators ═══
│   ├── DeclarationGenerator.ts    # Top-level dispatch
│   ├── ScopeGenerator.ts          # namespace/class (ADR-016)
│   ├── StructGenerator.ts         # struct definitions
│   ├── EnumGenerator.ts           # enum/bitmap (ADR-017)
│   ├── FunctionGenerator.ts       # function definitions
│   ├── VariableGenerator.ts       # variable declarations
│   ├── RegisterGenerator.ts       # register bindings (ADR-004)
│   │
│   │  # ═══ Statement Generators ═══
│   ├── StatementGenerator.ts      # Top-level dispatch
│   ├── ControlFlowGenerator.ts    # if/while/for/do-while
│   ├── SwitchGenerator.ts         # switch (ADR-025)
│   ├── CriticalGenerator.ts       # critical sections (ADR-050)
│   ├── AssignmentGenerator.ts     # assignments + atomics
│   │
│   │  # ═══ Expression Generators ═══
│   ├── ExpressionGenerator.ts     # Top-level dispatch
│   ├── BinaryExprGenerator.ts     # +, -, *, /, comparisons
│   ├── UnaryExprGenerator.ts      # !, -, ~, ++, --
│   ├── AccessExprGenerator.ts     # member access, array access
│   ├── CallExprGenerator.ts       # function calls
│   ├── LiteralGenerator.ts        # numbers, strings, bools
│   │
│   │  # ═══ Support Generators ═══
│   ├── HelperGenerator.ts         # overflow helpers, safe-div
│   ├── IncludeGenerator.ts        # #include processing
│   └── CommentGenerator.ts        # comment preservation
│
├── types/                    # (existing, keep as-is)
├── SymbolCollector.ts        # (existing)
├── TypeResolver.ts           # (existing)
├── TypeValidator.ts          # (existing)
└── ... other existing files
```

## Extraction Strategy: Strangler Fig Pattern

Extract incrementally while keeping tests green:

### Step 1: Create infrastructure (no behavior change)

- Create `src/codegen/generators/` directory
- Create `types.ts` with IGeneratorInput, IGeneratorOutput, TGeneratorEffect
- Create `GeneratorRegistry.ts` with empty dispatch methods
- Add registry to CodeGenerator, but don't use it yet

### Step 2: Extract first module (ExpressionGenerator)

- Copy expression methods to ExpressionGenerator.ts
- Refactor to return IGeneratorOutput instead of mutating
- Update GeneratorRegistry.expression() to call it
- Update CodeGenerator to use registry.expression()
- Delete old methods from CodeGenerator
- Run tests - must stay green

### Step 3: Repeat for each module

- StatementGenerator (control flow, assignments)
- DeclarationGenerator (functions, variables)
- StructGenerator, EnumGenerator, etc.

## Pipeline Unification

Once CodeGenerator is modular, implement ADR-053's unified pipeline:

```typescript
// src/pipeline/Pipeline.ts

export class Pipeline {
  async transpile(input: string): Promise<IPipelineResult> {
    // 1. Source Discovery (file or directory)
    const sourceFiles = await discoverSources(input);

    // 2. For each source, build dependency tree
    const depTrees = await Promise.all(
      sourceFiles.map((f) => this.preprocessor.buildTree(f)),
    );

    // 3. Collect symbols from all C/C++ headers (deduplicated)
    const symbolTable = await this.collectSymbols(depTrees);

    // 4. Transpile each .cnx file
    const results = await Promise.all(
      sourceFiles.map((f) => this.transpileFile(f, symbolTable)),
    );

    return { results, symbolTable };
  }
}
```

### Components Status

| Component               | Status  | Notes                                      |
| ----------------------- | ------- | ------------------------------------------ |
| `InputExpansion.ts`     | Exists  | Finds .cnx files from file/directory input |
| `IncludeDiscovery.ts`   | Exists  | Parses #include directives                 |
| `Preprocessor.ts`       | Exists  | Builds dependency tree                     |
| `CSymbolCollector.ts`   | Exists  | Parses C headers                           |
| `CppSymbolCollector.ts` | Exists  | Parses C++ headers                         |
| `SymbolTable.ts`        | Exists  | Stores cross-file symbols                  |
| GeneratorRegistry       | **New** | Dispatch + state helpers                   |
| Generator modules       | **New** | Extracted from CodeGenerator               |
| Pipeline orchestrator   | **New** | Unifies single/multi-file paths            |
| Cache (.cnx/)           | **New** | Timestamp-based invalidation               |

## Parallel Workstreams

### Track A: CodeGenerator Refactor

| Workstream             | Description             | Files                                                                                                                                                            | Dependencies   |
| ---------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| **A1: Infrastructure** | Core types and registry | `types.ts`, `GeneratorRegistry.ts`                                                                                                                               | None           |
| **A2: Expressions**    | Expression generation   | `ExpressionGenerator.ts`, `BinaryExprGen.ts`, `UnaryExprGen.ts`, `AccessExprGen.ts`, `CallExprGen.ts`, `LiteralGenerator.ts`                                     | A1 scaffolding |
| **A3: Statements**     | Statement generation    | `StatementGenerator.ts`, `ControlFlowGenerator.ts`, `SwitchGenerator.ts`, `AssignmentGenerator.ts`, `CriticalGenerator.ts`                                       | A1 scaffolding |
| **A4: Declarations**   | Declaration generation  | `DeclarationGenerator.ts`, `FunctionGenerator.ts`, `VariableGenerator.ts`, `StructGenerator.ts`, `EnumGenerator.ts`, `RegisterGenerator.ts`, `ScopeGenerator.ts` | A1 scaffolding |

### Track B: Pipeline Unification

| Workstream            | Description      | Files                                               | Dependencies     |
| --------------------- | ---------------- | --------------------------------------------------- | ---------------- |
| **B1: Pipeline Core** | Unified pipeline | `Pipeline.ts`, merge `transpiler.ts` + `Project.ts` | A1 complete      |
| **B2: Cache Layer**   | .cnx/ caching    | `CacheManager.ts`, cache structure                  | B1 started       |
| **B3: Integration**   | CLI, tests, docs | Update CLI entry, tests, VS Code extension          | B1 + B2 complete |

### Developer Assignment

| Developer        | Workstream         | Blocked By     |
| ---------------- | ------------------ | -------------- |
| Dev 1            | A1: Infrastructure | Nothing        |
| Dev 2            | A2: Expressions    | A1 scaffolding |
| Dev 3            | A3: Statements     | A1 scaffolding |
| Dev 4            | A4: Declarations   | A1 scaffolding |
| Dev 1 (after A1) | B1: Pipeline Core  | A1 complete    |

### Merge Conflict Avoidance

Each developer works in different files:

- **Dev 1 (A1)**: `types.ts`, `GeneratorRegistry.ts`
- **Dev 2 (A2)**: `ExpressionGenerator.ts`, `BinaryExprGenerator.ts`, etc.
- **Dev 3 (A3)**: `StatementGenerator.ts`, `ControlFlowGenerator.ts`, etc.
- **Dev 4 (A4)**: `DeclarationGenerator.ts`, `StructGenerator.ts`, etc.

Only `CodeGenerator.ts` shrinks as methods get extracted - deletions, not edits.

## Testing Strategy

1. **Unit tests per generator**: Each generator module gets its own test file
2. **Integration tests**: Existing test suite must stay green throughout
3. **Effect testing**: Verify generators return correct effects
4. **Snapshot tests**: Compare generated code before/after extraction

## Success Criteria

- [ ] CodeGenerator.ts reduced from 8,441 lines to ~500 lines
- [ ] All 17+ generator modules extracted and tested
- [ ] Single pipeline for both single-file and multi-file transpilation
- [ ] Cache implemented in .cnx/ directory
- [ ] All existing tests pass
- [ ] No regression in transpilation output

## Related Documents

- [ADR-053: Transpiler Pipeline Architecture](../decisions/adr-053-transpiler-pipeline-architecture.md)
