// Generated from grammar/CNext.g4 by ANTLR 4.13.1

import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { CNextListener } from "./CNextListener.js";
import { CNextVisitor } from "./CNextVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;

export class CNextParser extends antlr.Parser {
  public static readonly T__0 = 1;
  public static readonly INCLUDE_DIRECTIVE = 2;
  public static readonly DEFINE_FUNCTION = 3;
  public static readonly DEFINE_WITH_VALUE = 4;
  public static readonly DEFINE_FLAG = 5;
  public static readonly IFDEF_DIRECTIVE = 6;
  public static readonly IFNDEF_DIRECTIVE = 7;
  public static readonly ELSE_DIRECTIVE = 8;
  public static readonly ENDIF_DIRECTIVE = 9;
  public static readonly PRAGMA_TARGET = 10;
  public static readonly SCOPE = 11;
  public static readonly STRUCT = 12;
  public static readonly ENUM = 13;
  public static readonly THIS = 14;
  public static readonly GLOBAL = 15;
  public static readonly REGISTER = 16;
  public static readonly PRIVATE = 17;
  public static readonly PUBLIC = 18;
  public static readonly CONST = 19;
  public static readonly VOLATILE = 20;
  public static readonly VOID = 21;
  public static readonly IF = 22;
  public static readonly ELSE = 23;
  public static readonly WHILE = 24;
  public static readonly DO = 25;
  public static readonly FOR = 26;
  public static readonly SWITCH = 27;
  public static readonly CASE = 28;
  public static readonly DEFAULT = 29;
  public static readonly RETURN = 30;
  public static readonly TRUE = 31;
  public static readonly FALSE = 32;
  public static readonly C_NULL = 33;
  public static readonly STRING = 34;
  public static readonly SIZEOF = 35;
  public static readonly BITMAP8 = 36;
  public static readonly BITMAP16 = 37;
  public static readonly BITMAP24 = 38;
  public static readonly BITMAP32 = 39;
  public static readonly RW = 40;
  public static readonly RO = 41;
  public static readonly WO = 42;
  public static readonly W1C = 43;
  public static readonly W1S = 44;
  public static readonly CLAMP = 45;
  public static readonly WRAP = 46;
  public static readonly ATOMIC = 47;
  public static readonly CRITICAL = 48;
  public static readonly SUFFIXED_FLOAT = 49;
  public static readonly SUFFIXED_HEX = 50;
  public static readonly SUFFIXED_BINARY = 51;
  public static readonly SUFFIXED_DECIMAL = 52;
  public static readonly U8 = 53;
  public static readonly U16 = 54;
  public static readonly U32 = 55;
  public static readonly U64 = 56;
  public static readonly I8 = 57;
  public static readonly I16 = 58;
  public static readonly I32 = 59;
  public static readonly I64 = 60;
  public static readonly F32 = 61;
  public static readonly F64 = 62;
  public static readonly BOOL = 63;
  public static readonly ISR_TYPE = 64;
  public static readonly LSHIFT_ASSIGN = 65;
  public static readonly RSHIFT_ASSIGN = 66;
  public static readonly PLUS_ASSIGN = 67;
  public static readonly MINUS_ASSIGN = 68;
  public static readonly STAR_ASSIGN = 69;
  public static readonly SLASH_ASSIGN = 70;
  public static readonly PERCENT_ASSIGN = 71;
  public static readonly BITAND_ASSIGN = 72;
  public static readonly BITOR_ASSIGN = 73;
  public static readonly BITXOR_ASSIGN = 74;
  public static readonly ASSIGN = 75;
  public static readonly EQ = 76;
  public static readonly NEQ = 77;
  public static readonly LT = 78;
  public static readonly GT = 79;
  public static readonly LTE = 80;
  public static readonly GTE = 81;
  public static readonly PLUS = 82;
  public static readonly MINUS = 83;
  public static readonly STAR = 84;
  public static readonly SLASH = 85;
  public static readonly PERCENT = 86;
  public static readonly AND = 87;
  public static readonly OR = 88;
  public static readonly NOT = 89;
  public static readonly BITAND = 90;
  public static readonly BITOR = 91;
  public static readonly BITXOR = 92;
  public static readonly BITNOT = 93;
  public static readonly LSHIFT = 94;
  public static readonly RSHIFT = 95;
  public static readonly LPAREN = 96;
  public static readonly RPAREN = 97;
  public static readonly LBRACE = 98;
  public static readonly RBRACE = 99;
  public static readonly LBRACKET = 100;
  public static readonly RBRACKET = 101;
  public static readonly SEMI = 102;
  public static readonly COMMA = 103;
  public static readonly DOT = 104;
  public static readonly AT = 105;
  public static readonly COLON = 106;
  public static readonly HEX_LITERAL = 107;
  public static readonly BINARY_LITERAL = 108;
  public static readonly FLOAT_LITERAL = 109;
  public static readonly INTEGER_LITERAL = 110;
  public static readonly STRING_LITERAL = 111;
  public static readonly CHAR_LITERAL = 112;
  public static readonly IDENTIFIER = 113;
  public static readonly DOC_COMMENT = 114;
  public static readonly LINE_COMMENT = 115;
  public static readonly BLOCK_COMMENT = 116;
  public static readonly WS = 117;
  public static readonly RULE_program = 0;
  public static readonly RULE_includeDirective = 1;
  public static readonly RULE_preprocessorDirective = 2;
  public static readonly RULE_defineDirective = 3;
  public static readonly RULE_conditionalDirective = 4;
  public static readonly RULE_pragmaDirective = 5;
  public static readonly RULE_declaration = 6;
  public static readonly RULE_scopeDeclaration = 7;
  public static readonly RULE_scopeMember = 8;
  public static readonly RULE_visibilityModifier = 9;
  public static readonly RULE_registerDeclaration = 10;
  public static readonly RULE_registerMember = 11;
  public static readonly RULE_accessModifier = 12;
  public static readonly RULE_structDeclaration = 13;
  public static readonly RULE_structMember = 14;
  public static readonly RULE_enumDeclaration = 15;
  public static readonly RULE_enumMember = 16;
  public static readonly RULE_bitmapDeclaration = 17;
  public static readonly RULE_bitmapType = 18;
  public static readonly RULE_bitmapMember = 19;
  public static readonly RULE_functionDeclaration = 20;
  public static readonly RULE_parameterList = 21;
  public static readonly RULE_parameter = 22;
  public static readonly RULE_constModifier = 23;
  public static readonly RULE_volatileModifier = 24;
  public static readonly RULE_overflowModifier = 25;
  public static readonly RULE_atomicModifier = 26;
  public static readonly RULE_arrayDimension = 27;
  public static readonly RULE_variableDeclaration = 28;
  public static readonly RULE_constructorArgumentList = 29;
  public static readonly RULE_block = 30;
  public static readonly RULE_statement = 31;
  public static readonly RULE_criticalStatement = 32;
  public static readonly RULE_assignmentStatement = 33;
  public static readonly RULE_assignmentOperator = 34;
  public static readonly RULE_assignmentTarget = 35;
  public static readonly RULE_postfixTargetOp = 36;
  public static readonly RULE_expressionStatement = 37;
  public static readonly RULE_ifStatement = 38;
  public static readonly RULE_whileStatement = 39;
  public static readonly RULE_doWhileStatement = 40;
  public static readonly RULE_forStatement = 41;
  public static readonly RULE_forInit = 42;
  public static readonly RULE_forVarDecl = 43;
  public static readonly RULE_forAssignment = 44;
  public static readonly RULE_forUpdate = 45;
  public static readonly RULE_returnStatement = 46;
  public static readonly RULE_switchStatement = 47;
  public static readonly RULE_switchCase = 48;
  public static readonly RULE_caseLabel = 49;
  public static readonly RULE_defaultCase = 50;
  public static readonly RULE_expression = 51;
  public static readonly RULE_ternaryExpression = 52;
  public static readonly RULE_orExpression = 53;
  public static readonly RULE_andExpression = 54;
  public static readonly RULE_equalityExpression = 55;
  public static readonly RULE_relationalExpression = 56;
  public static readonly RULE_bitwiseOrExpression = 57;
  public static readonly RULE_bitwiseXorExpression = 58;
  public static readonly RULE_bitwiseAndExpression = 59;
  public static readonly RULE_shiftExpression = 60;
  public static readonly RULE_additiveExpression = 61;
  public static readonly RULE_multiplicativeExpression = 62;
  public static readonly RULE_unaryExpression = 63;
  public static readonly RULE_postfixExpression = 64;
  public static readonly RULE_postfixOp = 65;
  public static readonly RULE_primaryExpression = 66;
  public static readonly RULE_sizeofExpression = 67;
  public static readonly RULE_castExpression = 68;
  public static readonly RULE_structInitializer = 69;
  public static readonly RULE_fieldInitializerList = 70;
  public static readonly RULE_fieldInitializer = 71;
  public static readonly RULE_arrayInitializer = 72;
  public static readonly RULE_arrayInitializerElement = 73;
  public static readonly RULE_memberAccess = 74;
  public static readonly RULE_arrayAccess = 75;
  public static readonly RULE_argumentList = 76;
  public static readonly RULE_type = 77;
  public static readonly RULE_scopedType = 78;
  public static readonly RULE_globalType = 79;
  public static readonly RULE_qualifiedType = 80;
  public static readonly RULE_primitiveType = 81;
  public static readonly RULE_userType = 82;
  public static readonly RULE_templateType = 83;
  public static readonly RULE_templateArgumentList = 84;
  public static readonly RULE_templateArgument = 85;
  public static readonly RULE_stringType = 86;
  public static readonly RULE_arrayType = 87;
  public static readonly RULE_literal = 88;

  public static readonly literalNames = [
    null,
    "'?'",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "'scope'",
    "'struct'",
    "'enum'",
    "'this'",
    "'global'",
    "'register'",
    "'private'",
    "'public'",
    "'const'",
    "'volatile'",
    "'void'",
    "'if'",
    "'else'",
    "'while'",
    "'do'",
    "'for'",
    "'switch'",
    "'case'",
    "'default'",
    "'return'",
    "'true'",
    "'false'",
    "'NULL'",
    "'string'",
    "'sizeof'",
    "'bitmap8'",
    "'bitmap16'",
    "'bitmap24'",
    "'bitmap32'",
    "'rw'",
    "'ro'",
    "'wo'",
    "'w1c'",
    "'w1s'",
    "'clamp'",
    "'wrap'",
    "'atomic'",
    "'critical'",
    null,
    null,
    null,
    null,
    "'u8'",
    "'u16'",
    "'u32'",
    "'u64'",
    "'i8'",
    "'i16'",
    "'i32'",
    "'i64'",
    "'f32'",
    "'f64'",
    "'bool'",
    "'ISR'",
    "'<<<-'",
    "'>><-'",
    "'+<-'",
    "'-<-'",
    "'*<-'",
    "'/<-'",
    "'%<-'",
    "'&<-'",
    "'|<-'",
    "'^<-'",
    "'<-'",
    "'='",
    "'!='",
    "'<'",
    "'>'",
    "'<='",
    "'>='",
    "'+'",
    "'-'",
    "'*'",
    "'/'",
    "'%'",
    "'&&'",
    "'||'",
    "'!'",
    "'&'",
    "'|'",
    "'^'",
    "'~'",
    "'<<'",
    "'>>'",
    "'('",
    "')'",
    "'{'",
    "'}'",
    "'['",
    "']'",
    "';'",
    "','",
    "'.'",
    "'@'",
    "':'",
  ];

  public static readonly symbolicNames = [
    null,
    null,
    "INCLUDE_DIRECTIVE",
    "DEFINE_FUNCTION",
    "DEFINE_WITH_VALUE",
    "DEFINE_FLAG",
    "IFDEF_DIRECTIVE",
    "IFNDEF_DIRECTIVE",
    "ELSE_DIRECTIVE",
    "ENDIF_DIRECTIVE",
    "PRAGMA_TARGET",
    "SCOPE",
    "STRUCT",
    "ENUM",
    "THIS",
    "GLOBAL",
    "REGISTER",
    "PRIVATE",
    "PUBLIC",
    "CONST",
    "VOLATILE",
    "VOID",
    "IF",
    "ELSE",
    "WHILE",
    "DO",
    "FOR",
    "SWITCH",
    "CASE",
    "DEFAULT",
    "RETURN",
    "TRUE",
    "FALSE",
    "C_NULL",
    "STRING",
    "SIZEOF",
    "BITMAP8",
    "BITMAP16",
    "BITMAP24",
    "BITMAP32",
    "RW",
    "RO",
    "WO",
    "W1C",
    "W1S",
    "CLAMP",
    "WRAP",
    "ATOMIC",
    "CRITICAL",
    "SUFFIXED_FLOAT",
    "SUFFIXED_HEX",
    "SUFFIXED_BINARY",
    "SUFFIXED_DECIMAL",
    "U8",
    "U16",
    "U32",
    "U64",
    "I8",
    "I16",
    "I32",
    "I64",
    "F32",
    "F64",
    "BOOL",
    "ISR_TYPE",
    "LSHIFT_ASSIGN",
    "RSHIFT_ASSIGN",
    "PLUS_ASSIGN",
    "MINUS_ASSIGN",
    "STAR_ASSIGN",
    "SLASH_ASSIGN",
    "PERCENT_ASSIGN",
    "BITAND_ASSIGN",
    "BITOR_ASSIGN",
    "BITXOR_ASSIGN",
    "ASSIGN",
    "EQ",
    "NEQ",
    "LT",
    "GT",
    "LTE",
    "GTE",
    "PLUS",
    "MINUS",
    "STAR",
    "SLASH",
    "PERCENT",
    "AND",
    "OR",
    "NOT",
    "BITAND",
    "BITOR",
    "BITXOR",
    "BITNOT",
    "LSHIFT",
    "RSHIFT",
    "LPAREN",
    "RPAREN",
    "LBRACE",
    "RBRACE",
    "LBRACKET",
    "RBRACKET",
    "SEMI",
    "COMMA",
    "DOT",
    "AT",
    "COLON",
    "HEX_LITERAL",
    "BINARY_LITERAL",
    "FLOAT_LITERAL",
    "INTEGER_LITERAL",
    "STRING_LITERAL",
    "CHAR_LITERAL",
    "IDENTIFIER",
    "DOC_COMMENT",
    "LINE_COMMENT",
    "BLOCK_COMMENT",
    "WS",
  ];
  public static readonly ruleNames = [
    "program",
    "includeDirective",
    "preprocessorDirective",
    "defineDirective",
    "conditionalDirective",
    "pragmaDirective",
    "declaration",
    "scopeDeclaration",
    "scopeMember",
    "visibilityModifier",
    "registerDeclaration",
    "registerMember",
    "accessModifier",
    "structDeclaration",
    "structMember",
    "enumDeclaration",
    "enumMember",
    "bitmapDeclaration",
    "bitmapType",
    "bitmapMember",
    "functionDeclaration",
    "parameterList",
    "parameter",
    "constModifier",
    "volatileModifier",
    "overflowModifier",
    "atomicModifier",
    "arrayDimension",
    "variableDeclaration",
    "constructorArgumentList",
    "block",
    "statement",
    "criticalStatement",
    "assignmentStatement",
    "assignmentOperator",
    "assignmentTarget",
    "postfixTargetOp",
    "expressionStatement",
    "ifStatement",
    "whileStatement",
    "doWhileStatement",
    "forStatement",
    "forInit",
    "forVarDecl",
    "forAssignment",
    "forUpdate",
    "returnStatement",
    "switchStatement",
    "switchCase",
    "caseLabel",
    "defaultCase",
    "expression",
    "ternaryExpression",
    "orExpression",
    "andExpression",
    "equalityExpression",
    "relationalExpression",
    "bitwiseOrExpression",
    "bitwiseXorExpression",
    "bitwiseAndExpression",
    "shiftExpression",
    "additiveExpression",
    "multiplicativeExpression",
    "unaryExpression",
    "postfixExpression",
    "postfixOp",
    "primaryExpression",
    "sizeofExpression",
    "castExpression",
    "structInitializer",
    "fieldInitializerList",
    "fieldInitializer",
    "arrayInitializer",
    "arrayInitializerElement",
    "memberAccess",
    "arrayAccess",
    "argumentList",
    "type",
    "scopedType",
    "globalType",
    "qualifiedType",
    "primitiveType",
    "userType",
    "templateType",
    "templateArgumentList",
    "templateArgument",
    "stringType",
    "arrayType",
    "literal",
  ];

  public get grammarFileName(): string {
    return "CNext.g4";
  }
  public get literalNames(): (string | null)[] {
    return CNextParser.literalNames;
  }
  public get symbolicNames(): (string | null)[] {
    return CNextParser.symbolicNames;
  }
  public get ruleNames(): string[] {
    return CNextParser.ruleNames;
  }
  public get serializedATN(): number[] {
    return CNextParser._serializedATN;
  }

  protected createFailedPredicateException(
    predicate?: string,
    message?: string,
  ): antlr.FailedPredicateException {
    return new antlr.FailedPredicateException(this, predicate, message);
  }

  public constructor(input: antlr.TokenStream) {
    super(input);
    this.interpreter = new antlr.ParserATNSimulator(
      this,
      CNextParser._ATN,
      CNextParser.decisionsToDFA,
      new antlr.PredictionContextCache(),
    );
  }
  public program(): ProgramContext {
    let localContext = new ProgramContext(this.context, this.state);
    this.enterRule(localContext, 0, CNextParser.RULE_program);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 182;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while ((_la & ~0x1f) === 0 && ((1 << _la) & 2044) !== 0) {
          {
            this.state = 180;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
              case CNextParser.INCLUDE_DIRECTIVE:
                {
                  this.state = 178;
                  this.includeDirective();
                }
                break;
              case CNextParser.DEFINE_FUNCTION:
              case CNextParser.DEFINE_WITH_VALUE:
              case CNextParser.DEFINE_FLAG:
              case CNextParser.IFDEF_DIRECTIVE:
              case CNextParser.IFNDEF_DIRECTIVE:
              case CNextParser.ELSE_DIRECTIVE:
              case CNextParser.ENDIF_DIRECTIVE:
              case CNextParser.PRAGMA_TARGET:
                {
                  this.state = 179;
                  this.preprocessorDirective();
                }
                break;
              default:
                throw new antlr.NoViableAltException(this);
            }
          }
          this.state = 184;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 188;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (
          ((_la & ~0x1f) === 0 && ((1 << _la) & 3799040) !== 0) ||
          (((_la - 34) & ~0x1f) === 0 &&
            ((1 << (_la - 34)) & 2146973757) !== 0) ||
          _la === 113
        ) {
          {
            {
              this.state = 185;
              this.declaration();
            }
          }
          this.state = 190;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 191;
        this.match(CNextParser.EOF);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public includeDirective(): IncludeDirectiveContext {
    let localContext = new IncludeDirectiveContext(this.context, this.state);
    this.enterRule(localContext, 2, CNextParser.RULE_includeDirective);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 193;
        this.match(CNextParser.INCLUDE_DIRECTIVE);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public preprocessorDirective(): PreprocessorDirectiveContext {
    let localContext = new PreprocessorDirectiveContext(
      this.context,
      this.state,
    );
    this.enterRule(localContext, 4, CNextParser.RULE_preprocessorDirective);
    try {
      this.state = 198;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case CNextParser.DEFINE_FUNCTION:
        case CNextParser.DEFINE_WITH_VALUE:
        case CNextParser.DEFINE_FLAG:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 195;
            this.defineDirective();
          }
          break;
        case CNextParser.IFDEF_DIRECTIVE:
        case CNextParser.IFNDEF_DIRECTIVE:
        case CNextParser.ELSE_DIRECTIVE:
        case CNextParser.ENDIF_DIRECTIVE:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 196;
            this.conditionalDirective();
          }
          break;
        case CNextParser.PRAGMA_TARGET:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 197;
            this.pragmaDirective();
          }
          break;
        default:
          throw new antlr.NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public defineDirective(): DefineDirectiveContext {
    let localContext = new DefineDirectiveContext(this.context, this.state);
    this.enterRule(localContext, 6, CNextParser.RULE_defineDirective);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 200;
        _la = this.tokenStream.LA(1);
        if (!((_la & ~0x1f) === 0 && ((1 << _la) & 56) !== 0)) {
          this.errorHandler.recoverInline(this);
        } else {
          this.errorHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public conditionalDirective(): ConditionalDirectiveContext {
    let localContext = new ConditionalDirectiveContext(
      this.context,
      this.state,
    );
    this.enterRule(localContext, 8, CNextParser.RULE_conditionalDirective);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 202;
        _la = this.tokenStream.LA(1);
        if (!((_la & ~0x1f) === 0 && ((1 << _la) & 960) !== 0)) {
          this.errorHandler.recoverInline(this);
        } else {
          this.errorHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public pragmaDirective(): PragmaDirectiveContext {
    let localContext = new PragmaDirectiveContext(this.context, this.state);
    this.enterRule(localContext, 10, CNextParser.RULE_pragmaDirective);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 204;
        this.match(CNextParser.PRAGMA_TARGET);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public declaration(): DeclarationContext {
    let localContext = new DeclarationContext(this.context, this.state);
    this.enterRule(localContext, 12, CNextParser.RULE_declaration);
    try {
      this.state = 213;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 4, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 206;
            this.scopeDeclaration();
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 207;
            this.registerDeclaration();
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 208;
            this.structDeclaration();
          }
          break;
        case 4:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 209;
            this.enumDeclaration();
          }
          break;
        case 5:
          this.enterOuterAlt(localContext, 5);
          {
            this.state = 210;
            this.bitmapDeclaration();
          }
          break;
        case 6:
          this.enterOuterAlt(localContext, 6);
          {
            this.state = 211;
            this.functionDeclaration();
          }
          break;
        case 7:
          this.enterOuterAlt(localContext, 7);
          {
            this.state = 212;
            this.variableDeclaration();
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public scopeDeclaration(): ScopeDeclarationContext {
    let localContext = new ScopeDeclarationContext(this.context, this.state);
    this.enterRule(localContext, 14, CNextParser.RULE_scopeDeclaration);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 215;
        this.match(CNextParser.SCOPE);
        this.state = 216;
        this.match(CNextParser.IDENTIFIER);
        this.state = 217;
        this.match(CNextParser.LBRACE);
        this.state = 221;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (
          ((_la & ~0x1f) === 0 && ((1 << _la) & 4190208) !== 0) ||
          (((_la - 34) & ~0x1f) === 0 &&
            ((1 << (_la - 34)) & 2146973757) !== 0) ||
          _la === 113
        ) {
          {
            {
              this.state = 218;
              this.scopeMember();
            }
          }
          this.state = 223;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 224;
        this.match(CNextParser.RBRACE);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public scopeMember(): ScopeMemberContext {
    let localContext = new ScopeMemberContext(this.context, this.state);
    this.enterRule(localContext, 16, CNextParser.RULE_scopeMember);
    let _la: number;
    try {
      this.state = 250;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 12, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 227;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 17 || _la === 18) {
              {
                this.state = 226;
                this.visibilityModifier();
              }
            }

            this.state = 229;
            this.variableDeclaration();
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 231;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 17 || _la === 18) {
              {
                this.state = 230;
                this.visibilityModifier();
              }
            }

            this.state = 233;
            this.functionDeclaration();
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 235;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 17 || _la === 18) {
              {
                this.state = 234;
                this.visibilityModifier();
              }
            }

            this.state = 237;
            this.enumDeclaration();
          }
          break;
        case 4:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 239;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 17 || _la === 18) {
              {
                this.state = 238;
                this.visibilityModifier();
              }
            }

            this.state = 241;
            this.bitmapDeclaration();
          }
          break;
        case 5:
          this.enterOuterAlt(localContext, 5);
          {
            this.state = 243;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 17 || _la === 18) {
              {
                this.state = 242;
                this.visibilityModifier();
              }
            }

            this.state = 245;
            this.registerDeclaration();
          }
          break;
        case 6:
          this.enterOuterAlt(localContext, 6);
          {
            this.state = 247;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 17 || _la === 18) {
              {
                this.state = 246;
                this.visibilityModifier();
              }
            }

            this.state = 249;
            this.structDeclaration();
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public visibilityModifier(): VisibilityModifierContext {
    let localContext = new VisibilityModifierContext(this.context, this.state);
    this.enterRule(localContext, 18, CNextParser.RULE_visibilityModifier);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 252;
        _la = this.tokenStream.LA(1);
        if (!(_la === 17 || _la === 18)) {
          this.errorHandler.recoverInline(this);
        } else {
          this.errorHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public registerDeclaration(): RegisterDeclarationContext {
    let localContext = new RegisterDeclarationContext(this.context, this.state);
    this.enterRule(localContext, 20, CNextParser.RULE_registerDeclaration);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 254;
        this.match(CNextParser.REGISTER);
        this.state = 255;
        this.match(CNextParser.IDENTIFIER);
        this.state = 256;
        this.match(CNextParser.AT);
        this.state = 257;
        this.expression();
        this.state = 258;
        this.match(CNextParser.LBRACE);
        this.state = 262;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 113) {
          {
            {
              this.state = 259;
              this.registerMember();
            }
          }
          this.state = 264;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 265;
        this.match(CNextParser.RBRACE);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public registerMember(): RegisterMemberContext {
    let localContext = new RegisterMemberContext(this.context, this.state);
    this.enterRule(localContext, 22, CNextParser.RULE_registerMember);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 267;
        this.match(CNextParser.IDENTIFIER);
        this.state = 268;
        this.match(CNextParser.COLON);
        this.state = 269;
        this.type_();
        this.state = 270;
        this.accessModifier();
        this.state = 271;
        this.match(CNextParser.AT);
        this.state = 272;
        this.expression();
        this.state = 274;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 103) {
          {
            this.state = 273;
            this.match(CNextParser.COMMA);
          }
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public accessModifier(): AccessModifierContext {
    let localContext = new AccessModifierContext(this.context, this.state);
    this.enterRule(localContext, 24, CNextParser.RULE_accessModifier);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 276;
        _la = this.tokenStream.LA(1);
        if (!(((_la - 40) & ~0x1f) === 0 && ((1 << (_la - 40)) & 31) !== 0)) {
          this.errorHandler.recoverInline(this);
        } else {
          this.errorHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public structDeclaration(): StructDeclarationContext {
    let localContext = new StructDeclarationContext(this.context, this.state);
    this.enterRule(localContext, 26, CNextParser.RULE_structDeclaration);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 278;
        this.match(CNextParser.STRUCT);
        this.state = 279;
        this.match(CNextParser.IDENTIFIER);
        this.state = 280;
        this.match(CNextParser.LBRACE);
        this.state = 284;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (
          ((_la & ~0x1f) === 0 && ((1 << _la) & 2146304) !== 0) ||
          (((_la - 34) & ~0x1f) === 0 &&
            ((1 << (_la - 34)) & 2146959361) !== 0) ||
          _la === 113
        ) {
          {
            {
              this.state = 281;
              this.structMember();
            }
          }
          this.state = 286;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 287;
        this.match(CNextParser.RBRACE);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public structMember(): StructMemberContext {
    let localContext = new StructMemberContext(this.context, this.state);
    this.enterRule(localContext, 28, CNextParser.RULE_structMember);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 289;
        this.type_();
        this.state = 290;
        this.match(CNextParser.IDENTIFIER);
        this.state = 294;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 100) {
          {
            {
              this.state = 291;
              this.arrayDimension();
            }
          }
          this.state = 296;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 297;
        this.match(CNextParser.SEMI);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public enumDeclaration(): EnumDeclarationContext {
    let localContext = new EnumDeclarationContext(this.context, this.state);
    this.enterRule(localContext, 30, CNextParser.RULE_enumDeclaration);
    let _la: number;
    try {
      let alternative: number;
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 299;
        this.match(CNextParser.ENUM);
        this.state = 300;
        this.match(CNextParser.IDENTIFIER);
        this.state = 301;
        this.match(CNextParser.LBRACE);
        this.state = 302;
        this.enumMember();
        this.state = 307;
        this.errorHandler.sync(this);
        alternative = this.interpreter.adaptivePredict(
          this.tokenStream,
          17,
          this.context,
        );
        while (
          alternative !== 2 &&
          alternative !== antlr.ATN.INVALID_ALT_NUMBER
        ) {
          if (alternative === 1) {
            {
              {
                this.state = 303;
                this.match(CNextParser.COMMA);
                this.state = 304;
                this.enumMember();
              }
            }
          }
          this.state = 309;
          this.errorHandler.sync(this);
          alternative = this.interpreter.adaptivePredict(
            this.tokenStream,
            17,
            this.context,
          );
        }
        this.state = 311;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 103) {
          {
            this.state = 310;
            this.match(CNextParser.COMMA);
          }
        }

        this.state = 313;
        this.match(CNextParser.RBRACE);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public enumMember(): EnumMemberContext {
    let localContext = new EnumMemberContext(this.context, this.state);
    this.enterRule(localContext, 32, CNextParser.RULE_enumMember);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 315;
        this.match(CNextParser.IDENTIFIER);
        this.state = 318;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 75) {
          {
            this.state = 316;
            this.match(CNextParser.ASSIGN);
            this.state = 317;
            this.expression();
          }
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public bitmapDeclaration(): BitmapDeclarationContext {
    let localContext = new BitmapDeclarationContext(this.context, this.state);
    this.enterRule(localContext, 34, CNextParser.RULE_bitmapDeclaration);
    let _la: number;
    try {
      let alternative: number;
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 320;
        this.bitmapType();
        this.state = 321;
        this.match(CNextParser.IDENTIFIER);
        this.state = 322;
        this.match(CNextParser.LBRACE);
        this.state = 323;
        this.bitmapMember();
        this.state = 328;
        this.errorHandler.sync(this);
        alternative = this.interpreter.adaptivePredict(
          this.tokenStream,
          20,
          this.context,
        );
        while (
          alternative !== 2 &&
          alternative !== antlr.ATN.INVALID_ALT_NUMBER
        ) {
          if (alternative === 1) {
            {
              {
                this.state = 324;
                this.match(CNextParser.COMMA);
                this.state = 325;
                this.bitmapMember();
              }
            }
          }
          this.state = 330;
          this.errorHandler.sync(this);
          alternative = this.interpreter.adaptivePredict(
            this.tokenStream,
            20,
            this.context,
          );
        }
        this.state = 332;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 103) {
          {
            this.state = 331;
            this.match(CNextParser.COMMA);
          }
        }

        this.state = 334;
        this.match(CNextParser.RBRACE);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public bitmapType(): BitmapTypeContext {
    let localContext = new BitmapTypeContext(this.context, this.state);
    this.enterRule(localContext, 36, CNextParser.RULE_bitmapType);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 336;
        _la = this.tokenStream.LA(1);
        if (!(((_la - 36) & ~0x1f) === 0 && ((1 << (_la - 36)) & 15) !== 0)) {
          this.errorHandler.recoverInline(this);
        } else {
          this.errorHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public bitmapMember(): BitmapMemberContext {
    let localContext = new BitmapMemberContext(this.context, this.state);
    this.enterRule(localContext, 38, CNextParser.RULE_bitmapMember);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 338;
        this.match(CNextParser.IDENTIFIER);
        this.state = 342;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 100) {
          {
            this.state = 339;
            this.match(CNextParser.LBRACKET);
            this.state = 340;
            this.match(CNextParser.INTEGER_LITERAL);
            this.state = 341;
            this.match(CNextParser.RBRACKET);
          }
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public functionDeclaration(): FunctionDeclarationContext {
    let localContext = new FunctionDeclarationContext(this.context, this.state);
    this.enterRule(localContext, 40, CNextParser.RULE_functionDeclaration);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 344;
        this.type_();
        this.state = 345;
        this.match(CNextParser.IDENTIFIER);
        this.state = 346;
        this.match(CNextParser.LPAREN);
        this.state = 348;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (
          ((_la & ~0x1f) === 0 && ((1 << _la) & 2670592) !== 0) ||
          (((_la - 34) & ~0x1f) === 0 &&
            ((1 << (_la - 34)) & 2146959361) !== 0) ||
          _la === 113
        ) {
          {
            this.state = 347;
            this.parameterList();
          }
        }

        this.state = 350;
        this.match(CNextParser.RPAREN);
        this.state = 351;
        this.block();
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public parameterList(): ParameterListContext {
    let localContext = new ParameterListContext(this.context, this.state);
    this.enterRule(localContext, 42, CNextParser.RULE_parameterList);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 353;
        this.parameter();
        this.state = 358;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 103) {
          {
            {
              this.state = 354;
              this.match(CNextParser.COMMA);
              this.state = 355;
              this.parameter();
            }
          }
          this.state = 360;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public parameter(): ParameterContext {
    let localContext = new ParameterContext(this.context, this.state);
    this.enterRule(localContext, 44, CNextParser.RULE_parameter);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 362;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 19) {
          {
            this.state = 361;
            this.constModifier();
          }
        }

        this.state = 364;
        this.type_();
        this.state = 365;
        this.match(CNextParser.IDENTIFIER);
        this.state = 369;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 100) {
          {
            {
              this.state = 366;
              this.arrayDimension();
            }
          }
          this.state = 371;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public constModifier(): ConstModifierContext {
    let localContext = new ConstModifierContext(this.context, this.state);
    this.enterRule(localContext, 46, CNextParser.RULE_constModifier);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 372;
        this.match(CNextParser.CONST);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public volatileModifier(): VolatileModifierContext {
    let localContext = new VolatileModifierContext(this.context, this.state);
    this.enterRule(localContext, 48, CNextParser.RULE_volatileModifier);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 374;
        this.match(CNextParser.VOLATILE);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public overflowModifier(): OverflowModifierContext {
    let localContext = new OverflowModifierContext(this.context, this.state);
    this.enterRule(localContext, 50, CNextParser.RULE_overflowModifier);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 376;
        _la = this.tokenStream.LA(1);
        if (!(_la === 45 || _la === 46)) {
          this.errorHandler.recoverInline(this);
        } else {
          this.errorHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public atomicModifier(): AtomicModifierContext {
    let localContext = new AtomicModifierContext(this.context, this.state);
    this.enterRule(localContext, 52, CNextParser.RULE_atomicModifier);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 378;
        this.match(CNextParser.ATOMIC);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public arrayDimension(): ArrayDimensionContext {
    let localContext = new ArrayDimensionContext(this.context, this.state);
    this.enterRule(localContext, 54, CNextParser.RULE_arrayDimension);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 380;
        this.match(CNextParser.LBRACKET);
        this.state = 382;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (
          ((_la & ~0x1f) === 0 && ((1 << _la) & 2147532800) !== 0) ||
          (((_la - 32) & ~0x1f) === 0 && ((1 << (_la - 32)) & 1966091) !== 0) ||
          (((_la - 83) & ~0x1f) === 0 && ((1 << (_la - 83)) & 2130879681) !== 0)
        ) {
          {
            this.state = 381;
            this.expression();
          }
        }

        this.state = 384;
        this.match(CNextParser.RBRACKET);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public variableDeclaration(): VariableDeclarationContext {
    let localContext = new VariableDeclarationContext(this.context, this.state);
    this.enterRule(localContext, 56, CNextParser.RULE_variableDeclaration);
    let _la: number;
    try {
      this.state = 419;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 34, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 387;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 47) {
              {
                this.state = 386;
                this.atomicModifier();
              }
            }

            this.state = 390;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 20) {
              {
                this.state = 389;
                this.volatileModifier();
              }
            }

            this.state = 393;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 19) {
              {
                this.state = 392;
                this.constModifier();
              }
            }

            this.state = 396;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 45 || _la === 46) {
              {
                this.state = 395;
                this.overflowModifier();
              }
            }

            this.state = 398;
            this.type_();
            this.state = 399;
            this.match(CNextParser.IDENTIFIER);
            this.state = 403;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 100) {
              {
                {
                  this.state = 400;
                  this.arrayDimension();
                }
              }
              this.state = 405;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            }
            this.state = 408;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 75) {
              {
                this.state = 406;
                this.match(CNextParser.ASSIGN);
                this.state = 407;
                this.expression();
              }
            }

            this.state = 410;
            this.match(CNextParser.SEMI);
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 412;
            this.type_();
            this.state = 413;
            this.match(CNextParser.IDENTIFIER);
            this.state = 414;
            this.match(CNextParser.LPAREN);
            this.state = 415;
            this.constructorArgumentList();
            this.state = 416;
            this.match(CNextParser.RPAREN);
            this.state = 417;
            this.match(CNextParser.SEMI);
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public constructorArgumentList(): ConstructorArgumentListContext {
    let localContext = new ConstructorArgumentListContext(
      this.context,
      this.state,
    );
    this.enterRule(localContext, 58, CNextParser.RULE_constructorArgumentList);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 421;
        this.match(CNextParser.IDENTIFIER);
        this.state = 426;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 103) {
          {
            {
              this.state = 422;
              this.match(CNextParser.COMMA);
              this.state = 423;
              this.match(CNextParser.IDENTIFIER);
            }
          }
          this.state = 428;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public block(): BlockContext {
    let localContext = new BlockContext(this.context, this.state);
    this.enterRule(localContext, 60, CNextParser.RULE_block);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 429;
        this.match(CNextParser.LBRACE);
        this.state = 433;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (
          (((_la - 14) & ~0x1f) === 0 &&
            ((1 << (_la - 14)) & 2151628259) !== 0) ||
          (((_la - 46) & ~0x1f) === 0 && ((1 << (_la - 46)) & 524287) !== 0) ||
          (((_la - 83) & ~0x1f) === 0 && ((1 << (_la - 83)) & 2130879681) !== 0)
        ) {
          {
            {
              this.state = 430;
              this.statement();
            }
          }
          this.state = 435;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 436;
        this.match(CNextParser.RBRACE);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public statement(): StatementContext {
    let localContext = new StatementContext(this.context, this.state);
    this.enterRule(localContext, 62, CNextParser.RULE_statement);
    try {
      this.state = 449;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 37, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 438;
            this.variableDeclaration();
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 439;
            this.assignmentStatement();
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 440;
            this.expressionStatement();
          }
          break;
        case 4:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 441;
            this.ifStatement();
          }
          break;
        case 5:
          this.enterOuterAlt(localContext, 5);
          {
            this.state = 442;
            this.whileStatement();
          }
          break;
        case 6:
          this.enterOuterAlt(localContext, 6);
          {
            this.state = 443;
            this.doWhileStatement();
          }
          break;
        case 7:
          this.enterOuterAlt(localContext, 7);
          {
            this.state = 444;
            this.forStatement();
          }
          break;
        case 8:
          this.enterOuterAlt(localContext, 8);
          {
            this.state = 445;
            this.switchStatement();
          }
          break;
        case 9:
          this.enterOuterAlt(localContext, 9);
          {
            this.state = 446;
            this.returnStatement();
          }
          break;
        case 10:
          this.enterOuterAlt(localContext, 10);
          {
            this.state = 447;
            this.criticalStatement();
          }
          break;
        case 11:
          this.enterOuterAlt(localContext, 11);
          {
            this.state = 448;
            this.block();
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public criticalStatement(): CriticalStatementContext {
    let localContext = new CriticalStatementContext(this.context, this.state);
    this.enterRule(localContext, 64, CNextParser.RULE_criticalStatement);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 451;
        this.match(CNextParser.CRITICAL);
        this.state = 452;
        this.block();
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public assignmentStatement(): AssignmentStatementContext {
    let localContext = new AssignmentStatementContext(this.context, this.state);
    this.enterRule(localContext, 66, CNextParser.RULE_assignmentStatement);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 454;
        this.assignmentTarget();
        this.state = 455;
        this.assignmentOperator();
        this.state = 456;
        this.expression();
        this.state = 457;
        this.match(CNextParser.SEMI);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public assignmentOperator(): AssignmentOperatorContext {
    let localContext = new AssignmentOperatorContext(this.context, this.state);
    this.enterRule(localContext, 68, CNextParser.RULE_assignmentOperator);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 459;
        _la = this.tokenStream.LA(1);
        if (!(((_la - 65) & ~0x1f) === 0 && ((1 << (_la - 65)) & 2047) !== 0)) {
          this.errorHandler.recoverInline(this);
        } else {
          this.errorHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public assignmentTarget(): AssignmentTargetContext {
    let localContext = new AssignmentTargetContext(this.context, this.state);
    this.enterRule(localContext, 70, CNextParser.RULE_assignmentTarget);
    let _la: number;
    try {
      this.state = 482;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 40, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 461;
            this.match(CNextParser.GLOBAL);
            this.state = 462;
            this.match(CNextParser.DOT);
            this.state = 463;
            this.match(CNextParser.IDENTIFIER);
            this.state = 467;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 100 || _la === 104) {
              {
                {
                  this.state = 464;
                  this.postfixTargetOp();
                }
              }
              this.state = 469;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            }
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 470;
            this.match(CNextParser.THIS);
            this.state = 471;
            this.match(CNextParser.DOT);
            this.state = 472;
            this.match(CNextParser.IDENTIFIER);
            this.state = 476;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 100 || _la === 104) {
              {
                {
                  this.state = 473;
                  this.postfixTargetOp();
                }
              }
              this.state = 478;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            }
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 479;
            this.arrayAccess();
          }
          break;
        case 4:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 480;
            this.memberAccess();
          }
          break;
        case 5:
          this.enterOuterAlt(localContext, 5);
          {
            this.state = 481;
            this.match(CNextParser.IDENTIFIER);
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public postfixTargetOp(): PostfixTargetOpContext {
    let localContext = new PostfixTargetOpContext(this.context, this.state);
    this.enterRule(localContext, 72, CNextParser.RULE_postfixTargetOp);
    try {
      this.state = 496;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 41, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 484;
            this.match(CNextParser.DOT);
            this.state = 485;
            this.match(CNextParser.IDENTIFIER);
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 486;
            this.match(CNextParser.LBRACKET);
            this.state = 487;
            this.expression();
            this.state = 488;
            this.match(CNextParser.RBRACKET);
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 490;
            this.match(CNextParser.LBRACKET);
            this.state = 491;
            this.expression();
            this.state = 492;
            this.match(CNextParser.COMMA);
            this.state = 493;
            this.expression();
            this.state = 494;
            this.match(CNextParser.RBRACKET);
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public expressionStatement(): ExpressionStatementContext {
    let localContext = new ExpressionStatementContext(this.context, this.state);
    this.enterRule(localContext, 74, CNextParser.RULE_expressionStatement);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 498;
        this.expression();
        this.state = 499;
        this.match(CNextParser.SEMI);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public ifStatement(): IfStatementContext {
    let localContext = new IfStatementContext(this.context, this.state);
    this.enterRule(localContext, 76, CNextParser.RULE_ifStatement);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 501;
        this.match(CNextParser.IF);
        this.state = 502;
        this.match(CNextParser.LPAREN);
        this.state = 503;
        this.expression();
        this.state = 504;
        this.match(CNextParser.RPAREN);
        this.state = 505;
        this.statement();
        this.state = 508;
        this.errorHandler.sync(this);
        switch (
          this.interpreter.adaptivePredict(this.tokenStream, 42, this.context)
        ) {
          case 1:
            {
              this.state = 506;
              this.match(CNextParser.ELSE);
              this.state = 507;
              this.statement();
            }
            break;
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public whileStatement(): WhileStatementContext {
    let localContext = new WhileStatementContext(this.context, this.state);
    this.enterRule(localContext, 78, CNextParser.RULE_whileStatement);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 510;
        this.match(CNextParser.WHILE);
        this.state = 511;
        this.match(CNextParser.LPAREN);
        this.state = 512;
        this.expression();
        this.state = 513;
        this.match(CNextParser.RPAREN);
        this.state = 514;
        this.statement();
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public doWhileStatement(): DoWhileStatementContext {
    let localContext = new DoWhileStatementContext(this.context, this.state);
    this.enterRule(localContext, 80, CNextParser.RULE_doWhileStatement);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 516;
        this.match(CNextParser.DO);
        this.state = 517;
        this.block();
        this.state = 518;
        this.match(CNextParser.WHILE);
        this.state = 519;
        this.match(CNextParser.LPAREN);
        this.state = 520;
        this.expression();
        this.state = 521;
        this.match(CNextParser.RPAREN);
        this.state = 522;
        this.match(CNextParser.SEMI);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public forStatement(): ForStatementContext {
    let localContext = new ForStatementContext(this.context, this.state);
    this.enterRule(localContext, 82, CNextParser.RULE_forStatement);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 524;
        this.match(CNextParser.FOR);
        this.state = 525;
        this.match(CNextParser.LPAREN);
        this.state = 527;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (
          ((_la & ~0x1f) === 0 && ((1 << _la) & 3194880) !== 0) ||
          (((_la - 34) & ~0x1f) === 0 &&
            ((1 << (_la - 34)) & 2146973697) !== 0) ||
          _la === 113
        ) {
          {
            this.state = 526;
            this.forInit();
          }
        }

        this.state = 529;
        this.match(CNextParser.SEMI);
        this.state = 531;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (
          ((_la & ~0x1f) === 0 && ((1 << _la) & 2147532800) !== 0) ||
          (((_la - 32) & ~0x1f) === 0 && ((1 << (_la - 32)) & 1966091) !== 0) ||
          (((_la - 83) & ~0x1f) === 0 && ((1 << (_la - 83)) & 2130879681) !== 0)
        ) {
          {
            this.state = 530;
            this.expression();
          }
        }

        this.state = 533;
        this.match(CNextParser.SEMI);
        this.state = 535;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 14 || _la === 15 || _la === 113) {
          {
            this.state = 534;
            this.forUpdate();
          }
        }

        this.state = 537;
        this.match(CNextParser.RPAREN);
        this.state = 538;
        this.statement();
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public forInit(): ForInitContext {
    let localContext = new ForInitContext(this.context, this.state);
    this.enterRule(localContext, 84, CNextParser.RULE_forInit);
    try {
      this.state = 542;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 46, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 540;
            this.forVarDecl();
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 541;
            this.forAssignment();
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public forVarDecl(): ForVarDeclContext {
    let localContext = new ForVarDeclContext(this.context, this.state);
    this.enterRule(localContext, 86, CNextParser.RULE_forVarDecl);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 545;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 47) {
          {
            this.state = 544;
            this.atomicModifier();
          }
        }

        this.state = 548;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 20) {
          {
            this.state = 547;
            this.volatileModifier();
          }
        }

        this.state = 551;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 45 || _la === 46) {
          {
            this.state = 550;
            this.overflowModifier();
          }
        }

        this.state = 553;
        this.type_();
        this.state = 554;
        this.match(CNextParser.IDENTIFIER);
        this.state = 558;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 100) {
          {
            {
              this.state = 555;
              this.arrayDimension();
            }
          }
          this.state = 560;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 563;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 75) {
          {
            this.state = 561;
            this.match(CNextParser.ASSIGN);
            this.state = 562;
            this.expression();
          }
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public forAssignment(): ForAssignmentContext {
    let localContext = new ForAssignmentContext(this.context, this.state);
    this.enterRule(localContext, 88, CNextParser.RULE_forAssignment);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 565;
        this.assignmentTarget();
        this.state = 566;
        this.assignmentOperator();
        this.state = 567;
        this.expression();
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public forUpdate(): ForUpdateContext {
    let localContext = new ForUpdateContext(this.context, this.state);
    this.enterRule(localContext, 90, CNextParser.RULE_forUpdate);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 569;
        this.assignmentTarget();
        this.state = 570;
        this.assignmentOperator();
        this.state = 571;
        this.expression();
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public returnStatement(): ReturnStatementContext {
    let localContext = new ReturnStatementContext(this.context, this.state);
    this.enterRule(localContext, 92, CNextParser.RULE_returnStatement);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 573;
        this.match(CNextParser.RETURN);
        this.state = 575;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (
          ((_la & ~0x1f) === 0 && ((1 << _la) & 2147532800) !== 0) ||
          (((_la - 32) & ~0x1f) === 0 && ((1 << (_la - 32)) & 1966091) !== 0) ||
          (((_la - 83) & ~0x1f) === 0 && ((1 << (_la - 83)) & 2130879681) !== 0)
        ) {
          {
            this.state = 574;
            this.expression();
          }
        }

        this.state = 577;
        this.match(CNextParser.SEMI);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public switchStatement(): SwitchStatementContext {
    let localContext = new SwitchStatementContext(this.context, this.state);
    this.enterRule(localContext, 94, CNextParser.RULE_switchStatement);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 579;
        this.match(CNextParser.SWITCH);
        this.state = 580;
        this.match(CNextParser.LPAREN);
        this.state = 581;
        this.expression();
        this.state = 582;
        this.match(CNextParser.RPAREN);
        this.state = 583;
        this.match(CNextParser.LBRACE);
        this.state = 585;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        do {
          {
            {
              this.state = 584;
              this.switchCase();
            }
          }
          this.state = 587;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        } while (_la === 28);
        this.state = 590;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 29) {
          {
            this.state = 589;
            this.defaultCase();
          }
        }

        this.state = 592;
        this.match(CNextParser.RBRACE);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public switchCase(): SwitchCaseContext {
    let localContext = new SwitchCaseContext(this.context, this.state);
    this.enterRule(localContext, 96, CNextParser.RULE_switchCase);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 594;
        this.match(CNextParser.CASE);
        this.state = 595;
        this.caseLabel();
        this.state = 600;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 88) {
          {
            {
              this.state = 596;
              this.match(CNextParser.OR);
              this.state = 597;
              this.caseLabel();
            }
          }
          this.state = 602;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
        this.state = 603;
        this.block();
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public caseLabel(): CaseLabelContext {
    let localContext = new CaseLabelContext(this.context, this.state);
    this.enterRule(localContext, 98, CNextParser.RULE_caseLabel);
    let _la: number;
    try {
      this.state = 617;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 58, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 605;
            this.qualifiedType();
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 606;
            this.match(CNextParser.IDENTIFIER);
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 608;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 83) {
              {
                this.state = 607;
                this.match(CNextParser.MINUS);
              }
            }

            this.state = 610;
            this.match(CNextParser.INTEGER_LITERAL);
          }
          break;
        case 4:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 612;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 83) {
              {
                this.state = 611;
                this.match(CNextParser.MINUS);
              }
            }

            this.state = 614;
            this.match(CNextParser.HEX_LITERAL);
          }
          break;
        case 5:
          this.enterOuterAlt(localContext, 5);
          {
            this.state = 615;
            this.match(CNextParser.BINARY_LITERAL);
          }
          break;
        case 6:
          this.enterOuterAlt(localContext, 6);
          {
            this.state = 616;
            this.match(CNextParser.CHAR_LITERAL);
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public defaultCase(): DefaultCaseContext {
    let localContext = new DefaultCaseContext(this.context, this.state);
    this.enterRule(localContext, 100, CNextParser.RULE_defaultCase);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 619;
        this.match(CNextParser.DEFAULT);
        this.state = 623;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 96) {
          {
            this.state = 620;
            this.match(CNextParser.LPAREN);
            this.state = 621;
            this.match(CNextParser.INTEGER_LITERAL);
            this.state = 622;
            this.match(CNextParser.RPAREN);
          }
        }

        this.state = 625;
        this.block();
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public expression(): ExpressionContext {
    let localContext = new ExpressionContext(this.context, this.state);
    this.enterRule(localContext, 102, CNextParser.RULE_expression);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 627;
        this.ternaryExpression();
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public ternaryExpression(): TernaryExpressionContext {
    let localContext = new TernaryExpressionContext(this.context, this.state);
    this.enterRule(localContext, 104, CNextParser.RULE_ternaryExpression);
    try {
      this.state = 638;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 60, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 629;
            this.match(CNextParser.LPAREN);
            this.state = 630;
            this.orExpression();
            this.state = 631;
            this.match(CNextParser.RPAREN);
            this.state = 632;
            this.match(CNextParser.T__0);
            this.state = 633;
            this.orExpression();
            this.state = 634;
            this.match(CNextParser.COLON);
            this.state = 635;
            this.orExpression();
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 637;
            this.orExpression();
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public orExpression(): OrExpressionContext {
    let localContext = new OrExpressionContext(this.context, this.state);
    this.enterRule(localContext, 106, CNextParser.RULE_orExpression);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 640;
        this.andExpression();
        this.state = 645;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 88) {
          {
            {
              this.state = 641;
              this.match(CNextParser.OR);
              this.state = 642;
              this.andExpression();
            }
          }
          this.state = 647;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public andExpression(): AndExpressionContext {
    let localContext = new AndExpressionContext(this.context, this.state);
    this.enterRule(localContext, 108, CNextParser.RULE_andExpression);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 648;
        this.equalityExpression();
        this.state = 653;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 87) {
          {
            {
              this.state = 649;
              this.match(CNextParser.AND);
              this.state = 650;
              this.equalityExpression();
            }
          }
          this.state = 655;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public equalityExpression(): EqualityExpressionContext {
    let localContext = new EqualityExpressionContext(this.context, this.state);
    this.enterRule(localContext, 110, CNextParser.RULE_equalityExpression);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 656;
        this.relationalExpression();
        this.state = 661;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 76 || _la === 77) {
          {
            {
              this.state = 657;
              _la = this.tokenStream.LA(1);
              if (!(_la === 76 || _la === 77)) {
                this.errorHandler.recoverInline(this);
              } else {
                this.errorHandler.reportMatch(this);
                this.consume();
              }
              this.state = 658;
              this.relationalExpression();
            }
          }
          this.state = 663;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public relationalExpression(): RelationalExpressionContext {
    let localContext = new RelationalExpressionContext(
      this.context,
      this.state,
    );
    this.enterRule(localContext, 112, CNextParser.RULE_relationalExpression);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 664;
        this.bitwiseOrExpression();
        this.state = 669;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (((_la - 78) & ~0x1f) === 0 && ((1 << (_la - 78)) & 15) !== 0) {
          {
            {
              this.state = 665;
              _la = this.tokenStream.LA(1);
              if (
                !(((_la - 78) & ~0x1f) === 0 && ((1 << (_la - 78)) & 15) !== 0)
              ) {
                this.errorHandler.recoverInline(this);
              } else {
                this.errorHandler.reportMatch(this);
                this.consume();
              }
              this.state = 666;
              this.bitwiseOrExpression();
            }
          }
          this.state = 671;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public bitwiseOrExpression(): BitwiseOrExpressionContext {
    let localContext = new BitwiseOrExpressionContext(this.context, this.state);
    this.enterRule(localContext, 114, CNextParser.RULE_bitwiseOrExpression);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 672;
        this.bitwiseXorExpression();
        this.state = 677;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 91) {
          {
            {
              this.state = 673;
              this.match(CNextParser.BITOR);
              this.state = 674;
              this.bitwiseXorExpression();
            }
          }
          this.state = 679;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public bitwiseXorExpression(): BitwiseXorExpressionContext {
    let localContext = new BitwiseXorExpressionContext(
      this.context,
      this.state,
    );
    this.enterRule(localContext, 116, CNextParser.RULE_bitwiseXorExpression);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 680;
        this.bitwiseAndExpression();
        this.state = 685;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 92) {
          {
            {
              this.state = 681;
              this.match(CNextParser.BITXOR);
              this.state = 682;
              this.bitwiseAndExpression();
            }
          }
          this.state = 687;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public bitwiseAndExpression(): BitwiseAndExpressionContext {
    let localContext = new BitwiseAndExpressionContext(
      this.context,
      this.state,
    );
    this.enterRule(localContext, 118, CNextParser.RULE_bitwiseAndExpression);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 688;
        this.shiftExpression();
        this.state = 693;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 90) {
          {
            {
              this.state = 689;
              this.match(CNextParser.BITAND);
              this.state = 690;
              this.shiftExpression();
            }
          }
          this.state = 695;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public shiftExpression(): ShiftExpressionContext {
    let localContext = new ShiftExpressionContext(this.context, this.state);
    this.enterRule(localContext, 120, CNextParser.RULE_shiftExpression);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 696;
        this.additiveExpression();
        this.state = 701;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 94 || _la === 95) {
          {
            {
              this.state = 697;
              _la = this.tokenStream.LA(1);
              if (!(_la === 94 || _la === 95)) {
                this.errorHandler.recoverInline(this);
              } else {
                this.errorHandler.reportMatch(this);
                this.consume();
              }
              this.state = 698;
              this.additiveExpression();
            }
          }
          this.state = 703;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public additiveExpression(): AdditiveExpressionContext {
    let localContext = new AdditiveExpressionContext(this.context, this.state);
    this.enterRule(localContext, 122, CNextParser.RULE_additiveExpression);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 704;
        this.multiplicativeExpression();
        this.state = 709;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 82 || _la === 83) {
          {
            {
              this.state = 705;
              _la = this.tokenStream.LA(1);
              if (!(_la === 82 || _la === 83)) {
                this.errorHandler.recoverInline(this);
              } else {
                this.errorHandler.reportMatch(this);
                this.consume();
              }
              this.state = 706;
              this.multiplicativeExpression();
            }
          }
          this.state = 711;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public multiplicativeExpression(): MultiplicativeExpressionContext {
    let localContext = new MultiplicativeExpressionContext(
      this.context,
      this.state,
    );
    this.enterRule(
      localContext,
      124,
      CNextParser.RULE_multiplicativeExpression,
    );
    let _la: number;
    try {
      let alternative: number;
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 712;
        this.unaryExpression();
        this.state = 717;
        this.errorHandler.sync(this);
        alternative = this.interpreter.adaptivePredict(
          this.tokenStream,
          70,
          this.context,
        );
        while (
          alternative !== 2 &&
          alternative !== antlr.ATN.INVALID_ALT_NUMBER
        ) {
          if (alternative === 1) {
            {
              {
                this.state = 713;
                _la = this.tokenStream.LA(1);
                if (
                  !(((_la - 84) & ~0x1f) === 0 && ((1 << (_la - 84)) & 7) !== 0)
                ) {
                  this.errorHandler.recoverInline(this);
                } else {
                  this.errorHandler.reportMatch(this);
                  this.consume();
                }
                this.state = 714;
                this.unaryExpression();
              }
            }
          }
          this.state = 719;
          this.errorHandler.sync(this);
          alternative = this.interpreter.adaptivePredict(
            this.tokenStream,
            70,
            this.context,
          );
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public unaryExpression(): UnaryExpressionContext {
    let localContext = new UnaryExpressionContext(this.context, this.state);
    this.enterRule(localContext, 126, CNextParser.RULE_unaryExpression);
    try {
      this.state = 729;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case CNextParser.NOT:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 720;
            this.match(CNextParser.NOT);
            this.state = 721;
            this.unaryExpression();
          }
          break;
        case CNextParser.MINUS:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 722;
            this.match(CNextParser.MINUS);
            this.state = 723;
            this.unaryExpression();
          }
          break;
        case CNextParser.BITNOT:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 724;
            this.match(CNextParser.BITNOT);
            this.state = 725;
            this.unaryExpression();
          }
          break;
        case CNextParser.BITAND:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 726;
            this.match(CNextParser.BITAND);
            this.state = 727;
            this.unaryExpression();
          }
          break;
        case CNextParser.THIS:
        case CNextParser.GLOBAL:
        case CNextParser.TRUE:
        case CNextParser.FALSE:
        case CNextParser.C_NULL:
        case CNextParser.SIZEOF:
        case CNextParser.SUFFIXED_FLOAT:
        case CNextParser.SUFFIXED_HEX:
        case CNextParser.SUFFIXED_BINARY:
        case CNextParser.SUFFIXED_DECIMAL:
        case CNextParser.LPAREN:
        case CNextParser.LBRACE:
        case CNextParser.LBRACKET:
        case CNextParser.HEX_LITERAL:
        case CNextParser.BINARY_LITERAL:
        case CNextParser.FLOAT_LITERAL:
        case CNextParser.INTEGER_LITERAL:
        case CNextParser.STRING_LITERAL:
        case CNextParser.CHAR_LITERAL:
        case CNextParser.IDENTIFIER:
          this.enterOuterAlt(localContext, 5);
          {
            this.state = 728;
            this.postfixExpression();
          }
          break;
        default:
          throw new antlr.NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public postfixExpression(): PostfixExpressionContext {
    let localContext = new PostfixExpressionContext(this.context, this.state);
    this.enterRule(localContext, 128, CNextParser.RULE_postfixExpression);
    try {
      let alternative: number;
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 731;
        this.primaryExpression();
        this.state = 735;
        this.errorHandler.sync(this);
        alternative = this.interpreter.adaptivePredict(
          this.tokenStream,
          72,
          this.context,
        );
        while (
          alternative !== 2 &&
          alternative !== antlr.ATN.INVALID_ALT_NUMBER
        ) {
          if (alternative === 1) {
            {
              {
                this.state = 732;
                this.postfixOp();
              }
            }
          }
          this.state = 737;
          this.errorHandler.sync(this);
          alternative = this.interpreter.adaptivePredict(
            this.tokenStream,
            72,
            this.context,
          );
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public postfixOp(): PostfixOpContext {
    let localContext = new PostfixOpContext(this.context, this.state);
    this.enterRule(localContext, 130, CNextParser.RULE_postfixOp);
    let _la: number;
    try {
      this.state = 755;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 74, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 738;
            this.match(CNextParser.DOT);
            this.state = 739;
            this.match(CNextParser.IDENTIFIER);
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 740;
            this.match(CNextParser.LBRACKET);
            this.state = 741;
            this.expression();
            this.state = 742;
            this.match(CNextParser.RBRACKET);
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 744;
            this.match(CNextParser.LBRACKET);
            this.state = 745;
            this.expression();
            this.state = 746;
            this.match(CNextParser.COMMA);
            this.state = 747;
            this.expression();
            this.state = 748;
            this.match(CNextParser.RBRACKET);
          }
          break;
        case 4:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 750;
            this.match(CNextParser.LPAREN);
            this.state = 752;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (
              ((_la & ~0x1f) === 0 && ((1 << _la) & 2147532800) !== 0) ||
              (((_la - 32) & ~0x1f) === 0 &&
                ((1 << (_la - 32)) & 1966091) !== 0) ||
              (((_la - 83) & ~0x1f) === 0 &&
                ((1 << (_la - 83)) & 2130879681) !== 0)
            ) {
              {
                this.state = 751;
                this.argumentList();
              }
            }

            this.state = 754;
            this.match(CNextParser.RPAREN);
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public primaryExpression(): PrimaryExpressionContext {
    let localContext = new PrimaryExpressionContext(this.context, this.state);
    this.enterRule(localContext, 132, CNextParser.RULE_primaryExpression);
    try {
      this.state = 769;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 75, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 757;
            this.sizeofExpression();
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 758;
            this.castExpression();
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 759;
            this.structInitializer();
          }
          break;
        case 4:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 760;
            this.arrayInitializer();
          }
          break;
        case 5:
          this.enterOuterAlt(localContext, 5);
          {
            this.state = 761;
            this.match(CNextParser.THIS);
          }
          break;
        case 6:
          this.enterOuterAlt(localContext, 6);
          {
            this.state = 762;
            this.match(CNextParser.GLOBAL);
          }
          break;
        case 7:
          this.enterOuterAlt(localContext, 7);
          {
            this.state = 763;
            this.match(CNextParser.IDENTIFIER);
          }
          break;
        case 8:
          this.enterOuterAlt(localContext, 8);
          {
            this.state = 764;
            this.literal();
          }
          break;
        case 9:
          this.enterOuterAlt(localContext, 9);
          {
            this.state = 765;
            this.match(CNextParser.LPAREN);
            this.state = 766;
            this.expression();
            this.state = 767;
            this.match(CNextParser.RPAREN);
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public sizeofExpression(): SizeofExpressionContext {
    let localContext = new SizeofExpressionContext(this.context, this.state);
    this.enterRule(localContext, 134, CNextParser.RULE_sizeofExpression);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 771;
        this.match(CNextParser.SIZEOF);
        this.state = 772;
        this.match(CNextParser.LPAREN);
        this.state = 775;
        this.errorHandler.sync(this);
        switch (
          this.interpreter.adaptivePredict(this.tokenStream, 76, this.context)
        ) {
          case 1:
            {
              this.state = 773;
              this.type_();
            }
            break;
          case 2:
            {
              this.state = 774;
              this.expression();
            }
            break;
        }
        this.state = 777;
        this.match(CNextParser.RPAREN);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public castExpression(): CastExpressionContext {
    let localContext = new CastExpressionContext(this.context, this.state);
    this.enterRule(localContext, 136, CNextParser.RULE_castExpression);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 779;
        this.match(CNextParser.LPAREN);
        this.state = 780;
        this.type_();
        this.state = 781;
        this.match(CNextParser.RPAREN);
        this.state = 782;
        this.unaryExpression();
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public structInitializer(): StructInitializerContext {
    let localContext = new StructInitializerContext(this.context, this.state);
    this.enterRule(localContext, 138, CNextParser.RULE_structInitializer);
    let _la: number;
    try {
      this.state = 794;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case CNextParser.IDENTIFIER:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 784;
            this.match(CNextParser.IDENTIFIER);
            this.state = 785;
            this.match(CNextParser.LBRACE);
            this.state = 787;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 113) {
              {
                this.state = 786;
                this.fieldInitializerList();
              }
            }

            this.state = 789;
            this.match(CNextParser.RBRACE);
          }
          break;
        case CNextParser.LBRACE:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 790;
            this.match(CNextParser.LBRACE);
            this.state = 791;
            this.fieldInitializerList();
            this.state = 792;
            this.match(CNextParser.RBRACE);
          }
          break;
        default:
          throw new antlr.NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public fieldInitializerList(): FieldInitializerListContext {
    let localContext = new FieldInitializerListContext(
      this.context,
      this.state,
    );
    this.enterRule(localContext, 140, CNextParser.RULE_fieldInitializerList);
    let _la: number;
    try {
      let alternative: number;
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 796;
        this.fieldInitializer();
        this.state = 801;
        this.errorHandler.sync(this);
        alternative = this.interpreter.adaptivePredict(
          this.tokenStream,
          79,
          this.context,
        );
        while (
          alternative !== 2 &&
          alternative !== antlr.ATN.INVALID_ALT_NUMBER
        ) {
          if (alternative === 1) {
            {
              {
                this.state = 797;
                this.match(CNextParser.COMMA);
                this.state = 798;
                this.fieldInitializer();
              }
            }
          }
          this.state = 803;
          this.errorHandler.sync(this);
          alternative = this.interpreter.adaptivePredict(
            this.tokenStream,
            79,
            this.context,
          );
        }
        this.state = 805;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        if (_la === 103) {
          {
            this.state = 804;
            this.match(CNextParser.COMMA);
          }
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public fieldInitializer(): FieldInitializerContext {
    let localContext = new FieldInitializerContext(this.context, this.state);
    this.enterRule(localContext, 142, CNextParser.RULE_fieldInitializer);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 807;
        this.match(CNextParser.IDENTIFIER);
        this.state = 808;
        this.match(CNextParser.COLON);
        this.state = 809;
        this.expression();
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public arrayInitializer(): ArrayInitializerContext {
    let localContext = new ArrayInitializerContext(this.context, this.state);
    this.enterRule(localContext, 144, CNextParser.RULE_arrayInitializer);
    let _la: number;
    try {
      let alternative: number;
      this.state = 830;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 83, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 811;
            this.match(CNextParser.LBRACKET);
            this.state = 812;
            this.arrayInitializerElement();
            this.state = 817;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(
              this.tokenStream,
              81,
              this.context,
            );
            while (
              alternative !== 2 &&
              alternative !== antlr.ATN.INVALID_ALT_NUMBER
            ) {
              if (alternative === 1) {
                {
                  {
                    this.state = 813;
                    this.match(CNextParser.COMMA);
                    this.state = 814;
                    this.arrayInitializerElement();
                  }
                }
              }
              this.state = 819;
              this.errorHandler.sync(this);
              alternative = this.interpreter.adaptivePredict(
                this.tokenStream,
                81,
                this.context,
              );
            }
            this.state = 821;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 103) {
              {
                this.state = 820;
                this.match(CNextParser.COMMA);
              }
            }

            this.state = 823;
            this.match(CNextParser.RBRACKET);
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 825;
            this.match(CNextParser.LBRACKET);
            this.state = 826;
            this.expression();
            this.state = 827;
            this.match(CNextParser.STAR);
            this.state = 828;
            this.match(CNextParser.RBRACKET);
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public arrayInitializerElement(): ArrayInitializerElementContext {
    let localContext = new ArrayInitializerElementContext(
      this.context,
      this.state,
    );
    this.enterRule(localContext, 146, CNextParser.RULE_arrayInitializerElement);
    try {
      this.state = 835;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 84, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 832;
            this.expression();
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 833;
            this.structInitializer();
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 834;
            this.arrayInitializer();
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public memberAccess(): MemberAccessContext {
    let localContext = new MemberAccessContext(this.context, this.state);
    this.enterRule(localContext, 148, CNextParser.RULE_memberAccess);
    let _la: number;
    try {
      this.state = 898;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 93, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 837;
            this.match(CNextParser.IDENTIFIER);
            this.state = 840;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
              {
                {
                  this.state = 838;
                  this.match(CNextParser.DOT);
                  this.state = 839;
                  this.match(CNextParser.IDENTIFIER);
                }
              }
              this.state = 842;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            } while (_la === 104);
            this.state = 848;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
              {
                {
                  this.state = 844;
                  this.match(CNextParser.LBRACKET);
                  this.state = 845;
                  this.expression();
                  this.state = 846;
                  this.match(CNextParser.RBRACKET);
                }
              }
              this.state = 850;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            } while (_la === 100);
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 852;
            this.match(CNextParser.IDENTIFIER);
            this.state = 855;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
              {
                {
                  this.state = 853;
                  this.match(CNextParser.DOT);
                  this.state = 854;
                  this.match(CNextParser.IDENTIFIER);
                }
              }
              this.state = 857;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            } while (_la === 104);
            this.state = 859;
            this.match(CNextParser.LBRACKET);
            this.state = 860;
            this.expression();
            this.state = 861;
            this.match(CNextParser.COMMA);
            this.state = 862;
            this.expression();
            this.state = 863;
            this.match(CNextParser.RBRACKET);
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 865;
            this.match(CNextParser.IDENTIFIER);
            this.state = 868;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
              {
                {
                  this.state = 866;
                  this.match(CNextParser.DOT);
                  this.state = 867;
                  this.match(CNextParser.IDENTIFIER);
                }
              }
              this.state = 870;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            } while (_la === 104);
          }
          break;
        case 4:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 872;
            this.match(CNextParser.IDENTIFIER);
            this.state = 877;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
              {
                {
                  this.state = 873;
                  this.match(CNextParser.LBRACKET);
                  this.state = 874;
                  this.expression();
                  this.state = 875;
                  this.match(CNextParser.RBRACKET);
                }
              }
              this.state = 879;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            } while (_la === 100);
            this.state = 883;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
              {
                {
                  this.state = 881;
                  this.match(CNextParser.DOT);
                  this.state = 882;
                  this.match(CNextParser.IDENTIFIER);
                }
              }
              this.state = 885;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            } while (_la === 104);
          }
          break;
        case 5:
          this.enterOuterAlt(localContext, 5);
          {
            this.state = 887;
            this.match(CNextParser.IDENTIFIER);
            this.state = 894;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
              {
                this.state = 894;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                  case CNextParser.LBRACKET:
                    {
                      {
                        this.state = 888;
                        this.match(CNextParser.LBRACKET);
                        this.state = 889;
                        this.expression();
                        this.state = 890;
                        this.match(CNextParser.RBRACKET);
                      }
                    }
                    break;
                  case CNextParser.DOT:
                    {
                      {
                        this.state = 892;
                        this.match(CNextParser.DOT);
                        this.state = 893;
                        this.match(CNextParser.IDENTIFIER);
                      }
                    }
                    break;
                  default:
                    throw new antlr.NoViableAltException(this);
                }
              }
              this.state = 896;
              this.errorHandler.sync(this);
              _la = this.tokenStream.LA(1);
            } while (_la === 100 || _la === 104);
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public arrayAccess(): ArrayAccessContext {
    let localContext = new ArrayAccessContext(this.context, this.state);
    this.enterRule(localContext, 150, CNextParser.RULE_arrayAccess);
    try {
      this.state = 912;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 94, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 900;
            this.match(CNextParser.IDENTIFIER);
            this.state = 901;
            this.match(CNextParser.LBRACKET);
            this.state = 902;
            this.expression();
            this.state = 903;
            this.match(CNextParser.RBRACKET);
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 905;
            this.match(CNextParser.IDENTIFIER);
            this.state = 906;
            this.match(CNextParser.LBRACKET);
            this.state = 907;
            this.expression();
            this.state = 908;
            this.match(CNextParser.COMMA);
            this.state = 909;
            this.expression();
            this.state = 910;
            this.match(CNextParser.RBRACKET);
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public argumentList(): ArgumentListContext {
    let localContext = new ArgumentListContext(this.context, this.state);
    this.enterRule(localContext, 152, CNextParser.RULE_argumentList);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 914;
        this.expression();
        this.state = 919;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 103) {
          {
            {
              this.state = 915;
              this.match(CNextParser.COMMA);
              this.state = 916;
              this.expression();
            }
          }
          this.state = 921;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public type_(): TypeContext {
    let localContext = new TypeContext(this.context, this.state);
    this.enterRule(localContext, 154, CNextParser.RULE_type);
    try {
      this.state = 931;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 96, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 922;
            this.primitiveType();
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 923;
            this.stringType();
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 924;
            this.scopedType();
          }
          break;
        case 4:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 925;
            this.globalType();
          }
          break;
        case 5:
          this.enterOuterAlt(localContext, 5);
          {
            this.state = 926;
            this.qualifiedType();
          }
          break;
        case 6:
          this.enterOuterAlt(localContext, 6);
          {
            this.state = 927;
            this.templateType();
          }
          break;
        case 7:
          this.enterOuterAlt(localContext, 7);
          {
            this.state = 928;
            this.userType();
          }
          break;
        case 8:
          this.enterOuterAlt(localContext, 8);
          {
            this.state = 929;
            this.arrayType();
          }
          break;
        case 9:
          this.enterOuterAlt(localContext, 9);
          {
            this.state = 930;
            this.match(CNextParser.VOID);
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public scopedType(): ScopedTypeContext {
    let localContext = new ScopedTypeContext(this.context, this.state);
    this.enterRule(localContext, 156, CNextParser.RULE_scopedType);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 933;
        this.match(CNextParser.THIS);
        this.state = 934;
        this.match(CNextParser.DOT);
        this.state = 935;
        this.match(CNextParser.IDENTIFIER);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public globalType(): GlobalTypeContext {
    let localContext = new GlobalTypeContext(this.context, this.state);
    this.enterRule(localContext, 158, CNextParser.RULE_globalType);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 937;
        this.match(CNextParser.GLOBAL);
        this.state = 938;
        this.match(CNextParser.DOT);
        this.state = 939;
        this.match(CNextParser.IDENTIFIER);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public qualifiedType(): QualifiedTypeContext {
    let localContext = new QualifiedTypeContext(this.context, this.state);
    this.enterRule(localContext, 160, CNextParser.RULE_qualifiedType);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 941;
        this.match(CNextParser.IDENTIFIER);
        this.state = 944;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        do {
          {
            {
              this.state = 942;
              this.match(CNextParser.DOT);
              this.state = 943;
              this.match(CNextParser.IDENTIFIER);
            }
          }
          this.state = 946;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        } while (_la === 104);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public primitiveType(): PrimitiveTypeContext {
    let localContext = new PrimitiveTypeContext(this.context, this.state);
    this.enterRule(localContext, 162, CNextParser.RULE_primitiveType);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 948;
        _la = this.tokenStream.LA(1);
        if (!(((_la - 53) & ~0x1f) === 0 && ((1 << (_la - 53)) & 4095) !== 0)) {
          this.errorHandler.recoverInline(this);
        } else {
          this.errorHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public userType(): UserTypeContext {
    let localContext = new UserTypeContext(this.context, this.state);
    this.enterRule(localContext, 164, CNextParser.RULE_userType);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 950;
        this.match(CNextParser.IDENTIFIER);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public templateType(): TemplateTypeContext {
    let localContext = new TemplateTypeContext(this.context, this.state);
    this.enterRule(localContext, 166, CNextParser.RULE_templateType);
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 952;
        this.match(CNextParser.IDENTIFIER);
        this.state = 953;
        this.match(CNextParser.LT);
        this.state = 954;
        this.templateArgumentList();
        this.state = 955;
        this.match(CNextParser.GT);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public templateArgumentList(): TemplateArgumentListContext {
    let localContext = new TemplateArgumentListContext(
      this.context,
      this.state,
    );
    this.enterRule(localContext, 168, CNextParser.RULE_templateArgumentList);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 957;
        this.templateArgument();
        this.state = 962;
        this.errorHandler.sync(this);
        _la = this.tokenStream.LA(1);
        while (_la === 103) {
          {
            {
              this.state = 958;
              this.match(CNextParser.COMMA);
              this.state = 959;
              this.templateArgument();
            }
          }
          this.state = 964;
          this.errorHandler.sync(this);
          _la = this.tokenStream.LA(1);
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public templateArgument(): TemplateArgumentContext {
    let localContext = new TemplateArgumentContext(this.context, this.state);
    this.enterRule(localContext, 170, CNextParser.RULE_templateArgument);
    try {
      this.state = 969;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 99, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 965;
            this.templateType();
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 966;
            this.primitiveType();
          }
          break;
        case 3:
          this.enterOuterAlt(localContext, 3);
          {
            this.state = 967;
            this.match(CNextParser.IDENTIFIER);
          }
          break;
        case 4:
          this.enterOuterAlt(localContext, 4);
          {
            this.state = 968;
            this.match(CNextParser.INTEGER_LITERAL);
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public stringType(): StringTypeContext {
    let localContext = new StringTypeContext(this.context, this.state);
    this.enterRule(localContext, 172, CNextParser.RULE_stringType);
    try {
      this.state = 976;
      this.errorHandler.sync(this);
      switch (
        this.interpreter.adaptivePredict(this.tokenStream, 100, this.context)
      ) {
        case 1:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 971;
            this.match(CNextParser.STRING);
            this.state = 972;
            this.match(CNextParser.LT);
            this.state = 973;
            this.match(CNextParser.INTEGER_LITERAL);
            this.state = 974;
            this.match(CNextParser.GT);
          }
          break;
        case 2:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 975;
            this.match(CNextParser.STRING);
          }
          break;
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public arrayType(): ArrayTypeContext {
    let localContext = new ArrayTypeContext(this.context, this.state);
    this.enterRule(localContext, 174, CNextParser.RULE_arrayType);
    try {
      this.state = 988;
      this.errorHandler.sync(this);
      switch (this.tokenStream.LA(1)) {
        case CNextParser.U8:
        case CNextParser.U16:
        case CNextParser.U32:
        case CNextParser.U64:
        case CNextParser.I8:
        case CNextParser.I16:
        case CNextParser.I32:
        case CNextParser.I64:
        case CNextParser.F32:
        case CNextParser.F64:
        case CNextParser.BOOL:
        case CNextParser.ISR_TYPE:
          this.enterOuterAlt(localContext, 1);
          {
            this.state = 978;
            this.primitiveType();
            this.state = 979;
            this.match(CNextParser.LBRACKET);
            this.state = 980;
            this.expression();
            this.state = 981;
            this.match(CNextParser.RBRACKET);
          }
          break;
        case CNextParser.IDENTIFIER:
          this.enterOuterAlt(localContext, 2);
          {
            this.state = 983;
            this.userType();
            this.state = 984;
            this.match(CNextParser.LBRACKET);
            this.state = 985;
            this.expression();
            this.state = 986;
            this.match(CNextParser.RBRACKET);
          }
          break;
        default:
          throw new antlr.NoViableAltException(this);
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }
  public literal(): LiteralContext {
    let localContext = new LiteralContext(this.context, this.state);
    this.enterRule(localContext, 176, CNextParser.RULE_literal);
    let _la: number;
    try {
      this.enterOuterAlt(localContext, 1);
      {
        this.state = 990;
        _la = this.tokenStream.LA(1);
        if (
          !(
            (((_la - 31) & ~0x1f) === 0 &&
              ((1 << (_la - 31)) & 3932167) !== 0) ||
            (((_la - 107) & ~0x1f) === 0 && ((1 << (_la - 107)) & 63) !== 0)
          )
        ) {
          this.errorHandler.recoverInline(this);
        } else {
          this.errorHandler.reportMatch(this);
          this.consume();
        }
      }
    } catch (re) {
      if (re instanceof antlr.RecognitionException) {
        this.errorHandler.reportError(this, re);
        this.errorHandler.recover(this, re);
      } else {
        throw re;
      }
    } finally {
      this.exitRule();
    }
    return localContext;
  }

  public static readonly _serializedATN: number[] = [
    4, 1, 117, 993, 2, 0, 7, 0, 2, 1, 7, 1, 2, 2, 7, 2, 2, 3, 7, 3, 2, 4, 7, 4,
    2, 5, 7, 5, 2, 6, 7, 6, 2, 7, 7, 7, 2, 8, 7, 8, 2, 9, 7, 9, 2, 10, 7, 10, 2,
    11, 7, 11, 2, 12, 7, 12, 2, 13, 7, 13, 2, 14, 7, 14, 2, 15, 7, 15, 2, 16, 7,
    16, 2, 17, 7, 17, 2, 18, 7, 18, 2, 19, 7, 19, 2, 20, 7, 20, 2, 21, 7, 21, 2,
    22, 7, 22, 2, 23, 7, 23, 2, 24, 7, 24, 2, 25, 7, 25, 2, 26, 7, 26, 2, 27, 7,
    27, 2, 28, 7, 28, 2, 29, 7, 29, 2, 30, 7, 30, 2, 31, 7, 31, 2, 32, 7, 32, 2,
    33, 7, 33, 2, 34, 7, 34, 2, 35, 7, 35, 2, 36, 7, 36, 2, 37, 7, 37, 2, 38, 7,
    38, 2, 39, 7, 39, 2, 40, 7, 40, 2, 41, 7, 41, 2, 42, 7, 42, 2, 43, 7, 43, 2,
    44, 7, 44, 2, 45, 7, 45, 2, 46, 7, 46, 2, 47, 7, 47, 2, 48, 7, 48, 2, 49, 7,
    49, 2, 50, 7, 50, 2, 51, 7, 51, 2, 52, 7, 52, 2, 53, 7, 53, 2, 54, 7, 54, 2,
    55, 7, 55, 2, 56, 7, 56, 2, 57, 7, 57, 2, 58, 7, 58, 2, 59, 7, 59, 2, 60, 7,
    60, 2, 61, 7, 61, 2, 62, 7, 62, 2, 63, 7, 63, 2, 64, 7, 64, 2, 65, 7, 65, 2,
    66, 7, 66, 2, 67, 7, 67, 2, 68, 7, 68, 2, 69, 7, 69, 2, 70, 7, 70, 2, 71, 7,
    71, 2, 72, 7, 72, 2, 73, 7, 73, 2, 74, 7, 74, 2, 75, 7, 75, 2, 76, 7, 76, 2,
    77, 7, 77, 2, 78, 7, 78, 2, 79, 7, 79, 2, 80, 7, 80, 2, 81, 7, 81, 2, 82, 7,
    82, 2, 83, 7, 83, 2, 84, 7, 84, 2, 85, 7, 85, 2, 86, 7, 86, 2, 87, 7, 87, 2,
    88, 7, 88, 1, 0, 1, 0, 5, 0, 181, 8, 0, 10, 0, 12, 0, 184, 9, 0, 1, 0, 5, 0,
    187, 8, 0, 10, 0, 12, 0, 190, 9, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 2, 1, 2, 1,
    2, 3, 2, 199, 8, 2, 1, 3, 1, 3, 1, 4, 1, 4, 1, 5, 1, 5, 1, 6, 1, 6, 1, 6, 1,
    6, 1, 6, 1, 6, 1, 6, 3, 6, 214, 8, 6, 1, 7, 1, 7, 1, 7, 1, 7, 5, 7, 220, 8,
    7, 10, 7, 12, 7, 223, 9, 7, 1, 7, 1, 7, 1, 8, 3, 8, 228, 8, 8, 1, 8, 1, 8,
    3, 8, 232, 8, 8, 1, 8, 1, 8, 3, 8, 236, 8, 8, 1, 8, 1, 8, 3, 8, 240, 8, 8,
    1, 8, 1, 8, 3, 8, 244, 8, 8, 1, 8, 1, 8, 3, 8, 248, 8, 8, 1, 8, 3, 8, 251,
    8, 8, 1, 9, 1, 9, 1, 10, 1, 10, 1, 10, 1, 10, 1, 10, 1, 10, 5, 10, 261, 8,
    10, 10, 10, 12, 10, 264, 9, 10, 1, 10, 1, 10, 1, 11, 1, 11, 1, 11, 1, 11, 1,
    11, 1, 11, 1, 11, 3, 11, 275, 8, 11, 1, 12, 1, 12, 1, 13, 1, 13, 1, 13, 1,
    13, 5, 13, 283, 8, 13, 10, 13, 12, 13, 286, 9, 13, 1, 13, 1, 13, 1, 14, 1,
    14, 1, 14, 5, 14, 293, 8, 14, 10, 14, 12, 14, 296, 9, 14, 1, 14, 1, 14, 1,
    15, 1, 15, 1, 15, 1, 15, 1, 15, 1, 15, 5, 15, 306, 8, 15, 10, 15, 12, 15,
    309, 9, 15, 1, 15, 3, 15, 312, 8, 15, 1, 15, 1, 15, 1, 16, 1, 16, 1, 16, 3,
    16, 319, 8, 16, 1, 17, 1, 17, 1, 17, 1, 17, 1, 17, 1, 17, 5, 17, 327, 8, 17,
    10, 17, 12, 17, 330, 9, 17, 1, 17, 3, 17, 333, 8, 17, 1, 17, 1, 17, 1, 18,
    1, 18, 1, 19, 1, 19, 1, 19, 1, 19, 3, 19, 343, 8, 19, 1, 20, 1, 20, 1, 20,
    1, 20, 3, 20, 349, 8, 20, 1, 20, 1, 20, 1, 20, 1, 21, 1, 21, 1, 21, 5, 21,
    357, 8, 21, 10, 21, 12, 21, 360, 9, 21, 1, 22, 3, 22, 363, 8, 22, 1, 22, 1,
    22, 1, 22, 5, 22, 368, 8, 22, 10, 22, 12, 22, 371, 9, 22, 1, 23, 1, 23, 1,
    24, 1, 24, 1, 25, 1, 25, 1, 26, 1, 26, 1, 27, 1, 27, 3, 27, 383, 8, 27, 1,
    27, 1, 27, 1, 28, 3, 28, 388, 8, 28, 1, 28, 3, 28, 391, 8, 28, 1, 28, 3, 28,
    394, 8, 28, 1, 28, 3, 28, 397, 8, 28, 1, 28, 1, 28, 1, 28, 5, 28, 402, 8,
    28, 10, 28, 12, 28, 405, 9, 28, 1, 28, 1, 28, 3, 28, 409, 8, 28, 1, 28, 1,
    28, 1, 28, 1, 28, 1, 28, 1, 28, 1, 28, 1, 28, 1, 28, 3, 28, 420, 8, 28, 1,
    29, 1, 29, 1, 29, 5, 29, 425, 8, 29, 10, 29, 12, 29, 428, 9, 29, 1, 30, 1,
    30, 5, 30, 432, 8, 30, 10, 30, 12, 30, 435, 9, 30, 1, 30, 1, 30, 1, 31, 1,
    31, 1, 31, 1, 31, 1, 31, 1, 31, 1, 31, 1, 31, 1, 31, 1, 31, 1, 31, 3, 31,
    450, 8, 31, 1, 32, 1, 32, 1, 32, 1, 33, 1, 33, 1, 33, 1, 33, 1, 33, 1, 34,
    1, 34, 1, 35, 1, 35, 1, 35, 1, 35, 5, 35, 466, 8, 35, 10, 35, 12, 35, 469,
    9, 35, 1, 35, 1, 35, 1, 35, 1, 35, 5, 35, 475, 8, 35, 10, 35, 12, 35, 478,
    9, 35, 1, 35, 1, 35, 1, 35, 3, 35, 483, 8, 35, 1, 36, 1, 36, 1, 36, 1, 36,
    1, 36, 1, 36, 1, 36, 1, 36, 1, 36, 1, 36, 1, 36, 1, 36, 3, 36, 497, 8, 36,
    1, 37, 1, 37, 1, 37, 1, 38, 1, 38, 1, 38, 1, 38, 1, 38, 1, 38, 1, 38, 3, 38,
    509, 8, 38, 1, 39, 1, 39, 1, 39, 1, 39, 1, 39, 1, 39, 1, 40, 1, 40, 1, 40,
    1, 40, 1, 40, 1, 40, 1, 40, 1, 40, 1, 41, 1, 41, 1, 41, 3, 41, 528, 8, 41,
    1, 41, 1, 41, 3, 41, 532, 8, 41, 1, 41, 1, 41, 3, 41, 536, 8, 41, 1, 41, 1,
    41, 1, 41, 1, 42, 1, 42, 3, 42, 543, 8, 42, 1, 43, 3, 43, 546, 8, 43, 1, 43,
    3, 43, 549, 8, 43, 1, 43, 3, 43, 552, 8, 43, 1, 43, 1, 43, 1, 43, 5, 43,
    557, 8, 43, 10, 43, 12, 43, 560, 9, 43, 1, 43, 1, 43, 3, 43, 564, 8, 43, 1,
    44, 1, 44, 1, 44, 1, 44, 1, 45, 1, 45, 1, 45, 1, 45, 1, 46, 1, 46, 3, 46,
    576, 8, 46, 1, 46, 1, 46, 1, 47, 1, 47, 1, 47, 1, 47, 1, 47, 1, 47, 4, 47,
    586, 8, 47, 11, 47, 12, 47, 587, 1, 47, 3, 47, 591, 8, 47, 1, 47, 1, 47, 1,
    48, 1, 48, 1, 48, 1, 48, 5, 48, 599, 8, 48, 10, 48, 12, 48, 602, 9, 48, 1,
    48, 1, 48, 1, 49, 1, 49, 1, 49, 3, 49, 609, 8, 49, 1, 49, 1, 49, 3, 49, 613,
    8, 49, 1, 49, 1, 49, 1, 49, 3, 49, 618, 8, 49, 1, 50, 1, 50, 1, 50, 1, 50,
    3, 50, 624, 8, 50, 1, 50, 1, 50, 1, 51, 1, 51, 1, 52, 1, 52, 1, 52, 1, 52,
    1, 52, 1, 52, 1, 52, 1, 52, 1, 52, 3, 52, 639, 8, 52, 1, 53, 1, 53, 1, 53,
    5, 53, 644, 8, 53, 10, 53, 12, 53, 647, 9, 53, 1, 54, 1, 54, 1, 54, 5, 54,
    652, 8, 54, 10, 54, 12, 54, 655, 9, 54, 1, 55, 1, 55, 1, 55, 5, 55, 660, 8,
    55, 10, 55, 12, 55, 663, 9, 55, 1, 56, 1, 56, 1, 56, 5, 56, 668, 8, 56, 10,
    56, 12, 56, 671, 9, 56, 1, 57, 1, 57, 1, 57, 5, 57, 676, 8, 57, 10, 57, 12,
    57, 679, 9, 57, 1, 58, 1, 58, 1, 58, 5, 58, 684, 8, 58, 10, 58, 12, 58, 687,
    9, 58, 1, 59, 1, 59, 1, 59, 5, 59, 692, 8, 59, 10, 59, 12, 59, 695, 9, 59,
    1, 60, 1, 60, 1, 60, 5, 60, 700, 8, 60, 10, 60, 12, 60, 703, 9, 60, 1, 61,
    1, 61, 1, 61, 5, 61, 708, 8, 61, 10, 61, 12, 61, 711, 9, 61, 1, 62, 1, 62,
    1, 62, 5, 62, 716, 8, 62, 10, 62, 12, 62, 719, 9, 62, 1, 63, 1, 63, 1, 63,
    1, 63, 1, 63, 1, 63, 1, 63, 1, 63, 1, 63, 3, 63, 730, 8, 63, 1, 64, 1, 64,
    5, 64, 734, 8, 64, 10, 64, 12, 64, 737, 9, 64, 1, 65, 1, 65, 1, 65, 1, 65,
    1, 65, 1, 65, 1, 65, 1, 65, 1, 65, 1, 65, 1, 65, 1, 65, 1, 65, 1, 65, 3, 65,
    753, 8, 65, 1, 65, 3, 65, 756, 8, 65, 1, 66, 1, 66, 1, 66, 1, 66, 1, 66, 1,
    66, 1, 66, 1, 66, 1, 66, 1, 66, 1, 66, 1, 66, 3, 66, 770, 8, 66, 1, 67, 1,
    67, 1, 67, 1, 67, 3, 67, 776, 8, 67, 1, 67, 1, 67, 1, 68, 1, 68, 1, 68, 1,
    68, 1, 68, 1, 69, 1, 69, 1, 69, 3, 69, 788, 8, 69, 1, 69, 1, 69, 1, 69, 1,
    69, 1, 69, 3, 69, 795, 8, 69, 1, 70, 1, 70, 1, 70, 5, 70, 800, 8, 70, 10,
    70, 12, 70, 803, 9, 70, 1, 70, 3, 70, 806, 8, 70, 1, 71, 1, 71, 1, 71, 1,
    71, 1, 72, 1, 72, 1, 72, 1, 72, 5, 72, 816, 8, 72, 10, 72, 12, 72, 819, 9,
    72, 1, 72, 3, 72, 822, 8, 72, 1, 72, 1, 72, 1, 72, 1, 72, 1, 72, 1, 72, 1,
    72, 3, 72, 831, 8, 72, 1, 73, 1, 73, 1, 73, 3, 73, 836, 8, 73, 1, 74, 1, 74,
    1, 74, 4, 74, 841, 8, 74, 11, 74, 12, 74, 842, 1, 74, 1, 74, 1, 74, 1, 74,
    4, 74, 849, 8, 74, 11, 74, 12, 74, 850, 1, 74, 1, 74, 1, 74, 4, 74, 856, 8,
    74, 11, 74, 12, 74, 857, 1, 74, 1, 74, 1, 74, 1, 74, 1, 74, 1, 74, 1, 74, 1,
    74, 1, 74, 4, 74, 869, 8, 74, 11, 74, 12, 74, 870, 1, 74, 1, 74, 1, 74, 1,
    74, 1, 74, 4, 74, 878, 8, 74, 11, 74, 12, 74, 879, 1, 74, 1, 74, 4, 74, 884,
    8, 74, 11, 74, 12, 74, 885, 1, 74, 1, 74, 1, 74, 1, 74, 1, 74, 1, 74, 1, 74,
    4, 74, 895, 8, 74, 11, 74, 12, 74, 896, 3, 74, 899, 8, 74, 1, 75, 1, 75, 1,
    75, 1, 75, 1, 75, 1, 75, 1, 75, 1, 75, 1, 75, 1, 75, 1, 75, 1, 75, 3, 75,
    913, 8, 75, 1, 76, 1, 76, 1, 76, 5, 76, 918, 8, 76, 10, 76, 12, 76, 921, 9,
    76, 1, 77, 1, 77, 1, 77, 1, 77, 1, 77, 1, 77, 1, 77, 1, 77, 1, 77, 3, 77,
    932, 8, 77, 1, 78, 1, 78, 1, 78, 1, 78, 1, 79, 1, 79, 1, 79, 1, 79, 1, 80,
    1, 80, 1, 80, 4, 80, 945, 8, 80, 11, 80, 12, 80, 946, 1, 81, 1, 81, 1, 82,
    1, 82, 1, 83, 1, 83, 1, 83, 1, 83, 1, 83, 1, 84, 1, 84, 1, 84, 5, 84, 961,
    8, 84, 10, 84, 12, 84, 964, 9, 84, 1, 85, 1, 85, 1, 85, 1, 85, 3, 85, 970,
    8, 85, 1, 86, 1, 86, 1, 86, 1, 86, 1, 86, 3, 86, 977, 8, 86, 1, 87, 1, 87,
    1, 87, 1, 87, 1, 87, 1, 87, 1, 87, 1, 87, 1, 87, 1, 87, 3, 87, 989, 8, 87,
    1, 88, 1, 88, 1, 88, 0, 0, 89, 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22,
    24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50, 52, 54, 56, 58, 60,
    62, 64, 66, 68, 70, 72, 74, 76, 78, 80, 82, 84, 86, 88, 90, 92, 94, 96, 98,
    100, 102, 104, 106, 108, 110, 112, 114, 116, 118, 120, 122, 124, 126, 128,
    130, 132, 134, 136, 138, 140, 142, 144, 146, 148, 150, 152, 154, 156, 158,
    160, 162, 164, 166, 168, 170, 172, 174, 176, 0, 14, 1, 0, 3, 5, 1, 0, 6, 9,
    1, 0, 17, 18, 1, 0, 40, 44, 1, 0, 36, 39, 1, 0, 45, 46, 1, 0, 65, 75, 1, 0,
    76, 77, 1, 0, 78, 81, 1, 0, 94, 95, 1, 0, 82, 83, 1, 0, 84, 86, 1, 0, 53,
    64, 3, 0, 31, 33, 49, 52, 107, 112, 1057, 0, 182, 1, 0, 0, 0, 2, 193, 1, 0,
    0, 0, 4, 198, 1, 0, 0, 0, 6, 200, 1, 0, 0, 0, 8, 202, 1, 0, 0, 0, 10, 204,
    1, 0, 0, 0, 12, 213, 1, 0, 0, 0, 14, 215, 1, 0, 0, 0, 16, 250, 1, 0, 0, 0,
    18, 252, 1, 0, 0, 0, 20, 254, 1, 0, 0, 0, 22, 267, 1, 0, 0, 0, 24, 276, 1,
    0, 0, 0, 26, 278, 1, 0, 0, 0, 28, 289, 1, 0, 0, 0, 30, 299, 1, 0, 0, 0, 32,
    315, 1, 0, 0, 0, 34, 320, 1, 0, 0, 0, 36, 336, 1, 0, 0, 0, 38, 338, 1, 0, 0,
    0, 40, 344, 1, 0, 0, 0, 42, 353, 1, 0, 0, 0, 44, 362, 1, 0, 0, 0, 46, 372,
    1, 0, 0, 0, 48, 374, 1, 0, 0, 0, 50, 376, 1, 0, 0, 0, 52, 378, 1, 0, 0, 0,
    54, 380, 1, 0, 0, 0, 56, 419, 1, 0, 0, 0, 58, 421, 1, 0, 0, 0, 60, 429, 1,
    0, 0, 0, 62, 449, 1, 0, 0, 0, 64, 451, 1, 0, 0, 0, 66, 454, 1, 0, 0, 0, 68,
    459, 1, 0, 0, 0, 70, 482, 1, 0, 0, 0, 72, 496, 1, 0, 0, 0, 74, 498, 1, 0, 0,
    0, 76, 501, 1, 0, 0, 0, 78, 510, 1, 0, 0, 0, 80, 516, 1, 0, 0, 0, 82, 524,
    1, 0, 0, 0, 84, 542, 1, 0, 0, 0, 86, 545, 1, 0, 0, 0, 88, 565, 1, 0, 0, 0,
    90, 569, 1, 0, 0, 0, 92, 573, 1, 0, 0, 0, 94, 579, 1, 0, 0, 0, 96, 594, 1,
    0, 0, 0, 98, 617, 1, 0, 0, 0, 100, 619, 1, 0, 0, 0, 102, 627, 1, 0, 0, 0,
    104, 638, 1, 0, 0, 0, 106, 640, 1, 0, 0, 0, 108, 648, 1, 0, 0, 0, 110, 656,
    1, 0, 0, 0, 112, 664, 1, 0, 0, 0, 114, 672, 1, 0, 0, 0, 116, 680, 1, 0, 0,
    0, 118, 688, 1, 0, 0, 0, 120, 696, 1, 0, 0, 0, 122, 704, 1, 0, 0, 0, 124,
    712, 1, 0, 0, 0, 126, 729, 1, 0, 0, 0, 128, 731, 1, 0, 0, 0, 130, 755, 1, 0,
    0, 0, 132, 769, 1, 0, 0, 0, 134, 771, 1, 0, 0, 0, 136, 779, 1, 0, 0, 0, 138,
    794, 1, 0, 0, 0, 140, 796, 1, 0, 0, 0, 142, 807, 1, 0, 0, 0, 144, 830, 1, 0,
    0, 0, 146, 835, 1, 0, 0, 0, 148, 898, 1, 0, 0, 0, 150, 912, 1, 0, 0, 0, 152,
    914, 1, 0, 0, 0, 154, 931, 1, 0, 0, 0, 156, 933, 1, 0, 0, 0, 158, 937, 1, 0,
    0, 0, 160, 941, 1, 0, 0, 0, 162, 948, 1, 0, 0, 0, 164, 950, 1, 0, 0, 0, 166,
    952, 1, 0, 0, 0, 168, 957, 1, 0, 0, 0, 170, 969, 1, 0, 0, 0, 172, 976, 1, 0,
    0, 0, 174, 988, 1, 0, 0, 0, 176, 990, 1, 0, 0, 0, 178, 181, 3, 2, 1, 0, 179,
    181, 3, 4, 2, 0, 180, 178, 1, 0, 0, 0, 180, 179, 1, 0, 0, 0, 181, 184, 1, 0,
    0, 0, 182, 180, 1, 0, 0, 0, 182, 183, 1, 0, 0, 0, 183, 188, 1, 0, 0, 0, 184,
    182, 1, 0, 0, 0, 185, 187, 3, 12, 6, 0, 186, 185, 1, 0, 0, 0, 187, 190, 1,
    0, 0, 0, 188, 186, 1, 0, 0, 0, 188, 189, 1, 0, 0, 0, 189, 191, 1, 0, 0, 0,
    190, 188, 1, 0, 0, 0, 191, 192, 5, 0, 0, 1, 192, 1, 1, 0, 0, 0, 193, 194, 5,
    2, 0, 0, 194, 3, 1, 0, 0, 0, 195, 199, 3, 6, 3, 0, 196, 199, 3, 8, 4, 0,
    197, 199, 3, 10, 5, 0, 198, 195, 1, 0, 0, 0, 198, 196, 1, 0, 0, 0, 198, 197,
    1, 0, 0, 0, 199, 5, 1, 0, 0, 0, 200, 201, 7, 0, 0, 0, 201, 7, 1, 0, 0, 0,
    202, 203, 7, 1, 0, 0, 203, 9, 1, 0, 0, 0, 204, 205, 5, 10, 0, 0, 205, 11, 1,
    0, 0, 0, 206, 214, 3, 14, 7, 0, 207, 214, 3, 20, 10, 0, 208, 214, 3, 26, 13,
    0, 209, 214, 3, 30, 15, 0, 210, 214, 3, 34, 17, 0, 211, 214, 3, 40, 20, 0,
    212, 214, 3, 56, 28, 0, 213, 206, 1, 0, 0, 0, 213, 207, 1, 0, 0, 0, 213,
    208, 1, 0, 0, 0, 213, 209, 1, 0, 0, 0, 213, 210, 1, 0, 0, 0, 213, 211, 1, 0,
    0, 0, 213, 212, 1, 0, 0, 0, 214, 13, 1, 0, 0, 0, 215, 216, 5, 11, 0, 0, 216,
    217, 5, 113, 0, 0, 217, 221, 5, 98, 0, 0, 218, 220, 3, 16, 8, 0, 219, 218,
    1, 0, 0, 0, 220, 223, 1, 0, 0, 0, 221, 219, 1, 0, 0, 0, 221, 222, 1, 0, 0,
    0, 222, 224, 1, 0, 0, 0, 223, 221, 1, 0, 0, 0, 224, 225, 5, 99, 0, 0, 225,
    15, 1, 0, 0, 0, 226, 228, 3, 18, 9, 0, 227, 226, 1, 0, 0, 0, 227, 228, 1, 0,
    0, 0, 228, 229, 1, 0, 0, 0, 229, 251, 3, 56, 28, 0, 230, 232, 3, 18, 9, 0,
    231, 230, 1, 0, 0, 0, 231, 232, 1, 0, 0, 0, 232, 233, 1, 0, 0, 0, 233, 251,
    3, 40, 20, 0, 234, 236, 3, 18, 9, 0, 235, 234, 1, 0, 0, 0, 235, 236, 1, 0,
    0, 0, 236, 237, 1, 0, 0, 0, 237, 251, 3, 30, 15, 0, 238, 240, 3, 18, 9, 0,
    239, 238, 1, 0, 0, 0, 239, 240, 1, 0, 0, 0, 240, 241, 1, 0, 0, 0, 241, 251,
    3, 34, 17, 0, 242, 244, 3, 18, 9, 0, 243, 242, 1, 0, 0, 0, 243, 244, 1, 0,
    0, 0, 244, 245, 1, 0, 0, 0, 245, 251, 3, 20, 10, 0, 246, 248, 3, 18, 9, 0,
    247, 246, 1, 0, 0, 0, 247, 248, 1, 0, 0, 0, 248, 249, 1, 0, 0, 0, 249, 251,
    3, 26, 13, 0, 250, 227, 1, 0, 0, 0, 250, 231, 1, 0, 0, 0, 250, 235, 1, 0, 0,
    0, 250, 239, 1, 0, 0, 0, 250, 243, 1, 0, 0, 0, 250, 247, 1, 0, 0, 0, 251,
    17, 1, 0, 0, 0, 252, 253, 7, 2, 0, 0, 253, 19, 1, 0, 0, 0, 254, 255, 5, 16,
    0, 0, 255, 256, 5, 113, 0, 0, 256, 257, 5, 105, 0, 0, 257, 258, 3, 102, 51,
    0, 258, 262, 5, 98, 0, 0, 259, 261, 3, 22, 11, 0, 260, 259, 1, 0, 0, 0, 261,
    264, 1, 0, 0, 0, 262, 260, 1, 0, 0, 0, 262, 263, 1, 0, 0, 0, 263, 265, 1, 0,
    0, 0, 264, 262, 1, 0, 0, 0, 265, 266, 5, 99, 0, 0, 266, 21, 1, 0, 0, 0, 267,
    268, 5, 113, 0, 0, 268, 269, 5, 106, 0, 0, 269, 270, 3, 154, 77, 0, 270,
    271, 3, 24, 12, 0, 271, 272, 5, 105, 0, 0, 272, 274, 3, 102, 51, 0, 273,
    275, 5, 103, 0, 0, 274, 273, 1, 0, 0, 0, 274, 275, 1, 0, 0, 0, 275, 23, 1,
    0, 0, 0, 276, 277, 7, 3, 0, 0, 277, 25, 1, 0, 0, 0, 278, 279, 5, 12, 0, 0,
    279, 280, 5, 113, 0, 0, 280, 284, 5, 98, 0, 0, 281, 283, 3, 28, 14, 0, 282,
    281, 1, 0, 0, 0, 283, 286, 1, 0, 0, 0, 284, 282, 1, 0, 0, 0, 284, 285, 1, 0,
    0, 0, 285, 287, 1, 0, 0, 0, 286, 284, 1, 0, 0, 0, 287, 288, 5, 99, 0, 0,
    288, 27, 1, 0, 0, 0, 289, 290, 3, 154, 77, 0, 290, 294, 5, 113, 0, 0, 291,
    293, 3, 54, 27, 0, 292, 291, 1, 0, 0, 0, 293, 296, 1, 0, 0, 0, 294, 292, 1,
    0, 0, 0, 294, 295, 1, 0, 0, 0, 295, 297, 1, 0, 0, 0, 296, 294, 1, 0, 0, 0,
    297, 298, 5, 102, 0, 0, 298, 29, 1, 0, 0, 0, 299, 300, 5, 13, 0, 0, 300,
    301, 5, 113, 0, 0, 301, 302, 5, 98, 0, 0, 302, 307, 3, 32, 16, 0, 303, 304,
    5, 103, 0, 0, 304, 306, 3, 32, 16, 0, 305, 303, 1, 0, 0, 0, 306, 309, 1, 0,
    0, 0, 307, 305, 1, 0, 0, 0, 307, 308, 1, 0, 0, 0, 308, 311, 1, 0, 0, 0, 309,
    307, 1, 0, 0, 0, 310, 312, 5, 103, 0, 0, 311, 310, 1, 0, 0, 0, 311, 312, 1,
    0, 0, 0, 312, 313, 1, 0, 0, 0, 313, 314, 5, 99, 0, 0, 314, 31, 1, 0, 0, 0,
    315, 318, 5, 113, 0, 0, 316, 317, 5, 75, 0, 0, 317, 319, 3, 102, 51, 0, 318,
    316, 1, 0, 0, 0, 318, 319, 1, 0, 0, 0, 319, 33, 1, 0, 0, 0, 320, 321, 3, 36,
    18, 0, 321, 322, 5, 113, 0, 0, 322, 323, 5, 98, 0, 0, 323, 328, 3, 38, 19,
    0, 324, 325, 5, 103, 0, 0, 325, 327, 3, 38, 19, 0, 326, 324, 1, 0, 0, 0,
    327, 330, 1, 0, 0, 0, 328, 326, 1, 0, 0, 0, 328, 329, 1, 0, 0, 0, 329, 332,
    1, 0, 0, 0, 330, 328, 1, 0, 0, 0, 331, 333, 5, 103, 0, 0, 332, 331, 1, 0, 0,
    0, 332, 333, 1, 0, 0, 0, 333, 334, 1, 0, 0, 0, 334, 335, 5, 99, 0, 0, 335,
    35, 1, 0, 0, 0, 336, 337, 7, 4, 0, 0, 337, 37, 1, 0, 0, 0, 338, 342, 5, 113,
    0, 0, 339, 340, 5, 100, 0, 0, 340, 341, 5, 110, 0, 0, 341, 343, 5, 101, 0,
    0, 342, 339, 1, 0, 0, 0, 342, 343, 1, 0, 0, 0, 343, 39, 1, 0, 0, 0, 344,
    345, 3, 154, 77, 0, 345, 346, 5, 113, 0, 0, 346, 348, 5, 96, 0, 0, 347, 349,
    3, 42, 21, 0, 348, 347, 1, 0, 0, 0, 348, 349, 1, 0, 0, 0, 349, 350, 1, 0, 0,
    0, 350, 351, 5, 97, 0, 0, 351, 352, 3, 60, 30, 0, 352, 41, 1, 0, 0, 0, 353,
    358, 3, 44, 22, 0, 354, 355, 5, 103, 0, 0, 355, 357, 3, 44, 22, 0, 356, 354,
    1, 0, 0, 0, 357, 360, 1, 0, 0, 0, 358, 356, 1, 0, 0, 0, 358, 359, 1, 0, 0,
    0, 359, 43, 1, 0, 0, 0, 360, 358, 1, 0, 0, 0, 361, 363, 3, 46, 23, 0, 362,
    361, 1, 0, 0, 0, 362, 363, 1, 0, 0, 0, 363, 364, 1, 0, 0, 0, 364, 365, 3,
    154, 77, 0, 365, 369, 5, 113, 0, 0, 366, 368, 3, 54, 27, 0, 367, 366, 1, 0,
    0, 0, 368, 371, 1, 0, 0, 0, 369, 367, 1, 0, 0, 0, 369, 370, 1, 0, 0, 0, 370,
    45, 1, 0, 0, 0, 371, 369, 1, 0, 0, 0, 372, 373, 5, 19, 0, 0, 373, 47, 1, 0,
    0, 0, 374, 375, 5, 20, 0, 0, 375, 49, 1, 0, 0, 0, 376, 377, 7, 5, 0, 0, 377,
    51, 1, 0, 0, 0, 378, 379, 5, 47, 0, 0, 379, 53, 1, 0, 0, 0, 380, 382, 5,
    100, 0, 0, 381, 383, 3, 102, 51, 0, 382, 381, 1, 0, 0, 0, 382, 383, 1, 0, 0,
    0, 383, 384, 1, 0, 0, 0, 384, 385, 5, 101, 0, 0, 385, 55, 1, 0, 0, 0, 386,
    388, 3, 52, 26, 0, 387, 386, 1, 0, 0, 0, 387, 388, 1, 0, 0, 0, 388, 390, 1,
    0, 0, 0, 389, 391, 3, 48, 24, 0, 390, 389, 1, 0, 0, 0, 390, 391, 1, 0, 0, 0,
    391, 393, 1, 0, 0, 0, 392, 394, 3, 46, 23, 0, 393, 392, 1, 0, 0, 0, 393,
    394, 1, 0, 0, 0, 394, 396, 1, 0, 0, 0, 395, 397, 3, 50, 25, 0, 396, 395, 1,
    0, 0, 0, 396, 397, 1, 0, 0, 0, 397, 398, 1, 0, 0, 0, 398, 399, 3, 154, 77,
    0, 399, 403, 5, 113, 0, 0, 400, 402, 3, 54, 27, 0, 401, 400, 1, 0, 0, 0,
    402, 405, 1, 0, 0, 0, 403, 401, 1, 0, 0, 0, 403, 404, 1, 0, 0, 0, 404, 408,
    1, 0, 0, 0, 405, 403, 1, 0, 0, 0, 406, 407, 5, 75, 0, 0, 407, 409, 3, 102,
    51, 0, 408, 406, 1, 0, 0, 0, 408, 409, 1, 0, 0, 0, 409, 410, 1, 0, 0, 0,
    410, 411, 5, 102, 0, 0, 411, 420, 1, 0, 0, 0, 412, 413, 3, 154, 77, 0, 413,
    414, 5, 113, 0, 0, 414, 415, 5, 96, 0, 0, 415, 416, 3, 58, 29, 0, 416, 417,
    5, 97, 0, 0, 417, 418, 5, 102, 0, 0, 418, 420, 1, 0, 0, 0, 419, 387, 1, 0,
    0, 0, 419, 412, 1, 0, 0, 0, 420, 57, 1, 0, 0, 0, 421, 426, 5, 113, 0, 0,
    422, 423, 5, 103, 0, 0, 423, 425, 5, 113, 0, 0, 424, 422, 1, 0, 0, 0, 425,
    428, 1, 0, 0, 0, 426, 424, 1, 0, 0, 0, 426, 427, 1, 0, 0, 0, 427, 59, 1, 0,
    0, 0, 428, 426, 1, 0, 0, 0, 429, 433, 5, 98, 0, 0, 430, 432, 3, 62, 31, 0,
    431, 430, 1, 0, 0, 0, 432, 435, 1, 0, 0, 0, 433, 431, 1, 0, 0, 0, 433, 434,
    1, 0, 0, 0, 434, 436, 1, 0, 0, 0, 435, 433, 1, 0, 0, 0, 436, 437, 5, 99, 0,
    0, 437, 61, 1, 0, 0, 0, 438, 450, 3, 56, 28, 0, 439, 450, 3, 66, 33, 0, 440,
    450, 3, 74, 37, 0, 441, 450, 3, 76, 38, 0, 442, 450, 3, 78, 39, 0, 443, 450,
    3, 80, 40, 0, 444, 450, 3, 82, 41, 0, 445, 450, 3, 94, 47, 0, 446, 450, 3,
    92, 46, 0, 447, 450, 3, 64, 32, 0, 448, 450, 3, 60, 30, 0, 449, 438, 1, 0,
    0, 0, 449, 439, 1, 0, 0, 0, 449, 440, 1, 0, 0, 0, 449, 441, 1, 0, 0, 0, 449,
    442, 1, 0, 0, 0, 449, 443, 1, 0, 0, 0, 449, 444, 1, 0, 0, 0, 449, 445, 1, 0,
    0, 0, 449, 446, 1, 0, 0, 0, 449, 447, 1, 0, 0, 0, 449, 448, 1, 0, 0, 0, 450,
    63, 1, 0, 0, 0, 451, 452, 5, 48, 0, 0, 452, 453, 3, 60, 30, 0, 453, 65, 1,
    0, 0, 0, 454, 455, 3, 70, 35, 0, 455, 456, 3, 68, 34, 0, 456, 457, 3, 102,
    51, 0, 457, 458, 5, 102, 0, 0, 458, 67, 1, 0, 0, 0, 459, 460, 7, 6, 0, 0,
    460, 69, 1, 0, 0, 0, 461, 462, 5, 15, 0, 0, 462, 463, 5, 104, 0, 0, 463,
    467, 5, 113, 0, 0, 464, 466, 3, 72, 36, 0, 465, 464, 1, 0, 0, 0, 466, 469,
    1, 0, 0, 0, 467, 465, 1, 0, 0, 0, 467, 468, 1, 0, 0, 0, 468, 483, 1, 0, 0,
    0, 469, 467, 1, 0, 0, 0, 470, 471, 5, 14, 0, 0, 471, 472, 5, 104, 0, 0, 472,
    476, 5, 113, 0, 0, 473, 475, 3, 72, 36, 0, 474, 473, 1, 0, 0, 0, 475, 478,
    1, 0, 0, 0, 476, 474, 1, 0, 0, 0, 476, 477, 1, 0, 0, 0, 477, 483, 1, 0, 0,
    0, 478, 476, 1, 0, 0, 0, 479, 483, 3, 150, 75, 0, 480, 483, 3, 148, 74, 0,
    481, 483, 5, 113, 0, 0, 482, 461, 1, 0, 0, 0, 482, 470, 1, 0, 0, 0, 482,
    479, 1, 0, 0, 0, 482, 480, 1, 0, 0, 0, 482, 481, 1, 0, 0, 0, 483, 71, 1, 0,
    0, 0, 484, 485, 5, 104, 0, 0, 485, 497, 5, 113, 0, 0, 486, 487, 5, 100, 0,
    0, 487, 488, 3, 102, 51, 0, 488, 489, 5, 101, 0, 0, 489, 497, 1, 0, 0, 0,
    490, 491, 5, 100, 0, 0, 491, 492, 3, 102, 51, 0, 492, 493, 5, 103, 0, 0,
    493, 494, 3, 102, 51, 0, 494, 495, 5, 101, 0, 0, 495, 497, 1, 0, 0, 0, 496,
    484, 1, 0, 0, 0, 496, 486, 1, 0, 0, 0, 496, 490, 1, 0, 0, 0, 497, 73, 1, 0,
    0, 0, 498, 499, 3, 102, 51, 0, 499, 500, 5, 102, 0, 0, 500, 75, 1, 0, 0, 0,
    501, 502, 5, 22, 0, 0, 502, 503, 5, 96, 0, 0, 503, 504, 3, 102, 51, 0, 504,
    505, 5, 97, 0, 0, 505, 508, 3, 62, 31, 0, 506, 507, 5, 23, 0, 0, 507, 509,
    3, 62, 31, 0, 508, 506, 1, 0, 0, 0, 508, 509, 1, 0, 0, 0, 509, 77, 1, 0, 0,
    0, 510, 511, 5, 24, 0, 0, 511, 512, 5, 96, 0, 0, 512, 513, 3, 102, 51, 0,
    513, 514, 5, 97, 0, 0, 514, 515, 3, 62, 31, 0, 515, 79, 1, 0, 0, 0, 516,
    517, 5, 25, 0, 0, 517, 518, 3, 60, 30, 0, 518, 519, 5, 24, 0, 0, 519, 520,
    5, 96, 0, 0, 520, 521, 3, 102, 51, 0, 521, 522, 5, 97, 0, 0, 522, 523, 5,
    102, 0, 0, 523, 81, 1, 0, 0, 0, 524, 525, 5, 26, 0, 0, 525, 527, 5, 96, 0,
    0, 526, 528, 3, 84, 42, 0, 527, 526, 1, 0, 0, 0, 527, 528, 1, 0, 0, 0, 528,
    529, 1, 0, 0, 0, 529, 531, 5, 102, 0, 0, 530, 532, 3, 102, 51, 0, 531, 530,
    1, 0, 0, 0, 531, 532, 1, 0, 0, 0, 532, 533, 1, 0, 0, 0, 533, 535, 5, 102, 0,
    0, 534, 536, 3, 90, 45, 0, 535, 534, 1, 0, 0, 0, 535, 536, 1, 0, 0, 0, 536,
    537, 1, 0, 0, 0, 537, 538, 5, 97, 0, 0, 538, 539, 3, 62, 31, 0, 539, 83, 1,
    0, 0, 0, 540, 543, 3, 86, 43, 0, 541, 543, 3, 88, 44, 0, 542, 540, 1, 0, 0,
    0, 542, 541, 1, 0, 0, 0, 543, 85, 1, 0, 0, 0, 544, 546, 3, 52, 26, 0, 545,
    544, 1, 0, 0, 0, 545, 546, 1, 0, 0, 0, 546, 548, 1, 0, 0, 0, 547, 549, 3,
    48, 24, 0, 548, 547, 1, 0, 0, 0, 548, 549, 1, 0, 0, 0, 549, 551, 1, 0, 0, 0,
    550, 552, 3, 50, 25, 0, 551, 550, 1, 0, 0, 0, 551, 552, 1, 0, 0, 0, 552,
    553, 1, 0, 0, 0, 553, 554, 3, 154, 77, 0, 554, 558, 5, 113, 0, 0, 555, 557,
    3, 54, 27, 0, 556, 555, 1, 0, 0, 0, 557, 560, 1, 0, 0, 0, 558, 556, 1, 0, 0,
    0, 558, 559, 1, 0, 0, 0, 559, 563, 1, 0, 0, 0, 560, 558, 1, 0, 0, 0, 561,
    562, 5, 75, 0, 0, 562, 564, 3, 102, 51, 0, 563, 561, 1, 0, 0, 0, 563, 564,
    1, 0, 0, 0, 564, 87, 1, 0, 0, 0, 565, 566, 3, 70, 35, 0, 566, 567, 3, 68,
    34, 0, 567, 568, 3, 102, 51, 0, 568, 89, 1, 0, 0, 0, 569, 570, 3, 70, 35, 0,
    570, 571, 3, 68, 34, 0, 571, 572, 3, 102, 51, 0, 572, 91, 1, 0, 0, 0, 573,
    575, 5, 30, 0, 0, 574, 576, 3, 102, 51, 0, 575, 574, 1, 0, 0, 0, 575, 576,
    1, 0, 0, 0, 576, 577, 1, 0, 0, 0, 577, 578, 5, 102, 0, 0, 578, 93, 1, 0, 0,
    0, 579, 580, 5, 27, 0, 0, 580, 581, 5, 96, 0, 0, 581, 582, 3, 102, 51, 0,
    582, 583, 5, 97, 0, 0, 583, 585, 5, 98, 0, 0, 584, 586, 3, 96, 48, 0, 585,
    584, 1, 0, 0, 0, 586, 587, 1, 0, 0, 0, 587, 585, 1, 0, 0, 0, 587, 588, 1, 0,
    0, 0, 588, 590, 1, 0, 0, 0, 589, 591, 3, 100, 50, 0, 590, 589, 1, 0, 0, 0,
    590, 591, 1, 0, 0, 0, 591, 592, 1, 0, 0, 0, 592, 593, 5, 99, 0, 0, 593, 95,
    1, 0, 0, 0, 594, 595, 5, 28, 0, 0, 595, 600, 3, 98, 49, 0, 596, 597, 5, 88,
    0, 0, 597, 599, 3, 98, 49, 0, 598, 596, 1, 0, 0, 0, 599, 602, 1, 0, 0, 0,
    600, 598, 1, 0, 0, 0, 600, 601, 1, 0, 0, 0, 601, 603, 1, 0, 0, 0, 602, 600,
    1, 0, 0, 0, 603, 604, 3, 60, 30, 0, 604, 97, 1, 0, 0, 0, 605, 618, 3, 160,
    80, 0, 606, 618, 5, 113, 0, 0, 607, 609, 5, 83, 0, 0, 608, 607, 1, 0, 0, 0,
    608, 609, 1, 0, 0, 0, 609, 610, 1, 0, 0, 0, 610, 618, 5, 110, 0, 0, 611,
    613, 5, 83, 0, 0, 612, 611, 1, 0, 0, 0, 612, 613, 1, 0, 0, 0, 613, 614, 1,
    0, 0, 0, 614, 618, 5, 107, 0, 0, 615, 618, 5, 108, 0, 0, 616, 618, 5, 112,
    0, 0, 617, 605, 1, 0, 0, 0, 617, 606, 1, 0, 0, 0, 617, 608, 1, 0, 0, 0, 617,
    612, 1, 0, 0, 0, 617, 615, 1, 0, 0, 0, 617, 616, 1, 0, 0, 0, 618, 99, 1, 0,
    0, 0, 619, 623, 5, 29, 0, 0, 620, 621, 5, 96, 0, 0, 621, 622, 5, 110, 0, 0,
    622, 624, 5, 97, 0, 0, 623, 620, 1, 0, 0, 0, 623, 624, 1, 0, 0, 0, 624, 625,
    1, 0, 0, 0, 625, 626, 3, 60, 30, 0, 626, 101, 1, 0, 0, 0, 627, 628, 3, 104,
    52, 0, 628, 103, 1, 0, 0, 0, 629, 630, 5, 96, 0, 0, 630, 631, 3, 106, 53, 0,
    631, 632, 5, 97, 0, 0, 632, 633, 5, 1, 0, 0, 633, 634, 3, 106, 53, 0, 634,
    635, 5, 106, 0, 0, 635, 636, 3, 106, 53, 0, 636, 639, 1, 0, 0, 0, 637, 639,
    3, 106, 53, 0, 638, 629, 1, 0, 0, 0, 638, 637, 1, 0, 0, 0, 639, 105, 1, 0,
    0, 0, 640, 645, 3, 108, 54, 0, 641, 642, 5, 88, 0, 0, 642, 644, 3, 108, 54,
    0, 643, 641, 1, 0, 0, 0, 644, 647, 1, 0, 0, 0, 645, 643, 1, 0, 0, 0, 645,
    646, 1, 0, 0, 0, 646, 107, 1, 0, 0, 0, 647, 645, 1, 0, 0, 0, 648, 653, 3,
    110, 55, 0, 649, 650, 5, 87, 0, 0, 650, 652, 3, 110, 55, 0, 651, 649, 1, 0,
    0, 0, 652, 655, 1, 0, 0, 0, 653, 651, 1, 0, 0, 0, 653, 654, 1, 0, 0, 0, 654,
    109, 1, 0, 0, 0, 655, 653, 1, 0, 0, 0, 656, 661, 3, 112, 56, 0, 657, 658, 7,
    7, 0, 0, 658, 660, 3, 112, 56, 0, 659, 657, 1, 0, 0, 0, 660, 663, 1, 0, 0,
    0, 661, 659, 1, 0, 0, 0, 661, 662, 1, 0, 0, 0, 662, 111, 1, 0, 0, 0, 663,
    661, 1, 0, 0, 0, 664, 669, 3, 114, 57, 0, 665, 666, 7, 8, 0, 0, 666, 668, 3,
    114, 57, 0, 667, 665, 1, 0, 0, 0, 668, 671, 1, 0, 0, 0, 669, 667, 1, 0, 0,
    0, 669, 670, 1, 0, 0, 0, 670, 113, 1, 0, 0, 0, 671, 669, 1, 0, 0, 0, 672,
    677, 3, 116, 58, 0, 673, 674, 5, 91, 0, 0, 674, 676, 3, 116, 58, 0, 675,
    673, 1, 0, 0, 0, 676, 679, 1, 0, 0, 0, 677, 675, 1, 0, 0, 0, 677, 678, 1, 0,
    0, 0, 678, 115, 1, 0, 0, 0, 679, 677, 1, 0, 0, 0, 680, 685, 3, 118, 59, 0,
    681, 682, 5, 92, 0, 0, 682, 684, 3, 118, 59, 0, 683, 681, 1, 0, 0, 0, 684,
    687, 1, 0, 0, 0, 685, 683, 1, 0, 0, 0, 685, 686, 1, 0, 0, 0, 686, 117, 1, 0,
    0, 0, 687, 685, 1, 0, 0, 0, 688, 693, 3, 120, 60, 0, 689, 690, 5, 90, 0, 0,
    690, 692, 3, 120, 60, 0, 691, 689, 1, 0, 0, 0, 692, 695, 1, 0, 0, 0, 693,
    691, 1, 0, 0, 0, 693, 694, 1, 0, 0, 0, 694, 119, 1, 0, 0, 0, 695, 693, 1, 0,
    0, 0, 696, 701, 3, 122, 61, 0, 697, 698, 7, 9, 0, 0, 698, 700, 3, 122, 61,
    0, 699, 697, 1, 0, 0, 0, 700, 703, 1, 0, 0, 0, 701, 699, 1, 0, 0, 0, 701,
    702, 1, 0, 0, 0, 702, 121, 1, 0, 0, 0, 703, 701, 1, 0, 0, 0, 704, 709, 3,
    124, 62, 0, 705, 706, 7, 10, 0, 0, 706, 708, 3, 124, 62, 0, 707, 705, 1, 0,
    0, 0, 708, 711, 1, 0, 0, 0, 709, 707, 1, 0, 0, 0, 709, 710, 1, 0, 0, 0, 710,
    123, 1, 0, 0, 0, 711, 709, 1, 0, 0, 0, 712, 717, 3, 126, 63, 0, 713, 714, 7,
    11, 0, 0, 714, 716, 3, 126, 63, 0, 715, 713, 1, 0, 0, 0, 716, 719, 1, 0, 0,
    0, 717, 715, 1, 0, 0, 0, 717, 718, 1, 0, 0, 0, 718, 125, 1, 0, 0, 0, 719,
    717, 1, 0, 0, 0, 720, 721, 5, 89, 0, 0, 721, 730, 3, 126, 63, 0, 722, 723,
    5, 83, 0, 0, 723, 730, 3, 126, 63, 0, 724, 725, 5, 93, 0, 0, 725, 730, 3,
    126, 63, 0, 726, 727, 5, 90, 0, 0, 727, 730, 3, 126, 63, 0, 728, 730, 3,
    128, 64, 0, 729, 720, 1, 0, 0, 0, 729, 722, 1, 0, 0, 0, 729, 724, 1, 0, 0,
    0, 729, 726, 1, 0, 0, 0, 729, 728, 1, 0, 0, 0, 730, 127, 1, 0, 0, 0, 731,
    735, 3, 132, 66, 0, 732, 734, 3, 130, 65, 0, 733, 732, 1, 0, 0, 0, 734, 737,
    1, 0, 0, 0, 735, 733, 1, 0, 0, 0, 735, 736, 1, 0, 0, 0, 736, 129, 1, 0, 0,
    0, 737, 735, 1, 0, 0, 0, 738, 739, 5, 104, 0, 0, 739, 756, 5, 113, 0, 0,
    740, 741, 5, 100, 0, 0, 741, 742, 3, 102, 51, 0, 742, 743, 5, 101, 0, 0,
    743, 756, 1, 0, 0, 0, 744, 745, 5, 100, 0, 0, 745, 746, 3, 102, 51, 0, 746,
    747, 5, 103, 0, 0, 747, 748, 3, 102, 51, 0, 748, 749, 5, 101, 0, 0, 749,
    756, 1, 0, 0, 0, 750, 752, 5, 96, 0, 0, 751, 753, 3, 152, 76, 0, 752, 751,
    1, 0, 0, 0, 752, 753, 1, 0, 0, 0, 753, 754, 1, 0, 0, 0, 754, 756, 5, 97, 0,
    0, 755, 738, 1, 0, 0, 0, 755, 740, 1, 0, 0, 0, 755, 744, 1, 0, 0, 0, 755,
    750, 1, 0, 0, 0, 756, 131, 1, 0, 0, 0, 757, 770, 3, 134, 67, 0, 758, 770, 3,
    136, 68, 0, 759, 770, 3, 138, 69, 0, 760, 770, 3, 144, 72, 0, 761, 770, 5,
    14, 0, 0, 762, 770, 5, 15, 0, 0, 763, 770, 5, 113, 0, 0, 764, 770, 3, 176,
    88, 0, 765, 766, 5, 96, 0, 0, 766, 767, 3, 102, 51, 0, 767, 768, 5, 97, 0,
    0, 768, 770, 1, 0, 0, 0, 769, 757, 1, 0, 0, 0, 769, 758, 1, 0, 0, 0, 769,
    759, 1, 0, 0, 0, 769, 760, 1, 0, 0, 0, 769, 761, 1, 0, 0, 0, 769, 762, 1, 0,
    0, 0, 769, 763, 1, 0, 0, 0, 769, 764, 1, 0, 0, 0, 769, 765, 1, 0, 0, 0, 770,
    133, 1, 0, 0, 0, 771, 772, 5, 35, 0, 0, 772, 775, 5, 96, 0, 0, 773, 776, 3,
    154, 77, 0, 774, 776, 3, 102, 51, 0, 775, 773, 1, 0, 0, 0, 775, 774, 1, 0,
    0, 0, 776, 777, 1, 0, 0, 0, 777, 778, 5, 97, 0, 0, 778, 135, 1, 0, 0, 0,
    779, 780, 5, 96, 0, 0, 780, 781, 3, 154, 77, 0, 781, 782, 5, 97, 0, 0, 782,
    783, 3, 126, 63, 0, 783, 137, 1, 0, 0, 0, 784, 785, 5, 113, 0, 0, 785, 787,
    5, 98, 0, 0, 786, 788, 3, 140, 70, 0, 787, 786, 1, 0, 0, 0, 787, 788, 1, 0,
    0, 0, 788, 789, 1, 0, 0, 0, 789, 795, 5, 99, 0, 0, 790, 791, 5, 98, 0, 0,
    791, 792, 3, 140, 70, 0, 792, 793, 5, 99, 0, 0, 793, 795, 1, 0, 0, 0, 794,
    784, 1, 0, 0, 0, 794, 790, 1, 0, 0, 0, 795, 139, 1, 0, 0, 0, 796, 801, 3,
    142, 71, 0, 797, 798, 5, 103, 0, 0, 798, 800, 3, 142, 71, 0, 799, 797, 1, 0,
    0, 0, 800, 803, 1, 0, 0, 0, 801, 799, 1, 0, 0, 0, 801, 802, 1, 0, 0, 0, 802,
    805, 1, 0, 0, 0, 803, 801, 1, 0, 0, 0, 804, 806, 5, 103, 0, 0, 805, 804, 1,
    0, 0, 0, 805, 806, 1, 0, 0, 0, 806, 141, 1, 0, 0, 0, 807, 808, 5, 113, 0, 0,
    808, 809, 5, 106, 0, 0, 809, 810, 3, 102, 51, 0, 810, 143, 1, 0, 0, 0, 811,
    812, 5, 100, 0, 0, 812, 817, 3, 146, 73, 0, 813, 814, 5, 103, 0, 0, 814,
    816, 3, 146, 73, 0, 815, 813, 1, 0, 0, 0, 816, 819, 1, 0, 0, 0, 817, 815, 1,
    0, 0, 0, 817, 818, 1, 0, 0, 0, 818, 821, 1, 0, 0, 0, 819, 817, 1, 0, 0, 0,
    820, 822, 5, 103, 0, 0, 821, 820, 1, 0, 0, 0, 821, 822, 1, 0, 0, 0, 822,
    823, 1, 0, 0, 0, 823, 824, 5, 101, 0, 0, 824, 831, 1, 0, 0, 0, 825, 826, 5,
    100, 0, 0, 826, 827, 3, 102, 51, 0, 827, 828, 5, 84, 0, 0, 828, 829, 5, 101,
    0, 0, 829, 831, 1, 0, 0, 0, 830, 811, 1, 0, 0, 0, 830, 825, 1, 0, 0, 0, 831,
    145, 1, 0, 0, 0, 832, 836, 3, 102, 51, 0, 833, 836, 3, 138, 69, 0, 834, 836,
    3, 144, 72, 0, 835, 832, 1, 0, 0, 0, 835, 833, 1, 0, 0, 0, 835, 834, 1, 0,
    0, 0, 836, 147, 1, 0, 0, 0, 837, 840, 5, 113, 0, 0, 838, 839, 5, 104, 0, 0,
    839, 841, 5, 113, 0, 0, 840, 838, 1, 0, 0, 0, 841, 842, 1, 0, 0, 0, 842,
    840, 1, 0, 0, 0, 842, 843, 1, 0, 0, 0, 843, 848, 1, 0, 0, 0, 844, 845, 5,
    100, 0, 0, 845, 846, 3, 102, 51, 0, 846, 847, 5, 101, 0, 0, 847, 849, 1, 0,
    0, 0, 848, 844, 1, 0, 0, 0, 849, 850, 1, 0, 0, 0, 850, 848, 1, 0, 0, 0, 850,
    851, 1, 0, 0, 0, 851, 899, 1, 0, 0, 0, 852, 855, 5, 113, 0, 0, 853, 854, 5,
    104, 0, 0, 854, 856, 5, 113, 0, 0, 855, 853, 1, 0, 0, 0, 856, 857, 1, 0, 0,
    0, 857, 855, 1, 0, 0, 0, 857, 858, 1, 0, 0, 0, 858, 859, 1, 0, 0, 0, 859,
    860, 5, 100, 0, 0, 860, 861, 3, 102, 51, 0, 861, 862, 5, 103, 0, 0, 862,
    863, 3, 102, 51, 0, 863, 864, 5, 101, 0, 0, 864, 899, 1, 0, 0, 0, 865, 868,
    5, 113, 0, 0, 866, 867, 5, 104, 0, 0, 867, 869, 5, 113, 0, 0, 868, 866, 1,
    0, 0, 0, 869, 870, 1, 0, 0, 0, 870, 868, 1, 0, 0, 0, 870, 871, 1, 0, 0, 0,
    871, 899, 1, 0, 0, 0, 872, 877, 5, 113, 0, 0, 873, 874, 5, 100, 0, 0, 874,
    875, 3, 102, 51, 0, 875, 876, 5, 101, 0, 0, 876, 878, 1, 0, 0, 0, 877, 873,
    1, 0, 0, 0, 878, 879, 1, 0, 0, 0, 879, 877, 1, 0, 0, 0, 879, 880, 1, 0, 0,
    0, 880, 883, 1, 0, 0, 0, 881, 882, 5, 104, 0, 0, 882, 884, 5, 113, 0, 0,
    883, 881, 1, 0, 0, 0, 884, 885, 1, 0, 0, 0, 885, 883, 1, 0, 0, 0, 885, 886,
    1, 0, 0, 0, 886, 899, 1, 0, 0, 0, 887, 894, 5, 113, 0, 0, 888, 889, 5, 100,
    0, 0, 889, 890, 3, 102, 51, 0, 890, 891, 5, 101, 0, 0, 891, 895, 1, 0, 0, 0,
    892, 893, 5, 104, 0, 0, 893, 895, 5, 113, 0, 0, 894, 888, 1, 0, 0, 0, 894,
    892, 1, 0, 0, 0, 895, 896, 1, 0, 0, 0, 896, 894, 1, 0, 0, 0, 896, 897, 1, 0,
    0, 0, 897, 899, 1, 0, 0, 0, 898, 837, 1, 0, 0, 0, 898, 852, 1, 0, 0, 0, 898,
    865, 1, 0, 0, 0, 898, 872, 1, 0, 0, 0, 898, 887, 1, 0, 0, 0, 899, 149, 1, 0,
    0, 0, 900, 901, 5, 113, 0, 0, 901, 902, 5, 100, 0, 0, 902, 903, 3, 102, 51,
    0, 903, 904, 5, 101, 0, 0, 904, 913, 1, 0, 0, 0, 905, 906, 5, 113, 0, 0,
    906, 907, 5, 100, 0, 0, 907, 908, 3, 102, 51, 0, 908, 909, 5, 103, 0, 0,
    909, 910, 3, 102, 51, 0, 910, 911, 5, 101, 0, 0, 911, 913, 1, 0, 0, 0, 912,
    900, 1, 0, 0, 0, 912, 905, 1, 0, 0, 0, 913, 151, 1, 0, 0, 0, 914, 919, 3,
    102, 51, 0, 915, 916, 5, 103, 0, 0, 916, 918, 3, 102, 51, 0, 917, 915, 1, 0,
    0, 0, 918, 921, 1, 0, 0, 0, 919, 917, 1, 0, 0, 0, 919, 920, 1, 0, 0, 0, 920,
    153, 1, 0, 0, 0, 921, 919, 1, 0, 0, 0, 922, 932, 3, 162, 81, 0, 923, 932, 3,
    172, 86, 0, 924, 932, 3, 156, 78, 0, 925, 932, 3, 158, 79, 0, 926, 932, 3,
    160, 80, 0, 927, 932, 3, 166, 83, 0, 928, 932, 3, 164, 82, 0, 929, 932, 3,
    174, 87, 0, 930, 932, 5, 21, 0, 0, 931, 922, 1, 0, 0, 0, 931, 923, 1, 0, 0,
    0, 931, 924, 1, 0, 0, 0, 931, 925, 1, 0, 0, 0, 931, 926, 1, 0, 0, 0, 931,
    927, 1, 0, 0, 0, 931, 928, 1, 0, 0, 0, 931, 929, 1, 0, 0, 0, 931, 930, 1, 0,
    0, 0, 932, 155, 1, 0, 0, 0, 933, 934, 5, 14, 0, 0, 934, 935, 5, 104, 0, 0,
    935, 936, 5, 113, 0, 0, 936, 157, 1, 0, 0, 0, 937, 938, 5, 15, 0, 0, 938,
    939, 5, 104, 0, 0, 939, 940, 5, 113, 0, 0, 940, 159, 1, 0, 0, 0, 941, 944,
    5, 113, 0, 0, 942, 943, 5, 104, 0, 0, 943, 945, 5, 113, 0, 0, 944, 942, 1,
    0, 0, 0, 945, 946, 1, 0, 0, 0, 946, 944, 1, 0, 0, 0, 946, 947, 1, 0, 0, 0,
    947, 161, 1, 0, 0, 0, 948, 949, 7, 12, 0, 0, 949, 163, 1, 0, 0, 0, 950, 951,
    5, 113, 0, 0, 951, 165, 1, 0, 0, 0, 952, 953, 5, 113, 0, 0, 953, 954, 5, 78,
    0, 0, 954, 955, 3, 168, 84, 0, 955, 956, 5, 79, 0, 0, 956, 167, 1, 0, 0, 0,
    957, 962, 3, 170, 85, 0, 958, 959, 5, 103, 0, 0, 959, 961, 3, 170, 85, 0,
    960, 958, 1, 0, 0, 0, 961, 964, 1, 0, 0, 0, 962, 960, 1, 0, 0, 0, 962, 963,
    1, 0, 0, 0, 963, 169, 1, 0, 0, 0, 964, 962, 1, 0, 0, 0, 965, 970, 3, 166,
    83, 0, 966, 970, 3, 162, 81, 0, 967, 970, 5, 113, 0, 0, 968, 970, 5, 110, 0,
    0, 969, 965, 1, 0, 0, 0, 969, 966, 1, 0, 0, 0, 969, 967, 1, 0, 0, 0, 969,
    968, 1, 0, 0, 0, 970, 171, 1, 0, 0, 0, 971, 972, 5, 34, 0, 0, 972, 973, 5,
    78, 0, 0, 973, 974, 5, 110, 0, 0, 974, 977, 5, 79, 0, 0, 975, 977, 5, 34, 0,
    0, 976, 971, 1, 0, 0, 0, 976, 975, 1, 0, 0, 0, 977, 173, 1, 0, 0, 0, 978,
    979, 3, 162, 81, 0, 979, 980, 5, 100, 0, 0, 980, 981, 3, 102, 51, 0, 981,
    982, 5, 101, 0, 0, 982, 989, 1, 0, 0, 0, 983, 984, 3, 164, 82, 0, 984, 985,
    5, 100, 0, 0, 985, 986, 3, 102, 51, 0, 986, 987, 5, 101, 0, 0, 987, 989, 1,
    0, 0, 0, 988, 978, 1, 0, 0, 0, 988, 983, 1, 0, 0, 0, 989, 175, 1, 0, 0, 0,
    990, 991, 7, 13, 0, 0, 991, 177, 1, 0, 0, 0, 102, 180, 182, 188, 198, 213,
    221, 227, 231, 235, 239, 243, 247, 250, 262, 274, 284, 294, 307, 311, 318,
    328, 332, 342, 348, 358, 362, 369, 382, 387, 390, 393, 396, 403, 408, 419,
    426, 433, 449, 467, 476, 482, 496, 508, 527, 531, 535, 542, 545, 548, 551,
    558, 563, 575, 587, 590, 600, 608, 612, 617, 623, 638, 645, 653, 661, 669,
    677, 685, 693, 701, 709, 717, 729, 735, 752, 755, 769, 775, 787, 794, 801,
    805, 817, 821, 830, 835, 842, 850, 857, 870, 879, 885, 894, 896, 898, 912,
    919, 931, 946, 962, 969, 976, 988,
  ];

  private static __ATN: antlr.ATN;
  public static get _ATN(): antlr.ATN {
    if (!CNextParser.__ATN) {
      CNextParser.__ATN = new antlr.ATNDeserializer().deserialize(
        CNextParser._serializedATN,
      );
    }

    return CNextParser.__ATN;
  }

  private static readonly vocabulary = new antlr.Vocabulary(
    CNextParser.literalNames,
    CNextParser.symbolicNames,
    [],
  );

  public override get vocabulary(): antlr.Vocabulary {
    return CNextParser.vocabulary;
  }

  private static readonly decisionsToDFA = CNextParser._ATN.decisionToState.map(
    (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index),
  );
}

export class ProgramContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public EOF(): antlr.TerminalNode {
    return this.getToken(CNextParser.EOF, 0)!;
  }
  public includeDirective(): IncludeDirectiveContext[];
  public includeDirective(i: number): IncludeDirectiveContext | null;
  public includeDirective(
    i?: number,
  ): IncludeDirectiveContext[] | IncludeDirectiveContext | null {
    if (i === undefined) {
      return this.getRuleContexts(IncludeDirectiveContext);
    }

    return this.getRuleContext(i, IncludeDirectiveContext);
  }
  public preprocessorDirective(): PreprocessorDirectiveContext[];
  public preprocessorDirective(i: number): PreprocessorDirectiveContext | null;
  public preprocessorDirective(
    i?: number,
  ): PreprocessorDirectiveContext[] | PreprocessorDirectiveContext | null {
    if (i === undefined) {
      return this.getRuleContexts(PreprocessorDirectiveContext);
    }

    return this.getRuleContext(i, PreprocessorDirectiveContext);
  }
  public declaration(): DeclarationContext[];
  public declaration(i: number): DeclarationContext | null;
  public declaration(
    i?: number,
  ): DeclarationContext[] | DeclarationContext | null {
    if (i === undefined) {
      return this.getRuleContexts(DeclarationContext);
    }

    return this.getRuleContext(i, DeclarationContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_program;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterProgram) {
      listener.enterProgram(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitProgram) {
      listener.exitProgram(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitProgram) {
      return visitor.visitProgram(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class IncludeDirectiveContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public INCLUDE_DIRECTIVE(): antlr.TerminalNode {
    return this.getToken(CNextParser.INCLUDE_DIRECTIVE, 0)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_includeDirective;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterIncludeDirective) {
      listener.enterIncludeDirective(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitIncludeDirective) {
      listener.exitIncludeDirective(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitIncludeDirective) {
      return visitor.visitIncludeDirective(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class PreprocessorDirectiveContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public defineDirective(): DefineDirectiveContext | null {
    return this.getRuleContext(0, DefineDirectiveContext);
  }
  public conditionalDirective(): ConditionalDirectiveContext | null {
    return this.getRuleContext(0, ConditionalDirectiveContext);
  }
  public pragmaDirective(): PragmaDirectiveContext | null {
    return this.getRuleContext(0, PragmaDirectiveContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_preprocessorDirective;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterPreprocessorDirective) {
      listener.enterPreprocessorDirective(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitPreprocessorDirective) {
      listener.exitPreprocessorDirective(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitPreprocessorDirective) {
      return visitor.visitPreprocessorDirective(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class DefineDirectiveContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public DEFINE_FLAG(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.DEFINE_FLAG, 0);
  }
  public DEFINE_WITH_VALUE(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.DEFINE_WITH_VALUE, 0);
  }
  public DEFINE_FUNCTION(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.DEFINE_FUNCTION, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_defineDirective;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterDefineDirective) {
      listener.enterDefineDirective(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitDefineDirective) {
      listener.exitDefineDirective(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitDefineDirective) {
      return visitor.visitDefineDirective(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ConditionalDirectiveContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IFDEF_DIRECTIVE(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.IFDEF_DIRECTIVE, 0);
  }
  public IFNDEF_DIRECTIVE(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.IFNDEF_DIRECTIVE, 0);
  }
  public ELSE_DIRECTIVE(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.ELSE_DIRECTIVE, 0);
  }
  public ENDIF_DIRECTIVE(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.ENDIF_DIRECTIVE, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_conditionalDirective;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterConditionalDirective) {
      listener.enterConditionalDirective(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitConditionalDirective) {
      listener.exitConditionalDirective(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitConditionalDirective) {
      return visitor.visitConditionalDirective(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class PragmaDirectiveContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public PRAGMA_TARGET(): antlr.TerminalNode {
    return this.getToken(CNextParser.PRAGMA_TARGET, 0)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_pragmaDirective;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterPragmaDirective) {
      listener.enterPragmaDirective(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitPragmaDirective) {
      listener.exitPragmaDirective(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitPragmaDirective) {
      return visitor.visitPragmaDirective(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class DeclarationContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public scopeDeclaration(): ScopeDeclarationContext | null {
    return this.getRuleContext(0, ScopeDeclarationContext);
  }
  public registerDeclaration(): RegisterDeclarationContext | null {
    return this.getRuleContext(0, RegisterDeclarationContext);
  }
  public structDeclaration(): StructDeclarationContext | null {
    return this.getRuleContext(0, StructDeclarationContext);
  }
  public enumDeclaration(): EnumDeclarationContext | null {
    return this.getRuleContext(0, EnumDeclarationContext);
  }
  public bitmapDeclaration(): BitmapDeclarationContext | null {
    return this.getRuleContext(0, BitmapDeclarationContext);
  }
  public functionDeclaration(): FunctionDeclarationContext | null {
    return this.getRuleContext(0, FunctionDeclarationContext);
  }
  public variableDeclaration(): VariableDeclarationContext | null {
    return this.getRuleContext(0, VariableDeclarationContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_declaration;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterDeclaration) {
      listener.enterDeclaration(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitDeclaration) {
      listener.exitDeclaration(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitDeclaration) {
      return visitor.visitDeclaration(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ScopeDeclarationContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public SCOPE(): antlr.TerminalNode {
    return this.getToken(CNextParser.SCOPE, 0)!;
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public LBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.LBRACE, 0)!;
  }
  public RBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.RBRACE, 0)!;
  }
  public scopeMember(): ScopeMemberContext[];
  public scopeMember(i: number): ScopeMemberContext | null;
  public scopeMember(
    i?: number,
  ): ScopeMemberContext[] | ScopeMemberContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ScopeMemberContext);
    }

    return this.getRuleContext(i, ScopeMemberContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_scopeDeclaration;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterScopeDeclaration) {
      listener.enterScopeDeclaration(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitScopeDeclaration) {
      listener.exitScopeDeclaration(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitScopeDeclaration) {
      return visitor.visitScopeDeclaration(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ScopeMemberContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public variableDeclaration(): VariableDeclarationContext | null {
    return this.getRuleContext(0, VariableDeclarationContext);
  }
  public visibilityModifier(): VisibilityModifierContext | null {
    return this.getRuleContext(0, VisibilityModifierContext);
  }
  public functionDeclaration(): FunctionDeclarationContext | null {
    return this.getRuleContext(0, FunctionDeclarationContext);
  }
  public enumDeclaration(): EnumDeclarationContext | null {
    return this.getRuleContext(0, EnumDeclarationContext);
  }
  public bitmapDeclaration(): BitmapDeclarationContext | null {
    return this.getRuleContext(0, BitmapDeclarationContext);
  }
  public registerDeclaration(): RegisterDeclarationContext | null {
    return this.getRuleContext(0, RegisterDeclarationContext);
  }
  public structDeclaration(): StructDeclarationContext | null {
    return this.getRuleContext(0, StructDeclarationContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_scopeMember;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterScopeMember) {
      listener.enterScopeMember(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitScopeMember) {
      listener.exitScopeMember(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitScopeMember) {
      return visitor.visitScopeMember(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class VisibilityModifierContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public PRIVATE(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.PRIVATE, 0);
  }
  public PUBLIC(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.PUBLIC, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_visibilityModifier;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterVisibilityModifier) {
      listener.enterVisibilityModifier(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitVisibilityModifier) {
      listener.exitVisibilityModifier(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitVisibilityModifier) {
      return visitor.visitVisibilityModifier(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class RegisterDeclarationContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public REGISTER(): antlr.TerminalNode {
    return this.getToken(CNextParser.REGISTER, 0)!;
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public AT(): antlr.TerminalNode {
    return this.getToken(CNextParser.AT, 0)!;
  }
  public expression(): ExpressionContext {
    return this.getRuleContext(0, ExpressionContext)!;
  }
  public LBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.LBRACE, 0)!;
  }
  public RBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.RBRACE, 0)!;
  }
  public registerMember(): RegisterMemberContext[];
  public registerMember(i: number): RegisterMemberContext | null;
  public registerMember(
    i?: number,
  ): RegisterMemberContext[] | RegisterMemberContext | null {
    if (i === undefined) {
      return this.getRuleContexts(RegisterMemberContext);
    }

    return this.getRuleContext(i, RegisterMemberContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_registerDeclaration;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterRegisterDeclaration) {
      listener.enterRegisterDeclaration(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitRegisterDeclaration) {
      listener.exitRegisterDeclaration(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitRegisterDeclaration) {
      return visitor.visitRegisterDeclaration(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class RegisterMemberContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public COLON(): antlr.TerminalNode {
    return this.getToken(CNextParser.COLON, 0)!;
  }
  public type(): TypeContext {
    return this.getRuleContext(0, TypeContext)!;
  }
  public accessModifier(): AccessModifierContext {
    return this.getRuleContext(0, AccessModifierContext)!;
  }
  public AT(): antlr.TerminalNode {
    return this.getToken(CNextParser.AT, 0)!;
  }
  public expression(): ExpressionContext {
    return this.getRuleContext(0, ExpressionContext)!;
  }
  public COMMA(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.COMMA, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_registerMember;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterRegisterMember) {
      listener.enterRegisterMember(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitRegisterMember) {
      listener.exitRegisterMember(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitRegisterMember) {
      return visitor.visitRegisterMember(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class AccessModifierContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public RW(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.RW, 0);
  }
  public RO(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.RO, 0);
  }
  public WO(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.WO, 0);
  }
  public W1C(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.W1C, 0);
  }
  public W1S(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.W1S, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_accessModifier;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterAccessModifier) {
      listener.enterAccessModifier(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitAccessModifier) {
      listener.exitAccessModifier(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitAccessModifier) {
      return visitor.visitAccessModifier(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class StructDeclarationContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public STRUCT(): antlr.TerminalNode {
    return this.getToken(CNextParser.STRUCT, 0)!;
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public LBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.LBRACE, 0)!;
  }
  public RBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.RBRACE, 0)!;
  }
  public structMember(): StructMemberContext[];
  public structMember(i: number): StructMemberContext | null;
  public structMember(
    i?: number,
  ): StructMemberContext[] | StructMemberContext | null {
    if (i === undefined) {
      return this.getRuleContexts(StructMemberContext);
    }

    return this.getRuleContext(i, StructMemberContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_structDeclaration;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterStructDeclaration) {
      listener.enterStructDeclaration(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitStructDeclaration) {
      listener.exitStructDeclaration(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitStructDeclaration) {
      return visitor.visitStructDeclaration(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class StructMemberContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public type(): TypeContext {
    return this.getRuleContext(0, TypeContext)!;
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public SEMI(): antlr.TerminalNode {
    return this.getToken(CNextParser.SEMI, 0)!;
  }
  public arrayDimension(): ArrayDimensionContext[];
  public arrayDimension(i: number): ArrayDimensionContext | null;
  public arrayDimension(
    i?: number,
  ): ArrayDimensionContext[] | ArrayDimensionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ArrayDimensionContext);
    }

    return this.getRuleContext(i, ArrayDimensionContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_structMember;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterStructMember) {
      listener.enterStructMember(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitStructMember) {
      listener.exitStructMember(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitStructMember) {
      return visitor.visitStructMember(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class EnumDeclarationContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public ENUM(): antlr.TerminalNode {
    return this.getToken(CNextParser.ENUM, 0)!;
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public LBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.LBRACE, 0)!;
  }
  public enumMember(): EnumMemberContext[];
  public enumMember(i: number): EnumMemberContext | null;
  public enumMember(
    i?: number,
  ): EnumMemberContext[] | EnumMemberContext | null {
    if (i === undefined) {
      return this.getRuleContexts(EnumMemberContext);
    }

    return this.getRuleContext(i, EnumMemberContext);
  }
  public RBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.RBRACE, 0)!;
  }
  public COMMA(): antlr.TerminalNode[];
  public COMMA(i: number): antlr.TerminalNode | null;
  public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.COMMA);
    } else {
      return this.getToken(CNextParser.COMMA, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_enumDeclaration;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterEnumDeclaration) {
      listener.enterEnumDeclaration(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitEnumDeclaration) {
      listener.exitEnumDeclaration(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitEnumDeclaration) {
      return visitor.visitEnumDeclaration(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class EnumMemberContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.ASSIGN, 0);
  }
  public expression(): ExpressionContext | null {
    return this.getRuleContext(0, ExpressionContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_enumMember;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterEnumMember) {
      listener.enterEnumMember(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitEnumMember) {
      listener.exitEnumMember(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitEnumMember) {
      return visitor.visitEnumMember(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class BitmapDeclarationContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public bitmapType(): BitmapTypeContext {
    return this.getRuleContext(0, BitmapTypeContext)!;
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public LBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.LBRACE, 0)!;
  }
  public bitmapMember(): BitmapMemberContext[];
  public bitmapMember(i: number): BitmapMemberContext | null;
  public bitmapMember(
    i?: number,
  ): BitmapMemberContext[] | BitmapMemberContext | null {
    if (i === undefined) {
      return this.getRuleContexts(BitmapMemberContext);
    }

    return this.getRuleContext(i, BitmapMemberContext);
  }
  public RBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.RBRACE, 0)!;
  }
  public COMMA(): antlr.TerminalNode[];
  public COMMA(i: number): antlr.TerminalNode | null;
  public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.COMMA);
    } else {
      return this.getToken(CNextParser.COMMA, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_bitmapDeclaration;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterBitmapDeclaration) {
      listener.enterBitmapDeclaration(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitBitmapDeclaration) {
      listener.exitBitmapDeclaration(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitBitmapDeclaration) {
      return visitor.visitBitmapDeclaration(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class BitmapTypeContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public BITMAP8(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.BITMAP8, 0);
  }
  public BITMAP16(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.BITMAP16, 0);
  }
  public BITMAP24(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.BITMAP24, 0);
  }
  public BITMAP32(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.BITMAP32, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_bitmapType;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterBitmapType) {
      listener.enterBitmapType(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitBitmapType) {
      listener.exitBitmapType(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitBitmapType) {
      return visitor.visitBitmapType(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class BitmapMemberContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public LBRACKET(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.LBRACKET, 0);
  }
  public INTEGER_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.INTEGER_LITERAL, 0);
  }
  public RBRACKET(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.RBRACKET, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_bitmapMember;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterBitmapMember) {
      listener.enterBitmapMember(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitBitmapMember) {
      listener.exitBitmapMember(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitBitmapMember) {
      return visitor.visitBitmapMember(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class FunctionDeclarationContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public type(): TypeContext {
    return this.getRuleContext(0, TypeContext)!;
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public LPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.LPAREN, 0)!;
  }
  public RPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.RPAREN, 0)!;
  }
  public block(): BlockContext {
    return this.getRuleContext(0, BlockContext)!;
  }
  public parameterList(): ParameterListContext | null {
    return this.getRuleContext(0, ParameterListContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_functionDeclaration;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterFunctionDeclaration) {
      listener.enterFunctionDeclaration(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitFunctionDeclaration) {
      listener.exitFunctionDeclaration(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitFunctionDeclaration) {
      return visitor.visitFunctionDeclaration(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ParameterListContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public parameter(): ParameterContext[];
  public parameter(i: number): ParameterContext | null;
  public parameter(i?: number): ParameterContext[] | ParameterContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ParameterContext);
    }

    return this.getRuleContext(i, ParameterContext);
  }
  public COMMA(): antlr.TerminalNode[];
  public COMMA(i: number): antlr.TerminalNode | null;
  public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.COMMA);
    } else {
      return this.getToken(CNextParser.COMMA, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_parameterList;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterParameterList) {
      listener.enterParameterList(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitParameterList) {
      listener.exitParameterList(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitParameterList) {
      return visitor.visitParameterList(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ParameterContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public type(): TypeContext {
    return this.getRuleContext(0, TypeContext)!;
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public constModifier(): ConstModifierContext | null {
    return this.getRuleContext(0, ConstModifierContext);
  }
  public arrayDimension(): ArrayDimensionContext[];
  public arrayDimension(i: number): ArrayDimensionContext | null;
  public arrayDimension(
    i?: number,
  ): ArrayDimensionContext[] | ArrayDimensionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ArrayDimensionContext);
    }

    return this.getRuleContext(i, ArrayDimensionContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_parameter;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterParameter) {
      listener.enterParameter(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitParameter) {
      listener.exitParameter(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitParameter) {
      return visitor.visitParameter(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ConstModifierContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public CONST(): antlr.TerminalNode {
    return this.getToken(CNextParser.CONST, 0)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_constModifier;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterConstModifier) {
      listener.enterConstModifier(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitConstModifier) {
      listener.exitConstModifier(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitConstModifier) {
      return visitor.visitConstModifier(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class VolatileModifierContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public VOLATILE(): antlr.TerminalNode {
    return this.getToken(CNextParser.VOLATILE, 0)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_volatileModifier;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterVolatileModifier) {
      listener.enterVolatileModifier(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitVolatileModifier) {
      listener.exitVolatileModifier(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitVolatileModifier) {
      return visitor.visitVolatileModifier(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class OverflowModifierContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public CLAMP(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.CLAMP, 0);
  }
  public WRAP(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.WRAP, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_overflowModifier;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterOverflowModifier) {
      listener.enterOverflowModifier(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitOverflowModifier) {
      listener.exitOverflowModifier(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitOverflowModifier) {
      return visitor.visitOverflowModifier(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class AtomicModifierContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public ATOMIC(): antlr.TerminalNode {
    return this.getToken(CNextParser.ATOMIC, 0)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_atomicModifier;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterAtomicModifier) {
      listener.enterAtomicModifier(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitAtomicModifier) {
      listener.exitAtomicModifier(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitAtomicModifier) {
      return visitor.visitAtomicModifier(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ArrayDimensionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public LBRACKET(): antlr.TerminalNode {
    return this.getToken(CNextParser.LBRACKET, 0)!;
  }
  public RBRACKET(): antlr.TerminalNode {
    return this.getToken(CNextParser.RBRACKET, 0)!;
  }
  public expression(): ExpressionContext | null {
    return this.getRuleContext(0, ExpressionContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_arrayDimension;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterArrayDimension) {
      listener.enterArrayDimension(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitArrayDimension) {
      listener.exitArrayDimension(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitArrayDimension) {
      return visitor.visitArrayDimension(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class VariableDeclarationContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public type(): TypeContext {
    return this.getRuleContext(0, TypeContext)!;
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public SEMI(): antlr.TerminalNode {
    return this.getToken(CNextParser.SEMI, 0)!;
  }
  public atomicModifier(): AtomicModifierContext | null {
    return this.getRuleContext(0, AtomicModifierContext);
  }
  public volatileModifier(): VolatileModifierContext | null {
    return this.getRuleContext(0, VolatileModifierContext);
  }
  public constModifier(): ConstModifierContext | null {
    return this.getRuleContext(0, ConstModifierContext);
  }
  public overflowModifier(): OverflowModifierContext | null {
    return this.getRuleContext(0, OverflowModifierContext);
  }
  public arrayDimension(): ArrayDimensionContext[];
  public arrayDimension(i: number): ArrayDimensionContext | null;
  public arrayDimension(
    i?: number,
  ): ArrayDimensionContext[] | ArrayDimensionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ArrayDimensionContext);
    }

    return this.getRuleContext(i, ArrayDimensionContext);
  }
  public ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.ASSIGN, 0);
  }
  public expression(): ExpressionContext | null {
    return this.getRuleContext(0, ExpressionContext);
  }
  public LPAREN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.LPAREN, 0);
  }
  public constructorArgumentList(): ConstructorArgumentListContext | null {
    return this.getRuleContext(0, ConstructorArgumentListContext);
  }
  public RPAREN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.RPAREN, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_variableDeclaration;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterVariableDeclaration) {
      listener.enterVariableDeclaration(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitVariableDeclaration) {
      listener.exitVariableDeclaration(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitVariableDeclaration) {
      return visitor.visitVariableDeclaration(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ConstructorArgumentListContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IDENTIFIER(): antlr.TerminalNode[];
  public IDENTIFIER(i: number): antlr.TerminalNode | null;
  public IDENTIFIER(
    i?: number,
  ): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.IDENTIFIER);
    } else {
      return this.getToken(CNextParser.IDENTIFIER, i);
    }
  }
  public COMMA(): antlr.TerminalNode[];
  public COMMA(i: number): antlr.TerminalNode | null;
  public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.COMMA);
    } else {
      return this.getToken(CNextParser.COMMA, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_constructorArgumentList;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterConstructorArgumentList) {
      listener.enterConstructorArgumentList(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitConstructorArgumentList) {
      listener.exitConstructorArgumentList(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitConstructorArgumentList) {
      return visitor.visitConstructorArgumentList(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class BlockContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public LBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.LBRACE, 0)!;
  }
  public RBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.RBRACE, 0)!;
  }
  public statement(): StatementContext[];
  public statement(i: number): StatementContext | null;
  public statement(i?: number): StatementContext[] | StatementContext | null {
    if (i === undefined) {
      return this.getRuleContexts(StatementContext);
    }

    return this.getRuleContext(i, StatementContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_block;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterBlock) {
      listener.enterBlock(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitBlock) {
      listener.exitBlock(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitBlock) {
      return visitor.visitBlock(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class StatementContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public variableDeclaration(): VariableDeclarationContext | null {
    return this.getRuleContext(0, VariableDeclarationContext);
  }
  public assignmentStatement(): AssignmentStatementContext | null {
    return this.getRuleContext(0, AssignmentStatementContext);
  }
  public expressionStatement(): ExpressionStatementContext | null {
    return this.getRuleContext(0, ExpressionStatementContext);
  }
  public ifStatement(): IfStatementContext | null {
    return this.getRuleContext(0, IfStatementContext);
  }
  public whileStatement(): WhileStatementContext | null {
    return this.getRuleContext(0, WhileStatementContext);
  }
  public doWhileStatement(): DoWhileStatementContext | null {
    return this.getRuleContext(0, DoWhileStatementContext);
  }
  public forStatement(): ForStatementContext | null {
    return this.getRuleContext(0, ForStatementContext);
  }
  public switchStatement(): SwitchStatementContext | null {
    return this.getRuleContext(0, SwitchStatementContext);
  }
  public returnStatement(): ReturnStatementContext | null {
    return this.getRuleContext(0, ReturnStatementContext);
  }
  public criticalStatement(): CriticalStatementContext | null {
    return this.getRuleContext(0, CriticalStatementContext);
  }
  public block(): BlockContext | null {
    return this.getRuleContext(0, BlockContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_statement;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterStatement) {
      listener.enterStatement(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitStatement) {
      listener.exitStatement(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitStatement) {
      return visitor.visitStatement(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class CriticalStatementContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public CRITICAL(): antlr.TerminalNode {
    return this.getToken(CNextParser.CRITICAL, 0)!;
  }
  public block(): BlockContext {
    return this.getRuleContext(0, BlockContext)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_criticalStatement;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterCriticalStatement) {
      listener.enterCriticalStatement(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitCriticalStatement) {
      listener.exitCriticalStatement(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitCriticalStatement) {
      return visitor.visitCriticalStatement(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class AssignmentStatementContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public assignmentTarget(): AssignmentTargetContext {
    return this.getRuleContext(0, AssignmentTargetContext)!;
  }
  public assignmentOperator(): AssignmentOperatorContext {
    return this.getRuleContext(0, AssignmentOperatorContext)!;
  }
  public expression(): ExpressionContext {
    return this.getRuleContext(0, ExpressionContext)!;
  }
  public SEMI(): antlr.TerminalNode {
    return this.getToken(CNextParser.SEMI, 0)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_assignmentStatement;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterAssignmentStatement) {
      listener.enterAssignmentStatement(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitAssignmentStatement) {
      listener.exitAssignmentStatement(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitAssignmentStatement) {
      return visitor.visitAssignmentStatement(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class AssignmentOperatorContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.ASSIGN, 0);
  }
  public PLUS_ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.PLUS_ASSIGN, 0);
  }
  public MINUS_ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.MINUS_ASSIGN, 0);
  }
  public STAR_ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.STAR_ASSIGN, 0);
  }
  public SLASH_ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.SLASH_ASSIGN, 0);
  }
  public PERCENT_ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.PERCENT_ASSIGN, 0);
  }
  public BITAND_ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.BITAND_ASSIGN, 0);
  }
  public BITOR_ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.BITOR_ASSIGN, 0);
  }
  public BITXOR_ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.BITXOR_ASSIGN, 0);
  }
  public LSHIFT_ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.LSHIFT_ASSIGN, 0);
  }
  public RSHIFT_ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.RSHIFT_ASSIGN, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_assignmentOperator;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterAssignmentOperator) {
      listener.enterAssignmentOperator(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitAssignmentOperator) {
      listener.exitAssignmentOperator(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitAssignmentOperator) {
      return visitor.visitAssignmentOperator(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class AssignmentTargetContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public GLOBAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.GLOBAL, 0);
  }
  public DOT(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.DOT, 0);
  }
  public IDENTIFIER(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.IDENTIFIER, 0);
  }
  public postfixTargetOp(): PostfixTargetOpContext[];
  public postfixTargetOp(i: number): PostfixTargetOpContext | null;
  public postfixTargetOp(
    i?: number,
  ): PostfixTargetOpContext[] | PostfixTargetOpContext | null {
    if (i === undefined) {
      return this.getRuleContexts(PostfixTargetOpContext);
    }

    return this.getRuleContext(i, PostfixTargetOpContext);
  }
  public THIS(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.THIS, 0);
  }
  public arrayAccess(): ArrayAccessContext | null {
    return this.getRuleContext(0, ArrayAccessContext);
  }
  public memberAccess(): MemberAccessContext | null {
    return this.getRuleContext(0, MemberAccessContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_assignmentTarget;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterAssignmentTarget) {
      listener.enterAssignmentTarget(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitAssignmentTarget) {
      listener.exitAssignmentTarget(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitAssignmentTarget) {
      return visitor.visitAssignmentTarget(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class PostfixTargetOpContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public DOT(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.DOT, 0);
  }
  public IDENTIFIER(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.IDENTIFIER, 0);
  }
  public LBRACKET(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.LBRACKET, 0);
  }
  public expression(): ExpressionContext[];
  public expression(i: number): ExpressionContext | null;
  public expression(
    i?: number,
  ): ExpressionContext[] | ExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ExpressionContext);
    }

    return this.getRuleContext(i, ExpressionContext);
  }
  public RBRACKET(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.RBRACKET, 0);
  }
  public COMMA(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.COMMA, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_postfixTargetOp;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterPostfixTargetOp) {
      listener.enterPostfixTargetOp(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitPostfixTargetOp) {
      listener.exitPostfixTargetOp(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitPostfixTargetOp) {
      return visitor.visitPostfixTargetOp(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ExpressionStatementContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public expression(): ExpressionContext {
    return this.getRuleContext(0, ExpressionContext)!;
  }
  public SEMI(): antlr.TerminalNode {
    return this.getToken(CNextParser.SEMI, 0)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_expressionStatement;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterExpressionStatement) {
      listener.enterExpressionStatement(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitExpressionStatement) {
      listener.exitExpressionStatement(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitExpressionStatement) {
      return visitor.visitExpressionStatement(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class IfStatementContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IF(): antlr.TerminalNode {
    return this.getToken(CNextParser.IF, 0)!;
  }
  public LPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.LPAREN, 0)!;
  }
  public expression(): ExpressionContext {
    return this.getRuleContext(0, ExpressionContext)!;
  }
  public RPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.RPAREN, 0)!;
  }
  public statement(): StatementContext[];
  public statement(i: number): StatementContext | null;
  public statement(i?: number): StatementContext[] | StatementContext | null {
    if (i === undefined) {
      return this.getRuleContexts(StatementContext);
    }

    return this.getRuleContext(i, StatementContext);
  }
  public ELSE(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.ELSE, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_ifStatement;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterIfStatement) {
      listener.enterIfStatement(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitIfStatement) {
      listener.exitIfStatement(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitIfStatement) {
      return visitor.visitIfStatement(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class WhileStatementContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public WHILE(): antlr.TerminalNode {
    return this.getToken(CNextParser.WHILE, 0)!;
  }
  public LPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.LPAREN, 0)!;
  }
  public expression(): ExpressionContext {
    return this.getRuleContext(0, ExpressionContext)!;
  }
  public RPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.RPAREN, 0)!;
  }
  public statement(): StatementContext {
    return this.getRuleContext(0, StatementContext)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_whileStatement;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterWhileStatement) {
      listener.enterWhileStatement(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitWhileStatement) {
      listener.exitWhileStatement(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitWhileStatement) {
      return visitor.visitWhileStatement(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class DoWhileStatementContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public DO(): antlr.TerminalNode {
    return this.getToken(CNextParser.DO, 0)!;
  }
  public block(): BlockContext {
    return this.getRuleContext(0, BlockContext)!;
  }
  public WHILE(): antlr.TerminalNode {
    return this.getToken(CNextParser.WHILE, 0)!;
  }
  public LPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.LPAREN, 0)!;
  }
  public expression(): ExpressionContext {
    return this.getRuleContext(0, ExpressionContext)!;
  }
  public RPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.RPAREN, 0)!;
  }
  public SEMI(): antlr.TerminalNode {
    return this.getToken(CNextParser.SEMI, 0)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_doWhileStatement;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterDoWhileStatement) {
      listener.enterDoWhileStatement(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitDoWhileStatement) {
      listener.exitDoWhileStatement(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitDoWhileStatement) {
      return visitor.visitDoWhileStatement(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ForStatementContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public FOR(): antlr.TerminalNode {
    return this.getToken(CNextParser.FOR, 0)!;
  }
  public LPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.LPAREN, 0)!;
  }
  public SEMI(): antlr.TerminalNode[];
  public SEMI(i: number): antlr.TerminalNode | null;
  public SEMI(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.SEMI);
    } else {
      return this.getToken(CNextParser.SEMI, i);
    }
  }
  public RPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.RPAREN, 0)!;
  }
  public statement(): StatementContext {
    return this.getRuleContext(0, StatementContext)!;
  }
  public forInit(): ForInitContext | null {
    return this.getRuleContext(0, ForInitContext);
  }
  public expression(): ExpressionContext | null {
    return this.getRuleContext(0, ExpressionContext);
  }
  public forUpdate(): ForUpdateContext | null {
    return this.getRuleContext(0, ForUpdateContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_forStatement;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterForStatement) {
      listener.enterForStatement(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitForStatement) {
      listener.exitForStatement(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitForStatement) {
      return visitor.visitForStatement(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ForInitContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public forVarDecl(): ForVarDeclContext | null {
    return this.getRuleContext(0, ForVarDeclContext);
  }
  public forAssignment(): ForAssignmentContext | null {
    return this.getRuleContext(0, ForAssignmentContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_forInit;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterForInit) {
      listener.enterForInit(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitForInit) {
      listener.exitForInit(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitForInit) {
      return visitor.visitForInit(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ForVarDeclContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public type(): TypeContext {
    return this.getRuleContext(0, TypeContext)!;
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public atomicModifier(): AtomicModifierContext | null {
    return this.getRuleContext(0, AtomicModifierContext);
  }
  public volatileModifier(): VolatileModifierContext | null {
    return this.getRuleContext(0, VolatileModifierContext);
  }
  public overflowModifier(): OverflowModifierContext | null {
    return this.getRuleContext(0, OverflowModifierContext);
  }
  public arrayDimension(): ArrayDimensionContext[];
  public arrayDimension(i: number): ArrayDimensionContext | null;
  public arrayDimension(
    i?: number,
  ): ArrayDimensionContext[] | ArrayDimensionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ArrayDimensionContext);
    }

    return this.getRuleContext(i, ArrayDimensionContext);
  }
  public ASSIGN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.ASSIGN, 0);
  }
  public expression(): ExpressionContext | null {
    return this.getRuleContext(0, ExpressionContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_forVarDecl;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterForVarDecl) {
      listener.enterForVarDecl(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitForVarDecl) {
      listener.exitForVarDecl(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitForVarDecl) {
      return visitor.visitForVarDecl(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ForAssignmentContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public assignmentTarget(): AssignmentTargetContext {
    return this.getRuleContext(0, AssignmentTargetContext)!;
  }
  public assignmentOperator(): AssignmentOperatorContext {
    return this.getRuleContext(0, AssignmentOperatorContext)!;
  }
  public expression(): ExpressionContext {
    return this.getRuleContext(0, ExpressionContext)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_forAssignment;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterForAssignment) {
      listener.enterForAssignment(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitForAssignment) {
      listener.exitForAssignment(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitForAssignment) {
      return visitor.visitForAssignment(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ForUpdateContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public assignmentTarget(): AssignmentTargetContext {
    return this.getRuleContext(0, AssignmentTargetContext)!;
  }
  public assignmentOperator(): AssignmentOperatorContext {
    return this.getRuleContext(0, AssignmentOperatorContext)!;
  }
  public expression(): ExpressionContext {
    return this.getRuleContext(0, ExpressionContext)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_forUpdate;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterForUpdate) {
      listener.enterForUpdate(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitForUpdate) {
      listener.exitForUpdate(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitForUpdate) {
      return visitor.visitForUpdate(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ReturnStatementContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public RETURN(): antlr.TerminalNode {
    return this.getToken(CNextParser.RETURN, 0)!;
  }
  public SEMI(): antlr.TerminalNode {
    return this.getToken(CNextParser.SEMI, 0)!;
  }
  public expression(): ExpressionContext | null {
    return this.getRuleContext(0, ExpressionContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_returnStatement;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterReturnStatement) {
      listener.enterReturnStatement(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitReturnStatement) {
      listener.exitReturnStatement(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitReturnStatement) {
      return visitor.visitReturnStatement(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class SwitchStatementContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public SWITCH(): antlr.TerminalNode {
    return this.getToken(CNextParser.SWITCH, 0)!;
  }
  public LPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.LPAREN, 0)!;
  }
  public expression(): ExpressionContext {
    return this.getRuleContext(0, ExpressionContext)!;
  }
  public RPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.RPAREN, 0)!;
  }
  public LBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.LBRACE, 0)!;
  }
  public RBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.RBRACE, 0)!;
  }
  public switchCase(): SwitchCaseContext[];
  public switchCase(i: number): SwitchCaseContext | null;
  public switchCase(
    i?: number,
  ): SwitchCaseContext[] | SwitchCaseContext | null {
    if (i === undefined) {
      return this.getRuleContexts(SwitchCaseContext);
    }

    return this.getRuleContext(i, SwitchCaseContext);
  }
  public defaultCase(): DefaultCaseContext | null {
    return this.getRuleContext(0, DefaultCaseContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_switchStatement;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterSwitchStatement) {
      listener.enterSwitchStatement(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitSwitchStatement) {
      listener.exitSwitchStatement(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitSwitchStatement) {
      return visitor.visitSwitchStatement(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class SwitchCaseContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public CASE(): antlr.TerminalNode {
    return this.getToken(CNextParser.CASE, 0)!;
  }
  public caseLabel(): CaseLabelContext[];
  public caseLabel(i: number): CaseLabelContext | null;
  public caseLabel(i?: number): CaseLabelContext[] | CaseLabelContext | null {
    if (i === undefined) {
      return this.getRuleContexts(CaseLabelContext);
    }

    return this.getRuleContext(i, CaseLabelContext);
  }
  public block(): BlockContext {
    return this.getRuleContext(0, BlockContext)!;
  }
  public OR(): antlr.TerminalNode[];
  public OR(i: number): antlr.TerminalNode | null;
  public OR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.OR);
    } else {
      return this.getToken(CNextParser.OR, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_switchCase;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterSwitchCase) {
      listener.enterSwitchCase(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitSwitchCase) {
      listener.exitSwitchCase(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitSwitchCase) {
      return visitor.visitSwitchCase(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class CaseLabelContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public qualifiedType(): QualifiedTypeContext | null {
    return this.getRuleContext(0, QualifiedTypeContext);
  }
  public IDENTIFIER(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.IDENTIFIER, 0);
  }
  public INTEGER_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.INTEGER_LITERAL, 0);
  }
  public MINUS(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.MINUS, 0);
  }
  public HEX_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.HEX_LITERAL, 0);
  }
  public BINARY_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.BINARY_LITERAL, 0);
  }
  public CHAR_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.CHAR_LITERAL, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_caseLabel;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterCaseLabel) {
      listener.enterCaseLabel(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitCaseLabel) {
      listener.exitCaseLabel(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitCaseLabel) {
      return visitor.visitCaseLabel(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class DefaultCaseContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public DEFAULT(): antlr.TerminalNode {
    return this.getToken(CNextParser.DEFAULT, 0)!;
  }
  public block(): BlockContext {
    return this.getRuleContext(0, BlockContext)!;
  }
  public LPAREN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.LPAREN, 0);
  }
  public INTEGER_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.INTEGER_LITERAL, 0);
  }
  public RPAREN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.RPAREN, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_defaultCase;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterDefaultCase) {
      listener.enterDefaultCase(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitDefaultCase) {
      listener.exitDefaultCase(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitDefaultCase) {
      return visitor.visitDefaultCase(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public ternaryExpression(): TernaryExpressionContext {
    return this.getRuleContext(0, TernaryExpressionContext)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_expression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterExpression) {
      listener.enterExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitExpression) {
      listener.exitExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitExpression) {
      return visitor.visitExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class TernaryExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public LPAREN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.LPAREN, 0);
  }
  public orExpression(): OrExpressionContext[];
  public orExpression(i: number): OrExpressionContext | null;
  public orExpression(
    i?: number,
  ): OrExpressionContext[] | OrExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(OrExpressionContext);
    }

    return this.getRuleContext(i, OrExpressionContext);
  }
  public RPAREN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.RPAREN, 0);
  }
  public COLON(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.COLON, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_ternaryExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterTernaryExpression) {
      listener.enterTernaryExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitTernaryExpression) {
      listener.exitTernaryExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitTernaryExpression) {
      return visitor.visitTernaryExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class OrExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public andExpression(): AndExpressionContext[];
  public andExpression(i: number): AndExpressionContext | null;
  public andExpression(
    i?: number,
  ): AndExpressionContext[] | AndExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(AndExpressionContext);
    }

    return this.getRuleContext(i, AndExpressionContext);
  }
  public OR(): antlr.TerminalNode[];
  public OR(i: number): antlr.TerminalNode | null;
  public OR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.OR);
    } else {
      return this.getToken(CNextParser.OR, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_orExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterOrExpression) {
      listener.enterOrExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitOrExpression) {
      listener.exitOrExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitOrExpression) {
      return visitor.visitOrExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class AndExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public equalityExpression(): EqualityExpressionContext[];
  public equalityExpression(i: number): EqualityExpressionContext | null;
  public equalityExpression(
    i?: number,
  ): EqualityExpressionContext[] | EqualityExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(EqualityExpressionContext);
    }

    return this.getRuleContext(i, EqualityExpressionContext);
  }
  public AND(): antlr.TerminalNode[];
  public AND(i: number): antlr.TerminalNode | null;
  public AND(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.AND);
    } else {
      return this.getToken(CNextParser.AND, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_andExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterAndExpression) {
      listener.enterAndExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitAndExpression) {
      listener.exitAndExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitAndExpression) {
      return visitor.visitAndExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class EqualityExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public relationalExpression(): RelationalExpressionContext[];
  public relationalExpression(i: number): RelationalExpressionContext | null;
  public relationalExpression(
    i?: number,
  ): RelationalExpressionContext[] | RelationalExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(RelationalExpressionContext);
    }

    return this.getRuleContext(i, RelationalExpressionContext);
  }
  public EQ(): antlr.TerminalNode[];
  public EQ(i: number): antlr.TerminalNode | null;
  public EQ(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.EQ);
    } else {
      return this.getToken(CNextParser.EQ, i);
    }
  }
  public NEQ(): antlr.TerminalNode[];
  public NEQ(i: number): antlr.TerminalNode | null;
  public NEQ(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.NEQ);
    } else {
      return this.getToken(CNextParser.NEQ, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_equalityExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterEqualityExpression) {
      listener.enterEqualityExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitEqualityExpression) {
      listener.exitEqualityExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitEqualityExpression) {
      return visitor.visitEqualityExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class RelationalExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public bitwiseOrExpression(): BitwiseOrExpressionContext[];
  public bitwiseOrExpression(i: number): BitwiseOrExpressionContext | null;
  public bitwiseOrExpression(
    i?: number,
  ): BitwiseOrExpressionContext[] | BitwiseOrExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(BitwiseOrExpressionContext);
    }

    return this.getRuleContext(i, BitwiseOrExpressionContext);
  }
  public LT(): antlr.TerminalNode[];
  public LT(i: number): antlr.TerminalNode | null;
  public LT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.LT);
    } else {
      return this.getToken(CNextParser.LT, i);
    }
  }
  public GT(): antlr.TerminalNode[];
  public GT(i: number): antlr.TerminalNode | null;
  public GT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.GT);
    } else {
      return this.getToken(CNextParser.GT, i);
    }
  }
  public LTE(): antlr.TerminalNode[];
  public LTE(i: number): antlr.TerminalNode | null;
  public LTE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.LTE);
    } else {
      return this.getToken(CNextParser.LTE, i);
    }
  }
  public GTE(): antlr.TerminalNode[];
  public GTE(i: number): antlr.TerminalNode | null;
  public GTE(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.GTE);
    } else {
      return this.getToken(CNextParser.GTE, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_relationalExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterRelationalExpression) {
      listener.enterRelationalExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitRelationalExpression) {
      listener.exitRelationalExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitRelationalExpression) {
      return visitor.visitRelationalExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class BitwiseOrExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public bitwiseXorExpression(): BitwiseXorExpressionContext[];
  public bitwiseXorExpression(i: number): BitwiseXorExpressionContext | null;
  public bitwiseXorExpression(
    i?: number,
  ): BitwiseXorExpressionContext[] | BitwiseXorExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(BitwiseXorExpressionContext);
    }

    return this.getRuleContext(i, BitwiseXorExpressionContext);
  }
  public BITOR(): antlr.TerminalNode[];
  public BITOR(i: number): antlr.TerminalNode | null;
  public BITOR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.BITOR);
    } else {
      return this.getToken(CNextParser.BITOR, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_bitwiseOrExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterBitwiseOrExpression) {
      listener.enterBitwiseOrExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitBitwiseOrExpression) {
      listener.exitBitwiseOrExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitBitwiseOrExpression) {
      return visitor.visitBitwiseOrExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class BitwiseXorExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public bitwiseAndExpression(): BitwiseAndExpressionContext[];
  public bitwiseAndExpression(i: number): BitwiseAndExpressionContext | null;
  public bitwiseAndExpression(
    i?: number,
  ): BitwiseAndExpressionContext[] | BitwiseAndExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(BitwiseAndExpressionContext);
    }

    return this.getRuleContext(i, BitwiseAndExpressionContext);
  }
  public BITXOR(): antlr.TerminalNode[];
  public BITXOR(i: number): antlr.TerminalNode | null;
  public BITXOR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.BITXOR);
    } else {
      return this.getToken(CNextParser.BITXOR, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_bitwiseXorExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterBitwiseXorExpression) {
      listener.enterBitwiseXorExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitBitwiseXorExpression) {
      listener.exitBitwiseXorExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitBitwiseXorExpression) {
      return visitor.visitBitwiseXorExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class BitwiseAndExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public shiftExpression(): ShiftExpressionContext[];
  public shiftExpression(i: number): ShiftExpressionContext | null;
  public shiftExpression(
    i?: number,
  ): ShiftExpressionContext[] | ShiftExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ShiftExpressionContext);
    }

    return this.getRuleContext(i, ShiftExpressionContext);
  }
  public BITAND(): antlr.TerminalNode[];
  public BITAND(i: number): antlr.TerminalNode | null;
  public BITAND(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.BITAND);
    } else {
      return this.getToken(CNextParser.BITAND, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_bitwiseAndExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterBitwiseAndExpression) {
      listener.enterBitwiseAndExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitBitwiseAndExpression) {
      listener.exitBitwiseAndExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitBitwiseAndExpression) {
      return visitor.visitBitwiseAndExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ShiftExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public additiveExpression(): AdditiveExpressionContext[];
  public additiveExpression(i: number): AdditiveExpressionContext | null;
  public additiveExpression(
    i?: number,
  ): AdditiveExpressionContext[] | AdditiveExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(AdditiveExpressionContext);
    }

    return this.getRuleContext(i, AdditiveExpressionContext);
  }
  public LSHIFT(): antlr.TerminalNode[];
  public LSHIFT(i: number): antlr.TerminalNode | null;
  public LSHIFT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.LSHIFT);
    } else {
      return this.getToken(CNextParser.LSHIFT, i);
    }
  }
  public RSHIFT(): antlr.TerminalNode[];
  public RSHIFT(i: number): antlr.TerminalNode | null;
  public RSHIFT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.RSHIFT);
    } else {
      return this.getToken(CNextParser.RSHIFT, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_shiftExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterShiftExpression) {
      listener.enterShiftExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitShiftExpression) {
      listener.exitShiftExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitShiftExpression) {
      return visitor.visitShiftExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class AdditiveExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public multiplicativeExpression(): MultiplicativeExpressionContext[];
  public multiplicativeExpression(
    i: number,
  ): MultiplicativeExpressionContext | null;
  public multiplicativeExpression(
    i?: number,
  ):
    | MultiplicativeExpressionContext[]
    | MultiplicativeExpressionContext
    | null {
    if (i === undefined) {
      return this.getRuleContexts(MultiplicativeExpressionContext);
    }

    return this.getRuleContext(i, MultiplicativeExpressionContext);
  }
  public PLUS(): antlr.TerminalNode[];
  public PLUS(i: number): antlr.TerminalNode | null;
  public PLUS(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.PLUS);
    } else {
      return this.getToken(CNextParser.PLUS, i);
    }
  }
  public MINUS(): antlr.TerminalNode[];
  public MINUS(i: number): antlr.TerminalNode | null;
  public MINUS(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.MINUS);
    } else {
      return this.getToken(CNextParser.MINUS, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_additiveExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterAdditiveExpression) {
      listener.enterAdditiveExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitAdditiveExpression) {
      listener.exitAdditiveExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitAdditiveExpression) {
      return visitor.visitAdditiveExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class MultiplicativeExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public unaryExpression(): UnaryExpressionContext[];
  public unaryExpression(i: number): UnaryExpressionContext | null;
  public unaryExpression(
    i?: number,
  ): UnaryExpressionContext[] | UnaryExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(UnaryExpressionContext);
    }

    return this.getRuleContext(i, UnaryExpressionContext);
  }
  public STAR(): antlr.TerminalNode[];
  public STAR(i: number): antlr.TerminalNode | null;
  public STAR(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.STAR);
    } else {
      return this.getToken(CNextParser.STAR, i);
    }
  }
  public SLASH(): antlr.TerminalNode[];
  public SLASH(i: number): antlr.TerminalNode | null;
  public SLASH(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.SLASH);
    } else {
      return this.getToken(CNextParser.SLASH, i);
    }
  }
  public PERCENT(): antlr.TerminalNode[];
  public PERCENT(i: number): antlr.TerminalNode | null;
  public PERCENT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.PERCENT);
    } else {
      return this.getToken(CNextParser.PERCENT, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_multiplicativeExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterMultiplicativeExpression) {
      listener.enterMultiplicativeExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitMultiplicativeExpression) {
      listener.exitMultiplicativeExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitMultiplicativeExpression) {
      return visitor.visitMultiplicativeExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class UnaryExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public NOT(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.NOT, 0);
  }
  public unaryExpression(): UnaryExpressionContext | null {
    return this.getRuleContext(0, UnaryExpressionContext);
  }
  public MINUS(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.MINUS, 0);
  }
  public BITNOT(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.BITNOT, 0);
  }
  public BITAND(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.BITAND, 0);
  }
  public postfixExpression(): PostfixExpressionContext | null {
    return this.getRuleContext(0, PostfixExpressionContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_unaryExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterUnaryExpression) {
      listener.enterUnaryExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitUnaryExpression) {
      listener.exitUnaryExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitUnaryExpression) {
      return visitor.visitUnaryExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class PostfixExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public primaryExpression(): PrimaryExpressionContext {
    return this.getRuleContext(0, PrimaryExpressionContext)!;
  }
  public postfixOp(): PostfixOpContext[];
  public postfixOp(i: number): PostfixOpContext | null;
  public postfixOp(i?: number): PostfixOpContext[] | PostfixOpContext | null {
    if (i === undefined) {
      return this.getRuleContexts(PostfixOpContext);
    }

    return this.getRuleContext(i, PostfixOpContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_postfixExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterPostfixExpression) {
      listener.enterPostfixExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitPostfixExpression) {
      listener.exitPostfixExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitPostfixExpression) {
      return visitor.visitPostfixExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class PostfixOpContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public DOT(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.DOT, 0);
  }
  public IDENTIFIER(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.IDENTIFIER, 0);
  }
  public LBRACKET(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.LBRACKET, 0);
  }
  public expression(): ExpressionContext[];
  public expression(i: number): ExpressionContext | null;
  public expression(
    i?: number,
  ): ExpressionContext[] | ExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ExpressionContext);
    }

    return this.getRuleContext(i, ExpressionContext);
  }
  public RBRACKET(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.RBRACKET, 0);
  }
  public COMMA(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.COMMA, 0);
  }
  public LPAREN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.LPAREN, 0);
  }
  public RPAREN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.RPAREN, 0);
  }
  public argumentList(): ArgumentListContext | null {
    return this.getRuleContext(0, ArgumentListContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_postfixOp;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterPostfixOp) {
      listener.enterPostfixOp(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitPostfixOp) {
      listener.exitPostfixOp(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitPostfixOp) {
      return visitor.visitPostfixOp(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class PrimaryExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public sizeofExpression(): SizeofExpressionContext | null {
    return this.getRuleContext(0, SizeofExpressionContext);
  }
  public castExpression(): CastExpressionContext | null {
    return this.getRuleContext(0, CastExpressionContext);
  }
  public structInitializer(): StructInitializerContext | null {
    return this.getRuleContext(0, StructInitializerContext);
  }
  public arrayInitializer(): ArrayInitializerContext | null {
    return this.getRuleContext(0, ArrayInitializerContext);
  }
  public THIS(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.THIS, 0);
  }
  public GLOBAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.GLOBAL, 0);
  }
  public IDENTIFIER(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.IDENTIFIER, 0);
  }
  public literal(): LiteralContext | null {
    return this.getRuleContext(0, LiteralContext);
  }
  public LPAREN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.LPAREN, 0);
  }
  public expression(): ExpressionContext | null {
    return this.getRuleContext(0, ExpressionContext);
  }
  public RPAREN(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.RPAREN, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_primaryExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterPrimaryExpression) {
      listener.enterPrimaryExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitPrimaryExpression) {
      listener.exitPrimaryExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitPrimaryExpression) {
      return visitor.visitPrimaryExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class SizeofExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public SIZEOF(): antlr.TerminalNode {
    return this.getToken(CNextParser.SIZEOF, 0)!;
  }
  public LPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.LPAREN, 0)!;
  }
  public RPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.RPAREN, 0)!;
  }
  public type(): TypeContext | null {
    return this.getRuleContext(0, TypeContext);
  }
  public expression(): ExpressionContext | null {
    return this.getRuleContext(0, ExpressionContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_sizeofExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterSizeofExpression) {
      listener.enterSizeofExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitSizeofExpression) {
      listener.exitSizeofExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitSizeofExpression) {
      return visitor.visitSizeofExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class CastExpressionContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public LPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.LPAREN, 0)!;
  }
  public type(): TypeContext {
    return this.getRuleContext(0, TypeContext)!;
  }
  public RPAREN(): antlr.TerminalNode {
    return this.getToken(CNextParser.RPAREN, 0)!;
  }
  public unaryExpression(): UnaryExpressionContext {
    return this.getRuleContext(0, UnaryExpressionContext)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_castExpression;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterCastExpression) {
      listener.enterCastExpression(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitCastExpression) {
      listener.exitCastExpression(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitCastExpression) {
      return visitor.visitCastExpression(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class StructInitializerContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IDENTIFIER(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.IDENTIFIER, 0);
  }
  public LBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.LBRACE, 0)!;
  }
  public RBRACE(): antlr.TerminalNode {
    return this.getToken(CNextParser.RBRACE, 0)!;
  }
  public fieldInitializerList(): FieldInitializerListContext | null {
    return this.getRuleContext(0, FieldInitializerListContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_structInitializer;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterStructInitializer) {
      listener.enterStructInitializer(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitStructInitializer) {
      listener.exitStructInitializer(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitStructInitializer) {
      return visitor.visitStructInitializer(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class FieldInitializerListContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public fieldInitializer(): FieldInitializerContext[];
  public fieldInitializer(i: number): FieldInitializerContext | null;
  public fieldInitializer(
    i?: number,
  ): FieldInitializerContext[] | FieldInitializerContext | null {
    if (i === undefined) {
      return this.getRuleContexts(FieldInitializerContext);
    }

    return this.getRuleContext(i, FieldInitializerContext);
  }
  public COMMA(): antlr.TerminalNode[];
  public COMMA(i: number): antlr.TerminalNode | null;
  public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.COMMA);
    } else {
      return this.getToken(CNextParser.COMMA, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_fieldInitializerList;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterFieldInitializerList) {
      listener.enterFieldInitializerList(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitFieldInitializerList) {
      listener.exitFieldInitializerList(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitFieldInitializerList) {
      return visitor.visitFieldInitializerList(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class FieldInitializerContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public COLON(): antlr.TerminalNode {
    return this.getToken(CNextParser.COLON, 0)!;
  }
  public expression(): ExpressionContext {
    return this.getRuleContext(0, ExpressionContext)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_fieldInitializer;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterFieldInitializer) {
      listener.enterFieldInitializer(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitFieldInitializer) {
      listener.exitFieldInitializer(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitFieldInitializer) {
      return visitor.visitFieldInitializer(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ArrayInitializerContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public LBRACKET(): antlr.TerminalNode {
    return this.getToken(CNextParser.LBRACKET, 0)!;
  }
  public arrayInitializerElement(): ArrayInitializerElementContext[];
  public arrayInitializerElement(
    i: number,
  ): ArrayInitializerElementContext | null;
  public arrayInitializerElement(
    i?: number,
  ): ArrayInitializerElementContext[] | ArrayInitializerElementContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ArrayInitializerElementContext);
    }

    return this.getRuleContext(i, ArrayInitializerElementContext);
  }
  public RBRACKET(): antlr.TerminalNode {
    return this.getToken(CNextParser.RBRACKET, 0)!;
  }
  public COMMA(): antlr.TerminalNode[];
  public COMMA(i: number): antlr.TerminalNode | null;
  public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.COMMA);
    } else {
      return this.getToken(CNextParser.COMMA, i);
    }
  }
  public expression(): ExpressionContext | null {
    return this.getRuleContext(0, ExpressionContext);
  }
  public STAR(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.STAR, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_arrayInitializer;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterArrayInitializer) {
      listener.enterArrayInitializer(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitArrayInitializer) {
      listener.exitArrayInitializer(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitArrayInitializer) {
      return visitor.visitArrayInitializer(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ArrayInitializerElementContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public expression(): ExpressionContext | null {
    return this.getRuleContext(0, ExpressionContext);
  }
  public structInitializer(): StructInitializerContext | null {
    return this.getRuleContext(0, StructInitializerContext);
  }
  public arrayInitializer(): ArrayInitializerContext | null {
    return this.getRuleContext(0, ArrayInitializerContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_arrayInitializerElement;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterArrayInitializerElement) {
      listener.enterArrayInitializerElement(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitArrayInitializerElement) {
      listener.exitArrayInitializerElement(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitArrayInitializerElement) {
      return visitor.visitArrayInitializerElement(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class MemberAccessContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IDENTIFIER(): antlr.TerminalNode[];
  public IDENTIFIER(i: number): antlr.TerminalNode | null;
  public IDENTIFIER(
    i?: number,
  ): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.IDENTIFIER);
    } else {
      return this.getToken(CNextParser.IDENTIFIER, i);
    }
  }
  public DOT(): antlr.TerminalNode[];
  public DOT(i: number): antlr.TerminalNode | null;
  public DOT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.DOT);
    } else {
      return this.getToken(CNextParser.DOT, i);
    }
  }
  public LBRACKET(): antlr.TerminalNode[];
  public LBRACKET(i: number): antlr.TerminalNode | null;
  public LBRACKET(
    i?: number,
  ): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.LBRACKET);
    } else {
      return this.getToken(CNextParser.LBRACKET, i);
    }
  }
  public expression(): ExpressionContext[];
  public expression(i: number): ExpressionContext | null;
  public expression(
    i?: number,
  ): ExpressionContext[] | ExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ExpressionContext);
    }

    return this.getRuleContext(i, ExpressionContext);
  }
  public RBRACKET(): antlr.TerminalNode[];
  public RBRACKET(i: number): antlr.TerminalNode | null;
  public RBRACKET(
    i?: number,
  ): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.RBRACKET);
    } else {
      return this.getToken(CNextParser.RBRACKET, i);
    }
  }
  public COMMA(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.COMMA, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_memberAccess;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterMemberAccess) {
      listener.enterMemberAccess(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitMemberAccess) {
      listener.exitMemberAccess(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitMemberAccess) {
      return visitor.visitMemberAccess(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ArrayAccessContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public LBRACKET(): antlr.TerminalNode {
    return this.getToken(CNextParser.LBRACKET, 0)!;
  }
  public expression(): ExpressionContext[];
  public expression(i: number): ExpressionContext | null;
  public expression(
    i?: number,
  ): ExpressionContext[] | ExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ExpressionContext);
    }

    return this.getRuleContext(i, ExpressionContext);
  }
  public RBRACKET(): antlr.TerminalNode {
    return this.getToken(CNextParser.RBRACKET, 0)!;
  }
  public COMMA(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.COMMA, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_arrayAccess;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterArrayAccess) {
      listener.enterArrayAccess(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitArrayAccess) {
      listener.exitArrayAccess(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitArrayAccess) {
      return visitor.visitArrayAccess(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ArgumentListContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public expression(): ExpressionContext[];
  public expression(i: number): ExpressionContext | null;
  public expression(
    i?: number,
  ): ExpressionContext[] | ExpressionContext | null {
    if (i === undefined) {
      return this.getRuleContexts(ExpressionContext);
    }

    return this.getRuleContext(i, ExpressionContext);
  }
  public COMMA(): antlr.TerminalNode[];
  public COMMA(i: number): antlr.TerminalNode | null;
  public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.COMMA);
    } else {
      return this.getToken(CNextParser.COMMA, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_argumentList;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterArgumentList) {
      listener.enterArgumentList(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitArgumentList) {
      listener.exitArgumentList(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitArgumentList) {
      return visitor.visitArgumentList(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class TypeContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public primitiveType(): PrimitiveTypeContext | null {
    return this.getRuleContext(0, PrimitiveTypeContext);
  }
  public stringType(): StringTypeContext | null {
    return this.getRuleContext(0, StringTypeContext);
  }
  public scopedType(): ScopedTypeContext | null {
    return this.getRuleContext(0, ScopedTypeContext);
  }
  public globalType(): GlobalTypeContext | null {
    return this.getRuleContext(0, GlobalTypeContext);
  }
  public qualifiedType(): QualifiedTypeContext | null {
    return this.getRuleContext(0, QualifiedTypeContext);
  }
  public templateType(): TemplateTypeContext | null {
    return this.getRuleContext(0, TemplateTypeContext);
  }
  public userType(): UserTypeContext | null {
    return this.getRuleContext(0, UserTypeContext);
  }
  public arrayType(): ArrayTypeContext | null {
    return this.getRuleContext(0, ArrayTypeContext);
  }
  public VOID(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.VOID, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_type;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterType) {
      listener.enterType(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitType) {
      listener.exitType(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitType) {
      return visitor.visitType(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ScopedTypeContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public THIS(): antlr.TerminalNode {
    return this.getToken(CNextParser.THIS, 0)!;
  }
  public DOT(): antlr.TerminalNode {
    return this.getToken(CNextParser.DOT, 0)!;
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_scopedType;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterScopedType) {
      listener.enterScopedType(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitScopedType) {
      listener.exitScopedType(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitScopedType) {
      return visitor.visitScopedType(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class GlobalTypeContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public GLOBAL(): antlr.TerminalNode {
    return this.getToken(CNextParser.GLOBAL, 0)!;
  }
  public DOT(): antlr.TerminalNode {
    return this.getToken(CNextParser.DOT, 0)!;
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_globalType;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterGlobalType) {
      listener.enterGlobalType(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitGlobalType) {
      listener.exitGlobalType(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitGlobalType) {
      return visitor.visitGlobalType(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class QualifiedTypeContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IDENTIFIER(): antlr.TerminalNode[];
  public IDENTIFIER(i: number): antlr.TerminalNode | null;
  public IDENTIFIER(
    i?: number,
  ): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.IDENTIFIER);
    } else {
      return this.getToken(CNextParser.IDENTIFIER, i);
    }
  }
  public DOT(): antlr.TerminalNode[];
  public DOT(i: number): antlr.TerminalNode | null;
  public DOT(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.DOT);
    } else {
      return this.getToken(CNextParser.DOT, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_qualifiedType;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterQualifiedType) {
      listener.enterQualifiedType(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitQualifiedType) {
      listener.exitQualifiedType(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitQualifiedType) {
      return visitor.visitQualifiedType(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class PrimitiveTypeContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public U8(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.U8, 0);
  }
  public U16(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.U16, 0);
  }
  public U32(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.U32, 0);
  }
  public U64(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.U64, 0);
  }
  public I8(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.I8, 0);
  }
  public I16(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.I16, 0);
  }
  public I32(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.I32, 0);
  }
  public I64(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.I64, 0);
  }
  public F32(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.F32, 0);
  }
  public F64(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.F64, 0);
  }
  public BOOL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.BOOL, 0);
  }
  public ISR_TYPE(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.ISR_TYPE, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_primitiveType;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterPrimitiveType) {
      listener.enterPrimitiveType(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitPrimitiveType) {
      listener.exitPrimitiveType(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitPrimitiveType) {
      return visitor.visitPrimitiveType(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class UserTypeContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_userType;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterUserType) {
      listener.enterUserType(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitUserType) {
      listener.exitUserType(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitUserType) {
      return visitor.visitUserType(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class TemplateTypeContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public IDENTIFIER(): antlr.TerminalNode {
    return this.getToken(CNextParser.IDENTIFIER, 0)!;
  }
  public LT(): antlr.TerminalNode {
    return this.getToken(CNextParser.LT, 0)!;
  }
  public templateArgumentList(): TemplateArgumentListContext {
    return this.getRuleContext(0, TemplateArgumentListContext)!;
  }
  public GT(): antlr.TerminalNode {
    return this.getToken(CNextParser.GT, 0)!;
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_templateType;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterTemplateType) {
      listener.enterTemplateType(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitTemplateType) {
      listener.exitTemplateType(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitTemplateType) {
      return visitor.visitTemplateType(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class TemplateArgumentListContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public templateArgument(): TemplateArgumentContext[];
  public templateArgument(i: number): TemplateArgumentContext | null;
  public templateArgument(
    i?: number,
  ): TemplateArgumentContext[] | TemplateArgumentContext | null {
    if (i === undefined) {
      return this.getRuleContexts(TemplateArgumentContext);
    }

    return this.getRuleContext(i, TemplateArgumentContext);
  }
  public COMMA(): antlr.TerminalNode[];
  public COMMA(i: number): antlr.TerminalNode | null;
  public COMMA(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    if (i === undefined) {
      return this.getTokens(CNextParser.COMMA);
    } else {
      return this.getToken(CNextParser.COMMA, i);
    }
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_templateArgumentList;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterTemplateArgumentList) {
      listener.enterTemplateArgumentList(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitTemplateArgumentList) {
      listener.exitTemplateArgumentList(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitTemplateArgumentList) {
      return visitor.visitTemplateArgumentList(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class TemplateArgumentContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public templateType(): TemplateTypeContext | null {
    return this.getRuleContext(0, TemplateTypeContext);
  }
  public primitiveType(): PrimitiveTypeContext | null {
    return this.getRuleContext(0, PrimitiveTypeContext);
  }
  public IDENTIFIER(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.IDENTIFIER, 0);
  }
  public INTEGER_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.INTEGER_LITERAL, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_templateArgument;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterTemplateArgument) {
      listener.enterTemplateArgument(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitTemplateArgument) {
      listener.exitTemplateArgument(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitTemplateArgument) {
      return visitor.visitTemplateArgument(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class StringTypeContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public STRING(): antlr.TerminalNode {
    return this.getToken(CNextParser.STRING, 0)!;
  }
  public LT(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.LT, 0);
  }
  public INTEGER_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.INTEGER_LITERAL, 0);
  }
  public GT(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.GT, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_stringType;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterStringType) {
      listener.enterStringType(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitStringType) {
      listener.exitStringType(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitStringType) {
      return visitor.visitStringType(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class ArrayTypeContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public primitiveType(): PrimitiveTypeContext | null {
    return this.getRuleContext(0, PrimitiveTypeContext);
  }
  public LBRACKET(): antlr.TerminalNode {
    return this.getToken(CNextParser.LBRACKET, 0)!;
  }
  public expression(): ExpressionContext {
    return this.getRuleContext(0, ExpressionContext)!;
  }
  public RBRACKET(): antlr.TerminalNode {
    return this.getToken(CNextParser.RBRACKET, 0)!;
  }
  public userType(): UserTypeContext | null {
    return this.getRuleContext(0, UserTypeContext);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_arrayType;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterArrayType) {
      listener.enterArrayType(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitArrayType) {
      listener.exitArrayType(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitArrayType) {
      return visitor.visitArrayType(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}

export class LiteralContext extends antlr.ParserRuleContext {
  public constructor(
    parent: antlr.ParserRuleContext | null,
    invokingState: number,
  ) {
    super(parent, invokingState);
  }
  public SUFFIXED_DECIMAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.SUFFIXED_DECIMAL, 0);
  }
  public SUFFIXED_HEX(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.SUFFIXED_HEX, 0);
  }
  public SUFFIXED_BINARY(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.SUFFIXED_BINARY, 0);
  }
  public SUFFIXED_FLOAT(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.SUFFIXED_FLOAT, 0);
  }
  public INTEGER_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.INTEGER_LITERAL, 0);
  }
  public HEX_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.HEX_LITERAL, 0);
  }
  public BINARY_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.BINARY_LITERAL, 0);
  }
  public FLOAT_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.FLOAT_LITERAL, 0);
  }
  public STRING_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.STRING_LITERAL, 0);
  }
  public CHAR_LITERAL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.CHAR_LITERAL, 0);
  }
  public TRUE(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.TRUE, 0);
  }
  public FALSE(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.FALSE, 0);
  }
  public C_NULL(): antlr.TerminalNode | null {
    return this.getToken(CNextParser.C_NULL, 0);
  }
  public override get ruleIndex(): number {
    return CNextParser.RULE_literal;
  }
  public override enterRule(listener: CNextListener): void {
    if (listener.enterLiteral) {
      listener.enterLiteral(this);
    }
  }
  public override exitRule(listener: CNextListener): void {
    if (listener.exitLiteral) {
      listener.exitLiteral(this);
    }
  }
  public override accept<Result>(visitor: CNextVisitor<Result>): Result | null {
    if (visitor.visitLiteral) {
      return visitor.visitLiteral(this);
    } else {
      return visitor.visitChildren(this);
    }
  }
}
