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
	public static readonly PUBLIC = 2;
	public static readonly STATIC = 3;
	public static readonly CLASS = 4;
	public static readonly TYPE_INT8 = 5;
	public static readonly TYPE_INT16 = 6;
	public static readonly TYPE_INT32 = 7;
	public static readonly TYPE_INT64 = 8;
	public static readonly TYPE_STRING = 9;
	public static readonly ASSIGN = 10;
	public static readonly SEMI = 11;
	public static readonly LBRACE = 12;
	public static readonly RBRACE = 13;
	public static readonly LPAREN = 14;
	public static readonly RPAREN = 15;
	public static readonly COMMA = 16;
	public static readonly RETURN = 17;
	public static readonly PLUS = 18;
	public static readonly MINUS = 19;
	public static readonly MULT = 20;
	public static readonly DIV = 21;
	public static readonly ID = 22;
	public static readonly NUMBER = 23;
	public static readonly STRING = 24;
	public static readonly WS = 25;
	public static readonly RULE_sourceFile = 0;
	public static readonly RULE_mainSourceFile = 1;
	public static readonly RULE_classDeclaration = 2;
	public static readonly RULE_classMembers = 3;
	public static readonly RULE_staticMember = 4;
	public static readonly RULE_regularMember = 5;
	public static readonly RULE_classFunction = 6;
	public static readonly RULE_functionDeclaration = 7;
	public static readonly RULE_parameterList = 8;
	public static readonly RULE_parameter = 9;
	public static readonly RULE_returnType = 10;
	public static readonly RULE_declaration = 11;
	public static readonly RULE_statement = 12;
	public static readonly RULE_type_specifier = 13;
	public static readonly RULE_value = 14;
	public static readonly RULE_expression = 15;
	// tslint:disable:no-trailing-whitespace
	public static readonly ruleNames: string[] = [
		"sourceFile", "mainSourceFile", "classDeclaration", "classMembers", "staticMember", 
		"regularMember", "classFunction", "functionDeclaration", "parameterList", 
		"parameter", "returnType", "declaration", "statement", "type_specifier", 
		"value", "expression",
	];

	private static readonly _LITERAL_NAMES: Array<string | undefined> = [
		undefined, "'void'", "'public'", "'static'", "'class'", "'int8'", "'int16'", 
		"'int32'", "'int64'", "'String'", "'<-'", "';'", "'{'", "'}'", "'('", 
		"')'", "','", "'return'", "'+'", "'-'", "'*'", "'/'",
	];
	private static readonly _SYMBOLIC_NAMES: Array<string | undefined> = [
		undefined, undefined, "PUBLIC", "STATIC", "CLASS", "TYPE_INT8", "TYPE_INT16", 
		"TYPE_INT32", "TYPE_INT64", "TYPE_STRING", "ASSIGN", "SEMI", "LBRACE", 
		"RBRACE", "LPAREN", "RPAREN", "COMMA", "RETURN", "PLUS", "MINUS", "MULT", 
		"DIV", "ID", "NUMBER", "STRING", "WS",
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
				throw new NoViableAltException(this);
			}
			this.state = 43;
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
	public classDeclaration(): ClassDeclarationContext {
		let _localctx: ClassDeclarationContext = new ClassDeclarationContext(this._ctx, this.state);
		this.enterRule(_localctx, 4, cNextParser.RULE_classDeclaration);
		let _la: number;
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
		this.enterRule(_localctx, 6, cNextParser.RULE_classMembers);
		let _la: number;
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
					throw new NoViableAltException(this);
				}
				}
				this.state = 60;
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
		this.enterRule(_localctx, 10, cNextParser.RULE_regularMember);
		try {
			this.state = 66;
			this._errHandler.sync(this);
			switch ( this.interpreter.adaptivePredict(this._input, 5, this._ctx) ) {
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
		this.enterRule(_localctx, 12, cNextParser.RULE_classFunction);
		let _la: number;
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
		this.enterRule(_localctx, 14, cNextParser.RULE_functionDeclaration);
		let _la: number;
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
		this.enterRule(_localctx, 16, cNextParser.RULE_parameterList);
		let _la: number;
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
		this.enterRule(_localctx, 24, cNextParser.RULE_statement);
		let _la: number;
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
	public type_specifier(): Type_specifierContext {
		let _localctx: Type_specifierContext = new Type_specifierContext(this._ctx, this.state);
		this.enterRule(_localctx, 26, cNextParser.RULE_type_specifier);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 135;
			_la = this._input.LA(1);
			if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.TYPE_INT8) | (1 << cNextParser.TYPE_INT16) | (1 << cNextParser.TYPE_INT32) | (1 << cNextParser.TYPE_INT64) | (1 << cNextParser.TYPE_STRING))) !== 0))) {
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
		this.enterRule(_localctx, 28, cNextParser.RULE_value);
		let _la: number;
		try {
			this.enterOuterAlt(_localctx, 1);
			{
			this.state = 137;
			_la = this._input.LA(1);
			if (!((((_la) & ~0x1F) === 0 && ((1 << _la) & ((1 << cNextParser.ID) | (1 << cNextParser.NUMBER) | (1 << cNextParser.STRING))) !== 0))) {
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
		let _startState: number = 30;
		this.enterRecursionRule(_localctx, 30, cNextParser.RULE_expression, _p);
		try {
			let _alt: number;
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
				throw new NoViableAltException(this);
			}
			this._ctx._stop = this._input.tryLT(-1);
			this.state = 161;
			this._errHandler.sync(this);
			_alt = this.interpreter.adaptivePredict(this._input, 17, this._ctx);
			while (_alt !== 2 && _alt !== ATN.INVALID_ALT_NUMBER) {
				if (_alt === 1) {
					if (this._parseListeners != null) {
						this.triggerExitRuleEvent();
					}
					_prevctx = _localctx;
					{
					this.state = 159;
					this._errHandler.sync(this);
					switch ( this.interpreter.adaptivePredict(this._input, 16, this._ctx) ) {
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
		case 15:
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
		"\x03\uC91D\uCABA\u058D\uAFBA\u4F53\u0607\uEA8B\uC241\x03\x1B\xA7\x04\x02" +
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
	public classDeclaration(): ClassDeclarationContext | undefined {
		return this.tryGetRuleContext(0, ClassDeclarationContext);
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
	public TYPE_STRING(): TerminalNode | undefined { return this.tryGetToken(cNextParser.TYPE_STRING, 0); }
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


