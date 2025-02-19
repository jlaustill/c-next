"use strict";
// Generated from grammar/cNext.g4 by ANTLR 4.9.0-SNAPSHOT
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
exports.cNextLexer = void 0;
const ATNDeserializer_1 = require("antlr4ts/atn/ATNDeserializer");
const Lexer_1 = require("antlr4ts/Lexer");
const LexerATNSimulator_1 = require("antlr4ts/atn/LexerATNSimulator");
const VocabularyImpl_1 = require("antlr4ts/VocabularyImpl");
const Utils = __importStar(require("antlr4ts/misc/Utils"));
class cNextLexer extends Lexer_1.Lexer {
    // @Override
    // @NotNull
    get vocabulary() {
        return cNextLexer.VOCABULARY;
    }
    // tslint:enable:no-trailing-whitespace
    constructor(input) {
        super(input);
        this._interp = new LexerATNSimulator_1.LexerATNSimulator(cNextLexer._ATN, this);
    }
    // @Override
    get grammarFileName() { return "cNext.g4"; }
    // @Override
    get ruleNames() { return cNextLexer.ruleNames; }
    // @Override
    get serializedATN() { return cNextLexer._serializedATN; }
    // @Override
    get channelNames() { return cNextLexer.channelNames; }
    // @Override
    get modeNames() { return cNextLexer.modeNames; }
    static get _ATN() {
        if (!cNextLexer.__ATN) {
            cNextLexer.__ATN = new ATNDeserializer_1.ATNDeserializer().deserialize(Utils.toCharArray(cNextLexer._serializedATN));
        }
        return cNextLexer.__ATN;
    }
}
exports.cNextLexer = cNextLexer;
cNextLexer.T__0 = 1;
cNextLexer.PUBLIC = 2;
cNextLexer.STATIC = 3;
cNextLexer.CLASS = 4;
cNextLexer.TYPE_INT8 = 5;
cNextLexer.TYPE_INT16 = 6;
cNextLexer.TYPE_INT32 = 7;
cNextLexer.TYPE_INT64 = 8;
cNextLexer.TYPE_STRING = 9;
cNextLexer.ASSIGN = 10;
cNextLexer.SEMI = 11;
cNextLexer.LBRACE = 12;
cNextLexer.RBRACE = 13;
cNextLexer.LPAREN = 14;
cNextLexer.RPAREN = 15;
cNextLexer.COMMA = 16;
cNextLexer.RETURN = 17;
cNextLexer.ID = 18;
cNextLexer.NUMBER = 19;
cNextLexer.STRING = 20;
cNextLexer.WS = 21;
// tslint:disable:no-trailing-whitespace
cNextLexer.channelNames = [
    "DEFAULT_TOKEN_CHANNEL", "HIDDEN",
];
// tslint:disable:no-trailing-whitespace
cNextLexer.modeNames = [
    "DEFAULT_MODE",
];
cNextLexer.ruleNames = [
    "T__0", "PUBLIC", "STATIC", "CLASS", "TYPE_INT8", "TYPE_INT16", "TYPE_INT32",
    "TYPE_INT64", "TYPE_STRING", "ASSIGN", "SEMI", "LBRACE", "RBRACE", "LPAREN",
    "RPAREN", "COMMA", "RETURN", "ID", "NUMBER", "STRING", "WS",
];
cNextLexer._LITERAL_NAMES = [
    undefined, "'void'", "'public'", "'static'", "'class'", "'int8'", "'int16'",
    "'int32'", "'int64'", "'String'", "'<-'", "';'", "'{'", "'}'", "'('",
    "')'", "','", "'return'",
];
cNextLexer._SYMBOLIC_NAMES = [
    undefined, undefined, "PUBLIC", "STATIC", "CLASS", "TYPE_INT8", "TYPE_INT16",
    "TYPE_INT32", "TYPE_INT64", "TYPE_STRING", "ASSIGN", "SEMI", "LBRACE",
    "RBRACE", "LPAREN", "RPAREN", "COMMA", "RETURN", "ID", "NUMBER", "STRING",
    "WS",
];
cNextLexer.VOCABULARY = new VocabularyImpl_1.VocabularyImpl(cNextLexer._LITERAL_NAMES, cNextLexer._SYMBOLIC_NAMES, []);
cNextLexer._serializedATN = "\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x02\x17\x96\b\x01" +
    "\x04\x02\t\x02\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06" +
    "\x04\x07\t\x07\x04\b\t\b\x04\t\t\t\x04\n\t\n\x04\v\t\v\x04\f\t\f\x04\r" +
    "\t\r\x04\x0E\t\x0E\x04\x0F\t\x0F\x04\x10\t\x10\x04\x11\t\x11\x04\x12\t" +
    "\x12\x04\x13\t\x13\x04\x14\t\x14\x04\x15\t\x15\x04\x16\t\x16\x03\x02\x03" +
    "\x02\x03\x02\x03\x02\x03\x02\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03\x03" +
    "\x03\x03\x03\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03" +
    "\x05\x03\x05\x03\x05\x03\x05\x03\x05\x03\x05\x03\x06\x03\x06\x03\x06\x03" +
    "\x06\x03\x06\x03\x07\x03\x07\x03\x07\x03\x07\x03\x07\x03\x07\x03\b\x03" +
    "\b\x03\b\x03\b\x03\b\x03\b\x03\t\x03\t\x03\t\x03\t\x03\t\x03\t\x03\n\x03" +
    "\n\x03\n\x03\n\x03\n\x03\n\x03\n\x03\v\x03\v\x03\v\x03\f\x03\f\x03\r\x03" +
    "\r\x03\x0E\x03\x0E\x03\x0F\x03\x0F\x03\x10\x03\x10\x03\x11\x03\x11\x03" +
    "\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x13\x03\x13\x07" +
    "\x13}\n\x13\f\x13\x0E\x13\x80\v\x13\x03\x14\x06\x14\x83\n\x14\r\x14\x0E" +
    "\x14\x84\x03\x15\x03\x15\x07\x15\x89\n\x15\f\x15\x0E\x15\x8C\v\x15\x03" +
    "\x15\x03\x15\x03\x16\x06\x16\x91\n\x16\r\x16\x0E\x16\x92\x03\x16\x03\x16" +
    "\x03\x8A\x02\x02\x17\x03\x02\x03\x05\x02\x04\x07\x02\x05\t\x02\x06\v\x02" +
    "\x07\r\x02\b\x0F\x02\t\x11\x02\n\x13\x02\v\x15\x02\f\x17\x02\r\x19\x02" +
    "\x0E\x1B\x02\x0F\x1D\x02\x10\x1F\x02\x11!\x02\x12#\x02\x13%\x02\x14\'" +
    "\x02\x15)\x02\x16+\x02\x17\x03\x02\x06\x04\x02C\\c|\x05\x022;C\\c|\x03" +
    "\x022;\x05\x02\v\f\x0F\x0F\"\"\x02\x99\x02\x03\x03\x02\x02\x02\x02\x05" +
    "\x03\x02\x02\x02\x02\x07\x03\x02\x02\x02\x02\t\x03\x02\x02\x02\x02\v\x03" +
    "\x02\x02\x02\x02\r\x03\x02\x02\x02\x02\x0F\x03\x02\x02\x02\x02\x11\x03" +
    "\x02\x02\x02\x02\x13\x03\x02\x02\x02\x02\x15\x03\x02\x02\x02\x02\x17\x03" +
    "\x02\x02\x02\x02\x19\x03\x02\x02\x02\x02\x1B\x03\x02\x02\x02\x02\x1D\x03" +
    "\x02\x02\x02\x02\x1F\x03\x02\x02\x02\x02!\x03\x02\x02\x02\x02#\x03\x02" +
    "\x02\x02\x02%\x03\x02\x02\x02\x02\'\x03\x02\x02\x02\x02)\x03\x02\x02\x02" +
    "\x02+\x03\x02\x02\x02\x03-\x03\x02\x02\x02\x052\x03\x02\x02\x02\x079\x03" +
    "\x02\x02\x02\t@\x03\x02\x02\x02\vF\x03\x02\x02\x02\rK\x03\x02\x02\x02" +
    "\x0FQ\x03\x02\x02\x02\x11W\x03\x02\x02\x02\x13]\x03\x02\x02\x02\x15d\x03" +
    "\x02\x02\x02\x17g\x03\x02\x02\x02\x19i\x03\x02\x02\x02\x1Bk\x03\x02\x02" +
    "\x02\x1Dm\x03\x02\x02\x02\x1Fo\x03\x02\x02\x02!q\x03\x02\x02\x02#s\x03" +
    "\x02\x02\x02%z\x03\x02\x02\x02\'\x82\x03\x02\x02\x02)\x86\x03\x02\x02" +
    "\x02+\x90\x03\x02\x02\x02-.\x07x\x02\x02./\x07q\x02\x02/0\x07k\x02\x02" +
    "01\x07f\x02\x021\x04\x03\x02\x02\x0223\x07r\x02\x0234\x07w\x02\x0245\x07" +
    "d\x02\x0256\x07n\x02\x0267\x07k\x02\x0278\x07e\x02\x028\x06\x03\x02\x02" +
    "\x029:\x07u\x02\x02:;\x07v\x02\x02;<\x07c\x02\x02<=\x07v\x02\x02=>\x07" +
    "k\x02\x02>?\x07e\x02\x02?\b\x03\x02\x02\x02@A\x07e\x02\x02AB\x07n\x02" +
    "\x02BC\x07c\x02\x02CD\x07u\x02\x02DE\x07u\x02\x02E\n\x03\x02\x02\x02F" +
    "G\x07k\x02\x02GH\x07p\x02\x02HI\x07v\x02\x02IJ\x07:\x02\x02J\f\x03\x02" +
    "\x02\x02KL\x07k\x02\x02LM\x07p\x02\x02MN\x07v\x02\x02NO\x073\x02\x02O" +
    "P\x078\x02\x02P\x0E\x03\x02\x02\x02QR\x07k\x02\x02RS\x07p\x02\x02ST\x07" +
    "v\x02\x02TU\x075\x02\x02UV\x074\x02\x02V\x10\x03\x02\x02\x02WX\x07k\x02" +
    "\x02XY\x07p\x02\x02YZ\x07v\x02\x02Z[\x078\x02\x02[\\\x076\x02\x02\\\x12" +
    "\x03\x02\x02\x02]^\x07U\x02\x02^_\x07v\x02\x02_`\x07t\x02\x02`a\x07k\x02" +
    "\x02ab\x07p\x02\x02bc\x07i\x02\x02c\x14\x03\x02\x02\x02de\x07>\x02\x02" +
    "ef\x07/\x02\x02f\x16\x03\x02\x02\x02gh\x07=\x02\x02h\x18\x03\x02\x02\x02" +
    "ij\x07}\x02\x02j\x1A\x03\x02\x02\x02kl\x07\x7F\x02\x02l\x1C\x03\x02\x02" +
    "\x02mn\x07*\x02\x02n\x1E\x03\x02\x02\x02op\x07+\x02\x02p \x03\x02\x02" +
    "\x02qr\x07.\x02\x02r\"\x03\x02\x02\x02st\x07t\x02\x02tu\x07g\x02\x02u" +
    "v\x07v\x02\x02vw\x07w\x02\x02wx\x07t\x02\x02xy\x07p\x02\x02y$\x03\x02" +
    "\x02\x02z~\t\x02\x02\x02{}\t\x03\x02\x02|{\x03\x02\x02\x02}\x80\x03\x02" +
    "\x02\x02~|\x03\x02\x02\x02~\x7F\x03\x02\x02\x02\x7F&\x03\x02\x02\x02\x80" +
    "~\x03\x02\x02\x02\x81\x83\t\x04\x02\x02\x82\x81\x03\x02\x02\x02\x83\x84" +
    "\x03\x02\x02\x02\x84\x82\x03\x02\x02\x02\x84\x85\x03\x02\x02\x02\x85(" +
    "\x03\x02\x02\x02\x86\x8A\x07b\x02\x02\x87\x89\v\x02\x02\x02\x88\x87\x03" +
    "\x02\x02\x02\x89\x8C\x03\x02\x02\x02\x8A\x8B\x03\x02\x02\x02\x8A\x88\x03" +
    "\x02\x02\x02\x8B\x8D\x03\x02\x02\x02\x8C\x8A\x03\x02\x02\x02\x8D\x8E\x07" +
    "b\x02\x02\x8E*\x03\x02\x02\x02\x8F\x91\t\x05\x02\x02\x90\x8F\x03\x02\x02" +
    "\x02\x91\x92\x03\x02\x02\x02\x92\x90\x03\x02\x02\x02\x92\x93\x03\x02\x02" +
    "\x02\x93\x94\x03\x02\x02\x02\x94\x95\b\x16\x02\x02\x95,\x03\x02\x02\x02" +
    "\x07\x02~\x84\x8A\x92\x03\b\x02\x02";
