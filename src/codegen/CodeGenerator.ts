/**
 * C-Next Code Generator
 * Transforms C-Next AST to clean, readable C code
 */

import { CommonTokenStream } from 'antlr4ng';
import * as Parser from '../parser/grammar/CNextParser.js';
import SymbolTable from '../symbols/SymbolTable.js';
import ESourceLanguage from '../types/ESourceLanguage.js';
import ESymbolKind from '../types/ESymbolKind.js';
import CommentExtractor from './CommentExtractor.js';
import CommentFormatter from './CommentFormatter.js';
import IComment from './types/IComment.js';

/**
 * Maps C-Next types to C types
 */
const TYPE_MAP: Record<string, string> = {
    'u8': 'uint8_t',
    'u16': 'uint16_t',
    'u32': 'uint32_t',
    'u64': 'uint64_t',
    'i8': 'int8_t',
    'i16': 'int16_t',
    'i32': 'int32_t',
    'i64': 'int64_t',
    'f32': 'float',
    'f64': 'double',
    'bool': 'bool',
    'void': 'void',
};

/**
 * Maps C-Next assignment operators to C assignment operators
 */
const ASSIGNMENT_OPERATOR_MAP: Record<string, string> = {
    '<-': '=',
    '+<-': '+=',
    '-<-': '-=',
    '*<-': '*=',
    '/<-': '/=',
    '%<-': '%=',
    '&<-': '&=',
    '|<-': '|=',
    '^<-': '^=',
    '<<<-': '<<=',
    '>><-': '>>=',
};

/**
 * Parameter info for ADR-006 pointer semantics and ADR-013 const enforcement
 */
interface ParameterInfo {
    name: string;
    isArray: boolean;
    isStruct: boolean;  // User-defined type (struct/class)
    isConst: boolean;   // ADR-013: Track const modifier for immutability enforcement
}

/**
 * ADR-044: Overflow behavior for integer types
 */
type TOverflowBehavior = 'clamp' | 'wrap';

/**
 * Type info for bit manipulation, .length support, and ADR-013 const enforcement
 */
interface TypeInfo {
    baseType: string;      // 'u8', 'u32', 'i16', 'State' (enum), etc.
    bitWidth: number;      // 8, 16, 32, 64 (0 for enums)
    isArray: boolean;
    arrayLength?: number;  // For arrays only
    isConst: boolean;      // ADR-013: Track const modifier for immutability enforcement
    isEnum?: boolean;      // ADR-017: Track if this is an enum type
    enumTypeName?: string; // ADR-017: The enum type name (e.g., 'State')
    overflowBehavior?: TOverflowBehavior; // ADR-044: clamp (default) or wrap
    isString?: boolean;         // ADR-045: Track if this is a bounded string type
    stringCapacity?: number;    // ADR-045: The N in string<N> (character capacity)
}

/**
 * ADR-013: Function signature for const parameter tracking
 * Used to validate const-to-non-const errors at call sites
 */
interface FunctionSignature {
    name: string;
    parameters: Array<{ name: string; isConst: boolean; isArray: boolean }>;
}

/**
 * Maps primitive types to their bit widths
 */
const TYPE_WIDTH: Record<string, number> = {
    'u8': 8, 'i8': 8,
    'u16': 16, 'i16': 16,
    'u32': 32, 'i32': 32,
    'u64': 64, 'i64': 64,
    'f32': 32, 'f64': 64,
    'bool': 1,
};

/**
 * ADR-024: Type classification for safe casting
 */
const UNSIGNED_TYPES = ['u8', 'u16', 'u32', 'u64'] as const;
const SIGNED_TYPES = ['i8', 'i16', 'i32', 'i64'] as const;
const INTEGER_TYPES = [...UNSIGNED_TYPES, ...SIGNED_TYPES] as const;
const FLOAT_TYPES = ['f32', 'f64'] as const;

/**
 * ADR-024: Type ranges for literal validation
 * Maps type name to [min, max] inclusive range
 */
const TYPE_RANGES: Record<string, [bigint, bigint]> = {
    'u8': [0n, 255n],
    'u16': [0n, 65535n],
    'u32': [0n, 4294967295n],
    'u64': [0n, 18446744073709551615n],
    'i8': [-128n, 127n],
    'i16': [-32768n, 32767n],
    'i32': [-2147483648n, 2147483647n],
    'i64': [-9223372036854775808n, 9223372036854775807n],
};

/**
 * ADR-044: Assignment context for overflow behavior tracking
 */
interface AssignmentContext {
    targetName: string | null;
    targetType: string | null;
    overflowBehavior: TOverflowBehavior;
}

/**
 * Context for tracking current scope during code generation
 */
interface GeneratorContext {
    currentScope: string | null;  // ADR-016: renamed from currentNamespace
    indentLevel: number;
    scopeMembers: Map<string, Set<string>>; // scope -> member names (ADR-016)
    currentParameters: Map<string, ParameterInfo>; // ADR-006: track params for pointer semantics
    localArrays: Set<string>; // ADR-006: track local array variables (no & needed)
    localVariables: Set<string>; // ADR-016: track local variables (allowed as bare identifiers)
    inFunctionBody: boolean; // ADR-016: track if we're inside a function body
    typeRegistry: Map<string, TypeInfo>; // Track variable types for bit access and .length
    expectedType: string | null; // For inferred struct initializers
    mainArgsName: string | null; // Track the args parameter name for main() translation
    assignmentContext: AssignmentContext; // ADR-044: Track current assignment for overflow
}

/**
 * Options for the code generator
 */
export interface ICodeGeneratorOptions {
    /** ADR-044: When true, generate panic helpers instead of clamp helpers */
    debugMode?: boolean;
}

/**
 * Code Generator - Transpiles C-Next to C
 */
export default class CodeGenerator {
    /** ADR-044: Debug mode generates panic-on-overflow helpers */
    private debugMode: boolean = false;

    private context: GeneratorContext = {
        currentScope: null,  // ADR-016: renamed from currentNamespace
        indentLevel: 0,
        scopeMembers: new Map(),  // ADR-016: renamed from namespaceMembers
        currentParameters: new Map(),
        localArrays: new Set(),
        localVariables: new Set(),  // ADR-016: track local variables
        inFunctionBody: false,  // ADR-016: track if inside function body
        typeRegistry: new Map(),
        expectedType: null,
        mainArgsName: null,  // Track the args parameter name for main() translation
        assignmentContext: { targetName: null, targetType: null, overflowBehavior: 'clamp' }, // ADR-044
    };

    private knownScopes: Set<string> = new Set();  // ADR-016: renamed from knownNamespaces
    private knownStructs: Set<string> = new Set();
    private structFields: Map<string, Map<string, string>> = new Map(); // struct -> (field -> type)
    private knownRegisters: Set<string> = new Set();
    private knownFunctions: Set<string> = new Set(); // Track C-Next defined functions
    private functionSignatures: Map<string, FunctionSignature> = new Map(); // ADR-013: Track function parameter const-ness
    private registerMemberAccess: Map<string, string> = new Map(); // "GPIO7_DR_SET" -> "wo"
    private knownEnums: Set<string> = new Set(); // ADR-017: Track enum types
    private enumMembers: Map<string, Map<string, number>> = new Map(); // ADR-017: enumName -> (memberName -> value)

    // ADR-044: Track which overflow helper types and operations are needed
    private usedClampOps: Set<string> = new Set(); // Format: "add_u8", "sub_u16", "mul_u32"

    // Track required standard library includes
    private needsStdint: boolean = false;   // For u8, u16, u32, u64, i8, i16, i32, i64
    private needsStdbool: boolean = false;  // For bool type
    private needsString: boolean = false;   // ADR-045: For strlen, strncpy, etc.

    /** External symbol table for cross-language interop */
    private symbolTable: SymbolTable | null = null;

    /** Token stream for comment extraction (ADR-043) */
    private tokenStream: CommonTokenStream | null = null;
    private commentExtractor: CommentExtractor | null = null;
    private commentFormatter: CommentFormatter = new CommentFormatter();

    /**
     * Check if a function is a C-Next function (uses pass-by-reference semantics).
     * Checks both internal tracking and external symbol table.
     */
    private isCNextFunction(name: string): boolean {
        // First check internal tracking (for current file)
        if (this.knownFunctions.has(name)) {
            return true;
        }

        // Then check symbol table for cross-file C-Next functions
        if (this.symbolTable) {
            const symbols = this.symbolTable.getOverloads(name);
            for (const sym of symbols) {
                if (sym.sourceLanguage === ESourceLanguage.CNext &&
                    sym.kind === ESymbolKind.Function) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if a function is an external C/C++ function (uses pass-by-value semantics).
     * Returns true if the function is found in symbol table as C or C++.
     */
    private isExternalCFunction(name: string): boolean {
        if (!this.symbolTable) {
            return false;
        }

        const symbols = this.symbolTable.getOverloads(name);
        for (const sym of symbols) {
            if ((sym.sourceLanguage === ESourceLanguage.C ||
                 sym.sourceLanguage === ESourceLanguage.Cpp) &&
                sym.kind === ESymbolKind.Function) {
                return true;
            }
        }

        return false;
    }

    /**
     * Generate C code from a C-Next program
     * @param tree The parsed C-Next program
     * @param symbolTable Optional symbol table for cross-language interop
     * @param tokenStream Optional token stream for comment preservation (ADR-043)
     * @param options Optional code generator options (e.g., debugMode)
     */
    generate(tree: Parser.ProgramContext, symbolTable?: SymbolTable, tokenStream?: CommonTokenStream, options?: ICodeGeneratorOptions): string {
        // Store symbol table for function lookup
        this.symbolTable = symbolTable ?? null;

        // ADR-044: Store debug mode for panic helper generation
        this.debugMode = options?.debugMode ?? false;

        // Initialize comment extraction (ADR-043)
        this.tokenStream = tokenStream ?? null;
        if (this.tokenStream) {
            this.commentExtractor = new CommentExtractor(this.tokenStream);
        } else {
            this.commentExtractor = null;
        }

        // Reset state
        this.context = {
            currentScope: null,  // ADR-016
            indentLevel: 0,
            scopeMembers: new Map(),  // ADR-016
            currentParameters: new Map(),
            localArrays: new Set(),
            localVariables: new Set(),  // ADR-016
            inFunctionBody: false,  // ADR-016
            typeRegistry: new Map(),
            expectedType: null,
            mainArgsName: null,  // Track the args parameter name for main() translation
            assignmentContext: { targetName: null, targetType: null, overflowBehavior: 'clamp' }, // ADR-044
        };
        this.knownScopes = new Set();  // ADR-016
        this.knownStructs = new Set();
        this.structFields = new Map();
        this.knownRegisters = new Set();
        this.knownFunctions = new Set();
        this.functionSignatures = new Map();
        this.registerMemberAccess = new Map();
        this.knownEnums = new Set();
        this.enumMembers = new Map();
        this.usedClampOps = new Set();  // ADR-044: Reset overflow helpers
        this.needsStdint = false;
        this.needsStdbool = false;
        this.needsString = false;  // ADR-045: Reset string header tracking

        // First pass: collect namespace and class members
        this.collectSymbols(tree);

        const output: string[] = [];

        // Add header comment
        output.push('/**');
        output.push(' * Generated by C-Next Transpiler');
        output.push(' * A safer C for embedded systems');
        output.push(' */');
        output.push('');

        // Pass through #include directives from source
        // C-Next does NOT hardcode any libraries - all includes must be explicit
        // ADR-043: Comments before first include become file-level comments
        for (const includeDir of tree.includeDirective()) {
            const leadingComments = this.getLeadingComments(includeDir);
            output.push(...this.formatLeadingComments(leadingComments));
            output.push(includeDir.getText());
        }

        // Add blank line after includes if there were any
        if (tree.includeDirective().length > 0) {
            output.push('');
        }

        // ADR-037: Process preprocessor directives (defines and conditionals)
        for (const ppDir of tree.preprocessorDirective()) {
            const leadingComments = this.getLeadingComments(ppDir);
            output.push(...this.formatLeadingComments(leadingComments));
            const result = this.processPreprocessorDirective(ppDir);
            if (result) {
                output.push(result);
            }
        }

        // Add blank line after preprocessor directives if there were any
        if (tree.preprocessorDirective().length > 0) {
            output.push('');
        }

        // Visit all declarations (first generate to collect helper usage)
        const declarations: string[] = [];
        for (const decl of tree.declaration()) {
            // ADR-043: Get comments before this declaration
            const leadingComments = this.getLeadingComments(decl);
            declarations.push(...this.formatLeadingComments(leadingComments));

            const code = this.generateDeclaration(decl);
            if (code) {
                declarations.push(code);
            }
        }

        // Add required standard library includes (after user includes, before helpers)
        const autoIncludes: string[] = [];
        if (this.needsStdint) {
            autoIncludes.push('#include <stdint.h>');
        }
        if (this.needsStdbool) {
            autoIncludes.push('#include <stdbool.h>');
        }
        if (this.needsString) {
            autoIncludes.push('#include <string.h>');  // ADR-045: For strlen, strncpy, etc.
        }
        if (autoIncludes.length > 0) {
            output.push(...autoIncludes);
            output.push('');
        }

        // ADR-044: Insert overflow helpers before declarations (if any are needed)
        const helpers = this.generateOverflowHelpers();
        if (helpers.length > 0) {
            output.push(...helpers);
        }

        // Add the declarations
        output.push(...declarations);

        return output.join('\n');
    }

    /**
     * First pass: collect all scope member names (ADR-016)
     */
    private collectSymbols(tree: Parser.ProgramContext): void {
        for (const decl of tree.declaration()) {
            // ADR-016: Handle scope declarations (renamed from namespace)
            if (decl.scopeDeclaration()) {
                const scopeDecl = decl.scopeDeclaration()!;
                const name = scopeDecl.IDENTIFIER().getText();
                this.knownScopes.add(name);

                const members = new Set<string>();
                for (const member of scopeDecl.scopeMember()) {
                    if (member.variableDeclaration()) {
                        members.add(member.variableDeclaration()!.IDENTIFIER().getText());
                    }
                    if (member.functionDeclaration()) {
                        const funcDecl = member.functionDeclaration()!;
                        const funcName = funcDecl.IDENTIFIER().getText();
                        members.add(funcName);
                        // Track fully qualified function name: Scope_function
                        const fullName = `${name}_${funcName}`;
                        this.knownFunctions.add(fullName);
                        // ADR-013: Track function signature for const checking
                        const sig = this.extractFunctionSignature(fullName, funcDecl.parameterList() ?? null);
                        this.functionSignatures.set(fullName, sig);
                    }
                    // ADR-017: Collect enums declared inside scopes
                    if (member.enumDeclaration()) {
                        const enumDecl = member.enumDeclaration()!;
                        const enumName = enumDecl.IDENTIFIER().getText();
                        members.add(enumName);
                        // Collect enum with scope prefix (e.g., Motor_State)
                        this.collectEnum(enumDecl, name);
                    }
                }
                this.context.scopeMembers.set(name, members);
            }

            if (decl.structDeclaration()) {
                const structDecl = decl.structDeclaration()!;
                const name = structDecl.IDENTIFIER().getText();
                this.knownStructs.add(name);

                // Track field types for inferred struct initializers
                const fields = new Map<string, string>();
                for (const member of structDecl.structMember()) {
                    const fieldName = member.IDENTIFIER().getText();
                    const fieldType = this.getTypeName(member.type());
                    fields.set(fieldName, fieldType);
                }
                this.structFields.set(name, fields);
            }

            // ADR-017: Handle enum declarations
            if (decl.enumDeclaration()) {
                this.collectEnum(decl.enumDeclaration()!);
            }

            if (decl.registerDeclaration()) {
                const regDecl = decl.registerDeclaration()!;
                const regName = regDecl.IDENTIFIER().getText();
                this.knownRegisters.add(regName);

                // Track access modifiers for each register member
                for (const member of regDecl.registerMember()) {
                    const memberName = member.IDENTIFIER().getText();
                    const accessMod = member.accessModifier().getText(); // rw, ro, wo, w1c, w1s
                    const fullName = `${regName}_${memberName}`;
                    this.registerMemberAccess.set(fullName, accessMod);
                }
            }

            // Track top-level functions
            if (decl.functionDeclaration()) {
                const funcDecl = decl.functionDeclaration()!;
                const name = funcDecl.IDENTIFIER().getText();
                this.knownFunctions.add(name);
                // ADR-013: Track function signature for const checking
                const sig = this.extractFunctionSignature(name, funcDecl.parameterList() ?? null);
                this.functionSignatures.set(name, sig);
            }

            // Track top-level variable types
            if (decl.variableDeclaration()) {
                const varDecl = decl.variableDeclaration()!;
                this.trackVariableType(varDecl);
            }
        }
    }

    /**
     * ADR-017: Collect enum declaration and track members
     */
    private collectEnum(enumDecl: Parser.EnumDeclarationContext, scopeName?: string): void {
        const name = enumDecl.IDENTIFIER().getText();
        const fullName = scopeName ? `${scopeName}_${name}` : name;
        this.knownEnums.add(fullName);

        // Collect member values
        const members = new Map<string, number>();
        let currentValue = 0;

        for (const member of enumDecl.enumMember()) {
            const memberName = member.IDENTIFIER().getText();

            if (member.expression()) {
                // Explicit value with <-
                const valueText = member.expression()!.getText();
                const value = this.evaluateConstantExpression(valueText);
                if (value < 0) {
                    throw new Error(
                        `Error: Negative values not allowed in enum (found ${value} in ${fullName}.${memberName})`
                    );
                }
                currentValue = value;
            }

            members.set(memberName, currentValue);
            currentValue++;
        }

        this.enumMembers.set(fullName, members);
    }

    /**
     * ADR-017: Evaluate constant expression for enum values
     */
    private evaluateConstantExpression(expr: string): number {
        // Handle hex literals
        if (expr.startsWith('0x') || expr.startsWith('0X')) {
            return parseInt(expr, 16);
        }
        // Handle binary literals
        if (expr.startsWith('0b') || expr.startsWith('0B')) {
            return parseInt(expr.substring(2), 2);
        }
        // Handle decimal
        const value = parseInt(expr, 10);
        if (isNaN(value)) {
            throw new Error(`Error: Invalid constant expression in enum: ${expr}`);
        }
        return value;
    }

    /**
     * Extract type info from a variable declaration and register it
     */
    private trackVariableType(varDecl: Parser.VariableDeclarationContext): void {
        const name = varDecl.IDENTIFIER().getText();
        const typeCtx = varDecl.type();
        const arrayDim = varDecl.arrayDimension();
        const isConst = varDecl.constModifier() !== null;  // ADR-013: Track const modifier

        // ADR-044: Extract overflow modifier (clamp is default)
        const overflowMod = varDecl.overflowModifier();
        const overflowBehavior: TOverflowBehavior = overflowMod?.getText() === 'wrap' ? 'wrap' : 'clamp';

        let baseType = '';
        let bitWidth = 0;
        let isArray = false;
        let arrayLength: number | undefined;

        if (typeCtx.primitiveType()) {
            baseType = typeCtx.primitiveType()!.getText();
            bitWidth = TYPE_WIDTH[baseType] || 0;
        } else if (typeCtx.stringType()) {
            // ADR-045: Handle bounded string type
            const stringCtx = typeCtx.stringType()!;
            const intLiteral = stringCtx.INTEGER_LITERAL();

            if (intLiteral) {
                const capacity = parseInt(intLiteral.getText(), 10);
                this.needsString = true;

                this.context.typeRegistry.set(name, {
                    baseType: 'char',
                    bitWidth: 8,
                    isArray: true,
                    arrayLength: capacity + 1,  // +1 for null terminator
                    isConst,
                    isString: true,
                    stringCapacity: capacity,
                    overflowBehavior,
                });
                return; // Early return, we've handled this case
            } else {
                // Unsized string - for const inference (handled in generateVariableDecl)
                baseType = 'string';
                bitWidth = 0;
            }
        } else if (typeCtx.scopedType()) {
            // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
            const typeName = typeCtx.scopedType()!.IDENTIFIER().getText();
            if (this.context.currentScope) {
                baseType = `${this.context.currentScope}_${typeName}`;
            } else {
                baseType = typeName;
            }
            bitWidth = 0;

            // ADR-017: Check if this is an enum type
            if (this.knownEnums.has(baseType)) {
                this.context.typeRegistry.set(name, {
                    baseType,
                    bitWidth: 0,
                    isArray: false,
                    isConst,
                    isEnum: true,
                    enumTypeName: baseType,
                    overflowBehavior, // ADR-044
                });
                return; // Early return, we've handled this case
            }
        } else if (typeCtx.qualifiedType()) {
            // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
            const identifiers = typeCtx.qualifiedType()!.IDENTIFIER();
            const scopeName = identifiers[0].getText();
            const typeName = identifiers[1].getText();
            baseType = `${scopeName}_${typeName}`;
            bitWidth = 0;

            // ADR-017: Check if this is an enum type
            if (this.knownEnums.has(baseType)) {
                this.context.typeRegistry.set(name, {
                    baseType,
                    bitWidth: 0,
                    isArray: false,
                    isConst,
                    isEnum: true,
                    enumTypeName: baseType,
                    overflowBehavior, // ADR-044
                });
                return; // Early return, we've handled this case
            }
        } else if (typeCtx.userType()) {
            // Track struct/class/enum types for inferred struct initializers and enum type safety
            baseType = typeCtx.userType()!.getText();
            bitWidth = 0; // User types don't have fixed bit width

            // ADR-017: Check if this is an enum type
            if (this.knownEnums.has(baseType)) {
                this.context.typeRegistry.set(name, {
                    baseType,
                    bitWidth: 0,
                    isArray: false,
                    isConst,
                    isEnum: true,
                    enumTypeName: baseType,
                    overflowBehavior, // ADR-044
                });
                return; // Early return, we've handled this case
            }
        } else if (typeCtx.arrayType()) {
            isArray = true;
            const arrayTypeCtx = typeCtx.arrayType()!;
            if (arrayTypeCtx.primitiveType()) {
                baseType = arrayTypeCtx.primitiveType()!.getText();
                bitWidth = TYPE_WIDTH[baseType] || 0;
            }
            // Try to get array length from type
            const sizeExpr = arrayTypeCtx.expression();
            if (sizeExpr) {
                const sizeText = sizeExpr.getText();
                const size = parseInt(sizeText, 10);
                if (!isNaN(size)) {
                    arrayLength = size;
                }
            }
        }

        // Check for array dimension like: u8 buffer[16]
        if (arrayDim) {
            isArray = true;
            const sizeExpr = arrayDim.expression();
            if (sizeExpr) {
                const sizeText = sizeExpr.getText();
                const size = parseInt(sizeText, 10);
                if (!isNaN(size)) {
                    arrayLength = size;
                }
            }
        }

        if (baseType) {
            this.context.typeRegistry.set(name, {
                baseType,
                bitWidth,
                isArray,
                arrayLength,
                isConst,  // ADR-013: Store const status
                overflowBehavior,  // ADR-044: Store overflow behavior
            });
        }
    }

    /**
     * Track variable type with a specific name (for namespace/class members)
     * This allows tracking with mangled names for proper scope resolution
     */
    private trackVariableTypeWithName(varDecl: Parser.VariableDeclarationContext, registryName: string): void {
        const typeCtx = varDecl.type();
        const arrayDim = varDecl.arrayDimension();
        const isConst = varDecl.constModifier() !== null;

        // ADR-044: Extract overflow modifier (clamp is default)
        const overflowMod = varDecl.overflowModifier();
        const overflowBehavior: TOverflowBehavior = overflowMod?.getText() === 'wrap' ? 'wrap' : 'clamp';

        let baseType = '';
        let bitWidth = 0;
        let isArray = false;
        let arrayLength: number | undefined;

        if (typeCtx.primitiveType()) {
            baseType = typeCtx.primitiveType()!.getText();
            bitWidth = TYPE_WIDTH[baseType] || 0;
        } else if (typeCtx.scopedType()) {
            // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
            const typeName = typeCtx.scopedType()!.IDENTIFIER().getText();
            if (this.context.currentScope) {
                baseType = `${this.context.currentScope}_${typeName}`;
            } else {
                baseType = typeName;
            }
            bitWidth = 0;

            // ADR-017: Check if this is an enum type
            if (this.knownEnums.has(baseType)) {
                this.context.typeRegistry.set(registryName, {
                    baseType,
                    bitWidth: 0,
                    isArray: false,
                    isConst,
                    isEnum: true,
                    enumTypeName: baseType,
                    overflowBehavior, // ADR-044
                });
                return; // Early return, we've handled this case
            }
        } else if (typeCtx.qualifiedType()) {
            // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
            const identifiers = typeCtx.qualifiedType()!.IDENTIFIER();
            const scopeName = identifiers[0].getText();
            const typeName = identifiers[1].getText();
            baseType = `${scopeName}_${typeName}`;
            bitWidth = 0;

            // ADR-017: Check if this is an enum type
            if (this.knownEnums.has(baseType)) {
                this.context.typeRegistry.set(registryName, {
                    baseType,
                    bitWidth: 0,
                    isArray: false,
                    isConst,
                    isEnum: true,
                    enumTypeName: baseType,
                    overflowBehavior, // ADR-044
                });
                return; // Early return, we've handled this case
            }
        } else if (typeCtx.userType()) {
            baseType = typeCtx.userType()!.getText();
            bitWidth = 0;

            // ADR-017: Check if this is an enum type
            if (this.knownEnums.has(baseType)) {
                this.context.typeRegistry.set(registryName, {
                    baseType,
                    bitWidth: 0,
                    isArray: false,
                    isConst,
                    isEnum: true,
                    enumTypeName: baseType,
                    overflowBehavior, // ADR-044
                });
                return; // Early return, we've handled this case
            }
        } else if (typeCtx.arrayType()) {
            isArray = true;
            const arrayTypeCtx = typeCtx.arrayType()!;
            if (arrayTypeCtx.primitiveType()) {
                baseType = arrayTypeCtx.primitiveType()!.getText();
                bitWidth = TYPE_WIDTH[baseType] || 0;
            }
            const sizeExpr = arrayTypeCtx.expression();
            if (sizeExpr) {
                const sizeText = sizeExpr.getText();
                const size = parseInt(sizeText, 10);
                if (!isNaN(size)) {
                    arrayLength = size;
                }
            }
        }

        if (arrayDim) {
            isArray = true;
            const sizeExpr = arrayDim.expression();
            if (sizeExpr) {
                const sizeText = sizeExpr.getText();
                const size = parseInt(sizeText, 10);
                if (!isNaN(size)) {
                    arrayLength = size;
                }
            }
        }

        if (baseType) {
            this.context.typeRegistry.set(registryName, {
                baseType,
                bitWidth,
                isArray,
                arrayLength,
                isConst,
                overflowBehavior,  // ADR-044: Store overflow behavior
            });
        }
    }

    /**
     * Check if a type name is a user-defined struct
     */
    private isStructType(typeName: string): boolean {
        return this.knownStructs.has(typeName);
    }

    /**
     * Set up parameter tracking for a function
     */
    private setParameters(params: Parser.ParameterListContext | null): void {
        this.context.currentParameters.clear();

        if (!params) return;

        for (const param of params.parameter()) {
            const name = param.IDENTIFIER().getText();
            const isArray = param.arrayDimension() !== null;
            const isConst = param.constModifier() !== null;  // ADR-013: Track const modifier
            const typeCtx = param.type();

            // Determine if it's a struct type
            let isStruct = false;
            let typeName = typeCtx.getText();
            if (typeCtx.userType()) {
                typeName = typeCtx.userType()!.getText();
                isStruct = this.isStructType(typeName);
            } else if (typeCtx.qualifiedType()) {
                // ADR-016: Handle qualified enum types like Scope.EnumType
                typeName = typeCtx.qualifiedType()!.IDENTIFIER().map((id) => id.getText()).join('_');
            }

            this.context.currentParameters.set(name, { name, isArray, isStruct, isConst });

            // ADR-025: Register parameter type for switch exhaustiveness checking
            const isEnum = this.knownEnums.has(typeName);
            this.context.typeRegistry.set(name, {
                baseType: typeName,
                bitWidth: 0,
                isArray: isArray,
                isConst: isConst,
                isEnum: isEnum,
                enumTypeName: isEnum ? typeName : undefined,
            });
        }
    }

    /**
     * Clear parameter tracking when leaving a function
     */
    private clearParameters(): void {
        // ADR-025: Remove parameter types from typeRegistry
        for (const name of this.context.currentParameters.keys()) {
            this.context.typeRegistry.delete(name);
        }
        this.context.currentParameters.clear();
        this.context.localArrays.clear();
    }

    /**
     * ADR-013: Extract function signature from parameter list
     */
    private extractFunctionSignature(name: string, params: Parser.ParameterListContext | null): FunctionSignature {
        const parameters: Array<{ name: string; isConst: boolean; isArray: boolean }> = [];

        if (params) {
            for (const param of params.parameter()) {
                const paramName = param.IDENTIFIER().getText();
                const isConst = param.constModifier() !== null;
                const isArray = param.arrayDimension() !== null;
                parameters.push({ name: paramName, isConst, isArray });
            }
        }

        return { name, parameters };
    }

    /**
     * ADR-013: Check if an argument is const (variable or parameter)
     */
    private isConstValue(identifier: string): boolean {
        // Check if it's a const parameter
        const paramInfo = this.context.currentParameters.get(identifier);
        if (paramInfo?.isConst) {
            return true;
        }

        // Check if it's a const variable
        const typeInfo = this.context.typeRegistry.get(identifier);
        if (typeInfo?.isConst) {
            return true;
        }

        return false;
    }

    /**
     * ADR-016: Validate that bare identifiers inside scopes are only used for local variables.
     * Throws an error if a bare identifier references a scope member or global.
     *
     * @param identifier The bare identifier to validate
     * @param isLocalVariable Whether this identifier is a known local variable/parameter
     */
    private validateBareIdentifierInScope(identifier: string, isLocalVariable: boolean): void {
        // Only enforce inside scopes
        if (!this.context.currentScope) {
            return;
        }

        // Local variables and parameters are allowed as bare identifiers
        if (isLocalVariable) {
            return;
        }

        // Check if this identifier is a scope member
        const scopeMembers = this.context.scopeMembers.get(this.context.currentScope);
        if (scopeMembers && scopeMembers.has(identifier)) {
            throw new Error(
                `Error: Use 'this.${identifier}' to access scope member '${identifier}' inside scope '${this.context.currentScope}'`
            );
        }

        // Check if this is a known global (register, function, enum, struct)
        if (this.knownRegisters.has(identifier)) {
            throw new Error(
                `Error: Use 'global.${identifier}' to access register '${identifier}' inside scope '${this.context.currentScope}'`
            );
        }

        if (this.knownFunctions.has(identifier) && !identifier.startsWith(this.context.currentScope + '_')) {
            throw new Error(
                `Error: Use 'global.${identifier}' to access global function '${identifier}' inside scope '${this.context.currentScope}'`
            );
        }

        if (this.knownEnums.has(identifier)) {
            throw new Error(
                `Error: Use 'global.${identifier}' to access global enum '${identifier}' inside scope '${this.context.currentScope}'`
            );
        }

        if (this.knownStructs.has(identifier)) {
            throw new Error(
                `Error: Use 'global.${identifier}' to access global struct '${identifier}' inside scope '${this.context.currentScope}'`
            );
        }

        // Check if this identifier exists as a global variable in the type registry
        // (but not a scoped variable - those would have Scope_ prefix)
        const typeInfo = this.context.typeRegistry.get(identifier);
        if (typeInfo && !identifier.includes('_')) {
            throw new Error(
                `Error: Use 'global.${identifier}' to access global variable '${identifier}' inside scope '${this.context.currentScope}'`
            );
        }
    }

    /**
     * ADR-017: Extract enum type from an expression.
     * Returns the enum type name if the expression is an enum value, null otherwise.
     *
     * Handles:
     * - Variable of enum type: `currentState` -> 'State'
     * - Enum member access: `State.IDLE` -> 'State'
     * - Scoped enum member: `Motor.State.IDLE` -> 'Motor_State'
     * - ADR-016: this.State.IDLE -> 'CurrentScope_State'
     * - ADR-016: this.variable -> enum type if variable is of enum type
     */
    private getExpressionEnumType(ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext): string | null {
        // Get the text representation to analyze
        const text = ctx.getText();

        // Check if it's a simple identifier that's an enum variable
        if (text.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
            const typeInfo = this.context.typeRegistry.get(text);
            if (typeInfo?.isEnum && typeInfo.enumTypeName) {
                return typeInfo.enumTypeName;
            }
        }

        // Check if it's an enum member access: EnumType.MEMBER or Scope.EnumType.MEMBER
        const parts = text.split('.');

        if (parts.length >= 2) {
            // ADR-016: Check this.State.IDLE pattern (this.Enum.Member inside scope)
            if (parts[0] === 'this' && this.context.currentScope && parts.length >= 3) {
                const enumName = parts[1];
                const scopedEnumName = `${this.context.currentScope}_${enumName}`;
                if (this.knownEnums.has(scopedEnumName)) {
                    return scopedEnumName;
                }
            }

            // ADR-016: Check this.variable pattern (this.varName where varName is enum type)
            if (parts[0] === 'this' && this.context.currentScope && parts.length === 2) {
                const varName = parts[1];
                const scopedVarName = `${this.context.currentScope}_${varName}`;
                const typeInfo = this.context.typeRegistry.get(scopedVarName);
                if (typeInfo?.isEnum && typeInfo.enumTypeName) {
                    return typeInfo.enumTypeName;
                }
            }

            // Check simple enum: State.IDLE
            const possibleEnum = parts[0];
            if (this.knownEnums.has(possibleEnum)) {
                return possibleEnum;
            }

            // Check scoped enum: Motor.State.IDLE -> Motor_State
            if (parts.length >= 3) {
                const scopeName = parts[0];
                const enumName = parts[1];
                const scopedEnumName = `${scopeName}_${enumName}`;
                if (this.knownEnums.has(scopedEnumName)) {
                    return scopedEnumName;
                }
            }
        }

        return null;
    }

    /**
     * ADR-017: Check if an expression represents an integer literal or numeric type.
     * Used to detect comparisons between enums and integers.
     */
    private isIntegerExpression(ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext): boolean {
        const text = ctx.getText();

        // Check for integer literals
        if (text.match(/^-?\d+$/) || text.match(/^0[xX][0-9a-fA-F]+$/) || text.match(/^0[bB][01]+$/)) {
            return true;
        }

        // Check if it's a variable of primitive integer type
        if (text.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
            const typeInfo = this.context.typeRegistry.get(text);
            if (typeInfo && !typeInfo.isEnum && ['u8', 'u16', 'u32', 'u64', 'i8', 'i16', 'i32', 'i64'].includes(typeInfo.baseType)) {
                return true;
            }
        }

        return false;
    }

    // ========================================================================
    // ADR-024: Type Classification and Validation Helpers
    // ========================================================================

    /**
     * ADR-024: Check if a type is an unsigned integer
     */
    private isUnsignedType(typeName: string): boolean {
        return (UNSIGNED_TYPES as readonly string[]).includes(typeName);
    }

    /**
     * ADR-024: Check if a type is a signed integer
     */
    private isSignedType(typeName: string): boolean {
        return (SIGNED_TYPES as readonly string[]).includes(typeName);
    }

    /**
     * ADR-024: Check if a type is any integer (signed or unsigned)
     */
    private isIntegerType(typeName: string): boolean {
        return (INTEGER_TYPES as readonly string[]).includes(typeName);
    }

    /**
     * ADR-024: Check if a type is a floating point type
     */
    private isFloatType(typeName: string): boolean {
        return (FLOAT_TYPES as readonly string[]).includes(typeName);
    }

    /**
     * ADR-024: Check if conversion from sourceType to targetType is narrowing
     * Narrowing occurs when target type has fewer bits than source type
     */
    private isNarrowingConversion(sourceType: string, targetType: string): boolean {
        const sourceWidth = TYPE_WIDTH[sourceType] || 0;
        const targetWidth = TYPE_WIDTH[targetType] || 0;

        if (sourceWidth === 0 || targetWidth === 0) {
            return false; // Can't determine for unknown types
        }

        return targetWidth < sourceWidth;
    }

    /**
     * ADR-024: Check if conversion involves a sign change
     * Sign change occurs when converting between signed and unsigned types
     */
    private isSignConversion(sourceType: string, targetType: string): boolean {
        const sourceIsSigned = this.isSignedType(sourceType);
        const sourceIsUnsigned = this.isUnsignedType(sourceType);
        const targetIsSigned = this.isSignedType(targetType);
        const targetIsUnsigned = this.isUnsignedType(targetType);

        return (sourceIsSigned && targetIsUnsigned) ||
               (sourceIsUnsigned && targetIsSigned);
    }

    /**
     * ADR-024: Validate that a literal value fits within the target type's range.
     * Throws an error if the value doesn't fit.
     * @param literalText The literal text (e.g., "256", "-1", "0xFF")
     * @param targetType The target type (e.g., "u8", "i32")
     */
    private validateLiteralFitsType(literalText: string, targetType: string): void {
        const range = TYPE_RANGES[targetType];
        if (!range) {
            return; // No validation for unknown types (floats, bools, etc.)
        }

        // Parse the literal value
        let value: bigint;
        try {
            const cleanText = literalText.trim();

            if (cleanText.match(/^-?\d+$/)) {
                // Decimal integer
                value = BigInt(cleanText);
            } else if (cleanText.match(/^0[xX][0-9a-fA-F]+$/)) {
                // Hex literal
                value = BigInt(cleanText);
            } else if (cleanText.match(/^0[bB][01]+$/)) {
                // Binary literal
                value = BigInt(cleanText);
            } else {
                // Not an integer literal we can validate
                return;
            }
        } catch {
            return; // Can't parse, skip validation
        }

        const [min, max] = range;

        // Check if value is negative for unsigned type
        if (this.isUnsignedType(targetType) && value < 0n) {
            throw new Error(
                `Error: Negative value ${literalText} cannot be assigned to unsigned type ${targetType}`
            );
        }

        // Check if value is out of range
        if (value < min || value > max) {
            throw new Error(
                `Error: Value ${literalText} exceeds ${targetType} range (${min} to ${max})`
            );
        }
    }

    /**
     * ADR-024: Get the type of an expression for type checking.
     * Returns the inferred type or null if type cannot be determined.
     */
    private getExpressionType(ctx: Parser.ExpressionContext): string | null {
        // Navigate through expression tree to get the actual value
        const postfix = this.getPostfixExpression(ctx);
        if (postfix) {
            return this.getPostfixExpressionType(postfix);
        }

        // For more complex expressions (binary ops, etc.), try to infer type
        const ternary = ctx.ternaryExpression();
        const orExprs = ternary.orExpression();
        // If it's a ternary, we can't easily determine the type
        if (orExprs.length > 1) {
            return null;
        }
        const or = orExprs[0];
        if (or.andExpression().length > 1) {
            return 'bool'; // Logical OR returns bool
        }

        const and = or.andExpression()[0];
        if (and.equalityExpression().length > 1) {
            return 'bool'; // Logical AND returns bool
        }

        const eq = and.equalityExpression()[0];
        if (eq.relationalExpression().length > 1) {
            return 'bool'; // Equality comparison returns bool
        }

        const rel = eq.relationalExpression()[0];
        if (rel.bitwiseOrExpression().length > 1) {
            return 'bool'; // Relational comparison returns bool
        }

        // For arithmetic expressions, we'd need to track operand types
        // For now, return null for complex expressions
        return null;
    }

    /**
     * ADR-024: Get the type of a postfix expression.
     */
    private getPostfixExpressionType(ctx: Parser.PostfixExpressionContext): string | null {
        const primary = ctx.primaryExpression();
        if (!primary) return null;

        // Get base type from primary expression
        let baseType = this.getPrimaryExpressionType(primary);

        // Check for postfix operations like bit indexing
        const suffixes = ctx.children?.slice(1) || [];
        for (const suffix of suffixes) {
            const text = suffix.getText();
            // Bit indexing: [start, width] or [index]
            if (text.startsWith('[') && text.endsWith(']')) {
                const inner = text.slice(1, -1);
                if (inner.includes(',')) {
                    // Range indexing: [start, width]
                    // ADR-024: Return null for bit indexing to skip type conversion validation
                    // Bit indexing is the explicit escape hatch for narrowing/sign conversions
                    return null;
                } else {
                    // Single bit indexing: [index] - returns bool
                    return 'bool';
                }
            }
        }

        return baseType;
    }

    /**
     * ADR-024: Get the type of a primary expression.
     */
    private getPrimaryExpressionType(ctx: Parser.PrimaryExpressionContext): string | null {
        // Check for identifier
        const id = ctx.IDENTIFIER();
        if (id) {
            const name = id.getText();
            const scopedName = this.resolveIdentifier(name);
            const typeInfo = this.context.typeRegistry.get(scopedName);
            if (typeInfo) {
                return typeInfo.baseType;
            }
            return null;
        }

        // Check for literal
        const literal = ctx.literal();
        if (literal) {
            return this.getLiteralType(literal);
        }

        // Check for parenthesized expression
        const expr = ctx.expression();
        if (expr) {
            return this.getExpressionType(expr);
        }

        // Check for cast expression
        const cast = ctx.castExpression();
        if (cast) {
            return cast.type().getText();
        }

        return null;
    }

    /**
     * ADR-024: Get the type of a unary expression (for cast validation).
     */
    private getUnaryExpressionType(ctx: Parser.UnaryExpressionContext): string | null {
        // Check for unary operators - type doesn't change for !, ~, -, +
        const postfix = ctx.postfixExpression();
        if (postfix) {
            return this.getPostfixExpressionType(postfix);
        }

        // Check for recursive unary expression
        const unary = ctx.unaryExpression();
        if (unary) {
            return this.getUnaryExpressionType(unary);
        }

        return null;
    }

    /**
     * ADR-024: Get the type from a literal (suffixed or unsuffixed).
     * Returns the explicit suffix type, or null for unsuffixed literals.
     */
    private getLiteralType(ctx: Parser.LiteralContext): string | null {
        const text = ctx.getText();

        // Boolean literals
        if (text === 'true' || text === 'false') return 'bool';

        // Check for type suffix on numeric literals
        const suffixMatch = text.match(/([uUiI])(8|16|32|64)$/);
        if (suffixMatch) {
            const signChar = suffixMatch[1].toLowerCase();
            const width = suffixMatch[2];
            return (signChar === 'u' ? 'u' : 'i') + width;
        }

        // Float suffix
        const floatMatch = text.match(/[fF](32|64)$/);
        if (floatMatch) {
            return 'f' + floatMatch[1];
        }

        // Unsuffixed literal - type depends on context (handled by caller)
        return null;
    }

    /**
     * ADR-024: Validate that a type conversion is allowed.
     * Throws error for narrowing or sign-changing conversions.
     */
    private validateTypeConversion(targetType: string, sourceType: string | null): void {
        // If we can't determine source type, skip validation
        if (!sourceType) return;

        // Skip if types are the same
        if (sourceType === targetType) return;

        // Only validate integer-to-integer conversions
        if (!this.isIntegerType(sourceType) || !this.isIntegerType(targetType)) return;

        // Check for narrowing conversion
        if (this.isNarrowingConversion(sourceType, targetType)) {
            const targetWidth = TYPE_WIDTH[targetType] || 0;
            throw new Error(
                `Error: Cannot assign ${sourceType} to ${targetType} (narrowing). ` +
                `Use bit indexing: value[0, ${targetWidth}]`
            );
        }

        // Check for sign conversion
        if (this.isSignConversion(sourceType, targetType)) {
            const targetWidth = TYPE_WIDTH[targetType] || 0;
            throw new Error(
                `Error: Cannot assign ${sourceType} to ${targetType} (sign change). ` +
                `Use bit indexing: value[0, ${targetWidth}]`
            );
        }
    }

    /**
     * Resolve an identifier to its scoped name.
     * Inside a scope, checks if the identifier is a scope member first.
     * Otherwise returns the identifier unchanged (global scope).
     * ADR-016: Renamed from namespace-based resolution
     */
    private resolveIdentifier(identifier: string): string {
        // Check current scope first (inner scope shadows outer)
        if (this.context.currentScope) {
            const members = this.context.scopeMembers.get(this.context.currentScope);
            if (members && members.has(identifier)) {
                return `${this.context.currentScope}_${identifier}`;
            }
        }

        // Fall back to global scope
        return identifier;
    }

    /**
     * ADR-013: Check if assigning to an identifier would violate const rules.
     * Returns error message if const, null if mutable.
     */
    private checkConstAssignment(identifier: string): string | null {
        // Check if it's a const parameter
        const paramInfo = this.context.currentParameters.get(identifier);
        if (paramInfo?.isConst) {
            return `cannot assign to const parameter '${identifier}'`;
        }

        // Resolve identifier to scoped name for proper lookup
        const scopedName = this.resolveIdentifier(identifier);

        // Check if it's a const variable
        const typeInfo = this.context.typeRegistry.get(scopedName);
        if (typeInfo?.isConst) {
            return `cannot assign to const variable '${identifier}'`;
        }

        return null;  // Mutable, assignment OK
    }

    /**
     * Navigate through expression layers to get to the postfix expression.
     * Returns null if the expression has multiple terms at any level.
     */
    private getPostfixExpression(ctx: Parser.ExpressionContext): Parser.PostfixExpressionContext | null {
        const ternary = ctx.ternaryExpression();
        const orExprs = ternary.orExpression();
        // If it's a ternary (3 orExpressions), we can't get a single postfix
        if (orExprs.length !== 1) return null;

        const or = orExprs[0];
        if (or.andExpression().length !== 1) return null;

        const and = or.andExpression()[0];
        if (and.equalityExpression().length !== 1) return null;

        const eq = and.equalityExpression()[0];
        if (eq.relationalExpression().length !== 1) return null;

        const rel = eq.relationalExpression()[0];
        if (rel.bitwiseOrExpression().length !== 1) return null;

        const bor = rel.bitwiseOrExpression()[0];
        if (bor.bitwiseXorExpression().length !== 1) return null;

        const bxor = bor.bitwiseXorExpression()[0];
        if (bxor.bitwiseAndExpression().length !== 1) return null;

        const band = bxor.bitwiseAndExpression()[0];
        if (band.shiftExpression().length !== 1) return null;

        const shift = band.shiftExpression()[0];
        if (shift.additiveExpression().length !== 1) return null;

        const add = shift.additiveExpression()[0];
        if (add.multiplicativeExpression().length !== 1) return null;

        const mult = add.multiplicativeExpression()[0];
        if (mult.unaryExpression().length !== 1) return null;

        const unary = mult.unaryExpression()[0];
        if (!unary.postfixExpression()) return null;

        return unary.postfixExpression()!;
    }

    /**
     * Extract a simple identifier from an expression, if it is one.
     * Returns null for complex expressions.
     */
    private getSimpleIdentifier(ctx: Parser.ExpressionContext): string | null {
        const postfix = this.getPostfixExpression(ctx);
        if (!postfix) return null;

        if (postfix.postfixOp().length !== 0) return null; // Has operators like . or []

        const primary = postfix.primaryExpression();
        if (!primary.IDENTIFIER()) return null;

        return primary.IDENTIFIER()!.getText();
    }

    /**
     * ADR-045: Get the actual character length of a string literal,
     * accounting for escape sequences like \n, \t, \\, etc.
     */
    private getStringLiteralLength(literal: string): number {
        // Remove surrounding quotes
        const content = literal.slice(1, -1);

        let length = 0;
        let i = 0;
        while (i < content.length) {
            if (content[i] === '\\' && i + 1 < content.length) {
                // Escape sequence counts as 1 character
                i += 2;
            } else {
                i += 1;
            }
            length += 1;
        }
        return length;
    }

    /**
     * Check if an expression is an lvalue that needs & when passed to functions.
     * This includes member access (cursor.x) and array access (arr[i]).
     * Returns the type of lvalue or null if not an lvalue.
     */
    private getLvalueType(ctx: Parser.ExpressionContext): 'member' | 'array' | null {
        const postfix = this.getPostfixExpression(ctx);
        if (!postfix) return null;

        const ops = postfix.postfixOp();
        if (ops.length === 0) return null;

        // Check the last operator to determine lvalue type
        const lastOp = ops[ops.length - 1];

        // Member access: .identifier
        if (lastOp.IDENTIFIER()) {
            return 'member';
        }

        // Array access: [expression]
        if (lastOp.expression()) {
            return 'array';
        }

        return null;
    }

    /**
     * Generate a function argument with proper ADR-006 semantics.
     * - Local variables get & (address-of)
     * - Member access (cursor.x) gets & (address-of)
     * - Array access (arr[i]) gets & (address-of)
     * - Parameters are passed as-is (already pointers)
     * - Arrays are passed as-is (naturally decay to pointers)
     * - Literals and complex expressions are passed as-is
     */
    private generateFunctionArg(ctx: Parser.ExpressionContext): string {
        const id = this.getSimpleIdentifier(ctx);

        if (id) {
            // Check if it's a parameter (already a pointer)
            const paramInfo = this.context.currentParameters.get(id);
            if (paramInfo) {
                // Arrays are passed as-is, non-arrays are already pointers
                return id;
            }

            // Check if it's a local array (passed as-is, naturally decays to pointer)
            if (this.context.localArrays.has(id)) {
                return id;
            }

            // Check if it's a scope member (ADR-016)
            if (this.context.currentScope) {
                const members = this.context.scopeMembers.get(this.context.currentScope);
                if (members && members.has(id)) {
                    return `&${this.context.currentScope}_${id}`;
                }
            }

            // Local variable - add &
            return `&${id}`;
        }

        // Check if it's a member access or array access (lvalue) - needs &
        const lvalueType = this.getLvalueType(ctx);
        if (lvalueType) {
            // Generate the expression and wrap with &
            return `&${this.generateExpression(ctx)}`;
        }

        // Complex expression or literal - generate normally
        return this.generateExpression(ctx);
    }

    // ========================================================================
    // Declarations
    // ========================================================================

    private generateDeclaration(ctx: Parser.DeclarationContext): string {
        // ADR-016: Handle scope declarations (renamed from namespace)
        if (ctx.scopeDeclaration()) {
            return this.generateScope(ctx.scopeDeclaration()!);
        }
        if (ctx.registerDeclaration()) {
            return this.generateRegister(ctx.registerDeclaration()!);
        }
        if (ctx.structDeclaration()) {
            return this.generateStruct(ctx.structDeclaration()!);
        }
        // ADR-017: Handle enum declarations
        if (ctx.enumDeclaration()) {
            return this.generateEnum(ctx.enumDeclaration()!);
        }
        if (ctx.functionDeclaration()) {
            return this.generateFunction(ctx.functionDeclaration()!);
        }
        if (ctx.variableDeclaration()) {
            return this.generateVariableDecl(ctx.variableDeclaration()!) + '\n';
        }
        return '';
    }

    // ========================================================================
    // Scope (ADR-016: Organization with visibility control)
    // ========================================================================

    private generateScope(ctx: Parser.ScopeDeclarationContext): string {
        const name = ctx.IDENTIFIER().getText();
        this.context.currentScope = name;

        const lines: string[] = [];
        lines.push(`/* Scope: ${name} */`);

        for (const member of ctx.scopeMember()) {
            const visibility = member.visibilityModifier()?.getText() || 'public';
            const isPrivate = visibility === 'private';

            if (member.variableDeclaration()) {
                const varDecl = member.variableDeclaration()!;
                const type = this.generateType(varDecl.type());
                const varName = varDecl.IDENTIFIER().getText();
                const fullName = `${name}_${varName}`;
                const prefix = isPrivate ? 'static ' : '';

                // Track variable type with mangled name for scope-aware const checking
                this.trackVariableTypeWithName(varDecl, fullName);

                const isArray = varDecl.arrayDimension() !== null;
                let decl = `${prefix}${type} ${fullName}`;
                if (isArray) {
                    decl += this.generateArrayDimension(varDecl.arrayDimension()!);
                }
                if (varDecl.expression()) {
                    decl += ` = ${this.generateExpression(varDecl.expression()!)}`;
                } else {
                    // ADR-015: Zero initialization for uninitialized scope variables
                    decl += ` = ${this.getZeroInitializer(varDecl.type(), isArray)}`;
                }
                lines.push(decl + ';');
            }

            if (member.functionDeclaration()) {
                const funcDecl = member.functionDeclaration()!;
                const returnType = this.generateType(funcDecl.type());
                const funcName = funcDecl.IDENTIFIER().getText();
                const fullName = `${name}_${funcName}`;
                const prefix = isPrivate ? 'static ' : '';

                // Track parameters for ADR-006 pointer semantics
                this.setParameters(funcDecl.parameterList() ?? null);

                // ADR-016: Clear local variables and mark that we're in a function body
                this.context.localVariables.clear();
                this.context.inFunctionBody = true;

                const params = funcDecl.parameterList()
                    ? this.generateParameterList(funcDecl.parameterList()!)
                    : 'void';

                const body = this.generateBlock(funcDecl.block());

                // ADR-016: Clear local variables and mark that we're no longer in a function body
                this.context.inFunctionBody = false;
                this.context.localVariables.clear();
                this.clearParameters();

                lines.push('');
                lines.push(`${prefix}${returnType} ${fullName}(${params}) ${body}`);
            }

            // ADR-017: Handle enum declarations inside scopes
            if (member.enumDeclaration()) {
                const enumDecl = member.enumDeclaration()!;
                // Collect the scoped enum (if not already collected)
                this.collectEnum(enumDecl, name);
                const enumCode = this.generateEnum(enumDecl);
                lines.push('');
                lines.push(enumCode);
            }
        }

        lines.push('');
        this.context.currentScope = null;
        return lines.join('\n');
    }

    // ========================================================================
    // Register Bindings (ADR-004)
    // ========================================================================

    private generateRegister(ctx: Parser.RegisterDeclarationContext): string {
        const name = ctx.IDENTIFIER().getText();
        const baseAddress = this.generateExpression(ctx.expression());

        const lines: string[] = [];
        lines.push(`/* Register: ${name} @ ${baseAddress} */`);

        // Generate individual #define for each register member with its offset
        // This handles non-contiguous register layouts correctly (like i.MX RT1062)
        for (const member of ctx.registerMember()) {
            const regName = member.IDENTIFIER().getText();
            const regType = this.generateType(member.type());
            const access = member.accessModifier().getText();
            const offset = this.generateExpression(member.expression());

            // Determine qualifiers based on access mode
            let cast = `volatile ${regType}*`;
            if (access === 'ro') {
                cast = `volatile ${regType} const *`;
            }

            // Generate: #define GPIO7_DR (*(volatile uint32_t*)(0x42004000 + 0x00))
            lines.push(`#define ${name}_${regName} (*(${cast})(${baseAddress} + ${offset}))`);
        }

        lines.push('');
        return lines.join('\n');
    }

    // ========================================================================
    // Struct
    // ========================================================================

    private generateStruct(ctx: Parser.StructDeclarationContext): string {
        const name = ctx.IDENTIFIER().getText();

        const lines: string[] = [];
        lines.push(`typedef struct {`);

        for (const member of ctx.structMember()) {
            const type = this.generateType(member.type());
            const fieldName = member.IDENTIFIER().getText();
            // Handle array dimensions in struct fields
            const arrayDim = member.arrayDimension();
            if (arrayDim) {
                const dim = this.generateArrayDimension(arrayDim);
                lines.push(`    ${type} ${fieldName}${dim};`);
            } else {
                lines.push(`    ${type} ${fieldName};`);
            }
        }

        lines.push(`} ${name};`);
        lines.push('');

        return lines.join('\n');
    }

    // ========================================================================
    // Enum (ADR-017: Type-safe enums)
    // ========================================================================

    /**
     * ADR-017: Generate enum declaration
     * enum State { IDLE, RUNNING, ERROR <- 255 }
     * -> typedef enum { State_IDLE = 0, State_RUNNING = 1, State_ERROR = 255 } State;
     */
    private generateEnum(ctx: Parser.EnumDeclarationContext): string {
        const name = ctx.IDENTIFIER().getText();
        const prefix = this.context.currentScope ? `${this.context.currentScope}_` : '';
        const fullName = `${prefix}${name}`;

        const lines: string[] = [];
        lines.push(`typedef enum {`);

        const members = this.enumMembers.get(fullName);
        if (!members) {
            throw new Error(`Error: Enum ${fullName} not found in registry`);
        }

        const memberEntries = Array.from(members.entries());

        for (let i = 0; i < memberEntries.length; i++) {
            const [memberName, value] = memberEntries[i];
            const fullMemberName = `${fullName}_${memberName}`;
            const comma = i < memberEntries.length - 1 ? ',' : '';
            lines.push(`    ${fullMemberName} = ${value}${comma}`);
        }

        lines.push(`} ${fullName};`);
        lines.push('');

        return lines.join('\n');
    }

    /**
     * ADR-014: Generate struct initializer
     * Point { x: 10, y: 20 } -> (Point){ .x = 10, .y = 20 }
     * { x: 10, y: 20 } -> (Point){ .x = 10, .y = 20 } (inferred from context)
     */
    private generateStructInitializer(ctx: Parser.StructInitializerContext): string {
        // Get type name - either explicit or inferred from context
        let typeName: string;
        if (ctx.IDENTIFIER()) {
            typeName = ctx.IDENTIFIER()!.getText();
        } else if (this.context.expectedType) {
            typeName = this.context.expectedType;
        } else {
            // This should not happen in valid code
            throw new Error('Cannot infer struct type - no explicit type and no context');
        }

        const fieldList = ctx.fieldInitializerList();

        if (!fieldList) {
            // Empty initializer: Point {} -> (Point){ 0 }
            return `(${typeName}){ 0 }`;
        }

        // Get field type info for nested initializers
        const structFieldTypes = this.structFields.get(typeName);

        const fields = fieldList.fieldInitializer().map(field => {
            const fieldName = field.IDENTIFIER().getText();

            // Set expected type for nested initializers
            const savedExpectedType = this.context.expectedType;
            if (structFieldTypes && structFieldTypes.has(fieldName)) {
                this.context.expectedType = structFieldTypes.get(fieldName)!;
            }

            const value = this.generateExpression(field.expression());

            // Restore expected type
            this.context.expectedType = savedExpectedType;

            return `.${fieldName} = ${value}`;
        });

        return `(${typeName}){ ${fields.join(', ')} }`;
    }

    // ========================================================================
    // Functions
    // ========================================================================

    private generateFunction(ctx: Parser.FunctionDeclarationContext): string {
        const returnType = this.generateType(ctx.type());
        const name = ctx.IDENTIFIER().getText();

        // Track parameters for ADR-006 pointer semantics
        this.setParameters(ctx.parameterList() ?? null);

        // ADR-016: Clear local variables and mark that we're in a function body
        this.context.localVariables.clear();
        this.context.inFunctionBody = true;

        // Check for main function with args parameter (u8 args[][])
        const isMainWithArgs = this.isMainFunctionWithArgs(name, ctx.parameterList());

        let params: string;
        let actualReturnType: string;

        if (isMainWithArgs) {
            // Special case: main(u8 args[][]) -> int main(int argc, char *argv[])
            actualReturnType = 'int';
            params = 'int argc, char *argv[]';
            // Store the args parameter name for translation in the body
            // We know there's exactly one parameter from isMainFunctionWithArgs check
            const argsParam = ctx.parameterList()!.parameter()[0];
            this.context.mainArgsName = argsParam.IDENTIFIER().getText();
        } else {
            actualReturnType = returnType;
            params = ctx.parameterList()
                ? this.generateParameterList(ctx.parameterList()!)
                : 'void';
        }

        const body = this.generateBlock(ctx.block());

        // ADR-016: Clear local variables and mark that we're no longer in a function body
        this.context.inFunctionBody = false;
        this.context.localVariables.clear();
        this.context.mainArgsName = null;
        this.clearParameters();

        return `${actualReturnType} ${name}(${params}) ${body}\n`;
    }

    /**
     * Check if this is the main function with a u8 args[][] parameter
     */
    private isMainFunctionWithArgs(name: string, paramList: Parser.ParameterListContext | null): boolean {
        if (name !== 'main' || !paramList) {
            return false;
        }

        const params = paramList.parameter();
        if (params.length !== 1) {
            return false;
        }

        const param = params[0];
        const type = param.type().getText();
        const dims = param.arrayDimension();

        // Check for u8 (or i8 for signed char) with exactly 2 array dimensions
        return (type === 'u8' || type === 'i8') && dims.length === 2;
    }

    private generateParameterList(ctx: Parser.ParameterListContext): string {
        return ctx.parameter().map(p => this.generateParameter(p)).join(', ');
    }

    private generateParameter(ctx: Parser.ParameterContext): string {
        const constMod = ctx.constModifier() ? 'const ' : '';
        const type = this.generateType(ctx.type());
        const name = ctx.IDENTIFIER().getText();
        const dims = ctx.arrayDimension();

        // Arrays pass naturally as pointers
        if (dims.length > 0) {
            const dimStr = dims.map(d => this.generateArrayDimension(d)).join('');
            return `${constMod}${type} ${name}${dimStr}`;
        }

        // ADR-006: Pass by reference for non-array types
        // Add pointer for primitive types to enable pass-by-reference semantics
        return `${constMod}${type}* ${name}`;
    }

    private generateArrayDimension(ctx: Parser.ArrayDimensionContext): string {
        if (ctx.expression()) {
            return `[${this.generateExpression(ctx.expression()!)}]`;
        }
        return '[]';
    }

    // ========================================================================
    // Variables
    // ========================================================================

    private generateVariableDecl(ctx: Parser.VariableDeclarationContext): string {
        const constMod = ctx.constModifier() ? 'const ' : '';
        const type = this.generateType(ctx.type());
        const name = ctx.IDENTIFIER().getText();
        const typeCtx = ctx.type();

        // Track type for bit access and .length support
        this.trackVariableType(ctx);

        // ADR-016: Track local variables (allowed as bare identifiers inside scopes)
        // Only track as local if we're inside a function body
        // Global and scope-level variables should NOT be tracked as local
        if (this.context.inFunctionBody) {
            this.context.localVariables.add(name);
        }

        // ADR-045: Handle bounded string type specially
        if (typeCtx.stringType()) {
            const stringCtx = typeCtx.stringType()!;
            const intLiteral = stringCtx.INTEGER_LITERAL();

            if (intLiteral) {
                const capacity = parseInt(intLiteral.getText(), 10);
                let stringDecl = `${constMod}char ${name}[${capacity + 1}]`;

                if (ctx.expression()) {
                    const exprText = ctx.expression()!.getText();

                    // Validate string literal fits capacity
                    if (exprText.startsWith('"') && exprText.endsWith('"')) {
                        // Extract content without quotes, accounting for escape sequences
                        const content = this.getStringLiteralLength(exprText);
                        if (content > capacity) {
                            throw new Error(
                                `Error: String literal (${content} chars) exceeds string<${capacity}> capacity`
                            );
                        }
                    }

                    stringDecl += ` = ${this.generateExpression(ctx.expression()!)}`;
                } else {
                    // Empty string initialization
                    stringDecl += ' = ""';
                }

                return stringDecl + ';';
            } else {
                // ADR-045: Unsized string - requires const and string literal for inference
                const isConst = ctx.constModifier() !== null;

                if (!isConst) {
                    throw new Error('Error: Non-const string requires explicit capacity, e.g., string<64>');
                }

                if (!ctx.expression()) {
                    throw new Error('Error: const string requires initializer for capacity inference');
                }

                const exprText = ctx.expression()!.getText();
                if (!exprText.startsWith('"') || !exprText.endsWith('"')) {
                    throw new Error('Error: const string requires string literal for capacity inference');
                }

                // Infer capacity from literal length
                const inferredCapacity = this.getStringLiteralLength(exprText);
                this.needsString = true;

                // Register in type registry with inferred capacity
                this.context.typeRegistry.set(name, {
                    baseType: 'char',
                    bitWidth: 8,
                    isArray: true,
                    arrayLength: inferredCapacity + 1,
                    isConst: true,
                    isString: true,
                    stringCapacity: inferredCapacity,
                });

                return `const char ${name}[${inferredCapacity + 1}] = ${exprText};`;
            }
        }

        let decl = `${constMod}${type} ${name}`;
        const isArray = ctx.arrayDimension() !== null;

        if (isArray) {
            decl += this.generateArrayDimension(ctx.arrayDimension()!);
            // ADR-006: Track local arrays (they don't need & when passed to functions)
            this.context.localArrays.add(name);
        }

        if (ctx.expression()) {
            // Explicit initializer provided
            // Set expected type for inferred struct initializers
            const typeName = this.getTypeName(typeCtx);
            const savedExpectedType = this.context.expectedType;
            this.context.expectedType = typeName;

            // ADR-017: Validate enum type for initialization
            if (this.knownEnums.has(typeName)) {
                const valueEnumType = this.getExpressionEnumType(ctx.expression()!);

                // Check if assigning from a different enum type
                if (valueEnumType && valueEnumType !== typeName) {
                    throw new Error(
                        `Error: Cannot assign ${valueEnumType} enum to ${typeName} enum`
                    );
                }

                // Check if assigning integer to enum
                if (this.isIntegerExpression(ctx.expression()!)) {
                    throw new Error(
                        `Error: Cannot assign integer to ${typeName} enum`
                    );
                }

                // Check if assigning a non-enum, non-integer expression
                if (!valueEnumType) {
                    const exprText = ctx.expression()!.getText();
                    const parts = exprText.split('.');

                    // ADR-016: Handle this.State.MEMBER pattern
                    if (parts[0] === 'this' && this.context.currentScope && parts.length >= 3) {
                        const scopedEnumName = `${this.context.currentScope}_${parts[1]}`;
                        if (scopedEnumName === typeName) {
                            // Valid this.Enum.Member access
                        } else {
                            throw new Error(
                                `Error: Cannot assign non-enum value to ${typeName} enum`
                            );
                        }
                    }
                    // Allow if it's an enum member access of the correct type
                    else if (!exprText.startsWith(typeName + '.')) {
                        // Check for scoped enum
                        if (parts.length >= 3) {
                            const scopedEnumName = `${parts[0]}_${parts[1]}`;
                            if (scopedEnumName !== typeName) {
                                throw new Error(
                                    `Error: Cannot assign non-enum value to ${typeName} enum`
                                );
                            }
                        } else if (parts.length === 2 && parts[0] !== typeName) {
                            throw new Error(
                                `Error: Cannot assign non-enum value to ${typeName} enum`
                            );
                        }
                    }
                }
            }

            // ADR-024: Validate literal values fit in target type
            // Only validate for integer types and literal expressions
            if (this.isIntegerType(typeName)) {
                const exprText = ctx.expression()!.getText().trim();
                // Check if it's a direct literal (not a variable or expression)
                if (exprText.match(/^-?\d+$/) ||
                    exprText.match(/^0[xX][0-9a-fA-F]+$/) ||
                    exprText.match(/^0[bB][01]+$/)) {
                    this.validateLiteralFitsType(exprText, typeName);
                } else {
                    // Not a literal - check for narrowing/sign conversions
                    const sourceType = this.getExpressionType(ctx.expression()!);
                    this.validateTypeConversion(typeName, sourceType);
                }
            }

            decl += ` = ${this.generateExpression(ctx.expression()!)}`;

            // Restore expected type
            this.context.expectedType = savedExpectedType;
        } else {
            // ADR-015: Zero initialization for uninitialized variables
            decl += ` = ${this.getZeroInitializer(typeCtx, isArray)}`;
        }

        return decl + ';';
    }

    /**
     * ADR-015: Get the appropriate zero initializer for a type
     * ADR-017: Handle enum types by initializing to first member
     */
    private getZeroInitializer(typeCtx: Parser.TypeContext, isArray: boolean): string {
        // Arrays and structs/classes use {0}
        if (isArray) {
            return '{0}';
        }

        // Check for user-defined types (structs/classes/enums)
        if (typeCtx.userType()) {
            const typeName = typeCtx.userType()!.getText();

            // ADR-017: Check if this is an enum type
            if (this.knownEnums.has(typeName)) {
                // Return the first member of the enum (which has value 0)
                const members = this.enumMembers.get(typeName);
                if (members) {
                    // Find the member with value 0
                    for (const [memberName, value] of members.entries()) {
                        if (value === 0) {
                            return `${typeName}_${memberName}`;
                        }
                    }
                    // If no member has value 0, use the first member
                    const firstMember = members.keys().next().value;
                    if (firstMember) {
                        return `${typeName}_${firstMember}`;
                    }
                }
                // Fallback to casting 0 to the enum type
                return `(${typeName})0`;
            }

            return '{0}';
        }

        // Check for generic types (like RingBuffer<u8, 256>)
        if (typeCtx.genericType()) {
            return '{0}';
        }

        // Primitive types
        if (typeCtx.primitiveType()) {
            const primType = typeCtx.primitiveType()!.getText();
            if (primType === 'bool') {
                return 'false';
            }
            if (primType === 'f32') {
                return '0.0f';
            }
            if (primType === 'f64') {
                return '0.0';
            }
            // All integer types
            return '0';
        }

        // Default fallback
        return '0';
    }

    // ========================================================================
    // Statements
    // ========================================================================

    private generateBlock(ctx: Parser.BlockContext): string {
        this.context.indentLevel++;
        const lines: string[] = ['{'];

        for (const stmt of ctx.statement()) {
            const stmtCode = this.generateStatement(stmt);
            if (stmtCode) {
                lines.push(this.indent(stmtCode));
            }
        }

        this.context.indentLevel--;
        lines.push('}');

        return lines.join('\n');
    }

    private generateStatement(ctx: Parser.StatementContext): string {
        if (ctx.variableDeclaration()) {
            return this.generateVariableDecl(ctx.variableDeclaration()!);
        }
        if (ctx.assignmentStatement()) {
            return this.generateAssignment(ctx.assignmentStatement()!);
        }
        if (ctx.expressionStatement()) {
            return this.generateExpression(ctx.expressionStatement()!.expression()) + ';';
        }
        if (ctx.ifStatement()) {
            return this.generateIf(ctx.ifStatement()!);
        }
        if (ctx.whileStatement()) {
            return this.generateWhile(ctx.whileStatement()!);
        }
        if (ctx.forStatement()) {
            return this.generateFor(ctx.forStatement()!);
        }
        if (ctx.switchStatement()) {
            return this.generateSwitch(ctx.switchStatement()!);
        }
        if (ctx.returnStatement()) {
            return this.generateReturn(ctx.returnStatement()!);
        }
        if (ctx.block()) {
            return this.generateBlock(ctx.block()!);
        }
        return '';
    }

    // ADR-001: <- becomes = in C, with compound assignment operators
    private generateAssignment(ctx: Parser.AssignmentStatementContext): string {
        const targetCtx = ctx.assignmentTarget();

        // Set expected type for inferred struct initializers
        const savedExpectedType = this.context.expectedType;
        // ADR-044: Save and set assignment context for overflow behavior
        const savedAssignmentContext = { ...this.context.assignmentContext };

        if (targetCtx.IDENTIFIER() && !targetCtx.memberAccess() && !targetCtx.arrayAccess()) {
            const id = targetCtx.IDENTIFIER()!.getText();
            const typeInfo = this.context.typeRegistry.get(id);
            if (typeInfo) {
                this.context.expectedType = typeInfo.baseType;
                // ADR-044: Set overflow context for expression generation
                this.context.assignmentContext = {
                    targetName: id,
                    targetType: typeInfo.baseType,
                    overflowBehavior: typeInfo.overflowBehavior || 'clamp',
                };
            }
        }

        const value = this.generateExpression(ctx.expression());

        // Restore expected type and assignment context
        this.context.expectedType = savedExpectedType;
        this.context.assignmentContext = savedAssignmentContext;

        // Get the assignment operator and map to C equivalent
        const operatorCtx = ctx.assignmentOperator();
        const cnextOp = operatorCtx.getText();
        const cOp = ASSIGNMENT_OPERATOR_MAP[cnextOp] || '=';
        const isCompound = cOp !== '=';

        // ADR-013: Validate const before generating assignment
        // Check simple identifier assignment
        if (targetCtx.IDENTIFIER() && !targetCtx.memberAccess() && !targetCtx.arrayAccess()) {
            const id = targetCtx.IDENTIFIER()!.getText();
            const constError = this.checkConstAssignment(id);
            if (constError) {
                throw new Error(constError);
            }

            // ADR-017: Validate enum type assignment
            const targetTypeInfo = this.context.typeRegistry.get(id);
            if (targetTypeInfo?.isEnum && targetTypeInfo.enumTypeName) {
                const targetEnumType = targetTypeInfo.enumTypeName;
                const valueEnumType = this.getExpressionEnumType(ctx.expression());

                // Check if assigning from a different enum type
                if (valueEnumType && valueEnumType !== targetEnumType) {
                    throw new Error(
                        `Error: Cannot assign ${valueEnumType} enum to ${targetEnumType} enum`
                    );
                }

                // Check if assigning integer to enum
                if (this.isIntegerExpression(ctx.expression())) {
                    throw new Error(
                        `Error: Cannot assign integer to ${targetEnumType} enum`
                    );
                }

                // Check if assigning a non-enum, non-integer expression to enum
                // (must be same enum type or a valid enum member access)
                if (!valueEnumType) {
                    const exprText = ctx.expression().getText();
                    const parts = exprText.split('.');

                    // ADR-016: Handle this.State.MEMBER pattern
                    if (parts[0] === 'this' && this.context.currentScope && parts.length >= 3) {
                        const scopedEnumName = `${this.context.currentScope}_${parts[1]}`;
                        if (scopedEnumName !== targetEnumType) {
                            throw new Error(
                                `Error: Cannot assign non-enum value to ${targetEnumType} enum`
                            );
                        }
                    }
                    // Allow if it's an enum member access of the correct type
                    else if (!exprText.startsWith(targetEnumType + '.')) {
                        // Not a direct enum member access - check if it's scoped enum
                        if (parts.length >= 3) {
                            // Could be Scope.Enum.Member
                            const scopedEnumName = `${parts[0]}_${parts[1]}`;
                            if (scopedEnumName !== targetEnumType) {
                                throw new Error(
                                    `Error: Cannot assign non-enum value to ${targetEnumType} enum`
                                );
                            }
                        } else if (parts.length === 2) {
                            // Could be Enum.Member or variable.field
                            if (parts[0] !== targetEnumType && !this.knownEnums.has(parts[0])) {
                                throw new Error(
                                    `Error: Cannot assign non-enum value to ${targetEnumType} enum`
                                );
                            }
                        }
                    }
                }
            }

            // ADR-024: Validate integer type conversions for simple assignments only
            // Skip validation for compound assignments (+<-, -<-, etc.) since the
            // operand doesn't need to fit directly in the target type
            if (!isCompound && targetTypeInfo && this.isIntegerType(targetTypeInfo.baseType)) {
                const exprText = ctx.expression().getText().trim();
                // Check if it's a direct literal
                if (exprText.match(/^-?\d+$/) ||
                    exprText.match(/^0[xX][0-9a-fA-F]+$/) ||
                    exprText.match(/^0[bB][01]+$/)) {
                    this.validateLiteralFitsType(exprText, targetTypeInfo.baseType);
                } else {
                    // Not a literal - check for narrowing/sign conversions
                    const sourceType = this.getExpressionType(ctx.expression());
                    this.validateTypeConversion(targetTypeInfo.baseType, sourceType);
                }
            }
        }

        // Check array element assignment - validate the array is not const
        if (targetCtx.arrayAccess()) {
            const arrayName = targetCtx.arrayAccess()!.IDENTIFIER().getText();
            const constError = this.checkConstAssignment(arrayName);
            if (constError) {
                throw new Error(`${constError} (array element)`);
            }
        }

        // Check member access on const struct - validate the root is not const
        if (targetCtx.memberAccess()) {
            const identifiers = targetCtx.memberAccess()!.IDENTIFIER();
            if (identifiers.length > 0) {
                const rootName = identifiers[0].getText();
                const constError = this.checkConstAssignment(rootName);
                if (constError) {
                    throw new Error(`${constError} (member access)`);
                }

                // ADR-013: Check for read-only register members (ro = implicitly const)
                if (identifiers.length >= 2) {
                    const memberName = identifiers[1].getText();
                    const fullName = `${rootName}_${memberName}`;
                    const accessMod = this.registerMemberAccess.get(fullName);
                    if (accessMod === 'ro') {
                        throw new Error(
                            `cannot assign to read-only register member '${memberName}' ` +
                            `(${rootName}.${memberName} has 'ro' access modifier)`
                        );
                    }
                }
            }
        }

        // Check if this is a member access with subscript (e.g., GPIO7.DR_SET[LED_BIT])
        const memberAccessCtx = targetCtx.memberAccess();
        if (memberAccessCtx) {
            const exprs = memberAccessCtx.expression();
            if (exprs.length > 0) {
                // Compound operators not supported for bit field access
                if (isCompound) {
                    throw new Error(`Compound assignment operators not supported for bit field access: ${cnextOp}`);
                }

                // This is GPIO7.DR_SET[bit] or GPIO7.DR[start, width]
                const identifiers = memberAccessCtx.IDENTIFIER();
                const regName = identifiers[0].getText();
                const memberName = identifiers[1].getText();
                const fullName = `${regName}_${memberName}`;

                // Check if this is a write-only register
                const accessMod = this.registerMemberAccess.get(fullName);
                const isWriteOnly = accessMod === 'wo' || accessMod === 'w1s' || accessMod === 'w1c';

                if (exprs.length === 1) {
                    const bitIndex = this.generateExpression(exprs[0]);
                    if (isWriteOnly) {
                        // Write-only: assigning false/0 is semantically meaningless
                        if (value === 'false' || value === '0') {
                            throw new Error(
                                `Cannot assign false to write-only register bit ${fullName}[${bitIndex}]. ` +
                                `Use the corresponding CLEAR register to clear bits.`
                            );
                        }
                        // Write-only: just write the mask, no read-modify-write needed
                        // GPIO7.DR_SET[LED_BIT] <- true  =>  GPIO7_DR_SET = (1 << LED_BIT)
                        return `${fullName} = (1 << ${bitIndex});`;
                    } else {
                        // Read-write: need read-modify-write
                        return `${fullName} = (${fullName} & ~(1 << ${bitIndex})) | ((${value} ? 1 : 0) << ${bitIndex});`;
                    }
                } else if (exprs.length === 2) {
                    const start = this.generateExpression(exprs[0]);
                    const width = this.generateExpression(exprs[1]);
                    const mask = `((1 << ${width}) - 1)`;
                    if (isWriteOnly) {
                        // Write-only: assigning 0 is semantically meaningless
                        if (value === '0') {
                            throw new Error(
                                `Cannot assign 0 to write-only register bits ${fullName}[${start}, ${width}]. ` +
                                `Use the corresponding CLEAR register to clear bits.`
                            );
                        }
                        // Write-only: just write the value shifted to position
                        return `${fullName} = ((${value} & ${mask}) << ${start});`;
                    } else {
                        // Read-write: need read-modify-write
                        return `${fullName} = (${fullName} & ~(${mask} << ${start})) | ((${value} & ${mask}) << ${start});`;
                    }
                }
            }
        }

        // ADR-016: Check if this is a global array access (e.g., global.GPIO7.DR_SET[LED_BIT])
        const globalArrayAccessCtx = targetCtx.globalArrayAccess();
        if (globalArrayAccessCtx) {
            // Compound operators not supported for bit field access
            if (isCompound) {
                throw new Error(`Compound assignment operators not supported for bit field access: ${cnextOp}`);
            }

            const identifiers = globalArrayAccessCtx.IDENTIFIER();
            const parts = identifiers.map(id => id.getText());
            const expr = globalArrayAccessCtx.expression();
            const bitIndex = this.generateExpression(expr);
            const firstId = parts[0];

            if (this.knownRegisters.has(firstId)) {
                // This is a register access: global.GPIO7.DR_SET[LED_BIT]
                const regName = parts.join('_');

                // Check if this is a write-only register
                const accessMod = this.registerMemberAccess.get(regName);
                const isWriteOnly = accessMod === 'wo' || accessMod === 'w1s' || accessMod === 'w1c';

                if (isWriteOnly) {
                    // Write-only: assigning false/0 is semantically meaningless
                    if (value === 'false' || value === '0') {
                        throw new Error(
                            `Cannot assign false to write-only register bit ${regName}[${bitIndex}]. ` +
                            `Use the corresponding CLEAR register to clear bits.`
                        );
                    }
                    // Write-only: just write the mask, no read-modify-write needed
                    // global.GPIO7.DR_SET[LED_BIT] <- true  =>  GPIO7_DR_SET = (1 << LED_BIT)
                    return `${regName} = (1 << ${bitIndex});`;
                } else {
                    // Read-write: need read-modify-write
                    return `${regName} = (${regName} & ~(1 << ${bitIndex})) | ((${value} ? 1 : 0) << ${bitIndex});`;
                }
            } else {
                // Non-register global array access
                const baseName = parts.join('.');
                return `${baseName} = (${baseName} & ~(1 << ${bitIndex})) | ((${value} ? 1 : 0) << ${bitIndex});`;
            }
        }

        // Check if this is a simple array/bit access assignment (e.g., flags[3])
        const arrayAccessCtx = targetCtx.arrayAccess();
        if (arrayAccessCtx) {
            // Compound operators not supported for bit field access
            if (isCompound) {
                throw new Error(`Compound assignment operators not supported for bit field access: ${cnextOp}`);
            }

            const name = arrayAccessCtx.IDENTIFIER().getText();
            const exprs = arrayAccessCtx.expression();

            if (exprs.length === 1) {
                // Single bit assignment: flags[3] <- true
                const bitIndex = this.generateExpression(exprs[0]);
                // Generate: name = (name & ~(1 << index)) | ((value ? 1 : 0) << index)
                return `${name} = (${name} & ~(1 << ${bitIndex})) | ((${value} ? 1 : 0) << ${bitIndex});`;
            } else if (exprs.length === 2) {
                // Bit range assignment: flags[0, 3] <- 5
                const start = this.generateExpression(exprs[0]);
                const width = this.generateExpression(exprs[1]);
                // Generate: name = (name & ~(mask << start)) | ((value & mask) << start)
                const mask = `((1 << ${width}) - 1)`;
                return `${name} = (${name} & ~(${mask} << ${start})) | ((${value} & ${mask}) << ${start});`;
            }
        }

        // Normal assignment (simple or compound)
        const target = this.generateAssignmentTarget(targetCtx);

        // ADR-044: Handle compound assignments with overflow behavior
        if (isCompound && targetCtx.IDENTIFIER()) {
            const id = targetCtx.IDENTIFIER()!.getText();
            const typeInfo = this.context.typeRegistry.get(id);

            if (typeInfo && typeInfo.overflowBehavior === 'clamp' && TYPE_WIDTH[typeInfo.baseType]) {
                // Clamp behavior: use helper function
                const opMap: Record<string, string> = {
                    '+=': 'add',
                    '-=': 'sub',
                    '*=': 'mul',
                };
                const helperOp = opMap[cOp];

                if (helperOp) {
                    this.markClampOpUsed(helperOp, typeInfo.baseType);
                    return `${target} = cnx_clamp_${helperOp}_${typeInfo.baseType}(${target}, ${value});`;
                }
            }
            // Wrap behavior or non-integer: use natural C arithmetic (fall through)
        }

        return `${target} ${cOp} ${value};`;
    }

    private generateAssignmentTarget(ctx: Parser.AssignmentTargetContext): string {
        // ADR-016: Handle global.arr[i] or global.GPIO7.DR_SET[i] access
        if (ctx.globalArrayAccess()) {
            return this.generateGlobalArrayAccess(ctx.globalArrayAccess()!);
        }

        // ADR-016: Handle global.GPIO7.DR_SET access (member chain)
        if (ctx.globalMemberAccess()) {
            return this.generateGlobalMemberAccess(ctx.globalMemberAccess()!);
        }

        // ADR-016: Handle global.value access (simple)
        if (ctx.globalAccess()) {
            return ctx.globalAccess()!.IDENTIFIER().getText();
        }

        // ADR-016: Handle this.member access for scope-local assignment
        if (ctx.thisAccess()) {
            const memberName = ctx.thisAccess()!.IDENTIFIER().getText();
            if (!this.context.currentScope) {
                throw new Error("Error: 'this' can only be used inside a scope");
            }
            return `${this.context.currentScope}_${memberName}`;
        }
        if (ctx.memberAccess()) {
            return this.generateMemberAccess(ctx.memberAccess()!);
        }
        if (ctx.arrayAccess()) {
            return this.generateArrayAccess(ctx.arrayAccess()!);
        }

        const id = ctx.IDENTIFIER()!.getText();

        // ADR-006: Check if it's a function parameter
        const paramInfo = this.context.currentParameters.get(id);
        if (paramInfo) {
            // Parameter - allowed as bare identifier
            if (!paramInfo.isArray) {
                return `(*${id})`;
            }
            return id;
        }

        // Check if it's a local variable
        const isLocalVariable = this.context.localVariables.has(id);

        // ADR-016: Enforce explicit qualification inside scopes
        // Bare identifiers are ONLY allowed for local variables and parameters
        this.validateBareIdentifierInScope(id, isLocalVariable);

        return id;
    }

    // ADR-016: Generate global member access for assignment targets
    private generateGlobalMemberAccess(ctx: Parser.GlobalMemberAccessContext): string {
        const identifiers = ctx.IDENTIFIER();
        const parts = identifiers.map(id => id.getText());
        // Check if first identifier is a register
        const firstId = parts[0];
        if (this.knownRegisters.has(firstId)) {
            // Register member access: GPIO7.DR_SET -> GPIO7_DR_SET
            return parts.join('_');
        }
        // Non-register member access: obj.field
        return parts.join('.');
    }

    // ADR-016: Generate global array access for assignment targets
    private generateGlobalArrayAccess(ctx: Parser.GlobalArrayAccessContext): string {
        const identifiers = ctx.IDENTIFIER();
        const parts = identifiers.map(id => id.getText());
        const expr = this.generateExpression(ctx.expression());
        const firstId = parts[0];

        if (this.knownRegisters.has(firstId)) {
            // Register bit access: GPIO7.DR_SET[idx] -> GPIO7_DR_SET |= (1 << idx) (handled elsewhere)
            // For assignment target, just generate the left-hand side representation
            const regName = parts.join('_');
            return `${regName}[${expr}]`;
        }

        // Non-register array access
        const baseName = parts.join('.');
        return `${baseName}[${expr}]`;
    }

    private generateIf(ctx: Parser.IfStatementContext): string {
        const condition = this.generateExpression(ctx.expression());
        const statements = ctx.statement();
        const thenBranch = this.generateStatement(statements[0]);

        let result = `if (${condition}) ${thenBranch}`;

        if (statements.length > 1) {
            const elseBranch = this.generateStatement(statements[1]);
            result += ` else ${elseBranch}`;
        }

        return result;
    }

    private generateWhile(ctx: Parser.WhileStatementContext): string {
        const condition = this.generateExpression(ctx.expression());
        const body = this.generateStatement(ctx.statement());
        return `while (${condition}) ${body}`;
    }

    private generateFor(ctx: Parser.ForStatementContext): string {
        let init = '';
        const forInit = ctx.forInit();
        if (forInit) {
            if (forInit.forVarDecl()) {
                // Generate variable declaration for for loop init
                init = this.generateForVarDecl(forInit.forVarDecl()!);
            } else if (forInit.forAssignment()) {
                // Generate assignment for for loop init
                init = this.generateForAssignment(forInit.forAssignment()!);
            }
        }

        let condition = '';
        if (ctx.expression()) {
            condition = this.generateExpression(ctx.expression()!);
        }

        let update = '';
        const forUpdate = ctx.forUpdate();
        if (forUpdate) {
            // forUpdate has same structure as forAssignment
            const target = this.generateAssignmentTarget(forUpdate.assignmentTarget());
            const value = this.generateExpression(forUpdate.expression());
            const operatorCtx = forUpdate.assignmentOperator();
            const cnextOp = operatorCtx.getText();
            const cOp = ASSIGNMENT_OPERATOR_MAP[cnextOp] || '=';
            update = `${target} ${cOp} ${value}`;
        }

        const body = this.generateStatement(ctx.statement());

        return `for (${init}; ${condition}; ${update}) ${body}`;
    }

    // Generate variable declaration for for loop init (no trailing semicolon)
    private generateForVarDecl(ctx: Parser.ForVarDeclContext): string {
        const typeName = this.generateType(ctx.type());
        const name = ctx.IDENTIFIER().getText();

        // ADR-016: Track local variables (allowed as bare identifiers inside scopes)
        this.context.localVariables.add(name);

        let result = `${typeName} ${name}`;

        // Handle array dimension
        const arrayDim = ctx.arrayDimension();
        if (arrayDim && arrayDim.expression()) {
            const size = this.generateExpression(arrayDim.expression()!);
            result = `${typeName} ${name}[${size}]`;
        }

        // Handle initialization
        if (ctx.expression()) {
            const value = this.generateExpression(ctx.expression()!);
            result += ` = ${value}`;
        }

        return result;
    }

    // Generate assignment for for loop init/update (no trailing semicolon)
    private generateForAssignment(ctx: Parser.ForAssignmentContext): string {
        const target = this.generateAssignmentTarget(ctx.assignmentTarget());
        const value = this.generateExpression(ctx.expression());
        const operatorCtx = ctx.assignmentOperator();
        const cnextOp = operatorCtx.getText();
        const cOp = ASSIGNMENT_OPERATOR_MAP[cnextOp] || '=';
        return `${target} ${cOp} ${value}`;
    }

    private generateReturn(ctx: Parser.ReturnStatementContext): string {
        if (ctx.expression()) {
            return `return ${this.generateExpression(ctx.expression()!)};`;
        }
        return 'return;';
    }

    // ========================================================================
    // Switch Statements (ADR-025)
    // ========================================================================

    private generateSwitch(ctx: Parser.SwitchStatementContext): string {
        const switchExpr = ctx.expression();
        const exprCode = this.generateExpression(switchExpr);

        // ADR-025: Semantic validation
        this.validateSwitchStatement(ctx, switchExpr);

        // Build the switch statement
        const lines: string[] = [`switch (${exprCode}) {`];

        // Generate cases
        for (const caseCtx of ctx.switchCase()) {
            lines.push(this.generateSwitchCase(caseCtx));
        }

        // Generate default if present
        const defaultCtx = ctx.defaultCase();
        if (defaultCtx) {
            lines.push(this.generateDefaultCase(defaultCtx));
        }

        lines.push('}');

        return lines.join('\n');
    }

    private generateSwitchCase(ctx: Parser.SwitchCaseContext): string {
        const labels = ctx.caseLabel();
        const block = ctx.block();
        const lines: string[] = [];

        // Generate case labels - expand || to multiple C case labels
        for (let i = 0; i < labels.length; i++) {
            const labelCode = this.generateCaseLabel(labels[i]);
            if (i < labels.length - 1) {
                // Multiple labels: just the label without body
                lines.push(this.indent(`case ${labelCode}:`));
            } else {
                // Last label: attach the block
                lines.push(this.indent(`case ${labelCode}: {`));
            }
        }

        // Generate block contents (without the outer braces - we added them above)
        const statements = block.statement();
        for (const stmt of statements) {
            const stmtCode = this.generateStatement(stmt);
            if (stmtCode) {
                lines.push(this.indent(this.indent(stmtCode)));
            }
        }

        // Add break and close block
        lines.push(this.indent(this.indent('break;')));
        lines.push(this.indent('}'));

        return lines.join('\n');
    }

    private generateCaseLabel(ctx: Parser.CaseLabelContext): string {
        // qualifiedType - for enum values like EState.IDLE
        if (ctx.qualifiedType()) {
            const qt = ctx.qualifiedType()!;
            // Convert EState.IDLE to EState_IDLE for C
            const parts = qt.IDENTIFIER();
            return parts.map((id) => id.getText()).join('_');
        }

        // IDENTIFIER - const variable or plain enum member
        if (ctx.IDENTIFIER()) {
            return ctx.IDENTIFIER()!.getText();
        }

        // Numeric literals
        if (ctx.INTEGER_LITERAL()) {
            return ctx.INTEGER_LITERAL()!.getText();
        }

        if (ctx.HEX_LITERAL()) {
            return ctx.HEX_LITERAL()!.getText();
        }

        if (ctx.BINARY_LITERAL()) {
            // Convert binary to hex for cleaner C output
            const binText = ctx.BINARY_LITERAL()!.getText();
            const value = parseInt(binText.replace(/0[bB]/, ''), 2);
            return `0x${value.toString(16).toUpperCase()}`;
        }

        if (ctx.CHAR_LITERAL()) {
            return ctx.CHAR_LITERAL()!.getText();
        }

        return '';
    }

    private generateDefaultCase(ctx: Parser.DefaultCaseContext): string {
        const block = ctx.block();
        const lines: string[] = [];

        // Note: default(n) count is for compile-time validation only,
        // not included in generated C
        lines.push(this.indent('default: {'));

        // Generate block contents
        const statements = block.statement();
        for (const stmt of statements) {
            const stmtCode = this.generateStatement(stmt);
            if (stmtCode) {
                lines.push(this.indent(this.indent(stmtCode)));
            }
        }

        // Add break and close block
        lines.push(this.indent(this.indent('break;')));
        lines.push(this.indent('}'));

        return lines.join('\n');
    }

    /**
     * ADR-025: Validate switch statement for MISRA compliance
     */
    private validateSwitchStatement(
        ctx: Parser.SwitchStatementContext,
        switchExpr: Parser.ExpressionContext
    ): void {
        const cases = ctx.switchCase();
        const defaultCase = ctx.defaultCase();
        const totalClauses = cases.length + (defaultCase ? 1 : 0);

        // MISRA 16.7: No boolean switches (use if/else instead)
        const exprType = this.getExpressionType(switchExpr);
        if (exprType === 'bool') {
            throw new Error(
                'Error: Cannot switch on boolean type (MISRA 16.7). Use if/else instead.'
            );
        }

        // MISRA 16.6: Minimum 2 clauses required
        if (totalClauses < 2) {
            throw new Error(
                'Error: Switch requires at least 2 clauses (MISRA 16.6). Use if statement for single case.'
            );
        }

        // MISRA 16.5: Default must be last clause (checked by grammar order, but verify)
        // Grammar ensures default comes after cases, so this is always satisfied

        // Check for duplicate case values
        const seenValues = new Set<string>();
        for (const caseCtx of cases) {
            for (const labelCtx of caseCtx.caseLabel()) {
                const labelValue = this.getCaseLabelValue(labelCtx);
                if (seenValues.has(labelValue)) {
                    throw new Error(`Error: Duplicate case value '${labelValue}' in switch statement.`);
                }
                seenValues.add(labelValue);
            }
        }

        // ADR-025: Enum exhaustiveness checking
        if (exprType && this.knownEnums.has(exprType)) {
            this.validateEnumExhaustiveness(ctx, exprType, cases, defaultCase);
        }
    }

    /**
     * ADR-025: Validate enum switch exhaustiveness with default(n) counting
     */
    private validateEnumExhaustiveness(
        ctx: Parser.SwitchStatementContext,
        enumTypeName: string,
        cases: Parser.SwitchCaseContext[],
        defaultCase: Parser.DefaultCaseContext | null
    ): void {
        const enumVariants = this.enumMembers.get(enumTypeName);
        if (!enumVariants) return; // Shouldn't happen if knownEnums has it

        const totalVariants = enumVariants.size;

        // Count explicit cases (each || alternative counts as 1)
        let explicitCaseCount = 0;
        for (const caseCtx of cases) {
            explicitCaseCount += caseCtx.caseLabel().length;
        }

        if (defaultCase) {
            // Check for default(n) syntax
            const defaultCount = this.getDefaultCount(defaultCase);

            if (defaultCount !== null) {
                // default(n) mode: explicit + n must equal total variants
                const covered = explicitCaseCount + defaultCount;
                if (covered !== totalVariants) {
                    throw new Error(
                        `Error: switch covers ${covered} of ${totalVariants} ${enumTypeName} variants ` +
                            `(${explicitCaseCount} explicit + default(${defaultCount})). ` +
                            `Expected ${totalVariants}.`
                    );
                }
            }
            // Plain default: no exhaustiveness check needed
        } else {
            // No default: must cover all variants explicitly
            if (explicitCaseCount !== totalVariants) {
                const missing = totalVariants - explicitCaseCount;
                throw new Error(
                    `Error: Non-exhaustive switch on ${enumTypeName}: covers ${explicitCaseCount} of ${totalVariants} variants, missing ${missing}.`
                );
            }
        }
    }

    /**
     * Get the count from default(n) syntax, or null for plain default
     */
    private getDefaultCount(ctx: Parser.DefaultCaseContext): number | null {
        const intLiteral = ctx.INTEGER_LITERAL();
        if (intLiteral) {
            return parseInt(intLiteral.getText(), 10);
        }
        return null;
    }

    /**
     * Get the string representation of a case label for duplicate checking
     */
    private getCaseLabelValue(ctx: Parser.CaseLabelContext): string {
        if (ctx.qualifiedType()) {
            const qt = ctx.qualifiedType()!;
            return qt.IDENTIFIER().map((id) => id.getText()).join('.');
        }
        if (ctx.IDENTIFIER()) {
            return ctx.IDENTIFIER()!.getText();
        }
        if (ctx.INTEGER_LITERAL()) {
            return ctx.INTEGER_LITERAL()!.getText();
        }
        if (ctx.HEX_LITERAL()) {
            // Normalize hex to decimal for comparison
            const hex = ctx.HEX_LITERAL()!.getText();
            return String(parseInt(hex, 16));
        }
        if (ctx.BINARY_LITERAL()) {
            // Normalize binary to decimal for comparison
            const bin = ctx.BINARY_LITERAL()!.getText();
            return String(parseInt(bin.replace(/0[bB]/, ''), 2));
        }
        if (ctx.CHAR_LITERAL()) {
            return ctx.CHAR_LITERAL()!.getText();
        }
        return '';
    }

    // ========================================================================
    // Ternary Validation (ADR-022)
    // ========================================================================

    /**
     * ADR-022: Validate that ternary condition is a boolean expression
     * Must be a comparison or logical operation, not just a value
     */
    private validateTernaryCondition(ctx: Parser.OrExpressionContext): void {
        // Check if the condition contains a comparison or logical operator
        // A valid boolean expression must have one of: =, !=, <, >, <=, >=, &&, ||
        const text = ctx.getText();

        // If it has && or ||, it's a logical expression (valid)
        if (ctx.andExpression().length > 1) {
            return; // Has || operator - valid
        }

        const andExpr = ctx.andExpression(0);
        if (!andExpr) {
            throw new Error(
                `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`
            );
        }

        if (andExpr.equalityExpression().length > 1) {
            return; // Has && operator - valid
        }

        const equalityExpr = andExpr.equalityExpression(0);
        if (!equalityExpr) {
            throw new Error(
                `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`
            );
        }

        if (equalityExpr.relationalExpression().length > 1) {
            return; // Has = or != operator - valid
        }

        const relationalExpr = equalityExpr.relationalExpression(0);
        if (!relationalExpr) {
            throw new Error(
                `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`
            );
        }

        if (relationalExpr.bitwiseOrExpression().length > 1) {
            return; // Has <, >, <=, >= operator - valid
        }

        // No comparison or logical operators found - just a value
        throw new Error(
            `Error: Ternary condition must be a boolean expression (comparison or logical operation), not '${text}'`
        );
    }

    /**
     * ADR-022: Validate that expression does not contain a nested ternary
     */
    private validateNoNestedTernary(
        ctx: Parser.OrExpressionContext,
        branchName: string
    ): void {
        const text = ctx.getText();
        // Check for ternary pattern: something ? something : something
        // This is a simple heuristic - the grammar would catch malformed ternaries
        if (text.includes('?') && text.includes(':')) {
            throw new Error(
                `Error: Nested ternary not allowed in ${branchName}. Use if/else instead.`
            );
        }
    }

    // ========================================================================
    // Expressions
    // ========================================================================

    private generateExpression(ctx: Parser.ExpressionContext): string {
        return this.generateTernaryExpr(ctx.ternaryExpression());
    }

    // ADR-022: Ternary operator with safety constraints
    private generateTernaryExpr(ctx: Parser.TernaryExpressionContext): string {
        const orExprs = ctx.orExpression();

        // Non-ternary path: just one orExpression
        if (orExprs.length === 1) {
            return this.generateOrExpr(orExprs[0]);
        }

        // Ternary path: 3 orExpressions (condition, true branch, false branch)
        const condition = orExprs[0];
        const trueExpr = orExprs[1];
        const falseExpr = orExprs[2];

        // ADR-022: Validate ternary constraints
        this.validateTernaryCondition(condition);
        this.validateNoNestedTernary(trueExpr, 'true branch');
        this.validateNoNestedTernary(falseExpr, 'false branch');

        // Generate C output - parentheses already present from grammar
        const condCode = this.generateOrExpr(condition);
        const trueCode = this.generateOrExpr(trueExpr);
        const falseCode = this.generateOrExpr(falseExpr);

        return `(${condCode}) ? ${trueCode} : ${falseCode}`;
    }

    private generateOrExpr(ctx: Parser.OrExpressionContext): string {
        const parts = ctx.andExpression().map(e => this.generateAndExpr(e));
        return parts.join(' || ');
    }

    private generateAndExpr(ctx: Parser.AndExpressionContext): string {
        const parts = ctx.equalityExpression().map(e => this.generateEqualityExpr(e));
        return parts.join(' && ');
    }

    // ADR-001: = becomes == in C
    // ADR-017: Enum type safety validation
    private generateEqualityExpr(ctx: Parser.EqualityExpressionContext): string {
        const exprs = ctx.relationalExpression();
        if (exprs.length === 1) {
            return this.generateRelationalExpr(exprs[0]);
        }

        // ADR-017: Validate enum type safety for comparisons
        if (exprs.length >= 2) {
            const leftEnumType = this.getExpressionEnumType(exprs[0]);
            const rightEnumType = this.getExpressionEnumType(exprs[1]);

            // Check if comparing different enum types
            if (leftEnumType && rightEnumType && leftEnumType !== rightEnumType) {
                throw new Error(
                    `Error: Cannot compare ${leftEnumType} enum to ${rightEnumType} enum`
                );
            }

            // Check if comparing enum to integer
            if (leftEnumType && this.isIntegerExpression(exprs[1])) {
                throw new Error(
                    `Error: Cannot compare ${leftEnumType} enum to integer`
                );
            }
            if (rightEnumType && this.isIntegerExpression(exprs[0])) {
                throw new Error(
                    `Error: Cannot compare integer to ${rightEnumType} enum`
                );
            }
        }

        // Build the expression, transforming = to ==
        let result = this.generateRelationalExpr(exprs[0]);

        // Get the full text to find operators
        const fullText = ctx.getText();

        for (let i = 1; i < exprs.length; i++) {
            // Check if there's a != operator before this expression
            // Simple heuristic: look for != in the text
            const op = fullText.includes('!=') ? '!=' : '==';
            result += ` ${op} ${this.generateRelationalExpr(exprs[i])}`;
        }

        return result;
    }

    private generateRelationalExpr(ctx: Parser.RelationalExpressionContext): string {
        const exprs = ctx.bitwiseOrExpression();
        if (exprs.length === 1) {
            return this.generateBitwiseOrExpr(exprs[0]);
        }

        let result = this.generateBitwiseOrExpr(exprs[0]);
        const text = ctx.getText();

        for (let i = 1; i < exprs.length; i++) {
            let op = '<';
            if (text.includes('>=')) op = '>=';
            else if (text.includes('<=')) op = '<=';
            else if (text.includes('>')) op = '>';

            result += ` ${op} ${this.generateBitwiseOrExpr(exprs[i])}`;
        }

        return result;
    }

    private generateBitwiseOrExpr(ctx: Parser.BitwiseOrExpressionContext): string {
        const parts = ctx.bitwiseXorExpression().map(e => this.generateBitwiseXorExpr(e));
        return parts.join(' | ');
    }

    private generateBitwiseXorExpr(ctx: Parser.BitwiseXorExpressionContext): string {
        const parts = ctx.bitwiseAndExpression().map(e => this.generateBitwiseAndExpr(e));
        return parts.join(' ^ ');
    }

    private generateBitwiseAndExpr(ctx: Parser.BitwiseAndExpressionContext): string {
        const parts = ctx.shiftExpression().map(e => this.generateShiftExpr(e));
        return parts.join(' & ');
    }

    private generateShiftExpr(ctx: Parser.ShiftExpressionContext): string {
        const exprs = ctx.additiveExpression();
        if (exprs.length === 1) {
            return this.generateAdditiveExpr(exprs[0]);
        }

        let result = this.generateAdditiveExpr(exprs[0]);
        const text = ctx.getText();

        for (let i = 1; i < exprs.length; i++) {
            const op = text.includes('<<') ? '<<' : '>>';
            result += ` ${op} ${this.generateAdditiveExpr(exprs[i])}`;
        }

        return result;
    }

    private generateAdditiveExpr(ctx: Parser.AdditiveExpressionContext): string {
        const exprs = ctx.multiplicativeExpression();
        if (exprs.length === 1) {
            return this.generateMultiplicativeExpr(exprs[0]);
        }

        // Need to get operators - for now use simple approach
        let result = this.generateMultiplicativeExpr(exprs[0]);
        const text = ctx.getText();

        for (let i = 1; i < exprs.length; i++) {
            // Simple heuristic to determine operator
            const op = text.includes('-') ? '-' : '+';
            result += ` ${op} ${this.generateMultiplicativeExpr(exprs[i])}`;
        }

        return result;
    }

    private generateMultiplicativeExpr(ctx: Parser.MultiplicativeExpressionContext): string {
        const exprs = ctx.unaryExpression();
        if (exprs.length === 1) {
            return this.generateUnaryExpr(exprs[0]);
        }

        let result = this.generateUnaryExpr(exprs[0]);
        const text = ctx.getText();

        for (let i = 1; i < exprs.length; i++) {
            let op = '*';
            if (text.includes('/')) op = '/';
            else if (text.includes('%')) op = '%';
            result += ` ${op} ${this.generateUnaryExpr(exprs[i])}`;
        }

        return result;
    }

    private generateUnaryExpr(ctx: Parser.UnaryExpressionContext): string {
        if (ctx.postfixExpression()) {
            return this.generatePostfixExpr(ctx.postfixExpression()!);
        }

        const inner = this.generateUnaryExpr(ctx.unaryExpression()!);
        const text = ctx.getText();

        if (text.startsWith('!')) return `!${inner}`;
        if (text.startsWith('-')) return `-${inner}`;
        if (text.startsWith('~')) return `~${inner}`;
        if (text.startsWith('&')) return `&${inner}`;

        return inner;
    }

    private generatePostfixExpr(ctx: Parser.PostfixExpressionContext): string {
        const primary = ctx.primaryExpression();
        const ops = ctx.postfixOp();

        // Check if this is a struct parameter - we may need to handle -> access
        const primaryId = primary.IDENTIFIER()?.getText();
        const paramInfo = primaryId ? this.context.currentParameters.get(primaryId) : null;
        const isStructParam = paramInfo?.isStruct ?? false;

        let result = this.generatePrimaryExpr(primary);

        // ADR-016: Track if we've encountered a register in the access chain
        let isRegisterChain = primaryId ? this.knownRegisters.has(primaryId) : false;

        for (let i = 0; i < ops.length; i++) {
            const op = ops[i];

            // Member access
            if (op.IDENTIFIER()) {
                const memberName = op.IDENTIFIER()!.getText();

                // ADR-016: Handle global. prefix - first member becomes the identifier
                if (result === '__GLOBAL_PREFIX__') {
                    result = memberName;
                    // Check if this first identifier is a register
                    if (this.knownRegisters.has(memberName)) {
                        isRegisterChain = true;
                    }
                    continue;  // Skip further processing, this just sets the base identifier
                }

                // Handle .length property for arrays, strings, and integers
                if (memberName === 'length') {
                    // Special case: main function's args.length -> argc
                    if (this.context.mainArgsName && primaryId === this.context.mainArgsName) {
                        result = 'argc';
                    } else {
                        const typeInfo = primaryId ? this.context.typeRegistry.get(primaryId) : undefined;
                        if (typeInfo) {
                            // ADR-045: String length is runtime strlen()
                            if (typeInfo.isString) {
                                result = `strlen(${primaryId})`;
                            } else if (typeInfo.isArray && typeInfo.arrayLength !== undefined) {
                                // Array length - return the compile-time constant
                                result = String(typeInfo.arrayLength);
                            } else if (!typeInfo.isArray) {
                                // Integer bit width - return the compile-time constant
                                result = String(typeInfo.bitWidth);
                            } else {
                                // Unknown length, generate error placeholder
                                result = `/* .length unknown for ${primaryId} */0`;
                            }
                        } else {
                            result = `/* .length: unknown type for ${result} */0`;
                        }
                    }
                }
                // ADR-045: Handle .capacity property for strings
                else if (memberName === 'capacity') {
                    const typeInfo = primaryId ? this.context.typeRegistry.get(primaryId) : undefined;
                    if (typeInfo?.isString && typeInfo.stringCapacity !== undefined) {
                        // Return compile-time constant capacity
                        result = String(typeInfo.stringCapacity);
                    } else {
                        throw new Error(`Error: .capacity is only available on string types`);
                    }
                }
                // Check if this is a scope member access: Scope.member (ADR-016)
                else if (this.knownScopes.has(result)) {
                    // Transform Scope.member to Scope_member
                    result = `${result}_${memberName}`;
                }
                // ADR-017: Check if this is an enum member access: State.IDLE -> State_IDLE
                else if (this.knownEnums.has(result)) {
                    // Transform Enum.member to Enum_member
                    result = `${result}_${memberName}`;
                }
                // Check if this is a register member access: GPIO7.DR -> GPIO7_DR
                else if (this.knownRegisters.has(result)) {
                    // Transform Register.member to Register_member (matching #define)
                    result = `${result}_${memberName}`;
                    isRegisterChain = true;  // ADR-016: Track register chain for subscript handling
                }
                // ADR-006: Struct parameter uses -> for member access
                else if (isStructParam && result === primaryId) {
                    result = `${result}->${memberName}`;
                }
                else {
                    result = `${result}.${memberName}`;
                }
            }
            // Array subscript / bit access
            else if (op.expression().length > 0) {
                const exprs = op.expression();
                if (exprs.length === 1) {
                    // Single index: could be array[i] or bit access flags[3]
                    const index = this.generateExpression(exprs[0]);

                    // Check type registry to determine if this is bit access or array access
                    const typeInfo = primaryId ? this.context.typeRegistry.get(primaryId) : undefined;

                    // ADR-016: Use isRegisterChain to detect register access via global. prefix
                    const isRegisterAccess = isRegisterChain || (primaryId ? this.knownRegisters.has(primaryId) : false);

                    if ((typeInfo && !typeInfo.isArray) || isRegisterAccess) {
                        // Integer type or register - use bit access: ((value >> index) & 1)
                        result = `((${result} >> ${index}) & 1)`;
                    } else {
                        // Array or unknown - use array access
                        result = `${result}[${index}]`;
                    }
                } else if (exprs.length === 2) {
                    // Bit range: flags[start, width]
                    const start = this.generateExpression(exprs[0]);
                    const width = this.generateExpression(exprs[1]);
                    // Generate bit range read: ((value >> start) & ((1 << width) - 1))
                    result = `((${result} >> ${start}) & ((1 << ${width}) - 1))`;
                }
            }
            // Function call
            else if (op.argumentList()) {
                // Check if this is a C-Next function (uses pass-by-reference)
                // C/C++ functions use pass-by-value
                // Uses both internal tracking and symbol table for cross-language interop
                const isCNextFunc = this.isCNextFunction(result);

                const argExprs = op.argumentList()!.expression();

                // ADR-013: Check const-to-non-const before generating arguments
                if (isCNextFunc) {
                    const sig = this.functionSignatures.get(result);
                    if (sig) {
                        for (let i = 0; i < argExprs.length && i < sig.parameters.length; i++) {
                            const argId = this.getSimpleIdentifier(argExprs[i]);
                            if (argId && this.isConstValue(argId)) {
                                const param = sig.parameters[i];
                                if (!param.isConst) {
                                    throw new Error(
                                        `cannot pass const '${argId}' to non-const parameter '${param.name}' ` +
                                        `of function '${result}'`
                                    );
                                }
                            }
                        }
                    }
                }

                const args = argExprs
                    .map(e => isCNextFunc ? this.generateFunctionArg(e) : this.generateExpression(e))
                    .join(', ');
                result = `${result}(${args})`;
            }
            // Empty function call
            else {
                result = `${result}()`;
            }
        }

        return result;
    }

    private generatePrimaryExpr(ctx: Parser.PrimaryExpressionContext): string {
        // ADR-017: Cast expression - (u8)State.IDLE
        if (ctx.castExpression()) {
            return this.generateCastExpression(ctx.castExpression()!);
        }
        // ADR-014: Struct initializer - Point { x: 10, y: 20 }
        if (ctx.structInitializer()) {
            return this.generateStructInitializer(ctx.structInitializer()!);
        }

        // ADR-016: Handle 'this' keyword for scope-local reference
        // 'this' returns the current scope name so that postfixOps transform this.member to Scope_member
        const text = ctx.getText();
        if (text === 'this') {
            if (!this.context.currentScope) {
                throw new Error("Error: 'this' can only be used inside a scope");
            }
            // Return the scope name - postfixOps will use knownScopes check to append _member
            return this.context.currentScope;
        }

        // ADR-016: Handle 'global' keyword for global reference
        // 'global' strips the prefix so global.X becomes just X
        if (text === 'global') {
            // Return special marker - first postfixOp will become the identifier
            return '__GLOBAL_PREFIX__';
        }

        if (ctx.IDENTIFIER()) {
            const id = ctx.IDENTIFIER()!.getText();

            // Special case: main function's args parameter -> argv
            if (this.context.mainArgsName && id === this.context.mainArgsName) {
                return 'argv';
            }

            // ADR-006: Check if it's a function parameter
            const paramInfo = this.context.currentParameters.get(id);
            if (paramInfo) {
                // Parameter - allowed as bare identifier
                if (!paramInfo.isArray && !paramInfo.isStruct) {
                    return `(*${id})`;
                }
                // For struct parameters, return as-is here (will use -> in member access)
                return id;
            }

            // Check if it's a local variable (tracked in type registry with no underscore prefix)
            // Local variables are those that were declared inside the current function
            const isLocalVariable = this.context.localVariables.has(id);

            // ADR-016: Enforce explicit qualification inside scopes
            // Bare identifiers are ONLY allowed for local variables and parameters
            this.validateBareIdentifierInScope(id, isLocalVariable);

            return id;
        }
        if (ctx.literal()) {
            return ctx.literal()!.getText();
        }
        if (ctx.expression()) {
            return `(${this.generateExpression(ctx.expression()!)})`;
        }
        return '';
    }

    /**
     * ADR-017: Generate cast expression
     * (u8)State.IDLE -> (uint8_t)State_IDLE
     */
    private generateCastExpression(ctx: Parser.CastExpressionContext): string {
        const targetType = this.generateType(ctx.type());
        const targetTypeName = ctx.type().getText();

        // ADR-024: Validate integer casts for narrowing and sign conversion
        if (this.isIntegerType(targetTypeName)) {
            const sourceType = this.getUnaryExpressionType(ctx.unaryExpression());
            if (sourceType && this.isIntegerType(sourceType)) {
                if (this.isNarrowingConversion(sourceType, targetTypeName)) {
                    const targetWidth = TYPE_WIDTH[targetTypeName] || 0;
                    throw new Error(
                        `Error: Cannot cast ${sourceType} to ${targetTypeName} (narrowing). ` +
                        `Use bit indexing: expr[0, ${targetWidth}]`
                    );
                }
                if (this.isSignConversion(sourceType, targetTypeName)) {
                    const targetWidth = TYPE_WIDTH[targetTypeName] || 0;
                    throw new Error(
                        `Error: Cannot cast ${sourceType} to ${targetTypeName} (sign change). ` +
                        `Use bit indexing: expr[0, ${targetWidth}]`
                    );
                }
            }
        }

        const expr = this.generateUnaryExpr(ctx.unaryExpression());

        // Validate enum casts are only to unsigned types
        const allowedCastTypes = ['u8', 'u16', 'u32', 'u64'];

        // Check if we're casting an enum (for validation)
        // We allow casts from any expression, but could add validation here
        if (!allowedCastTypes.includes(targetTypeName) &&
            !['i8', 'i16', 'i32', 'i64', 'f32', 'f64', 'bool'].includes(targetTypeName)) {
            // It's a user type cast - allow for now (could be struct pointer, etc.)
        }

        return `(${targetType})${expr}`;
    }

    private generateMemberAccess(ctx: Parser.MemberAccessContext): string {
        const parts = ctx.IDENTIFIER().map(id => id.getText());
        const expressions = ctx.expression();

        if (expressions.length > 0) {
            const firstPart = parts[0];
            const index = this.generateExpression(expressions[0]);
            if (parts.length > 1) {
                return `${firstPart}[${index}].${parts.slice(1).join('.')}`;
            }
            return `${firstPart}[${index}]`;
        }

        const firstPart = parts[0];

        // Check if it's a register member access: GPIO7.DR -> GPIO7_DR
        if (this.knownRegisters.has(firstPart)) {
            return parts.join('_');
        }

        // Check if it's a scope member access: Timing.tickCount -> Timing_tickCount (ADR-016)
        if (this.knownScopes.has(firstPart)) {
            return parts.join('_');
        }

        // ADR-006: Check if the first part is a struct parameter
        const paramInfo = this.context.currentParameters.get(firstPart);
        if (paramInfo && paramInfo.isStruct) {
            // Use -> for struct parameter member access
            if (parts.length === 1) {
                return firstPart;
            }
            return `${firstPart}->${parts.slice(1).join('.')}`;
        }

        return parts.join('.');
    }

    private generateArrayAccess(ctx: Parser.ArrayAccessContext): string {
        const name = ctx.IDENTIFIER().getText();
        const exprs = ctx.expression();

        if (exprs.length === 1) {
            // Single index: array[i] or bit access flags[3]
            const index = this.generateExpression(exprs[0]);
            return `${name}[${index}]`;
        } else if (exprs.length === 2) {
            // Bit range: flags[start, width]
            const start = this.generateExpression(exprs[0]);
            const width = this.generateExpression(exprs[1]);
            // Generate bit range read: ((value >> start) & ((1 << width) - 1))
            return `((${name} >> ${start}) & ((1 << ${width}) - 1))`;
        }

        return `${name}[/* error */]`;
    }

    // ========================================================================
    // Types
    // ========================================================================

    /**
     * Get the C-Next type name (for tracking purposes, not C translation)
     */
    private getTypeName(ctx: Parser.TypeContext): string {
        // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
        if (ctx.scopedType()) {
            const typeName = ctx.scopedType()!.IDENTIFIER().getText();
            if (this.context.currentScope) {
                return `${this.context.currentScope}_${typeName}`;
            }
            return typeName;
        }
        // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
        if (ctx.qualifiedType()) {
            const identifiers = ctx.qualifiedType()!.IDENTIFIER();
            const scopeName = identifiers[0].getText();
            const typeName = identifiers[1].getText();
            return `${scopeName}_${typeName}`;
        }
        if (ctx.userType()) {
            return ctx.userType()!.getText();
        }
        if (ctx.primitiveType()) {
            return ctx.primitiveType()!.getText();
        }
        if (ctx.genericType()) {
            return ctx.genericType()!.IDENTIFIER().getText();
        }
        return ctx.getText();
    }

    private generateType(ctx: Parser.TypeContext): string {
        if (ctx.primitiveType()) {
            const type = ctx.primitiveType()!.getText();
            // Track required includes based on type usage
            if (type === 'bool') {
                this.needsStdbool = true;
            } else if (type in TYPE_MAP && type !== 'void') {
                this.needsStdint = true;
            }
            return TYPE_MAP[type] || type;
        }
        // ADR-045: Handle bounded string type
        if (ctx.stringType()) {
            this.needsString = true;
            return 'char';  // String declarations handle the array dimension separately
        }
        // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
        if (ctx.scopedType()) {
            const typeName = ctx.scopedType()!.IDENTIFIER().getText();
            if (!this.context.currentScope) {
                throw new Error("Error: 'this.Type' can only be used inside a scope");
            }
            return `${this.context.currentScope}_${typeName}`;
        }
        // ADR-016: Handle Scope.Type from outside scope (e.g., Motor.State -> Motor_State)
        if (ctx.qualifiedType()) {
            const identifiers = ctx.qualifiedType()!.IDENTIFIER();
            const scopeName = identifiers[0].getText();
            const typeName = identifiers[1].getText();
            return `${scopeName}_${typeName}`;
        }
        if (ctx.userType()) {
            return ctx.userType()!.getText();
        }
        if (ctx.arrayType()) {
            const arrCtx = ctx.arrayType()!;
            let baseType: string;
            if (arrCtx.primitiveType()) {
                baseType = TYPE_MAP[arrCtx.primitiveType()!.getText()] || arrCtx.primitiveType()!.getText();
            } else {
                baseType = arrCtx.userType()!.getText();
            }
            return baseType;
        }
        if (ctx.genericType()) {
            // Generics need special handling - for now, return the base name
            return ctx.genericType()!.IDENTIFIER().getText();
        }
        if (ctx.getText() === 'void') {
            return 'void';
        }
        return ctx.getText();
    }

    // ========================================================================
    // Helpers
    // ========================================================================

    private indent(text: string): string {
        const spaces = '    '.repeat(this.context.indentLevel);
        return text.split('\n').map(line => spaces + line).join('\n');
    }

    // ========================================================================
    // ADR-044: Overflow Helper Functions
    // ========================================================================

    /**
     * Maps C-Next types to C max value macros from limits.h
     */
    private static readonly TYPE_MAX: Record<string, string> = {
        'u8': 'UINT8_MAX',
        'u16': 'UINT16_MAX',
        'u32': 'UINT32_MAX',
        'u64': 'UINT64_MAX',
        'i8': 'INT8_MAX',
        'i16': 'INT16_MAX',
        'i32': 'INT32_MAX',
        'i64': 'INT64_MAX',
    };

    /**
     * Maps C-Next types to C min value macros from limits.h
     */
    private static readonly TYPE_MIN: Record<string, string> = {
        'u8': '0',
        'u16': '0',
        'u32': '0',
        'u64': '0',
        'i8': 'INT8_MIN',
        'i16': 'INT16_MIN',
        'i32': 'INT32_MIN',
        'i64': 'INT64_MIN',
    };

    /**
     * Generate all needed overflow helper functions
     */
    private generateOverflowHelpers(): string[] {
        if (this.usedClampOps.size === 0) {
            return [];
        }

        const lines: string[] = [];

        if (this.debugMode) {
            lines.push('// ADR-044: Debug overflow helper functions (panic on overflow)');
            lines.push('#include <limits.h>');
            lines.push('#include <stdio.h>');
            lines.push('#include <stdlib.h>');
        } else {
            lines.push('// ADR-044: Overflow helper functions');
            lines.push('#include <limits.h>');
        }
        lines.push('');

        // Sort for deterministic output
        const sortedOps = Array.from(this.usedClampOps).sort();

        for (const op of sortedOps) {
            const [operation, cnxType] = op.split('_');
            const helper = this.debugMode
                ? this.generateDebugHelper(operation, cnxType)
                : this.generateSingleHelper(operation, cnxType);
            if (helper) {
                lines.push(helper);
                lines.push('');
            }
        }

        return lines;
    }

    /**
     * Generate a single overflow helper function
     */
    private generateSingleHelper(operation: string, cnxType: string): string | null {
        const cType = TYPE_MAP[cnxType];
        const maxValue = CodeGenerator.TYPE_MAX[cnxType];
        const minValue = CodeGenerator.TYPE_MIN[cnxType];

        if (!cType || !maxValue) {
            return null;
        }

        const isUnsigned = cnxType.startsWith('u');

        switch (operation) {
            case 'add':
                if (isUnsigned) {
                    // Unsigned addition: check if result would wrap
                    return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${cType} b) {
    if (a > ${maxValue} - b) return ${maxValue};
    return a + b;
}`;
                } else {
                    // Signed addition: check both overflow and underflow
                    return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${cType} b) {
    if (b > 0 && a > ${maxValue} - b) return ${maxValue};
    if (b < 0 && a < ${minValue} - b) return ${minValue};
    return a + b;
}`;
                }

            case 'sub':
                if (isUnsigned) {
                    // Unsigned subtraction: check if result would underflow
                    return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${cType} b) {
    if (a < b) return 0;
    return a - b;
}`;
                } else {
                    // Signed subtraction: check both overflow and underflow
                    return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${cType} b) {
    if (b < 0 && a > ${maxValue} + b) return ${maxValue};
    if (b > 0 && a < ${minValue} + b) return ${minValue};
    return a - b;
}`;
                }

            case 'mul':
                if (isUnsigned) {
                    // Unsigned multiplication
                    return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${cType} b) {
    if (b != 0 && a > ${maxValue} / b) return ${maxValue};
    return a * b;
}`;
                } else {
                    // Signed multiplication: handle negative cases
                    return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${cType} b) {
    if (a == 0 || b == 0) return 0;
    if (a > 0 && b > 0 && a > ${maxValue} / b) return ${maxValue};
    if (a < 0 && b < 0 && a < ${maxValue} / b) return ${maxValue};
    if (a > 0 && b < 0 && b < ${minValue} / a) return ${minValue};
    if (a < 0 && b > 0 && a < ${minValue} / b) return ${minValue};
    return a * b;
}`;
                }

            default:
                return null;
        }
    }

    /**
     * Generate a single debug helper function (panics on overflow)
     */
    private generateDebugHelper(operation: string, cnxType: string): string | null {
        const cType = TYPE_MAP[cnxType];
        const maxValue = CodeGenerator.TYPE_MAX[cnxType];
        const minValue = CodeGenerator.TYPE_MIN[cnxType];

        if (!cType || !maxValue) {
            return null;
        }

        const isUnsigned = cnxType.startsWith('u');
        const opName = operation === 'add' ? 'addition' : operation === 'sub' ? 'subtraction' : 'multiplication';

        switch (operation) {
            case 'add':
                if (isUnsigned) {
                    return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${cType} b) {
    if (a > ${maxValue} - b) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a + b;
}`;
                } else {
                    return `static inline ${cType} cnx_clamp_add_${cnxType}(${cType} a, ${cType} b) {
    if ((b > 0 && a > ${maxValue} - b) || (b < 0 && a < ${minValue} - b)) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a + b;
}`;
                }

            case 'sub':
                if (isUnsigned) {
                    return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${cType} b) {
    if (a < b) {
        fprintf(stderr, "PANIC: Integer underflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a - b;
}`;
                } else {
                    return `static inline ${cType} cnx_clamp_sub_${cnxType}(${cType} a, ${cType} b) {
    if ((b < 0 && a > ${maxValue} + b) || (b > 0 && a < ${minValue} + b)) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a - b;
}`;
                }

            case 'mul':
                if (isUnsigned) {
                    return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${cType} b) {
    if (b != 0 && a > ${maxValue} / b) {
        fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
        abort();
    }
    return a * b;
}`;
                } else {
                    return `static inline ${cType} cnx_clamp_mul_${cnxType}(${cType} a, ${cType} b) {
    if (a != 0 && b != 0) {
        if ((a > 0 && b > 0 && a > ${maxValue} / b) ||
            (a < 0 && b < 0 && a < ${maxValue} / b) ||
            (a > 0 && b < 0 && b < ${minValue} / a) ||
            (a < 0 && b > 0 && a < ${minValue} / b)) {
            fprintf(stderr, "PANIC: Integer overflow in ${cnxType} ${opName}\\n");
            abort();
        }
    }
    return a * b;
}`;
                }

            default:
                return null;
        }
    }

    /**
     * Mark a clamp operation as used (will trigger helper generation)
     */
    private markClampOpUsed(operation: string, cnxType: string): void {
        // Only generate helpers for integer types (not float/bool)
        if (TYPE_WIDTH[cnxType] && !cnxType.startsWith('f') && cnxType !== 'bool') {
            this.usedClampOps.add(`${operation}_${cnxType}`);
        }
    }

    // ========================================================================
    // Preprocessor Directive Handling (ADR-037)
    // ========================================================================

    /**
     * Process a preprocessor directive
     * - Flag-only defines (#define FLAG): pass through
     * - Value defines (#define FLAG value): ERROR E0502
     * - Function macros (#define NAME(args)): ERROR E0501
     * - Conditional directives: pass through
     */
    private processPreprocessorDirective(ctx: Parser.PreprocessorDirectiveContext): string | null {
        if (ctx.defineDirective()) {
            return this.processDefineDirective(ctx.defineDirective()!);
        }
        if (ctx.conditionalDirective()) {
            return this.processConditionalDirective(ctx.conditionalDirective()!);
        }
        return null;
    }

    /**
     * Process a #define directive
     * Only flag-only defines are allowed; value and function macros produce errors
     */
    private processDefineDirective(ctx: Parser.DefineDirectiveContext): string | null {
        const text = ctx.getText();

        // Check for function-like macro: #define NAME(
        if (ctx.DEFINE_FUNCTION()) {
            const name = this.extractDefineName(text);
            const line = ctx.start?.line ?? 0;
            throw new Error(
                `E0501: Function-like macro '${name}' is not allowed. ` +
                `Use inline functions instead. Line ${line}`
            );
        }

        // Check for value define: #define NAME value
        if (ctx.DEFINE_WITH_VALUE()) {
            const name = this.extractDefineName(text);
            const line = ctx.start?.line ?? 0;
            throw new Error(
                `E0502: #define with value '${name}' is not allowed. ` +
                `Use 'const' instead: const u32 ${name} <- value; Line ${line}`
            );
        }

        // Flag-only define: pass through
        if (ctx.DEFINE_FLAG()) {
            return text.trim();
        }

        return null;
    }

    /**
     * Process a conditional compilation directive (#ifdef, #ifndef, #else, #endif)
     * These are passed through unchanged
     */
    private processConditionalDirective(ctx: Parser.ConditionalDirectiveContext): string {
        return ctx.getText().trim();
    }

    /**
     * Extract the macro name from a #define directive
     */
    private extractDefineName(text: string): string {
        const match = text.match(/#\s*define\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
        return match ? match[1] : 'unknown';
    }

    // ========================================================================
    // Comment Handling (ADR-043)
    // ========================================================================

    /**
     * Get comments that appear before a parse tree node
     */
    private getLeadingComments(ctx: { start?: { tokenIndex: number } | null }): IComment[] {
        if (!this.commentExtractor || !ctx.start) return [];
        return this.commentExtractor.getCommentsBefore(ctx.start.tokenIndex);
    }

    /**
     * Get inline comments that appear after a parse tree node (same line)
     */
    private getTrailingComments(ctx: { stop?: { tokenIndex: number } | null }): IComment[] {
        if (!this.commentExtractor || !ctx.stop) return [];
        return this.commentExtractor.getCommentsAfter(ctx.stop.tokenIndex);
    }

    /**
     * Format leading comments with current indentation
     */
    private formatLeadingComments(comments: IComment[]): string[] {
        if (comments.length === 0) return [];
        const indent = '    '.repeat(this.context.indentLevel);
        return this.commentFormatter.formatLeadingComments(comments, indent);
    }

    /**
     * Format a trailing/inline comment
     */
    private formatTrailingComment(comments: IComment[]): string {
        if (comments.length === 0) return '';
        // Only use the first comment for inline
        return this.commentFormatter.formatTrailingComment(comments[0]);
    }
}
