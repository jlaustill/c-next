"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// src/test.ts
const antlr4ts_1 = require("antlr4ts");
const cNextLexer_1 = require("./parser/cNextLexer");
const cNextParser_1 = require("./parser/cNextParser");
const CGenerationVisitor_1 = require("./visitors/CGenerationVisitor");
const fs = __importStar(require("fs"));
function testParser() {
    // Read our test file
    const input = fs.readFileSync('../test-files/Math.cn', 'utf8');
    console.log('Input file contents:');
    console.log(input);
    console.log('-------------------');
    // Create the lexer and parser
    const inputStream = antlr4ts_1.CharStreams.fromString(input);
    const lexer = new cNextLexer_1.cNextLexer(inputStream);
    const tokenStream = new antlr4ts_1.CommonTokenStream(lexer);
    const parser = new cNextParser_1.cNextParser(tokenStream);
    // Parse the input
    const tree = parser.sourceFile();
    console.log('Successfully parsed file!');
    console.log('Parse tree:');
    console.log(tree.toStringTree(parser));
    // Generate C code
    const visitor = new CGenerationVisitor_1.CGenerationVisitor('./output');
    visitor.visit(tree);
}
testParser();
