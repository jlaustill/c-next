// Generated from cNext.g4 by ANTLR 4.9.0-SNAPSHOT


import { ATN } from "antlr4ts/atn/ATN";
import { ATNDeserializer } from "antlr4ts/atn/ATNDeserializer";
import { FailedPredicateException } from "antlr4ts/FailedPredicateException";
import { NotNull } from "antlr4ts/Decorators";
import { NoViableAltException } from "antlr4ts/NoViableAltException";
import { Override } from "antlr4ts/Decorators";
import { Parser } from "antlr4ts/Parser";
import { ParserRuleContext } from "antlr4ts/ParserRuleContext";
import { ParserATNSimulator } from "antlr4ts/atn/ParserATNSimulator";
import { ParseTreeListener } from "antlr4ts/tree/ParseTreeListener";
import { ParseTreeVisitor } from "antlr4ts/tree/ParseTreeVisitor";
import { RecognitionException } from "antlr4ts/RecognitionException";
import { RuleContext } from "antlr4ts/RuleContext";
//import { RuleVersion } from "antlr4ts/RuleVersion";
import { TerminalNode } from "antlr4ts/tree/TerminalNode";
import { Token } from "antlr4ts/Token";
import { TokenStream } from "antlr4ts/TokenStream";
import { Vocabulary } from "antlr4ts/Vocabulary";
import { VocabularyImpl } from "antlr4ts/VocabularyImpl";

import * as Utils from "antlr4ts/misc/Utils";

import { cNextListener } from "./cNextListener";
import { cNextVisitor } from "./cNextVisitor";


export class cNextParser extends Parser {
	public static readonly T__0 = 1;
	public static readonly IMPORT = 2;
	public static readonly INCLUDE = 3;
	public static readonly PUBLIC = 4;
	public static readonly STATIC = 5;
	public static readonly CLASS = 6;
	public static readonly TYPE_INT8 = 7;
	public static readonly TYPE_INT16 = 8;
	public static readonly TYPE_INT32 = 9;
	public static readonly TYPE_INT64 = 10;
	public static readonly TYPE_UINT8 = 11;
	public static readonly TYPE_UINT16 = 12;
	public static readonly TYPE_UINT32 = 13;
	public static readonly TYPE_UINT64 = 14;
	public static readonly TYPE_FLOAT32 = 15;
	public static readonly TYPE_FLOAT64 = 16;
	public static readonly TYPE_FLOAT96 = 17;
	public static readonly TYPE_STRING = 18;
	public static readonly TYPE_BOOLEAN = 19;
	public static readonly ASSIGN = 20;
	public static readonly SEMI = 21;
	public static readonly LBRACE = 22;
	public static readonly RBRACE = 23;
	public static readonly LPAREN = 24;
	public static readonly RPAREN = 25;
	public static readonly COMMA = 26;
	public static readonly RETURN = 27;
	public static readonly PLUS = 28;
	public static readonly MINUS = 29;
	public static readonly MULT = 30;
	public static readonly DIV = 31;
	public static readonly DOT = 32;
	public static readonly ID = 33;
	public static readonly NUMBER = 34;
	public static readonly STRING = 35;
	public static readonly FILENAME = 36;
	public static readonly WS = 37;
	public static readonly RULE_sourceFile = 0;
	public static readonly RULE_mainSourceFile = 1;
	public static readonly RULE_globalDeclaration = 2;
	public static readonly RULE_fileDirective = 3;
	public static readonly RULE_importDirective = 4;
	public static readonly RULE_includeDirective = 5;
	public static readonly RULE_classDeclaration = 6;
	public static readonly RULE_classMembers = 7;
	public static readonly RULE_staticMember = 8;
	public static readonly RULE_regularMember = 9;
	public static readonly RULE_classFunction = 10;
	public static readonly RULE_functionDeclaration = 11;
	public static readonly RULE_parameterList = 12;
	public static readonly RULE_parameter = 13;
	public static readonly RULE_returnType = 14;
	public static readonly RULE_declaration = 15;
	public static readonly RULE_statement = 16;
	public static readonly RULE_type_specifier = 17;
	public static readonly RULE_value = 18;
	public static readonly RULE_functionCall = 19;
	public static readonly RULE_methodCall = 20;
	public static readonly RULE_argumentList = 21;
	public static readonly RULE_expression = 22;
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"sourceFile", "mainSourceFile", "globalDeclaration", "fileDirective", 
		"importDirective", "includeDirective", "classDeclaration", "classMembers", 
		"staticMember", "regularMember", "classFunction", "functionDeclaration", 
		"parameterList", "parameter", "returnType", "declaration", "statement", 
		"type_specifier", "value", "functionCall", "methodCall", "argumentList", 
		"expression",
	];

	private static readonly _LITERAL_NAMES: Array<string | undefined> = [
		undefined, "'void'", "'import'", "'#include'", "'public'", "'static'", 
		"'class'", "'int8'", "'int16'", "'int32'", "'int64'", "'uint8'", "'uint16'", 
		"'uint32'", "'uint64'", "'float32'", "'float64'", "'float96'", "'String'", 
		"'boolean'", "'<-'", "';'", "'{'", "'}'", "'('", "')'", "','", "'return'", 
		"'+'", "'-'", "'*'", "'/'", "'.'",
	];
	private static readonly _SYMBOLIC_NAMES: Array<string | undefined> = [
		undefined, undefined, "IMPORT", "INCLUDE", "PUBLIC", "STATIC", "CLASS", 
		"TYPE_INT8", "TYPE_INT16", "TYPE_INT32", "TYPE_INT64", "TYPE_UINT8", "TYPE_UINT16", 
		"TYPE_UINT32", "TYPE_UINT64", "TYPE_FLOAT32", "TYPE_FLOAT64", "TYPE_FLOAT96", 
		"TYPE_STRING", "TYPE_BOOLEAN", "ASSIGN", "SEMI", "LBRACE", "RBRACE", "LPAREN", 
		"RPAREN", "COMMA", "RETURN", "PLUS", "MINUS", "MULT", "DIV", "DOT", "ID", 
		"NUMBER", "STRING", "FILENAME", "WS",
	];
	public static readonly VOCABULARY: Vocabulary = new VocabularyImpl(cNextParser._LITERAL_NAMES, cNextParser._SYMBOLIC_NAMES, []);

	// @Override
	// @NotNull
	public get vocabulary(): Vocabulary {
		return cNextParser.VOCABULARY;
	}
	// tslint:enable:no-trailing-whitespace

	// @Override
	public get grammarFileName(): string { return "cNext.g4"; }

	// @Override
	public get ruleNames(): string[] { return cNextParser.ruleNames; }

	// @Override
	public get serializedATN(): string { return cNextParser._serializedATN; }

	protected createFailedPredicateException(predicate?: string, message?: string): FailedPredicateException {
		return new FailedPredicateException(this, predicate, message);
	}

	constructor(input: TokenStream) {
		super(input);
		this._interp = new ParserATNSimulator(cNextParser._ATN, this);
	}
	// @RuleVersion(0)
	public sourceFile(): SourceFileContext {
		let _localctx: SourceFileContext = new SourceFileContext(this._ctx, this.state);
		this.enterRule(_localctx, 0, cNextParser.RULE_sourceFile);
		let _la: number;
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
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public mainSourceFile(): MainSourceFileContext {
		let _localctx: MainSourceFileContext = new MainSourceFileContext(this._ctx, this.state);
		this.enterRule(_localctx, 2, cNextParser.RULE_mainSourceFile);
		let _la: number;
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
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.T__0) | (1 << cNextParser.STATIC) | (1 << cNextParser.CLASS) | (1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_UINT8) | (1 << cNextParser.TYPE_UINT16) | (1 << cNextParser.TYPE_UINT32) | (1 << cNextParser.TYPE_UINT64) | (1 << cNextParser.TYPE_FLOAT32) | (1 << cNextParser.TYPE_FLOAT64) | (1 << cNextParser.TYPE_FLOAT96) | (1 << cNextParser.TYPE_STRING) | (1 << cNextParser.TYPE_BOOLEAN))) !== 0) || _la === cNextParser.ID) {
				{
				this.state = 64;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case cNextParser.ID:
					{
					this.state = 61;
					this.globalDeclaration();
					}
					break;
				case cNextParser.T__0:
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
					{
					this.state = 62;
					this.functionDeclaration();
					}
					break;
				case cNextParser.STATIC:
				case cNextParser.CLASS:
					{
					this.state = 63;
					this.classDeclaration();
					}
					break;
				default:
					throw new NoViableAltException(this);
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
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public globalDeclaration(): GlobalDeclarationContext {
		let _localctx: GlobalDeclarationContext = new GlobalDeclarationContext(this._ctx, this.state);
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
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public fileDirective(): FileDirectiveContext {
		let _localctx: FileDirectiveContext = new FileDirectiveContext(this._ctx, this.state);
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
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public importDirective(): ImportDirectiveContext {
		let _localctx: ImportDirectiveContext = new ImportDirectiveContext(this._ctx, this.state);
		this.enterRule(_localctx, 8, cNextParser.RULE_importDirective);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 79;
			this.match(cNextParser.IMPORT);
			this.state = 80;
			this.match(cNextParser.FILENAME);
			this.state = 81;
			this.match(cNextParser.SEMI);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public includeDirective(): IncludeDirectiveContext {
		let _localctx: IncludeDirectiveContext = new IncludeDirectiveContext(this._ctx, this.state);
		this.enterRule(_localctx, 10, cNextParser.RULE_includeDirective);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 83;
			this.match(cNextParser.INCLUDE);
			this.state = 84;
			this.match(cNextParser.FILENAME);
			this.state = 85;
			this.match(cNextParser.SEMI);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public classDeclaration(): ClassDeclarationContext {
		let _localctx: ClassDeclarationContext = new ClassDeclarationContext(this._ctx, this.state);
		this.enterRule(_localctx, 12, cNextParser.RULE_classDeclaration);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 88;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === cNextParser.STATIC) {
				{
				this.state = 87;
				this.match(cNextParser.STATIC);
				}
			}

			this.state = 90;
			this.match(cNextParser.CLASS);
			this.state = 91;
			this.match(cNextParser.ID);
			this.state = 92;
			this.match(cNextParser.LBRACE);
			this.state = 93;
			this.classMembers();
			this.state = 94;
			this.match(cNextParser.RBRACE);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public classMembers(): ClassMembersContext {
		let _localctx: ClassMembersContext = new ClassMembersContext(this._ctx, this.state);
		this.enterRule(_localctx, 14, cNextParser.RULE_classMembers);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 100;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.T__0) | (1 << cNextParser.PUBLIC) | (1 << cNextParser.STATIC) | (1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_UINT8) | (1 << cNextParser.TYPE_UINT16) | (1 << cNextParser.TYPE_UINT32) | (1 << cNextParser.TYPE_UINT64) | (1 << cNextParser.TYPE_FLOAT32) | (1 << cNextParser.TYPE_FLOAT64) | (1 << cNextParser.TYPE_FLOAT96) | (1 << cNextParser.TYPE_STRING) | (1 << cNextParser.TYPE_BOOLEAN))) !== 0)) {
				{
				this.state = 98;
				this._errHandler.sync(this);
				switch (this._input.LA(1)) {
				case cNextParser.STATIC:
					{
					this.state = 96;
					this.staticMember();
					}
					break;
				case cNextParser.T__0:
				case cNextParser.PUBLIC:
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
					{
					this.state = 97;
					this.regularMember();
					}
					break;
				default:
					throw new NoViableAltException(this);
				}
				}
				this.state = 102;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public staticMember(): StaticMemberContext {
		let _localctx: StaticMemberContext = new StaticMemberContext(this._ctx, this.state);
		this.enterRule(_localctx, 16, cNextParser.RULE_staticMember);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 103;
			this.match(cNextParser.STATIC);
			this.state = 104;
			this.declaration();
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public regularMember(): RegularMemberContext {
		let _localctx: RegularMemberContext = new RegularMemberContext(this._ctx, this.state);
		this.enterRule(_localctx, 18, cNextParser.RULE_regularMember);
		try {
			this.state = 108;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 8, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 106;
				this.declaration();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 107;
				this.classFunction();
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public classFunction(): ClassFunctionContext {
		let _localctx: ClassFunctionContext = new ClassFunctionContext(this._ctx, this.state);
		this.enterRule(_localctx, 20, cNextParser.RULE_classFunction);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 111;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (_la === cNextParser.PUBLIC) {
				{
				this.state = 110;
				this.match(cNextParser.PUBLIC);
				}
			}

			this.state = 113;
			this.returnType();
			this.state = 114;
			this.match(cNextParser.ID);
			this.state = 115;
			this.match(cNextParser.LPAREN);
			this.state = 117;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_UINT8) | (1 << cNextParser.TYPE_UINT16) | (1 << cNextParser.TYPE_UINT32) | (1 << cNextParser.TYPE_UINT64) | (1 << cNextParser.TYPE_FLOAT32) | (1 << cNextParser.TYPE_FLOAT64) | (1 << cNextParser.TYPE_FLOAT96) | (1 << cNextParser.TYPE_STRING) | (1 << cNextParser.TYPE_BOOLEAN))) !== 0)) {
				{
				this.state = 116;
				this.parameterList();
				}
			}

			this.state = 119;
			this.match(cNextParser.RPAREN);
			this.state = 120;
			this.match(cNextParser.LBRACE);
			this.state = 124;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & ((1 << (cNextParser.TYPE_INT8 - 7)) | (1 << (cNextParser.TYPE_INT16 - 7)) | (1 << (cNextParser.TYPE_INT32 - 7)) | (1 << (cNextParser.TYPE_INT64 - 7)) | (1 << (cNextParser.TYPE_UINT8 - 7)) | (1 << (cNextParser.TYPE_UINT16 - 7)) | (1 << (cNextParser.TYPE_UINT32 - 7)) | (1 << (cNextParser.TYPE_UINT64 - 7)) | (1 << (cNextParser.TYPE_FLOAT32 - 7)) | (1 << (cNextParser.TYPE_FLOAT64 - 7)) | (1 << (cNextParser.TYPE_FLOAT96 - 7)) | (1 << (cNextParser.TYPE_STRING - 7)) | (1 << (cNextParser.TYPE_BOOLEAN - 7)) | (1 << (cNextParser.LPAREN - 7)) | (1 << (cNextParser.RETURN - 7)) | (1 << (cNextParser.ID - 7)) | (1 << (cNextParser.NUMBER - 7)) | (1 << (cNextParser.STRING - 7)))) !== 0)) {
				{
				{
				this.state = 121;
				this.statement();
				}
				}
				this.state = 126;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 127;
			this.match(cNextParser.RBRACE);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public functionDeclaration(): FunctionDeclarationContext {
		let _localctx: FunctionDeclarationContext = new FunctionDeclarationContext(this._ctx, this.state);
		this.enterRule(_localctx, 22, cNextParser.RULE_functionDeclaration);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 129;
			this.returnType();
			this.state = 130;
			this.match(cNextParser.ID);
			this.state = 131;
			this.match(cNextParser.LPAREN);
			this.state = 133;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if ((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_UINT8) | (1 << cNextParser.TYPE_UINT16) | (1 << cNextParser.TYPE_UINT32) | (1 << cNextParser.TYPE_UINT64) | (1 << cNextParser.TYPE_FLOAT32) | (1 << cNextParser.TYPE_FLOAT64) | (1 << cNextParser.TYPE_FLOAT96) | (1 << cNextParser.TYPE_STRING) | (1 << cNextParser.TYPE_BOOLEAN))) !== 0)) {
				{
				this.state = 132;
				this.parameterList();
				}
			}

			this.state = 135;
			this.match(cNextParser.RPAREN);
			this.state = 136;
			this.match(cNextParser.LBRACE);
			this.state = 140;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (((((_la - 7)) & ~0x1F) === 0 && ((1 << (_la - 7)) & ((1 << (cNextParser.TYPE_INT8 - 7)) | (1 << (cNextParser.TYPE_INT16 - 7)) | (1 << (cNextParser.TYPE_INT32 - 7)) | (1 << (cNextParser.TYPE_INT64 - 7)) | (1 << (cNextParser.TYPE_UINT8 - 7)) | (1 << (cNextParser.TYPE_UINT16 - 7)) | (1 << (cNextParser.TYPE_UINT32 - 7)) | (1 << (cNextParser.TYPE_UINT64 - 7)) | (1 << (cNextParser.TYPE_FLOAT32 - 7)) | (1 << (cNextParser.TYPE_FLOAT64 - 7)) | (1 << (cNextParser.TYPE_FLOAT96 - 7)) | (1 << (cNextParser.TYPE_STRING - 7)) | (1 << (cNextParser.TYPE_BOOLEAN - 7)) | (1 << (cNextParser.LPAREN - 7)) | (1 << (cNextParser.RETURN - 7)) | (1 << (cNextParser.ID - 7)) | (1 << (cNextParser.NUMBER - 7)) | (1 << (cNextParser.STRING - 7)))) !== 0)) {
				{
				{
				this.state = 137;
				this.statement();
				}
				}
				this.state = 142;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			this.state = 143;
			this.match(cNextParser.RBRACE);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public parameterList(): ParameterListContext {
		let _localctx: ParameterListContext = new ParameterListContext(this._ctx, this.state);
		this.enterRule(_localctx, 24, cNextParser.RULE_parameterList);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 145;
			this.parameter();
			this.state = 150;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === cNextParser.COMMA) {
				{
				{
				this.state = 146;
				this.match(cNextParser.COMMA);
				this.state = 147;
				this.parameter();
				}
				}
				this.state = 152;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public parameter(): ParameterContext {
		let _localctx: ParameterContext = new ParameterContext(this._ctx, this.state);
		this.enterRule(_localctx, 26, cNextParser.RULE_parameter);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 153;
			this.type_specifier();
			this.state = 154;
			this.match(cNextParser.ID);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public returnType(): ReturnTypeContext {
		let _localctx: ReturnTypeContext = new ReturnTypeContext(this._ctx, this.state);
		this.enterRule(_localctx, 28, cNextParser.RULE_returnType);
		try {
			this.state = 158;
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
				this.state = 156;
				this.type_specifier();
				}
				break;
			case cNextParser.T__0:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 157;
				this.match(cNextParser.T__0);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public declaration(): DeclarationContext {
		let _localctx: DeclarationContext = new DeclarationContext(this._ctx, this.state);
		this.enterRule(_localctx, 30, cNextParser.RULE_declaration);
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 160;
			this.type_specifier();
			this.state = 161;
			this.match(cNextParser.ID);
			this.state = 162;
			this.match(cNextParser.ASSIGN);
			this.state = 163;
			this.value();
			this.state = 164;
			this.match(cNextParser.SEMI);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public statement(): StatementContext {
		let _localctx: StatementContext = new StatementContext(this._ctx, this.state);
		this.enterRule(_localctx, 32, cNextParser.RULE_statement);
		let _la: number;
		try {
			this.state = 181;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 17, this._ctx) ) {
			case 1:
				this.enterOuterAlt(_localctx, 1);
				{
				this.state = 166;
				this.declaration();
				}
				break;

			case 2:
				this.enterOuterAlt(_localctx, 2);
				{
				this.state = 167;
				this.expression(0);
				this.state = 168;
				this.match(cNextParser.SEMI);
				}
				break;

			case 3:
				this.enterOuterAlt(_localctx, 3);
				{
				this.state = 170;
				this.functionCall();
				this.state = 171;
				this.match(cNextParser.SEMI);
				}
				break;

			case 4:
				this.enterOuterAlt(_localctx, 4);
				{
				this.state = 173;
				this.methodCall();
				this.state = 174;
				this.match(cNextParser.SEMI);
				}
				break;

			case 5:
				this.enterOuterAlt(_localctx, 5);
				{
				this.state = 176;
				this.match(cNextParser.RETURN);
				this.state = 178;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
				if (((((_la - 24)) & ~0x1F) === 0 && ((1 << (_la - 24)) & ((1 << (cNextParser.LPAREN - 24)) | (1 << (cNextParser.ID - 24)) | (1 << (cNextParser.NUMBER - 24)) | (1 << (cNextParser.STRING - 24)))) !== 0)) {
					{
					this.state = 177;
					this.expression(0);
					}
				}

				this.state = 180;
				this.match(cNextParser.SEMI);
				}
				break;
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public type_specifier(): Type_specifierContext {
		let _localctx: Type_specifierContext = new Type_specifierContext(this._ctx, this.state);
		this.enterRule(_localctx, 34, cNextParser.RULE_type_specifier);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 183;
			_la = this._input.LA(1);
			if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_UINT8) | (1 << cNextParser.TYPE_UINT16) | (1 << cNextParser.TYPE_UINT32) | (1 << cNextParser.TYPE_UINT64) | (1 << cNextParser.TYPE_FLOAT32) | (1 << cNextParser.TYPE_FLOAT64) | (1 << cNextParser.TYPE_FLOAT96) | (1 << cNextParser.TYPE_STRING) | (1 << cNextParser.TYPE_BOOLEAN))) !== 0))) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public value(): ValueContext {
		let _localctx: ValueContext = new ValueContext(this._ctx, this.state);
		this.enterRule(_localctx, 36, cNextParser.RULE_value);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 185;
			_la = this._input.LA(1);
			if (!(((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & ((1 << (cNextParser.ID - 33)) | (1 << (cNextParser.NUMBER - 33)) | (1 << (cNextParser.STRING - 33)))) !== 0))) {
			this._errHandler.recoverInline(this);
			} else {
				if (this._input.LA(1) === Token.EOF) {
					this.matchedEOF = true;
				}

				this._errHandler.reportMatch(this);
				this.consume();
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public functionCall(): FunctionCallContext {
		let _localctx: FunctionCallContext = new FunctionCallContext(this._ctx, this.state);
		this.enterRule(_localctx, 38, cNextParser.RULE_functionCall);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 187;
			this.match(cNextParser.ID);
			this.state = 188;
			this.match(cNextParser.LPAREN);
			this.state = 190;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 24)) & ~0x1F) === 0 && ((1 << (_la - 24)) & ((1 << (cNextParser.LPAREN - 24)) | (1 << (cNextParser.ID - 24)) | (1 << (cNextParser.NUMBER - 24)) | (1 << (cNextParser.STRING - 24)))) !== 0)) {
				{
				this.state = 189;
				this.argumentList();
				}
			}

			this.state = 192;
			this.match(cNextParser.RPAREN);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public methodCall(): MethodCallContext {
		let _localctx: MethodCallContext = new MethodCallContext(this._ctx, this.state);
		this.enterRule(_localctx, 40, cNextParser.RULE_methodCall);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 194;
			this.match(cNextParser.ID);
			this.state = 195;
			this.match(cNextParser.DOT);
			this.state = 196;
			this.match(cNextParser.ID);
			this.state = 197;
			this.match(cNextParser.LPAREN);
			this.state = 199;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			if (((((_la - 24)) & ~0x1F) === 0 && ((1 << (_la - 24)) & ((1 << (cNextParser.LPAREN - 24)) | (1 << (cNextParser.ID - 24)) | (1 << (cNextParser.NUMBER - 24)) | (1 << (cNextParser.STRING - 24)))) !== 0)) {
				{
				this.state = 198;
				this.argumentList();
				}
			}

			this.state = 201;
			this.match(cNextParser.RPAREN);
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}
	// @RuleVersion(0)
	public argumentList(): ArgumentListContext {
		let _localctx: ArgumentListContext = new ArgumentListContext(this._ctx, this.state);
		this.enterRule(_localctx, 42, cNextParser.RULE_argumentList);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 203;
			this.expression(0);
			this.state = 208;
			this._errHandler.sync(this);
			_la = this._input.LA(1);
			while (_la === cNextParser.COMMA) {
				{
				{
				this.state = 204;
				this.match(cNextParser.COMMA);
				this.state = 205;
				this.expression(0);
				}
				}
				this.state = 210;
				this._errHandler.sync(this);
				_la = this._input.LA(1);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.exitRule();
		}
		return _localctx;
	}

	public expression(): ExpressionContext;
	public expression(_p: number): ExpressionContext;
	// @RuleVersion(0)
	public expression(_p?: number): ExpressionContext {
		if (_p === undefined) {
			_p = 0;
		}

		let _parentctx: ParserRuleContext = this._ctx;
		let _parentState: number = this.state;
		let _localctx: ExpressionContext = new ExpressionContext(this._ctx, _parentState);
		let _prevctx: ExpressionContext = _localctx;
		let _startState: number = 44;
		this.enterRecursionRule(_localctx, 44, cNextParser.RULE_expression, _p);
		try {
			let _alt: number;
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 217;
			this._errHandler.sync(this);
			switch (this._input.LA(1)) {
			case cNextParser.ID:
			case cNextParser.NUMBER:
			case cNextParser.STRING:
				{
				_localctx = new ValueExprContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;

				this.state = 212;
				this.value();
				}
				break;
			case cNextParser.LPAREN:
				{
				_localctx = new ParenExprContext(_localctx);
				this._ctx = _localctx;
				_prevctx = _localctx;
				this.state = 213;
				this.match(cNextParser.LPAREN);
				this.state = 214;
				this.expression(0);
				this.state = 215;
				this.match(cNextParser.RPAREN);
				}
				break;
			default:
				throw new NoViableAltException(this);
			}
			this._ctx._stop = this._input.tryLT(-1);
			this.state = 233;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 23, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = _localctx;
					{
					this.state = 231;
					this._errHandler.sync(this);
					switch ( this.interpreter.adaptivePredict(this._input, 22, this._ctx) ) {
					case 1:
						{
						_localctx = new AddExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, cNextParser.RULE_expression);
						this.state = 219;
						if (!(this.precpred(this._ctx, 5))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 5)");
						}
						this.state = 220;
						this.match(cNextParser.PLUS);
						this.state = 221;
						this.expression(6);
						}
						break;

					case 2:
						{
						_localctx = new SubExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, cNextParser.RULE_expression);
						this.state = 222;
						if (!(this.precpred(this._ctx, 4))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 4)");
						}
						this.state = 223;
						this.match(cNextParser.MINUS);
						this.state = 224;
						this.expression(5);
						}
						break;

					case 3:
						{
						_localctx = new MultExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, cNextParser.RULE_expression);
						this.state = 225;
						if (!(this.precpred(this._ctx, 3))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 3)");
						}
						this.state = 226;
						this.match(cNextParser.MULT);
						this.state = 227;
						this.expression(4);
						}
						break;

					case 4:
						{
						_localctx = new DivExprContext(new ExpressionContext(_parentctx, _parentState));
						this.pushNewRecursionContext(_localctx, _startState, cNextParser.RULE_expression);
						this.state = 228;
						if (!(this.precpred(this._ctx, 2))) {
							throw this.createFailedPredicateException("this.precpred(this._ctx, 2)");
						}
						this.state = 229;
						this.match(cNextParser.DIV);
						this.state = 230;
						this.expression(3);
						}
						break;
					}
					}
				}
				this.state = 235;
				this._errHandler.sync(this);
				_alt = this.interpreter.adaptivePredict(this._input, 23, this._ctx);
			}
			}
		}
		catch (re) {
			if (re instanceof RecognitionException) {
				_localctx.exception = re;
				this._errHandler.reportError(this, re);
				this._errHandler.recover(this, re);
			} else {
				throw re;
			}
		}
		finally {
			this.unrollRecursionContexts(_parentctx);
		}
		return _localctx;
	}

	public sempred(_localctx: RuleContext, ruleIndex: number, predIndex: number): boolean {
		switch (ruleIndex) {
		case 22:
			return this.expression_sempred(_localctx as ExpressionContext, predIndex);
		}
		return true;
	}
	private expression_sempred(_localctx: ExpressionContext, predIndex: number): boolean {
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

	public static readonly _serializedATN: string =
		"\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03\'\xEF\x04\x02" +
		"\t\x02\x04\x03\t\x03\x04\x04\t\x04\x04\x05\t\x05\x04\x06\t\x06\x04\x07" +
		"\t\x07\x04\b\t\b\x04\t\t\t\x04\n\t\n\x04\v\t\v\x04\f\t\f\x04\r\t\r\x04" +
		"\x0E\t\x0E\x04\x0F\t\x0F\x04\x10\t\x10\x04\x11\t\x11\x04\x12\t\x12\x04" +
		"\x13\t\x13\x04\x14\t\x14\x04\x15\t\x15\x04\x16\t\x16\x04\x17\t\x17\x04" +
		"\x18\t\x18\x03\x02\x07\x022\n\x02\f\x02\x0E\x025\v\x02\x03\x02\x03\x02" +
		"\x03\x02\x03\x03\x07\x03;\n\x03\f\x03\x0E\x03>\v\x03\x03\x03\x03\x03\x03" +
		"\x03\x07\x03C\n\x03\f\x03\x0E\x03F\v\x03\x03\x03\x03\x03\x03\x04\x03\x04" +
		"\x03\x04\x03\x04\x03\x05\x03\x05\x05\x05P\n\x05\x03\x06\x03\x06\x03\x06" +
		"\x03\x06\x03\x07\x03\x07\x03\x07\x03\x07\x03\b\x05\b[\n\b\x03\b\x03\b" +
		"\x03\b\x03\b\x03\b\x03\b\x03\t\x03\t\x07\te\n\t\f\t\x0E\th\v\t\x03\n\x03" +
		"\n\x03\n\x03\v\x03\v\x05\vo\n\v\x03\f\x05\fr\n\f\x03\f\x03\f\x03\f\x03" +
		"\f\x05\fx\n\f\x03\f\x03\f\x03\f\x07\f}\n\f\f\f\x0E\f\x80\v\f\x03\f\x03" +
		"\f\x03\r\x03\r\x03\r\x03\r\x05\r\x88\n\r\x03\r\x03\r\x03\r\x07\r\x8D\n" +
		"\r\f\r\x0E\r\x90\v\r\x03\r\x03\r\x03\x0E\x03\x0E\x03\x0E\x07\x0E\x97\n" +
		"\x0E\f\x0E\x0E\x0E\x9A\v\x0E\x03\x0F\x03\x0F\x03\x0F\x03\x10\x03\x10\x05" +
		"\x10\xA1\n\x10\x03\x11\x03\x11\x03\x11\x03\x11\x03\x11\x03\x11\x03\x12" +
		"\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12\x03\x12" +
		"\x03\x12\x03\x12\x05\x12\xB5\n\x12\x03\x12\x05\x12\xB8\n\x12\x03\x13\x03" +
		"\x13\x03\x14\x03\x14\x03\x15\x03\x15\x03\x15\x05\x15\xC1\n\x15\x03\x15" +
		"\x03\x15\x03\x16\x03\x16\x03\x16\x03\x16\x03\x16\x05\x16\xCA\n\x16\x03" +
		"\x16\x03\x16\x03\x17\x03\x17\x03\x17\x07\x17\xD1\n\x17\f\x17\x0E\x17\xD4" +
		"\v\x17\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x05\x18\xDC\n\x18" +
		"\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18\x03\x18" +
		"\x03\x18\x03\x18\x03\x18\x07\x18\xEA\n\x18\f\x18\x0E\x18\xED\v\x18\x03" +
		"\x18\x02\x02\x03.\x19\x02\x02\x04\x02\x06\x02\b\x02\n\x02\f\x02\x0E\x02" +
		"\x10\x02\x12\x02\x14\x02\x16\x02\x18\x02\x1A\x02\x1C\x02\x1E\x02 \x02" +
		"\"\x02$\x02&\x02(\x02*\x02,\x02.\x02\x02\x04\x03\x02\t\x15\x03\x02#%\x02" +
		"\xF5\x023\x03\x02\x02\x02\x04<\x03\x02\x02\x02\x06I\x03\x02\x02\x02\b" +
		"O\x03\x02\x02\x02\nQ\x03\x02\x02\x02\fU\x03\x02\x02\x02\x0EZ\x03\x02\x02" +
		"\x02\x10f\x03\x02\x02\x02\x12i\x03\x02\x02\x02\x14n\x03\x02\x02\x02\x16" +
		"q\x03\x02\x02\x02\x18\x83\x03\x02\x02\x02\x1A\x93\x03\x02\x02\x02\x1C" +
		"\x9B\x03\x02\x02\x02\x1E\xA0\x03\x02\x02\x02 \xA2\x03\x02\x02\x02\"\xB7" +
		"\x03\x02\x02\x02$\xB9\x03\x02\x02\x02&\xBB\x03\x02\x02\x02(\xBD\x03\x02" +
		"\x02\x02*\xC4\x03\x02\x02\x02,\xCD\x03\x02\x02\x02.\xDB\x03\x02\x02\x02" +
		"02\x05\b\x05\x0210\x03\x02\x02\x0225\x03\x02\x02\x0231\x03\x02\x02\x02" +
		"34\x03\x02\x02\x0246\x03\x02\x02\x0253\x03\x02\x02\x0267\x05\x0E\b\x02" +
		"78\x07\x02\x02\x038\x03\x03\x02\x02\x029;\x05\b\x05\x02:9\x03\x02\x02" +
		"\x02;>\x03\x02\x02\x02<:\x03\x02\x02\x02<=\x03\x02\x02\x02=D\x03\x02\x02" +
		"\x02><\x03\x02\x02\x02?C\x05\x06\x04\x02@C\x05\x18\r\x02AC\x05\x0E\b\x02" +
		"B?\x03\x02\x02\x02B@\x03\x02\x02\x02BA\x03\x02\x02\x02CF\x03\x02\x02\x02" +
		"DB\x03\x02\x02\x02DE\x03\x02\x02\x02EG\x03\x02\x02\x02FD\x03\x02\x02\x02" +
		"GH\x07\x02\x02\x03H\x05\x03\x02\x02\x02IJ\x07#\x02\x02JK\x07#\x02\x02" +
		"KL\x07\x17\x02\x02L\x07\x03\x02\x02\x02MP\x05\n\x06\x02NP\x05\f\x07\x02" +
		"OM\x03\x02\x02\x02ON\x03\x02\x02\x02P\t\x03\x02\x02\x02QR\x07\x04\x02" +
		"\x02RS\x07&\x02\x02ST\x07\x17\x02\x02T\v\x03\x02\x02\x02UV\x07\x05\x02" +
		"\x02VW\x07&\x02\x02WX\x07\x17\x02\x02X\r\x03\x02\x02\x02Y[\x07\x07\x02" +
		"\x02ZY\x03\x02\x02\x02Z[\x03\x02\x02\x02[\\\x03\x02\x02\x02\\]\x07\b\x02" +
		"\x02]^\x07#\x02\x02^_\x07\x18\x02\x02_`\x05\x10\t\x02`a\x07\x19\x02\x02" +
		"a\x0F\x03\x02\x02\x02be\x05\x12\n\x02ce\x05\x14\v\x02db\x03\x02\x02\x02" +
		"dc\x03\x02\x02\x02eh\x03\x02\x02\x02fd\x03\x02\x02\x02fg\x03\x02\x02\x02" +
		"g\x11\x03\x02\x02\x02hf\x03\x02\x02\x02ij\x07\x07\x02\x02jk\x05 \x11\x02" +
		"k\x13\x03\x02\x02\x02lo\x05 \x11\x02mo\x05\x16\f\x02nl\x03\x02\x02\x02" +
		"nm\x03\x02\x02\x02o\x15\x03\x02\x02\x02pr\x07\x06\x02\x02qp\x03\x02\x02" +
		"\x02qr\x03\x02\x02\x02rs\x03\x02\x02\x02st\x05\x1E\x10\x02tu\x07#\x02" +
		"\x02uw\x07\x1A\x02\x02vx\x05\x1A\x0E\x02wv\x03\x02\x02\x02wx\x03\x02\x02" +
		"\x02xy\x03\x02\x02\x02yz\x07\x1B\x02\x02z~\x07\x18\x02\x02{}\x05\"\x12" +
		"\x02|{\x03\x02\x02\x02}\x80\x03\x02\x02\x02~|\x03\x02\x02\x02~\x7F\x03" +
		"\x02\x02\x02\x7F\x81\x03\x02\x02\x02\x80~\x03\x02\x02\x02\x81\x82\x07" +
		"\x19\x02\x02\x82\x17\x03\x02\x02\x02\x83\x84\x05\x1E\x10\x02\x84\x85\x07" +
		"#\x02\x02\x85\x87\x07\x1A\x02\x02\x86\x88\x05\x1A\x0E\x02\x87\x86\x03" +
		"\x02\x02\x02\x87\x88\x03\x02\x02\x02\x88\x89\x03\x02\x02\x02\x89\x8A\x07" +
		"\x1B\x02\x02\x8A\x8E\x07\x18\x02\x02\x8B\x8D\x05\"\x12\x02\x8C\x8B\x03" +
		"\x02\x02\x02\x8D\x90\x03\x02\x02\x02\x8E\x8C\x03\x02\x02\x02\x8E\x8F\x03" +
		"\x02\x02\x02\x8F\x91\x03\x02\x02\x02\x90\x8E\x03\x02\x02\x02\x91\x92\x07" +
		"\x19\x02\x02\x92\x19\x03\x02\x02\x02\x93\x98\x05\x1C\x0F\x02\x94\x95\x07" +
		"\x1C\x02\x02\x95\x97\x05\x1C\x0F\x02\x96\x94\x03\x02\x02\x02\x97\x9A\x03" +
		"\x02\x02\x02\x98\x96\x03\x02\x02\x02\x98\x99\x03\x02\x02\x02\x99\x1B\x03" +
		"\x02\x02\x02\x9A\x98\x03\x02\x02\x02\x9B\x9C\x05$\x13\x02\x9C\x9D\x07" +
		"#\x02\x02\x9D\x1D\x03\x02\x02\x02\x9E\xA1\x05$\x13\x02\x9F\xA1\x07\x03" +
		"\x02\x02\xA0\x9E\x03\x02\x02\x02\xA0\x9F\x03\x02\x02\x02\xA1\x1F\x03\x02" +
		"\x02\x02\xA2\xA3\x05$\x13\x02\xA3\xA4\x07#\x02\x02\xA4\xA5\x07\x16\x02" +
		"\x02\xA5\xA6\x05&\x14\x02\xA6\xA7\x07\x17\x02\x02\xA7!\x03\x02\x02\x02" +
		"\xA8\xB8\x05 \x11\x02\xA9\xAA\x05.\x18\x02\xAA\xAB\x07\x17\x02\x02\xAB" +
		"\xB8\x03\x02\x02\x02\xAC\xAD\x05(\x15\x02\xAD\xAE\x07\x17\x02\x02\xAE" +
		"\xB8\x03\x02\x02\x02\xAF\xB0\x05*\x16\x02\xB0\xB1\x07\x17\x02\x02\xB1" +
		"\xB8\x03\x02\x02\x02\xB2\xB4\x07\x1D\x02\x02\xB3\xB5\x05.\x18\x02\xB4" +
		"\xB3\x03\x02\x02\x02\xB4\xB5\x03\x02\x02\x02\xB5\xB6\x03\x02\x02\x02\xB6" +
		"\xB8\x07\x17\x02\x02\xB7\xA8\x03\x02\x02\x02\xB7\xA9\x03\x02\x02\x02\xB7" +
		"\xAC\x03\x02\x02\x02\xB7\xAF\x03\x02\x02\x02\xB7\xB2\x03\x02\x02\x02\xB8" +
		"#\x03\x02\x02\x02\xB9\xBA\t\x02\x02\x02\xBA%\x03\x02\x02\x02\xBB\xBC\t" +
		"\x03\x02\x02\xBC\'\x03\x02\x02\x02\xBD\xBE\x07#\x02\x02\xBE\xC0\x07\x1A" +
		"\x02\x02\xBF\xC1\x05,\x17\x02\xC0\xBF\x03\x02\x02\x02\xC0\xC1\x03\x02" +
		"\x02\x02\xC1\xC2\x03\x02\x02\x02\xC2\xC3\x07\x1B\x02\x02\xC3)\x03\x02" +
		"\x02\x02\xC4\xC5\x07#\x02\x02\xC5\xC6\x07\"\x02\x02\xC6\xC7\x07#\x02\x02" +
		"\xC7\xC9\x07\x1A\x02\x02\xC8\xCA\x05,\x17\x02\xC9\xC8\x03\x02\x02\x02" +
		"\xC9\xCA\x03\x02\x02\x02\xCA\xCB\x03\x02\x02\x02\xCB\xCC\x07\x1B\x02\x02" +
		"\xCC+\x03\x02\x02\x02\xCD\xD2\x05.\x18\x02\xCE\xCF\x07\x1C\x02\x02\xCF" +
		"\xD1\x05.\x18\x02\xD0\xCE\x03\x02\x02\x02\xD1\xD4\x03\x02\x02\x02\xD2" +
		"\xD0\x03\x02\x02\x02\xD2\xD3\x03\x02\x02\x02\xD3-\x03\x02\x02\x02\xD4" +
		"\xD2\x03\x02\x02\x02\xD5\xD6\b\x18\x01\x02\xD6\xDC\x05&\x14\x02\xD7\xD8" +
		"\x07\x1A\x02\x02\xD8\xD9\x05.\x18\x02\xD9\xDA\x07\x1B\x02\x02\xDA\xDC" +
		"\x03\x02\x02\x02\xDB\xD5\x03\x02\x02\x02\xDB\xD7\x03\x02\x02\x02\xDC\xEB" +
		"\x03\x02\x02\x02\xDD\xDE\f\x07\x02\x02\xDE\xDF\x07\x1E\x02\x02\xDF\xEA" +
		"\x05.\x18\b\xE0\xE1\f\x06\x02\x02\xE1\xE2\x07\x1F\x02\x02\xE2\xEA\x05" +
		".\x18\x07\xE3\xE4\f\x05\x02\x02\xE4\xE5\x07 \x02\x02\xE5\xEA\x05.\x18" +
		"\x06\xE6\xE7\f\x04\x02\x02\xE7\xE8\x07!\x02\x02\xE8\xEA\x05.\x18\x05\xE9" +
		"\xDD\x03\x02\x02\x02\xE9\xE0\x03\x02\x02\x02\xE9\xE3\x03\x02\x02\x02\xE9" +
		"\xE6\x03\x02\x02\x02\xEA\xED\x03\x02\x02\x02\xEB\xE9\x03\x02\x02\x02\xEB" +
		"\xEC\x03\x02\x02\x02\xEC/\x03\x02\x02\x02\xED\xEB\x03\x02\x02\x02\x1A" +
		"3<BDOZdfnqw~\x87\x8E\x98\xA0\xB4\xB7\xC0\xC9\xD2\xDB\xE9\xEB";
	public static __ATN: ATN;
	public static get _ATN(): ATN {
		if (!cNextParser.__ATN) {
			cNextParser.__ATN = new ATNDeserializer().deserialize(Utils.toCharArray(cNextParser._serializedATN));
		}

		return cNextParser.__ATN;
	}

}

export class SourceFileContext extends ParserRuleContext {
	public classDeclaration(): ClassDeclarationContext {
		return this.getRuleContext(0, ClassDeclarationContext);
	}
	public EOF(): TerminalNode { return this.getToken(cNextParser.EOF, 0); }
	public fileDirective(): FileDirectiveContext[];
	public fileDirective(i: number): FileDirectiveContext;
	public fileDirective(i?: number): FileDirectiveContext | FileDirectiveContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FileDirectiveContext);
		} else {
			return this.getRuleContext(i, FileDirectiveContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_sourceFile; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterSourceFile) {
			listener.enterSourceFile(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitSourceFile) {
			listener.exitSourceFile(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitSourceFile) {
			return visitor.visitSourceFile(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MainSourceFileContext extends ParserRuleContext {
	public EOF(): TerminalNode { return this.getToken(cNextParser.EOF, 0); }
	public fileDirective(): FileDirectiveContext[];
	public fileDirective(i: number): FileDirectiveContext;
	public fileDirective(i?: number): FileDirectiveContext | FileDirectiveContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FileDirectiveContext);
		} else {
			return this.getRuleContext(i, FileDirectiveContext);
		}
	}
	public globalDeclaration(): GlobalDeclarationContext[];
	public globalDeclaration(i: number): GlobalDeclarationContext;
	public globalDeclaration(i?: number): GlobalDeclarationContext | GlobalDeclarationContext[] {
		if (i === undefined) {
			return this.getRuleContexts(GlobalDeclarationContext);
		} else {
			return this.getRuleContext(i, GlobalDeclarationContext);
		}
	}
	public functionDeclaration(): FunctionDeclarationContext[];
	public functionDeclaration(i: number): FunctionDeclarationContext;
	public functionDeclaration(i?: number): FunctionDeclarationContext | FunctionDeclarationContext[] {
		if (i === undefined) {
			return this.getRuleContexts(FunctionDeclarationContext);
		} else {
			return this.getRuleContext(i, FunctionDeclarationContext);
		}
	}
	public classDeclaration(): ClassDeclarationContext[];
	public classDeclaration(i: number): ClassDeclarationContext;
	public classDeclaration(i?: number): ClassDeclarationContext | ClassDeclarationContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ClassDeclarationContext);
		} else {
			return this.getRuleContext(i, ClassDeclarationContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_mainSourceFile; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterMainSourceFile) {
			listener.enterMainSourceFile(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitMainSourceFile) {
			listener.exitMainSourceFile(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitMainSourceFile) {
			return visitor.visitMainSourceFile(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class GlobalDeclarationContext extends ParserRuleContext {
	public ID(): TerminalNode[];
	public ID(i: number): TerminalNode;
	public ID(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(cNextParser.ID);
		} else {
			return this.getToken(cNextParser.ID, i);
		}
	}
	public SEMI(): TerminalNode { return this.getToken(cNextParser.SEMI, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_globalDeclaration; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterGlobalDeclaration) {
			listener.enterGlobalDeclaration(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitGlobalDeclaration) {
			listener.exitGlobalDeclaration(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitGlobalDeclaration) {
			return visitor.visitGlobalDeclaration(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FileDirectiveContext extends ParserRuleContext {
	public importDirective(): ImportDirectiveContext | undefined {
		return this.tryGetRuleContext(0, ImportDirectiveContext);
	}
	public includeDirective(): IncludeDirectiveContext | undefined {
		return this.tryGetRuleContext(0, IncludeDirectiveContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_fileDirective; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterFileDirective) {
			listener.enterFileDirective(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitFileDirective) {
			listener.exitFileDirective(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitFileDirective) {
			return visitor.visitFileDirective(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ImportDirectiveContext extends ParserRuleContext {
	public IMPORT(): TerminalNode { return this.getToken(cNextParser.IMPORT, 0); }
	public FILENAME(): TerminalNode { return this.getToken(cNextParser.FILENAME, 0); }
	public SEMI(): TerminalNode { return this.getToken(cNextParser.SEMI, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_importDirective; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterImportDirective) {
			listener.enterImportDirective(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitImportDirective) {
			listener.exitImportDirective(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitImportDirective) {
			return visitor.visitImportDirective(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class IncludeDirectiveContext extends ParserRuleContext {
	public INCLUDE(): TerminalNode { return this.getToken(cNextParser.INCLUDE, 0); }
	public FILENAME(): TerminalNode { return this.getToken(cNextParser.FILENAME, 0); }
	public SEMI(): TerminalNode { return this.getToken(cNextParser.SEMI, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_includeDirective; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterIncludeDirective) {
			listener.enterIncludeDirective(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitIncludeDirective) {
			listener.exitIncludeDirective(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitIncludeDirective) {
			return visitor.visitIncludeDirective(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ClassDeclarationContext extends ParserRuleContext {
	public CLASS(): TerminalNode { return this.getToken(cNextParser.CLASS, 0); }
	public ID(): TerminalNode { return this.getToken(cNextParser.ID, 0); }
	public LBRACE(): TerminalNode { return this.getToken(cNextParser.LBRACE, 0); }
	public classMembers(): ClassMembersContext {
		return this.getRuleContext(0, ClassMembersContext);
	}
	public RBRACE(): TerminalNode { return this.getToken(cNextParser.RBRACE, 0); }
	public STATIC(): TerminalNode | undefined { return this.tryGetToken(cNextParser.STATIC, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_classDeclaration; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterClassDeclaration) {
			listener.enterClassDeclaration(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitClassDeclaration) {
			listener.exitClassDeclaration(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitClassDeclaration) {
			return visitor.visitClassDeclaration(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ClassMembersContext extends ParserRuleContext {
	public staticMember(): StaticMemberContext[];
	public staticMember(i: number): StaticMemberContext;
	public staticMember(i?: number): StaticMemberContext | StaticMemberContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StaticMemberContext);
		} else {
			return this.getRuleContext(i, StaticMemberContext);
		}
	}
	public regularMember(): RegularMemberContext[];
	public regularMember(i: number): RegularMemberContext;
	public regularMember(i?: number): RegularMemberContext | RegularMemberContext[] {
		if (i === undefined) {
			return this.getRuleContexts(RegularMemberContext);
		} else {
			return this.getRuleContext(i, RegularMemberContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_classMembers; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterClassMembers) {
			listener.enterClassMembers(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitClassMembers) {
			listener.exitClassMembers(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitClassMembers) {
			return visitor.visitClassMembers(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StaticMemberContext extends ParserRuleContext {
	public STATIC(): TerminalNode { return this.getToken(cNextParser.STATIC, 0); }
	public declaration(): DeclarationContext {
		return this.getRuleContext(0, DeclarationContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_staticMember; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterStaticMember) {
			listener.enterStaticMember(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitStaticMember) {
			listener.exitStaticMember(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitStaticMember) {
			return visitor.visitStaticMember(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class RegularMemberContext extends ParserRuleContext {
	public declaration(): DeclarationContext | undefined {
		return this.tryGetRuleContext(0, DeclarationContext);
	}
	public classFunction(): ClassFunctionContext | undefined {
		return this.tryGetRuleContext(0, ClassFunctionContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_regularMember; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterRegularMember) {
			listener.enterRegularMember(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitRegularMember) {
			listener.exitRegularMember(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitRegularMember) {
			return visitor.visitRegularMember(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ClassFunctionContext extends ParserRuleContext {
	public returnType(): ReturnTypeContext {
		return this.getRuleContext(0, ReturnTypeContext);
	}
	public ID(): TerminalNode { return this.getToken(cNextParser.ID, 0); }
	public LPAREN(): TerminalNode { return this.getToken(cNextParser.LPAREN, 0); }
	public RPAREN(): TerminalNode { return this.getToken(cNextParser.RPAREN, 0); }
	public LBRACE(): TerminalNode { return this.getToken(cNextParser.LBRACE, 0); }
	public RBRACE(): TerminalNode { return this.getToken(cNextParser.RBRACE, 0); }
	public PUBLIC(): TerminalNode | undefined { return this.tryGetToken(cNextParser.PUBLIC, 0); }
	public parameterList(): ParameterListContext | undefined {
		return this.tryGetRuleContext(0, ParameterListContext);
	}
	public statement(): StatementContext[];
	public statement(i: number): StatementContext;
	public statement(i?: number): StatementContext | StatementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StatementContext);
		} else {
			return this.getRuleContext(i, StatementContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_classFunction; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterClassFunction) {
			listener.enterClassFunction(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitClassFunction) {
			listener.exitClassFunction(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitClassFunction) {
			return visitor.visitClassFunction(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionDeclarationContext extends ParserRuleContext {
	public returnType(): ReturnTypeContext {
		return this.getRuleContext(0, ReturnTypeContext);
	}
	public ID(): TerminalNode { return this.getToken(cNextParser.ID, 0); }
	public LPAREN(): TerminalNode { return this.getToken(cNextParser.LPAREN, 0); }
	public RPAREN(): TerminalNode { return this.getToken(cNextParser.RPAREN, 0); }
	public LBRACE(): TerminalNode { return this.getToken(cNextParser.LBRACE, 0); }
	public RBRACE(): TerminalNode { return this.getToken(cNextParser.RBRACE, 0); }
	public parameterList(): ParameterListContext | undefined {
		return this.tryGetRuleContext(0, ParameterListContext);
	}
	public statement(): StatementContext[];
	public statement(i: number): StatementContext;
	public statement(i?: number): StatementContext | StatementContext[] {
		if (i === undefined) {
			return this.getRuleContexts(StatementContext);
		} else {
			return this.getRuleContext(i, StatementContext);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_functionDeclaration; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterFunctionDeclaration) {
			listener.enterFunctionDeclaration(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitFunctionDeclaration) {
			listener.exitFunctionDeclaration(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitFunctionDeclaration) {
			return visitor.visitFunctionDeclaration(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ParameterListContext extends ParserRuleContext {
	public parameter(): ParameterContext[];
	public parameter(i: number): ParameterContext;
	public parameter(i?: number): ParameterContext | ParameterContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ParameterContext);
		} else {
			return this.getRuleContext(i, ParameterContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(cNextParser.COMMA);
		} else {
			return this.getToken(cNextParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_parameterList; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterParameterList) {
			listener.enterParameterList(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitParameterList) {
			listener.exitParameterList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitParameterList) {
			return visitor.visitParameterList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ParameterContext extends ParserRuleContext {
	public type_specifier(): Type_specifierContext {
		return this.getRuleContext(0, Type_specifierContext);
	}
	public ID(): TerminalNode { return this.getToken(cNextParser.ID, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_parameter; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterParameter) {
			listener.enterParameter(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitParameter) {
			listener.exitParameter(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitParameter) {
			return visitor.visitParameter(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ReturnTypeContext extends ParserRuleContext {
	public type_specifier(): Type_specifierContext | undefined {
		return this.tryGetRuleContext(0, Type_specifierContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_returnType; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterReturnType) {
			listener.enterReturnType(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitReturnType) {
			listener.exitReturnType(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitReturnType) {
			return visitor.visitReturnType(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class DeclarationContext extends ParserRuleContext {
	public type_specifier(): Type_specifierContext {
		return this.getRuleContext(0, Type_specifierContext);
	}
	public ID(): TerminalNode { return this.getToken(cNextParser.ID, 0); }
	public ASSIGN(): TerminalNode { return this.getToken(cNextParser.ASSIGN, 0); }
	public value(): ValueContext {
		return this.getRuleContext(0, ValueContext);
	}
	public SEMI(): TerminalNode { return this.getToken(cNextParser.SEMI, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_declaration; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterDeclaration) {
			listener.enterDeclaration(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitDeclaration) {
			listener.exitDeclaration(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitDeclaration) {
			return visitor.visitDeclaration(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class StatementContext extends ParserRuleContext {
	public declaration(): DeclarationContext | undefined {
		return this.tryGetRuleContext(0, DeclarationContext);
	}
	public expression(): ExpressionContext | undefined {
		return this.tryGetRuleContext(0, ExpressionContext);
	}
	public SEMI(): TerminalNode | undefined { return this.tryGetToken(cNextParser.SEMI, 0); }
	public functionCall(): FunctionCallContext | undefined {
		return this.tryGetRuleContext(0, FunctionCallContext);
	}
	public methodCall(): MethodCallContext | undefined {
		return this.tryGetRuleContext(0, MethodCallContext);
	}
	public RETURN(): TerminalNode | undefined { return this.tryGetToken(cNextParser.RETURN, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_statement; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterStatement) {
			listener.enterStatement(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitStatement) {
			listener.exitStatement(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitStatement) {
			return visitor.visitStatement(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class Type_specifierContext extends ParserRuleContext {
	public TYPE_INT8(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_INT8, 0); }
	public TYPE_INT16(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_INT16, 0); }
	public TYPE_INT32(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_INT32, 0); }
	public TYPE_INT64(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_INT64, 0); }
	public TYPE_UINT8(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_UINT8, 0); }
	public TYPE_UINT16(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_UINT16, 0); }
	public TYPE_UINT32(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_UINT32, 0); }
	public TYPE_UINT64(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_UINT64, 0); }
	public TYPE_FLOAT32(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_FLOAT32, 0); }
	public TYPE_FLOAT64(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_FLOAT64, 0); }
	public TYPE_FLOAT96(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_FLOAT96, 0); }
	public TYPE_STRING(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_STRING, 0); }
	public TYPE_BOOLEAN(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_BOOLEAN, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_type_specifier; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterType_specifier) {
			listener.enterType_specifier(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitType_specifier) {
			listener.exitType_specifier(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitType_specifier) {
			return visitor.visitType_specifier(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ValueContext extends ParserRuleContext {
	public NUMBER(): TerminalNode | undefined { return this.tryGetToken(cNextParser.NUMBER, 0); }
	public STRING(): TerminalNode | undefined { return this.tryGetToken(cNextParser.STRING, 0); }
	public ID(): TerminalNode | undefined { return this.tryGetToken(cNextParser.ID, 0); }
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_value; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterValue) {
			listener.enterValue(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitValue) {
			listener.exitValue(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitValue) {
			return visitor.visitValue(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class FunctionCallContext extends ParserRuleContext {
	public ID(): TerminalNode { return this.getToken(cNextParser.ID, 0); }
	public LPAREN(): TerminalNode { return this.getToken(cNextParser.LPAREN, 0); }
	public RPAREN(): TerminalNode { return this.getToken(cNextParser.RPAREN, 0); }
	public argumentList(): ArgumentListContext | undefined {
		return this.tryGetRuleContext(0, ArgumentListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_functionCall; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterFunctionCall) {
			listener.enterFunctionCall(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitFunctionCall) {
			listener.exitFunctionCall(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitFunctionCall) {
			return visitor.visitFunctionCall(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class MethodCallContext extends ParserRuleContext {
	public ID(): TerminalNode[];
	public ID(i: number): TerminalNode;
	public ID(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(cNextParser.ID);
		} else {
			return this.getToken(cNextParser.ID, i);
		}
	}
	public DOT(): TerminalNode { return this.getToken(cNextParser.DOT, 0); }
	public LPAREN(): TerminalNode { return this.getToken(cNextParser.LPAREN, 0); }
	public RPAREN(): TerminalNode { return this.getToken(cNextParser.RPAREN, 0); }
	public argumentList(): ArgumentListContext | undefined {
		return this.tryGetRuleContext(0, ArgumentListContext);
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_methodCall; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterMethodCall) {
			listener.enterMethodCall(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitMethodCall) {
			listener.exitMethodCall(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitMethodCall) {
			return visitor.visitMethodCall(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ArgumentListContext extends ParserRuleContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public COMMA(): TerminalNode[];
	public COMMA(i: number): TerminalNode;
	public COMMA(i?: number): TerminalNode | TerminalNode[] {
		if (i === undefined) {
			return this.getTokens(cNextParser.COMMA);
		} else {
			return this.getToken(cNextParser.COMMA, i);
		}
	}
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_argumentList; }
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterArgumentList) {
			listener.enterArgumentList(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitArgumentList) {
			listener.exitArgumentList(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitArgumentList) {
			return visitor.visitArgumentList(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


export class ExpressionContext extends ParserRuleContext {
	constructor(parent: ParserRuleContext | undefined, invokingState: number) {
		super(parent, invokingState);
	}
	// @Override
	public get ruleIndex(): number { return cNextParser.RULE_expression; }
	public copyFrom(ctx: ExpressionContext): void {
		super.copyFrom(ctx);
	}
}
export class ValueExprContext extends ExpressionContext {
	public value(): ValueContext {
		return this.getRuleContext(0, ValueContext);
	}
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterValueExpr) {
			listener.enterValueExpr(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitValueExpr) {
			listener.exitValueExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitValueExpr) {
			return visitor.visitValueExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class AddExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public PLUS(): TerminalNode { return this.getToken(cNextParser.PLUS, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterAddExpr) {
			listener.enterAddExpr(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitAddExpr) {
			listener.exitAddExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitAddExpr) {
			return visitor.visitAddExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class SubExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public MINUS(): TerminalNode { return this.getToken(cNextParser.MINUS, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterSubExpr) {
			listener.enterSubExpr(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitSubExpr) {
			listener.exitSubExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitSubExpr) {
			return visitor.visitSubExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class MultExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public MULT(): TerminalNode { return this.getToken(cNextParser.MULT, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterMultExpr) {
			listener.enterMultExpr(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitMultExpr) {
			listener.exitMultExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitMultExpr) {
			return visitor.visitMultExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class DivExprContext extends ExpressionContext {
	public expression(): ExpressionContext[];
	public expression(i: number): ExpressionContext;
	public expression(i?: number): ExpressionContext | ExpressionContext[] {
		if (i === undefined) {
			return this.getRuleContexts(ExpressionContext);
		} else {
			return this.getRuleContext(i, ExpressionContext);
		}
	}
	public DIV(): TerminalNode { return this.getToken(cNextParser.DIV, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterDivExpr) {
			listener.enterDivExpr(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitDivExpr) {
			listener.exitDivExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitDivExpr) {
			return visitor.visitDivExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}
export class ParenExprContext extends ExpressionContext {
	public LPAREN(): TerminalNode { return this.getToken(cNextParser.LPAREN, 0); }
	public expression(): ExpressionContext {
		return this.getRuleContext(0, ExpressionContext);
	}
	public RPAREN(): TerminalNode { return this.getToken(cNextParser.RPAREN, 0); }
	constructor(ctx: ExpressionContext) {
		super(ctx.parent, ctx.invokingState);
		this.copyFrom(ctx);
	}
	// @Override
	public enterRule(listener: cNextListener): void {
		if (listener.enterParenExpr) {
			listener.enterParenExpr(this);
		}
	}
	// @Override
	public exitRule(listener: cNextListener): void {
		if (listener.exitParenExpr) {
			listener.exitParenExpr(this);
		}
	}
	// @Override
	public accept<Result>(visitor: cNextVisitor<Result>): Result {
		if (visitor.visitParenExpr) {
			return visitor.visitParenExpr(this);
		} else {
			return visitor.visitChildren(this);
		}
	}
}


