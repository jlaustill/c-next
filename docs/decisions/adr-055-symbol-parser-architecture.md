# ADR-055: Symbol Resolution Architecture

## Status

**Implemented** (All phases complete)

### Implementation Progress

| Phase | Description                                                   | Status      | Issue                                                  |
| ----- | ------------------------------------------------------------- | ----------- | ------------------------------------------------------ |
| 0     | Parallel Type System (`TSymbol` + `ISymbol` coexist)          | ✅ Complete | -                                                      |
| 1     | Directory Restructure (`src/transpiler/logic/symbols/cnext/`) | ✅ Complete | -                                                      |
| 2     | Build Composable Collectors (7 collectors with tests)         | ✅ Complete | -                                                      |
| 3     | Create Orchestrator (`CNextResolver`)                         | ✅ Complete | -                                                      |
| 4     | Add CacheKeyGenerator                                         | ✅ Complete | -                                                      |
| 5     | Migrate Consumers (`TSymbolAdapter` bridges old/new)          | ✅ Complete | [#803](https://github.com/jlaustill/c-next/issues/803) |
| 6     | Repeat for C++/C (`CResolver`, `CppResolver`)                 | ✅ Complete | [#804](https://github.com/jlaustill/c-next/issues/804) |
| 7     | Typed Symbol Storage in SymbolTable                           | ✅ Complete | [#805](https://github.com/jlaustill/c-next/issues/805) |

### Phase 7 Implementation Notes

Phase 7 implemented typed symbol storage with backwards compatibility:

- **TAnySymbol**: Union type `TSymbol | TCSymbol | TCppSymbol` for cross-language operations
- **SymbolTable**: Separate typed storage per language (`tSymbols`, `cSymbols`, `cppSymbols`)
- **Auto-registration**: Struct fields automatically registered when adding struct symbols
- **IHeaderSymbol**: Narrow interface for header generation (decoupled from full symbols)
- **Cache bridge**: Cache still stores ISymbol format with conversion layer for typed symbols
- **Public API**: `TSymbolAdapter` and `CTSymbolAdapter` retained for `parseWithSymbols` and `parseCHeader`

## Context

C-Next currently has **two separate C-Next symbol collectors** that walk the same AST to extract similar information:

1. `src/codegen/SymbolCollector.ts` (758 lines) - Used by CodeGenerator during code generation
2. `src/symbols/CNextSymbolCollector.ts` (507 lines) - Used for the unified SymbolTable

### Why Two Collectors Exist

| Collector                      | When It Runs                            | What It Captures                                                                                      | Output Format                                             |
| ------------------------------ | --------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `codegen/SymbolCollector`      | During `CodeGenerator.generate()`       | Detailed type info for code gen (struct field types, enum values, bitmap offsets, register addresses) | Rich Maps (e.g., `Map<structName, Map<fieldName, type>>`) |
| `symbols/CNextSymbolCollector` | Before code generation (Pipeline stage) | Symbol names and metadata for cross-language lookups                                                  | Flat `ISymbol[]` array                                    |

The codegen collector runs **during** generation (single-pass), while the symbols collector runs **before** to populate the SymbolTable. This timing difference exists because CodeGenerator was originally monolithic and had its own symbol collection embedded.

### Problems

1. **Confusion**: Developers don't know which collector to use or modify
2. **Duplication**: ~500+ lines of similar AST-walking logic
3. **Inconsistency**: Different collectors may extract slightly different data
4. **Poor discoverability**: Symbol collection code scattered across `codegen/`, `symbols/`, and `parser/`

### Current Directory Structure (Problematic)

```
src/
├── parser/           # Only ANTLR grammars - misleading name
├── symbols/          # SymbolTable + 3 collectors (C, C++, CNext)
├── codegen/          # Code gen + ANOTHER CNext SymbolCollector + TypeResolver
└── analysis/         # Static analyzers
```

A developer looking for "where symbols are resolved" has no clear answer.

### Current ISymbol (Richer Than Initially Described)

The existing `ISymbol` interface already includes more than basic metadata:

```typescript
interface ISymbol {
  name: string;
  kind: ESymbolKind;
  type?: string;
  sourceFile: string;
  sourceLine: number;
  sourceLanguage: ESourceLanguage;
  isExported: boolean;

  // Already present:
  parameters?: Array<{
    name: string;
    type: string;
    isConst: boolean;
    isArray: boolean;
    arrayDimensions?: string[];
    isAutoConst?: boolean;
  }>;
  accessModifier?: string; // For register members
  size?: number; // For arrays/bit widths
  isArray?: boolean;
  arrayDimensions?: string[];
  isConst?: boolean;
}
```

However, struct fields, enum values, and bitmap field offsets are stored **separately** in `SymbolTable` (e.g., `structFields: Map<string, Map<string, IStructFieldInfo>>`), not on the symbols themselves. This separation is what the discriminated union aims to consolidate.

## Research: How Production Compilers Handle This

### Clang (LLVM)

**Source:** [Clang DeclContext](https://clang.llvm.org/doxygen/classclang_1_1DeclContext.html)

- Uses **DeclContext** - every declaration exists within a context (TranslationUnit, Namespace, Class, Function)
- **One lookup table per context**, lazily constructed
- Symbol information is **embedded in AST nodes**, not stored separately
- Two views: lexical (source order) and semantic (lookup)

**Key insight:** One pass, results embedded in the IR.

### Rust (rustc)

**Source:** [Rust Name Resolution](https://rustc-dev-guide.rust-lang.org/name-resolution.html)

- **Single resolution pass** after parsing
- Produces a `Res` index mapping paths to definitions
- Results referenced by HIR (High-level IR)
- All later phases query the resolved data

**Key insight:** Collect once, query everywhere.

### GCC

**Source:** [Compiler Design - Symbol Tables](https://www.tutorialspoint.com/compiler_design/compiler_design_symbol_table.htm)

- **Hierarchical symbol tables** - global + per-scope tables
- Front-end builds tables, middle/back-end consume them

### Common Pattern

| Compiler | Collection                 | Storage                                    |
| -------- | -------------------------- | ------------------------------------------ |
| Clang    | Single pass during parsing | Embedded in AST (DeclContext)              |
| Rust     | Single resolution pass     | Index stored separately, referenced by HIR |
| GCC      | Single pass                | Hierarchical tables                        |

**All production compilers collect symbols ONCE and store results that all phases can query.**

## Decision

### 1. Rename Directories for Clarity

| Old            | New                      | Purpose                          |
| -------------- | ------------------------ | -------------------------------- |
| `src/parser/`  | `src/antlr_parser/`      | ANTLR grammar files only         |
| `src/symbols/` | `src/symbol_resolution/` | All symbol resolution/collection |

The name `symbol_resolution/` is accurate: we're not "parsing" symbols (that's lexing/parsing), we're **resolving** semantic information from an already-parsed AST.

### 2. One Collector Per Language with Composable Sub-Collectors

Each language gets its own folder with small, focused, testable collectors:

```
src/symbol_resolution/
├── SymbolTable.ts              # Central storage for all languages
├── types/                      # Shared types (TSymbol, IFieldInfo, etc.)
│
├── cnext/                      # C-Next language
│   ├── index.ts                # CNextResolver (orchestrator)
│   ├── collectors/
│   │   ├── ScopeCollector.ts       # ~50-80 lines each
│   │   ├── StructCollector.ts
│   │   ├── EnumCollector.ts
│   │   ├── BitmapCollector.ts
│   │   ├── RegisterCollector.ts
│   │   ├── FunctionCollector.ts
│   │   └── VariableCollector.ts
│   ├── types/                  # C-Next specific types
│   └── __tests__/              # Unit tests for each collector
│
├── cpp/                        # C++ language
│   ├── index.ts                # CppResolver
│   ├── collectors/
│   │   ├── ClassCollector.ts
│   │   ├── NamespaceCollector.ts
│   │   ├── EnumClassCollector.ts
│   │   └── FunctionCollector.ts
│   └── __tests__/
│
└── c/                          # C language
    ├── index.ts                # CResolver
    ├── collectors/
    └── __tests__/
```

### 3. Rich Discriminated Union for Symbols

Extend the type system with a discriminated union that carries full semantic information. This consolidates data currently split between `ISymbol` and separate `SymbolTable` maps:

```typescript
// Proposed: Rich discriminated union
type TSymbol =
  | IStructSymbol
  | IEnumSymbol
  | IBitmapSymbol
  | IFunctionSymbol
  | IVariableSymbol
  | IScopeSymbol
  | IRegisterSymbol;

interface IBaseSymbol {
  name: string;
  sourceFile: string;
  sourceLine: number;
  sourceLanguage: ESourceLanguage;
  isExported: boolean;
}

interface IStructSymbol extends IBaseSymbol {
  kind: ESymbolKind.Struct;
  fields: Map<string, IFieldInfo>;
}

interface IFieldInfo {
  type: string;
  isArray: boolean;
  dimensions?: number[];
  isConst: boolean;
}

interface IEnumSymbol extends IBaseSymbol {
  kind: ESymbolKind.Enum;
  members: Map<string, number>; // Actual numeric values
  bitWidth?: number; // Issue #208: For C enums
}

interface IBitmapSymbol extends IBaseSymbol {
  kind: ESymbolKind.Bitmap;
  backingType: string; // "uint8_t", "uint16_t", etc.
  bitWidth: number; // 8, 16, 32
  fields: Map<string, IBitmapFieldInfo>;
}

interface IBitmapFieldInfo {
  offset: number;
  width: number;
}

interface IFunctionSymbol extends IBaseSymbol {
  kind: ESymbolKind.Function;
  returnType: string;
  parameters: IParameterInfo[];
  visibility: "public" | "private";
}

interface IParameterInfo {
  name: string;
  type: string;
  isConst: boolean;
  isArray: boolean;
  arrayDimensions?: string[];
  isAutoConst?: boolean;
}

interface IScopeSymbol extends IBaseSymbol {
  kind: ESymbolKind.Namespace; // Reuse existing Namespace kind for C-Next scopes
  members: Set<string>;
  memberVisibility: Map<string, "public" | "private">;
}

interface IRegisterSymbol extends IBaseSymbol {
  kind: ESymbolKind.Register;
  baseAddress: string;
  members: Map<string, IRegisterMemberInfo>;
}

interface IRegisterMemberInfo {
  offset: string;
  cType: string;
  access: "rw" | "ro" | "wo" | "w1c" | "w1s";
  bitmapType?: string; // If member uses a bitmap type
}

interface IVariableSymbol extends IBaseSymbol {
  kind: ESymbolKind.Variable;
  type: string;
  isConst: boolean;
  isArray: boolean;
  arrayDimensions?: number[];
  initialValue?: string; // For const inlining (Issue #282)
}
```

### 4. Eager Collection (Not Lazy)

We use **eager collection** - all symbol data is collected upfront when a file is processed. This is simpler than lazy collection and adequate for C-Next's use case:

- C-Next projects are typically small-to-medium embedded codebases
- Files are processed sequentially, not in parallel
- No persistent server keeping state

Lazy collection would add complexity (tracking "have I collected this yet?" state) without meaningful benefit.

### 5. Forward Declarations (C/C++ Only)

C-Next does not support forward declarations. For C/C++ headers that do use them:

- `SymbolTable` already handles merging symbols from multiple files
- A forward declaration in one file and definition in another both add to the table
- The discriminated union doesn't change this - it just makes the merged data richer

### 6. Cache Key Encapsulation

The current caching uses file modification timestamps (`stats.mtimeMs`). To support future improvements (like content hashing), encapsulate cache key generation:

```typescript
// symbol_resolution/cache/CacheKeyGenerator.ts

class CacheKeyGenerator {
  /**
   * Generate a cache key for a file.
   * Currently uses mtime; can be changed to content hash later.
   */
  static generate(filePath: string): string {
    const stats = statSync(filePath);
    return `${filePath}:${stats.mtimeMs}`;
  }

  /**
   * Check if a cached entry is still valid.
   */
  static isValid(filePath: string, cachedKey: string): boolean {
    const currentKey = this.generate(filePath);
    return currentKey === cachedKey;
  }
}
```

This isolates the cache invalidation strategy to a single location.

### 7. Composable Collector Pattern

Each collector is small, focused, stateless, and independently testable:

```typescript
// symbol_resolution/cnext/collectors/StructCollector.ts

import * as Parser from "../../antlr_parser/grammar/CNextParser";
import { IStructSymbol, IFieldInfo } from "../types";

class StructCollector {
  /**
   * Collect a struct declaration into a rich symbol.
   * Stateless - all context passed as parameters.
   */
  collect(
    ctx: Parser.StructDeclarationContext,
    sourceFile: string,
    scopeName?: string,
  ): IStructSymbol {
    const name = ctx.IDENTIFIER().getText();
    const fullName = scopeName ? `${scopeName}_${name}` : name;

    return {
      kind: ESymbolKind.Struct,
      name: fullName,
      sourceFile,
      sourceLine: ctx.start?.line ?? 0,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
      fields: this.collectFields(ctx),
    };
  }

  private collectFields(
    ctx: Parser.StructDeclarationContext,
  ): Map<string, IFieldInfo> {
    const fields = new Map<string, IFieldInfo>();

    for (const member of ctx.structMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const typeCtx = member.type();

      fields.set(fieldName, {
        type: typeCtx.getText(),
        isArray: member.arrayDimension().length > 0,
        dimensions: this.extractDimensions(member),
        isConst: false,
      });
    }

    return fields;
  }

  private extractDimensions(
    member: Parser.StructMemberContext,
  ): number[] | undefined {
    const dims = member.arrayDimension();
    if (dims.length === 0) return undefined;

    return dims.map((dim) => {
      const expr = dim.expression();
      return expr ? parseInt(expr.getText(), 10) : 0;
    });
  }
}

export default StructCollector;
```

### 8. Orchestrator Composes Collectors

```typescript
// symbol_resolution/cnext/index.ts

import * as Parser from "../antlr_parser/grammar/CNextParser";
import StructCollector from "./collectors/StructCollector";
import EnumCollector from "./collectors/EnumCollector";
import BitmapCollector from "./collectors/BitmapCollector";
import ScopeCollector from "./collectors/ScopeCollector";
import RegisterCollector from "./collectors/RegisterCollector";
// ... other collectors

class CNextResolver {
  private structCollector = new StructCollector();
  private enumCollector = new EnumCollector();
  private bitmapCollector = new BitmapCollector();
  private scopeCollector = new ScopeCollector();
  private registerCollector = new RegisterCollector();
  // ...

  /**
   * Resolve all symbols from a C-Next program.
   * Returns rich symbols with full semantic information.
   */
  resolve(tree: Parser.ProgramContext, sourceFile: string): TSymbol[] {
    const symbols: TSymbol[] = [];

    // First pass: collect bitmaps (needed before registers reference them)
    for (const decl of tree.declaration()) {
      if (decl.bitmapDeclaration()) {
        symbols.push(
          this.bitmapCollector.collect(decl.bitmapDeclaration()!, sourceFile),
        );
      }
    }

    // Second pass: collect everything else
    for (const decl of tree.declaration()) {
      if (decl.scopeDeclaration()) {
        symbols.push(
          ...this.scopeCollector.collect(decl.scopeDeclaration()!, sourceFile),
        );
      }
      if (decl.structDeclaration()) {
        symbols.push(
          this.structCollector.collect(decl.structDeclaration()!, sourceFile),
        );
      }
      if (decl.enumDeclaration()) {
        symbols.push(
          this.enumCollector.collect(decl.enumDeclaration()!, sourceFile),
        );
      }
      if (decl.registerDeclaration()) {
        symbols.push(
          this.registerCollector.collect(
            decl.registerDeclaration()!,
            sourceFile,
          ),
        );
      }
      // ... other declarations
    }

    return symbols;
  }
}

export default CNextResolver;
```

### 9. CodeGenerator Queries SymbolTable

After this refactoring, CodeGenerator no longer has its own SymbolCollector:

```typescript
// codegen/CodeGenerator.ts (simplified)

class CodeGenerator {
  private symbolTable: SymbolTable;

  generate(tree: Parser.ProgramContext): string {
    // Query symbols from the shared table
    const structs = this.symbolTable.getStructs();
    const enums = this.symbolTable.getEnums();

    // Use rich symbol data directly
    for (const struct of structs) {
      // struct.fields is Map<string, IFieldInfo> - no separate lookup needed
      this.generateStructCode(struct);
    }
  }
}
```

## Migration Plan

### Phase 0: Parallel Type System (Low Risk)

1. Create `src/symbol_resolution/types/TSymbol.ts` with the new discriminated union
2. Keep existing `ISymbol` unchanged
3. Both types coexist - no breaking changes yet
4. Add type guards: `isStructSymbol(s): s is IStructSymbol`

### Phase 1: Directory Restructure

1. Rename `src/parser/` → `src/antlr_parser/`
2. Rename `src/symbols/` → `src/symbol_resolution/`
3. Update all imports (automated with find/replace)
4. No functional changes - just file moves

### Phase 2: Build Composable Collectors

1. Create `src/symbol_resolution/cnext/collectors/` directory
2. Extract `StructCollector` from existing code
3. Add unit tests for `StructCollector`
4. Repeat for Enum, Bitmap, Scope, Register, Function, Variable
5. Each collector returns the new `TSymbol` types

### Phase 3: Create Orchestrator

1. Create `src/symbol_resolution/cnext/index.ts` (CNextResolver)
2. Wire up all collectors
3. Add integration tests
4. Orchestrator returns `TSymbol[]`

### Phase 4: Add CacheKeyGenerator

1. Create `src/symbol_resolution/cache/CacheKeyGenerator.ts`
2. Migrate `CacheManager.isValid()` to use it
3. Single point of change for future cache key strategies

### Phase 5: Migrate Consumers (One at a Time)

1. Update `Pipeline.ts` to use new `CNextResolver`
2. Update `SymbolTable` to store `TSymbol[]` internally
3. Add adapter methods for backwards compatibility if needed
4. Update `CodeGenerator.ts` to query `SymbolTable` instead of having its own collector
5. Update `HeaderGenerator.ts` similarly
6. Remove old `src/codegen/SymbolCollector.ts`
7. Remove old `src/symbol_resolution/CNextSymbolCollector.ts`

### Phase 6: Repeat for C++ and C

1. Apply same pattern to `CppResolver`
2. Apply same pattern to `CResolver`

### Phase 7: Remove Legacy Types

1. Remove `ISymbol` once all consumers migrated
2. Remove backwards compatibility adapters

## Consequences

### Positive

- **Clear discoverability**: "Where are symbols resolved?" → `src/symbol_resolution/`
- **One collector per language**: No more duplicate C-Next collectors
- **Testable units**: Each collector is 50-100 lines, easily unit tested
- **Rich data model**: Symbols carry full semantic information (no separate maps)
- **DRY**: CodeGenerator and HeaderGenerator query the same data
- **Extensible**: Adding new symbol types means adding a new collector file
- **Future-proof caching**: CacheKeyGenerator isolates invalidation strategy

### Negative

- **Migration effort**: Significant refactoring across multiple files
- **Breaking change**: Consumers of old `ISymbol` need updates (mitigated by Phase 0)
- **Learning curve**: New architecture to understand

### Neutral

- **More files**: Trade one 758-line file for ~7 smaller files
- **Type complexity**: Discriminated union is more complex than flat interface
- **Eager collection**: Collects all data upfront (adequate for C-Next project sizes)

## Test Strategy

### Unit Tests (Per Collector)

Each collector gets its own test file:

```typescript
// symbol_resolution/cnext/__tests__/StructCollector.test.ts

describe("StructCollector", () => {
  const collector = new StructCollector();

  it("should collect struct with primitive fields", () => {
    const tree = parse(`
      struct Point {
        i32 x;
        i32 y;
      }
    `);
    const ctx = tree.declaration(0).structDeclaration()!;

    const symbol = collector.collect(ctx, "test.cnx");

    expect(symbol.name).toBe("Point");
    expect(symbol.kind).toBe(ESymbolKind.Struct);
    expect(symbol.fields.get("x")?.type).toBe("i32");
    expect(symbol.fields.get("y")?.type).toBe("i32");
  });

  it("should collect struct with array fields", () => {
    const tree = parse(`
      struct Buffer {
        u8 data[256];
      }
    `);
    const ctx = tree.declaration(0).structDeclaration()!;

    const symbol = collector.collect(ctx, "test.cnx");

    expect(symbol.fields.get("data")?.isArray).toBe(true);
    expect(symbol.fields.get("data")?.dimensions).toEqual([256]);
  });

  it("should prefix struct name with scope", () => {
    const tree = parse(`
      struct State {
        u8 value;
      }
    `);
    const ctx = tree.declaration(0).structDeclaration()!;

    const symbol = collector.collect(ctx, "test.cnx", "Motor");

    expect(symbol.name).toBe("Motor_State");
  });
});
```

### Integration Tests (Orchestrator)

```typescript
// symbol_resolution/cnext/__tests__/CNextResolver.integration.test.ts

describe("CNextResolver", () => {
  const resolver = new CNextResolver();

  it("should resolve all symbol types from a complete file", () => {
    const tree = parse(`
      struct Point { i32 x; i32 y; }
      enum Color { Red, Green, Blue }
      bitmap8 Flags { enabled: 1; ready: 1; error: 1; reserved: 5; }

      scope Motor {
        public void start() { }
      }
    `);

    const symbols = resolver.resolve(tree, "test.cnx");

    expect(symbols).toHaveLength(4);
    expect(symbols.find((s) => s.name === "Point")?.kind).toBe(
      ESymbolKind.Struct,
    );
    expect(symbols.find((s) => s.name === "Color")?.kind).toBe(
      ESymbolKind.Enum,
    );
    expect(symbols.find((s) => s.name === "Flags")?.kind).toBe(
      ESymbolKind.Bitmap,
    );
    expect(symbols.find((s) => s.name === "Motor")?.kind).toBe(
      ESymbolKind.Namespace,
    );
  });
});
```

### Regression Tests

During migration, ensure output matches current behavior:

```typescript
// symbol_resolution/__tests__/regression.test.ts

describe("Regression: symbol resolution matches legacy collectors", () => {
  it("should produce equivalent data for existing test files", () => {
    // Parse with both old and new systems
    // Compare outputs
  });
});
```

## Related Issues

### Active (Remaining Phases)

- [#803](https://github.com/jlaustill/c-next/issues/803): Phase 5 - Migrate consumers to TSymbol system
- [#804](https://github.com/jlaustill/c-next/issues/804): Phase 6 - Create CppResolver and CResolver
- [#805](https://github.com/jlaustill/c-next/issues/805): Phase 7 - Remove legacy ISymbol type system

### Historical (Superseded)

- #417: Add unit tests for SymbolCollector.ts (superseded by this ADR)
- #418: Add unit tests for CppSymbolCollector.ts (will follow this pattern)
- #396: Create BaseSymbolCollector abstract class (superseded - composable collectors instead)

## References

- [Clang DeclContext](https://clang.llvm.org/doxygen/classclang_1_1DeclContext.html)
- [Rust Name Resolution](https://rustc-dev-guide.rust-lang.org/name-resolution.html)
- [Compiler Design - Symbol Tables](https://www.tutorialspoint.com/compiler_design/compiler_design_symbol_table.htm)
