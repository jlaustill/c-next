// Generated from grammar/C.g4 by ANTLR 4.13.1

import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { CListener } from "./CListener.js";
import { CVisitor } from "./CVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;


export class CParser extends antlr.Parser {
    public static readonly T__0 = 1;
    public static readonly T__1 = 2;
    public static readonly T__2 = 3;
    public static readonly T__3 = 4;
    public static readonly T__4 = 5;
    public static readonly T__5 = 6;
    public static readonly T__6 = 7;
    public static readonly T__7 = 8;
    public static readonly T__8 = 9;
    public static readonly T__9 = 10;
    public static readonly T__10 = 11;
    public static readonly T__11 = 12;
    public static readonly T__12 = 13;
    public static readonly T__13 = 14;
    public static readonly T__14 = 15;
    public static readonly T__15 = 16;
    public static readonly T__16 = 17;
    public static readonly T__17 = 18;
    public static readonly T__18 = 19;
    public static readonly T__19 = 20;
    public static readonly T__20 = 21;
    public static readonly T__21 = 22;
    public static readonly T__22 = 23;
    public static readonly T__23 = 24;
    public static readonly T__24 = 25;
    public static readonly T__25 = 26;
    public static readonly T__26 = 27;
    public static readonly T__27 = 28;
    public static readonly T__28 = 29;
    public static readonly T__29 = 30;
    public static readonly T__30 = 31;
    public static readonly T__31 = 32;
    public static readonly T__32 = 33;
    public static readonly T__33 = 34;
    public static readonly Auto = 35;
    public static readonly Break = 36;
    public static readonly Case = 37;
    public static readonly Char = 38;
    public static readonly Const = 39;
    public static readonly Continue = 40;
    public static readonly Default = 41;
    public static readonly Do = 42;
    public static readonly Double = 43;
    public static readonly Else = 44;
    public static readonly Enum = 45;
    public static readonly Extern = 46;
    public static readonly Float = 47;
    public static readonly For = 48;
    public static readonly Goto = 49;
    public static readonly If = 50;
    public static readonly Inline = 51;
    public static readonly Int = 52;
    public static readonly Long = 53;
    public static readonly Register = 54;
    public static readonly Restrict = 55;
    public static readonly Return = 56;
    public static readonly Short = 57;
    public static readonly Signed = 58;
    public static readonly Sizeof = 59;
    public static readonly Static = 60;
    public static readonly Struct = 61;
    public static readonly Switch = 62;
    public static readonly Typedef = 63;
    public static readonly Union = 64;
    public static readonly Unsigned = 65;
    public static readonly Void = 66;
    public static readonly Volatile = 67;
    public static readonly While = 68;
    public static readonly Alignas = 69;
    public static readonly Alignof = 70;
    public static readonly Atomic = 71;
    public static readonly Bool = 72;
    public static readonly Complex = 73;
    public static readonly Generic = 74;
    public static readonly Imaginary = 75;
    public static readonly Noreturn = 76;
    public static readonly StaticAssert = 77;
    public static readonly ThreadLocal = 78;
    public static readonly LeftParen = 79;
    public static readonly RightParen = 80;
    public static readonly LeftBracket = 81;
    public static readonly RightBracket = 82;
    public static readonly LeftBrace = 83;
    public static readonly RightBrace = 84;
    public static readonly Less = 85;
    public static readonly LessEqual = 86;
    public static readonly Greater = 87;
    public static readonly GreaterEqual = 88;
    public static readonly LeftShift = 89;
    public static readonly RightShift = 90;
    public static readonly Plus = 91;
    public static readonly PlusPlus = 92;
    public static readonly Minus = 93;
    public static readonly MinusMinus = 94;
    public static readonly Star = 95;
    public static readonly Div = 96;
    public static readonly Mod = 97;
    public static readonly And = 98;
    public static readonly Or = 99;
    public static readonly AndAnd = 100;
    public static readonly OrOr = 101;
    public static readonly Caret = 102;
    public static readonly Not = 103;
    public static readonly Tilde = 104;
    public static readonly Question = 105;
    public static readonly Colon = 106;
    public static readonly Semi = 107;
    public static readonly Comma = 108;
    public static readonly Assign = 109;
    public static readonly StarAssign = 110;
    public static readonly DivAssign = 111;
    public static readonly ModAssign = 112;
    public static readonly PlusAssign = 113;
    public static readonly MinusAssign = 114;
    public static readonly LeftShiftAssign = 115;
    public static readonly RightShiftAssign = 116;
    public static readonly AndAssign = 117;
    public static readonly XorAssign = 118;
    public static readonly OrAssign = 119;
    public static readonly Equal = 120;
    public static readonly NotEqual = 121;
    public static readonly Arrow = 122;
    public static readonly Dot = 123;
    public static readonly Ellipsis = 124;
    public static readonly Identifier = 125;
    public static readonly Constant = 126;
    public static readonly DigitSequence = 127;
    public static readonly StringLiteral = 128;
    public static readonly MultiLineMacro = 129;
    public static readonly Directive = 130;
    public static readonly AsmBlock = 131;
    public static readonly Whitespace = 132;
    public static readonly Newline = 133;
    public static readonly BlockComment = 134;
    public static readonly LineComment = 135;
    public static readonly RULE_primaryExpression = 0;
    public static readonly RULE_genericSelection = 1;
    public static readonly RULE_genericAssocList = 2;
    public static readonly RULE_genericAssociation = 3;
    public static readonly RULE_postfixExpression = 4;
    public static readonly RULE_argumentExpressionList = 5;
    public static readonly RULE_unaryExpression = 6;
    public static readonly RULE_unaryOperator = 7;
    public static readonly RULE_castExpression = 8;
    public static readonly RULE_multiplicativeExpression = 9;
    public static readonly RULE_additiveExpression = 10;
    public static readonly RULE_shiftExpression = 11;
    public static readonly RULE_relationalExpression = 12;
    public static readonly RULE_equalityExpression = 13;
    public static readonly RULE_andExpression = 14;
    public static readonly RULE_exclusiveOrExpression = 15;
    public static readonly RULE_inclusiveOrExpression = 16;
    public static readonly RULE_logicalAndExpression = 17;
    public static readonly RULE_logicalOrExpression = 18;
    public static readonly RULE_conditionalExpression = 19;
    public static readonly RULE_assignmentExpression = 20;
    public static readonly RULE_assignmentOperator = 21;
    public static readonly RULE_expression = 22;
    public static readonly RULE_constantExpression = 23;
    public static readonly RULE_declaration = 24;
    public static readonly RULE_declarationSpecifiers = 25;
    public static readonly RULE_declarationSpecifiers2 = 26;
    public static readonly RULE_declarationSpecifier = 27;
    public static readonly RULE_initDeclaratorList = 28;
    public static readonly RULE_initDeclarator = 29;
    public static readonly RULE_storageClassSpecifier = 30;
    public static readonly RULE_typeSpecifier = 31;
    public static readonly RULE_structOrUnionSpecifier = 32;
    public static readonly RULE_structOrUnion = 33;
    public static readonly RULE_structDeclarationList = 34;
    public static readonly RULE_structDeclaration = 35;
    public static readonly RULE_specifierQualifierList = 36;
    public static readonly RULE_structDeclaratorList = 37;
    public static readonly RULE_structDeclarator = 38;
    public static readonly RULE_enumSpecifier = 39;
    public static readonly RULE_enumeratorList = 40;
    public static readonly RULE_enumerator = 41;
    public static readonly RULE_enumerationConstant = 42;
    public static readonly RULE_atomicTypeSpecifier = 43;
    public static readonly RULE_typeQualifier = 44;
    public static readonly RULE_functionSpecifier = 45;
    public static readonly RULE_alignmentSpecifier = 46;
    public static readonly RULE_declarator = 47;
    public static readonly RULE_directDeclarator = 48;
    public static readonly RULE_vcSpecificModifer = 49;
    public static readonly RULE_gccDeclaratorExtension = 50;
    public static readonly RULE_gccAttributeSpecifier = 51;
    public static readonly RULE_gccAttributeList = 52;
    public static readonly RULE_gccAttribute = 53;
    public static readonly RULE_pointer = 54;
    public static readonly RULE_typeQualifierList = 55;
    public static readonly RULE_parameterTypeList = 56;
    public static readonly RULE_parameterList = 57;
    public static readonly RULE_parameterDeclaration = 58;
    public static readonly RULE_identifierList = 59;
    public static readonly RULE_typeName = 60;
    public static readonly RULE_abstractDeclarator = 61;
    public static readonly RULE_directAbstractDeclarator = 62;
    public static readonly RULE_typedefName = 63;
    public static readonly RULE_initializer = 64;
    public static readonly RULE_initializerList = 65;
    public static readonly RULE_designation = 66;
    public static readonly RULE_designatorList = 67;
    public static readonly RULE_designator = 68;
    public static readonly RULE_staticAssertDeclaration = 69;
    public static readonly RULE_statement = 70;
    public static readonly RULE_labeledStatement = 71;
    public static readonly RULE_compoundStatement = 72;
    public static readonly RULE_blockItemList = 73;
    public static readonly RULE_blockItem = 74;
    public static readonly RULE_expressionStatement = 75;
    public static readonly RULE_selectionStatement = 76;
    public static readonly RULE_iterationStatement = 77;
    public static readonly RULE_forCondition = 78;
    public static readonly RULE_forDeclaration = 79;
    public static readonly RULE_forExpression = 80;
    public static readonly RULE_jumpStatement = 81;
    public static readonly RULE_compilationUnit = 82;
    public static readonly RULE_translationUnit = 83;
    public static readonly RULE_externalDeclaration = 84;
    public static readonly RULE_functionDefinition = 85;
    public static readonly RULE_declarationList = 86;

    public static readonly literalNames = [
        null, "'__extension__'", "'__builtin_va_arg'", "'__builtin_offsetof'", 
        "'__alignof__'", "'__alignof'", "'__thread'", "'__signed'", "'__signed__'", 
        "'__m128'", "'__m128d'", "'__m128i'", "'__int128'", "'__int128_t'", 
        "'__uint128_t'", "'__typeof__'", "'__typeof'", "'__const'", "'__const__'", 
        "'__restrict'", "'__restrict__'", "'__volatile'", "'__volatile__'", 
        "'__inline'", "'__inline__'", "'__stdcall'", "'__declspec'", "'__cdecl'", 
        "'__clrcall'", "'__fastcall'", "'__thiscall'", "'__vectorcall'", 
        "'__asm'", "'__asm__'", "'__attribute__'", "'auto'", "'break'", 
        "'case'", "'char'", "'const'", "'continue'", "'default'", "'do'", 
        "'double'", "'else'", "'enum'", "'extern'", "'float'", "'for'", 
        "'goto'", "'if'", "'inline'", "'int'", "'long'", "'register'", "'restrict'", 
        "'return'", "'short'", "'signed'", "'sizeof'", "'static'", "'struct'", 
        "'switch'", "'typedef'", "'union'", "'unsigned'", "'void'", "'volatile'", 
        "'while'", "'_Alignas'", "'_Alignof'", "'_Atomic'", "'_Bool'", "'_Complex'", 
        "'_Generic'", "'_Imaginary'", "'_Noreturn'", "'_Static_assert'", 
        "'_Thread_local'", "'('", "')'", "'['", "']'", "'{'", "'}'", "'<'", 
        "'<='", "'>'", "'>='", "'<<'", "'>>'", "'+'", "'++'", "'-'", "'--'", 
        "'*'", "'/'", "'%'", "'&'", "'|'", "'&&'", "'||'", "'^'", "'!'", 
        "'~'", "'?'", "':'", "';'", "','", "'='", "'*='", "'/='", "'%='", 
        "'+='", "'-='", "'<<='", "'>>='", "'&='", "'^='", "'|='", "'=='", 
        "'!='", "'->'", "'.'", "'...'"
    ];

    public static readonly symbolicNames = [
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, null, null, null, null, null, null, null, null, null, 
        null, null, "Auto", "Break", "Case", "Char", "Const", "Continue", 
        "Default", "Do", "Double", "Else", "Enum", "Extern", "Float", "For", 
        "Goto", "If", "Inline", "Int", "Long", "Register", "Restrict", "Return", 
        "Short", "Signed", "Sizeof", "Static", "Struct", "Switch", "Typedef", 
        "Union", "Unsigned", "Void", "Volatile", "While", "Alignas", "Alignof", 
        "Atomic", "Bool", "Complex", "Generic", "Imaginary", "Noreturn", 
        "StaticAssert", "ThreadLocal", "LeftParen", "RightParen", "LeftBracket", 
        "RightBracket", "LeftBrace", "RightBrace", "Less", "LessEqual", 
        "Greater", "GreaterEqual", "LeftShift", "RightShift", "Plus", "PlusPlus", 
        "Minus", "MinusMinus", "Star", "Div", "Mod", "And", "Or", "AndAnd", 
        "OrOr", "Caret", "Not", "Tilde", "Question", "Colon", "Semi", "Comma", 
        "Assign", "StarAssign", "DivAssign", "ModAssign", "PlusAssign", 
        "MinusAssign", "LeftShiftAssign", "RightShiftAssign", "AndAssign", 
        "XorAssign", "OrAssign", "Equal", "NotEqual", "Arrow", "Dot", "Ellipsis", 
        "Identifier", "Constant", "DigitSequence", "StringLiteral", "MultiLineMacro", 
        "Directive", "AsmBlock", "Whitespace", "Newline", "BlockComment", 
        "LineComment"
    ];
    public static readonly ruleNames = [
        "primaryExpression", "genericSelection", "genericAssocList", "genericAssociation", 
        "postfixExpression", "argumentExpressionList", "unaryExpression", 
        "unaryOperator", "castExpression", "multiplicativeExpression", "additiveExpression", 
        "shiftExpression", "relationalExpression", "equalityExpression", 
        "andExpression", "exclusiveOrExpression", "inclusiveOrExpression", 
        "logicalAndExpression", "logicalOrExpression", "conditionalExpression", 
        "assignmentExpression", "assignmentOperator", "expression", "constantExpression", 
        "declaration", "declarationSpecifiers", "declarationSpecifiers2", 
        "declarationSpecifier", "initDeclaratorList", "initDeclarator", 
        "storageClassSpecifier", "typeSpecifier", "structOrUnionSpecifier", 
        "structOrUnion", "structDeclarationList", "structDeclaration", "specifierQualifierList", 
        "structDeclaratorList", "structDeclarator", "enumSpecifier", "enumeratorList", 
        "enumerator", "enumerationConstant", "atomicTypeSpecifier", "typeQualifier", 
        "functionSpecifier", "alignmentSpecifier", "declarator", "directDeclarator", 
        "vcSpecificModifer", "gccDeclaratorExtension", "gccAttributeSpecifier", 
        "gccAttributeList", "gccAttribute", "pointer", "typeQualifierList", 
        "parameterTypeList", "parameterList", "parameterDeclaration", "identifierList", 
        "typeName", "abstractDeclarator", "directAbstractDeclarator", "typedefName", 
        "initializer", "initializerList", "designation", "designatorList", 
        "designator", "staticAssertDeclaration", "statement", "labeledStatement", 
        "compoundStatement", "blockItemList", "blockItem", "expressionStatement", 
        "selectionStatement", "iterationStatement", "forCondition", "forDeclaration", 
        "forExpression", "jumpStatement", "compilationUnit", "translationUnit", 
        "externalDeclaration", "functionDefinition", "declarationList",
    ];

    public get grammarFileName(): string { return "C.g4"; }
    public get literalNames(): (string | null)[] { return CParser.literalNames; }
    public get symbolicNames(): (string | null)[] { return CParser.symbolicNames; }
    public get ruleNames(): string[] { return CParser.ruleNames; }
    public get serializedATN(): number[] { return CParser._serializedATN; }

    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException {
        return new antlr.FailedPredicateException(this, predicate, message);
    }

    public constructor(input: antlr.TokenStream) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, CParser._ATN, CParser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    public primaryExpression(): PrimaryExpressionContext {
        let localContext = new PrimaryExpressionContext(this.context, this.state);
        this.enterRule(localContext, 0, CParser.RULE_primaryExpression);
        let _la: number;
        try {
            this.state = 207;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 2, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 174;
                this.match(CParser.Identifier);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 175;
                this.match(CParser.Constant);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 177;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 176;
                    this.match(CParser.StringLiteral);
                    }
                    }
                    this.state = 179;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 128);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 181;
                this.match(CParser.LeftParen);
                this.state = 182;
                this.expression();
                this.state = 183;
                this.match(CParser.RightParen);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 185;
                this.genericSelection();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 187;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 1) {
                    {
                    this.state = 186;
                    this.match(CParser.T__0);
                    }
                }

                this.state = 189;
                this.match(CParser.LeftParen);
                this.state = 190;
                this.compoundStatement();
                this.state = 191;
                this.match(CParser.RightParen);
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 193;
                this.match(CParser.T__1);
                this.state = 194;
                this.match(CParser.LeftParen);
                this.state = 195;
                this.unaryExpression();
                this.state = 196;
                this.match(CParser.Comma);
                this.state = 197;
                this.typeName();
                this.state = 198;
                this.match(CParser.RightParen);
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 200;
                this.match(CParser.T__2);
                this.state = 201;
                this.match(CParser.LeftParen);
                this.state = 202;
                this.typeName();
                this.state = 203;
                this.match(CParser.Comma);
                this.state = 204;
                this.unaryExpression();
                this.state = 205;
                this.match(CParser.RightParen);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public genericSelection(): GenericSelectionContext {
        let localContext = new GenericSelectionContext(this.context, this.state);
        this.enterRule(localContext, 2, CParser.RULE_genericSelection);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 209;
            this.match(CParser.Generic);
            this.state = 210;
            this.match(CParser.LeftParen);
            this.state = 211;
            this.assignmentExpression();
            this.state = 212;
            this.match(CParser.Comma);
            this.state = 213;
            this.genericAssocList();
            this.state = 214;
            this.match(CParser.RightParen);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public genericAssocList(): GenericAssocListContext {
        let localContext = new GenericAssocListContext(this.context, this.state);
        this.enterRule(localContext, 4, CParser.RULE_genericAssocList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 216;
            this.genericAssociation();
            this.state = 221;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 108) {
                {
                {
                this.state = 217;
                this.match(CParser.Comma);
                this.state = 218;
                this.genericAssociation();
                }
                }
                this.state = 223;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public genericAssociation(): GenericAssociationContext {
        let localContext = new GenericAssociationContext(this.context, this.state);
        this.enterRule(localContext, 6, CParser.RULE_genericAssociation);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 226;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CParser.T__0:
            case CParser.T__6:
            case CParser.T__7:
            case CParser.T__8:
            case CParser.T__9:
            case CParser.T__10:
            case CParser.T__11:
            case CParser.T__12:
            case CParser.T__13:
            case CParser.T__14:
            case CParser.T__15:
            case CParser.T__16:
            case CParser.T__17:
            case CParser.T__18:
            case CParser.T__19:
            case CParser.T__20:
            case CParser.T__21:
            case CParser.Char:
            case CParser.Const:
            case CParser.Double:
            case CParser.Enum:
            case CParser.Float:
            case CParser.Int:
            case CParser.Long:
            case CParser.Restrict:
            case CParser.Short:
            case CParser.Signed:
            case CParser.Struct:
            case CParser.Union:
            case CParser.Unsigned:
            case CParser.Void:
            case CParser.Volatile:
            case CParser.Atomic:
            case CParser.Bool:
            case CParser.Complex:
            case CParser.Identifier:
                {
                this.state = 224;
                this.typeName();
                }
                break;
            case CParser.Default:
                {
                this.state = 225;
                this.match(CParser.Default);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.state = 228;
            this.match(CParser.Colon);
            this.state = 229;
            this.assignmentExpression();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public postfixExpression(): PostfixExpressionContext {
        let localContext = new PostfixExpressionContext(this.context, this.state);
        this.enterRule(localContext, 8, CParser.RULE_postfixExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 245;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 7, this.context) ) {
            case 1:
                {
                this.state = 231;
                this.primaryExpression();
                }
                break;
            case 2:
                {
                this.state = 233;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 1) {
                    {
                    this.state = 232;
                    this.match(CParser.T__0);
                    }
                }

                this.state = 235;
                this.match(CParser.LeftParen);
                this.state = 236;
                this.typeName();
                this.state = 237;
                this.match(CParser.RightParen);
                this.state = 238;
                this.match(CParser.LeftBrace);
                this.state = 239;
                this.initializerList();
                this.state = 241;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 108) {
                    {
                    this.state = 240;
                    this.match(CParser.Comma);
                    }
                }

                this.state = 243;
                this.match(CParser.RightBrace);
                }
                break;
            }
            this.state = 262;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (((((_la - 79)) & ~0x1F) === 0 && ((1 << (_la - 79)) & 40965) !== 0) || _la === 122 || _la === 123) {
                {
                this.state = 260;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case CParser.LeftBracket:
                    {
                    this.state = 247;
                    this.match(CParser.LeftBracket);
                    this.state = 248;
                    this.expression();
                    this.state = 249;
                    this.match(CParser.RightBracket);
                    }
                    break;
                case CParser.LeftParen:
                    {
                    this.state = 251;
                    this.match(CParser.LeftParen);
                    this.state = 253;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 62) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 1083393) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12959) !== 0) || ((((_la - 125)) & ~0x1F) === 0 && ((1 << (_la - 125)) & 15) !== 0)) {
                        {
                        this.state = 252;
                        this.argumentExpressionList();
                        }
                    }

                    this.state = 255;
                    this.match(CParser.RightParen);
                    }
                    break;
                case CParser.Arrow:
                case CParser.Dot:
                    {
                    this.state = 256;
                    _la = this.tokenStream.LA(1);
                    if(!(_la === 122 || _la === 123)) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    this.state = 257;
                    this.match(CParser.Identifier);
                    }
                    break;
                case CParser.PlusPlus:
                    {
                    this.state = 258;
                    this.match(CParser.PlusPlus);
                    }
                    break;
                case CParser.MinusMinus:
                    {
                    this.state = 259;
                    this.match(CParser.MinusMinus);
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                this.state = 264;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public argumentExpressionList(): ArgumentExpressionListContext {
        let localContext = new ArgumentExpressionListContext(this.context, this.state);
        this.enterRule(localContext, 10, CParser.RULE_argumentExpressionList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 265;
            this.assignmentExpression();
            this.state = 270;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 108) {
                {
                {
                this.state = 266;
                this.match(CParser.Comma);
                this.state = 267;
                this.assignmentExpression();
                }
                }
                this.state = 272;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public unaryExpression(): UnaryExpressionContext {
        let localContext = new UnaryExpressionContext(this.context, this.state);
        this.enterRule(localContext, 12, CParser.RULE_unaryExpression);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 276;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 12, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 273;
                    _la = this.tokenStream.LA(1);
                    if(!(_la === 59 || _la === 92 || _la === 94)) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    }
                    }
                }
                this.state = 278;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 12, this.context);
            }
            this.state = 290;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CParser.T__0:
            case CParser.T__1:
            case CParser.T__2:
            case CParser.Generic:
            case CParser.LeftParen:
            case CParser.Identifier:
            case CParser.Constant:
            case CParser.StringLiteral:
                {
                this.state = 279;
                this.postfixExpression();
                }
                break;
            case CParser.Plus:
            case CParser.Minus:
            case CParser.Star:
            case CParser.And:
            case CParser.Not:
            case CParser.Tilde:
                {
                this.state = 280;
                this.unaryOperator();
                this.state = 281;
                this.castExpression();
                }
                break;
            case CParser.T__3:
            case CParser.T__4:
            case CParser.Sizeof:
            case CParser.Alignof:
                {
                this.state = 283;
                _la = this.tokenStream.LA(1);
                if(!(_la === 4 || _la === 5 || _la === 59 || _la === 70)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 284;
                this.match(CParser.LeftParen);
                this.state = 285;
                this.typeName();
                this.state = 286;
                this.match(CParser.RightParen);
                }
                break;
            case CParser.AndAnd:
                {
                this.state = 288;
                this.match(CParser.AndAnd);
                this.state = 289;
                this.match(CParser.Identifier);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public unaryOperator(): UnaryOperatorContext {
        let localContext = new UnaryOperatorContext(this.context, this.state);
        this.enterRule(localContext, 14, CParser.RULE_unaryOperator);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 292;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12437) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public castExpression(): CastExpressionContext {
        let localContext = new CastExpressionContext(this.context, this.state);
        this.enterRule(localContext, 16, CParser.RULE_castExpression);
        let _la: number;
        try {
            this.state = 304;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 15, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 295;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 1) {
                    {
                    this.state = 294;
                    this.match(CParser.T__0);
                    }
                }

                this.state = 297;
                this.match(CParser.LeftParen);
                this.state = 298;
                this.typeName();
                this.state = 299;
                this.match(CParser.RightParen);
                this.state = 300;
                this.castExpression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 302;
                this.unaryExpression();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 303;
                this.match(CParser.DigitSequence);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public multiplicativeExpression(): MultiplicativeExpressionContext {
        let localContext = new MultiplicativeExpressionContext(this.context, this.state);
        this.enterRule(localContext, 18, CParser.RULE_multiplicativeExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 306;
            this.castExpression();
            this.state = 311;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (((((_la - 95)) & ~0x1F) === 0 && ((1 << (_la - 95)) & 7) !== 0)) {
                {
                {
                this.state = 307;
                _la = this.tokenStream.LA(1);
                if(!(((((_la - 95)) & ~0x1F) === 0 && ((1 << (_la - 95)) & 7) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 308;
                this.castExpression();
                }
                }
                this.state = 313;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public additiveExpression(): AdditiveExpressionContext {
        let localContext = new AdditiveExpressionContext(this.context, this.state);
        this.enterRule(localContext, 20, CParser.RULE_additiveExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 314;
            this.multiplicativeExpression();
            this.state = 319;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 91 || _la === 93) {
                {
                {
                this.state = 315;
                _la = this.tokenStream.LA(1);
                if(!(_la === 91 || _la === 93)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 316;
                this.multiplicativeExpression();
                }
                }
                this.state = 321;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public shiftExpression(): ShiftExpressionContext {
        let localContext = new ShiftExpressionContext(this.context, this.state);
        this.enterRule(localContext, 22, CParser.RULE_shiftExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 322;
            this.additiveExpression();
            this.state = 327;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 89 || _la === 90) {
                {
                {
                this.state = 323;
                _la = this.tokenStream.LA(1);
                if(!(_la === 89 || _la === 90)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 324;
                this.additiveExpression();
                }
                }
                this.state = 329;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public relationalExpression(): RelationalExpressionContext {
        let localContext = new RelationalExpressionContext(this.context, this.state);
        this.enterRule(localContext, 24, CParser.RULE_relationalExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 330;
            this.shiftExpression();
            this.state = 335;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 15) !== 0)) {
                {
                {
                this.state = 331;
                _la = this.tokenStream.LA(1);
                if(!(((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 15) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 332;
                this.shiftExpression();
                }
                }
                this.state = 337;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public equalityExpression(): EqualityExpressionContext {
        let localContext = new EqualityExpressionContext(this.context, this.state);
        this.enterRule(localContext, 26, CParser.RULE_equalityExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 338;
            this.relationalExpression();
            this.state = 343;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 120 || _la === 121) {
                {
                {
                this.state = 339;
                _la = this.tokenStream.LA(1);
                if(!(_la === 120 || _la === 121)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 340;
                this.relationalExpression();
                }
                }
                this.state = 345;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public andExpression(): AndExpressionContext {
        let localContext = new AndExpressionContext(this.context, this.state);
        this.enterRule(localContext, 28, CParser.RULE_andExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 346;
            this.equalityExpression();
            this.state = 351;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 98) {
                {
                {
                this.state = 347;
                this.match(CParser.And);
                this.state = 348;
                this.equalityExpression();
                }
                }
                this.state = 353;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public exclusiveOrExpression(): ExclusiveOrExpressionContext {
        let localContext = new ExclusiveOrExpressionContext(this.context, this.state);
        this.enterRule(localContext, 30, CParser.RULE_exclusiveOrExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 354;
            this.andExpression();
            this.state = 359;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 102) {
                {
                {
                this.state = 355;
                this.match(CParser.Caret);
                this.state = 356;
                this.andExpression();
                }
                }
                this.state = 361;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public inclusiveOrExpression(): InclusiveOrExpressionContext {
        let localContext = new InclusiveOrExpressionContext(this.context, this.state);
        this.enterRule(localContext, 32, CParser.RULE_inclusiveOrExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 362;
            this.exclusiveOrExpression();
            this.state = 367;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 99) {
                {
                {
                this.state = 363;
                this.match(CParser.Or);
                this.state = 364;
                this.exclusiveOrExpression();
                }
                }
                this.state = 369;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public logicalAndExpression(): LogicalAndExpressionContext {
        let localContext = new LogicalAndExpressionContext(this.context, this.state);
        this.enterRule(localContext, 34, CParser.RULE_logicalAndExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 370;
            this.inclusiveOrExpression();
            this.state = 375;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 100) {
                {
                {
                this.state = 371;
                this.match(CParser.AndAnd);
                this.state = 372;
                this.inclusiveOrExpression();
                }
                }
                this.state = 377;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public logicalOrExpression(): LogicalOrExpressionContext {
        let localContext = new LogicalOrExpressionContext(this.context, this.state);
        this.enterRule(localContext, 36, CParser.RULE_logicalOrExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 378;
            this.logicalAndExpression();
            this.state = 383;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 101) {
                {
                {
                this.state = 379;
                this.match(CParser.OrOr);
                this.state = 380;
                this.logicalAndExpression();
                }
                }
                this.state = 385;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public conditionalExpression(): ConditionalExpressionContext {
        let localContext = new ConditionalExpressionContext(this.context, this.state);
        this.enterRule(localContext, 38, CParser.RULE_conditionalExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 386;
            this.logicalOrExpression();
            this.state = 392;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 105) {
                {
                this.state = 387;
                this.match(CParser.Question);
                this.state = 388;
                this.expression();
                this.state = 389;
                this.match(CParser.Colon);
                this.state = 390;
                this.conditionalExpression();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public assignmentExpression(): AssignmentExpressionContext {
        let localContext = new AssignmentExpressionContext(this.context, this.state);
        this.enterRule(localContext, 40, CParser.RULE_assignmentExpression);
        try {
            this.state = 400;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 27, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 394;
                this.conditionalExpression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 395;
                this.unaryExpression();
                this.state = 396;
                this.assignmentOperator();
                this.state = 397;
                this.assignmentExpression();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 399;
                this.match(CParser.DigitSequence);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public assignmentOperator(): AssignmentOperatorContext {
        let localContext = new AssignmentOperatorContext(this.context, this.state);
        this.enterRule(localContext, 42, CParser.RULE_assignmentOperator);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 402;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 109)) & ~0x1F) === 0 && ((1 << (_la - 109)) & 2047) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expression(): ExpressionContext {
        let localContext = new ExpressionContext(this.context, this.state);
        this.enterRule(localContext, 44, CParser.RULE_expression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 404;
            this.assignmentExpression();
            this.state = 409;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 108) {
                {
                {
                this.state = 405;
                this.match(CParser.Comma);
                this.state = 406;
                this.assignmentExpression();
                }
                }
                this.state = 411;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public constantExpression(): ConstantExpressionContext {
        let localContext = new ConstantExpressionContext(this.context, this.state);
        this.enterRule(localContext, 46, CParser.RULE_constantExpression);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 412;
            this.conditionalExpression();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public declaration(): DeclarationContext {
        let localContext = new DeclarationContext(this.context, this.state);
        this.enterRule(localContext, 48, CParser.RULE_declaration);
        let _la: number;
        try {
            this.state = 421;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CParser.T__0:
            case CParser.T__5:
            case CParser.T__6:
            case CParser.T__7:
            case CParser.T__8:
            case CParser.T__9:
            case CParser.T__10:
            case CParser.T__11:
            case CParser.T__12:
            case CParser.T__13:
            case CParser.T__14:
            case CParser.T__15:
            case CParser.T__16:
            case CParser.T__17:
            case CParser.T__18:
            case CParser.T__19:
            case CParser.T__20:
            case CParser.T__21:
            case CParser.T__22:
            case CParser.T__23:
            case CParser.T__24:
            case CParser.T__25:
            case CParser.T__33:
            case CParser.Auto:
            case CParser.Char:
            case CParser.Const:
            case CParser.Double:
            case CParser.Enum:
            case CParser.Extern:
            case CParser.Float:
            case CParser.Inline:
            case CParser.Int:
            case CParser.Long:
            case CParser.Register:
            case CParser.Restrict:
            case CParser.Short:
            case CParser.Signed:
            case CParser.Static:
            case CParser.Struct:
            case CParser.Typedef:
            case CParser.Union:
            case CParser.Unsigned:
            case CParser.Void:
            case CParser.Volatile:
            case CParser.Alignas:
            case CParser.Atomic:
            case CParser.Bool:
            case CParser.Complex:
            case CParser.Noreturn:
            case CParser.ThreadLocal:
            case CParser.Identifier:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 414;
                this.declarationSpecifiers();
                this.state = 416;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4194304000) !== 0) || ((((_la - 79)) & ~0x1F) === 0 && ((1 << (_la - 79)) & 8454145) !== 0) || _la === 125) {
                    {
                    this.state = 415;
                    this.initDeclaratorList();
                    }
                }

                this.state = 418;
                this.match(CParser.Semi);
                }
                break;
            case CParser.StaticAssert:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 420;
                this.staticAssertDeclaration();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public declarationSpecifiers(): DeclarationSpecifiersContext {
        let localContext = new DeclarationSpecifiersContext(this.context, this.state);
        this.enterRule(localContext, 50, CParser.RULE_declarationSpecifiers);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 424;
            this.errorHandler.sync(this);
            alternative = 1;
            do {
                switch (alternative) {
                case 1:
                    {
                    {
                    this.state = 423;
                    this.declarationSpecifier();
                    }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 426;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 31, this.context);
            } while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public declarationSpecifiers2(): DeclarationSpecifiers2Context {
        let localContext = new DeclarationSpecifiers2Context(this.context, this.state);
        this.enterRule(localContext, 52, CParser.RULE_declarationSpecifiers2);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 429;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 428;
                this.declarationSpecifier();
                }
                }
                this.state = 431;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134217666) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 3988666931) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 5355) !== 0) || _la === 125);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public declarationSpecifier(): DeclarationSpecifierContext {
        let localContext = new DeclarationSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 54, CParser.RULE_declarationSpecifier);
        try {
            this.state = 438;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 33, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 433;
                this.storageClassSpecifier();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 434;
                this.typeSpecifier();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 435;
                this.typeQualifier();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 436;
                this.functionSpecifier();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 437;
                this.alignmentSpecifier();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public initDeclaratorList(): InitDeclaratorListContext {
        let localContext = new InitDeclaratorListContext(this.context, this.state);
        this.enterRule(localContext, 56, CParser.RULE_initDeclaratorList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 440;
            this.initDeclarator();
            this.state = 445;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 108) {
                {
                {
                this.state = 441;
                this.match(CParser.Comma);
                this.state = 442;
                this.initDeclarator();
                }
                }
                this.state = 447;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public initDeclarator(): InitDeclaratorContext {
        let localContext = new InitDeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 58, CParser.RULE_initDeclarator);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 448;
            this.declarator();
            this.state = 451;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 109) {
                {
                this.state = 449;
                this.match(CParser.Assign);
                this.state = 450;
                this.initializer();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public storageClassSpecifier(): StorageClassSpecifierContext {
        let localContext = new StorageClassSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 60, CParser.RULE_storageClassSpecifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 453;
            _la = this.tokenStream.LA(1);
            if(!(_la === 6 || ((((_la - 35)) & ~0x1F) === 0 && ((1 << (_la - 35)) & 302516225) !== 0) || _la === 78)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public typeSpecifier(): TypeSpecifierContext {
        let localContext = new TypeSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 62, CParser.RULE_typeSpecifier);
        let _la: number;
        try {
            this.state = 487;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CParser.Void:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 455;
                this.match(CParser.Void);
                }
                break;
            case CParser.Char:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 456;
                this.match(CParser.Char);
                }
                break;
            case CParser.Short:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 457;
                this.match(CParser.Short);
                }
                break;
            case CParser.Int:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 458;
                this.match(CParser.Int);
                }
                break;
            case CParser.Long:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 459;
                this.match(CParser.Long);
                }
                break;
            case CParser.Float:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 460;
                this.match(CParser.Float);
                }
                break;
            case CParser.Double:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 461;
                this.match(CParser.Double);
                }
                break;
            case CParser.Signed:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 462;
                this.match(CParser.Signed);
                }
                break;
            case CParser.T__6:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 463;
                this.match(CParser.T__6);
                }
                break;
            case CParser.T__7:
                this.enterOuterAlt(localContext, 10);
                {
                this.state = 464;
                this.match(CParser.T__7);
                }
                break;
            case CParser.Unsigned:
                this.enterOuterAlt(localContext, 11);
                {
                this.state = 465;
                this.match(CParser.Unsigned);
                }
                break;
            case CParser.Bool:
                this.enterOuterAlt(localContext, 12);
                {
                this.state = 466;
                this.match(CParser.Bool);
                }
                break;
            case CParser.Complex:
                this.enterOuterAlt(localContext, 13);
                {
                this.state = 467;
                this.match(CParser.Complex);
                }
                break;
            case CParser.T__8:
                this.enterOuterAlt(localContext, 14);
                {
                this.state = 468;
                this.match(CParser.T__8);
                }
                break;
            case CParser.T__9:
                this.enterOuterAlt(localContext, 15);
                {
                this.state = 469;
                this.match(CParser.T__9);
                }
                break;
            case CParser.T__10:
                this.enterOuterAlt(localContext, 16);
                {
                this.state = 470;
                this.match(CParser.T__10);
                }
                break;
            case CParser.T__11:
                this.enterOuterAlt(localContext, 17);
                {
                this.state = 471;
                this.match(CParser.T__11);
                }
                break;
            case CParser.T__12:
                this.enterOuterAlt(localContext, 18);
                {
                this.state = 472;
                this.match(CParser.T__12);
                }
                break;
            case CParser.T__13:
                this.enterOuterAlt(localContext, 19);
                {
                this.state = 473;
                this.match(CParser.T__13);
                }
                break;
            case CParser.T__0:
                this.enterOuterAlt(localContext, 20);
                {
                this.state = 474;
                this.match(CParser.T__0);
                this.state = 475;
                this.match(CParser.LeftParen);
                this.state = 476;
                _la = this.tokenStream.LA(1);
                if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 3584) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 477;
                this.match(CParser.RightParen);
                }
                break;
            case CParser.Atomic:
                this.enterOuterAlt(localContext, 21);
                {
                this.state = 478;
                this.atomicTypeSpecifier();
                }
                break;
            case CParser.Struct:
            case CParser.Union:
                this.enterOuterAlt(localContext, 22);
                {
                this.state = 479;
                this.structOrUnionSpecifier();
                }
                break;
            case CParser.Enum:
                this.enterOuterAlt(localContext, 23);
                {
                this.state = 480;
                this.enumSpecifier();
                }
                break;
            case CParser.Identifier:
                this.enterOuterAlt(localContext, 24);
                {
                this.state = 481;
                this.typedefName();
                }
                break;
            case CParser.T__14:
            case CParser.T__15:
                this.enterOuterAlt(localContext, 25);
                {
                this.state = 482;
                _la = this.tokenStream.LA(1);
                if(!(_la === 15 || _la === 16)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 483;
                this.match(CParser.LeftParen);
                this.state = 484;
                this.constantExpression();
                this.state = 485;
                this.match(CParser.RightParen);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public structOrUnionSpecifier(): StructOrUnionSpecifierContext {
        let localContext = new StructOrUnionSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 64, CParser.RULE_structOrUnionSpecifier);
        let _la: number;
        try {
            this.state = 500;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 38, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 489;
                this.structOrUnion();
                this.state = 491;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 125) {
                    {
                    this.state = 490;
                    this.match(CParser.Identifier);
                    }
                }

                this.state = 493;
                this.match(CParser.LeftBrace);
                this.state = 494;
                this.structDeclarationList();
                this.state = 495;
                this.match(CParser.RightBrace);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 497;
                this.structOrUnion();
                this.state = 498;
                this.match(CParser.Identifier);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public structOrUnion(): StructOrUnionContext {
        let localContext = new StructOrUnionContext(this.context, this.state);
        this.enterRule(localContext, 66, CParser.RULE_structOrUnion);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 502;
            _la = this.tokenStream.LA(1);
            if(!(_la === 61 || _la === 64)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public structDeclarationList(): StructDeclarationListContext {
        let localContext = new StructDeclarationListContext(this.context, this.state);
        this.enterRule(localContext, 68, CParser.RULE_structDeclarationList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 505;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 504;
                this.structDeclaration();
                }
                }
                this.state = 507;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 8388482) !== 0) || ((((_la - 38)) & ~0x1F) === 0 && ((1 << (_la - 38)) & 1016775331) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 71) !== 0) || _la === 125);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public structDeclaration(): StructDeclarationContext {
        let localContext = new StructDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 70, CParser.RULE_structDeclaration);
        try {
            this.state = 517;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 40, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 509;
                this.specifierQualifierList();
                this.state = 510;
                this.structDeclaratorList();
                this.state = 511;
                this.match(CParser.Semi);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 513;
                this.specifierQualifierList();
                this.state = 514;
                this.match(CParser.Semi);
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 516;
                this.staticAssertDeclaration();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public specifierQualifierList(): SpecifierQualifierListContext {
        let localContext = new SpecifierQualifierListContext(this.context, this.state);
        this.enterRule(localContext, 72, CParser.RULE_specifierQualifierList);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 521;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 41, this.context) ) {
            case 1:
                {
                this.state = 519;
                this.typeSpecifier();
                }
                break;
            case 2:
                {
                this.state = 520;
                this.typeQualifier();
                }
                break;
            }
            this.state = 524;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 42, this.context) ) {
            case 1:
                {
                this.state = 523;
                this.specifierQualifierList();
                }
                break;
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public structDeclaratorList(): StructDeclaratorListContext {
        let localContext = new StructDeclaratorListContext(this.context, this.state);
        this.enterRule(localContext, 74, CParser.RULE_structDeclaratorList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 526;
            this.structDeclarator();
            this.state = 531;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 108) {
                {
                {
                this.state = 527;
                this.match(CParser.Comma);
                this.state = 528;
                this.structDeclarator();
                }
                }
                this.state = 533;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public structDeclarator(): StructDeclaratorContext {
        let localContext = new StructDeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 76, CParser.RULE_structDeclarator);
        let _la: number;
        try {
            this.state = 540;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 45, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 534;
                this.declarator();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 536;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4194304000) !== 0) || ((((_la - 79)) & ~0x1F) === 0 && ((1 << (_la - 79)) & 8454145) !== 0) || _la === 125) {
                    {
                    this.state = 535;
                    this.declarator();
                    }
                }

                this.state = 538;
                this.match(CParser.Colon);
                this.state = 539;
                this.constantExpression();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public enumSpecifier(): EnumSpecifierContext {
        let localContext = new EnumSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 78, CParser.RULE_enumSpecifier);
        let _la: number;
        try {
            this.state = 555;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 48, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 542;
                this.match(CParser.Enum);
                this.state = 544;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 125) {
                    {
                    this.state = 543;
                    this.match(CParser.Identifier);
                    }
                }

                this.state = 546;
                this.match(CParser.LeftBrace);
                this.state = 547;
                this.enumeratorList();
                this.state = 549;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 108) {
                    {
                    this.state = 548;
                    this.match(CParser.Comma);
                    }
                }

                this.state = 551;
                this.match(CParser.RightBrace);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 553;
                this.match(CParser.Enum);
                this.state = 554;
                this.match(CParser.Identifier);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public enumeratorList(): EnumeratorListContext {
        let localContext = new EnumeratorListContext(this.context, this.state);
        this.enterRule(localContext, 80, CParser.RULE_enumeratorList);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 557;
            this.enumerator();
            this.state = 562;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 49, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 558;
                    this.match(CParser.Comma);
                    this.state = 559;
                    this.enumerator();
                    }
                    }
                }
                this.state = 564;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 49, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public enumerator(): EnumeratorContext {
        let localContext = new EnumeratorContext(this.context, this.state);
        this.enterRule(localContext, 82, CParser.RULE_enumerator);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 565;
            this.enumerationConstant();
            this.state = 568;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 109) {
                {
                this.state = 566;
                this.match(CParser.Assign);
                this.state = 567;
                this.constantExpression();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public enumerationConstant(): EnumerationConstantContext {
        let localContext = new EnumerationConstantContext(this.context, this.state);
        this.enterRule(localContext, 84, CParser.RULE_enumerationConstant);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 570;
            this.match(CParser.Identifier);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public atomicTypeSpecifier(): AtomicTypeSpecifierContext {
        let localContext = new AtomicTypeSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 86, CParser.RULE_atomicTypeSpecifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 572;
            this.match(CParser.Atomic);
            this.state = 573;
            this.match(CParser.LeftParen);
            this.state = 574;
            this.typeName();
            this.state = 575;
            this.match(CParser.RightParen);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public typeQualifier(): TypeQualifierContext {
        let localContext = new TypeQualifierContext(this.context, this.state);
        this.enterRule(localContext, 88, CParser.RULE_typeQualifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 577;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 17)) & ~0x1F) === 0 && ((1 << (_la - 17)) & 4194367) !== 0) || ((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & 69633) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public functionSpecifier(): FunctionSpecifierContext {
        let localContext = new FunctionSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 90, CParser.RULE_functionSpecifier);
        try {
            this.state = 589;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CParser.Inline:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 579;
                this.match(CParser.Inline);
                }
                break;
            case CParser.Noreturn:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 580;
                this.match(CParser.Noreturn);
                }
                break;
            case CParser.T__22:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 581;
                this.match(CParser.T__22);
                }
                break;
            case CParser.T__23:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 582;
                this.match(CParser.T__23);
                }
                break;
            case CParser.T__24:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 583;
                this.match(CParser.T__24);
                }
                break;
            case CParser.T__33:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 584;
                this.gccAttributeSpecifier();
                }
                break;
            case CParser.T__25:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 585;
                this.match(CParser.T__25);
                this.state = 586;
                this.match(CParser.LeftParen);
                this.state = 587;
                this.match(CParser.Identifier);
                this.state = 588;
                this.match(CParser.RightParen);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public alignmentSpecifier(): AlignmentSpecifierContext {
        let localContext = new AlignmentSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 92, CParser.RULE_alignmentSpecifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 591;
            this.match(CParser.Alignas);
            this.state = 592;
            this.match(CParser.LeftParen);
            this.state = 595;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 52, this.context) ) {
            case 1:
                {
                this.state = 593;
                this.typeName();
                }
                break;
            case 2:
                {
                this.state = 594;
                this.constantExpression();
                }
                break;
            }
            this.state = 597;
            this.match(CParser.RightParen);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public declarator(): DeclaratorContext {
        let localContext = new DeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 94, CParser.RULE_declarator);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 600;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 95 || _la === 102) {
                {
                this.state = 599;
                this.pointer();
                }
            }

            this.state = 602;
            this.directDeclarator(0);
            this.state = 606;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 54, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 603;
                    this.gccDeclaratorExtension();
                    }
                    }
                }
                this.state = 608;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 54, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public directDeclarator(): DirectDeclaratorContext;
    public directDeclarator(_p: number): DirectDeclaratorContext;
    public directDeclarator(_p?: number): DirectDeclaratorContext {
        if (_p === undefined) {
            _p = 0;
        }

        let parentContext = this.context;
        let parentState = this.state;
        let localContext = new DirectDeclaratorContext(this.context, parentState);
        let previousContext = localContext;
        let _startState = 96;
        this.enterRecursionRule(localContext, 96, CParser.RULE_directDeclarator, _p);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 626;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 55, this.context) ) {
            case 1:
                {
                this.state = 610;
                this.match(CParser.Identifier);
                }
                break;
            case 2:
                {
                this.state = 611;
                this.match(CParser.LeftParen);
                this.state = 612;
                this.declarator();
                this.state = 613;
                this.match(CParser.RightParen);
                }
                break;
            case 3:
                {
                this.state = 615;
                this.match(CParser.Identifier);
                this.state = 616;
                this.match(CParser.Colon);
                this.state = 617;
                this.match(CParser.DigitSequence);
                }
                break;
            case 4:
                {
                this.state = 618;
                this.vcSpecificModifer();
                this.state = 619;
                this.match(CParser.Identifier);
                }
                break;
            case 5:
                {
                this.state = 621;
                this.match(CParser.LeftParen);
                this.state = 622;
                this.vcSpecificModifer();
                this.state = 623;
                this.declarator();
                this.state = 624;
                this.match(CParser.RightParen);
                }
                break;
            }
            this.context!.stop = this.tokenStream.LT(-1);
            this.state = 673;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 62, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    if (this.parseListeners != null) {
                        this.triggerExitRuleEvent();
                    }
                    previousContext = localContext;
                    {
                    this.state = 671;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 61, this.context) ) {
                    case 1:
                        {
                        localContext = new DirectDeclaratorContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CParser.RULE_directDeclarator);
                        this.state = 628;
                        if (!(this.precpred(this.context, 9))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 9)");
                        }
                        this.state = 629;
                        this.match(CParser.LeftBracket);
                        this.state = 631;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (((((_la - 17)) & ~0x1F) === 0 && ((1 << (_la - 17)) & 4194367) !== 0) || ((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & 69633) !== 0)) {
                            {
                            this.state = 630;
                            this.typeQualifierList();
                            }
                        }

                        this.state = 634;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 62) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 1083393) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12959) !== 0) || ((((_la - 125)) & ~0x1F) === 0 && ((1 << (_la - 125)) & 15) !== 0)) {
                            {
                            this.state = 633;
                            this.assignmentExpression();
                            }
                        }

                        this.state = 636;
                        this.match(CParser.RightBracket);
                        }
                        break;
                    case 2:
                        {
                        localContext = new DirectDeclaratorContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CParser.RULE_directDeclarator);
                        this.state = 637;
                        if (!(this.precpred(this.context, 8))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 8)");
                        }
                        this.state = 638;
                        this.match(CParser.LeftBracket);
                        this.state = 639;
                        this.match(CParser.Static);
                        this.state = 641;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (((((_la - 17)) & ~0x1F) === 0 && ((1 << (_la - 17)) & 4194367) !== 0) || ((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & 69633) !== 0)) {
                            {
                            this.state = 640;
                            this.typeQualifierList();
                            }
                        }

                        this.state = 643;
                        this.assignmentExpression();
                        this.state = 644;
                        this.match(CParser.RightBracket);
                        }
                        break;
                    case 3:
                        {
                        localContext = new DirectDeclaratorContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CParser.RULE_directDeclarator);
                        this.state = 646;
                        if (!(this.precpred(this.context, 7))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 7)");
                        }
                        this.state = 647;
                        this.match(CParser.LeftBracket);
                        this.state = 648;
                        this.typeQualifierList();
                        this.state = 649;
                        this.match(CParser.Static);
                        this.state = 650;
                        this.assignmentExpression();
                        this.state = 651;
                        this.match(CParser.RightBracket);
                        }
                        break;
                    case 4:
                        {
                        localContext = new DirectDeclaratorContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CParser.RULE_directDeclarator);
                        this.state = 653;
                        if (!(this.precpred(this.context, 6))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 6)");
                        }
                        this.state = 654;
                        this.match(CParser.LeftBracket);
                        this.state = 656;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (((((_la - 17)) & ~0x1F) === 0 && ((1 << (_la - 17)) & 4194367) !== 0) || ((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & 69633) !== 0)) {
                            {
                            this.state = 655;
                            this.typeQualifierList();
                            }
                        }

                        this.state = 658;
                        this.match(CParser.Star);
                        this.state = 659;
                        this.match(CParser.RightBracket);
                        }
                        break;
                    case 5:
                        {
                        localContext = new DirectDeclaratorContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CParser.RULE_directDeclarator);
                        this.state = 660;
                        if (!(this.precpred(this.context, 5))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 5)");
                        }
                        this.state = 661;
                        this.match(CParser.LeftParen);
                        this.state = 662;
                        this.parameterTypeList();
                        this.state = 663;
                        this.match(CParser.RightParen);
                        }
                        break;
                    case 6:
                        {
                        localContext = new DirectDeclaratorContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CParser.RULE_directDeclarator);
                        this.state = 665;
                        if (!(this.precpred(this.context, 4))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 4)");
                        }
                        this.state = 666;
                        this.match(CParser.LeftParen);
                        this.state = 668;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 125) {
                            {
                            this.state = 667;
                            this.identifierList();
                            }
                        }

                        this.state = 670;
                        this.match(CParser.RightParen);
                        }
                        break;
                    }
                    }
                }
                this.state = 675;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 62, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.unrollRecursionContexts(parentContext);
        }
        return localContext;
    }
    public vcSpecificModifer(): VcSpecificModiferContext {
        let localContext = new VcSpecificModiferContext(this.context, this.state);
        this.enterRule(localContext, 98, CParser.RULE_vcSpecificModifer);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 676;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 4194304000) !== 0))) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public gccDeclaratorExtension(): GccDeclaratorExtensionContext {
        let localContext = new GccDeclaratorExtensionContext(this.context, this.state);
        this.enterRule(localContext, 100, CParser.RULE_gccDeclaratorExtension);
        let _la: number;
        try {
            this.state = 687;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CParser.T__31:
            case CParser.T__32:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 678;
                _la = this.tokenStream.LA(1);
                if(!(_la === 32 || _la === 33)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 679;
                this.match(CParser.LeftParen);
                this.state = 681;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                do {
                    {
                    {
                    this.state = 680;
                    this.match(CParser.StringLiteral);
                    }
                    }
                    this.state = 683;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                } while (_la === 128);
                this.state = 685;
                this.match(CParser.RightParen);
                }
                break;
            case CParser.T__33:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 686;
                this.gccAttributeSpecifier();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public gccAttributeSpecifier(): GccAttributeSpecifierContext {
        let localContext = new GccAttributeSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 102, CParser.RULE_gccAttributeSpecifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 689;
            this.match(CParser.T__33);
            this.state = 690;
            this.match(CParser.LeftParen);
            this.state = 691;
            this.match(CParser.LeftParen);
            this.state = 692;
            this.gccAttributeList();
            this.state = 693;
            this.match(CParser.RightParen);
            this.state = 694;
            this.match(CParser.RightParen);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public gccAttributeList(): GccAttributeListContext {
        let localContext = new GccAttributeListContext(this.context, this.state);
        this.enterRule(localContext, 104, CParser.RULE_gccAttributeList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 697;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967294) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294967295) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 4294868991) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 4294963199) !== 0) || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 255) !== 0)) {
                {
                this.state = 696;
                this.gccAttribute();
                }
            }

            this.state = 705;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 108) {
                {
                {
                this.state = 699;
                this.match(CParser.Comma);
                this.state = 701;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967294) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294967295) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 4294868991) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 4294963199) !== 0) || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 255) !== 0)) {
                    {
                    this.state = 700;
                    this.gccAttribute();
                    }
                }

                }
                }
                this.state = 707;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public gccAttribute(): GccAttributeContext {
        let localContext = new GccAttributeContext(this.context, this.state);
        this.enterRule(localContext, 106, CParser.RULE_gccAttribute);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 708;
            _la = this.tokenStream.LA(1);
            if(_la<=0 || ((((_la - 79)) & ~0x1F) === 0 && ((1 << (_la - 79)) & 536870915) !== 0)) {
            this.errorHandler.recoverInline(this);
            }
            else {
                this.errorHandler.reportMatch(this);
                this.consume();
            }
            this.state = 714;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 79) {
                {
                this.state = 709;
                this.match(CParser.LeftParen);
                this.state = 711;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 62) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 1083393) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12959) !== 0) || ((((_la - 125)) & ~0x1F) === 0 && ((1 << (_la - 125)) & 15) !== 0)) {
                    {
                    this.state = 710;
                    this.argumentExpressionList();
                    }
                }

                this.state = 713;
                this.match(CParser.RightParen);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public pointer(): PointerContext {
        let localContext = new PointerContext(this.context, this.state);
        this.enterRule(localContext, 108, CParser.RULE_pointer);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 720;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 716;
                _la = this.tokenStream.LA(1);
                if(!(_la === 95 || _la === 102)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 718;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 17)) & ~0x1F) === 0 && ((1 << (_la - 17)) & 4194367) !== 0) || ((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & 69633) !== 0)) {
                    {
                    this.state = 717;
                    this.typeQualifierList();
                    }
                }

                }
                }
                this.state = 722;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 95 || _la === 102);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public typeQualifierList(): TypeQualifierListContext {
        let localContext = new TypeQualifierListContext(this.context, this.state);
        this.enterRule(localContext, 110, CParser.RULE_typeQualifierList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 725;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 724;
                this.typeQualifier();
                }
                }
                this.state = 727;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (((((_la - 17)) & ~0x1F) === 0 && ((1 << (_la - 17)) & 4194367) !== 0) || ((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & 69633) !== 0));
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public parameterTypeList(): ParameterTypeListContext {
        let localContext = new ParameterTypeListContext(this.context, this.state);
        this.enterRule(localContext, 112, CParser.RULE_parameterTypeList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 729;
            this.parameterList();
            this.state = 732;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 108) {
                {
                this.state = 730;
                this.match(CParser.Comma);
                this.state = 731;
                this.match(CParser.Ellipsis);
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public parameterList(): ParameterListContext {
        let localContext = new ParameterListContext(this.context, this.state);
        this.enterRule(localContext, 114, CParser.RULE_parameterList);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 734;
            this.parameterDeclaration();
            this.state = 739;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 74, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 735;
                    this.match(CParser.Comma);
                    this.state = 736;
                    this.parameterDeclaration();
                    }
                    }
                }
                this.state = 741;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 74, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public parameterDeclaration(): ParameterDeclarationContext {
        let localContext = new ParameterDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 116, CParser.RULE_parameterDeclaration);
        let _la: number;
        try {
            this.state = 749;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 76, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 742;
                this.declarationSpecifiers();
                this.state = 743;
                this.declarator();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 745;
                this.declarationSpecifiers2();
                this.state = 747;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 79)) & ~0x1F) === 0 && ((1 << (_la - 79)) & 8454149) !== 0)) {
                    {
                    this.state = 746;
                    this.abstractDeclarator();
                    }
                }

                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public identifierList(): IdentifierListContext {
        let localContext = new IdentifierListContext(this.context, this.state);
        this.enterRule(localContext, 118, CParser.RULE_identifierList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 751;
            this.match(CParser.Identifier);
            this.state = 756;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 108) {
                {
                {
                this.state = 752;
                this.match(CParser.Comma);
                this.state = 753;
                this.match(CParser.Identifier);
                }
                }
                this.state = 758;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public typeName(): TypeNameContext {
        let localContext = new TypeNameContext(this.context, this.state);
        this.enterRule(localContext, 120, CParser.RULE_typeName);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 759;
            this.specifierQualifierList();
            this.state = 761;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 79)) & ~0x1F) === 0 && ((1 << (_la - 79)) & 8454149) !== 0)) {
                {
                this.state = 760;
                this.abstractDeclarator();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public abstractDeclarator(): AbstractDeclaratorContext {
        let localContext = new AbstractDeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 122, CParser.RULE_abstractDeclarator);
        let _la: number;
        try {
            this.state = 774;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 81, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 763;
                this.pointer();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 765;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 95 || _la === 102) {
                    {
                    this.state = 764;
                    this.pointer();
                    }
                }

                this.state = 767;
                this.directAbstractDeclarator(0);
                this.state = 771;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 7) !== 0)) {
                    {
                    {
                    this.state = 768;
                    this.gccDeclaratorExtension();
                    }
                    }
                    this.state = 773;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public directAbstractDeclarator(): DirectAbstractDeclaratorContext;
    public directAbstractDeclarator(_p: number): DirectAbstractDeclaratorContext;
    public directAbstractDeclarator(_p?: number): DirectAbstractDeclaratorContext {
        if (_p === undefined) {
            _p = 0;
        }

        let parentContext = this.context;
        let parentState = this.state;
        let localContext = new DirectAbstractDeclaratorContext(this.context, parentState);
        let previousContext = localContext;
        let _startState = 124;
        this.enterRecursionRule(localContext, 124, CParser.RULE_directAbstractDeclarator, _p);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 822;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 88, this.context) ) {
            case 1:
                {
                this.state = 777;
                this.match(CParser.LeftParen);
                this.state = 778;
                this.abstractDeclarator();
                this.state = 779;
                this.match(CParser.RightParen);
                this.state = 783;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 82, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 780;
                        this.gccDeclaratorExtension();
                        }
                        }
                    }
                    this.state = 785;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 82, this.context);
                }
                }
                break;
            case 2:
                {
                this.state = 786;
                this.match(CParser.LeftBracket);
                this.state = 788;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 17)) & ~0x1F) === 0 && ((1 << (_la - 17)) & 4194367) !== 0) || ((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & 69633) !== 0)) {
                    {
                    this.state = 787;
                    this.typeQualifierList();
                    }
                }

                this.state = 791;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 62) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 1083393) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12959) !== 0) || ((((_la - 125)) & ~0x1F) === 0 && ((1 << (_la - 125)) & 15) !== 0)) {
                    {
                    this.state = 790;
                    this.assignmentExpression();
                    }
                }

                this.state = 793;
                this.match(CParser.RightBracket);
                }
                break;
            case 3:
                {
                this.state = 794;
                this.match(CParser.LeftBracket);
                this.state = 795;
                this.match(CParser.Static);
                this.state = 797;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 17)) & ~0x1F) === 0 && ((1 << (_la - 17)) & 4194367) !== 0) || ((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & 69633) !== 0)) {
                    {
                    this.state = 796;
                    this.typeQualifierList();
                    }
                }

                this.state = 799;
                this.assignmentExpression();
                this.state = 800;
                this.match(CParser.RightBracket);
                }
                break;
            case 4:
                {
                this.state = 802;
                this.match(CParser.LeftBracket);
                this.state = 803;
                this.typeQualifierList();
                this.state = 804;
                this.match(CParser.Static);
                this.state = 805;
                this.assignmentExpression();
                this.state = 806;
                this.match(CParser.RightBracket);
                }
                break;
            case 5:
                {
                this.state = 808;
                this.match(CParser.LeftBracket);
                this.state = 809;
                this.match(CParser.Star);
                this.state = 810;
                this.match(CParser.RightBracket);
                }
                break;
            case 6:
                {
                this.state = 811;
                this.match(CParser.LeftParen);
                this.state = 813;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134217666) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 3988666931) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 5355) !== 0) || _la === 125) {
                    {
                    this.state = 812;
                    this.parameterTypeList();
                    }
                }

                this.state = 815;
                this.match(CParser.RightParen);
                this.state = 819;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 87, this.context);
                while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                    if (alternative === 1) {
                        {
                        {
                        this.state = 816;
                        this.gccDeclaratorExtension();
                        }
                        }
                    }
                    this.state = 821;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 87, this.context);
                }
                }
                break;
            }
            this.context!.stop = this.tokenStream.LT(-1);
            this.state = 867;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 95, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    if (this.parseListeners != null) {
                        this.triggerExitRuleEvent();
                    }
                    previousContext = localContext;
                    {
                    this.state = 865;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 94, this.context) ) {
                    case 1:
                        {
                        localContext = new DirectAbstractDeclaratorContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CParser.RULE_directAbstractDeclarator);
                        this.state = 824;
                        if (!(this.precpred(this.context, 5))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 5)");
                        }
                        this.state = 825;
                        this.match(CParser.LeftBracket);
                        this.state = 827;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (((((_la - 17)) & ~0x1F) === 0 && ((1 << (_la - 17)) & 4194367) !== 0) || ((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & 69633) !== 0)) {
                            {
                            this.state = 826;
                            this.typeQualifierList();
                            }
                        }

                        this.state = 830;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 62) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 1083393) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12959) !== 0) || ((((_la - 125)) & ~0x1F) === 0 && ((1 << (_la - 125)) & 15) !== 0)) {
                            {
                            this.state = 829;
                            this.assignmentExpression();
                            }
                        }

                        this.state = 832;
                        this.match(CParser.RightBracket);
                        }
                        break;
                    case 2:
                        {
                        localContext = new DirectAbstractDeclaratorContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CParser.RULE_directAbstractDeclarator);
                        this.state = 833;
                        if (!(this.precpred(this.context, 4))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 4)");
                        }
                        this.state = 834;
                        this.match(CParser.LeftBracket);
                        this.state = 835;
                        this.match(CParser.Static);
                        this.state = 837;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (((((_la - 17)) & ~0x1F) === 0 && ((1 << (_la - 17)) & 4194367) !== 0) || ((((_la - 55)) & ~0x1F) === 0 && ((1 << (_la - 55)) & 69633) !== 0)) {
                            {
                            this.state = 836;
                            this.typeQualifierList();
                            }
                        }

                        this.state = 839;
                        this.assignmentExpression();
                        this.state = 840;
                        this.match(CParser.RightBracket);
                        }
                        break;
                    case 3:
                        {
                        localContext = new DirectAbstractDeclaratorContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CParser.RULE_directAbstractDeclarator);
                        this.state = 842;
                        if (!(this.precpred(this.context, 3))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 3)");
                        }
                        this.state = 843;
                        this.match(CParser.LeftBracket);
                        this.state = 844;
                        this.typeQualifierList();
                        this.state = 845;
                        this.match(CParser.Static);
                        this.state = 846;
                        this.assignmentExpression();
                        this.state = 847;
                        this.match(CParser.RightBracket);
                        }
                        break;
                    case 4:
                        {
                        localContext = new DirectAbstractDeclaratorContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CParser.RULE_directAbstractDeclarator);
                        this.state = 849;
                        if (!(this.precpred(this.context, 2))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 2)");
                        }
                        this.state = 850;
                        this.match(CParser.LeftBracket);
                        this.state = 851;
                        this.match(CParser.Star);
                        this.state = 852;
                        this.match(CParser.RightBracket);
                        }
                        break;
                    case 5:
                        {
                        localContext = new DirectAbstractDeclaratorContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CParser.RULE_directAbstractDeclarator);
                        this.state = 853;
                        if (!(this.precpred(this.context, 1))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 1)");
                        }
                        this.state = 854;
                        this.match(CParser.LeftParen);
                        this.state = 856;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134217666) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 3988666931) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 5355) !== 0) || _la === 125) {
                            {
                            this.state = 855;
                            this.parameterTypeList();
                            }
                        }

                        this.state = 858;
                        this.match(CParser.RightParen);
                        this.state = 862;
                        this.errorHandler.sync(this);
                        alternative = this.interpreter.adaptivePredict(this.tokenStream, 93, this.context);
                        while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                            if (alternative === 1) {
                                {
                                {
                                this.state = 859;
                                this.gccDeclaratorExtension();
                                }
                                }
                            }
                            this.state = 864;
                            this.errorHandler.sync(this);
                            alternative = this.interpreter.adaptivePredict(this.tokenStream, 93, this.context);
                        }
                        }
                        break;
                    }
                    }
                }
                this.state = 869;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 95, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.unrollRecursionContexts(parentContext);
        }
        return localContext;
    }
    public typedefName(): TypedefNameContext {
        let localContext = new TypedefNameContext(this.context, this.state);
        this.enterRule(localContext, 126, CParser.RULE_typedefName);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 870;
            this.match(CParser.Identifier);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public initializer(): InitializerContext {
        let localContext = new InitializerContext(this.context, this.state);
        this.enterRule(localContext, 128, CParser.RULE_initializer);
        let _la: number;
        try {
            this.state = 880;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CParser.T__0:
            case CParser.T__1:
            case CParser.T__2:
            case CParser.T__3:
            case CParser.T__4:
            case CParser.Sizeof:
            case CParser.Alignof:
            case CParser.Generic:
            case CParser.LeftParen:
            case CParser.Plus:
            case CParser.PlusPlus:
            case CParser.Minus:
            case CParser.MinusMinus:
            case CParser.Star:
            case CParser.And:
            case CParser.AndAnd:
            case CParser.Not:
            case CParser.Tilde:
            case CParser.Identifier:
            case CParser.Constant:
            case CParser.DigitSequence:
            case CParser.StringLiteral:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 872;
                this.assignmentExpression();
                }
                break;
            case CParser.LeftBrace:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 873;
                this.match(CParser.LeftBrace);
                this.state = 874;
                this.initializerList();
                this.state = 876;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 108) {
                    {
                    this.state = 875;
                    this.match(CParser.Comma);
                    }
                }

                this.state = 878;
                this.match(CParser.RightBrace);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public initializerList(): InitializerListContext {
        let localContext = new InitializerListContext(this.context, this.state);
        this.enterRule(localContext, 130, CParser.RULE_initializerList);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 883;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 81 || _la === 123) {
                {
                this.state = 882;
                this.designation();
                }
            }

            this.state = 885;
            this.initializer();
            this.state = 893;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 100, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 886;
                    this.match(CParser.Comma);
                    this.state = 888;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 81 || _la === 123) {
                        {
                        this.state = 887;
                        this.designation();
                        }
                    }

                    this.state = 890;
                    this.initializer();
                    }
                    }
                }
                this.state = 895;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 100, this.context);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public designation(): DesignationContext {
        let localContext = new DesignationContext(this.context, this.state);
        this.enterRule(localContext, 132, CParser.RULE_designation);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 896;
            this.designatorList();
            this.state = 897;
            this.match(CParser.Assign);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public designatorList(): DesignatorListContext {
        let localContext = new DesignatorListContext(this.context, this.state);
        this.enterRule(localContext, 134, CParser.RULE_designatorList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 900;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 899;
                this.designator();
                }
                }
                this.state = 902;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 81 || _la === 123);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public designator(): DesignatorContext {
        let localContext = new DesignatorContext(this.context, this.state);
        this.enterRule(localContext, 136, CParser.RULE_designator);
        try {
            this.state = 910;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CParser.LeftBracket:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 904;
                this.match(CParser.LeftBracket);
                this.state = 905;
                this.constantExpression();
                this.state = 906;
                this.match(CParser.RightBracket);
                }
                break;
            case CParser.Dot:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 908;
                this.match(CParser.Dot);
                this.state = 909;
                this.match(CParser.Identifier);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public staticAssertDeclaration(): StaticAssertDeclarationContext {
        let localContext = new StaticAssertDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 138, CParser.RULE_staticAssertDeclaration);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 912;
            this.match(CParser.StaticAssert);
            this.state = 913;
            this.match(CParser.LeftParen);
            this.state = 914;
            this.constantExpression();
            this.state = 915;
            this.match(CParser.Comma);
            this.state = 917;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 916;
                this.match(CParser.StringLiteral);
                }
                }
                this.state = 919;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 128);
            this.state = 921;
            this.match(CParser.RightParen);
            this.state = 922;
            this.match(CParser.Semi);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public statement(): StatementContext {
        let localContext = new StatementContext(this.context, this.state);
        this.enterRule(localContext, 140, CParser.RULE_statement);
        let _la: number;
        try {
            this.state = 961;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 109, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 924;
                this.labeledStatement();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 925;
                this.compoundStatement();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 926;
                this.expressionStatement();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 927;
                this.selectionStatement();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 928;
                this.iterationStatement();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 929;
                this.jumpStatement();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 930;
                _la = this.tokenStream.LA(1);
                if(!(_la === 32 || _la === 33)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 931;
                _la = this.tokenStream.LA(1);
                if(!(_la === 21 || _la === 22 || _la === 67)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 932;
                this.match(CParser.LeftParen);
                this.state = 941;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 62) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 1083393) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12959) !== 0) || ((((_la - 125)) & ~0x1F) === 0 && ((1 << (_la - 125)) & 15) !== 0)) {
                    {
                    this.state = 933;
                    this.logicalOrExpression();
                    this.state = 938;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    while (_la === 108) {
                        {
                        {
                        this.state = 934;
                        this.match(CParser.Comma);
                        this.state = 935;
                        this.logicalOrExpression();
                        }
                        }
                        this.state = 940;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                    }
                    }
                }

                this.state = 956;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                while (_la === 106) {
                    {
                    {
                    this.state = 943;
                    this.match(CParser.Colon);
                    this.state = 952;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 62) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 1083393) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12959) !== 0) || ((((_la - 125)) & ~0x1F) === 0 && ((1 << (_la - 125)) & 15) !== 0)) {
                        {
                        this.state = 944;
                        this.logicalOrExpression();
                        this.state = 949;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        while (_la === 108) {
                            {
                            {
                            this.state = 945;
                            this.match(CParser.Comma);
                            this.state = 946;
                            this.logicalOrExpression();
                            }
                            }
                            this.state = 951;
                            this.errorHandler.sync(this);
                            _la = this.tokenStream.LA(1);
                        }
                        }
                    }

                    }
                    }
                    this.state = 958;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                }
                this.state = 959;
                this.match(CParser.RightParen);
                this.state = 960;
                this.match(CParser.Semi);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public labeledStatement(): LabeledStatementContext {
        let localContext = new LabeledStatementContext(this.context, this.state);
        this.enterRule(localContext, 142, CParser.RULE_labeledStatement);
        try {
            this.state = 976;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CParser.Identifier:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 963;
                this.match(CParser.Identifier);
                this.state = 964;
                this.match(CParser.Colon);
                this.state = 966;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 110, this.context) ) {
                case 1:
                    {
                    this.state = 965;
                    this.statement();
                    }
                    break;
                }
                }
                break;
            case CParser.Case:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 968;
                this.match(CParser.Case);
                this.state = 969;
                this.constantExpression();
                this.state = 970;
                this.match(CParser.Colon);
                this.state = 971;
                this.statement();
                }
                break;
            case CParser.Default:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 973;
                this.match(CParser.Default);
                this.state = 974;
                this.match(CParser.Colon);
                this.state = 975;
                this.statement();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public compoundStatement(): CompoundStatementContext {
        let localContext = new CompoundStatementContext(this.context, this.state);
        this.enterRule(localContext, 144, CParser.RULE_compoundStatement);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 978;
            this.match(CParser.LeftBrace);
            this.state = 980;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134217726) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294963199) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 4161337343) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 2013266533) !== 0)) {
                {
                this.state = 979;
                this.blockItemList();
                }
            }

            this.state = 982;
            this.match(CParser.RightBrace);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public blockItemList(): BlockItemListContext {
        let localContext = new BlockItemListContext(this.context, this.state);
        this.enterRule(localContext, 146, CParser.RULE_blockItemList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 985;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 984;
                this.blockItem();
                }
                }
                this.state = 987;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134217726) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294963199) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 4161337343) !== 0) || ((((_la - 98)) & ~0x1F) === 0 && ((1 << (_la - 98)) & 2013266533) !== 0));
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public blockItem(): BlockItemContext {
        let localContext = new BlockItemContext(this.context, this.state);
        this.enterRule(localContext, 148, CParser.RULE_blockItem);
        try {
            this.state = 991;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 114, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 989;
                this.statement();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 990;
                this.declaration();
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public expressionStatement(): ExpressionStatementContext {
        let localContext = new ExpressionStatementContext(this.context, this.state);
        this.enterRule(localContext, 150, CParser.RULE_expressionStatement);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 994;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 62) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 1083393) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12959) !== 0) || ((((_la - 125)) & ~0x1F) === 0 && ((1 << (_la - 125)) & 15) !== 0)) {
                {
                this.state = 993;
                this.expression();
                }
            }

            this.state = 996;
            this.match(CParser.Semi);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public selectionStatement(): SelectionStatementContext {
        let localContext = new SelectionStatementContext(this.context, this.state);
        this.enterRule(localContext, 152, CParser.RULE_selectionStatement);
        try {
            this.state = 1013;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CParser.If:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 998;
                this.match(CParser.If);
                this.state = 999;
                this.match(CParser.LeftParen);
                this.state = 1000;
                this.expression();
                this.state = 1001;
                this.match(CParser.RightParen);
                this.state = 1002;
                this.statement();
                this.state = 1005;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 116, this.context) ) {
                case 1:
                    {
                    this.state = 1003;
                    this.match(CParser.Else);
                    this.state = 1004;
                    this.statement();
                    }
                    break;
                }
                }
                break;
            case CParser.Switch:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1007;
                this.match(CParser.Switch);
                this.state = 1008;
                this.match(CParser.LeftParen);
                this.state = 1009;
                this.expression();
                this.state = 1010;
                this.match(CParser.RightParen);
                this.state = 1011;
                this.statement();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public iterationStatement(): IterationStatementContext {
        let localContext = new IterationStatementContext(this.context, this.state);
        this.enterRule(localContext, 154, CParser.RULE_iterationStatement);
        try {
            this.state = 1035;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CParser.While:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1015;
                this.match(CParser.While);
                this.state = 1016;
                this.match(CParser.LeftParen);
                this.state = 1017;
                this.expression();
                this.state = 1018;
                this.match(CParser.RightParen);
                this.state = 1019;
                this.statement();
                }
                break;
            case CParser.Do:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1021;
                this.match(CParser.Do);
                this.state = 1022;
                this.statement();
                this.state = 1023;
                this.match(CParser.While);
                this.state = 1024;
                this.match(CParser.LeftParen);
                this.state = 1025;
                this.expression();
                this.state = 1026;
                this.match(CParser.RightParen);
                this.state = 1027;
                this.match(CParser.Semi);
                }
                break;
            case CParser.For:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1029;
                this.match(CParser.For);
                this.state = 1030;
                this.match(CParser.LeftParen);
                this.state = 1031;
                this.forCondition();
                this.state = 1032;
                this.match(CParser.RightParen);
                this.state = 1033;
                this.statement();
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public forCondition(): ForConditionContext {
        let localContext = new ForConditionContext(this.context, this.state);
        this.enterRule(localContext, 156, CParser.RULE_forCondition);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1041;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 120, this.context) ) {
            case 1:
                {
                this.state = 1037;
                this.forDeclaration();
                }
                break;
            case 2:
                {
                this.state = 1039;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 62) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 1083393) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12959) !== 0) || ((((_la - 125)) & ~0x1F) === 0 && ((1 << (_la - 125)) & 15) !== 0)) {
                    {
                    this.state = 1038;
                    this.expression();
                    }
                }

                }
                break;
            }
            this.state = 1043;
            this.match(CParser.Semi);
            this.state = 1045;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 62) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 1083393) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12959) !== 0) || ((((_la - 125)) & ~0x1F) === 0 && ((1 << (_la - 125)) & 15) !== 0)) {
                {
                this.state = 1044;
                this.forExpression();
                }
            }

            this.state = 1047;
            this.match(CParser.Semi);
            this.state = 1049;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 62) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 1083393) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12959) !== 0) || ((((_la - 125)) & ~0x1F) === 0 && ((1 << (_la - 125)) & 15) !== 0)) {
                {
                this.state = 1048;
                this.forExpression();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public forDeclaration(): ForDeclarationContext {
        let localContext = new ForDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 158, CParser.RULE_forDeclaration);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1051;
            this.declarationSpecifiers();
            this.state = 1053;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4194304000) !== 0) || ((((_la - 79)) & ~0x1F) === 0 && ((1 << (_la - 79)) & 8454145) !== 0) || _la === 125) {
                {
                this.state = 1052;
                this.initDeclaratorList();
                }
            }

            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public forExpression(): ForExpressionContext {
        let localContext = new ForExpressionContext(this.context, this.state);
        this.enterRule(localContext, 160, CParser.RULE_forExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1055;
            this.assignmentExpression();
            this.state = 1060;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 108) {
                {
                {
                this.state = 1056;
                this.match(CParser.Comma);
                this.state = 1057;
                this.assignmentExpression();
                }
                }
                this.state = 1062;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public jumpStatement(): JumpStatementContext {
        let localContext = new JumpStatementContext(this.context, this.state);
        this.enterRule(localContext, 162, CParser.RULE_jumpStatement);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1073;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 126, this.context) ) {
            case 1:
                {
                this.state = 1063;
                this.match(CParser.Goto);
                this.state = 1064;
                this.match(CParser.Identifier);
                }
                break;
            case 2:
                {
                this.state = 1065;
                this.match(CParser.Continue);
                }
                break;
            case 3:
                {
                this.state = 1066;
                this.match(CParser.Break);
                }
                break;
            case 4:
                {
                this.state = 1067;
                this.match(CParser.Return);
                this.state = 1069;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 62) !== 0) || ((((_la - 59)) & ~0x1F) === 0 && ((1 << (_la - 59)) & 1083393) !== 0) || ((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 12959) !== 0) || ((((_la - 125)) & ~0x1F) === 0 && ((1 << (_la - 125)) & 15) !== 0)) {
                    {
                    this.state = 1068;
                    this.expression();
                    }
                }

                }
                break;
            case 5:
                {
                this.state = 1071;
                this.match(CParser.Goto);
                this.state = 1072;
                this.unaryExpression();
                }
                break;
            }
            this.state = 1075;
            this.match(CParser.Semi);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public compilationUnit(): CompilationUnitContext {
        let localContext = new CompilationUnitContext(this.context, this.state);
        this.enterRule(localContext, 164, CParser.RULE_compilationUnit);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1078;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967234) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 3988666931) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 536886507) !== 0) || ((((_la - 102)) & ~0x1F) === 0 && ((1 << (_la - 102)) & 8388641) !== 0)) {
                {
                this.state = 1077;
                this.translationUnit();
                }
            }

            this.state = 1080;
            this.match(CParser.EOF);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public translationUnit(): TranslationUnitContext {
        let localContext = new TranslationUnitContext(this.context, this.state);
        this.enterRule(localContext, 166, CParser.RULE_translationUnit);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1083;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 1082;
                this.externalDeclaration();
                }
                }
                this.state = 1085;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967234) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 3988666931) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 536886507) !== 0) || ((((_la - 102)) & ~0x1F) === 0 && ((1 << (_la - 102)) & 8388641) !== 0));
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public externalDeclaration(): ExternalDeclarationContext {
        let localContext = new ExternalDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 168, CParser.RULE_externalDeclaration);
        try {
            this.state = 1090;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 129, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1087;
                this.functionDefinition();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1088;
                this.declaration();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1089;
                this.match(CParser.Semi);
                }
                break;
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public functionDefinition(): FunctionDefinitionContext {
        let localContext = new FunctionDefinitionContext(this.context, this.state);
        this.enterRule(localContext, 170, CParser.RULE_functionDefinition);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1093;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 130, this.context) ) {
            case 1:
                {
                this.state = 1092;
                this.declarationSpecifiers();
                }
                break;
            }
            this.state = 1095;
            this.declarator();
            this.state = 1097;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134217666) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 3988666931) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 7403) !== 0) || _la === 125) {
                {
                this.state = 1096;
                this.declarationList();
                }
            }

            this.state = 1099;
            this.compoundStatement();
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }
    public declarationList(): DeclarationListContext {
        let localContext = new DeclarationListContext(this.context, this.state);
        this.enterRule(localContext, 172, CParser.RULE_declarationList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1102;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 1101;
                this.declaration();
                }
                }
                this.state = 1104;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 134217666) !== 0) || ((((_la - 34)) & ~0x1F) === 0 && ((1 << (_la - 34)) & 3988666931) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 7403) !== 0) || _la === 125);
            }
        }
        catch (re) {
            if (re instanceof antlr.RecognitionException) {
                this.errorHandler.reportError(this, re);
                this.errorHandler.recover(this, re);
            } else {
                throw re;
            }
        }
        finally {
            this.exitRule();
        }
        return localContext;
    }

    public override sempred(localContext: antlr.ParserRuleContext | null, ruleIndex: number, predIndex: number): boolean {
        switch (ruleIndex) {
        case 48:
            return this.directDeclarator_sempred(localContext as DirectDeclaratorContext, predIndex);
        case 62:
            return this.directAbstractDeclarator_sempred(localContext as DirectAbstractDeclaratorContext, predIndex);
        }
        return true;
    }
    private directDeclarator_sempred(localContext: DirectDeclaratorContext | null, predIndex: number): boolean {
        switch (predIndex) {
        case 0:
            return this.precpred(this.context, 9);
        case 1:
            return this.precpred(this.context, 8);
        case 2:
            return this.precpred(this.context, 7);
        case 3:
            return this.precpred(this.context, 6);
        case 4:
            return this.precpred(this.context, 5);
        case 5:
            return this.precpred(this.context, 4);
        }
        return true;
    }
    private directAbstractDeclarator_sempred(localContext: DirectAbstractDeclaratorContext | null, predIndex: number): boolean {
        switch (predIndex) {
        case 6:
            return this.precpred(this.context, 5);
        case 7:
            return this.precpred(this.context, 4);
        case 8:
            return this.precpred(this.context, 3);
        case 9:
            return this.precpred(this.context, 2);
        case 10:
            return this.precpred(this.context, 1);
        }
        return true;
    }

    public static readonly _serializedATN: number[] = [
        4,1,135,1107,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,
        7,6,2,7,7,7,2,8,7,8,2,9,7,9,2,10,7,10,2,11,7,11,2,12,7,12,2,13,7,
        13,2,14,7,14,2,15,7,15,2,16,7,16,2,17,7,17,2,18,7,18,2,19,7,19,2,
        20,7,20,2,21,7,21,2,22,7,22,2,23,7,23,2,24,7,24,2,25,7,25,2,26,7,
        26,2,27,7,27,2,28,7,28,2,29,7,29,2,30,7,30,2,31,7,31,2,32,7,32,2,
        33,7,33,2,34,7,34,2,35,7,35,2,36,7,36,2,37,7,37,2,38,7,38,2,39,7,
        39,2,40,7,40,2,41,7,41,2,42,7,42,2,43,7,43,2,44,7,44,2,45,7,45,2,
        46,7,46,2,47,7,47,2,48,7,48,2,49,7,49,2,50,7,50,2,51,7,51,2,52,7,
        52,2,53,7,53,2,54,7,54,2,55,7,55,2,56,7,56,2,57,7,57,2,58,7,58,2,
        59,7,59,2,60,7,60,2,61,7,61,2,62,7,62,2,63,7,63,2,64,7,64,2,65,7,
        65,2,66,7,66,2,67,7,67,2,68,7,68,2,69,7,69,2,70,7,70,2,71,7,71,2,
        72,7,72,2,73,7,73,2,74,7,74,2,75,7,75,2,76,7,76,2,77,7,77,2,78,7,
        78,2,79,7,79,2,80,7,80,2,81,7,81,2,82,7,82,2,83,7,83,2,84,7,84,2,
        85,7,85,2,86,7,86,1,0,1,0,1,0,4,0,178,8,0,11,0,12,0,179,1,0,1,0,
        1,0,1,0,1,0,1,0,3,0,188,8,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,
        1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,3,0,208,8,0,1,1,1,1,1,1,1,1,
        1,1,1,1,1,1,1,2,1,2,1,2,5,2,220,8,2,10,2,12,2,223,9,2,1,3,1,3,3,
        3,227,8,3,1,3,1,3,1,3,1,4,1,4,3,4,234,8,4,1,4,1,4,1,4,1,4,1,4,1,
        4,3,4,242,8,4,1,4,1,4,3,4,246,8,4,1,4,1,4,1,4,1,4,1,4,1,4,3,4,254,
        8,4,1,4,1,4,1,4,1,4,1,4,5,4,261,8,4,10,4,12,4,264,9,4,1,5,1,5,1,
        5,5,5,269,8,5,10,5,12,5,272,9,5,1,6,5,6,275,8,6,10,6,12,6,278,9,
        6,1,6,1,6,1,6,1,6,1,6,1,6,1,6,1,6,1,6,1,6,1,6,3,6,291,8,6,1,7,1,
        7,1,8,3,8,296,8,8,1,8,1,8,1,8,1,8,1,8,1,8,1,8,3,8,305,8,8,1,9,1,
        9,1,9,5,9,310,8,9,10,9,12,9,313,9,9,1,10,1,10,1,10,5,10,318,8,10,
        10,10,12,10,321,9,10,1,11,1,11,1,11,5,11,326,8,11,10,11,12,11,329,
        9,11,1,12,1,12,1,12,5,12,334,8,12,10,12,12,12,337,9,12,1,13,1,13,
        1,13,5,13,342,8,13,10,13,12,13,345,9,13,1,14,1,14,1,14,5,14,350,
        8,14,10,14,12,14,353,9,14,1,15,1,15,1,15,5,15,358,8,15,10,15,12,
        15,361,9,15,1,16,1,16,1,16,5,16,366,8,16,10,16,12,16,369,9,16,1,
        17,1,17,1,17,5,17,374,8,17,10,17,12,17,377,9,17,1,18,1,18,1,18,5,
        18,382,8,18,10,18,12,18,385,9,18,1,19,1,19,1,19,1,19,1,19,1,19,3,
        19,393,8,19,1,20,1,20,1,20,1,20,1,20,1,20,3,20,401,8,20,1,21,1,21,
        1,22,1,22,1,22,5,22,408,8,22,10,22,12,22,411,9,22,1,23,1,23,1,24,
        1,24,3,24,417,8,24,1,24,1,24,1,24,3,24,422,8,24,1,25,4,25,425,8,
        25,11,25,12,25,426,1,26,4,26,430,8,26,11,26,12,26,431,1,27,1,27,
        1,27,1,27,1,27,3,27,439,8,27,1,28,1,28,1,28,5,28,444,8,28,10,28,
        12,28,447,9,28,1,29,1,29,1,29,3,29,452,8,29,1,30,1,30,1,31,1,31,
        1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,
        1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,1,31,
        1,31,1,31,1,31,1,31,3,31,488,8,31,1,32,1,32,3,32,492,8,32,1,32,1,
        32,1,32,1,32,1,32,1,32,1,32,3,32,501,8,32,1,33,1,33,1,34,4,34,506,
        8,34,11,34,12,34,507,1,35,1,35,1,35,1,35,1,35,1,35,1,35,1,35,3,35,
        518,8,35,1,36,1,36,3,36,522,8,36,1,36,3,36,525,8,36,1,37,1,37,1,
        37,5,37,530,8,37,10,37,12,37,533,9,37,1,38,1,38,3,38,537,8,38,1,
        38,1,38,3,38,541,8,38,1,39,1,39,3,39,545,8,39,1,39,1,39,1,39,3,39,
        550,8,39,1,39,1,39,1,39,1,39,3,39,556,8,39,1,40,1,40,1,40,5,40,561,
        8,40,10,40,12,40,564,9,40,1,41,1,41,1,41,3,41,569,8,41,1,42,1,42,
        1,43,1,43,1,43,1,43,1,43,1,44,1,44,1,45,1,45,1,45,1,45,1,45,1,45,
        1,45,1,45,1,45,1,45,3,45,590,8,45,1,46,1,46,1,46,1,46,3,46,596,8,
        46,1,46,1,46,1,47,3,47,601,8,47,1,47,1,47,5,47,605,8,47,10,47,12,
        47,608,9,47,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,
        48,1,48,1,48,1,48,1,48,1,48,1,48,3,48,627,8,48,1,48,1,48,1,48,3,
        48,632,8,48,1,48,3,48,635,8,48,1,48,1,48,1,48,1,48,1,48,3,48,642,
        8,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,
        1,48,3,48,657,8,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,1,48,
        1,48,3,48,669,8,48,1,48,5,48,672,8,48,10,48,12,48,675,9,48,1,49,
        1,49,1,50,1,50,1,50,4,50,682,8,50,11,50,12,50,683,1,50,1,50,3,50,
        688,8,50,1,51,1,51,1,51,1,51,1,51,1,51,1,51,1,52,3,52,698,8,52,1,
        52,1,52,3,52,702,8,52,5,52,704,8,52,10,52,12,52,707,9,52,1,53,1,
        53,1,53,3,53,712,8,53,1,53,3,53,715,8,53,1,54,1,54,3,54,719,8,54,
        4,54,721,8,54,11,54,12,54,722,1,55,4,55,726,8,55,11,55,12,55,727,
        1,56,1,56,1,56,3,56,733,8,56,1,57,1,57,1,57,5,57,738,8,57,10,57,
        12,57,741,9,57,1,58,1,58,1,58,1,58,1,58,3,58,748,8,58,3,58,750,8,
        58,1,59,1,59,1,59,5,59,755,8,59,10,59,12,59,758,9,59,1,60,1,60,3,
        60,762,8,60,1,61,1,61,3,61,766,8,61,1,61,1,61,5,61,770,8,61,10,61,
        12,61,773,9,61,3,61,775,8,61,1,62,1,62,1,62,1,62,1,62,5,62,782,8,
        62,10,62,12,62,785,9,62,1,62,1,62,3,62,789,8,62,1,62,3,62,792,8,
        62,1,62,1,62,1,62,1,62,3,62,798,8,62,1,62,1,62,1,62,1,62,1,62,1,
        62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,3,62,814,8,62,1,62,1,
        62,5,62,818,8,62,10,62,12,62,821,9,62,3,62,823,8,62,1,62,1,62,1,
        62,3,62,828,8,62,1,62,3,62,831,8,62,1,62,1,62,1,62,1,62,1,62,3,62,
        838,8,62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,1,62,
        1,62,1,62,1,62,1,62,1,62,1,62,3,62,857,8,62,1,62,1,62,5,62,861,8,
        62,10,62,12,62,864,9,62,5,62,866,8,62,10,62,12,62,869,9,62,1,63,
        1,63,1,64,1,64,1,64,1,64,3,64,877,8,64,1,64,1,64,3,64,881,8,64,1,
        65,3,65,884,8,65,1,65,1,65,1,65,3,65,889,8,65,1,65,5,65,892,8,65,
        10,65,12,65,895,9,65,1,66,1,66,1,66,1,67,4,67,901,8,67,11,67,12,
        67,902,1,68,1,68,1,68,1,68,1,68,1,68,3,68,911,8,68,1,69,1,69,1,69,
        1,69,1,69,4,69,918,8,69,11,69,12,69,919,1,69,1,69,1,69,1,70,1,70,
        1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,1,70,5,70,937,8,70,
        10,70,12,70,940,9,70,3,70,942,8,70,1,70,1,70,1,70,1,70,5,70,948,
        8,70,10,70,12,70,951,9,70,3,70,953,8,70,5,70,955,8,70,10,70,12,70,
        958,9,70,1,70,1,70,3,70,962,8,70,1,71,1,71,1,71,3,71,967,8,71,1,
        71,1,71,1,71,1,71,1,71,1,71,1,71,1,71,3,71,977,8,71,1,72,1,72,3,
        72,981,8,72,1,72,1,72,1,73,4,73,986,8,73,11,73,12,73,987,1,74,1,
        74,3,74,992,8,74,1,75,3,75,995,8,75,1,75,1,75,1,76,1,76,1,76,1,76,
        1,76,1,76,1,76,3,76,1006,8,76,1,76,1,76,1,76,1,76,1,76,1,76,3,76,
        1014,8,76,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,
        1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,1,77,3,77,1036,8,77,1,78,
        1,78,3,78,1040,8,78,3,78,1042,8,78,1,78,1,78,3,78,1046,8,78,1,78,
        1,78,3,78,1050,8,78,1,79,1,79,3,79,1054,8,79,1,80,1,80,1,80,5,80,
        1059,8,80,10,80,12,80,1062,9,80,1,81,1,81,1,81,1,81,1,81,1,81,3,
        81,1070,8,81,1,81,1,81,3,81,1074,8,81,1,81,1,81,1,82,3,82,1079,8,
        82,1,82,1,82,1,83,4,83,1084,8,83,11,83,12,83,1085,1,84,1,84,1,84,
        3,84,1091,8,84,1,85,3,85,1094,8,85,1,85,1,85,3,85,1098,8,85,1,85,
        1,85,1,86,4,86,1103,8,86,11,86,12,86,1104,1,86,0,2,96,124,87,0,2,
        4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,
        50,52,54,56,58,60,62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,
        94,96,98,100,102,104,106,108,110,112,114,116,118,120,122,124,126,
        128,130,132,134,136,138,140,142,144,146,148,150,152,154,156,158,
        160,162,164,166,168,170,172,0,20,1,0,122,123,3,0,59,59,92,92,94,
        94,3,0,4,5,59,59,70,70,5,0,91,91,93,93,95,95,98,98,103,104,1,0,95,
        97,2,0,91,91,93,93,1,0,89,90,1,0,85,88,1,0,120,121,1,0,109,119,7,
        0,6,6,35,35,46,46,54,54,60,60,63,63,78,78,1,0,9,11,1,0,15,16,2,0,
        61,61,64,64,5,0,17,22,39,39,55,55,67,67,71,71,2,0,25,25,27,31,1,
        0,32,33,2,0,79,80,108,108,2,0,95,95,102,102,2,0,21,22,67,67,1222,
        0,207,1,0,0,0,2,209,1,0,0,0,4,216,1,0,0,0,6,226,1,0,0,0,8,245,1,
        0,0,0,10,265,1,0,0,0,12,276,1,0,0,0,14,292,1,0,0,0,16,304,1,0,0,
        0,18,306,1,0,0,0,20,314,1,0,0,0,22,322,1,0,0,0,24,330,1,0,0,0,26,
        338,1,0,0,0,28,346,1,0,0,0,30,354,1,0,0,0,32,362,1,0,0,0,34,370,
        1,0,0,0,36,378,1,0,0,0,38,386,1,0,0,0,40,400,1,0,0,0,42,402,1,0,
        0,0,44,404,1,0,0,0,46,412,1,0,0,0,48,421,1,0,0,0,50,424,1,0,0,0,
        52,429,1,0,0,0,54,438,1,0,0,0,56,440,1,0,0,0,58,448,1,0,0,0,60,453,
        1,0,0,0,62,487,1,0,0,0,64,500,1,0,0,0,66,502,1,0,0,0,68,505,1,0,
        0,0,70,517,1,0,0,0,72,521,1,0,0,0,74,526,1,0,0,0,76,540,1,0,0,0,
        78,555,1,0,0,0,80,557,1,0,0,0,82,565,1,0,0,0,84,570,1,0,0,0,86,572,
        1,0,0,0,88,577,1,0,0,0,90,589,1,0,0,0,92,591,1,0,0,0,94,600,1,0,
        0,0,96,626,1,0,0,0,98,676,1,0,0,0,100,687,1,0,0,0,102,689,1,0,0,
        0,104,697,1,0,0,0,106,708,1,0,0,0,108,720,1,0,0,0,110,725,1,0,0,
        0,112,729,1,0,0,0,114,734,1,0,0,0,116,749,1,0,0,0,118,751,1,0,0,
        0,120,759,1,0,0,0,122,774,1,0,0,0,124,822,1,0,0,0,126,870,1,0,0,
        0,128,880,1,0,0,0,130,883,1,0,0,0,132,896,1,0,0,0,134,900,1,0,0,
        0,136,910,1,0,0,0,138,912,1,0,0,0,140,961,1,0,0,0,142,976,1,0,0,
        0,144,978,1,0,0,0,146,985,1,0,0,0,148,991,1,0,0,0,150,994,1,0,0,
        0,152,1013,1,0,0,0,154,1035,1,0,0,0,156,1041,1,0,0,0,158,1051,1,
        0,0,0,160,1055,1,0,0,0,162,1073,1,0,0,0,164,1078,1,0,0,0,166,1083,
        1,0,0,0,168,1090,1,0,0,0,170,1093,1,0,0,0,172,1102,1,0,0,0,174,208,
        5,125,0,0,175,208,5,126,0,0,176,178,5,128,0,0,177,176,1,0,0,0,178,
        179,1,0,0,0,179,177,1,0,0,0,179,180,1,0,0,0,180,208,1,0,0,0,181,
        182,5,79,0,0,182,183,3,44,22,0,183,184,5,80,0,0,184,208,1,0,0,0,
        185,208,3,2,1,0,186,188,5,1,0,0,187,186,1,0,0,0,187,188,1,0,0,0,
        188,189,1,0,0,0,189,190,5,79,0,0,190,191,3,144,72,0,191,192,5,80,
        0,0,192,208,1,0,0,0,193,194,5,2,0,0,194,195,5,79,0,0,195,196,3,12,
        6,0,196,197,5,108,0,0,197,198,3,120,60,0,198,199,5,80,0,0,199,208,
        1,0,0,0,200,201,5,3,0,0,201,202,5,79,0,0,202,203,3,120,60,0,203,
        204,5,108,0,0,204,205,3,12,6,0,205,206,5,80,0,0,206,208,1,0,0,0,
        207,174,1,0,0,0,207,175,1,0,0,0,207,177,1,0,0,0,207,181,1,0,0,0,
        207,185,1,0,0,0,207,187,1,0,0,0,207,193,1,0,0,0,207,200,1,0,0,0,
        208,1,1,0,0,0,209,210,5,74,0,0,210,211,5,79,0,0,211,212,3,40,20,
        0,212,213,5,108,0,0,213,214,3,4,2,0,214,215,5,80,0,0,215,3,1,0,0,
        0,216,221,3,6,3,0,217,218,5,108,0,0,218,220,3,6,3,0,219,217,1,0,
        0,0,220,223,1,0,0,0,221,219,1,0,0,0,221,222,1,0,0,0,222,5,1,0,0,
        0,223,221,1,0,0,0,224,227,3,120,60,0,225,227,5,41,0,0,226,224,1,
        0,0,0,226,225,1,0,0,0,227,228,1,0,0,0,228,229,5,106,0,0,229,230,
        3,40,20,0,230,7,1,0,0,0,231,246,3,0,0,0,232,234,5,1,0,0,233,232,
        1,0,0,0,233,234,1,0,0,0,234,235,1,0,0,0,235,236,5,79,0,0,236,237,
        3,120,60,0,237,238,5,80,0,0,238,239,5,83,0,0,239,241,3,130,65,0,
        240,242,5,108,0,0,241,240,1,0,0,0,241,242,1,0,0,0,242,243,1,0,0,
        0,243,244,5,84,0,0,244,246,1,0,0,0,245,231,1,0,0,0,245,233,1,0,0,
        0,246,262,1,0,0,0,247,248,5,81,0,0,248,249,3,44,22,0,249,250,5,82,
        0,0,250,261,1,0,0,0,251,253,5,79,0,0,252,254,3,10,5,0,253,252,1,
        0,0,0,253,254,1,0,0,0,254,255,1,0,0,0,255,261,5,80,0,0,256,257,7,
        0,0,0,257,261,5,125,0,0,258,261,5,92,0,0,259,261,5,94,0,0,260,247,
        1,0,0,0,260,251,1,0,0,0,260,256,1,0,0,0,260,258,1,0,0,0,260,259,
        1,0,0,0,261,264,1,0,0,0,262,260,1,0,0,0,262,263,1,0,0,0,263,9,1,
        0,0,0,264,262,1,0,0,0,265,270,3,40,20,0,266,267,5,108,0,0,267,269,
        3,40,20,0,268,266,1,0,0,0,269,272,1,0,0,0,270,268,1,0,0,0,270,271,
        1,0,0,0,271,11,1,0,0,0,272,270,1,0,0,0,273,275,7,1,0,0,274,273,1,
        0,0,0,275,278,1,0,0,0,276,274,1,0,0,0,276,277,1,0,0,0,277,290,1,
        0,0,0,278,276,1,0,0,0,279,291,3,8,4,0,280,281,3,14,7,0,281,282,3,
        16,8,0,282,291,1,0,0,0,283,284,7,2,0,0,284,285,5,79,0,0,285,286,
        3,120,60,0,286,287,5,80,0,0,287,291,1,0,0,0,288,289,5,100,0,0,289,
        291,5,125,0,0,290,279,1,0,0,0,290,280,1,0,0,0,290,283,1,0,0,0,290,
        288,1,0,0,0,291,13,1,0,0,0,292,293,7,3,0,0,293,15,1,0,0,0,294,296,
        5,1,0,0,295,294,1,0,0,0,295,296,1,0,0,0,296,297,1,0,0,0,297,298,
        5,79,0,0,298,299,3,120,60,0,299,300,5,80,0,0,300,301,3,16,8,0,301,
        305,1,0,0,0,302,305,3,12,6,0,303,305,5,127,0,0,304,295,1,0,0,0,304,
        302,1,0,0,0,304,303,1,0,0,0,305,17,1,0,0,0,306,311,3,16,8,0,307,
        308,7,4,0,0,308,310,3,16,8,0,309,307,1,0,0,0,310,313,1,0,0,0,311,
        309,1,0,0,0,311,312,1,0,0,0,312,19,1,0,0,0,313,311,1,0,0,0,314,319,
        3,18,9,0,315,316,7,5,0,0,316,318,3,18,9,0,317,315,1,0,0,0,318,321,
        1,0,0,0,319,317,1,0,0,0,319,320,1,0,0,0,320,21,1,0,0,0,321,319,1,
        0,0,0,322,327,3,20,10,0,323,324,7,6,0,0,324,326,3,20,10,0,325,323,
        1,0,0,0,326,329,1,0,0,0,327,325,1,0,0,0,327,328,1,0,0,0,328,23,1,
        0,0,0,329,327,1,0,0,0,330,335,3,22,11,0,331,332,7,7,0,0,332,334,
        3,22,11,0,333,331,1,0,0,0,334,337,1,0,0,0,335,333,1,0,0,0,335,336,
        1,0,0,0,336,25,1,0,0,0,337,335,1,0,0,0,338,343,3,24,12,0,339,340,
        7,8,0,0,340,342,3,24,12,0,341,339,1,0,0,0,342,345,1,0,0,0,343,341,
        1,0,0,0,343,344,1,0,0,0,344,27,1,0,0,0,345,343,1,0,0,0,346,351,3,
        26,13,0,347,348,5,98,0,0,348,350,3,26,13,0,349,347,1,0,0,0,350,353,
        1,0,0,0,351,349,1,0,0,0,351,352,1,0,0,0,352,29,1,0,0,0,353,351,1,
        0,0,0,354,359,3,28,14,0,355,356,5,102,0,0,356,358,3,28,14,0,357,
        355,1,0,0,0,358,361,1,0,0,0,359,357,1,0,0,0,359,360,1,0,0,0,360,
        31,1,0,0,0,361,359,1,0,0,0,362,367,3,30,15,0,363,364,5,99,0,0,364,
        366,3,30,15,0,365,363,1,0,0,0,366,369,1,0,0,0,367,365,1,0,0,0,367,
        368,1,0,0,0,368,33,1,0,0,0,369,367,1,0,0,0,370,375,3,32,16,0,371,
        372,5,100,0,0,372,374,3,32,16,0,373,371,1,0,0,0,374,377,1,0,0,0,
        375,373,1,0,0,0,375,376,1,0,0,0,376,35,1,0,0,0,377,375,1,0,0,0,378,
        383,3,34,17,0,379,380,5,101,0,0,380,382,3,34,17,0,381,379,1,0,0,
        0,382,385,1,0,0,0,383,381,1,0,0,0,383,384,1,0,0,0,384,37,1,0,0,0,
        385,383,1,0,0,0,386,392,3,36,18,0,387,388,5,105,0,0,388,389,3,44,
        22,0,389,390,5,106,0,0,390,391,3,38,19,0,391,393,1,0,0,0,392,387,
        1,0,0,0,392,393,1,0,0,0,393,39,1,0,0,0,394,401,3,38,19,0,395,396,
        3,12,6,0,396,397,3,42,21,0,397,398,3,40,20,0,398,401,1,0,0,0,399,
        401,5,127,0,0,400,394,1,0,0,0,400,395,1,0,0,0,400,399,1,0,0,0,401,
        41,1,0,0,0,402,403,7,9,0,0,403,43,1,0,0,0,404,409,3,40,20,0,405,
        406,5,108,0,0,406,408,3,40,20,0,407,405,1,0,0,0,408,411,1,0,0,0,
        409,407,1,0,0,0,409,410,1,0,0,0,410,45,1,0,0,0,411,409,1,0,0,0,412,
        413,3,38,19,0,413,47,1,0,0,0,414,416,3,50,25,0,415,417,3,56,28,0,
        416,415,1,0,0,0,416,417,1,0,0,0,417,418,1,0,0,0,418,419,5,107,0,
        0,419,422,1,0,0,0,420,422,3,138,69,0,421,414,1,0,0,0,421,420,1,0,
        0,0,422,49,1,0,0,0,423,425,3,54,27,0,424,423,1,0,0,0,425,426,1,0,
        0,0,426,424,1,0,0,0,426,427,1,0,0,0,427,51,1,0,0,0,428,430,3,54,
        27,0,429,428,1,0,0,0,430,431,1,0,0,0,431,429,1,0,0,0,431,432,1,0,
        0,0,432,53,1,0,0,0,433,439,3,60,30,0,434,439,3,62,31,0,435,439,3,
        88,44,0,436,439,3,90,45,0,437,439,3,92,46,0,438,433,1,0,0,0,438,
        434,1,0,0,0,438,435,1,0,0,0,438,436,1,0,0,0,438,437,1,0,0,0,439,
        55,1,0,0,0,440,445,3,58,29,0,441,442,5,108,0,0,442,444,3,58,29,0,
        443,441,1,0,0,0,444,447,1,0,0,0,445,443,1,0,0,0,445,446,1,0,0,0,
        446,57,1,0,0,0,447,445,1,0,0,0,448,451,3,94,47,0,449,450,5,109,0,
        0,450,452,3,128,64,0,451,449,1,0,0,0,451,452,1,0,0,0,452,59,1,0,
        0,0,453,454,7,10,0,0,454,61,1,0,0,0,455,488,5,66,0,0,456,488,5,38,
        0,0,457,488,5,57,0,0,458,488,5,52,0,0,459,488,5,53,0,0,460,488,5,
        47,0,0,461,488,5,43,0,0,462,488,5,58,0,0,463,488,5,7,0,0,464,488,
        5,8,0,0,465,488,5,65,0,0,466,488,5,72,0,0,467,488,5,73,0,0,468,488,
        5,9,0,0,469,488,5,10,0,0,470,488,5,11,0,0,471,488,5,12,0,0,472,488,
        5,13,0,0,473,488,5,14,0,0,474,475,5,1,0,0,475,476,5,79,0,0,476,477,
        7,11,0,0,477,488,5,80,0,0,478,488,3,86,43,0,479,488,3,64,32,0,480,
        488,3,78,39,0,481,488,3,126,63,0,482,483,7,12,0,0,483,484,5,79,0,
        0,484,485,3,46,23,0,485,486,5,80,0,0,486,488,1,0,0,0,487,455,1,0,
        0,0,487,456,1,0,0,0,487,457,1,0,0,0,487,458,1,0,0,0,487,459,1,0,
        0,0,487,460,1,0,0,0,487,461,1,0,0,0,487,462,1,0,0,0,487,463,1,0,
        0,0,487,464,1,0,0,0,487,465,1,0,0,0,487,466,1,0,0,0,487,467,1,0,
        0,0,487,468,1,0,0,0,487,469,1,0,0,0,487,470,1,0,0,0,487,471,1,0,
        0,0,487,472,1,0,0,0,487,473,1,0,0,0,487,474,1,0,0,0,487,478,1,0,
        0,0,487,479,1,0,0,0,487,480,1,0,0,0,487,481,1,0,0,0,487,482,1,0,
        0,0,488,63,1,0,0,0,489,491,3,66,33,0,490,492,5,125,0,0,491,490,1,
        0,0,0,491,492,1,0,0,0,492,493,1,0,0,0,493,494,5,83,0,0,494,495,3,
        68,34,0,495,496,5,84,0,0,496,501,1,0,0,0,497,498,3,66,33,0,498,499,
        5,125,0,0,499,501,1,0,0,0,500,489,1,0,0,0,500,497,1,0,0,0,501,65,
        1,0,0,0,502,503,7,13,0,0,503,67,1,0,0,0,504,506,3,70,35,0,505,504,
        1,0,0,0,506,507,1,0,0,0,507,505,1,0,0,0,507,508,1,0,0,0,508,69,1,
        0,0,0,509,510,3,72,36,0,510,511,3,74,37,0,511,512,5,107,0,0,512,
        518,1,0,0,0,513,514,3,72,36,0,514,515,5,107,0,0,515,518,1,0,0,0,
        516,518,3,138,69,0,517,509,1,0,0,0,517,513,1,0,0,0,517,516,1,0,0,
        0,518,71,1,0,0,0,519,522,3,62,31,0,520,522,3,88,44,0,521,519,1,0,
        0,0,521,520,1,0,0,0,522,524,1,0,0,0,523,525,3,72,36,0,524,523,1,
        0,0,0,524,525,1,0,0,0,525,73,1,0,0,0,526,531,3,76,38,0,527,528,5,
        108,0,0,528,530,3,76,38,0,529,527,1,0,0,0,530,533,1,0,0,0,531,529,
        1,0,0,0,531,532,1,0,0,0,532,75,1,0,0,0,533,531,1,0,0,0,534,541,3,
        94,47,0,535,537,3,94,47,0,536,535,1,0,0,0,536,537,1,0,0,0,537,538,
        1,0,0,0,538,539,5,106,0,0,539,541,3,46,23,0,540,534,1,0,0,0,540,
        536,1,0,0,0,541,77,1,0,0,0,542,544,5,45,0,0,543,545,5,125,0,0,544,
        543,1,0,0,0,544,545,1,0,0,0,545,546,1,0,0,0,546,547,5,83,0,0,547,
        549,3,80,40,0,548,550,5,108,0,0,549,548,1,0,0,0,549,550,1,0,0,0,
        550,551,1,0,0,0,551,552,5,84,0,0,552,556,1,0,0,0,553,554,5,45,0,
        0,554,556,5,125,0,0,555,542,1,0,0,0,555,553,1,0,0,0,556,79,1,0,0,
        0,557,562,3,82,41,0,558,559,5,108,0,0,559,561,3,82,41,0,560,558,
        1,0,0,0,561,564,1,0,0,0,562,560,1,0,0,0,562,563,1,0,0,0,563,81,1,
        0,0,0,564,562,1,0,0,0,565,568,3,84,42,0,566,567,5,109,0,0,567,569,
        3,46,23,0,568,566,1,0,0,0,568,569,1,0,0,0,569,83,1,0,0,0,570,571,
        5,125,0,0,571,85,1,0,0,0,572,573,5,71,0,0,573,574,5,79,0,0,574,575,
        3,120,60,0,575,576,5,80,0,0,576,87,1,0,0,0,577,578,7,14,0,0,578,
        89,1,0,0,0,579,590,5,51,0,0,580,590,5,76,0,0,581,590,5,23,0,0,582,
        590,5,24,0,0,583,590,5,25,0,0,584,590,3,102,51,0,585,586,5,26,0,
        0,586,587,5,79,0,0,587,588,5,125,0,0,588,590,5,80,0,0,589,579,1,
        0,0,0,589,580,1,0,0,0,589,581,1,0,0,0,589,582,1,0,0,0,589,583,1,
        0,0,0,589,584,1,0,0,0,589,585,1,0,0,0,590,91,1,0,0,0,591,592,5,69,
        0,0,592,595,5,79,0,0,593,596,3,120,60,0,594,596,3,46,23,0,595,593,
        1,0,0,0,595,594,1,0,0,0,596,597,1,0,0,0,597,598,5,80,0,0,598,93,
        1,0,0,0,599,601,3,108,54,0,600,599,1,0,0,0,600,601,1,0,0,0,601,602,
        1,0,0,0,602,606,3,96,48,0,603,605,3,100,50,0,604,603,1,0,0,0,605,
        608,1,0,0,0,606,604,1,0,0,0,606,607,1,0,0,0,607,95,1,0,0,0,608,606,
        1,0,0,0,609,610,6,48,-1,0,610,627,5,125,0,0,611,612,5,79,0,0,612,
        613,3,94,47,0,613,614,5,80,0,0,614,627,1,0,0,0,615,616,5,125,0,0,
        616,617,5,106,0,0,617,627,5,127,0,0,618,619,3,98,49,0,619,620,5,
        125,0,0,620,627,1,0,0,0,621,622,5,79,0,0,622,623,3,98,49,0,623,624,
        3,94,47,0,624,625,5,80,0,0,625,627,1,0,0,0,626,609,1,0,0,0,626,611,
        1,0,0,0,626,615,1,0,0,0,626,618,1,0,0,0,626,621,1,0,0,0,627,673,
        1,0,0,0,628,629,10,9,0,0,629,631,5,81,0,0,630,632,3,110,55,0,631,
        630,1,0,0,0,631,632,1,0,0,0,632,634,1,0,0,0,633,635,3,40,20,0,634,
        633,1,0,0,0,634,635,1,0,0,0,635,636,1,0,0,0,636,672,5,82,0,0,637,
        638,10,8,0,0,638,639,5,81,0,0,639,641,5,60,0,0,640,642,3,110,55,
        0,641,640,1,0,0,0,641,642,1,0,0,0,642,643,1,0,0,0,643,644,3,40,20,
        0,644,645,5,82,0,0,645,672,1,0,0,0,646,647,10,7,0,0,647,648,5,81,
        0,0,648,649,3,110,55,0,649,650,5,60,0,0,650,651,3,40,20,0,651,652,
        5,82,0,0,652,672,1,0,0,0,653,654,10,6,0,0,654,656,5,81,0,0,655,657,
        3,110,55,0,656,655,1,0,0,0,656,657,1,0,0,0,657,658,1,0,0,0,658,659,
        5,95,0,0,659,672,5,82,0,0,660,661,10,5,0,0,661,662,5,79,0,0,662,
        663,3,112,56,0,663,664,5,80,0,0,664,672,1,0,0,0,665,666,10,4,0,0,
        666,668,5,79,0,0,667,669,3,118,59,0,668,667,1,0,0,0,668,669,1,0,
        0,0,669,670,1,0,0,0,670,672,5,80,0,0,671,628,1,0,0,0,671,637,1,0,
        0,0,671,646,1,0,0,0,671,653,1,0,0,0,671,660,1,0,0,0,671,665,1,0,
        0,0,672,675,1,0,0,0,673,671,1,0,0,0,673,674,1,0,0,0,674,97,1,0,0,
        0,675,673,1,0,0,0,676,677,7,15,0,0,677,99,1,0,0,0,678,679,7,16,0,
        0,679,681,5,79,0,0,680,682,5,128,0,0,681,680,1,0,0,0,682,683,1,0,
        0,0,683,681,1,0,0,0,683,684,1,0,0,0,684,685,1,0,0,0,685,688,5,80,
        0,0,686,688,3,102,51,0,687,678,1,0,0,0,687,686,1,0,0,0,688,101,1,
        0,0,0,689,690,5,34,0,0,690,691,5,79,0,0,691,692,5,79,0,0,692,693,
        3,104,52,0,693,694,5,80,0,0,694,695,5,80,0,0,695,103,1,0,0,0,696,
        698,3,106,53,0,697,696,1,0,0,0,697,698,1,0,0,0,698,705,1,0,0,0,699,
        701,5,108,0,0,700,702,3,106,53,0,701,700,1,0,0,0,701,702,1,0,0,0,
        702,704,1,0,0,0,703,699,1,0,0,0,704,707,1,0,0,0,705,703,1,0,0,0,
        705,706,1,0,0,0,706,105,1,0,0,0,707,705,1,0,0,0,708,714,8,17,0,0,
        709,711,5,79,0,0,710,712,3,10,5,0,711,710,1,0,0,0,711,712,1,0,0,
        0,712,713,1,0,0,0,713,715,5,80,0,0,714,709,1,0,0,0,714,715,1,0,0,
        0,715,107,1,0,0,0,716,718,7,18,0,0,717,719,3,110,55,0,718,717,1,
        0,0,0,718,719,1,0,0,0,719,721,1,0,0,0,720,716,1,0,0,0,721,722,1,
        0,0,0,722,720,1,0,0,0,722,723,1,0,0,0,723,109,1,0,0,0,724,726,3,
        88,44,0,725,724,1,0,0,0,726,727,1,0,0,0,727,725,1,0,0,0,727,728,
        1,0,0,0,728,111,1,0,0,0,729,732,3,114,57,0,730,731,5,108,0,0,731,
        733,5,124,0,0,732,730,1,0,0,0,732,733,1,0,0,0,733,113,1,0,0,0,734,
        739,3,116,58,0,735,736,5,108,0,0,736,738,3,116,58,0,737,735,1,0,
        0,0,738,741,1,0,0,0,739,737,1,0,0,0,739,740,1,0,0,0,740,115,1,0,
        0,0,741,739,1,0,0,0,742,743,3,50,25,0,743,744,3,94,47,0,744,750,
        1,0,0,0,745,747,3,52,26,0,746,748,3,122,61,0,747,746,1,0,0,0,747,
        748,1,0,0,0,748,750,1,0,0,0,749,742,1,0,0,0,749,745,1,0,0,0,750,
        117,1,0,0,0,751,756,5,125,0,0,752,753,5,108,0,0,753,755,5,125,0,
        0,754,752,1,0,0,0,755,758,1,0,0,0,756,754,1,0,0,0,756,757,1,0,0,
        0,757,119,1,0,0,0,758,756,1,0,0,0,759,761,3,72,36,0,760,762,3,122,
        61,0,761,760,1,0,0,0,761,762,1,0,0,0,762,121,1,0,0,0,763,775,3,108,
        54,0,764,766,3,108,54,0,765,764,1,0,0,0,765,766,1,0,0,0,766,767,
        1,0,0,0,767,771,3,124,62,0,768,770,3,100,50,0,769,768,1,0,0,0,770,
        773,1,0,0,0,771,769,1,0,0,0,771,772,1,0,0,0,772,775,1,0,0,0,773,
        771,1,0,0,0,774,763,1,0,0,0,774,765,1,0,0,0,775,123,1,0,0,0,776,
        777,6,62,-1,0,777,778,5,79,0,0,778,779,3,122,61,0,779,783,5,80,0,
        0,780,782,3,100,50,0,781,780,1,0,0,0,782,785,1,0,0,0,783,781,1,0,
        0,0,783,784,1,0,0,0,784,823,1,0,0,0,785,783,1,0,0,0,786,788,5,81,
        0,0,787,789,3,110,55,0,788,787,1,0,0,0,788,789,1,0,0,0,789,791,1,
        0,0,0,790,792,3,40,20,0,791,790,1,0,0,0,791,792,1,0,0,0,792,793,
        1,0,0,0,793,823,5,82,0,0,794,795,5,81,0,0,795,797,5,60,0,0,796,798,
        3,110,55,0,797,796,1,0,0,0,797,798,1,0,0,0,798,799,1,0,0,0,799,800,
        3,40,20,0,800,801,5,82,0,0,801,823,1,0,0,0,802,803,5,81,0,0,803,
        804,3,110,55,0,804,805,5,60,0,0,805,806,3,40,20,0,806,807,5,82,0,
        0,807,823,1,0,0,0,808,809,5,81,0,0,809,810,5,95,0,0,810,823,5,82,
        0,0,811,813,5,79,0,0,812,814,3,112,56,0,813,812,1,0,0,0,813,814,
        1,0,0,0,814,815,1,0,0,0,815,819,5,80,0,0,816,818,3,100,50,0,817,
        816,1,0,0,0,818,821,1,0,0,0,819,817,1,0,0,0,819,820,1,0,0,0,820,
        823,1,0,0,0,821,819,1,0,0,0,822,776,1,0,0,0,822,786,1,0,0,0,822,
        794,1,0,0,0,822,802,1,0,0,0,822,808,1,0,0,0,822,811,1,0,0,0,823,
        867,1,0,0,0,824,825,10,5,0,0,825,827,5,81,0,0,826,828,3,110,55,0,
        827,826,1,0,0,0,827,828,1,0,0,0,828,830,1,0,0,0,829,831,3,40,20,
        0,830,829,1,0,0,0,830,831,1,0,0,0,831,832,1,0,0,0,832,866,5,82,0,
        0,833,834,10,4,0,0,834,835,5,81,0,0,835,837,5,60,0,0,836,838,3,110,
        55,0,837,836,1,0,0,0,837,838,1,0,0,0,838,839,1,0,0,0,839,840,3,40,
        20,0,840,841,5,82,0,0,841,866,1,0,0,0,842,843,10,3,0,0,843,844,5,
        81,0,0,844,845,3,110,55,0,845,846,5,60,0,0,846,847,3,40,20,0,847,
        848,5,82,0,0,848,866,1,0,0,0,849,850,10,2,0,0,850,851,5,81,0,0,851,
        852,5,95,0,0,852,866,5,82,0,0,853,854,10,1,0,0,854,856,5,79,0,0,
        855,857,3,112,56,0,856,855,1,0,0,0,856,857,1,0,0,0,857,858,1,0,0,
        0,858,862,5,80,0,0,859,861,3,100,50,0,860,859,1,0,0,0,861,864,1,
        0,0,0,862,860,1,0,0,0,862,863,1,0,0,0,863,866,1,0,0,0,864,862,1,
        0,0,0,865,824,1,0,0,0,865,833,1,0,0,0,865,842,1,0,0,0,865,849,1,
        0,0,0,865,853,1,0,0,0,866,869,1,0,0,0,867,865,1,0,0,0,867,868,1,
        0,0,0,868,125,1,0,0,0,869,867,1,0,0,0,870,871,5,125,0,0,871,127,
        1,0,0,0,872,881,3,40,20,0,873,874,5,83,0,0,874,876,3,130,65,0,875,
        877,5,108,0,0,876,875,1,0,0,0,876,877,1,0,0,0,877,878,1,0,0,0,878,
        879,5,84,0,0,879,881,1,0,0,0,880,872,1,0,0,0,880,873,1,0,0,0,881,
        129,1,0,0,0,882,884,3,132,66,0,883,882,1,0,0,0,883,884,1,0,0,0,884,
        885,1,0,0,0,885,893,3,128,64,0,886,888,5,108,0,0,887,889,3,132,66,
        0,888,887,1,0,0,0,888,889,1,0,0,0,889,890,1,0,0,0,890,892,3,128,
        64,0,891,886,1,0,0,0,892,895,1,0,0,0,893,891,1,0,0,0,893,894,1,0,
        0,0,894,131,1,0,0,0,895,893,1,0,0,0,896,897,3,134,67,0,897,898,5,
        109,0,0,898,133,1,0,0,0,899,901,3,136,68,0,900,899,1,0,0,0,901,902,
        1,0,0,0,902,900,1,0,0,0,902,903,1,0,0,0,903,135,1,0,0,0,904,905,
        5,81,0,0,905,906,3,46,23,0,906,907,5,82,0,0,907,911,1,0,0,0,908,
        909,5,123,0,0,909,911,5,125,0,0,910,904,1,0,0,0,910,908,1,0,0,0,
        911,137,1,0,0,0,912,913,5,77,0,0,913,914,5,79,0,0,914,915,3,46,23,
        0,915,917,5,108,0,0,916,918,5,128,0,0,917,916,1,0,0,0,918,919,1,
        0,0,0,919,917,1,0,0,0,919,920,1,0,0,0,920,921,1,0,0,0,921,922,5,
        80,0,0,922,923,5,107,0,0,923,139,1,0,0,0,924,962,3,142,71,0,925,
        962,3,144,72,0,926,962,3,150,75,0,927,962,3,152,76,0,928,962,3,154,
        77,0,929,962,3,162,81,0,930,931,7,16,0,0,931,932,7,19,0,0,932,941,
        5,79,0,0,933,938,3,36,18,0,934,935,5,108,0,0,935,937,3,36,18,0,936,
        934,1,0,0,0,937,940,1,0,0,0,938,936,1,0,0,0,938,939,1,0,0,0,939,
        942,1,0,0,0,940,938,1,0,0,0,941,933,1,0,0,0,941,942,1,0,0,0,942,
        956,1,0,0,0,943,952,5,106,0,0,944,949,3,36,18,0,945,946,5,108,0,
        0,946,948,3,36,18,0,947,945,1,0,0,0,948,951,1,0,0,0,949,947,1,0,
        0,0,949,950,1,0,0,0,950,953,1,0,0,0,951,949,1,0,0,0,952,944,1,0,
        0,0,952,953,1,0,0,0,953,955,1,0,0,0,954,943,1,0,0,0,955,958,1,0,
        0,0,956,954,1,0,0,0,956,957,1,0,0,0,957,959,1,0,0,0,958,956,1,0,
        0,0,959,960,5,80,0,0,960,962,5,107,0,0,961,924,1,0,0,0,961,925,1,
        0,0,0,961,926,1,0,0,0,961,927,1,0,0,0,961,928,1,0,0,0,961,929,1,
        0,0,0,961,930,1,0,0,0,962,141,1,0,0,0,963,964,5,125,0,0,964,966,
        5,106,0,0,965,967,3,140,70,0,966,965,1,0,0,0,966,967,1,0,0,0,967,
        977,1,0,0,0,968,969,5,37,0,0,969,970,3,46,23,0,970,971,5,106,0,0,
        971,972,3,140,70,0,972,977,1,0,0,0,973,974,5,41,0,0,974,975,5,106,
        0,0,975,977,3,140,70,0,976,963,1,0,0,0,976,968,1,0,0,0,976,973,1,
        0,0,0,977,143,1,0,0,0,978,980,5,83,0,0,979,981,3,146,73,0,980,979,
        1,0,0,0,980,981,1,0,0,0,981,982,1,0,0,0,982,983,5,84,0,0,983,145,
        1,0,0,0,984,986,3,148,74,0,985,984,1,0,0,0,986,987,1,0,0,0,987,985,
        1,0,0,0,987,988,1,0,0,0,988,147,1,0,0,0,989,992,3,140,70,0,990,992,
        3,48,24,0,991,989,1,0,0,0,991,990,1,0,0,0,992,149,1,0,0,0,993,995,
        3,44,22,0,994,993,1,0,0,0,994,995,1,0,0,0,995,996,1,0,0,0,996,997,
        5,107,0,0,997,151,1,0,0,0,998,999,5,50,0,0,999,1000,5,79,0,0,1000,
        1001,3,44,22,0,1001,1002,5,80,0,0,1002,1005,3,140,70,0,1003,1004,
        5,44,0,0,1004,1006,3,140,70,0,1005,1003,1,0,0,0,1005,1006,1,0,0,
        0,1006,1014,1,0,0,0,1007,1008,5,62,0,0,1008,1009,5,79,0,0,1009,1010,
        3,44,22,0,1010,1011,5,80,0,0,1011,1012,3,140,70,0,1012,1014,1,0,
        0,0,1013,998,1,0,0,0,1013,1007,1,0,0,0,1014,153,1,0,0,0,1015,1016,
        5,68,0,0,1016,1017,5,79,0,0,1017,1018,3,44,22,0,1018,1019,5,80,0,
        0,1019,1020,3,140,70,0,1020,1036,1,0,0,0,1021,1022,5,42,0,0,1022,
        1023,3,140,70,0,1023,1024,5,68,0,0,1024,1025,5,79,0,0,1025,1026,
        3,44,22,0,1026,1027,5,80,0,0,1027,1028,5,107,0,0,1028,1036,1,0,0,
        0,1029,1030,5,48,0,0,1030,1031,5,79,0,0,1031,1032,3,156,78,0,1032,
        1033,5,80,0,0,1033,1034,3,140,70,0,1034,1036,1,0,0,0,1035,1015,1,
        0,0,0,1035,1021,1,0,0,0,1035,1029,1,0,0,0,1036,155,1,0,0,0,1037,
        1042,3,158,79,0,1038,1040,3,44,22,0,1039,1038,1,0,0,0,1039,1040,
        1,0,0,0,1040,1042,1,0,0,0,1041,1037,1,0,0,0,1041,1039,1,0,0,0,1042,
        1043,1,0,0,0,1043,1045,5,107,0,0,1044,1046,3,160,80,0,1045,1044,
        1,0,0,0,1045,1046,1,0,0,0,1046,1047,1,0,0,0,1047,1049,5,107,0,0,
        1048,1050,3,160,80,0,1049,1048,1,0,0,0,1049,1050,1,0,0,0,1050,157,
        1,0,0,0,1051,1053,3,50,25,0,1052,1054,3,56,28,0,1053,1052,1,0,0,
        0,1053,1054,1,0,0,0,1054,159,1,0,0,0,1055,1060,3,40,20,0,1056,1057,
        5,108,0,0,1057,1059,3,40,20,0,1058,1056,1,0,0,0,1059,1062,1,0,0,
        0,1060,1058,1,0,0,0,1060,1061,1,0,0,0,1061,161,1,0,0,0,1062,1060,
        1,0,0,0,1063,1064,5,49,0,0,1064,1074,5,125,0,0,1065,1074,5,40,0,
        0,1066,1074,5,36,0,0,1067,1069,5,56,0,0,1068,1070,3,44,22,0,1069,
        1068,1,0,0,0,1069,1070,1,0,0,0,1070,1074,1,0,0,0,1071,1072,5,49,
        0,0,1072,1074,3,12,6,0,1073,1063,1,0,0,0,1073,1065,1,0,0,0,1073,
        1066,1,0,0,0,1073,1067,1,0,0,0,1073,1071,1,0,0,0,1074,1075,1,0,0,
        0,1075,1076,5,107,0,0,1076,163,1,0,0,0,1077,1079,3,166,83,0,1078,
        1077,1,0,0,0,1078,1079,1,0,0,0,1079,1080,1,0,0,0,1080,1081,5,0,0,
        1,1081,165,1,0,0,0,1082,1084,3,168,84,0,1083,1082,1,0,0,0,1084,1085,
        1,0,0,0,1085,1083,1,0,0,0,1085,1086,1,0,0,0,1086,167,1,0,0,0,1087,
        1091,3,170,85,0,1088,1091,3,48,24,0,1089,1091,5,107,0,0,1090,1087,
        1,0,0,0,1090,1088,1,0,0,0,1090,1089,1,0,0,0,1091,169,1,0,0,0,1092,
        1094,3,50,25,0,1093,1092,1,0,0,0,1093,1094,1,0,0,0,1094,1095,1,0,
        0,0,1095,1097,3,94,47,0,1096,1098,3,172,86,0,1097,1096,1,0,0,0,1097,
        1098,1,0,0,0,1098,1099,1,0,0,0,1099,1100,3,144,72,0,1100,171,1,0,
        0,0,1101,1103,3,48,24,0,1102,1101,1,0,0,0,1103,1104,1,0,0,0,1104,
        1102,1,0,0,0,1104,1105,1,0,0,0,1105,173,1,0,0,0,133,179,187,207,
        221,226,233,241,245,253,260,262,270,276,290,295,304,311,319,327,
        335,343,351,359,367,375,383,392,400,409,416,421,426,431,438,445,
        451,487,491,500,507,517,521,524,531,536,540,544,549,555,562,568,
        589,595,600,606,626,631,634,641,656,668,671,673,683,687,697,701,
        705,711,714,718,722,727,732,739,747,749,756,761,765,771,774,783,
        788,791,797,813,819,822,827,830,837,856,862,865,867,876,880,883,
        888,893,902,910,919,938,941,949,952,956,961,966,976,980,987,991,
        994,1005,1013,1035,1039,1041,1045,1049,1053,1060,1069,1073,1078,
        1085,1090,1093,1097,1104
    ];

    private static __ATN: antlr.ATN;
    public static get _ATN(): antlr.ATN {
        if (!CParser.__ATN) {
            CParser.__ATN = new antlr.ATNDeserializer().deserialize(CParser._serializedATN);
        }

        return CParser.__ATN;
    }


    private static readonly vocabulary = new antlr.Vocabulary(CParser.literalNames, CParser.symbolicNames, []);

    public override get vocabulary(): antlr.Vocabulary {
        return CParser.vocabulary;
    }

    private static readonly decisionsToDFA = CParser._ATN.decisionToState.map( (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index) );
}

export class PrimaryExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CParser.Identifier, 0);
    }
    public Constant(): antlr.TerminalNode | null {
        return this.getToken(CParser.Constant, 0);
    }
    public StringLiteral(): antlr.TerminalNode[];
    public StringLiteral(i: number): antlr.TerminalNode | null;
    public StringLiteral(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.StringLiteral);
    	} else {
    		return this.getToken(CParser.StringLiteral, i);
    	}
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftParen, 0);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightParen, 0);
    }
    public genericSelection(): GenericSelectionContext | null {
        return this.getRuleContext(0, GenericSelectionContext);
    }
    public compoundStatement(): CompoundStatementContext | null {
        return this.getRuleContext(0, CompoundStatementContext);
    }
    public unaryExpression(): UnaryExpressionContext | null {
        return this.getRuleContext(0, UnaryExpressionContext);
    }
    public Comma(): antlr.TerminalNode | null {
        return this.getToken(CParser.Comma, 0);
    }
    public typeName(): TypeNameContext | null {
        return this.getRuleContext(0, TypeNameContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_primaryExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterPrimaryExpression) {
             listener.enterPrimaryExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitPrimaryExpression) {
             listener.exitPrimaryExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitPrimaryExpression) {
            return visitor.visitPrimaryExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class GenericSelectionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Generic(): antlr.TerminalNode {
        return this.getToken(CParser.Generic, 0)!;
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CParser.LeftParen, 0)!;
    }
    public assignmentExpression(): AssignmentExpressionContext {
        return this.getRuleContext(0, AssignmentExpressionContext)!;
    }
    public Comma(): antlr.TerminalNode {
        return this.getToken(CParser.Comma, 0)!;
    }
    public genericAssocList(): GenericAssocListContext {
        return this.getRuleContext(0, GenericAssocListContext)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CParser.RightParen, 0)!;
    }
    public override get ruleIndex(): number {
        return CParser.RULE_genericSelection;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterGenericSelection) {
             listener.enterGenericSelection(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitGenericSelection) {
             listener.exitGenericSelection(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitGenericSelection) {
            return visitor.visitGenericSelection(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class GenericAssocListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public genericAssociation(): GenericAssociationContext[];
    public genericAssociation(i: number): GenericAssociationContext | null;
    public genericAssociation(i?: number): GenericAssociationContext[] | GenericAssociationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(GenericAssociationContext);
        }

        return this.getRuleContext(i, GenericAssociationContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Comma);
    	} else {
    		return this.getToken(CParser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_genericAssocList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterGenericAssocList) {
             listener.enterGenericAssocList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitGenericAssocList) {
             listener.exitGenericAssocList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitGenericAssocList) {
            return visitor.visitGenericAssocList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class GenericAssociationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Colon(): antlr.TerminalNode {
        return this.getToken(CParser.Colon, 0)!;
    }
    public assignmentExpression(): AssignmentExpressionContext {
        return this.getRuleContext(0, AssignmentExpressionContext)!;
    }
    public typeName(): TypeNameContext | null {
        return this.getRuleContext(0, TypeNameContext);
    }
    public Default(): antlr.TerminalNode | null {
        return this.getToken(CParser.Default, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_genericAssociation;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterGenericAssociation) {
             listener.enterGenericAssociation(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitGenericAssociation) {
             listener.exitGenericAssociation(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitGenericAssociation) {
            return visitor.visitGenericAssociation(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PostfixExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public primaryExpression(): PrimaryExpressionContext | null {
        return this.getRuleContext(0, PrimaryExpressionContext);
    }
    public LeftParen(): antlr.TerminalNode[];
    public LeftParen(i: number): antlr.TerminalNode | null;
    public LeftParen(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.LeftParen);
    	} else {
    		return this.getToken(CParser.LeftParen, i);
    	}
    }
    public typeName(): TypeNameContext | null {
        return this.getRuleContext(0, TypeNameContext);
    }
    public RightParen(): antlr.TerminalNode[];
    public RightParen(i: number): antlr.TerminalNode | null;
    public RightParen(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.RightParen);
    	} else {
    		return this.getToken(CParser.RightParen, i);
    	}
    }
    public LeftBrace(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftBrace, 0);
    }
    public initializerList(): InitializerListContext | null {
        return this.getRuleContext(0, InitializerListContext);
    }
    public RightBrace(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightBrace, 0);
    }
    public LeftBracket(): antlr.TerminalNode[];
    public LeftBracket(i: number): antlr.TerminalNode | null;
    public LeftBracket(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.LeftBracket);
    	} else {
    		return this.getToken(CParser.LeftBracket, i);
    	}
    }
    public expression(): ExpressionContext[];
    public expression(i: number): ExpressionContext | null;
    public expression(i?: number): ExpressionContext[] | ExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExpressionContext);
        }

        return this.getRuleContext(i, ExpressionContext);
    }
    public RightBracket(): antlr.TerminalNode[];
    public RightBracket(i: number): antlr.TerminalNode | null;
    public RightBracket(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.RightBracket);
    	} else {
    		return this.getToken(CParser.RightBracket, i);
    	}
    }
    public Identifier(): antlr.TerminalNode[];
    public Identifier(i: number): antlr.TerminalNode | null;
    public Identifier(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Identifier);
    	} else {
    		return this.getToken(CParser.Identifier, i);
    	}
    }
    public PlusPlus(): antlr.TerminalNode[];
    public PlusPlus(i: number): antlr.TerminalNode | null;
    public PlusPlus(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.PlusPlus);
    	} else {
    		return this.getToken(CParser.PlusPlus, i);
    	}
    }
    public MinusMinus(): antlr.TerminalNode[];
    public MinusMinus(i: number): antlr.TerminalNode | null;
    public MinusMinus(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.MinusMinus);
    	} else {
    		return this.getToken(CParser.MinusMinus, i);
    	}
    }
    public Dot(): antlr.TerminalNode[];
    public Dot(i: number): antlr.TerminalNode | null;
    public Dot(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Dot);
    	} else {
    		return this.getToken(CParser.Dot, i);
    	}
    }
    public Arrow(): antlr.TerminalNode[];
    public Arrow(i: number): antlr.TerminalNode | null;
    public Arrow(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Arrow);
    	} else {
    		return this.getToken(CParser.Arrow, i);
    	}
    }
    public Comma(): antlr.TerminalNode | null {
        return this.getToken(CParser.Comma, 0);
    }
    public argumentExpressionList(): ArgumentExpressionListContext[];
    public argumentExpressionList(i: number): ArgumentExpressionListContext | null;
    public argumentExpressionList(i?: number): ArgumentExpressionListContext[] | ArgumentExpressionListContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ArgumentExpressionListContext);
        }

        return this.getRuleContext(i, ArgumentExpressionListContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_postfixExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterPostfixExpression) {
             listener.enterPostfixExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitPostfixExpression) {
             listener.exitPostfixExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitPostfixExpression) {
            return visitor.visitPostfixExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ArgumentExpressionListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public assignmentExpression(): AssignmentExpressionContext[];
    public assignmentExpression(i: number): AssignmentExpressionContext | null;
    public assignmentExpression(i?: number): AssignmentExpressionContext[] | AssignmentExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AssignmentExpressionContext);
        }

        return this.getRuleContext(i, AssignmentExpressionContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Comma);
    	} else {
    		return this.getToken(CParser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_argumentExpressionList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterArgumentExpressionList) {
             listener.enterArgumentExpressionList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitArgumentExpressionList) {
             listener.exitArgumentExpressionList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitArgumentExpressionList) {
            return visitor.visitArgumentExpressionList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class UnaryExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public postfixExpression(): PostfixExpressionContext | null {
        return this.getRuleContext(0, PostfixExpressionContext);
    }
    public unaryOperator(): UnaryOperatorContext | null {
        return this.getRuleContext(0, UnaryOperatorContext);
    }
    public castExpression(): CastExpressionContext | null {
        return this.getRuleContext(0, CastExpressionContext);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftParen, 0);
    }
    public typeName(): TypeNameContext | null {
        return this.getRuleContext(0, TypeNameContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightParen, 0);
    }
    public AndAnd(): antlr.TerminalNode | null {
        return this.getToken(CParser.AndAnd, 0);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CParser.Identifier, 0);
    }
    public Sizeof(): antlr.TerminalNode[];
    public Sizeof(i: number): antlr.TerminalNode | null;
    public Sizeof(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Sizeof);
    	} else {
    		return this.getToken(CParser.Sizeof, i);
    	}
    }
    public Alignof(): antlr.TerminalNode | null {
        return this.getToken(CParser.Alignof, 0);
    }
    public PlusPlus(): antlr.TerminalNode[];
    public PlusPlus(i: number): antlr.TerminalNode | null;
    public PlusPlus(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.PlusPlus);
    	} else {
    		return this.getToken(CParser.PlusPlus, i);
    	}
    }
    public MinusMinus(): antlr.TerminalNode[];
    public MinusMinus(i: number): antlr.TerminalNode | null;
    public MinusMinus(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.MinusMinus);
    	} else {
    		return this.getToken(CParser.MinusMinus, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_unaryExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterUnaryExpression) {
             listener.enterUnaryExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitUnaryExpression) {
             listener.exitUnaryExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitUnaryExpression) {
            return visitor.visitUnaryExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class UnaryOperatorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public And(): antlr.TerminalNode | null {
        return this.getToken(CParser.And, 0);
    }
    public Star(): antlr.TerminalNode | null {
        return this.getToken(CParser.Star, 0);
    }
    public Plus(): antlr.TerminalNode | null {
        return this.getToken(CParser.Plus, 0);
    }
    public Minus(): antlr.TerminalNode | null {
        return this.getToken(CParser.Minus, 0);
    }
    public Tilde(): antlr.TerminalNode | null {
        return this.getToken(CParser.Tilde, 0);
    }
    public Not(): antlr.TerminalNode | null {
        return this.getToken(CParser.Not, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_unaryOperator;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterUnaryOperator) {
             listener.enterUnaryOperator(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitUnaryOperator) {
             listener.exitUnaryOperator(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitUnaryOperator) {
            return visitor.visitUnaryOperator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CastExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftParen, 0);
    }
    public typeName(): TypeNameContext | null {
        return this.getRuleContext(0, TypeNameContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightParen, 0);
    }
    public castExpression(): CastExpressionContext | null {
        return this.getRuleContext(0, CastExpressionContext);
    }
    public unaryExpression(): UnaryExpressionContext | null {
        return this.getRuleContext(0, UnaryExpressionContext);
    }
    public DigitSequence(): antlr.TerminalNode | null {
        return this.getToken(CParser.DigitSequence, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_castExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterCastExpression) {
             listener.enterCastExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitCastExpression) {
             listener.exitCastExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitCastExpression) {
            return visitor.visitCastExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MultiplicativeExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public castExpression(): CastExpressionContext[];
    public castExpression(i: number): CastExpressionContext | null;
    public castExpression(i?: number): CastExpressionContext[] | CastExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(CastExpressionContext);
        }

        return this.getRuleContext(i, CastExpressionContext);
    }
    public Star(): antlr.TerminalNode[];
    public Star(i: number): antlr.TerminalNode | null;
    public Star(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Star);
    	} else {
    		return this.getToken(CParser.Star, i);
    	}
    }
    public Div(): antlr.TerminalNode[];
    public Div(i: number): antlr.TerminalNode | null;
    public Div(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Div);
    	} else {
    		return this.getToken(CParser.Div, i);
    	}
    }
    public Mod(): antlr.TerminalNode[];
    public Mod(i: number): antlr.TerminalNode | null;
    public Mod(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Mod);
    	} else {
    		return this.getToken(CParser.Mod, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_multiplicativeExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterMultiplicativeExpression) {
             listener.enterMultiplicativeExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitMultiplicativeExpression) {
             listener.exitMultiplicativeExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitMultiplicativeExpression) {
            return visitor.visitMultiplicativeExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AdditiveExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public multiplicativeExpression(): MultiplicativeExpressionContext[];
    public multiplicativeExpression(i: number): MultiplicativeExpressionContext | null;
    public multiplicativeExpression(i?: number): MultiplicativeExpressionContext[] | MultiplicativeExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(MultiplicativeExpressionContext);
        }

        return this.getRuleContext(i, MultiplicativeExpressionContext);
    }
    public Plus(): antlr.TerminalNode[];
    public Plus(i: number): antlr.TerminalNode | null;
    public Plus(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Plus);
    	} else {
    		return this.getToken(CParser.Plus, i);
    	}
    }
    public Minus(): antlr.TerminalNode[];
    public Minus(i: number): antlr.TerminalNode | null;
    public Minus(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Minus);
    	} else {
    		return this.getToken(CParser.Minus, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_additiveExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterAdditiveExpression) {
             listener.enterAdditiveExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitAdditiveExpression) {
             listener.exitAdditiveExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitAdditiveExpression) {
            return visitor.visitAdditiveExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ShiftExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public additiveExpression(): AdditiveExpressionContext[];
    public additiveExpression(i: number): AdditiveExpressionContext | null;
    public additiveExpression(i?: number): AdditiveExpressionContext[] | AdditiveExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AdditiveExpressionContext);
        }

        return this.getRuleContext(i, AdditiveExpressionContext);
    }
    public LeftShift(): antlr.TerminalNode[];
    public LeftShift(i: number): antlr.TerminalNode | null;
    public LeftShift(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.LeftShift);
    	} else {
    		return this.getToken(CParser.LeftShift, i);
    	}
    }
    public RightShift(): antlr.TerminalNode[];
    public RightShift(i: number): antlr.TerminalNode | null;
    public RightShift(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.RightShift);
    	} else {
    		return this.getToken(CParser.RightShift, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_shiftExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterShiftExpression) {
             listener.enterShiftExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitShiftExpression) {
             listener.exitShiftExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitShiftExpression) {
            return visitor.visitShiftExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class RelationalExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public shiftExpression(): ShiftExpressionContext[];
    public shiftExpression(i: number): ShiftExpressionContext | null;
    public shiftExpression(i?: number): ShiftExpressionContext[] | ShiftExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ShiftExpressionContext);
        }

        return this.getRuleContext(i, ShiftExpressionContext);
    }
    public Less(): antlr.TerminalNode[];
    public Less(i: number): antlr.TerminalNode | null;
    public Less(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Less);
    	} else {
    		return this.getToken(CParser.Less, i);
    	}
    }
    public Greater(): antlr.TerminalNode[];
    public Greater(i: number): antlr.TerminalNode | null;
    public Greater(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Greater);
    	} else {
    		return this.getToken(CParser.Greater, i);
    	}
    }
    public LessEqual(): antlr.TerminalNode[];
    public LessEqual(i: number): antlr.TerminalNode | null;
    public LessEqual(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.LessEqual);
    	} else {
    		return this.getToken(CParser.LessEqual, i);
    	}
    }
    public GreaterEqual(): antlr.TerminalNode[];
    public GreaterEqual(i: number): antlr.TerminalNode | null;
    public GreaterEqual(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.GreaterEqual);
    	} else {
    		return this.getToken(CParser.GreaterEqual, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_relationalExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterRelationalExpression) {
             listener.enterRelationalExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitRelationalExpression) {
             listener.exitRelationalExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitRelationalExpression) {
            return visitor.visitRelationalExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EqualityExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public relationalExpression(): RelationalExpressionContext[];
    public relationalExpression(i: number): RelationalExpressionContext | null;
    public relationalExpression(i?: number): RelationalExpressionContext[] | RelationalExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(RelationalExpressionContext);
        }

        return this.getRuleContext(i, RelationalExpressionContext);
    }
    public Equal(): antlr.TerminalNode[];
    public Equal(i: number): antlr.TerminalNode | null;
    public Equal(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Equal);
    	} else {
    		return this.getToken(CParser.Equal, i);
    	}
    }
    public NotEqual(): antlr.TerminalNode[];
    public NotEqual(i: number): antlr.TerminalNode | null;
    public NotEqual(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.NotEqual);
    	} else {
    		return this.getToken(CParser.NotEqual, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_equalityExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterEqualityExpression) {
             listener.enterEqualityExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitEqualityExpression) {
             listener.exitEqualityExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitEqualityExpression) {
            return visitor.visitEqualityExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AndExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public equalityExpression(): EqualityExpressionContext[];
    public equalityExpression(i: number): EqualityExpressionContext | null;
    public equalityExpression(i?: number): EqualityExpressionContext[] | EqualityExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(EqualityExpressionContext);
        }

        return this.getRuleContext(i, EqualityExpressionContext);
    }
    public And(): antlr.TerminalNode[];
    public And(i: number): antlr.TerminalNode | null;
    public And(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.And);
    	} else {
    		return this.getToken(CParser.And, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_andExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterAndExpression) {
             listener.enterAndExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitAndExpression) {
             listener.exitAndExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitAndExpression) {
            return visitor.visitAndExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExclusiveOrExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public andExpression(): AndExpressionContext[];
    public andExpression(i: number): AndExpressionContext | null;
    public andExpression(i?: number): AndExpressionContext[] | AndExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AndExpressionContext);
        }

        return this.getRuleContext(i, AndExpressionContext);
    }
    public Caret(): antlr.TerminalNode[];
    public Caret(i: number): antlr.TerminalNode | null;
    public Caret(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Caret);
    	} else {
    		return this.getToken(CParser.Caret, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_exclusiveOrExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterExclusiveOrExpression) {
             listener.enterExclusiveOrExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitExclusiveOrExpression) {
             listener.exitExclusiveOrExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitExclusiveOrExpression) {
            return visitor.visitExclusiveOrExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class InclusiveOrExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public exclusiveOrExpression(): ExclusiveOrExpressionContext[];
    public exclusiveOrExpression(i: number): ExclusiveOrExpressionContext | null;
    public exclusiveOrExpression(i?: number): ExclusiveOrExpressionContext[] | ExclusiveOrExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExclusiveOrExpressionContext);
        }

        return this.getRuleContext(i, ExclusiveOrExpressionContext);
    }
    public Or(): antlr.TerminalNode[];
    public Or(i: number): antlr.TerminalNode | null;
    public Or(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Or);
    	} else {
    		return this.getToken(CParser.Or, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_inclusiveOrExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterInclusiveOrExpression) {
             listener.enterInclusiveOrExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitInclusiveOrExpression) {
             listener.exitInclusiveOrExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitInclusiveOrExpression) {
            return visitor.visitInclusiveOrExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LogicalAndExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public inclusiveOrExpression(): InclusiveOrExpressionContext[];
    public inclusiveOrExpression(i: number): InclusiveOrExpressionContext | null;
    public inclusiveOrExpression(i?: number): InclusiveOrExpressionContext[] | InclusiveOrExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(InclusiveOrExpressionContext);
        }

        return this.getRuleContext(i, InclusiveOrExpressionContext);
    }
    public AndAnd(): antlr.TerminalNode[];
    public AndAnd(i: number): antlr.TerminalNode | null;
    public AndAnd(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.AndAnd);
    	} else {
    		return this.getToken(CParser.AndAnd, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_logicalAndExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterLogicalAndExpression) {
             listener.enterLogicalAndExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitLogicalAndExpression) {
             listener.exitLogicalAndExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitLogicalAndExpression) {
            return visitor.visitLogicalAndExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LogicalOrExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public logicalAndExpression(): LogicalAndExpressionContext[];
    public logicalAndExpression(i: number): LogicalAndExpressionContext | null;
    public logicalAndExpression(i?: number): LogicalAndExpressionContext[] | LogicalAndExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(LogicalAndExpressionContext);
        }

        return this.getRuleContext(i, LogicalAndExpressionContext);
    }
    public OrOr(): antlr.TerminalNode[];
    public OrOr(i: number): antlr.TerminalNode | null;
    public OrOr(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.OrOr);
    	} else {
    		return this.getToken(CParser.OrOr, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_logicalOrExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterLogicalOrExpression) {
             listener.enterLogicalOrExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitLogicalOrExpression) {
             listener.exitLogicalOrExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitLogicalOrExpression) {
            return visitor.visitLogicalOrExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConditionalExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public logicalOrExpression(): LogicalOrExpressionContext {
        return this.getRuleContext(0, LogicalOrExpressionContext)!;
    }
    public Question(): antlr.TerminalNode | null {
        return this.getToken(CParser.Question, 0);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public Colon(): antlr.TerminalNode | null {
        return this.getToken(CParser.Colon, 0);
    }
    public conditionalExpression(): ConditionalExpressionContext | null {
        return this.getRuleContext(0, ConditionalExpressionContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_conditionalExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterConditionalExpression) {
             listener.enterConditionalExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitConditionalExpression) {
             listener.exitConditionalExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitConditionalExpression) {
            return visitor.visitConditionalExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AssignmentExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public conditionalExpression(): ConditionalExpressionContext | null {
        return this.getRuleContext(0, ConditionalExpressionContext);
    }
    public unaryExpression(): UnaryExpressionContext | null {
        return this.getRuleContext(0, UnaryExpressionContext);
    }
    public assignmentOperator(): AssignmentOperatorContext | null {
        return this.getRuleContext(0, AssignmentOperatorContext);
    }
    public assignmentExpression(): AssignmentExpressionContext | null {
        return this.getRuleContext(0, AssignmentExpressionContext);
    }
    public DigitSequence(): antlr.TerminalNode | null {
        return this.getToken(CParser.DigitSequence, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_assignmentExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterAssignmentExpression) {
             listener.enterAssignmentExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitAssignmentExpression) {
             listener.exitAssignmentExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitAssignmentExpression) {
            return visitor.visitAssignmentExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AssignmentOperatorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Assign(): antlr.TerminalNode | null {
        return this.getToken(CParser.Assign, 0);
    }
    public StarAssign(): antlr.TerminalNode | null {
        return this.getToken(CParser.StarAssign, 0);
    }
    public DivAssign(): antlr.TerminalNode | null {
        return this.getToken(CParser.DivAssign, 0);
    }
    public ModAssign(): antlr.TerminalNode | null {
        return this.getToken(CParser.ModAssign, 0);
    }
    public PlusAssign(): antlr.TerminalNode | null {
        return this.getToken(CParser.PlusAssign, 0);
    }
    public MinusAssign(): antlr.TerminalNode | null {
        return this.getToken(CParser.MinusAssign, 0);
    }
    public LeftShiftAssign(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftShiftAssign, 0);
    }
    public RightShiftAssign(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightShiftAssign, 0);
    }
    public AndAssign(): antlr.TerminalNode | null {
        return this.getToken(CParser.AndAssign, 0);
    }
    public XorAssign(): antlr.TerminalNode | null {
        return this.getToken(CParser.XorAssign, 0);
    }
    public OrAssign(): antlr.TerminalNode | null {
        return this.getToken(CParser.OrAssign, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_assignmentOperator;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterAssignmentOperator) {
             listener.enterAssignmentOperator(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitAssignmentOperator) {
             listener.exitAssignmentOperator(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitAssignmentOperator) {
            return visitor.visitAssignmentOperator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public assignmentExpression(): AssignmentExpressionContext[];
    public assignmentExpression(i: number): AssignmentExpressionContext | null;
    public assignmentExpression(i?: number): AssignmentExpressionContext[] | AssignmentExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AssignmentExpressionContext);
        }

        return this.getRuleContext(i, AssignmentExpressionContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Comma);
    	} else {
    		return this.getToken(CParser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_expression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterExpression) {
             listener.enterExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitExpression) {
             listener.exitExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitExpression) {
            return visitor.visitExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConstantExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public conditionalExpression(): ConditionalExpressionContext {
        return this.getRuleContext(0, ConditionalExpressionContext)!;
    }
    public override get ruleIndex(): number {
        return CParser.RULE_constantExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterConstantExpression) {
             listener.enterConstantExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitConstantExpression) {
             listener.exitConstantExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitConstantExpression) {
            return visitor.visitConstantExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declarationSpecifiers(): DeclarationSpecifiersContext | null {
        return this.getRuleContext(0, DeclarationSpecifiersContext);
    }
    public Semi(): antlr.TerminalNode | null {
        return this.getToken(CParser.Semi, 0);
    }
    public initDeclaratorList(): InitDeclaratorListContext | null {
        return this.getRuleContext(0, InitDeclaratorListContext);
    }
    public staticAssertDeclaration(): StaticAssertDeclarationContext | null {
        return this.getRuleContext(0, StaticAssertDeclarationContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_declaration;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterDeclaration) {
             listener.enterDeclaration(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitDeclaration) {
             listener.exitDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitDeclaration) {
            return visitor.visitDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclarationSpecifiersContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declarationSpecifier(): DeclarationSpecifierContext[];
    public declarationSpecifier(i: number): DeclarationSpecifierContext | null;
    public declarationSpecifier(i?: number): DeclarationSpecifierContext[] | DeclarationSpecifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DeclarationSpecifierContext);
        }

        return this.getRuleContext(i, DeclarationSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_declarationSpecifiers;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterDeclarationSpecifiers) {
             listener.enterDeclarationSpecifiers(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitDeclarationSpecifiers) {
             listener.exitDeclarationSpecifiers(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitDeclarationSpecifiers) {
            return visitor.visitDeclarationSpecifiers(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclarationSpecifiers2Context extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declarationSpecifier(): DeclarationSpecifierContext[];
    public declarationSpecifier(i: number): DeclarationSpecifierContext | null;
    public declarationSpecifier(i?: number): DeclarationSpecifierContext[] | DeclarationSpecifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DeclarationSpecifierContext);
        }

        return this.getRuleContext(i, DeclarationSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_declarationSpecifiers2;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterDeclarationSpecifiers2) {
             listener.enterDeclarationSpecifiers2(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitDeclarationSpecifiers2) {
             listener.exitDeclarationSpecifiers2(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitDeclarationSpecifiers2) {
            return visitor.visitDeclarationSpecifiers2(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclarationSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public storageClassSpecifier(): StorageClassSpecifierContext | null {
        return this.getRuleContext(0, StorageClassSpecifierContext);
    }
    public typeSpecifier(): TypeSpecifierContext | null {
        return this.getRuleContext(0, TypeSpecifierContext);
    }
    public typeQualifier(): TypeQualifierContext | null {
        return this.getRuleContext(0, TypeQualifierContext);
    }
    public functionSpecifier(): FunctionSpecifierContext | null {
        return this.getRuleContext(0, FunctionSpecifierContext);
    }
    public alignmentSpecifier(): AlignmentSpecifierContext | null {
        return this.getRuleContext(0, AlignmentSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_declarationSpecifier;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterDeclarationSpecifier) {
             listener.enterDeclarationSpecifier(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitDeclarationSpecifier) {
             listener.exitDeclarationSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitDeclarationSpecifier) {
            return visitor.visitDeclarationSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class InitDeclaratorListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public initDeclarator(): InitDeclaratorContext[];
    public initDeclarator(i: number): InitDeclaratorContext | null;
    public initDeclarator(i?: number): InitDeclaratorContext[] | InitDeclaratorContext | null {
        if (i === undefined) {
            return this.getRuleContexts(InitDeclaratorContext);
        }

        return this.getRuleContext(i, InitDeclaratorContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Comma);
    	} else {
    		return this.getToken(CParser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_initDeclaratorList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterInitDeclaratorList) {
             listener.enterInitDeclaratorList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitInitDeclaratorList) {
             listener.exitInitDeclaratorList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitInitDeclaratorList) {
            return visitor.visitInitDeclaratorList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class InitDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declarator(): DeclaratorContext {
        return this.getRuleContext(0, DeclaratorContext)!;
    }
    public Assign(): antlr.TerminalNode | null {
        return this.getToken(CParser.Assign, 0);
    }
    public initializer(): InitializerContext | null {
        return this.getRuleContext(0, InitializerContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_initDeclarator;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterInitDeclarator) {
             listener.enterInitDeclarator(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitInitDeclarator) {
             listener.exitInitDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitInitDeclarator) {
            return visitor.visitInitDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StorageClassSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Typedef(): antlr.TerminalNode | null {
        return this.getToken(CParser.Typedef, 0);
    }
    public Extern(): antlr.TerminalNode | null {
        return this.getToken(CParser.Extern, 0);
    }
    public Static(): antlr.TerminalNode | null {
        return this.getToken(CParser.Static, 0);
    }
    public ThreadLocal(): antlr.TerminalNode | null {
        return this.getToken(CParser.ThreadLocal, 0);
    }
    public Auto(): antlr.TerminalNode | null {
        return this.getToken(CParser.Auto, 0);
    }
    public Register(): antlr.TerminalNode | null {
        return this.getToken(CParser.Register, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_storageClassSpecifier;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterStorageClassSpecifier) {
             listener.enterStorageClassSpecifier(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitStorageClassSpecifier) {
             listener.exitStorageClassSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitStorageClassSpecifier) {
            return visitor.visitStorageClassSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Void(): antlr.TerminalNode | null {
        return this.getToken(CParser.Void, 0);
    }
    public Char(): antlr.TerminalNode | null {
        return this.getToken(CParser.Char, 0);
    }
    public Short(): antlr.TerminalNode | null {
        return this.getToken(CParser.Short, 0);
    }
    public Int(): antlr.TerminalNode | null {
        return this.getToken(CParser.Int, 0);
    }
    public Long(): antlr.TerminalNode | null {
        return this.getToken(CParser.Long, 0);
    }
    public Float(): antlr.TerminalNode | null {
        return this.getToken(CParser.Float, 0);
    }
    public Double(): antlr.TerminalNode | null {
        return this.getToken(CParser.Double, 0);
    }
    public Signed(): antlr.TerminalNode | null {
        return this.getToken(CParser.Signed, 0);
    }
    public Unsigned(): antlr.TerminalNode | null {
        return this.getToken(CParser.Unsigned, 0);
    }
    public Bool(): antlr.TerminalNode | null {
        return this.getToken(CParser.Bool, 0);
    }
    public Complex(): antlr.TerminalNode | null {
        return this.getToken(CParser.Complex, 0);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftParen, 0);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightParen, 0);
    }
    public atomicTypeSpecifier(): AtomicTypeSpecifierContext | null {
        return this.getRuleContext(0, AtomicTypeSpecifierContext);
    }
    public structOrUnionSpecifier(): StructOrUnionSpecifierContext | null {
        return this.getRuleContext(0, StructOrUnionSpecifierContext);
    }
    public enumSpecifier(): EnumSpecifierContext | null {
        return this.getRuleContext(0, EnumSpecifierContext);
    }
    public typedefName(): TypedefNameContext | null {
        return this.getRuleContext(0, TypedefNameContext);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_typeSpecifier;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterTypeSpecifier) {
             listener.enterTypeSpecifier(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitTypeSpecifier) {
             listener.exitTypeSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitTypeSpecifier) {
            return visitor.visitTypeSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StructOrUnionSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public structOrUnion(): StructOrUnionContext {
        return this.getRuleContext(0, StructOrUnionContext)!;
    }
    public LeftBrace(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftBrace, 0);
    }
    public structDeclarationList(): StructDeclarationListContext | null {
        return this.getRuleContext(0, StructDeclarationListContext);
    }
    public RightBrace(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightBrace, 0);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CParser.Identifier, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_structOrUnionSpecifier;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterStructOrUnionSpecifier) {
             listener.enterStructOrUnionSpecifier(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitStructOrUnionSpecifier) {
             listener.exitStructOrUnionSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitStructOrUnionSpecifier) {
            return visitor.visitStructOrUnionSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StructOrUnionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Struct(): antlr.TerminalNode | null {
        return this.getToken(CParser.Struct, 0);
    }
    public Union(): antlr.TerminalNode | null {
        return this.getToken(CParser.Union, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_structOrUnion;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterStructOrUnion) {
             listener.enterStructOrUnion(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitStructOrUnion) {
             listener.exitStructOrUnion(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitStructOrUnion) {
            return visitor.visitStructOrUnion(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StructDeclarationListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public structDeclaration(): StructDeclarationContext[];
    public structDeclaration(i: number): StructDeclarationContext | null;
    public structDeclaration(i?: number): StructDeclarationContext[] | StructDeclarationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(StructDeclarationContext);
        }

        return this.getRuleContext(i, StructDeclarationContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_structDeclarationList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterStructDeclarationList) {
             listener.enterStructDeclarationList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitStructDeclarationList) {
             listener.exitStructDeclarationList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitStructDeclarationList) {
            return visitor.visitStructDeclarationList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StructDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public specifierQualifierList(): SpecifierQualifierListContext | null {
        return this.getRuleContext(0, SpecifierQualifierListContext);
    }
    public structDeclaratorList(): StructDeclaratorListContext | null {
        return this.getRuleContext(0, StructDeclaratorListContext);
    }
    public Semi(): antlr.TerminalNode | null {
        return this.getToken(CParser.Semi, 0);
    }
    public staticAssertDeclaration(): StaticAssertDeclarationContext | null {
        return this.getRuleContext(0, StaticAssertDeclarationContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_structDeclaration;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterStructDeclaration) {
             listener.enterStructDeclaration(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitStructDeclaration) {
             listener.exitStructDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitStructDeclaration) {
            return visitor.visitStructDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SpecifierQualifierListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public typeSpecifier(): TypeSpecifierContext | null {
        return this.getRuleContext(0, TypeSpecifierContext);
    }
    public typeQualifier(): TypeQualifierContext | null {
        return this.getRuleContext(0, TypeQualifierContext);
    }
    public specifierQualifierList(): SpecifierQualifierListContext | null {
        return this.getRuleContext(0, SpecifierQualifierListContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_specifierQualifierList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterSpecifierQualifierList) {
             listener.enterSpecifierQualifierList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitSpecifierQualifierList) {
             listener.exitSpecifierQualifierList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitSpecifierQualifierList) {
            return visitor.visitSpecifierQualifierList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StructDeclaratorListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public structDeclarator(): StructDeclaratorContext[];
    public structDeclarator(i: number): StructDeclaratorContext | null;
    public structDeclarator(i?: number): StructDeclaratorContext[] | StructDeclaratorContext | null {
        if (i === undefined) {
            return this.getRuleContexts(StructDeclaratorContext);
        }

        return this.getRuleContext(i, StructDeclaratorContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Comma);
    	} else {
    		return this.getToken(CParser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_structDeclaratorList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterStructDeclaratorList) {
             listener.enterStructDeclaratorList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitStructDeclaratorList) {
             listener.exitStructDeclaratorList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitStructDeclaratorList) {
            return visitor.visitStructDeclaratorList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StructDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declarator(): DeclaratorContext | null {
        return this.getRuleContext(0, DeclaratorContext);
    }
    public Colon(): antlr.TerminalNode | null {
        return this.getToken(CParser.Colon, 0);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_structDeclarator;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterStructDeclarator) {
             listener.enterStructDeclarator(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitStructDeclarator) {
             listener.exitStructDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitStructDeclarator) {
            return visitor.visitStructDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Enum(): antlr.TerminalNode {
        return this.getToken(CParser.Enum, 0)!;
    }
    public LeftBrace(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftBrace, 0);
    }
    public enumeratorList(): EnumeratorListContext | null {
        return this.getRuleContext(0, EnumeratorListContext);
    }
    public RightBrace(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightBrace, 0);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CParser.Identifier, 0);
    }
    public Comma(): antlr.TerminalNode | null {
        return this.getToken(CParser.Comma, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_enumSpecifier;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterEnumSpecifier) {
             listener.enterEnumSpecifier(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitEnumSpecifier) {
             listener.exitEnumSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitEnumSpecifier) {
            return visitor.visitEnumSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumeratorListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public enumerator(): EnumeratorContext[];
    public enumerator(i: number): EnumeratorContext | null;
    public enumerator(i?: number): EnumeratorContext[] | EnumeratorContext | null {
        if (i === undefined) {
            return this.getRuleContexts(EnumeratorContext);
        }

        return this.getRuleContext(i, EnumeratorContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Comma);
    	} else {
    		return this.getToken(CParser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_enumeratorList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterEnumeratorList) {
             listener.enterEnumeratorList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitEnumeratorList) {
             listener.exitEnumeratorList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitEnumeratorList) {
            return visitor.visitEnumeratorList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumeratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public enumerationConstant(): EnumerationConstantContext {
        return this.getRuleContext(0, EnumerationConstantContext)!;
    }
    public Assign(): antlr.TerminalNode | null {
        return this.getToken(CParser.Assign, 0);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_enumerator;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterEnumerator) {
             listener.enterEnumerator(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitEnumerator) {
             listener.exitEnumerator(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitEnumerator) {
            return visitor.visitEnumerator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumerationConstantContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CParser.Identifier, 0)!;
    }
    public override get ruleIndex(): number {
        return CParser.RULE_enumerationConstant;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterEnumerationConstant) {
             listener.enterEnumerationConstant(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitEnumerationConstant) {
             listener.exitEnumerationConstant(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitEnumerationConstant) {
            return visitor.visitEnumerationConstant(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AtomicTypeSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Atomic(): antlr.TerminalNode {
        return this.getToken(CParser.Atomic, 0)!;
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CParser.LeftParen, 0)!;
    }
    public typeName(): TypeNameContext {
        return this.getRuleContext(0, TypeNameContext)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CParser.RightParen, 0)!;
    }
    public override get ruleIndex(): number {
        return CParser.RULE_atomicTypeSpecifier;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterAtomicTypeSpecifier) {
             listener.enterAtomicTypeSpecifier(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitAtomicTypeSpecifier) {
             listener.exitAtomicTypeSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitAtomicTypeSpecifier) {
            return visitor.visitAtomicTypeSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeQualifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Const(): antlr.TerminalNode | null {
        return this.getToken(CParser.Const, 0);
    }
    public Restrict(): antlr.TerminalNode | null {
        return this.getToken(CParser.Restrict, 0);
    }
    public Volatile(): antlr.TerminalNode | null {
        return this.getToken(CParser.Volatile, 0);
    }
    public Atomic(): antlr.TerminalNode | null {
        return this.getToken(CParser.Atomic, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_typeQualifier;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterTypeQualifier) {
             listener.enterTypeQualifier(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitTypeQualifier) {
             listener.exitTypeQualifier(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitTypeQualifier) {
            return visitor.visitTypeQualifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FunctionSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Inline(): antlr.TerminalNode | null {
        return this.getToken(CParser.Inline, 0);
    }
    public Noreturn(): antlr.TerminalNode | null {
        return this.getToken(CParser.Noreturn, 0);
    }
    public gccAttributeSpecifier(): GccAttributeSpecifierContext | null {
        return this.getRuleContext(0, GccAttributeSpecifierContext);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftParen, 0);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CParser.Identifier, 0);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightParen, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_functionSpecifier;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterFunctionSpecifier) {
             listener.enterFunctionSpecifier(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitFunctionSpecifier) {
             listener.exitFunctionSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitFunctionSpecifier) {
            return visitor.visitFunctionSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AlignmentSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Alignas(): antlr.TerminalNode {
        return this.getToken(CParser.Alignas, 0)!;
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CParser.LeftParen, 0)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CParser.RightParen, 0)!;
    }
    public typeName(): TypeNameContext | null {
        return this.getRuleContext(0, TypeNameContext);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_alignmentSpecifier;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterAlignmentSpecifier) {
             listener.enterAlignmentSpecifier(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitAlignmentSpecifier) {
             listener.exitAlignmentSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitAlignmentSpecifier) {
            return visitor.visitAlignmentSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public directDeclarator(): DirectDeclaratorContext {
        return this.getRuleContext(0, DirectDeclaratorContext)!;
    }
    public pointer(): PointerContext | null {
        return this.getRuleContext(0, PointerContext);
    }
    public gccDeclaratorExtension(): GccDeclaratorExtensionContext[];
    public gccDeclaratorExtension(i: number): GccDeclaratorExtensionContext | null;
    public gccDeclaratorExtension(i?: number): GccDeclaratorExtensionContext[] | GccDeclaratorExtensionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(GccDeclaratorExtensionContext);
        }

        return this.getRuleContext(i, GccDeclaratorExtensionContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_declarator;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterDeclarator) {
             listener.enterDeclarator(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitDeclarator) {
             listener.exitDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitDeclarator) {
            return visitor.visitDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DirectDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CParser.Identifier, 0);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftParen, 0);
    }
    public declarator(): DeclaratorContext | null {
        return this.getRuleContext(0, DeclaratorContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightParen, 0);
    }
    public Colon(): antlr.TerminalNode | null {
        return this.getToken(CParser.Colon, 0);
    }
    public DigitSequence(): antlr.TerminalNode | null {
        return this.getToken(CParser.DigitSequence, 0);
    }
    public vcSpecificModifer(): VcSpecificModiferContext | null {
        return this.getRuleContext(0, VcSpecificModiferContext);
    }
    public directDeclarator(): DirectDeclaratorContext | null {
        return this.getRuleContext(0, DirectDeclaratorContext);
    }
    public LeftBracket(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftBracket, 0);
    }
    public RightBracket(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightBracket, 0);
    }
    public typeQualifierList(): TypeQualifierListContext | null {
        return this.getRuleContext(0, TypeQualifierListContext);
    }
    public assignmentExpression(): AssignmentExpressionContext | null {
        return this.getRuleContext(0, AssignmentExpressionContext);
    }
    public Static(): antlr.TerminalNode | null {
        return this.getToken(CParser.Static, 0);
    }
    public Star(): antlr.TerminalNode | null {
        return this.getToken(CParser.Star, 0);
    }
    public parameterTypeList(): ParameterTypeListContext | null {
        return this.getRuleContext(0, ParameterTypeListContext);
    }
    public identifierList(): IdentifierListContext | null {
        return this.getRuleContext(0, IdentifierListContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_directDeclarator;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterDirectDeclarator) {
             listener.enterDirectDeclarator(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitDirectDeclarator) {
             listener.exitDirectDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitDirectDeclarator) {
            return visitor.visitDirectDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class VcSpecificModiferContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_vcSpecificModifer;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterVcSpecificModifer) {
             listener.enterVcSpecificModifer(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitVcSpecificModifer) {
             listener.exitVcSpecificModifer(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitVcSpecificModifer) {
            return visitor.visitVcSpecificModifer(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class GccDeclaratorExtensionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftParen, 0);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightParen, 0);
    }
    public StringLiteral(): antlr.TerminalNode[];
    public StringLiteral(i: number): antlr.TerminalNode | null;
    public StringLiteral(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.StringLiteral);
    	} else {
    		return this.getToken(CParser.StringLiteral, i);
    	}
    }
    public gccAttributeSpecifier(): GccAttributeSpecifierContext | null {
        return this.getRuleContext(0, GccAttributeSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_gccDeclaratorExtension;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterGccDeclaratorExtension) {
             listener.enterGccDeclaratorExtension(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitGccDeclaratorExtension) {
             listener.exitGccDeclaratorExtension(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitGccDeclaratorExtension) {
            return visitor.visitGccDeclaratorExtension(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class GccAttributeSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftParen(): antlr.TerminalNode[];
    public LeftParen(i: number): antlr.TerminalNode | null;
    public LeftParen(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.LeftParen);
    	} else {
    		return this.getToken(CParser.LeftParen, i);
    	}
    }
    public gccAttributeList(): GccAttributeListContext {
        return this.getRuleContext(0, GccAttributeListContext)!;
    }
    public RightParen(): antlr.TerminalNode[];
    public RightParen(i: number): antlr.TerminalNode | null;
    public RightParen(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.RightParen);
    	} else {
    		return this.getToken(CParser.RightParen, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_gccAttributeSpecifier;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterGccAttributeSpecifier) {
             listener.enterGccAttributeSpecifier(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitGccAttributeSpecifier) {
             listener.exitGccAttributeSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitGccAttributeSpecifier) {
            return visitor.visitGccAttributeSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class GccAttributeListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public gccAttribute(): GccAttributeContext[];
    public gccAttribute(i: number): GccAttributeContext | null;
    public gccAttribute(i?: number): GccAttributeContext[] | GccAttributeContext | null {
        if (i === undefined) {
            return this.getRuleContexts(GccAttributeContext);
        }

        return this.getRuleContext(i, GccAttributeContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Comma);
    	} else {
    		return this.getToken(CParser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_gccAttributeList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterGccAttributeList) {
             listener.enterGccAttributeList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitGccAttributeList) {
             listener.exitGccAttributeList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitGccAttributeList) {
            return visitor.visitGccAttributeList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class GccAttributeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Comma(): antlr.TerminalNode | null {
        return this.getToken(CParser.Comma, 0);
    }
    public LeftParen(): antlr.TerminalNode[];
    public LeftParen(i: number): antlr.TerminalNode | null;
    public LeftParen(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.LeftParen);
    	} else {
    		return this.getToken(CParser.LeftParen, i);
    	}
    }
    public RightParen(): antlr.TerminalNode[];
    public RightParen(i: number): antlr.TerminalNode | null;
    public RightParen(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.RightParen);
    	} else {
    		return this.getToken(CParser.RightParen, i);
    	}
    }
    public argumentExpressionList(): ArgumentExpressionListContext | null {
        return this.getRuleContext(0, ArgumentExpressionListContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_gccAttribute;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterGccAttribute) {
             listener.enterGccAttribute(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitGccAttribute) {
             listener.exitGccAttribute(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitGccAttribute) {
            return visitor.visitGccAttribute(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PointerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Star(): antlr.TerminalNode[];
    public Star(i: number): antlr.TerminalNode | null;
    public Star(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Star);
    	} else {
    		return this.getToken(CParser.Star, i);
    	}
    }
    public Caret(): antlr.TerminalNode[];
    public Caret(i: number): antlr.TerminalNode | null;
    public Caret(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Caret);
    	} else {
    		return this.getToken(CParser.Caret, i);
    	}
    }
    public typeQualifierList(): TypeQualifierListContext[];
    public typeQualifierList(i: number): TypeQualifierListContext | null;
    public typeQualifierList(i?: number): TypeQualifierListContext[] | TypeQualifierListContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TypeQualifierListContext);
        }

        return this.getRuleContext(i, TypeQualifierListContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_pointer;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterPointer) {
             listener.enterPointer(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitPointer) {
             listener.exitPointer(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitPointer) {
            return visitor.visitPointer(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeQualifierListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public typeQualifier(): TypeQualifierContext[];
    public typeQualifier(i: number): TypeQualifierContext | null;
    public typeQualifier(i?: number): TypeQualifierContext[] | TypeQualifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TypeQualifierContext);
        }

        return this.getRuleContext(i, TypeQualifierContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_typeQualifierList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterTypeQualifierList) {
             listener.enterTypeQualifierList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitTypeQualifierList) {
             listener.exitTypeQualifierList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitTypeQualifierList) {
            return visitor.visitTypeQualifierList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParameterTypeListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public parameterList(): ParameterListContext {
        return this.getRuleContext(0, ParameterListContext)!;
    }
    public Comma(): antlr.TerminalNode | null {
        return this.getToken(CParser.Comma, 0);
    }
    public Ellipsis(): antlr.TerminalNode | null {
        return this.getToken(CParser.Ellipsis, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_parameterTypeList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterParameterTypeList) {
             listener.enterParameterTypeList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitParameterTypeList) {
             listener.exitParameterTypeList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitParameterTypeList) {
            return visitor.visitParameterTypeList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParameterListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public parameterDeclaration(): ParameterDeclarationContext[];
    public parameterDeclaration(i: number): ParameterDeclarationContext | null;
    public parameterDeclaration(i?: number): ParameterDeclarationContext[] | ParameterDeclarationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ParameterDeclarationContext);
        }

        return this.getRuleContext(i, ParameterDeclarationContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Comma);
    	} else {
    		return this.getToken(CParser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_parameterList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterParameterList) {
             listener.enterParameterList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitParameterList) {
             listener.exitParameterList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitParameterList) {
            return visitor.visitParameterList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParameterDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declarationSpecifiers(): DeclarationSpecifiersContext | null {
        return this.getRuleContext(0, DeclarationSpecifiersContext);
    }
    public declarator(): DeclaratorContext | null {
        return this.getRuleContext(0, DeclaratorContext);
    }
    public declarationSpecifiers2(): DeclarationSpecifiers2Context | null {
        return this.getRuleContext(0, DeclarationSpecifiers2Context);
    }
    public abstractDeclarator(): AbstractDeclaratorContext | null {
        return this.getRuleContext(0, AbstractDeclaratorContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_parameterDeclaration;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterParameterDeclaration) {
             listener.enterParameterDeclaration(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitParameterDeclaration) {
             listener.exitParameterDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitParameterDeclaration) {
            return visitor.visitParameterDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class IdentifierListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode[];
    public Identifier(i: number): antlr.TerminalNode | null;
    public Identifier(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Identifier);
    	} else {
    		return this.getToken(CParser.Identifier, i);
    	}
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Comma);
    	} else {
    		return this.getToken(CParser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_identifierList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterIdentifierList) {
             listener.enterIdentifierList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitIdentifierList) {
             listener.exitIdentifierList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitIdentifierList) {
            return visitor.visitIdentifierList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public specifierQualifierList(): SpecifierQualifierListContext {
        return this.getRuleContext(0, SpecifierQualifierListContext)!;
    }
    public abstractDeclarator(): AbstractDeclaratorContext | null {
        return this.getRuleContext(0, AbstractDeclaratorContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_typeName;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterTypeName) {
             listener.enterTypeName(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitTypeName) {
             listener.exitTypeName(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitTypeName) {
            return visitor.visitTypeName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AbstractDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public pointer(): PointerContext | null {
        return this.getRuleContext(0, PointerContext);
    }
    public directAbstractDeclarator(): DirectAbstractDeclaratorContext | null {
        return this.getRuleContext(0, DirectAbstractDeclaratorContext);
    }
    public gccDeclaratorExtension(): GccDeclaratorExtensionContext[];
    public gccDeclaratorExtension(i: number): GccDeclaratorExtensionContext | null;
    public gccDeclaratorExtension(i?: number): GccDeclaratorExtensionContext[] | GccDeclaratorExtensionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(GccDeclaratorExtensionContext);
        }

        return this.getRuleContext(i, GccDeclaratorExtensionContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_abstractDeclarator;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterAbstractDeclarator) {
             listener.enterAbstractDeclarator(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitAbstractDeclarator) {
             listener.exitAbstractDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitAbstractDeclarator) {
            return visitor.visitAbstractDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DirectAbstractDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftParen, 0);
    }
    public abstractDeclarator(): AbstractDeclaratorContext | null {
        return this.getRuleContext(0, AbstractDeclaratorContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightParen, 0);
    }
    public gccDeclaratorExtension(): GccDeclaratorExtensionContext[];
    public gccDeclaratorExtension(i: number): GccDeclaratorExtensionContext | null;
    public gccDeclaratorExtension(i?: number): GccDeclaratorExtensionContext[] | GccDeclaratorExtensionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(GccDeclaratorExtensionContext);
        }

        return this.getRuleContext(i, GccDeclaratorExtensionContext);
    }
    public LeftBracket(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftBracket, 0);
    }
    public RightBracket(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightBracket, 0);
    }
    public typeQualifierList(): TypeQualifierListContext | null {
        return this.getRuleContext(0, TypeQualifierListContext);
    }
    public assignmentExpression(): AssignmentExpressionContext | null {
        return this.getRuleContext(0, AssignmentExpressionContext);
    }
    public Static(): antlr.TerminalNode | null {
        return this.getToken(CParser.Static, 0);
    }
    public Star(): antlr.TerminalNode | null {
        return this.getToken(CParser.Star, 0);
    }
    public parameterTypeList(): ParameterTypeListContext | null {
        return this.getRuleContext(0, ParameterTypeListContext);
    }
    public directAbstractDeclarator(): DirectAbstractDeclaratorContext | null {
        return this.getRuleContext(0, DirectAbstractDeclaratorContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_directAbstractDeclarator;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterDirectAbstractDeclarator) {
             listener.enterDirectAbstractDeclarator(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitDirectAbstractDeclarator) {
             listener.exitDirectAbstractDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitDirectAbstractDeclarator) {
            return visitor.visitDirectAbstractDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypedefNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CParser.Identifier, 0)!;
    }
    public override get ruleIndex(): number {
        return CParser.RULE_typedefName;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterTypedefName) {
             listener.enterTypedefName(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitTypedefName) {
             listener.exitTypedefName(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitTypedefName) {
            return visitor.visitTypedefName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class InitializerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public assignmentExpression(): AssignmentExpressionContext | null {
        return this.getRuleContext(0, AssignmentExpressionContext);
    }
    public LeftBrace(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftBrace, 0);
    }
    public initializerList(): InitializerListContext | null {
        return this.getRuleContext(0, InitializerListContext);
    }
    public RightBrace(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightBrace, 0);
    }
    public Comma(): antlr.TerminalNode | null {
        return this.getToken(CParser.Comma, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_initializer;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterInitializer) {
             listener.enterInitializer(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitInitializer) {
             listener.exitInitializer(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitInitializer) {
            return visitor.visitInitializer(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class InitializerListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public initializer(): InitializerContext[];
    public initializer(i: number): InitializerContext | null;
    public initializer(i?: number): InitializerContext[] | InitializerContext | null {
        if (i === undefined) {
            return this.getRuleContexts(InitializerContext);
        }

        return this.getRuleContext(i, InitializerContext);
    }
    public designation(): DesignationContext[];
    public designation(i: number): DesignationContext | null;
    public designation(i?: number): DesignationContext[] | DesignationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DesignationContext);
        }

        return this.getRuleContext(i, DesignationContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Comma);
    	} else {
    		return this.getToken(CParser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_initializerList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterInitializerList) {
             listener.enterInitializerList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitInitializerList) {
             listener.exitInitializerList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitInitializerList) {
            return visitor.visitInitializerList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DesignationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public designatorList(): DesignatorListContext {
        return this.getRuleContext(0, DesignatorListContext)!;
    }
    public Assign(): antlr.TerminalNode {
        return this.getToken(CParser.Assign, 0)!;
    }
    public override get ruleIndex(): number {
        return CParser.RULE_designation;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterDesignation) {
             listener.enterDesignation(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitDesignation) {
             listener.exitDesignation(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitDesignation) {
            return visitor.visitDesignation(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DesignatorListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public designator(): DesignatorContext[];
    public designator(i: number): DesignatorContext | null;
    public designator(i?: number): DesignatorContext[] | DesignatorContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DesignatorContext);
        }

        return this.getRuleContext(i, DesignatorContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_designatorList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterDesignatorList) {
             listener.enterDesignatorList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitDesignatorList) {
             listener.exitDesignatorList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitDesignatorList) {
            return visitor.visitDesignatorList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DesignatorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftBracket(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftBracket, 0);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public RightBracket(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightBracket, 0);
    }
    public Dot(): antlr.TerminalNode | null {
        return this.getToken(CParser.Dot, 0);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CParser.Identifier, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_designator;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterDesignator) {
             listener.enterDesignator(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitDesignator) {
             listener.exitDesignator(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitDesignator) {
            return visitor.visitDesignator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StaticAssertDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public StaticAssert(): antlr.TerminalNode {
        return this.getToken(CParser.StaticAssert, 0)!;
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CParser.LeftParen, 0)!;
    }
    public constantExpression(): ConstantExpressionContext {
        return this.getRuleContext(0, ConstantExpressionContext)!;
    }
    public Comma(): antlr.TerminalNode {
        return this.getToken(CParser.Comma, 0)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CParser.RightParen, 0)!;
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CParser.Semi, 0)!;
    }
    public StringLiteral(): antlr.TerminalNode[];
    public StringLiteral(i: number): antlr.TerminalNode | null;
    public StringLiteral(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.StringLiteral);
    	} else {
    		return this.getToken(CParser.StringLiteral, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_staticAssertDeclaration;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterStaticAssertDeclaration) {
             listener.enterStaticAssertDeclaration(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitStaticAssertDeclaration) {
             listener.exitStaticAssertDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitStaticAssertDeclaration) {
            return visitor.visitStaticAssertDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public labeledStatement(): LabeledStatementContext | null {
        return this.getRuleContext(0, LabeledStatementContext);
    }
    public compoundStatement(): CompoundStatementContext | null {
        return this.getRuleContext(0, CompoundStatementContext);
    }
    public expressionStatement(): ExpressionStatementContext | null {
        return this.getRuleContext(0, ExpressionStatementContext);
    }
    public selectionStatement(): SelectionStatementContext | null {
        return this.getRuleContext(0, SelectionStatementContext);
    }
    public iterationStatement(): IterationStatementContext | null {
        return this.getRuleContext(0, IterationStatementContext);
    }
    public jumpStatement(): JumpStatementContext | null {
        return this.getRuleContext(0, JumpStatementContext);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.LeftParen, 0);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CParser.RightParen, 0);
    }
    public Semi(): antlr.TerminalNode | null {
        return this.getToken(CParser.Semi, 0);
    }
    public Volatile(): antlr.TerminalNode | null {
        return this.getToken(CParser.Volatile, 0);
    }
    public logicalOrExpression(): LogicalOrExpressionContext[];
    public logicalOrExpression(i: number): LogicalOrExpressionContext | null;
    public logicalOrExpression(i?: number): LogicalOrExpressionContext[] | LogicalOrExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(LogicalOrExpressionContext);
        }

        return this.getRuleContext(i, LogicalOrExpressionContext);
    }
    public Colon(): antlr.TerminalNode[];
    public Colon(i: number): antlr.TerminalNode | null;
    public Colon(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Colon);
    	} else {
    		return this.getToken(CParser.Colon, i);
    	}
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Comma);
    	} else {
    		return this.getToken(CParser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_statement;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterStatement) {
             listener.enterStatement(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitStatement) {
             listener.exitStatement(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitStatement) {
            return visitor.visitStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LabeledStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CParser.Identifier, 0);
    }
    public Colon(): antlr.TerminalNode {
        return this.getToken(CParser.Colon, 0)!;
    }
    public statement(): StatementContext | null {
        return this.getRuleContext(0, StatementContext);
    }
    public Case(): antlr.TerminalNode | null {
        return this.getToken(CParser.Case, 0);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public Default(): antlr.TerminalNode | null {
        return this.getToken(CParser.Default, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_labeledStatement;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterLabeledStatement) {
             listener.enterLabeledStatement(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitLabeledStatement) {
             listener.exitLabeledStatement(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitLabeledStatement) {
            return visitor.visitLabeledStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CompoundStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftBrace(): antlr.TerminalNode {
        return this.getToken(CParser.LeftBrace, 0)!;
    }
    public RightBrace(): antlr.TerminalNode {
        return this.getToken(CParser.RightBrace, 0)!;
    }
    public blockItemList(): BlockItemListContext | null {
        return this.getRuleContext(0, BlockItemListContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_compoundStatement;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterCompoundStatement) {
             listener.enterCompoundStatement(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitCompoundStatement) {
             listener.exitCompoundStatement(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitCompoundStatement) {
            return visitor.visitCompoundStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BlockItemListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public blockItem(): BlockItemContext[];
    public blockItem(i: number): BlockItemContext | null;
    public blockItem(i?: number): BlockItemContext[] | BlockItemContext | null {
        if (i === undefined) {
            return this.getRuleContexts(BlockItemContext);
        }

        return this.getRuleContext(i, BlockItemContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_blockItemList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterBlockItemList) {
             listener.enterBlockItemList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitBlockItemList) {
             listener.exitBlockItemList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitBlockItemList) {
            return visitor.visitBlockItemList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BlockItemContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public statement(): StatementContext | null {
        return this.getRuleContext(0, StatementContext);
    }
    public declaration(): DeclarationContext | null {
        return this.getRuleContext(0, DeclarationContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_blockItem;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterBlockItem) {
             listener.enterBlockItem(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitBlockItem) {
             listener.exitBlockItem(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitBlockItem) {
            return visitor.visitBlockItem(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExpressionStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CParser.Semi, 0)!;
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_expressionStatement;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterExpressionStatement) {
             listener.enterExpressionStatement(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitExpressionStatement) {
             listener.exitExpressionStatement(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitExpressionStatement) {
            return visitor.visitExpressionStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SelectionStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public If(): antlr.TerminalNode | null {
        return this.getToken(CParser.If, 0);
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CParser.LeftParen, 0)!;
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CParser.RightParen, 0)!;
    }
    public statement(): StatementContext[];
    public statement(i: number): StatementContext | null;
    public statement(i?: number): StatementContext[] | StatementContext | null {
        if (i === undefined) {
            return this.getRuleContexts(StatementContext);
        }

        return this.getRuleContext(i, StatementContext);
    }
    public Else(): antlr.TerminalNode | null {
        return this.getToken(CParser.Else, 0);
    }
    public Switch(): antlr.TerminalNode | null {
        return this.getToken(CParser.Switch, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_selectionStatement;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterSelectionStatement) {
             listener.enterSelectionStatement(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitSelectionStatement) {
             listener.exitSelectionStatement(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitSelectionStatement) {
            return visitor.visitSelectionStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class IterationStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public While(): antlr.TerminalNode | null {
        return this.getToken(CParser.While, 0);
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CParser.LeftParen, 0)!;
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CParser.RightParen, 0)!;
    }
    public statement(): StatementContext {
        return this.getRuleContext(0, StatementContext)!;
    }
    public Do(): antlr.TerminalNode | null {
        return this.getToken(CParser.Do, 0);
    }
    public Semi(): antlr.TerminalNode | null {
        return this.getToken(CParser.Semi, 0);
    }
    public For(): antlr.TerminalNode | null {
        return this.getToken(CParser.For, 0);
    }
    public forCondition(): ForConditionContext | null {
        return this.getRuleContext(0, ForConditionContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_iterationStatement;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterIterationStatement) {
             listener.enterIterationStatement(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitIterationStatement) {
             listener.exitIterationStatement(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitIterationStatement) {
            return visitor.visitIterationStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ForConditionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Semi(): antlr.TerminalNode[];
    public Semi(i: number): antlr.TerminalNode | null;
    public Semi(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Semi);
    	} else {
    		return this.getToken(CParser.Semi, i);
    	}
    }
    public forDeclaration(): ForDeclarationContext | null {
        return this.getRuleContext(0, ForDeclarationContext);
    }
    public forExpression(): ForExpressionContext[];
    public forExpression(i: number): ForExpressionContext | null;
    public forExpression(i?: number): ForExpressionContext[] | ForExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ForExpressionContext);
        }

        return this.getRuleContext(i, ForExpressionContext);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_forCondition;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterForCondition) {
             listener.enterForCondition(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitForCondition) {
             listener.exitForCondition(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitForCondition) {
            return visitor.visitForCondition(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ForDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declarationSpecifiers(): DeclarationSpecifiersContext {
        return this.getRuleContext(0, DeclarationSpecifiersContext)!;
    }
    public initDeclaratorList(): InitDeclaratorListContext | null {
        return this.getRuleContext(0, InitDeclaratorListContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_forDeclaration;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterForDeclaration) {
             listener.enterForDeclaration(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitForDeclaration) {
             listener.exitForDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitForDeclaration) {
            return visitor.visitForDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ForExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public assignmentExpression(): AssignmentExpressionContext[];
    public assignmentExpression(i: number): AssignmentExpressionContext | null;
    public assignmentExpression(i?: number): AssignmentExpressionContext[] | AssignmentExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AssignmentExpressionContext);
        }

        return this.getRuleContext(i, AssignmentExpressionContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CParser.Comma);
    	} else {
    		return this.getToken(CParser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CParser.RULE_forExpression;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterForExpression) {
             listener.enterForExpression(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitForExpression) {
             listener.exitForExpression(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitForExpression) {
            return visitor.visitForExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class JumpStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CParser.Semi, 0)!;
    }
    public Goto(): antlr.TerminalNode | null {
        return this.getToken(CParser.Goto, 0);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CParser.Identifier, 0);
    }
    public Continue(): antlr.TerminalNode | null {
        return this.getToken(CParser.Continue, 0);
    }
    public Break(): antlr.TerminalNode | null {
        return this.getToken(CParser.Break, 0);
    }
    public Return(): antlr.TerminalNode | null {
        return this.getToken(CParser.Return, 0);
    }
    public unaryExpression(): UnaryExpressionContext | null {
        return this.getRuleContext(0, UnaryExpressionContext);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_jumpStatement;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterJumpStatement) {
             listener.enterJumpStatement(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitJumpStatement) {
             listener.exitJumpStatement(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitJumpStatement) {
            return visitor.visitJumpStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CompilationUnitContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public EOF(): antlr.TerminalNode {
        return this.getToken(CParser.EOF, 0)!;
    }
    public translationUnit(): TranslationUnitContext | null {
        return this.getRuleContext(0, TranslationUnitContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_compilationUnit;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterCompilationUnit) {
             listener.enterCompilationUnit(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitCompilationUnit) {
             listener.exitCompilationUnit(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitCompilationUnit) {
            return visitor.visitCompilationUnit(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TranslationUnitContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public externalDeclaration(): ExternalDeclarationContext[];
    public externalDeclaration(i: number): ExternalDeclarationContext | null;
    public externalDeclaration(i?: number): ExternalDeclarationContext[] | ExternalDeclarationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ExternalDeclarationContext);
        }

        return this.getRuleContext(i, ExternalDeclarationContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_translationUnit;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterTranslationUnit) {
             listener.enterTranslationUnit(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitTranslationUnit) {
             listener.exitTranslationUnit(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitTranslationUnit) {
            return visitor.visitTranslationUnit(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExternalDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public functionDefinition(): FunctionDefinitionContext | null {
        return this.getRuleContext(0, FunctionDefinitionContext);
    }
    public declaration(): DeclarationContext | null {
        return this.getRuleContext(0, DeclarationContext);
    }
    public Semi(): antlr.TerminalNode | null {
        return this.getToken(CParser.Semi, 0);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_externalDeclaration;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterExternalDeclaration) {
             listener.enterExternalDeclaration(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitExternalDeclaration) {
             listener.exitExternalDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitExternalDeclaration) {
            return visitor.visitExternalDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FunctionDefinitionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declarator(): DeclaratorContext {
        return this.getRuleContext(0, DeclaratorContext)!;
    }
    public compoundStatement(): CompoundStatementContext {
        return this.getRuleContext(0, CompoundStatementContext)!;
    }
    public declarationSpecifiers(): DeclarationSpecifiersContext | null {
        return this.getRuleContext(0, DeclarationSpecifiersContext);
    }
    public declarationList(): DeclarationListContext | null {
        return this.getRuleContext(0, DeclarationListContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_functionDefinition;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterFunctionDefinition) {
             listener.enterFunctionDefinition(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitFunctionDefinition) {
             listener.exitFunctionDefinition(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitFunctionDefinition) {
            return visitor.visitFunctionDefinition(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclarationListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declaration(): DeclarationContext[];
    public declaration(i: number): DeclarationContext | null;
    public declaration(i?: number): DeclarationContext[] | DeclarationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DeclarationContext);
        }

        return this.getRuleContext(i, DeclarationContext);
    }
    public override get ruleIndex(): number {
        return CParser.RULE_declarationList;
    }
    public override enterRule(listener: CListener): void {
        if(listener.enterDeclarationList) {
             listener.enterDeclarationList(this);
        }
    }
    public override exitRule(listener: CListener): void {
        if(listener.exitDeclarationList) {
             listener.exitDeclarationList(this);
        }
    }
    public override accept<Result>(visitor: CVisitor<Result>): Result | null {
        if (visitor.visitDeclarationList) {
            return visitor.visitDeclarationList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
