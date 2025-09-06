"use strict";
/**
 * Shared types between client and server
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CNextCompletionKind = exports.CNextSymbolKind = void 0;
var CNextSymbolKind;
(function (CNextSymbolKind) {
    CNextSymbolKind["Class"] = "class";
    CNextSymbolKind["Function"] = "function";
    CNextSymbolKind["Variable"] = "variable";
    CNextSymbolKind["Constant"] = "constant";
    CNextSymbolKind["Property"] = "property";
    CNextSymbolKind["Method"] = "method";
    CNextSymbolKind["Parameter"] = "parameter";
    CNextSymbolKind["Import"] = "import";
    CNextSymbolKind["Include"] = "include";
})(CNextSymbolKind || (exports.CNextSymbolKind = CNextSymbolKind = {}));
var CNextCompletionKind;
(function (CNextCompletionKind) {
    CNextCompletionKind[CNextCompletionKind["Text"] = 1] = "Text";
    CNextCompletionKind[CNextCompletionKind["Method"] = 2] = "Method";
    CNextCompletionKind[CNextCompletionKind["Function"] = 3] = "Function";
    CNextCompletionKind[CNextCompletionKind["Constructor"] = 4] = "Constructor";
    CNextCompletionKind[CNextCompletionKind["Field"] = 5] = "Field";
    CNextCompletionKind[CNextCompletionKind["Variable"] = 6] = "Variable";
    CNextCompletionKind[CNextCompletionKind["Class"] = 7] = "Class";
    CNextCompletionKind[CNextCompletionKind["Interface"] = 8] = "Interface";
    CNextCompletionKind[CNextCompletionKind["Module"] = 9] = "Module";
    CNextCompletionKind[CNextCompletionKind["Property"] = 10] = "Property";
    CNextCompletionKind[CNextCompletionKind["Unit"] = 11] = "Unit";
    CNextCompletionKind[CNextCompletionKind["Value"] = 12] = "Value";
    CNextCompletionKind[CNextCompletionKind["Enum"] = 13] = "Enum";
    CNextCompletionKind[CNextCompletionKind["Keyword"] = 14] = "Keyword";
    CNextCompletionKind[CNextCompletionKind["Snippet"] = 15] = "Snippet";
    CNextCompletionKind[CNextCompletionKind["Color"] = 16] = "Color";
    CNextCompletionKind[CNextCompletionKind["File"] = 17] = "File";
    CNextCompletionKind[CNextCompletionKind["Reference"] = 18] = "Reference";
    CNextCompletionKind[CNextCompletionKind["Folder"] = 19] = "Folder";
    CNextCompletionKind[CNextCompletionKind["EnumMember"] = 20] = "EnumMember";
    CNextCompletionKind[CNextCompletionKind["Constant"] = 21] = "Constant";
    CNextCompletionKind[CNextCompletionKind["Struct"] = 22] = "Struct";
    CNextCompletionKind[CNextCompletionKind["Event"] = 23] = "Event";
    CNextCompletionKind[CNextCompletionKind["Operator"] = 24] = "Operator";
    CNextCompletionKind[CNextCompletionKind["TypeParameter"] = 25] = "TypeParameter";
})(CNextCompletionKind || (exports.CNextCompletionKind = CNextCompletionKind = {}));
//# sourceMappingURL=types.js.map