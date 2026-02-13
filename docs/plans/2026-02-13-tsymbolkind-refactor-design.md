# TSymbolKind Refactor Design

**Date:** 2026-02-13
**Status:** Approved

## Summary

Replace the `ESymbolKind` enum with language-specific string union types (`TSymbolKindCNext`, `TSymbolKindC`, `TSymbolKindCpp`) and a combined union type (`TSymbolKind`).

## Motivation

- **No runtime overhead** - String unions are compile-time only, enums generate runtime objects
- **Better tree-shaking** - No runtime code to bundle
- **Self-documenting** - String literals are clearer than enum references
- **Language-specific type safety** - Can narrow to valid kinds per language
- **Simpler imports** - Often no import needed (string literals work directly)

## File Structure

```
src/transpiler/types/symbol-kinds/
  TSymbolKindCNext.ts   → default export TSymbolKindCNext
  TSymbolKindC.ts       → default export TSymbolKindC
  TSymbolKindCpp.ts     → default export TSymbolKindCpp
  TSymbolKind.ts        → imports above 3, default export TSymbolKind (union)
```

**Deleted:**
- `src/utils/types/ESymbolKind.ts`

## Type Definitions

### TSymbolKindCNext

```typescript
type TSymbolKindCNext =
  | "function"
  | "variable"
  | "struct"
  | "enum"
  | "enum_member"
  | "bitmap"
  | "bitmap_field"
  | "register"
  | "register_member"
  | "scope";
```

### TSymbolKindC

```typescript
type TSymbolKindC =
  | "function"
  | "variable"
  | "struct"
  | "enum"
  | "enum_member"
  | "type";
```

### TSymbolKindCpp

```typescript
type TSymbolKindCpp =
  | "function"
  | "variable"
  | "struct"
  | "enum"
  | "enum_member"
  | "class"
  | "namespace"
  | "type";
```

### TSymbolKind

```typescript
type TSymbolKind = TSymbolKindCNext | TSymbolKindC | TSymbolKindCpp;
```

## Migration Plan

### Change Patterns

| Before | After |
|--------|-------|
| `import ESymbolKind from "..."` | Remove or replace with `TSymbolKind` |
| `ESymbolKind.Function` | `"function"` |
| `ESymbolKind.Variable` | `"variable"` |
| `ESymbolKind.Struct` | `"struct"` |
| `ESymbolKind.Enum` | `"enum"` |
| `ESymbolKind.EnumMember` | `"enum_member"` |
| `ESymbolKind.Bitmap` | `"bitmap"` |
| `ESymbolKind.BitmapField` | `"bitmap_field"` |
| `ESymbolKind.Register` | `"register"` |
| `ESymbolKind.RegisterMember` | `"register_member"` |
| `ESymbolKind.Namespace` | `"scope"` (C-Next) or `"namespace"` (C++) |
| `ESymbolKind.Type` | `"type"` |
| `ESymbolKind.Class` | `"class"` |

### Special Case: Namespace vs Scope

- `ESymbolKind.Namespace` was used for both C++ namespaces and C-Next scopes
- C-Next scopes become `"scope"` (matches `scope LED {}` syntax)
- C++ namespaces remain `"namespace"`
- Files using `ESymbolKind.Namespace` need review to determine correct replacement

### Files Affected

~71 files across:
- Interface definitions in `src/transpiler/logic/symbols/types/`
- Type guards in `typeGuards.ts`
- Symbol collectors and adapters
- Code generators and analyzers
- Test files

## Risk Assessment

**Low risk** - The string values in the enum (`ESymbolKind.Function = "function"`) are identical to the new string literals, so all comparisons and switch statements work identically at runtime.
