"use strict";
// Generated from cNext.g4 by ANTLR 4.9.0-SNAPSHOT
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
exports.ParenExprContext = exports.DivExprContext = exports.MultExprContext = exports.SubExprContext = exports.AddExprContext = exports.ValueExprContext = exports.ExpressionContext = exports.ArgumentListContext = exports.MethodCallContext = exports.FunctionCallContext = exports.ValueContext = exports.Type_specifierContext = exports.StatementContext = exports.DeclarationContext = exports.ReturnTypeContext = exports.ParameterContext = exports.ParameterListContext = exports.FunctionDeclarationContext = exports.ClassFunctionContext = exports.RegularMemberContext = exports.StaticMemberContext = exports.ClassMembersContext = exports.ClassDeclarationContext = exports.IncludeDirectiveContext = exports.ImportDirectiveContext = exports.FileDirectiveContext = exports.GlobalDeclarationContext = exports.MainSourceFileContext = exports.SourceFileContext = exports.cNextParser = void 0;
const ATN_1 = require("antlr4ts/atn/ATN");
const ATNDeserializer_1 = require("antlr4ts/atn/ATNDeserializer");
const FailedPredicateException_1 = require("antlr4ts/FailedPredicateException");
const NoViableAltException_1 = require("antlr4ts/NoViableAltException");
const Parser_1 = require("antlr4ts/Parser");
const ParserRuleContext_1 = require("antlr4ts/ParserRuleContext");
const ParserATNSimulator_1 = require("antlr4ts/atn/ParserATNSimulator");
const RecognitionException_1 = require("antlr4ts/RecognitionException");
const Token_1 = require("antlr4ts/Token");
const VocabularyImpl_1 = require("antlr4ts/VocabularyImpl");
const Utils = __importStar(require("antlr4ts/misc/Utils"));
class cNextParser extends Parser_1.Parser {
    // @Override
    // @NotNull
    get vocabulary() {
        return cNextParser.VOCABULARY;
    }
    // tslint:enable:no-trailing-whitespace
    // @Override
    get grammarFileName() { return "cNext.g4"; }
    // @Override
    get ruleNames() { return cNextParser.ruleNames; }
    // @Override
    get serializedATN() { return cNextParser._serializedATN; }
    createFailedPredicateException(predicate, message) {
        return new FailedPredicateException_1.FailedPredicateException(this, predicate, message);
    }
    constructor(input) {
        super(input);
        this._interp = new ParserATNSimulator_1.ParserATNSimulator(cNextParser._ATN, this);
    }
    // @RuleVersion(0)
    sourceFile() {
        let _localctx = new SourceFileContext(this._ctx, this.state);
        this.enterRule(_localctx, 0, cNextParser.RULE_sourceFile);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 49;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === cNextParser.IMPORT || _la === cNextParser.INCLUDE) {
                    {
                        {
                            this.state = 46;
                            this.fileDirective();
                        }
                    }
                    this.state = 51;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 52;
                this.classDeclaration();
                this.state = 53;
                this.match(cNextParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    mainSourceFile() {
        let _localctx = new MainSourceFileContext(this._ctx, this.state);
        this.enterRule(_localctx, 2, cNextParser.RULE_mainSourceFile);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 58;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === cNextParser.IMPORT || _la === cNextParser.INCLUDE) {
                    {
                        {
                            this.state = 55;
                            this.fileDirective();
                        }
                    }
                    this.state = 60;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 66;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.T__0) | (1 << cNextParser.STATIC) | (1 << cNextParser.CLASS) | (1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_UINT8) | (1 << cNextParser.TYPE_UINT16) | (1 << cNextParser.TYPE_UINT32) | (1 << cNextParser.TYPE_UINT64) | (1 << cNextParser.TYPE_FLOAT32) | (1 << cNextParser.TYPE_FLOAT64) | (1 << cNextParser.TYPE_FLOAT96) | (1 << cNextParser.TYPE_STRING) | (1 << cNextParser.TYPE_BOOLEAN))) !== 0) || _la === cNextParser.ID || _la === cNextParser.DOC_COMMENT) {
                    {
                        this.state = 64;
                        this._errHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this._input, 2, this._ctx)) {
                            case 1:
                                {
                                    this.state = 61;
                                    this.globalDeclaration();
                                }
                                break;
                            case 2:
                                {
                                    this.state = 62;
                                    this.functionDeclaration();
                                }
                                break;
                            case 3:
                                {
                                    this.state = 63;
                                    this.classDeclaration();
                                }
                                break;
                        }
                    }
                    this.state = 68;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 69;
                this.match(cNextParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    globalDeclaration() {
        let _localctx = new GlobalDeclarationContext(this._ctx, this.state);
        this.enterRule(_localctx, 4, cNextParser.RULE_globalDeclaration);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 71;
                this.match(cNextParser.ID);
                this.state = 72;
                this.match(cNextParser.ID);
                this.state = 73;
                this.match(cNextParser.SEMI);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    fileDirective() {
        let _localctx = new FileDirectiveContext(this._ctx, this.state);
        this.enterRule(_localctx, 6, cNextParser.RULE_fileDirective);
        try {
            this.state = 77;
            this._errHandler.sync(this);
            switch (this._input.LA(1)) {
                case cNextParser.IMPORT:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 75;
                        this.importDirective();
                    }
                    break;
                case cNextParser.INCLUDE:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 76;
                        this.includeDirective();
                    }
                    break;
                default:
                    throw new NoViableAltException_1.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    importDirective() {
        let _localctx = new ImportDirectiveContext(this._ctx, this.state);
        this.enterRule(_localctx, 8, cNextParser.RULE_importDirective);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 79;
                this.match(cNextParser.IMPORT);
                this.state = 80;
                this.match(cNextParser.STRING);
                this.state = 81;
                this.match(cNextParser.SEMI);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    includeDirective() {
        let _localctx = new IncludeDirectiveContext(this._ctx, this.state);
        this.enterRule(_localctx, 10, cNextParser.RULE_includeDirective);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 83;
                this.match(cNextParser.INCLUDE);
                this.state = 84;
                this.match(cNextParser.STRING);
                this.state = 85;
                this.match(cNextParser.SEMI);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    classDeclaration() {
        let _localctx = new ClassDeclarationContext(this._ctx, this.state);
        this.enterRule(_localctx, 12, cNextParser.RULE_classDeclaration);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 90;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === cNextParser.DOC_COMMENT) {
                    {
                        {
                            this.state = 87;
                            this.match(cNextParser.DOC_COMMENT);
                        }
                    }
                    this.state = 92;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 94;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (_la === cNextParser.STATIC) {
                    {
                        this.state = 93;
                        this.match(cNextParser.STATIC);
                    }
                }
                this.state = 96;
                this.match(cNextParser.CLASS);
                this.state = 97;
                this.match(cNextParser.ID);
                this.state = 98;
                this.match(cNextParser.LBRACE);
                this.state = 99;
                this.classMembers();
                this.state = 100;
                this.match(cNextParser.RBRACE);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    classMembers() {
        let _localctx = new ClassMembersContext(this._ctx, this.state);
        this.enterRule(_localctx, 14, cNextParser.RULE_classMembers);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 106;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.T__0) | (1 << cNextParser.PUBLIC) | (1 << cNextParser.STATIC) | (1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_UINT8) | (1 << cNextParser.TYPE_UINT16) | (1 << cNextParser.TYPE_UINT32) | (1 << cNextParser.TYPE_UINT64) | (1 << cNextParser.TYPE_FLOAT32) | (1 << cNextParser.TYPE_FLOAT64) | (1 << cNextParser.TYPE_FLOAT96) | (1 << cNextParser.TYPE_STRING) | (1 << cNextParser.TYPE_BOOLEAN))) !== 0) || _la === cNextParser.DOC_COMMENT) {
                    {
                        this.state = 104;
                        this._errHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this._input, 7, this._ctx)) {
                            case 1:
                                {
                                    this.state = 102;
                                    this.staticMember();
                                }
                                break;
                            case 2:
                                {
                                    this.state = 103;
                                    this.regularMember();
                                }
                                break;
                        }
                    }
                    this.state = 108;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    staticMember() {
        let _localctx = new StaticMemberContext(this._ctx, this.state);
        this.enterRule(_localctx, 16, cNextParser.RULE_staticMember);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 112;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === cNextParser.DOC_COMMENT) {
                    {
                        {
                            this.state = 109;
                            this.match(cNextParser.DOC_COMMENT);
                        }
                    }
                    this.state = 114;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 115;
                this.match(cNextParser.STATIC);
                this.state = 116;
                this.declaration();
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    regularMember() {
        let _localctx = new RegularMemberContext(this._ctx, this.state);
        this.enterRule(_localctx, 18, cNextParser.RULE_regularMember);
        let _la;
        try {
            this.state = 132;
            this._errHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this._input, 12, this._ctx)) {
                case 1:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 121;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        while (_la === cNextParser.DOC_COMMENT) {
                            {
                                {
                                    this.state = 118;
                                    this.match(cNextParser.DOC_COMMENT);
                                }
                            }
                            this.state = 123;
                            this._errHandler.sync(this);
                            _la = this._input.LA(1);
                        }
                        this.state = 124;
                        this.declaration();
                    }
                    break;
                case 2:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 128;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        while (_la === cNextParser.DOC_COMMENT) {
                            {
                                {
                                    this.state = 125;
                                    this.match(cNextParser.DOC_COMMENT);
                                }
                            }
                            this.state = 130;
                            this._errHandler.sync(this);
                            _la = this._input.LA(1);
                        }
                        this.state = 131;
                        this.classFunction();
                    }
                    break;
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    classFunction() {
        let _localctx = new ClassFunctionContext(this._ctx, this.state);
        this.enterRule(_localctx, 20, cNextParser.RULE_classFunction);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 135;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (_la === cNextParser.PUBLIC) {
                    {
                        this.state = 134;
                        this.match(cNextParser.PUBLIC);
                    }
                }
                this.state = 137;
                this.returnType();
                this.state = 138;
                this.match(cNextParser.ID);
                this.state = 139;
                this.match(cNextParser.LPAREN);
                this.state = 141;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_UINT8) | (1 << cNextParser.TYPE_UINT16) | (1 << cNextParser.TYPE_UINT32) | (1 << cNextParser.TYPE_UINT64) | (1 << cNextParser.TYPE_FLOAT32) | (1 << cNextParser.TYPE_FLOAT64) | (1 << cNextParser.TYPE_FLOAT96) | (1 << cNextParser.TYPE_STRING) | (1 << cNextParser.TYPE_BOOLEAN))) !== 0)) {
                    {
                        this.state = 140;
                        this.parameterList();
                    }
                }
                this.state = 143;
                this.match(cNextParser.RPAREN);
                this.state = 144;
                this.match(cNextParser.LBRACE);
                this.state = 148;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & ((1 << (cNextParser.TYPE_INT8 - 7)) | (1 << (cNextParser.TYPE_INT16 - 7)) | (1 << (cNextParser.TYPE_INT32 - 7)) | (1 << (cNextParser.TYPE_INT64 - 7)) | (1 << (cNextParser.TYPE_UINT8 - 7)) | (1 << (cNextParser.TYPE_UINT16 - 7)) | (1 << (cNextParser.TYPE_UINT32 - 7)) | (1 << (cNextParser.TYPE_UINT64 - 7)) | (1 << (cNextParser.TYPE_FLOAT32 - 7)) | (1 << (cNextParser.TYPE_FLOAT64 - 7)) | (1 << (cNextParser.TYPE_FLOAT96 - 7)) | (1 << (cNextParser.TYPE_STRING - 7)) | (1 << (cNextParser.TYPE_BOOLEAN - 7)) | (1 << (cNextParser.LPAREN - 7)) | (1 << (cNextParser.RETURN - 7)) | (1 << (cNextParser.ID - 7)) | (1 << (cNextParser.NUMBER - 7)) | (1 << (cNextParser.STRING - 7)))) !== 0)) {
                    {
                        {
                            this.state = 145;
                            this.statement();
                        }
                    }
                    this.state = 150;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 151;
                this.match(cNextParser.RBRACE);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    functionDeclaration() {
        let _localctx = new FunctionDeclarationContext(this._ctx, this.state);
        this.enterRule(_localctx, 22, cNextParser.RULE_functionDeclaration);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 156;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === cNextParser.DOC_COMMENT) {
                    {
                        {
                            this.state = 153;
                            this.match(cNextParser.DOC_COMMENT);
                        }
                    }
                    this.state = 158;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 159;
                this.returnType();
                this.state = 160;
                this.match(cNextParser.ID);
                this.state = 161;
                this.match(cNextParser.LPAREN);
                this.state = 163;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_UINT8) | (1 << cNextParser.TYPE_UINT16) | (1 << cNextParser.TYPE_UINT32) | (1 << cNextParser.TYPE_UINT64) | (1 << cNextParser.TYPE_FLOAT32) | (1 << cNextParser.TYPE_FLOAT64) | (1 << cNextParser.TYPE_FLOAT96) | (1 << cNextParser.TYPE_STRING) | (1 << cNextParser.TYPE_BOOLEAN))) !== 0)) {
                    {
                        this.state = 162;
                        this.parameterList();
                    }
                }
                this.state = 165;
                this.match(cNextParser.RPAREN);
                this.state = 166;
                this.match(cNextParser.LBRACE);
                this.state = 170;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & ((1 << (cNextParser.TYPE_INT8 - 7)) | (1 << (cNextParser.TYPE_INT16 - 7)) | (1 << (cNextParser.TYPE_INT32 - 7)) | (1 << (cNextParser.TYPE_INT64 - 7)) | (1 << (cNextParser.TYPE_UINT8 - 7)) | (1 << (cNextParser.TYPE_UINT16 - 7)) | (1 << (cNextParser.TYPE_UINT32 - 7)) | (1 << (cNextParser.TYPE_UINT64 - 7)) | (1 << (cNextParser.TYPE_FLOAT32 - 7)) | (1 << (cNextParser.TYPE_FLOAT64 - 7)) | (1 << (cNextParser.TYPE_FLOAT96 - 7)) | (1 << (cNextParser.TYPE_STRING - 7)) | (1 << (cNextParser.TYPE_BOOLEAN - 7)) | (1 << (cNextParser.LPAREN - 7)) | (1 << (cNextParser.RETURN - 7)) | (1 << (cNextParser.ID - 7)) | (1 << (cNextParser.NUMBER - 7)) | (1 << (cNextParser.STRING - 7)))) !== 0)) {
                    {
                        {
                            this.state = 167;
                            this.statement();
                        }
                    }
                    this.state = 172;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 173;
                this.match(cNextParser.RBRACE);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    parameterList() {
        let _localctx = new ParameterListContext(this._ctx, this.state);
        this.enterRule(_localctx, 24, cNextParser.RULE_parameterList);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 175;
                this.parameter();
                this.state = 180;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === cNextParser.COMMA) {
                    {
                        {
                            this.state = 176;
                            this.match(cNextParser.COMMA);
                            this.state = 177;
                            this.parameter();
                        }
                    }
                    this.state = 182;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    parameter() {
        let _localctx = new ParameterContext(this._ctx, this.state);
        this.enterRule(_localctx, 26, cNextParser.RULE_parameter);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 183;
                this.type_specifier();
                this.state = 184;
                this.match(cNextParser.ID);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    returnType() {
        let _localctx = new ReturnTypeContext(this._ctx, this.state);
        this.enterRule(_localctx, 28, cNextParser.RULE_returnType);
        try {
            this.state = 188;
            this._errHandler.sync(this);
            switch (this._input.LA(1)) {
                case cNextParser.TYPE_INT8:
                case cNextParser.TYPE_INT16:
                case cNextParser.TYPE_INT32:
                case cNextParser.TYPE_INT64:
                case cNextParser.TYPE_UINT8:
                case cNextParser.TYPE_UINT16:
                case cNextParser.TYPE_UINT32:
                case cNextParser.TYPE_UINT64:
                case cNextParser.TYPE_FLOAT32:
                case cNextParser.TYPE_FLOAT64:
                case cNextParser.TYPE_FLOAT96:
                case cNextParser.TYPE_STRING:
                case cNextParser.TYPE_BOOLEAN:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 186;
                        this.type_specifier();
                    }
                    break;
                case cNextParser.T__0:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 187;
                        this.match(cNextParser.T__0);
                    }
                    break;
                default:
                    throw new NoViableAltException_1.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    declaration() {
        let _localctx = new DeclarationContext(this._ctx, this.state);
        this.enterRule(_localctx, 30, cNextParser.RULE_declaration);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 190;
                this.type_specifier();
                this.state = 191;
                this.match(cNextParser.ID);
                this.state = 194;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (_la === cNextParser.ASSIGN) {
                    {
                        this.state = 192;
                        this.match(cNextParser.ASSIGN);
                        this.state = 193;
                        this.value();
                    }
                }
                this.state = 196;
                this.match(cNextParser.SEMI);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    statement() {
        let _localctx = new StatementContext(this._ctx, this.state);
        this.enterRule(_localctx, 32, cNextParser.RULE_statement);
        let _la;
        try {
            this.state = 218;
            this._errHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this._input, 23, this._ctx)) {
                case 1:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 198;
                        this.declaration();
                    }
                    break;
                case 2:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 199;
                        this.expression(0);
                        this.state = 200;
                        this.match(cNextParser.SEMI);
                    }
                    break;
                case 3:
                    this.enterOuterAlt(_localctx, 3);
                    {
                        this.state = 202;
                        this.functionCall();
                        this.state = 203;
                        this.match(cNextParser.SEMI);
                    }
                    break;
                case 4:
                    this.enterOuterAlt(_localctx, 4);
                    {
                        this.state = 205;
                        this.methodCall();
                        this.state = 206;
                        this.match(cNextParser.SEMI);
                    }
                    break;
                case 5:
                    this.enterOuterAlt(_localctx, 5);
                    {
                        this.state = 208;
                        this.match(cNextParser.ID);
                        this.state = 209;
                        this.match(cNextParser.ASSIGN);
                        this.state = 210;
                        this.value();
                        this.state = 211;
                        this.match(cNextParser.SEMI);
                    }
                    break;
                case 6:
                    this.enterOuterAlt(_localctx, 6);
                    {
                        this.state = 213;
                        this.match(cNextParser.RETURN);
                        this.state = 215;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if (((((_la - 24)) & ~0x1F) === 0 && ((1 << (_la - 24)) & ((1 << (cNextParser.LPAREN - 24)) | (1 << (cNextParser.ID - 24)) | (1 << (cNextParser.NUMBER - 24)) | (1 << (cNextParser.STRING - 24)))) !== 0)) {
                            {
                                this.state = 214;
                                this.expression(0);
                            }
                        }
                        this.state = 217;
                        this.match(cNextParser.SEMI);
                    }
                    break;
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    type_specifier() {
        let _localctx = new Type_specifierContext(this._ctx, this.state);
        this.enterRule(_localctx, 34, cNextParser.RULE_type_specifier);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 220;
                _la = this._input.LA(1);
                if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_UINT8) | (1 << cNextParser.TYPE_UINT16) | (1 << cNextParser.TYPE_UINT32) | (1 << cNextParser.TYPE_UINT64) | (1 << cNextParser.TYPE_FLOAT32) | (1 << cNextParser.TYPE_FLOAT64) | (1 << cNextParser.TYPE_FLOAT96) | (1 << cNextParser.TYPE_STRING) | (1 << cNextParser.TYPE_BOOLEAN))) !== 0))) {
                    this._errHandler.recoverInline(this);
                }
                else {
                    if (this._input.LA(1) === Token_1.Token.EOF) {
                        this.matchedEOF = true;
                    }
                    this._errHandler.reportMatch(this);
                    this.consume();
                }
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    value() {
        let _localctx = new ValueContext(this._ctx, this.state);
        this.enterRule(_localctx, 36, cNextParser.RULE_value);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 222;
                _la = this._input.LA(1);
                if (!(((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & ((1 << (cNextParser.ID - 33)) | (1 << (cNextParser.NUMBER - 33)) | (1 << (cNextParser.STRING - 33)))) !== 0))) {
                    this._errHandler.recoverInline(this);
                }
                else {
                    if (this._input.LA(1) === Token_1.Token.EOF) {
                        this.matchedEOF = true;
                    }
                    this._errHandler.reportMatch(this);
                    this.consume();
                }
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    functionCall() {
        let _localctx = new FunctionCallContext(this._ctx, this.state);
        this.enterRule(_localctx, 38, cNextParser.RULE_functionCall);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 224;
                this.match(cNextParser.ID);
                this.state = 225;
                this.match(cNextParser.LPAREN);
                this.state = 227;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (((((_la - 24)) & ~0x1F) === 0 && ((1 << (_la - 24)) & ((1 << (cNextParser.LPAREN - 24)) | (1 << (cNextParser.ID - 24)) | (1 << (cNextParser.NUMBER - 24)) | (1 << (cNextParser.STRING - 24)))) !== 0)) {
                    {
                        this.state = 226;
                        this.argumentList();
                    }
                }
                this.state = 229;
                this.match(cNextParser.RPAREN);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    methodCall() {
        let _localctx = new MethodCallContext(this._ctx, this.state);
        this.enterRule(_localctx, 40, cNextParser.RULE_methodCall);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 231;
                this.match(cNextParser.ID);
                this.state = 232;
                this.match(cNextParser.DOT);
                this.state = 233;
                this.match(cNextParser.ID);
                this.state = 234;
                this.match(cNextParser.LPAREN);
                this.state = 236;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (((((_la - 24)) & ~0x1F) === 0 && ((1 << (_la - 24)) & ((1 << (cNextParser.LPAREN - 24)) | (1 << (cNextParser.ID - 24)) | (1 << (cNextParser.NUMBER - 24)) | (1 << (cNextParser.STRING - 24)))) !== 0)) {
                    {
                        this.state = 235;
                        this.argumentList();
                    }
                }
                this.state = 238;
                this.match(cNextParser.RPAREN);
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    argumentList() {
        let _localctx = new ArgumentListContext(this._ctx, this.state);
        this.enterRule(_localctx, 42, cNextParser.RULE_argumentList);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 240;
                this.expression(0);
                this.state = 245;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === cNextParser.COMMA) {
                    {
                        {
                            this.state = 241;
                            this.match(cNextParser.COMMA);
                            this.state = 242;
                            this.expression(0);
                        }
                    }
                    this.state = 247;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return _localctx;
    }
    // @RuleVersion(0)
    expression(_p) {
        if (_p === undefined) {
            _p = 0;
        }
        let _parentctx = this._ctx;
        let _parentState = this.state;
        let _localctx = new ExpressionContext(this._ctx, _parentState);
        let _prevctx = _localctx;
        let _startState = 44;
        this.enterRecursionRule(_localctx, 44, cNextParser.RULE_expression, _p);
        try {
            let _alt;
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 254;
                this._errHandler.sync(this);
                switch (this._input.LA(1)) {
                    case cNextParser.ID:
                    case cNextParser.NUMBER:
                    case cNextParser.STRING:
                        {
                            _localctx = new ValueExprContext(_localctx);
                            this._ctx = _localctx;
                            _prevctx = _localctx;
                            this.state = 249;
                            this.value();
                        }
                        break;
                    case cNextParser.LPAREN:
                        {
                            _localctx = new ParenExprContext(_localctx);
                            this._ctx = _localctx;
                            _prevctx = _localctx;
                            this.state = 250;
                            this.match(cNextParser.LPAREN);
                            this.state = 251;
                            this.expression(0);
                            this.state = 252;
                            this.match(cNextParser.RPAREN);
                        }
                        break;
                    default:
                        throw new NoViableAltException_1.NoViableAltException(this);
                }
                this._ctx._stop = this._input.tryLT(-1);
                this.state = 270;
                this._errHandler.sync(this);
                _alt = this.interpreter.adaptivePredict(this._input, 29, this._ctx);
                while (_alt !== 2 && _alt !== ATN_1.ATN.INVALID_ALT_NUMBER) {
                    if (_alt === 1) {
                        if (this._parseListeners != null) {
                            this.triggerExitRuleEvent();
                        }
                        _prevctx = _localctx;
                        {
                            this.state = 268;
                            this._errHandler.sync(this);
                            switch (this.interpreter.adaptivePredict(this._input, 28, this._ctx)) {
                                case 1:
                                    {
                                        _localctx = new AddExprContext(new ExpressionContext(_parentctx, _parentState));
                                        this.pushNewRecursionContext(_localctx, _startState, cNextParser.RULE_expression);
                                        this.state = 256;
                                        if (!(this.precpred(this._ctx, 5))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 5)");
                                        }
                                        this.state = 257;
                                        this.match(cNextParser.PLUS);
                                        this.state = 258;
                                        this.expression(6);
                                    }
                                    break;
                                case 2:
                                    {
                                        _localctx = new SubExprContext(new ExpressionContext(_parentctx, _parentState));
                                        this.pushNewRecursionContext(_localctx, _startState, cNextParser.RULE_expression);
                                        this.state = 259;
                                        if (!(this.precpred(this._ctx, 4))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 4)");
                                        }
                                        this.state = 260;
                                        this.match(cNextParser.MINUS);
                                        this.state = 261;
                                        this.expression(5);
                                    }
                                    break;
                                case 3:
                                    {
                                        _localctx = new MultExprContext(new ExpressionContext(_parentctx, _parentState));
                                        this.pushNewRecursionContext(_localctx, _startState, cNextParser.RULE_expression);
                                        this.state = 262;
                                        if (!(this.precpred(this._ctx, 3))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 3)");
                                        }
                                        this.state = 263;
                                        this.match(cNextParser.MULT);
                                        this.state = 264;
                                        this.expression(4);
                                    }
                                    break;
                                case 4:
                                    {
                                        _localctx = new DivExprContext(new ExpressionContext(_parentctx, _parentState));
                                        this.pushNewRecursionContext(_localctx, _startState, cNextParser.RULE_expression);
                                        this.state = 265;
                                        if (!(this.precpred(this._ctx, 2))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
                                        }
                                        this.state = 266;
                                        this.match(cNextParser.DIV);
                                        this.state = 267;
                                        this.expression(3);
                                    }
                                    break;
                            }
                        }
                    }
                    this.state = 272;
                    this._errHandler.sync(this);
                    _alt = this.interpreter.adaptivePredict(this._input, 29, this._ctx);
                }
            }
        }
        catch (re) {
            if (re instanceof RecognitionException_1.RecognitionException) {
                _localctx.exception = re;
                this._errHandler.reportError(this, re);
                this._errHandler.recover(this, re);
            }
            else {
                throw re;
            }
        }
        finally {
            this.unrollRecursionContexts(_parentctx);
        }
        return _localctx;
    }
    sempred(_localctx, ruleIndex, predIndex) {
        switch (ruleIndex) {
            case 22:
                return this.expression_sempred(_localctx, predIndex);
        }
        return true;
    }
    expression_sempred(_localctx, predIndex) {
        switch (predIndex) {
            case 0:
                return this.precpred(this._ctx, 5);
            case 1:
                return this.precpred(this._ctx, 4);
            case 2:
                return this.precpred(this._ctx, 3);
            case 3:
                return this.precpred(this._ctx, 2);
        }
        return true;
    }
    static get _ATN() {
        if (!cNextParser.__ATN) {
            cNextParser.__ATN = new ATNDeserializer_1.ATNDeserializer().deserialize(Utils.toCharArray(cNextParser._serializedATN));
        }
        return cNextParser.__ATN;
    }
}
exports.cNextParser = cNextParser;
cNextParser.T__0 = 1;
cNextParser.IMPORT = 2;
cNextParser.INCLUDE = 3;
cNextParser.PUBLIC = 4;
cNextParser.STATIC = 5;
cNextParser.CLASS = 6;
cNextParser.TYPE_INT8 = 7;
cNextParser.TYPE_INT16 = 8;
cNextParser.TYPE_INT32 = 9;
cNextParser.TYPE_INT64 = 10;
cNextParser.TYPE_UINT8 = 11;
cNextParser.TYPE_UINT16 = 12;
cNextParser.TYPE_UINT32 = 13;
cNextParser.TYPE_UINT64 = 14;
cNextParser.TYPE_FLOAT32 = 15;
cNextParser.TYPE_FLOAT64 = 16;
cNextParser.TYPE_FLOAT96 = 17;
cNextParser.TYPE_STRING = 18;
cNextParser.TYPE_BOOLEAN = 19;
cNextParser.ASSIGN = 20;
cNextParser.SEMI = 21;
cNextParser.LBRACE = 22;
cNextParser.RBRACE = 23;
cNextParser.LPAREN = 24;
cNextParser.RPAREN = 25;
cNextParser.COMMA = 26;
cNextParser.RETURN = 27;
cNextParser.PLUS = 28;
cNextParser.MINUS = 29;
cNextParser.MULT = 30;
cNextParser.DIV = 31;
cNextParser.DOT = 32;
cNextParser.ID = 33;
cNextParser.NUMBER = 34;
cNextParser.STRING = 35;
cNextParser.FILENAME = 36;
cNextParser.LINE_COMMENT = 37;
cNextParser.DOC_COMMENT = 38;
cNextParser.BLOCK_COMMENT = 39;
cNextParser.WS = 40;
cNextParser.RULE_sourceFile = 0;
cNextParser.RULE_mainSourceFile = 1;
cNextParser.RULE_globalDeclaration = 2;
cNextParser.RULE_fileDirective = 3;
cNextParser.RULE_importDirective = 4;
cNextParser.RULE_includeDirective = 5;
cNextParser.RULE_classDeclaration = 6;
cNextParser.RULE_classMembers = 7;
cNextParser.RULE_staticMember = 8;
cNextParser.RULE_regularMember = 9;
cNextParser.RULE_classFunction = 10;
cNextParser.RULE_functionDeclaration = 11;
cNextParser.RULE_parameterList = 12;
cNextParser.RULE_parameter = 13;
cNextParser.RULE_returnType = 14;
cNextParser.RULE_declaration = 15;
cNextParser.RULE_statement = 16;
cNextParser.RULE_type_specifier = 17;
cNextParser.RULE_value = 18;
cNextParser.RULE_functionCall = 19;
cNextParser.RULE_methodCall = 20;
cNextParser.RULE_argumentList = 21;
cNextParser.RULE_expression = 22;
// tslint:disable:no-trailing-whitespace
cNextParser.ruleNames = [
    "sourceFile", "mainSourceFile", "globalDeclaration", "fileDirective",
    "importDirective", "includeDirective", "classDeclaration", "classMembers",
    "staticMember", "regularMember", "classFunction", "functionDeclaration",
    "parameterList", "parameter", "returnType", "declaration", "statement",
    "type_specifier", "value", "functionCall", "methodCall", "argumentList",
    "expression",
];
cNextParser._LITERAL_NAMES = [
    undefined, "'void'", "'import'", "'#include'", "'public'", "'static'",
    "'class'", "'int8'", "'int16'", "'int32'", "'int64'", "'uint8'", "'uint16'",
    "'uint32'", "'uint64'", "'float32'", "'float64'", "'float96'", "'String'",
    "'boolean'", "'<-'", "';'", "'{'", "'}'", "'('", "')'", "','", "'return'",
    "'+'", "'-'", "'*'", "'/'", "'.'",
];
cNextParser._SYMBOLIC_NAMES = [
    undefined, undefined, "IMPORT", "INCLUDE", "PUBLIC", "STATIC", "CLASS",
    "TYPE_INT8", "TYPE_INT16", "TYPE_INT32", "TYPE_INT64", "TYPE_UINT8", "TYPE_UINT16",
    "TYPE_UINT32", "TYPE_UINT64", "TYPE_FLOAT32", "TYPE_FLOAT64", "TYPE_FLOAT96",
    "TYPE_STRING", "TYPE_BOOLEAN", "ASSIGN", "SEMI", "LBRACE", "RBRACE", "LPAREN",
    "RPAREN", "COMMA", "RETURN", "PLUS", "MINUS", "MULT", "DIV", "DOT", "ID",
    "NUMBER", "STRING", "FILENAME", "LINE_COMMENT", "DOC_COMMENT", "BLOCK_COMMENT",
    "WS",
];
cNextParser.VOCABULARY = new VocabularyImpl_1.VocabularyImpl(cNextParser._LITERAL_NAMES, cNextParser._SYMBOLIC_NAMES, []);
cNextParser._serializedATN = "\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03*\u0114\x04\x02" +
    "\t\x02\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06\x04\x07" +
    "\t\x07\x04\b\t\b\x04\t\t\t\x04\n\t\n\x04\v\t\v\x04\f\t\f\x04\r\t\r\x04" +
    "\x0E\t\x0E\x04\x0F\t\x0F\x04\x10\t\x10\x04\x11\t\x11\x04\x12\t\x12\x04" +
    "\x13\t\x13\x04\x14\t\x14\x04\x15\t\x15\x04\x16\t\x16\x04\x17\t\x17\x04" +
    "\x18\t\x18\x03\x02\x07\x022\n\x02\f\x02\x0E\x025\v\x02\x03\x02\x03\x02" +
    "\x03\x02\x03\x03\x07\x03;\n\x03\f\x03\x0E\x03>\v\x03\x03\x03\x03\x03\x03" +
    "\x03\x07\x03C\n\x03\f\x03\x0E\x03F\v\x03\x03\x03\x03\x03\x03\x04\x03\x04" +
    "\x03\x04\x03\x04\x03\x05\x03\x05\x05\x05P\n\x05\x03\x06\x03\x06\x03\x06" +
    "\x03\x06\x03\x07\x03\x07\x03\x07\x03\x07\x03\b\x07\b[\n\b\f\b\x0E\b^\v" +
    "\b\x03\b\x05\ba\n\b\x03\b\x03\b\x03\b\x03\b\x03\b\x03\b\x03\t\x03\t\x07" +
    "\tk\n\t\f\t\x0E\tn\v\t\x03\n\x07\nq\n\n\f\n\x0E\nt\v\n\x03\n\x03\n\x03" +
    "\n\x03\v\x07\vz\n\v\f\v\x0E\v}\v\v\x03\v\x03\v\x07\v\x81\n\v\f\v\x0E\v" +
    "\x84\v\v\x03\v\x05\v\x87\n\v\x03\f\x05\f\x8A\n\f\x03\f\x03\f\x03\f\x03" +
    "\f\x05\f\x90\n\f\x03\f\x03\f\x03\f\x07\f\x95\n\f\f\f\x0E\f\x98\v\f\x03" +
    "\f\x03\f\x03\r\x07\r\x9D\n\r\f\r\x0E\r\xA0\v\r\x03\r\x03\r\x03\r\x03\r" +
    "\x05\r\xA6\n\r\x03\r\x03\r\x03\r\x07\r\xAB\n\r\f\r\x0E\r\xAE\v\r\x03\r" +
    "\x03\r\x03\x0E\x03\x0E\x03\x0E\x07\x0E\xB5\n\x0E\f\x0E\x0E\x0E\xB8\v\x0E" +
    "\x03\x0F\x03\x0F\x03\x0F\x03\x10\x03\x10\x05\x10\xBF\n\x10\x03\x11\x03" +
    "\x11\x03\x11\x03\x11\x05\x11\xC5\n\x11\x03\x11\x03\x11\x03\x12\x03\x12" +
    "\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12" +
    "\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x05\x12\xDA\n\x12\x03" +
    "\x12\x05\x12\xDD\n\x12\x03\x13\x03\x13\x03\x14\x03\x14\x03\x15\x03\x15" +
    "\x03\x15\x05\x15\xE6\n\x15\x03\x15\x03\x15\x03\x16\x03\x16\x03\x16\x03" +
    "\x16\x03\x16\x05\x16\xEF\n\x16\x03\x16\x03\x16\x03\x17\x03\x17\x03\x17" +
    "\x07\x17\xF6\n\x17\f\x17\x0E\x17\xF9\v\x17\x03\x18\x03\x18\x03\x18\x03" +
    "\x18\x03\x18\x03\x18\x05\x18\u0101\n\x18\x03\x18\x03\x18\x03\x18\x03\x18" +
    "\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x07\x18" +
    "\u010F\n\x18\f\x18\x0E\x18\u0112\v\x18\x03\x18\x02\x02\x03.\x19\x02\x02" +
    "\x04\x02\x06\x02\b\x02\n\x02\f\x02\x0E\x02\x10\x02\x12\x02\x14\x02\x16" +
    "\x02\x18\x02\x1A\x02\x1C\x02\x1E\x02 \x02\"\x02$\x02&\x02(\x02*\x02,\x02" +
    ".\x02\x02\x04\x03\x02\t\x15\x03\x02#%\x02\u0121\x023\x03\x02\x02\x02\x04" +
    "<\x03\x02\x02\x02\x06I\x03\x02\x02\x02\bO\x03\x02\x02\x02\nQ\x03\x02\x02" +
    "\x02\fU\x03\x02\x02\x02\x0E\\\x03\x02\x02\x02\x10l\x03\x02\x02\x02\x12" +
    "r\x03\x02\x02\x02\x14\x86\x03\x02\x02\x02\x16\x89\x03\x02\x02\x02\x18" +
    "\x9E\x03\x02\x02\x02\x1A\xB1\x03\x02\x02\x02\x1C\xB9\x03\x02\x02\x02\x1E" +
    "\xBE\x03\x02\x02\x02 \xC0\x03\x02\x02\x02\"\xDC\x03\x02\x02\x02$\xDE\x03" +
    "\x02\x02\x02&\xE0\x03\x02\x02\x02(\xE2\x03\x02\x02\x02*\xE9\x03\x02\x02" +
    "\x02,\xF2\x03\x02\x02\x02.\u0100\x03\x02\x02\x0202\x05\b\x05\x0210\x03" +
    "\x02\x02\x0225\x03\x02\x02\x0231\x03\x02\x02\x0234\x03\x02\x02\x0246\x03" +
    "\x02\x02\x0253\x03\x02\x02\x0267\x05\x0E\b\x0278\x07\x02\x02\x038\x03" +
    "\x03\x02\x02\x029;\x05\b\x05\x02:9\x03\x02\x02\x02;>\x03\x02\x02\x02<" +
    ":\x03\x02\x02\x02<=\x03\x02\x02\x02=D\x03\x02\x02\x02><\x03\x02\x02\x02" +
    "?C\x05\x06\x04\x02@C\x05\x18\r\x02AC\x05\x0E\b\x02B?\x03\x02\x02\x02B" +
    "@\x03\x02\x02\x02BA\x03\x02\x02\x02CF\x03\x02\x02\x02DB\x03\x02\x02\x02" +
    "DE\x03\x02\x02\x02EG\x03\x02\x02\x02FD\x03\x02\x02\x02GH\x07\x02\x02\x03" +
    "H\x05\x03\x02\x02\x02IJ\x07#\x02\x02JK\x07#\x02\x02KL\x07\x17\x02\x02" +
    "L\x07\x03\x02\x02\x02MP\x05\n\x06\x02NP\x05\f\x07\x02OM\x03\x02\x02\x02" +
    "ON\x03\x02\x02\x02P\t\x03\x02\x02\x02QR\x07\x04\x02\x02RS\x07%\x02\x02" +
    "ST\x07\x17\x02\x02T\v\x03\x02\x02\x02UV\x07\x05\x02\x02VW\x07%\x02\x02" +
    "WX\x07\x17\x02\x02X\r\x03\x02\x02\x02Y[\x07(\x02\x02ZY\x03\x02\x02\x02" +
    "[^\x03\x02\x02\x02\\Z\x03\x02\x02\x02\\]\x03\x02\x02\x02]`\x03\x02\x02" +
    "\x02^\\\x03\x02\x02\x02_a\x07\x07\x02\x02`_\x03\x02\x02\x02`a\x03\x02" +
    "\x02\x02ab\x03\x02\x02\x02bc\x07\b\x02\x02cd\x07#\x02\x02de\x07\x18\x02" +
    "\x02ef\x05\x10\t\x02fg\x07\x19\x02\x02g\x0F\x03\x02\x02\x02hk\x05\x12" +
    "\n\x02ik\x05\x14\v\x02jh\x03\x02\x02\x02ji\x03\x02\x02\x02kn\x03\x02\x02" +
    "\x02lj\x03\x02\x02\x02lm\x03\x02\x02\x02m\x11\x03\x02\x02\x02nl\x03\x02" +
    "\x02\x02oq\x07(\x02\x02po\x03\x02\x02\x02qt\x03\x02\x02\x02rp\x03\x02" +
    "\x02\x02rs\x03\x02\x02\x02su\x03\x02\x02\x02tr\x03\x02\x02\x02uv\x07\x07" +
    "\x02\x02vw\x05 \x11\x02w\x13\x03\x02\x02\x02xz\x07(\x02\x02yx\x03\x02" +
    "\x02\x02z}\x03\x02\x02\x02{y\x03\x02\x02\x02{|\x03\x02\x02\x02|~\x03\x02" +
    "\x02\x02}{\x03\x02\x02\x02~\x87\x05 \x11\x02\x7F\x81\x07(\x02\x02\x80" +
    "\x7F\x03\x02\x02\x02\x81\x84\x03\x02\x02\x02\x82\x80\x03\x02\x02\x02\x82" +
    "\x83\x03\x02\x02\x02\x83\x85\x03\x02\x02\x02\x84\x82\x03\x02\x02\x02\x85" +
    "\x87\x05\x16\f\x02\x86{\x03\x02\x02\x02\x86\x82\x03\x02\x02\x02\x87\x15" +
    "\x03\x02\x02\x02\x88\x8A\x07\x06\x02\x02\x89\x88\x03\x02\x02\x02\x89\x8A" +
    "\x03\x02\x02\x02\x8A\x8B\x03\x02\x02\x02\x8B\x8C\x05\x1E\x10\x02\x8C\x8D" +
    "\x07#\x02\x02\x8D\x8F\x07\x1A\x02\x02\x8E\x90\x05\x1A\x0E\x02\x8F\x8E" +
    "\x03\x02\x02\x02\x8F\x90\x03\x02\x02\x02\x90\x91\x03\x02\x02\x02\x91\x92" +
    "\x07\x1B\x02\x02\x92\x96\x07\x18\x02\x02\x93\x95\x05\"\x12\x02\x94\x93" +
    "\x03\x02\x02\x02\x95\x98\x03\x02\x02\x02\x96\x94\x03\x02\x02\x02\x96\x97" +
    "\x03\x02\x02\x02\x97\x99\x03\x02\x02\x02\x98\x96\x03\x02\x02\x02\x99\x9A" +
    "\x07\x19\x02\x02\x9A\x17\x03\x02\x02\x02\x9B\x9D\x07(\x02\x02\x9C\x9B" +
    "\x03\x02\x02\x02\x9D\xA0\x03\x02\x02\x02\x9E\x9C\x03\x02\x02\x02\x9E\x9F" +
    "\x03\x02\x02\x02\x9F\xA1\x03\x02\x02\x02\xA0\x9E\x03\x02\x02\x02\xA1\xA2" +
    "\x05\x1E\x10\x02\xA2\xA3\x07#\x02\x02\xA3\xA5\x07\x1A\x02\x02\xA4\xA6" +
    "\x05\x1A\x0E\x02\xA5\xA4\x03\x02\x02\x02\xA5\xA6\x03\x02\x02\x02\xA6\xA7" +
    "\x03\x02\x02\x02\xA7\xA8\x07\x1B\x02\x02\xA8\xAC\x07\x18\x02\x02\xA9\xAB" +
    "\x05\"\x12\x02\xAA\xA9\x03\x02\x02\x02\xAB\xAE\x03\x02\x02\x02\xAC\xAA" +
    "\x03\x02\x02\x02\xAC\xAD\x03\x02\x02\x02\xAD\xAF\x03\x02\x02\x02\xAE\xAC" +
    "\x03\x02\x02\x02\xAF\xB0\x07\x19\x02\x02\xB0\x19\x03\x02\x02\x02\xB1\xB6" +
    "\x05\x1C\x0F\x02\xB2\xB3\x07\x1C\x02\x02\xB3\xB5\x05\x1C\x0F\x02\xB4\xB2" +
    "\x03\x02\x02\x02\xB5\xB8\x03\x02\x02\x02\xB6\xB4\x03\x02\x02\x02\xB6\xB7" +
    "\x03\x02\x02\x02\xB7\x1B\x03\x02\x02\x02\xB8\xB6\x03\x02\x02\x02\xB9\xBA" +
    "\x05$\x13\x02\xBA\xBB\x07#\x02\x02\xBB\x1D\x03\x02\x02\x02\xBC\xBF\x05" +
    "$\x13\x02\xBD\xBF\x07\x03\x02\x02\xBE\xBC\x03\x02\x02\x02\xBE\xBD\x03" +
    "\x02\x02\x02\xBF\x1F\x03\x02\x02\x02\xC0\xC1\x05$\x13\x02\xC1\xC4\x07" +
    "#\x02\x02\xC2\xC3\x07\x16\x02\x02\xC3\xC5\x05&\x14\x02\xC4\xC2\x03\x02" +
    "\x02\x02\xC4\xC5\x03\x02\x02\x02\xC5\xC6\x03\x02\x02\x02\xC6\xC7\x07\x17" +
    "\x02\x02\xC7!\x03\x02\x02\x02\xC8\xDD\x05 \x11\x02\xC9\xCA\x05.\x18\x02" +
    "\xCA\xCB\x07\x17\x02\x02\xCB\xDD\x03\x02\x02\x02\xCC\xCD\x05(\x15\x02" +
    "\xCD\xCE\x07\x17\x02\x02\xCE\xDD\x03\x02\x02\x02\xCF\xD0\x05*\x16\x02" +
    "\xD0\xD1\x07\x17\x02\x02\xD1\xDD\x03\x02\x02\x02\xD2\xD3\x07#\x02\x02" +
    "\xD3\xD4\x07\x16\x02\x02\xD4\xD5\x05&\x14\x02\xD5\xD6\x07\x17\x02\x02" +
    "\xD6\xDD\x03\x02\x02\x02\xD7\xD9\x07\x1D\x02\x02\xD8\xDA\x05.\x18\x02" +
    "\xD9\xD8\x03\x02\x02\x02\xD9\xDA\x03\x02\x02\x02\xDA\xDB\x03\x02\x02\x02" +
    "\xDB\xDD\x07\x17\x02\x02\xDC\xC8\x03\x02\x02\x02\xDC\xC9\x03\x02\x02\x02" +
    "\xDC\xCC\x03\x02\x02\x02\xDC\xCF\x03\x02\x02\x02\xDC\xD2\x03\x02\x02\x02" +
    "\xDC\xD7\x03\x02\x02\x02\xDD#\x03\x02\x02\x02\xDE\xDF\t\x02\x02\x02\xDF" +
    "%\x03\x02\x02\x02\xE0\xE1\t\x03\x02\x02\xE1\'\x03\x02\x02\x02\xE2\xE3" +
    "\x07#\x02\x02\xE3\xE5\x07\x1A\x02\x02\xE4\xE6\x05,\x17\x02\xE5\xE4\x03" +
    "\x02\x02\x02\xE5\xE6\x03\x02\x02\x02\xE6\xE7\x03\x02\x02\x02\xE7\xE8\x07" +
    "\x1B\x02\x02\xE8)\x03\x02\x02\x02\xE9\xEA\x07#\x02\x02\xEA\xEB\x07\"\x02" +
    "\x02\xEB\xEC\x07#\x02\x02\xEC\xEE\x07\x1A\x02\x02\xED\xEF\x05,\x17\x02" +
    "\xEE\xED\x03\x02\x02\x02\xEE\xEF\x03\x02\x02\x02\xEF\xF0\x03\x02\x02\x02" +
    "\xF0\xF1\x07\x1B\x02\x02\xF1+\x03\x02\x02\x02\xF2\xF7\x05.\x18\x02\xF3" +
    "\xF4\x07\x1C\x02\x02\xF4\xF6\x05.\x18\x02\xF5\xF3\x03\x02\x02\x02\xF6" +
    "\xF9\x03\x02\x02\x02\xF7\xF5\x03\x02\x02\x02\xF7\xF8\x03\x02\x02\x02\xF8" +
    "-\x03\x02\x02\x02\xF9\xF7\x03\x02\x02\x02\xFA\xFB\b\x18\x01\x02\xFB\u0101" +
    "\x05&\x14\x02\xFC\xFD\x07\x1A\x02\x02\xFD\xFE\x05.\x18\x02\xFE\xFF\x07" +
    "\x1B\x02\x02\xFF\u0101\x03\x02\x02\x02\u0100\xFA\x03\x02\x02\x02\u0100" +
    "\xFC\x03\x02\x02\x02\u0101\u0110\x03\x02\x02\x02\u0102\u0103\f\x07\x02" +
    "\x02\u0103\u0104\x07\x1E\x02\x02\u0104\u010F\x05.\x18\b\u0105\u0106\f" +
    "\x06\x02\x02\u0106\u0107\x07\x1F\x02\x02\u0107\u010F\x05.\x18\x07\u0108" +
    "\u0109\f\x05\x02\x02\u0109\u010A\x07 \x02\x02\u010A\u010F\x05.\x18\x06" +
    "\u010B\u010C\f\x04\x02\x02\u010C\u010D\x07!\x02\x02\u010D\u010F\x05.\x18" +
    "\x05\u010E\u0102\x03\x02\x02\x02\u010E\u0105\x03\x02\x02\x02\u010E\u0108" +
    "\x03\x02\x02\x02\u010E\u010B\x03\x02\x02\x02\u010F\u0112\x03\x02\x02\x02" +
    "\u0110\u010E\x03\x02\x02\x02\u0110\u0111\x03\x02\x02\x02\u0111/\x03\x02" +
    "\x02\x02\u0112\u0110\x03\x02\x02\x02 3<BDO\\`jlr{\x82\x86\x89\x8F\x96" +
    "\x9E\xA5\xAC\xB6\xBE\xC4\xD9\xDC\xE5\xEE\xF7\u0100\u010E\u0110";
class SourceFileContext extends ParserRuleContext_1.ParserRuleContext {
    classDeclaration() {
        return this.getRuleContext(0, ClassDeclarationContext);
    }
    EOF() { return this.getToken(cNextParser.EOF, 0); }
    fileDirective(i) {
        if (i === undefined) {
            return this.getRuleContexts(FileDirectiveContext);
        }
        else {
            return this.getRuleContext(i, FileDirectiveContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_sourceFile; }
    // @Override
    enterRule(listener) {
        if (listener.enterSourceFile) {
            listener.enterSourceFile(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitSourceFile) {
            listener.exitSourceFile(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitSourceFile) {
            return visitor.visitSourceFile(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.SourceFileContext = SourceFileContext;
class MainSourceFileContext extends ParserRuleContext_1.ParserRuleContext {
    EOF() { return this.getToken(cNextParser.EOF, 0); }
    fileDirective(i) {
        if (i === undefined) {
            return this.getRuleContexts(FileDirectiveContext);
        }
        else {
            return this.getRuleContext(i, FileDirectiveContext);
        }
    }
    globalDeclaration(i) {
        if (i === undefined) {
            return this.getRuleContexts(GlobalDeclarationContext);
        }
        else {
            return this.getRuleContext(i, GlobalDeclarationContext);
        }
    }
    functionDeclaration(i) {
        if (i === undefined) {
            return this.getRuleContexts(FunctionDeclarationContext);
        }
        else {
            return this.getRuleContext(i, FunctionDeclarationContext);
        }
    }
    classDeclaration(i) {
        if (i === undefined) {
            return this.getRuleContexts(ClassDeclarationContext);
        }
        else {
            return this.getRuleContext(i, ClassDeclarationContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_mainSourceFile; }
    // @Override
    enterRule(listener) {
        if (listener.enterMainSourceFile) {
            listener.enterMainSourceFile(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitMainSourceFile) {
            listener.exitMainSourceFile(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitMainSourceFile) {
            return visitor.visitMainSourceFile(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.MainSourceFileContext = MainSourceFileContext;
class GlobalDeclarationContext extends ParserRuleContext_1.ParserRuleContext {
    ID(i) {
        if (i === undefined) {
            return this.getTokens(cNextParser.ID);
        }
        else {
            return this.getToken(cNextParser.ID, i);
        }
    }
    SEMI() { return this.getToken(cNextParser.SEMI, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_globalDeclaration; }
    // @Override
    enterRule(listener) {
        if (listener.enterGlobalDeclaration) {
            listener.enterGlobalDeclaration(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitGlobalDeclaration) {
            listener.exitGlobalDeclaration(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitGlobalDeclaration) {
            return visitor.visitGlobalDeclaration(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.GlobalDeclarationContext = GlobalDeclarationContext;
class FileDirectiveContext extends ParserRuleContext_1.ParserRuleContext {
    importDirective() {
        return this.tryGetRuleContext(0, ImportDirectiveContext);
    }
    includeDirective() {
        return this.tryGetRuleContext(0, IncludeDirectiveContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_fileDirective; }
    // @Override
    enterRule(listener) {
        if (listener.enterFileDirective) {
            listener.enterFileDirective(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitFileDirective) {
            listener.exitFileDirective(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitFileDirective) {
            return visitor.visitFileDirective(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.FileDirectiveContext = FileDirectiveContext;
class ImportDirectiveContext extends ParserRuleContext_1.ParserRuleContext {
    IMPORT() { return this.getToken(cNextParser.IMPORT, 0); }
    STRING() { return this.getToken(cNextParser.STRING, 0); }
    SEMI() { return this.getToken(cNextParser.SEMI, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_importDirective; }
    // @Override
    enterRule(listener) {
        if (listener.enterImportDirective) {
            listener.enterImportDirective(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitImportDirective) {
            listener.exitImportDirective(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitImportDirective) {
            return visitor.visitImportDirective(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ImportDirectiveContext = ImportDirectiveContext;
class IncludeDirectiveContext extends ParserRuleContext_1.ParserRuleContext {
    INCLUDE() { return this.getToken(cNextParser.INCLUDE, 0); }
    STRING() { return this.getToken(cNextParser.STRING, 0); }
    SEMI() { return this.getToken(cNextParser.SEMI, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_includeDirective; }
    // @Override
    enterRule(listener) {
        if (listener.enterIncludeDirective) {
            listener.enterIncludeDirective(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitIncludeDirective) {
            listener.exitIncludeDirective(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitIncludeDirective) {
            return visitor.visitIncludeDirective(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.IncludeDirectiveContext = IncludeDirectiveContext;
class ClassDeclarationContext extends ParserRuleContext_1.ParserRuleContext {
    CLASS() { return this.getToken(cNextParser.CLASS, 0); }
    ID() { return this.getToken(cNextParser.ID, 0); }
    LBRACE() { return this.getToken(cNextParser.LBRACE, 0); }
    classMembers() {
        return this.getRuleContext(0, ClassMembersContext);
    }
    RBRACE() { return this.getToken(cNextParser.RBRACE, 0); }
    DOC_COMMENT(i) {
        if (i === undefined) {
            return this.getTokens(cNextParser.DOC_COMMENT);
        }
        else {
            return this.getToken(cNextParser.DOC_COMMENT, i);
        }
    }
    STATIC() { return this.tryGetToken(cNextParser.STATIC, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_classDeclaration; }
    // @Override
    enterRule(listener) {
        if (listener.enterClassDeclaration) {
            listener.enterClassDeclaration(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitClassDeclaration) {
            listener.exitClassDeclaration(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitClassDeclaration) {
            return visitor.visitClassDeclaration(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ClassDeclarationContext = ClassDeclarationContext;
class ClassMembersContext extends ParserRuleContext_1.ParserRuleContext {
    staticMember(i) {
        if (i === undefined) {
            return this.getRuleContexts(StaticMemberContext);
        }
        else {
            return this.getRuleContext(i, StaticMemberContext);
        }
    }
    regularMember(i) {
        if (i === undefined) {
            return this.getRuleContexts(RegularMemberContext);
        }
        else {
            return this.getRuleContext(i, RegularMemberContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_classMembers; }
    // @Override
    enterRule(listener) {
        if (listener.enterClassMembers) {
            listener.enterClassMembers(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitClassMembers) {
            listener.exitClassMembers(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitClassMembers) {
            return visitor.visitClassMembers(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ClassMembersContext = ClassMembersContext;
class StaticMemberContext extends ParserRuleContext_1.ParserRuleContext {
    STATIC() { return this.getToken(cNextParser.STATIC, 0); }
    declaration() {
        return this.getRuleContext(0, DeclarationContext);
    }
    DOC_COMMENT(i) {
        if (i === undefined) {
            return this.getTokens(cNextParser.DOC_COMMENT);
        }
        else {
            return this.getToken(cNextParser.DOC_COMMENT, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_staticMember; }
    // @Override
    enterRule(listener) {
        if (listener.enterStaticMember) {
            listener.enterStaticMember(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitStaticMember) {
            listener.exitStaticMember(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitStaticMember) {
            return visitor.visitStaticMember(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.StaticMemberContext = StaticMemberContext;
class RegularMemberContext extends ParserRuleContext_1.ParserRuleContext {
    declaration() {
        return this.tryGetRuleContext(0, DeclarationContext);
    }
    DOC_COMMENT(i) {
        if (i === undefined) {
            return this.getTokens(cNextParser.DOC_COMMENT);
        }
        else {
            return this.getToken(cNextParser.DOC_COMMENT, i);
        }
    }
    classFunction() {
        return this.tryGetRuleContext(0, ClassFunctionContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_regularMember; }
    // @Override
    enterRule(listener) {
        if (listener.enterRegularMember) {
            listener.enterRegularMember(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitRegularMember) {
            listener.exitRegularMember(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitRegularMember) {
            return visitor.visitRegularMember(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.RegularMemberContext = RegularMemberContext;
class ClassFunctionContext extends ParserRuleContext_1.ParserRuleContext {
    returnType() {
        return this.getRuleContext(0, ReturnTypeContext);
    }
    ID() { return this.getToken(cNextParser.ID, 0); }
    LPAREN() { return this.getToken(cNextParser.LPAREN, 0); }
    RPAREN() { return this.getToken(cNextParser.RPAREN, 0); }
    LBRACE() { return this.getToken(cNextParser.LBRACE, 0); }
    RBRACE() { return this.getToken(cNextParser.RBRACE, 0); }
    PUBLIC() { return this.tryGetToken(cNextParser.PUBLIC, 0); }
    parameterList() {
        return this.tryGetRuleContext(0, ParameterListContext);
    }
    statement(i) {
        if (i === undefined) {
            return this.getRuleContexts(StatementContext);
        }
        else {
            return this.getRuleContext(i, StatementContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_classFunction; }
    // @Override
    enterRule(listener) {
        if (listener.enterClassFunction) {
            listener.enterClassFunction(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitClassFunction) {
            listener.exitClassFunction(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitClassFunction) {
            return visitor.visitClassFunction(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ClassFunctionContext = ClassFunctionContext;
class FunctionDeclarationContext extends ParserRuleContext_1.ParserRuleContext {
    returnType() {
        return this.getRuleContext(0, ReturnTypeContext);
    }
    ID() { return this.getToken(cNextParser.ID, 0); }
    LPAREN() { return this.getToken(cNextParser.LPAREN, 0); }
    RPAREN() { return this.getToken(cNextParser.RPAREN, 0); }
    LBRACE() { return this.getToken(cNextParser.LBRACE, 0); }
    RBRACE() { return this.getToken(cNextParser.RBRACE, 0); }
    DOC_COMMENT(i) {
        if (i === undefined) {
            return this.getTokens(cNextParser.DOC_COMMENT);
        }
        else {
            return this.getToken(cNextParser.DOC_COMMENT, i);
        }
    }
    parameterList() {
        return this.tryGetRuleContext(0, ParameterListContext);
    }
    statement(i) {
        if (i === undefined) {
            return this.getRuleContexts(StatementContext);
        }
        else {
            return this.getRuleContext(i, StatementContext);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_functionDeclaration; }
    // @Override
    enterRule(listener) {
        if (listener.enterFunctionDeclaration) {
            listener.enterFunctionDeclaration(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitFunctionDeclaration) {
            listener.exitFunctionDeclaration(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitFunctionDeclaration) {
            return visitor.visitFunctionDeclaration(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.FunctionDeclarationContext = FunctionDeclarationContext;
class ParameterListContext extends ParserRuleContext_1.ParserRuleContext {
    parameter(i) {
        if (i === undefined) {
            return this.getRuleContexts(ParameterContext);
        }
        else {
            return this.getRuleContext(i, ParameterContext);
        }
    }
    COMMA(i) {
        if (i === undefined) {
            return this.getTokens(cNextParser.COMMA);
        }
        else {
            return this.getToken(cNextParser.COMMA, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_parameterList; }
    // @Override
    enterRule(listener) {
        if (listener.enterParameterList) {
            listener.enterParameterList(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitParameterList) {
            listener.exitParameterList(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitParameterList) {
            return visitor.visitParameterList(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ParameterListContext = ParameterListContext;
class ParameterContext extends ParserRuleContext_1.ParserRuleContext {
    type_specifier() {
        return this.getRuleContext(0, Type_specifierContext);
    }
    ID() { return this.getToken(cNextParser.ID, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_parameter; }
    // @Override
    enterRule(listener) {
        if (listener.enterParameter) {
            listener.enterParameter(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitParameter) {
            listener.exitParameter(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitParameter) {
            return visitor.visitParameter(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ParameterContext = ParameterContext;
class ReturnTypeContext extends ParserRuleContext_1.ParserRuleContext {
    type_specifier() {
        return this.tryGetRuleContext(0, Type_specifierContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_returnType; }
    // @Override
    enterRule(listener) {
        if (listener.enterReturnType) {
            listener.enterReturnType(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitReturnType) {
            listener.exitReturnType(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitReturnType) {
            return visitor.visitReturnType(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ReturnTypeContext = ReturnTypeContext;
class DeclarationContext extends ParserRuleContext_1.ParserRuleContext {
    type_specifier() {
        return this.getRuleContext(0, Type_specifierContext);
    }
    ID() { return this.getToken(cNextParser.ID, 0); }
    SEMI() { return this.getToken(cNextParser.SEMI, 0); }
    ASSIGN() { return this.tryGetToken(cNextParser.ASSIGN, 0); }
    value() {
        return this.tryGetRuleContext(0, ValueContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_declaration; }
    // @Override
    enterRule(listener) {
        if (listener.enterDeclaration) {
            listener.enterDeclaration(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitDeclaration) {
            listener.exitDeclaration(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitDeclaration) {
            return visitor.visitDeclaration(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.DeclarationContext = DeclarationContext;
class StatementContext extends ParserRuleContext_1.ParserRuleContext {
    declaration() {
        return this.tryGetRuleContext(0, DeclarationContext);
    }
    expression() {
        return this.tryGetRuleContext(0, ExpressionContext);
    }
    SEMI() { return this.tryGetToken(cNextParser.SEMI, 0); }
    functionCall() {
        return this.tryGetRuleContext(0, FunctionCallContext);
    }
    methodCall() {
        return this.tryGetRuleContext(0, MethodCallContext);
    }
    ID() { return this.tryGetToken(cNextParser.ID, 0); }
    ASSIGN() { return this.tryGetToken(cNextParser.ASSIGN, 0); }
    value() {
        return this.tryGetRuleContext(0, ValueContext);
    }
    RETURN() { return this.tryGetToken(cNextParser.RETURN, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_statement; }
    // @Override
    enterRule(listener) {
        if (listener.enterStatement) {
            listener.enterStatement(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitStatement) {
            listener.exitStatement(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitStatement) {
            return visitor.visitStatement(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.StatementContext = StatementContext;
class Type_specifierContext extends ParserRuleContext_1.ParserRuleContext {
    TYPE_INT8() { return this.tryGetToken(cNextParser.TYPE_INT8, 0); }
    TYPE_INT16() { return this.tryGetToken(cNextParser.TYPE_INT16, 0); }
    TYPE_INT32() { return this.tryGetToken(cNextParser.TYPE_INT32, 0); }
    TYPE_INT64() { return this.tryGetToken(cNextParser.TYPE_INT64, 0); }
    TYPE_UINT8() { return this.tryGetToken(cNextParser.TYPE_UINT8, 0); }
    TYPE_UINT16() { return this.tryGetToken(cNextParser.TYPE_UINT16, 0); }
    TYPE_UINT32() { return this.tryGetToken(cNextParser.TYPE_UINT32, 0); }
    TYPE_UINT64() { return this.tryGetToken(cNextParser.TYPE_UINT64, 0); }
    TYPE_FLOAT32() { return this.tryGetToken(cNextParser.TYPE_FLOAT32, 0); }
    TYPE_FLOAT64() { return this.tryGetToken(cNextParser.TYPE_FLOAT64, 0); }
    TYPE_FLOAT96() { return this.tryGetToken(cNextParser.TYPE_FLOAT96, 0); }
    TYPE_STRING() { return this.tryGetToken(cNextParser.TYPE_STRING, 0); }
    TYPE_BOOLEAN() { return this.tryGetToken(cNextParser.TYPE_BOOLEAN, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_type_specifier; }
    // @Override
    enterRule(listener) {
        if (listener.enterType_specifier) {
            listener.enterType_specifier(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitType_specifier) {
            listener.exitType_specifier(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitType_specifier) {
            return visitor.visitType_specifier(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.Type_specifierContext = Type_specifierContext;
class ValueContext extends ParserRuleContext_1.ParserRuleContext {
    NUMBER() { return this.tryGetToken(cNextParser.NUMBER, 0); }
    STRING() { return this.tryGetToken(cNextParser.STRING, 0); }
    ID() { return this.tryGetToken(cNextParser.ID, 0); }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_value; }
    // @Override
    enterRule(listener) {
        if (listener.enterValue) {
            listener.enterValue(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitValue) {
            listener.exitValue(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitValue) {
            return visitor.visitValue(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ValueContext = ValueContext;
class FunctionCallContext extends ParserRuleContext_1.ParserRuleContext {
    ID() { return this.getToken(cNextParser.ID, 0); }
    LPAREN() { return this.getToken(cNextParser.LPAREN, 0); }
    RPAREN() { return this.getToken(cNextParser.RPAREN, 0); }
    argumentList() {
        return this.tryGetRuleContext(0, ArgumentListContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_functionCall; }
    // @Override
    enterRule(listener) {
        if (listener.enterFunctionCall) {
            listener.enterFunctionCall(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitFunctionCall) {
            listener.exitFunctionCall(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitFunctionCall) {
            return visitor.visitFunctionCall(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.FunctionCallContext = FunctionCallContext;
class MethodCallContext extends ParserRuleContext_1.ParserRuleContext {
    ID(i) {
        if (i === undefined) {
            return this.getTokens(cNextParser.ID);
        }
        else {
            return this.getToken(cNextParser.ID, i);
        }
    }
    DOT() { return this.getToken(cNextParser.DOT, 0); }
    LPAREN() { return this.getToken(cNextParser.LPAREN, 0); }
    RPAREN() { return this.getToken(cNextParser.RPAREN, 0); }
    argumentList() {
        return this.tryGetRuleContext(0, ArgumentListContext);
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_methodCall; }
    // @Override
    enterRule(listener) {
        if (listener.enterMethodCall) {
            listener.enterMethodCall(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitMethodCall) {
            listener.exitMethodCall(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitMethodCall) {
            return visitor.visitMethodCall(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.MethodCallContext = MethodCallContext;
class ArgumentListContext extends ParserRuleContext_1.ParserRuleContext {
    expression(i) {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }
        else {
            return this.getRuleContext(i, ExpressionContext);
        }
    }
    COMMA(i) {
        if (i === undefined) {
            return this.getTokens(cNextParser.COMMA);
        }
        else {
            return this.getToken(cNextParser.COMMA, i);
        }
    }
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_argumentList; }
    // @Override
    enterRule(listener) {
        if (listener.enterArgumentList) {
            listener.enterArgumentList(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitArgumentList) {
            listener.exitArgumentList(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitArgumentList) {
            return visitor.visitArgumentList(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ArgumentListContext = ArgumentListContext;
class ExpressionContext extends ParserRuleContext_1.ParserRuleContext {
    constructor(parent, invokingState) {
        super(parent, invokingState);
    }
    // @Override
    get ruleIndex() { return cNextParser.RULE_expression; }
    copyFrom(ctx) {
        super.copyFrom(ctx);
    }
}
exports.ExpressionContext = ExpressionContext;
class ValueExprContext extends ExpressionContext {
    value() {
        return this.getRuleContext(0, ValueContext);
    }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    enterRule(listener) {
        if (listener.enterValueExpr) {
            listener.enterValueExpr(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitValueExpr) {
            listener.exitValueExpr(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitValueExpr) {
            return visitor.visitValueExpr(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ValueExprContext = ValueExprContext;
class AddExprContext extends ExpressionContext {
    expression(i) {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }
        else {
            return this.getRuleContext(i, ExpressionContext);
        }
    }
    PLUS() { return this.getToken(cNextParser.PLUS, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    enterRule(listener) {
        if (listener.enterAddExpr) {
            listener.enterAddExpr(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitAddExpr) {
            listener.exitAddExpr(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitAddExpr) {
            return visitor.visitAddExpr(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.AddExprContext = AddExprContext;
class SubExprContext extends ExpressionContext {
    expression(i) {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }
        else {
            return this.getRuleContext(i, ExpressionContext);
        }
    }
    MINUS() { return this.getToken(cNextParser.MINUS, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    enterRule(listener) {
        if (listener.enterSubExpr) {
            listener.enterSubExpr(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitSubExpr) {
            listener.exitSubExpr(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitSubExpr) {
            return visitor.visitSubExpr(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.SubExprContext = SubExprContext;
class MultExprContext extends ExpressionContext {
    expression(i) {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }
        else {
            return this.getRuleContext(i, ExpressionContext);
        }
    }
    MULT() { return this.getToken(cNextParser.MULT, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    enterRule(listener) {
        if (listener.enterMultExpr) {
            listener.enterMultExpr(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitMultExpr) {
            listener.exitMultExpr(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitMultExpr) {
            return visitor.visitMultExpr(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.MultExprContext = MultExprContext;
class DivExprContext extends ExpressionContext {
    expression(i) {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }
        else {
            return this.getRuleContext(i, ExpressionContext);
        }
    }
    DIV() { return this.getToken(cNextParser.DIV, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    enterRule(listener) {
        if (listener.enterDivExpr) {
            listener.enterDivExpr(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitDivExpr) {
            listener.exitDivExpr(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitDivExpr) {
            return visitor.visitDivExpr(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.DivExprContext = DivExprContext;
class ParenExprContext extends ExpressionContext {
    LPAREN() { return this.getToken(cNextParser.LPAREN, 0); }
    expression() {
        return this.getRuleContext(0, ExpressionContext);
    }
    RPAREN() { return this.getToken(cNextParser.RPAREN, 0); }
    constructor(ctx) {
        super(ctx.parent, ctx.invokingState);
        this.copyFrom(ctx);
    }
    // @Override
    enterRule(listener) {
        if (listener.enterParenExpr) {
            listener.enterParenExpr(this);
        }
    }
    // @Override
    exitRule(listener) {
        if (listener.exitParenExpr) {
            listener.exitParenExpr(this);
        }
    }
    // @Override
    accept(visitor) {
        if (visitor.visitParenExpr) {
            return visitor.visitParenExpr(this);
        }
        else {
            return visitor.visitChildren(this);
        }
    }
}
exports.ParenExprContext = ParenExprContext;
