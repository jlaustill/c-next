"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Types of symbols that can be collected from source files
 */
var ESymbolKind;
(function (ESymbolKind) {
  ESymbolKind["Function"] = "function";
  ESymbolKind["Variable"] = "variable";
  ESymbolKind["Type"] = "type";
  ESymbolKind["Macro"] = "macro";
  ESymbolKind["Namespace"] = "namespace";
  ESymbolKind["Class"] = "class";
  ESymbolKind["Struct"] = "struct";
  ESymbolKind["Enum"] = "enum";
  ESymbolKind["EnumMember"] = "enum_member";
  ESymbolKind["Bitmap"] = "bitmap";
  ESymbolKind["BitmapField"] = "bitmap_field";
  ESymbolKind["Register"] = "register";
  ESymbolKind["RegisterMember"] = "register_member";
})(ESymbolKind || (ESymbolKind = {}));
exports.default = ESymbolKind;
