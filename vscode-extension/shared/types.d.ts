/**
 * Shared types between client and server
 */
export interface CNextSymbol {
    name: string;
    kind: CNextSymbolKind;
    type?: string;
    range: {
        start: {
            line: number;
            character: number;
        };
        end: {
            line: number;
            character: number;
        };
    };
    containerName?: string;
    detail?: string;
    documentation?: string;
}
export declare enum CNextSymbolKind {
    Class = "class",
    Function = "function",
    Variable = "variable",
    Constant = "constant",
    Property = "property",
    Method = "method",
    Parameter = "parameter",
    Import = "import",
    Include = "include"
}
export interface CNextDiagnostic {
    message: string;
    severity: 'error' | 'warning' | 'info' | 'hint';
    range: {
        start: {
            line: number;
            character: number;
        };
        end: {
            line: number;
            character: number;
        };
    };
    source: 'cnext';
    code?: string | number;
}
export interface CNextCompletionItem {
    label: string;
    kind: CNextCompletionKind;
    detail?: string;
    documentation?: string;
    insertText?: string;
    sortText?: string;
}
export declare enum CNextCompletionKind {
    Text = 1,
    Method = 2,
    Function = 3,
    Constructor = 4,
    Field = 5,
    Variable = 6,
    Class = 7,
    Interface = 8,
    Module = 9,
    Property = 10,
    Unit = 11,
    Value = 12,
    Enum = 13,
    Keyword = 14,
    Snippet = 15,
    Color = 16,
    File = 17,
    Reference = 18,
    Folder = 19,
    EnumMember = 20,
    Constant = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25
}
//# sourceMappingURL=types.d.ts.map