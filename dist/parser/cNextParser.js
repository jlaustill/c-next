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
exports.ParenExprContext = exports.DivExprContext = exports.MultExprContext = exports.SubExprContext = exports.AddExprContext = exports.ValueExprContext = exports.ExpressionContext = exports.ValueContext = exports.Type_specifierContext = exports.StatementContext = exports.DeclarationContext = exports.ReturnTypeContext = exports.ParameterContext = exports.ParameterListContext = exports.FunctionDeclarationContext = exports.ClassFunctionContext = exports.RegularMemberContext = exports.StaticMemberContext = exports.ClassMembersContext = exports.ClassDeclarationContext = exports.MainSourceFileContext = exports.SourceFileContext = exports.cNextParser = void 0;
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
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 32;
                this.classDeclaration();
                this.state = 33;
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
                this.state = 41;
                this._errHandler.sync(this);
                switch (this._input.LA(1)) {
                    case cNextParser.T__0:
                    case cNextParser.TYPE_INT8:
                    case cNextParser.TYPE_INT16:
                    case cNextParser.TYPE_INT32:
                    case cNextParser.TYPE_INT64:
                    case cNextParser.TYPE_STRING:
                        {
                            this.state = 36;
                            this._errHandler.sync(this);
                            _la = this._input.LA(1);
                            do {
                                {
                                    {
                                        this.state = 35;
                                        this.functionDeclaration();
                                    }
                                }
                                this.state = 38;
                                this._errHandler.sync(this);
                                _la = this._input.LA(1);
                            } while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.T__0) | (1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_STRING))) !== 0));
                        }
                        break;
                    case cNextParser.STATIC:
                    case cNextParser.CLASS:
                        {
                            this.state = 40;
                            this.classDeclaration();
                        }
                        break;
                    default:
                        throw new NoViableAltException_1.NoViableAltException(this);
                }
                this.state = 43;
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
    classDeclaration() {
        let _localctx = new ClassDeclarationContext(this._ctx, this.state);
        this.enterRule(_localctx, 4, cNextParser.RULE_classDeclaration);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 46;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (_la === cNextParser.STATIC) {
                    {
                        this.state = 45;
                        this.match(cNextParser.STATIC);
                    }
                }
                this.state = 48;
                this.match(cNextParser.CLASS);
                this.state = 49;
                this.match(cNextParser.ID);
                this.state = 50;
                this.match(cNextParser.LBRACE);
                this.state = 51;
                this.classMembers();
                this.state = 52;
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
        this.enterRule(_localctx, 6, cNextParser.RULE_classMembers);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 58;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.T__0) | (1 << cNextParser.PUBLIC) | (1 << cNextParser.STATIC) | (1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_STRING))) !== 0)) {
                    {
                        this.state = 56;
                        this._errHandler.sync(this);
                        switch (this._input.LA(1)) {
                            case cNextParser.STATIC:
                                {
                                    this.state = 54;
                                    this.staticMember();
                                }
                                break;
                            case cNextParser.T__0:
                            case cNextParser.PUBLIC:
                            case cNextParser.TYPE_INT8:
                            case cNextParser.TYPE_INT16:
                            case cNextParser.TYPE_INT32:
                            case cNextParser.TYPE_INT64:
                            case cNextParser.TYPE_STRING:
                                {
                                    this.state = 55;
                                    this.regularMember();
                                }
                                break;
                            default:
                                throw new NoViableAltException_1.NoViableAltException(this);
                        }
                    }
                    this.state = 60;
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
        this.enterRule(_localctx, 8, cNextParser.RULE_staticMember);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 61;
                this.match(cNextParser.STATIC);
                this.state = 62;
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
        this.enterRule(_localctx, 10, cNextParser.RULE_regularMember);
        try {
            this.state = 66;
            this._errHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this._input, 5, this._ctx)) {
                case 1:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 64;
                        this.declaration();
                    }
                    break;
                case 2:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 65;
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
        this.enterRule(_localctx, 12, cNextParser.RULE_classFunction);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 69;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if (_la === cNextParser.PUBLIC) {
                    {
                        this.state = 68;
                        this.match(cNextParser.PUBLIC);
                    }
                }
                this.state = 71;
                this.returnType();
                this.state = 72;
                this.match(cNextParser.ID);
                this.state = 73;
                this.match(cNextParser.LPAREN);
                this.state = 75;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_STRING))) !== 0)) {
                    {
                        this.state = 74;
                        this.parameterList();
                    }
                }
                this.state = 77;
                this.match(cNextParser.RPAREN);
                this.state = 78;
                this.match(cNextParser.LBRACE);
                this.state = 82;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_STRING) | (1 << cNextParser.LPAREN) | (1 << cNextParser.RETURN) | (1 << cNextParser.ID) | (1 << cNextParser.NUMBER) | (1 << cNextParser.STRING))) !== 0)) {
                    {
                        {
                            this.state = 79;
                            this.statement();
                        }
                    }
                    this.state = 84;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 85;
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
        this.enterRule(_localctx, 14, cNextParser.RULE_functionDeclaration);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 87;
                this.returnType();
                this.state = 88;
                this.match(cNextParser.ID);
                this.state = 89;
                this.match(cNextParser.LPAREN);
                this.state = 91;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_STRING))) !== 0)) {
                    {
                        this.state = 90;
                        this.parameterList();
                    }
                }
                this.state = 93;
                this.match(cNextParser.RPAREN);
                this.state = 94;
                this.match(cNextParser.LBRACE);
                this.state = 98;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_STRING) | (1 << cNextParser.LPAREN) | (1 << cNextParser.RETURN) | (1 << cNextParser.ID) | (1 << cNextParser.NUMBER) | (1 << cNextParser.STRING))) !== 0)) {
                    {
                        {
                            this.state = 95;
                            this.statement();
                        }
                    }
                    this.state = 100;
                    this._errHandler.sync(this);
                    _la = this._input.LA(1);
                }
                this.state = 101;
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
        this.enterRule(_localctx, 16, cNextParser.RULE_parameterList);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 103;
                this.parameter();
                this.state = 108;
                this._errHandler.sync(this);
                _la = this._input.LA(1);
                while (_la === cNextParser.COMMA) {
                    {
                        {
                            this.state = 104;
                            this.match(cNextParser.COMMA);
                            this.state = 105;
                            this.parameter();
                        }
                    }
                    this.state = 110;
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
        this.enterRule(_localctx, 18, cNextParser.RULE_parameter);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 111;
                this.type_specifier();
                this.state = 112;
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
        this.enterRule(_localctx, 20, cNextParser.RULE_returnType);
        try {
            this.state = 116;
            this._errHandler.sync(this);
            switch (this._input.LA(1)) {
                case cNextParser.TYPE_INT8:
                case cNextParser.TYPE_INT16:
                case cNextParser.TYPE_INT32:
                case cNextParser.TYPE_INT64:
                case cNextParser.TYPE_STRING:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 114;
                        this.type_specifier();
                    }
                    break;
                case cNextParser.T__0:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 115;
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
        this.enterRule(_localctx, 22, cNextParser.RULE_declaration);
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 118;
                this.type_specifier();
                this.state = 119;
                this.match(cNextParser.ID);
                this.state = 120;
                this.match(cNextParser.ASSIGN);
                this.state = 121;
                this.value();
                this.state = 122;
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
        this.enterRule(_localctx, 24, cNextParser.RULE_statement);
        let _la;
        try {
            this.state = 133;
            this._errHandler.sync(this);
            switch (this._input.LA(1)) {
                case cNextParser.TYPE_INT8:
                case cNextParser.TYPE_INT16:
                case cNextParser.TYPE_INT32:
                case cNextParser.TYPE_INT64:
                case cNextParser.TYPE_STRING:
                    this.enterOuterAlt(_localctx, 1);
                    {
                        this.state = 124;
                        this.declaration();
                    }
                    break;
                case cNextParser.LPAREN:
                case cNextParser.ID:
                case cNextParser.NUMBER:
                case cNextParser.STRING:
                    this.enterOuterAlt(_localctx, 2);
                    {
                        this.state = 125;
                        this.expression(0);
                        this.state = 126;
                        this.match(cNextParser.SEMI);
                    }
                    break;
                case cNextParser.RETURN:
                    this.enterOuterAlt(_localctx, 3);
                    {
                        this.state = 128;
                        this.match(cNextParser.RETURN);
                        this.state = 130;
                        this._errHandler.sync(this);
                        _la = this._input.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.LPAREN) | (1 << cNextParser.ID) | (1 << cNextParser.NUMBER) | (1 << cNextParser.STRING))) !== 0)) {
                            {
                                this.state = 129;
                                this.expression(0);
                            }
                        }
                        this.state = 132;
                        this.match(cNextParser.SEMI);
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
    type_specifier() {
        let _localctx = new Type_specifierContext(this._ctx, this.state);
        this.enterRule(_localctx, 26, cNextParser.RULE_type_specifier);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 135;
                _la = this._input.LA(1);
                if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_STRING))) !== 0))) {
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
        this.enterRule(_localctx, 28, cNextParser.RULE_value);
        let _la;
        try {
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 137;
                _la = this._input.LA(1);
                if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.ID) | (1 << cNextParser.NUMBER) | (1 << cNextParser.STRING))) !== 0))) {
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
    expression(_p) {
        if (_p === undefined) {
            _p = 0;
        }
        let _parentctx = this._ctx;
        let _parentState = this.state;
        let _localctx = new ExpressionContext(this._ctx, _parentState);
        let _prevctx = _localctx;
        let _startState = 30;
        this.enterRecursionRule(_localctx, 30, cNextParser.RULE_expression, _p);
        try {
            let _alt;
            this.enterOuterAlt(_localctx, 1);
            {
                this.state = 145;
                this._errHandler.sync(this);
                switch (this._input.LA(1)) {
                    case cNextParser.ID:
                    case cNextParser.NUMBER:
                    case cNextParser.STRING:
                        {
                            _localctx = new ValueExprContext(_localctx);
                            this._ctx = _localctx;
                            _prevctx = _localctx;
                            this.state = 140;
                            this.value();
                        }
                        break;
                    case cNextParser.LPAREN:
                        {
                            _localctx = new ParenExprContext(_localctx);
                            this._ctx = _localctx;
                            _prevctx = _localctx;
                            this.state = 141;
                            this.match(cNextParser.LPAREN);
                            this.state = 142;
                            this.expression(0);
                            this.state = 143;
                            this.match(cNextParser.RPAREN);
                        }
                        break;
                    default:
                        throw new NoViableAltException_1.NoViableAltException(this);
                }
                this._ctx._stop = this._input.tryLT(-1);
                this.state = 161;
                this._errHandler.sync(this);
                _alt = this.interpreter.adaptivePredict(this._input, 17, this._ctx);
                while (_alt !== 2 && _alt !== ATN_1.ATN.INVALID_ALT_NUMBER) {
                    if (_alt === 1) {
                        if (this._parseListeners != null) {
                            this.triggerExitRuleEvent();
                        }
                        _prevctx = _localctx;
                        {
                            this.state = 159;
                            this._errHandler.sync(this);
                            switch (this.interpreter.adaptivePredict(this._input, 16, this._ctx)) {
                                case 1:
                                    {
                                        _localctx = new AddExprContext(new ExpressionContext(_parentctx, _parentState));
                                        this.pushNewRecursionContext(_localctx, _startState, cNextParser.RULE_expression);
                                        this.state = 147;
                                        if (!(this.precpred(this._ctx, 5))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 5)");
                                        }
                                        this.state = 148;
                                        this.match(cNextParser.PLUS);
                                        this.state = 149;
                                        this.expression(6);
                                    }
                                    break;
                                case 2:
                                    {
                                        _localctx = new SubExprContext(new ExpressionContext(_parentctx, _parentState));
                                        this.pushNewRecursionContext(_localctx, _startState, cNextParser.RULE_expression);
                                        this.state = 150;
                                        if (!(this.precpred(this._ctx, 4))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 4)");
                                        }
                                        this.state = 151;
                                        this.match(cNextParser.MINUS);
                                        this.state = 152;
                                        this.expression(5);
                                    }
                                    break;
                                case 3:
                                    {
                                        _localctx = new MultExprContext(new ExpressionContext(_parentctx, _parentState));
                                        this.pushNewRecursionContext(_localctx, _startState, cNextParser.RULE_expression);
                                        this.state = 153;
                                        if (!(this.precpred(this._ctx, 3))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 3)");
                                        }
                                        this.state = 154;
                                        this.match(cNextParser.MULT);
                                        this.state = 155;
                                        this.expression(4);
                                    }
                                    break;
                                case 4:
                                    {
                                        _localctx = new DivExprContext(new ExpressionContext(_parentctx, _parentState));
                                        this.pushNewRecursionContext(_localctx, _startState, cNextParser.RULE_expression);
                                        this.state = 156;
                                        if (!(this.precpred(this._ctx, 2))) {
                                            throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
                                        }
                                        this.state = 157;
                                        this.match(cNextParser.DIV);
                                        this.state = 158;
                                        this.expression(3);
                                    }
                                    break;
                            }
                        }
                    }
                    this.state = 163;
                    this._errHandler.sync(this);
                    _alt = this.interpreter.adaptivePredict(this._input, 17, this._ctx);
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
            case 15:
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
cNextParser.PUBLIC = 2;
cNextParser.STATIC = 3;
cNextParser.CLASS = 4;
cNextParser.TYPE_INT8 = 5;
cNextParser.TYPE_INT16 = 6;
cNextParser.TYPE_INT32 = 7;
cNextParser.TYPE_INT64 = 8;
cNextParser.TYPE_STRING = 9;
cNextParser.ASSIGN = 10;
cNextParser.SEMI = 11;
cNextParser.LBRACE = 12;
cNextParser.RBRACE = 13;
cNextParser.LPAREN = 14;
cNextParser.RPAREN = 15;
cNextParser.COMMA = 16;
cNextParser.RETURN = 17;
cNextParser.PLUS = 18;
cNextParser.MINUS = 19;
cNextParser.MULT = 20;
cNextParser.DIV = 21;
cNextParser.ID = 22;
cNextParser.NUMBER = 23;
cNextParser.STRING = 24;
cNextParser.WS = 25;
cNextParser.RULE_sourceFile = 0;
cNextParser.RULE_mainSourceFile = 1;
cNextParser.RULE_classDeclaration = 2;
cNextParser.RULE_classMembers = 3;
cNextParser.RULE_staticMember = 4;
cNextParser.RULE_regularMember = 5;
cNextParser.RULE_classFunction = 6;
cNextParser.RULE_functionDeclaration = 7;
cNextParser.RULE_parameterList = 8;
cNextParser.RULE_parameter = 9;
cNextParser.RULE_returnType = 10;
cNextParser.RULE_declaration = 11;
cNextParser.RULE_statement = 12;
cNextParser.RULE_type_specifier = 13;
cNextParser.RULE_value = 14;
cNextParser.RULE_expression = 15;
// tslint:disable:no-trailing-whitespace
cNextParser.ruleNames = [
    "sourceFile", "mainSourceFile", "classDeclaration", "classMembers", "staticMember",
    "regularMember", "classFunction", "functionDeclaration", "parameterList",
    "parameter", "returnType", "declaration", "statement", "type_specifier",
    "value", "expression",
];
cNextParser._LITERAL_NAMES = [
    undefined, "'void'", "'public'", "'static'", "'class'", "'int8'", "'int16'",
    "'int32'", "'int64'", "'String'", "'<-'", "';'", "'{'", "'}'", "'('",
    "')'", "','", "'return'", "'+'", "'-'", "'*'", "'/'",
];
cNextParser._SYMBOLIC_NAMES = [
    undefined, undefined, "PUBLIC", "STATIC", "CLASS", "TYPE_INT8", "TYPE_INT16",
    "TYPE_INT32", "TYPE_INT64", "TYPE_STRING", "ASSIGN", "SEMI", "LBRACE",
    "RBRACE", "LPAREN", "RPAREN", "COMMA", "RETURN", "PLUS", "MINUS", "MULT",
    "DIV", "ID", "NUMBER", "STRING", "WS",
];
cNextParser.VOCABULARY = new VocabularyImpl_1.VocabularyImpl(cNextParser._LITERAL_NAMES, cNextParser._SYMBOLIC_NAMES, []);
cNextParser._serializedATN = "\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03\x1B\xA7\x04\x02" +
    "\t\x02\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06\x04\x07" +
    "\t\x07\x04\b\t\b\x04\t\t\t\x04\n\t\n\x04\v\t\v\x04\f\t\f\x04\r\t\r\x04" +
    "\x0E\t\x0E\x04\x0F\t\x0F\x04\x10\t\x10\x04\x11\t\x11\x03\x02\x03\x02\x03" +
    "\x02\x03\x03\x06\x03\'\n\x03\r\x03\x0E\x03(\x03\x03\x05\x03,\n\x03\x03" +
    "\x03\x03\x03\x03\x04\x05\x041\n\x04\x03\x04\x03\x04\x03\x04\x03\x04\x03" +
    "\x04\x03\x04\x03\x05\x03\x05\x07\x05;\n\x05\f\x05\x0E\x05>\v\x05\x03\x06" +
    "\x03\x06\x03\x06\x03\x07\x03\x07\x05\x07E\n\x07\x03\b\x05\bH\n\b\x03\b" +
    "\x03\b\x03\b\x03\b\x05\bN\n\b\x03\b\x03\b\x03\b\x07\bS\n\b\f\b\x0E\bV" +
    "\v\b\x03\b\x03\b\x03\t\x03\t\x03\t\x03\t\x05\t^\n\t\x03\t\x03\t\x03\t" +
    "\x07\tc\n\t\f\t\x0E\tf\v\t\x03\t\x03\t\x03\n\x03\n\x03\n\x07\nm\n\n\f" +
    "\n\x0E\np\v\n\x03\v\x03\v\x03\v\x03\f\x03\f\x05\fw\n\f\x03\r\x03\r\x03" +
    "\r\x03\r\x03\r\x03\r\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x03\x0E\x05" +
    "\x0E\x85\n\x0E\x03\x0E\x05\x0E\x88\n\x0E\x03\x0F\x03\x0F\x03\x10\x03\x10" +
    "\x03\x11\x03\x11\x03\x11\x03\x11\x03\x11\x03\x11\x05\x11\x94\n\x11\x03" +
    "\x11\x03\x11\x03\x11\x03\x11\x03\x11\x03\x11\x03\x11\x03\x11\x03\x11\x03" +
    "\x11\x03\x11\x03\x11\x07\x11\xA2\n\x11\f\x11\x0E\x11\xA5\v\x11\x03\x11" +
    "\x02\x02\x03 \x12\x02\x02\x04\x02\x06\x02\b\x02\n\x02\f\x02\x0E\x02\x10" +
    "\x02\x12\x02\x14\x02\x16\x02\x18\x02\x1A\x02\x1C\x02\x1E\x02 \x02\x02" +
    "\x04\x03\x02\x07\v\x03\x02\x18\x1A\x02\xAB\x02\"\x03\x02\x02\x02\x04+" +
    "\x03\x02\x02\x02\x060\x03\x02\x02\x02\b<\x03\x02\x02\x02\n?\x03\x02\x02" +
    "\x02\fD\x03\x02\x02\x02\x0EG\x03\x02\x02\x02\x10Y\x03\x02\x02\x02\x12" +
    "i\x03\x02\x02\x02\x14q\x03\x02\x02\x02\x16v\x03\x02\x02\x02\x18x\x03\x02" +
    "\x02\x02\x1A\x87\x03\x02\x02\x02\x1C\x89\x03\x02\x02\x02\x1E\x8B\x03\x02" +
    "\x02\x02 \x93\x03\x02\x02\x02\"#\x05\x06\x04\x02#$\x07\x02\x02\x03$\x03" +
    "\x03\x02\x02\x02%\'\x05\x10\t\x02&%\x03\x02\x02\x02\'(\x03\x02\x02\x02" +
    "(&\x03\x02\x02\x02()\x03\x02\x02\x02),\x03\x02\x02\x02*,\x05\x06\x04\x02" +
    "+&\x03\x02\x02\x02+*\x03\x02\x02\x02,-\x03\x02\x02\x02-.\x07\x02\x02\x03" +
    ".\x05\x03\x02\x02\x02/1\x07\x05\x02\x020/\x03\x02\x02\x0201\x03\x02\x02" +
    "\x0212\x03\x02\x02\x0223\x07\x06\x02\x0234\x07\x18\x02\x0245\x07\x0E\x02" +
    "\x0256\x05\b\x05\x0267\x07\x0F\x02\x027\x07\x03\x02\x02\x028;\x05\n\x06" +
    "\x029;\x05\f\x07\x02:8\x03\x02\x02\x02:9\x03\x02\x02\x02;>\x03\x02\x02" +
    "\x02<:\x03\x02\x02\x02<=\x03\x02\x02\x02=\t\x03\x02\x02\x02><\x03\x02" +
    "\x02\x02?@\x07\x05\x02\x02@A\x05\x18\r\x02A\v\x03\x02\x02\x02BE\x05\x18" +
    "\r\x02CE\x05\x0E\b\x02DB\x03\x02\x02\x02DC\x03\x02\x02\x02E\r\x03\x02" +
    "\x02\x02FH\x07\x04\x02\x02GF\x03\x02\x02\x02GH\x03\x02\x02\x02HI\x03\x02" +
    "\x02\x02IJ\x05\x16\f\x02JK\x07\x18\x02\x02KM\x07\x10\x02\x02LN\x05\x12" +
    "\n\x02ML\x03\x02\x02\x02MN\x03\x02\x02\x02NO\x03\x02\x02\x02OP\x07\x11" +
    "\x02\x02PT\x07\x0E\x02\x02QS\x05\x1A\x0E\x02RQ\x03\x02\x02\x02SV\x03\x02" +
    "\x02\x02TR\x03\x02\x02\x02TU\x03\x02\x02\x02UW\x03\x02\x02\x02VT\x03\x02" +
    "\x02\x02WX\x07\x0F\x02\x02X\x0F\x03\x02\x02\x02YZ\x05\x16\f\x02Z[\x07" +
    "\x18\x02\x02[]\x07\x10\x02\x02\\^\x05\x12\n\x02]\\\x03\x02\x02\x02]^\x03" +
    "\x02\x02\x02^_\x03\x02\x02\x02_`\x07\x11\x02\x02`d\x07\x0E\x02\x02ac\x05" +
    "\x1A\x0E\x02ba\x03\x02\x02\x02cf\x03\x02\x02\x02db\x03\x02\x02\x02de\x03" +
    "\x02\x02\x02eg\x03\x02\x02\x02fd\x03\x02\x02\x02gh\x07\x0F\x02\x02h\x11" +
    "\x03\x02\x02\x02in\x05\x14\v\x02jk\x07\x12\x02\x02km\x05\x14\v\x02lj\x03" +
    "\x02\x02\x02mp\x03\x02\x02\x02nl\x03\x02\x02\x02no\x03\x02\x02\x02o\x13" +
    "\x03\x02\x02\x02pn\x03\x02\x02\x02qr\x05\x1C\x0F\x02rs\x07\x18\x02\x02" +
    "s\x15\x03\x02\x02\x02tw\x05\x1C\x0F\x02uw\x07\x03\x02\x02vt\x03\x02\x02" +
    "\x02vu\x03\x02\x02\x02w\x17\x03\x02\x02\x02xy\x05\x1C\x0F\x02yz\x07\x18" +
    "\x02\x02z{\x07\f\x02\x02{|\x05\x1E\x10\x02|}\x07\r\x02\x02}\x19\x03\x02" +
    "\x02\x02~\x88\x05\x18\r\x02\x7F\x80\x05 \x11\x02\x80\x81\x07\r\x02\x02" +
    "\x81\x88\x03\x02\x02\x02\x82\x84\x07\x13\x02\x02\x83\x85\x05 \x11\x02" +
    "\x84\x83\x03\x02\x02\x02\x84\x85\x03\x02\x02\x02\x85\x86\x03\x02\x02\x02" +
    "\x86\x88\x07\r\x02\x02\x87~\x03\x02\x02\x02\x87\x7F\x03\x02\x02\x02\x87" +
    "\x82\x03\x02\x02\x02\x88\x1B\x03\x02\x02\x02\x89\x8A\t\x02\x02\x02\x8A" +
    "\x1D\x03\x02\x02\x02\x8B\x8C\t\x03\x02\x02\x8C\x1F\x03\x02\x02\x02\x8D" +
    "\x8E\b\x11\x01\x02\x8E\x94\x05\x1E\x10\x02\x8F\x90\x07\x10\x02\x02\x90" +
    "\x91\x05 \x11\x02\x91\x92\x07\x11\x02\x02\x92\x94\x03\x02\x02\x02\x93" +
    "\x8D\x03\x02\x02\x02\x93\x8F\x03\x02\x02\x02\x94\xA3\x03\x02\x02\x02\x95" +
    "\x96\f\x07\x02\x02\x96\x97\x07\x14\x02\x02\x97\xA2\x05 \x11\b\x98\x99" +
    "\f\x06\x02\x02\x99\x9A\x07\x15\x02\x02\x9A\xA2\x05 \x11\x07\x9B\x9C\f" +
    "\x05\x02\x02\x9C\x9D\x07\x16\x02\x02\x9D\xA2\x05 \x11\x06\x9E\x9F\f\x04" +
    "\x02\x02\x9F\xA0\x07\x17\x02\x02\xA0\xA2\x05 \x11\x05\xA1\x95\x03\x02" +
    "\x02\x02\xA1\x98\x03\x02\x02\x02\xA1\x9B\x03\x02\x02\x02\xA1\x9E\x03\x02" +
    "\x02\x02\xA2\xA5\x03\x02\x02\x02\xA3\xA1\x03\x02\x02\x02\xA3\xA4\x03\x02" +
    "\x02\x02\xA4!\x03\x02\x02\x02\xA5\xA3\x03\x02\x02\x02\x14(+0:<DGMT]dn" +
    "v\x84\x87\x93\xA1\xA3";
class SourceFileContext extends ParserRuleContext_1.ParserRuleContext {
    classDeclaration() {
        return this.getRuleContext(0, ClassDeclarationContext);
    }
    EOF() { return this.getToken(cNextParser.EOF, 0); }
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
    classDeclaration() {
        return this.tryGetRuleContext(0, ClassDeclarationContext);
    }
    functionDeclaration(i) {
        if (i === undefined) {
            return this.getRuleContexts(FunctionDeclarationContext);
        }
        else {
            return this.getRuleContext(i, FunctionDeclarationContext);
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
class ClassDeclarationContext extends ParserRuleContext_1.ParserRuleContext {
    CLASS() { return this.getToken(cNextParser.CLASS, 0); }
    ID() { return this.getToken(cNextParser.ID, 0); }
    LBRACE() { return this.getToken(cNextParser.LBRACE, 0); }
    classMembers() {
        return this.getRuleContext(0, ClassMembersContext);
    }
    RBRACE() { return this.getToken(cNextParser.RBRACE, 0); }
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
    ASSIGN() { return this.getToken(cNextParser.ASSIGN, 0); }
    value() {
        return this.getRuleContext(0, ValueContext);
    }
    SEMI() { return this.getToken(cNextParser.SEMI, 0); }
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
    TYPE_STRING() { return this.tryGetToken(cNextParser.TYPE_STRING, 0); }
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
