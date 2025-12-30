/**
 * C-Next Code Generator
 * Transforms C-Next AST to clean, readable C code
 */

import * as Parser from '../parser/grammar/CNextParser.js';
import SymbolTable from '../symbols/SymbolTable.js';
import ESourceLanguage from '../types/ESourceLanguage.js';
import ESymbolKind from '../types/ESymbolKind.js';

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
 * Context for tracking current scope during code generation
 */
interface GeneratorContext {
    currentScope: string | null;  // ADR-016: renamed from currentNamespace
    indentLevel: number;
    scopeMembers: Map<string, Set<string>>; // scope -> member names (ADR-016)
    currentParameters: Map<string, ParameterInfo>; // ADR-006: track params for pointer semantics
    localArrays: Set<string>; // ADR-006: track local array variables (no & needed)
    typeRegistry: Map<string, TypeInfo>; // Track variable types for bit access and .length
    expectedType: string | null; // For inferred struct initializers
}

/**
 * Code Generator - Transpiles C-Next to C
 */
export default class CodeGenerator {
    private context: GeneratorContext = {
        currentScope: null,  // ADR-016: renamed from currentNamespace
        indentLevel: 0,
        scopeMembers: new Map(),  // ADR-016: renamed from namespaceMembers
        currentParameters: new Map(),
        localArrays: new Set(),
        typeRegistry: new Map(),
        expectedType: null,
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

    /** External symbol table for cross-language interop */
    private symbolTable: SymbolTable | null = null;

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
     */
    generate(tree: Parser.ProgramContext, symbolTable?: SymbolTable): string {
        // Store symbol table for function lookup
        this.symbolTable = symbolTable ?? null;

        // Reset state
        this.context = {
            currentScope: null,  // ADR-016
            indentLevel: 0,
            scopeMembers: new Map(),  // ADR-016
            currentParameters: new Map(),
            localArrays: new Set(),
            typeRegistry: new Map(),
            expectedType: null,
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
        for (const includeDir of tree.includeDirective()) {
            output.push(includeDir.getText());
        }

        // Add blank line after includes if there were any
        if (tree.includeDirective().length > 0) {
            output.push('');
        }

        // Visit all declarations
        for (const decl of tree.declaration()) {
            const code = this.generateDeclaration(decl);
            if (code) {
                output.push(code);
            }
        }

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

        let baseType = '';
        let bitWidth = 0;
        let isArray = false;
        let arrayLength: number | undefined;

        if (typeCtx.primitiveType()) {
            baseType = typeCtx.primitiveType()!.getText();
            bitWidth = TYPE_WIDTH[baseType] || 0;
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

        let baseType = '';
        let bitWidth = 0;
        let isArray = false;
        let arrayLength: number | undefined;

        if (typeCtx.primitiveType()) {
            baseType = typeCtx.primitiveType()!.getText();
            bitWidth = TYPE_WIDTH[baseType] || 0;
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
            if (typeCtx.userType()) {
                const typeName = typeCtx.userType()!.getText();
                isStruct = this.isStructType(typeName);
            }

            this.context.currentParameters.set(name, { name, isArray, isStruct, isConst });
        }
    }

    /**
     * Clear parameter tracking when leaving a function
     */
    private clearParameters(): void {
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
     * ADR-017: Extract enum type from an expression.
     * Returns the enum type name if the expression is an enum value, null otherwise.
     *
     * Handles:
     * - Variable of enum type: `currentState` -> 'State'
     * - Enum member access: `State.IDLE` -> 'State'
     * - Scoped enum member: `Motor.State.IDLE` -> 'Motor_State'
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
        const or = ctx.orExpression();
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

                const params = funcDecl.parameterList()
                    ? this.generateParameterList(funcDecl.parameterList()!)
                    : 'void';

                const body = this.generateBlock(funcDecl.block());
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

        const params = ctx.parameterList()
            ? this.generateParameterList(ctx.parameterList()!)
            : 'void';
        const body = this.generateBlock(ctx.block());

        this.clearParameters();

        return `${returnType} ${name}(${params}) ${body}\n`;
    }

    private generateParameterList(ctx: Parser.ParameterListContext): string {
        return ctx.parameter().map(p => this.generateParameter(p)).join(', ');
    }

    private generateParameter(ctx: Parser.ParameterContext): string {
        const constMod = ctx.constModifier() ? 'const ' : '';
        const type = this.generateType(ctx.type());
        const name = ctx.IDENTIFIER().getText();

        // Arrays pass naturally as pointers
        if (ctx.arrayDimension()) {
            const dim = this.generateArrayDimension(ctx.arrayDimension()!);
            return `${constMod}${type} ${name}${dim}`;
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
                    // Allow if it's an enum member access of the correct type
                    if (!exprText.startsWith(typeName + '.')) {
                        // Check for scoped enum
                        const parts = exprText.split('.');
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
        if (targetCtx.IDENTIFIER() && !targetCtx.memberAccess() && !targetCtx.arrayAccess()) {
            const id = targetCtx.IDENTIFIER()!.getText();
            const typeInfo = this.context.typeRegistry.get(id);
            if (typeInfo) {
                this.context.expectedType = typeInfo.baseType;
            }
        }

        const value = this.generateExpression(ctx.expression());

        // Restore expected type
        this.context.expectedType = savedExpectedType;

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
                    // Allow if it's an enum member access of the correct type
                    if (!exprText.startsWith(targetEnumType + '.')) {
                        // Not a direct enum member access - check if it's scoped enum
                        const parts = exprText.split('.');
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
        return `${target} ${cOp} ${value};`;
    }

    private generateAssignmentTarget(ctx: Parser.AssignmentTargetContext): string {
        if (ctx.memberAccess()) {
            return this.generateMemberAccess(ctx.memberAccess()!);
        }
        if (ctx.arrayAccess()) {
            return this.generateArrayAccess(ctx.arrayAccess()!);
        }

        const id = ctx.IDENTIFIER()!.getText();

        // If inside a scope, check if this identifier is a scope member (ADR-016)
        if (this.context.currentScope) {
            const members = this.context.scopeMembers.get(this.context.currentScope);
            if (members && members.has(id)) {
                return `${this.context.currentScope}_${id}`;
            }
        }

        // ADR-006: Dereference parameter when writing to it
        // (non-array parameters are passed as pointers)
        const paramInfo = this.context.currentParameters.get(id);
        if (paramInfo && !paramInfo.isArray) {
            return `(*${id})`;
        }

        return id;
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
    // Expressions
    // ========================================================================

    private generateExpression(ctx: Parser.ExpressionContext): string {
        return this.generateOrExpr(ctx.orExpression());
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

        for (let i = 0; i < ops.length; i++) {
            const op = ops[i];

            // Member access
            if (op.IDENTIFIER()) {
                const memberName = op.IDENTIFIER()!.getText();

                // Handle .length property for arrays and integers
                if (memberName === 'length') {
                    const typeInfo = primaryId ? this.context.typeRegistry.get(primaryId) : undefined;
                    if (typeInfo) {
                        if (typeInfo.isArray && typeInfo.arrayLength !== undefined) {
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

                    // Registers are always integers, so treat subscript as bit access
                    const isRegisterAccess = primaryId ? this.knownRegisters.has(primaryId) : false;

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
        if (ctx.IDENTIFIER()) {
            const id = ctx.IDENTIFIER()!.getText();

            // If inside a scope, check if this identifier is a scope member (ADR-016)
            if (this.context.currentScope) {
                const members = this.context.scopeMembers.get(this.context.currentScope);
                if (members && members.has(id)) {
                    return `${this.context.currentScope}_${id}`;
                }
            }

            // ADR-006: Dereference parameter when reading its value
            // (non-array parameters are passed as pointers)
            // Note: Struct parameters use -> for member access, handled in generatePostfixExpr
            const paramInfo = this.context.currentParameters.get(id);
            if (paramInfo && !paramInfo.isArray && !paramInfo.isStruct) {
                return `(*${id})`;
            }
            // For struct parameters, return as-is here (will use -> in member access)
            // or dereference if used as a whole value
            if (paramInfo && paramInfo.isStruct) {
                return id; // Will be handled by postfix context
            }

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
        const expr = this.generateUnaryExpr(ctx.unaryExpression());

        // Validate enum casts are only to unsigned types
        const targetTypeName = ctx.type().getText();
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
            return TYPE_MAP[type] || type;
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
}
