/**
 * Unified Symbol Table
 * Stores symbols from all source languages and detects conflicts
 */

import ISymbol from '../types/ISymbol.js';
import ESourceLanguage from '../types/ESourceLanguage.js';
import IConflict from './types/IConflict.js';

/**
 * Central symbol table for cross-language interoperability
 *
 * Per user requirement: Symbol conflicts between C-Next and C/C++ are ERRORS.
 * - ERROR: Same symbol defined in C-Next and C/C++
 * - OK: Multiple `extern` declarations in C (declaration, not definition)
 * - OK: Function overloads in C++ (different signatures)
 */
class SymbolTable {
    /** All symbols indexed by name */
    private symbols: Map<string, ISymbol[]> = new Map();

    /** Symbols indexed by source file */
    private byFile: Map<string, ISymbol[]> = new Map();

    /**
     * Add a symbol to the table
     */
    addSymbol(symbol: ISymbol): void {
        // Add to name index
        const existing = this.symbols.get(symbol.name);
        if (existing) {
            existing.push(symbol);
        } else {
            this.symbols.set(symbol.name, [symbol]);
        }

        // Add to file index
        const fileSymbols = this.byFile.get(symbol.sourceFile);
        if (fileSymbols) {
            fileSymbols.push(symbol);
        } else {
            this.byFile.set(symbol.sourceFile, [symbol]);
        }
    }

    /**
     * Add multiple symbols at once
     */
    addSymbols(symbols: ISymbol[]): void {
        for (const symbol of symbols) {
            this.addSymbol(symbol);
        }
    }

    /**
     * Get a symbol by name (returns first match, or undefined)
     */
    getSymbol(name: string): ISymbol | undefined {
        const symbols = this.symbols.get(name);
        return symbols?.[0];
    }

    /**
     * Get all symbols with a given name (for overload detection)
     */
    getOverloads(name: string): ISymbol[] {
        return this.symbols.get(name) ?? [];
    }

    /**
     * Check if a symbol exists
     */
    hasSymbol(name: string): boolean {
        return this.symbols.has(name);
    }

    /**
     * Check if a symbol has conflicts
     */
    hasConflict(name: string): boolean {
        const symbols = this.symbols.get(name);
        if (!symbols || symbols.length <= 1) {
            return false;
        }

        return this.detectConflict(symbols) !== null;
    }

    /**
     * Get all conflicts in the symbol table
     * Per user requirement: Strict errors for cross-language conflicts
     */
    getConflicts(): IConflict[] {
        const conflicts: IConflict[] = [];

        for (const [name, symbols] of this.symbols) {
            if (symbols.length <= 1) continue;

            const conflict = this.detectConflict(symbols);
            if (conflict) {
                conflicts.push(conflict);
            }
        }

        return conflicts;
    }

    /**
     * Get symbols by source file
     */
    getSymbolsByFile(file: string): ISymbol[] {
        return this.byFile.get(file) ?? [];
    }

    /**
     * Get symbols by source language
     */
    getSymbolsByLanguage(lang: ESourceLanguage): ISymbol[] {
        const result: ISymbol[] = [];
        for (const symbols of this.symbols.values()) {
            for (const symbol of symbols) {
                if (symbol.sourceLanguage === lang) {
                    result.push(symbol);
                }
            }
        }
        return result;
    }

    /**
     * Get all symbols
     */
    getAllSymbols(): ISymbol[] {
        const result: ISymbol[] = [];
        for (const symbols of this.symbols.values()) {
            result.push(...symbols);
        }
        return result;
    }

    /**
     * Clear all symbols
     */
    clear(): void {
        this.symbols.clear();
        this.byFile.clear();
    }

    /**
     * Get symbol count
     */
    get size(): number {
        let count = 0;
        for (const symbols of this.symbols.values()) {
            count += symbols.length;
        }
        return count;
    }

    /**
     * Detect if a set of symbols with the same name represents a conflict
     */
    private detectConflict(symbols: ISymbol[]): IConflict | null {
        // Filter out pure declarations (extern in C) - they don't count as definitions
        const definitions = symbols.filter(s => !s.isDeclaration);

        if (definitions.length <= 1) {
            // 0 or 1 definitions = no conflict
            return null;
        }

        // Check for C++ function overloads (different signatures are OK)
        const cppFunctions = definitions.filter(
            s => s.sourceLanguage === ESourceLanguage.Cpp && s.signature
        );
        if (cppFunctions.length === definitions.length) {
            // All are C++ functions with signatures
            const uniqueSignatures = new Set(cppFunctions.map(s => s.signature));
            if (uniqueSignatures.size === cppFunctions.length) {
                // All signatures are unique = valid overload, no conflict
                return null;
            }
        }

        // Check for cross-language conflict (C-Next vs C or C++)
        const cnextDefs = definitions.filter(s => s.sourceLanguage === ESourceLanguage.CNext);
        const cDefs = definitions.filter(s => s.sourceLanguage === ESourceLanguage.C);
        const cppDefs = definitions.filter(s => s.sourceLanguage === ESourceLanguage.Cpp);

        if (cnextDefs.length > 0 && (cDefs.length > 0 || cppDefs.length > 0)) {
            // C-Next + C/C++ conflict = ERROR
            const locations = definitions.map(
                s => `${s.sourceLanguage.toUpperCase()} (${s.sourceFile}:${s.sourceLine})`
            );

            return {
                symbolName: definitions[0].name,
                definitions,
                severity: 'error',
                message: `Symbol conflict: '${definitions[0].name}' is defined in multiple languages:\n  ${locations.join('\n  ')}\nRename the C-Next symbol to resolve.`,
            };
        }

        // Multiple definitions in same language (excluding overloads) = ERROR
        if (cnextDefs.length > 1) {
            const locations = cnextDefs.map(s => `${s.sourceFile}:${s.sourceLine}`);
            return {
                symbolName: definitions[0].name,
                definitions: cnextDefs,
                severity: 'error',
                message: `Symbol conflict: '${definitions[0].name}' is defined multiple times in C-Next:\n  ${locations.join('\n  ')}`,
            };
        }

        // Same symbol in C and C++ - typically OK (same symbol)
        // But if they have different types, might be a warning
        if (cDefs.length > 0 && cppDefs.length > 0) {
            // For now, allow C/C++ to share symbols (common pattern)
            return null;
        }

        return null;
    }
}

export default SymbolTable;
