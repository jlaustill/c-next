// Generated from grammar/CPP14Parser.g4 by ANTLR 4.13.1

import * as antlr from "antlr4ng";
import { Token } from "antlr4ng";

import { CPP14ParserListener } from "./CPP14ParserListener.js";
import { CPP14ParserVisitor } from "./CPP14ParserVisitor.js";

// for running tests with parameters, TODO: discuss strategy for typed parameters in CI
// eslint-disable-next-line no-unused-vars
type int = number;


export class CPP14Parser extends antlr.Parser {
    public static readonly IntegerLiteral = 1;
    public static readonly CharacterLiteral = 2;
    public static readonly FloatingLiteral = 3;
    public static readonly StringLiteral = 4;
    public static readonly BooleanLiteral = 5;
    public static readonly PointerLiteral = 6;
    public static readonly UserDefinedLiteral = 7;
    public static readonly MultiLineMacro = 8;
    public static readonly Directive = 9;
    public static readonly Alignas = 10;
    public static readonly Alignof = 11;
    public static readonly Asm = 12;
    public static readonly Auto = 13;
    public static readonly Bool = 14;
    public static readonly Break = 15;
    public static readonly Case = 16;
    public static readonly Catch = 17;
    public static readonly Char = 18;
    public static readonly Char16 = 19;
    public static readonly Char32 = 20;
    public static readonly Class = 21;
    public static readonly Const = 22;
    public static readonly Constexpr = 23;
    public static readonly Const_cast = 24;
    public static readonly Continue = 25;
    public static readonly Decltype = 26;
    public static readonly Default = 27;
    public static readonly Delete = 28;
    public static readonly Do = 29;
    public static readonly Double = 30;
    public static readonly Dynamic_cast = 31;
    public static readonly Else = 32;
    public static readonly Enum = 33;
    public static readonly Explicit = 34;
    public static readonly Export = 35;
    public static readonly Extern = 36;
    public static readonly False_ = 37;
    public static readonly Final = 38;
    public static readonly Float = 39;
    public static readonly For = 40;
    public static readonly Friend = 41;
    public static readonly Goto = 42;
    public static readonly If = 43;
    public static readonly Inline = 44;
    public static readonly Int = 45;
    public static readonly Long = 46;
    public static readonly Mutable = 47;
    public static readonly Namespace = 48;
    public static readonly New = 49;
    public static readonly Noexcept = 50;
    public static readonly Nullptr = 51;
    public static readonly Operator = 52;
    public static readonly Override = 53;
    public static readonly Private = 54;
    public static readonly Protected = 55;
    public static readonly Public = 56;
    public static readonly Register = 57;
    public static readonly Reinterpret_cast = 58;
    public static readonly Return = 59;
    public static readonly Short = 60;
    public static readonly Signed = 61;
    public static readonly Sizeof = 62;
    public static readonly Static = 63;
    public static readonly Static_assert = 64;
    public static readonly Static_cast = 65;
    public static readonly Struct = 66;
    public static readonly Switch = 67;
    public static readonly Template = 68;
    public static readonly This = 69;
    public static readonly Thread_local = 70;
    public static readonly Throw = 71;
    public static readonly True_ = 72;
    public static readonly Try = 73;
    public static readonly Typedef = 74;
    public static readonly Typeid_ = 75;
    public static readonly Typename_ = 76;
    public static readonly Union = 77;
    public static readonly Unsigned = 78;
    public static readonly Using = 79;
    public static readonly Virtual = 80;
    public static readonly Void = 81;
    public static readonly Volatile = 82;
    public static readonly Wchar = 83;
    public static readonly While = 84;
    public static readonly LeftParen = 85;
    public static readonly RightParen = 86;
    public static readonly LeftBracket = 87;
    public static readonly RightBracket = 88;
    public static readonly LeftBrace = 89;
    public static readonly RightBrace = 90;
    public static readonly Plus = 91;
    public static readonly Minus = 92;
    public static readonly Star = 93;
    public static readonly Div = 94;
    public static readonly Mod = 95;
    public static readonly Caret = 96;
    public static readonly And = 97;
    public static readonly Or = 98;
    public static readonly Tilde = 99;
    public static readonly Not = 100;
    public static readonly Assign = 101;
    public static readonly Less = 102;
    public static readonly Greater = 103;
    public static readonly PlusAssign = 104;
    public static readonly MinusAssign = 105;
    public static readonly StarAssign = 106;
    public static readonly DivAssign = 107;
    public static readonly ModAssign = 108;
    public static readonly XorAssign = 109;
    public static readonly AndAssign = 110;
    public static readonly OrAssign = 111;
    public static readonly LeftShiftAssign = 112;
    public static readonly RightShiftAssign = 113;
    public static readonly Equal = 114;
    public static readonly NotEqual = 115;
    public static readonly LessEqual = 116;
    public static readonly GreaterEqual = 117;
    public static readonly AndAnd = 118;
    public static readonly OrOr = 119;
    public static readonly PlusPlus = 120;
    public static readonly MinusMinus = 121;
    public static readonly Comma = 122;
    public static readonly ArrowStar = 123;
    public static readonly Arrow = 124;
    public static readonly Question = 125;
    public static readonly Colon = 126;
    public static readonly Doublecolon = 127;
    public static readonly Semi = 128;
    public static readonly Dot = 129;
    public static readonly DotStar = 130;
    public static readonly Ellipsis = 131;
    public static readonly Identifier = 132;
    public static readonly DecimalLiteral = 133;
    public static readonly OctalLiteral = 134;
    public static readonly HexadecimalLiteral = 135;
    public static readonly BinaryLiteral = 136;
    public static readonly Integersuffix = 137;
    public static readonly UserDefinedIntegerLiteral = 138;
    public static readonly UserDefinedFloatingLiteral = 139;
    public static readonly UserDefinedStringLiteral = 140;
    public static readonly UserDefinedCharacterLiteral = 141;
    public static readonly Whitespace = 142;
    public static readonly Newline = 143;
    public static readonly BlockComment = 144;
    public static readonly LineComment = 145;
    public static readonly RULE_translationUnit = 0;
    public static readonly RULE_primaryExpression = 1;
    public static readonly RULE_idExpression = 2;
    public static readonly RULE_unqualifiedId = 3;
    public static readonly RULE_qualifiedId = 4;
    public static readonly RULE_nestedNameSpecifier = 5;
    public static readonly RULE_lambdaExpression = 6;
    public static readonly RULE_lambdaIntroducer = 7;
    public static readonly RULE_lambdaCapture = 8;
    public static readonly RULE_captureDefault = 9;
    public static readonly RULE_captureList = 10;
    public static readonly RULE_capture = 11;
    public static readonly RULE_simpleCapture = 12;
    public static readonly RULE_initcapture = 13;
    public static readonly RULE_lambdaDeclarator = 14;
    public static readonly RULE_postfixExpression = 15;
    public static readonly RULE_typeIdOfTheTypeId = 16;
    public static readonly RULE_expressionList = 17;
    public static readonly RULE_pseudoDestructorName = 18;
    public static readonly RULE_unaryExpression = 19;
    public static readonly RULE_unaryOperator = 20;
    public static readonly RULE_newExpression_ = 21;
    public static readonly RULE_newPlacement = 22;
    public static readonly RULE_newTypeId = 23;
    public static readonly RULE_newDeclarator_ = 24;
    public static readonly RULE_noPointerNewDeclarator = 25;
    public static readonly RULE_newInitializer_ = 26;
    public static readonly RULE_deleteExpression = 27;
    public static readonly RULE_noExceptExpression = 28;
    public static readonly RULE_castExpression = 29;
    public static readonly RULE_pointerMemberExpression = 30;
    public static readonly RULE_multiplicativeExpression = 31;
    public static readonly RULE_additiveExpression = 32;
    public static readonly RULE_shiftExpression = 33;
    public static readonly RULE_shiftOperator = 34;
    public static readonly RULE_relationalExpression = 35;
    public static readonly RULE_equalityExpression = 36;
    public static readonly RULE_andExpression = 37;
    public static readonly RULE_exclusiveOrExpression = 38;
    public static readonly RULE_inclusiveOrExpression = 39;
    public static readonly RULE_logicalAndExpression = 40;
    public static readonly RULE_logicalOrExpression = 41;
    public static readonly RULE_conditionalExpression = 42;
    public static readonly RULE_assignmentExpression = 43;
    public static readonly RULE_assignmentOperator = 44;
    public static readonly RULE_expression = 45;
    public static readonly RULE_constantExpression = 46;
    public static readonly RULE_statement = 47;
    public static readonly RULE_labeledStatement = 48;
    public static readonly RULE_expressionStatement = 49;
    public static readonly RULE_compoundStatement = 50;
    public static readonly RULE_statementSeq = 51;
    public static readonly RULE_selectionStatement = 52;
    public static readonly RULE_condition = 53;
    public static readonly RULE_iterationStatement = 54;
    public static readonly RULE_forInitStatement = 55;
    public static readonly RULE_forRangeDeclaration = 56;
    public static readonly RULE_forRangeInitializer = 57;
    public static readonly RULE_jumpStatement = 58;
    public static readonly RULE_declarationStatement = 59;
    public static readonly RULE_declarationseq = 60;
    public static readonly RULE_declaration = 61;
    public static readonly RULE_blockDeclaration = 62;
    public static readonly RULE_aliasDeclaration = 63;
    public static readonly RULE_simpleDeclaration = 64;
    public static readonly RULE_staticAssertDeclaration = 65;
    public static readonly RULE_emptyDeclaration_ = 66;
    public static readonly RULE_attributeDeclaration = 67;
    public static readonly RULE_declSpecifier = 68;
    public static readonly RULE_declSpecifierSeq = 69;
    public static readonly RULE_storageClassSpecifier = 70;
    public static readonly RULE_functionSpecifier = 71;
    public static readonly RULE_typedefName = 72;
    public static readonly RULE_typeSpecifier = 73;
    public static readonly RULE_trailingTypeSpecifier = 74;
    public static readonly RULE_typeSpecifierSeq = 75;
    public static readonly RULE_trailingTypeSpecifierSeq = 76;
    public static readonly RULE_simpleTypeLengthModifier = 77;
    public static readonly RULE_simpleTypeSignednessModifier = 78;
    public static readonly RULE_simpleTypeSpecifier = 79;
    public static readonly RULE_theTypeName = 80;
    public static readonly RULE_decltypeSpecifier = 81;
    public static readonly RULE_elaboratedTypeSpecifier = 82;
    public static readonly RULE_enumName = 83;
    public static readonly RULE_enumSpecifier = 84;
    public static readonly RULE_enumHead = 85;
    public static readonly RULE_opaqueEnumDeclaration = 86;
    public static readonly RULE_enumkey = 87;
    public static readonly RULE_enumbase = 88;
    public static readonly RULE_enumeratorList = 89;
    public static readonly RULE_enumeratorDefinition = 90;
    public static readonly RULE_enumerator = 91;
    public static readonly RULE_namespaceName = 92;
    public static readonly RULE_originalNamespaceName = 93;
    public static readonly RULE_namespaceDefinition = 94;
    public static readonly RULE_namespaceAlias = 95;
    public static readonly RULE_namespaceAliasDefinition = 96;
    public static readonly RULE_qualifiednamespacespecifier = 97;
    public static readonly RULE_usingDeclaration = 98;
    public static readonly RULE_usingDirective = 99;
    public static readonly RULE_asmDefinition = 100;
    public static readonly RULE_linkageSpecification = 101;
    public static readonly RULE_attributeSpecifierSeq = 102;
    public static readonly RULE_attributeSpecifier = 103;
    public static readonly RULE_alignmentspecifier = 104;
    public static readonly RULE_attributeList = 105;
    public static readonly RULE_attribute = 106;
    public static readonly RULE_attributeNamespace = 107;
    public static readonly RULE_attributeArgumentClause = 108;
    public static readonly RULE_balancedTokenSeq = 109;
    public static readonly RULE_balancedtoken = 110;
    public static readonly RULE_initDeclaratorList = 111;
    public static readonly RULE_initDeclarator = 112;
    public static readonly RULE_declarator = 113;
    public static readonly RULE_pointerDeclarator = 114;
    public static readonly RULE_noPointerDeclarator = 115;
    public static readonly RULE_parametersAndQualifiers = 116;
    public static readonly RULE_trailingReturnType = 117;
    public static readonly RULE_pointerOperator = 118;
    public static readonly RULE_cvqualifierseq = 119;
    public static readonly RULE_cvQualifier = 120;
    public static readonly RULE_refqualifier = 121;
    public static readonly RULE_declaratorid = 122;
    public static readonly RULE_theTypeId = 123;
    public static readonly RULE_abstractDeclarator = 124;
    public static readonly RULE_pointerAbstractDeclarator = 125;
    public static readonly RULE_noPointerAbstractDeclarator = 126;
    public static readonly RULE_abstractPackDeclarator = 127;
    public static readonly RULE_noPointerAbstractPackDeclarator = 128;
    public static readonly RULE_parameterDeclarationClause = 129;
    public static readonly RULE_parameterDeclarationList = 130;
    public static readonly RULE_parameterDeclaration = 131;
    public static readonly RULE_functionDefinition = 132;
    public static readonly RULE_functionBody = 133;
    public static readonly RULE_initializer = 134;
    public static readonly RULE_braceOrEqualInitializer = 135;
    public static readonly RULE_initializerClause = 136;
    public static readonly RULE_initializerList = 137;
    public static readonly RULE_bracedInitList = 138;
    public static readonly RULE_className = 139;
    public static readonly RULE_classSpecifier = 140;
    public static readonly RULE_classHead = 141;
    public static readonly RULE_classHeadName = 142;
    public static readonly RULE_classVirtSpecifier = 143;
    public static readonly RULE_classKey = 144;
    public static readonly RULE_memberSpecification = 145;
    public static readonly RULE_memberdeclaration = 146;
    public static readonly RULE_memberDeclaratorList = 147;
    public static readonly RULE_memberDeclarator = 148;
    public static readonly RULE_virtualSpecifierSeq = 149;
    public static readonly RULE_virtualSpecifier = 150;
    public static readonly RULE_pureSpecifier = 151;
    public static readonly RULE_baseClause = 152;
    public static readonly RULE_baseSpecifierList = 153;
    public static readonly RULE_baseSpecifier = 154;
    public static readonly RULE_classOrDeclType = 155;
    public static readonly RULE_baseTypeSpecifier = 156;
    public static readonly RULE_accessSpecifier = 157;
    public static readonly RULE_conversionFunctionId = 158;
    public static readonly RULE_conversionTypeId = 159;
    public static readonly RULE_conversionDeclarator = 160;
    public static readonly RULE_constructorInitializer = 161;
    public static readonly RULE_memInitializerList = 162;
    public static readonly RULE_memInitializer = 163;
    public static readonly RULE_meminitializerid = 164;
    public static readonly RULE_operatorFunctionId = 165;
    public static readonly RULE_literalOperatorId = 166;
    public static readonly RULE_templateDeclaration = 167;
    public static readonly RULE_templateparameterList = 168;
    public static readonly RULE_templateParameter = 169;
    public static readonly RULE_typeParameter = 170;
    public static readonly RULE_simpleTemplateId = 171;
    public static readonly RULE_templateId = 172;
    public static readonly RULE_templateName = 173;
    public static readonly RULE_templateArgumentList = 174;
    public static readonly RULE_templateArgument = 175;
    public static readonly RULE_typeNameSpecifier = 176;
    public static readonly RULE_explicitInstantiation = 177;
    public static readonly RULE_explicitSpecialization = 178;
    public static readonly RULE_tryBlock = 179;
    public static readonly RULE_functionTryBlock = 180;
    public static readonly RULE_handlerSeq = 181;
    public static readonly RULE_handler = 182;
    public static readonly RULE_exceptionDeclaration = 183;
    public static readonly RULE_throwExpression = 184;
    public static readonly RULE_exceptionSpecification = 185;
    public static readonly RULE_dynamicExceptionSpecification = 186;
    public static readonly RULE_typeIdList = 187;
    public static readonly RULE_noeExceptSpecification = 188;
    public static readonly RULE_theOperator = 189;
    public static readonly RULE_literal = 190;

    public static readonly literalNames = [
        null, null, null, null, null, null, null, null, null, null, "'alignas'", 
        "'alignof'", "'asm'", "'auto'", "'bool'", "'break'", "'case'", "'catch'", 
        "'char'", "'char16_t'", "'char32_t'", "'class'", "'const'", "'constexpr'", 
        "'const_cast'", "'continue'", "'decltype'", "'default'", "'delete'", 
        "'do'", "'double'", "'dynamic_cast'", "'else'", "'enum'", "'explicit'", 
        "'export'", "'extern'", "'false'", "'final'", "'float'", "'for'", 
        "'friend'", "'goto'", "'if'", "'inline'", "'int'", "'long'", "'mutable'", 
        "'namespace'", "'new'", "'noexcept'", "'nullptr'", "'operator'", 
        "'override'", "'private'", "'protected'", "'public'", "'register'", 
        "'reinterpret_cast'", "'return'", "'short'", "'signed'", "'sizeof'", 
        "'static'", "'static_assert'", "'static_cast'", "'struct'", "'switch'", 
        "'template'", "'this'", "'thread_local'", "'throw'", "'true'", "'try'", 
        "'typedef'", "'typeid'", "'typename'", "'union'", "'unsigned'", 
        "'using'", "'virtual'", "'void'", "'volatile'", "'wchar_t'", "'while'", 
        "'('", "')'", "'['", "']'", "'{'", "'}'", "'+'", "'-'", "'*'", "'/'", 
        "'%'", "'^'", "'&'", "'|'", "'~'", null, "'='", "'<'", "'>'", "'+='", 
        "'-='", "'*='", "'/='", "'%='", "'^='", "'&='", "'|='", "'<<='", 
        "'>>='", "'=='", "'!='", "'<='", "'>='", null, null, "'++'", "'--'", 
        "','", "'->*'", "'->'", "'?'", "':'", "'::'", "';'", "'.'", "'.*'", 
        "'...'"
    ];

    public static readonly symbolicNames = [
        null, "IntegerLiteral", "CharacterLiteral", "FloatingLiteral", "StringLiteral", 
        "BooleanLiteral", "PointerLiteral", "UserDefinedLiteral", "MultiLineMacro", 
        "Directive", "Alignas", "Alignof", "Asm", "Auto", "Bool", "Break", 
        "Case", "Catch", "Char", "Char16", "Char32", "Class", "Const", "Constexpr", 
        "Const_cast", "Continue", "Decltype", "Default", "Delete", "Do", 
        "Double", "Dynamic_cast", "Else", "Enum", "Explicit", "Export", 
        "Extern", "False_", "Final", "Float", "For", "Friend", "Goto", "If", 
        "Inline", "Int", "Long", "Mutable", "Namespace", "New", "Noexcept", 
        "Nullptr", "Operator", "Override", "Private", "Protected", "Public", 
        "Register", "Reinterpret_cast", "Return", "Short", "Signed", "Sizeof", 
        "Static", "Static_assert", "Static_cast", "Struct", "Switch", "Template", 
        "This", "Thread_local", "Throw", "True_", "Try", "Typedef", "Typeid_", 
        "Typename_", "Union", "Unsigned", "Using", "Virtual", "Void", "Volatile", 
        "Wchar", "While", "LeftParen", "RightParen", "LeftBracket", "RightBracket", 
        "LeftBrace", "RightBrace", "Plus", "Minus", "Star", "Div", "Mod", 
        "Caret", "And", "Or", "Tilde", "Not", "Assign", "Less", "Greater", 
        "PlusAssign", "MinusAssign", "StarAssign", "DivAssign", "ModAssign", 
        "XorAssign", "AndAssign", "OrAssign", "LeftShiftAssign", "RightShiftAssign", 
        "Equal", "NotEqual", "LessEqual", "GreaterEqual", "AndAnd", "OrOr", 
        "PlusPlus", "MinusMinus", "Comma", "ArrowStar", "Arrow", "Question", 
        "Colon", "Doublecolon", "Semi", "Dot", "DotStar", "Ellipsis", "Identifier", 
        "DecimalLiteral", "OctalLiteral", "HexadecimalLiteral", "BinaryLiteral", 
        "Integersuffix", "UserDefinedIntegerLiteral", "UserDefinedFloatingLiteral", 
        "UserDefinedStringLiteral", "UserDefinedCharacterLiteral", "Whitespace", 
        "Newline", "BlockComment", "LineComment"
    ];
    public static readonly ruleNames = [
        "translationUnit", "primaryExpression", "idExpression", "unqualifiedId", 
        "qualifiedId", "nestedNameSpecifier", "lambdaExpression", "lambdaIntroducer", 
        "lambdaCapture", "captureDefault", "captureList", "capture", "simpleCapture", 
        "initcapture", "lambdaDeclarator", "postfixExpression", "typeIdOfTheTypeId", 
        "expressionList", "pseudoDestructorName", "unaryExpression", "unaryOperator", 
        "newExpression_", "newPlacement", "newTypeId", "newDeclarator_", 
        "noPointerNewDeclarator", "newInitializer_", "deleteExpression", 
        "noExceptExpression", "castExpression", "pointerMemberExpression", 
        "multiplicativeExpression", "additiveExpression", "shiftExpression", 
        "shiftOperator", "relationalExpression", "equalityExpression", "andExpression", 
        "exclusiveOrExpression", "inclusiveOrExpression", "logicalAndExpression", 
        "logicalOrExpression", "conditionalExpression", "assignmentExpression", 
        "assignmentOperator", "expression", "constantExpression", "statement", 
        "labeledStatement", "expressionStatement", "compoundStatement", 
        "statementSeq", "selectionStatement", "condition", "iterationStatement", 
        "forInitStatement", "forRangeDeclaration", "forRangeInitializer", 
        "jumpStatement", "declarationStatement", "declarationseq", "declaration", 
        "blockDeclaration", "aliasDeclaration", "simpleDeclaration", "staticAssertDeclaration", 
        "emptyDeclaration_", "attributeDeclaration", "declSpecifier", "declSpecifierSeq", 
        "storageClassSpecifier", "functionSpecifier", "typedefName", "typeSpecifier", 
        "trailingTypeSpecifier", "typeSpecifierSeq", "trailingTypeSpecifierSeq", 
        "simpleTypeLengthModifier", "simpleTypeSignednessModifier", "simpleTypeSpecifier", 
        "theTypeName", "decltypeSpecifier", "elaboratedTypeSpecifier", "enumName", 
        "enumSpecifier", "enumHead", "opaqueEnumDeclaration", "enumkey", 
        "enumbase", "enumeratorList", "enumeratorDefinition", "enumerator", 
        "namespaceName", "originalNamespaceName", "namespaceDefinition", 
        "namespaceAlias", "namespaceAliasDefinition", "qualifiednamespacespecifier", 
        "usingDeclaration", "usingDirective", "asmDefinition", "linkageSpecification", 
        "attributeSpecifierSeq", "attributeSpecifier", "alignmentspecifier", 
        "attributeList", "attribute", "attributeNamespace", "attributeArgumentClause", 
        "balancedTokenSeq", "balancedtoken", "initDeclaratorList", "initDeclarator", 
        "declarator", "pointerDeclarator", "noPointerDeclarator", "parametersAndQualifiers", 
        "trailingReturnType", "pointerOperator", "cvqualifierseq", "cvQualifier", 
        "refqualifier", "declaratorid", "theTypeId", "abstractDeclarator", 
        "pointerAbstractDeclarator", "noPointerAbstractDeclarator", "abstractPackDeclarator", 
        "noPointerAbstractPackDeclarator", "parameterDeclarationClause", 
        "parameterDeclarationList", "parameterDeclaration", "functionDefinition", 
        "functionBody", "initializer", "braceOrEqualInitializer", "initializerClause", 
        "initializerList", "bracedInitList", "className", "classSpecifier", 
        "classHead", "classHeadName", "classVirtSpecifier", "classKey", 
        "memberSpecification", "memberdeclaration", "memberDeclaratorList", 
        "memberDeclarator", "virtualSpecifierSeq", "virtualSpecifier", "pureSpecifier", 
        "baseClause", "baseSpecifierList", "baseSpecifier", "classOrDeclType", 
        "baseTypeSpecifier", "accessSpecifier", "conversionFunctionId", 
        "conversionTypeId", "conversionDeclarator", "constructorInitializer", 
        "memInitializerList", "memInitializer", "meminitializerid", "operatorFunctionId", 
        "literalOperatorId", "templateDeclaration", "templateparameterList", 
        "templateParameter", "typeParameter", "simpleTemplateId", "templateId", 
        "templateName", "templateArgumentList", "templateArgument", "typeNameSpecifier", 
        "explicitInstantiation", "explicitSpecialization", "tryBlock", "functionTryBlock", 
        "handlerSeq", "handler", "exceptionDeclaration", "throwExpression", 
        "exceptionSpecification", "dynamicExceptionSpecification", "typeIdList", 
        "noeExceptSpecification", "theOperator", "literal",
    ];

    public get grammarFileName(): string { return "CPP14Parser.g4"; }
    public get literalNames(): (string | null)[] { return CPP14Parser.literalNames; }
    public get symbolicNames(): (string | null)[] { return CPP14Parser.symbolicNames; }
    public get ruleNames(): string[] { return CPP14Parser.ruleNames; }
    public get serializedATN(): number[] { return CPP14Parser._serializedATN; }

    protected createFailedPredicateException(predicate?: string, message?: string): antlr.FailedPredicateException {
        return new antlr.FailedPredicateException(this, predicate, message);
    }

    public constructor(input: antlr.TokenStream) {
        super(input);
        this.interpreter = new antlr.ParserATNSimulator(this, CPP14Parser._ATN, CPP14Parser.decisionsToDFA, new antlr.PredictionContextCache());
    }
    public translationUnit(): TranslationUnitContext {
        let localContext = new TranslationUnitContext(this.context, this.state);
        this.enterRule(localContext, 0, CPP14Parser.RULE_translationUnit);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 383;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 2777759517) !== 0) || ((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & 1163600159) !== 0) || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 10619647) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 26113) !== 0)) {
                {
                this.state = 382;
                this.declarationseq();
                }
            }

            this.state = 385;
            this.match(CPP14Parser.EOF);
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
    public primaryExpression(): PrimaryExpressionContext {
        let localContext = new PrimaryExpressionContext(this.context, this.state);
        this.enterRule(localContext, 2, CPP14Parser.RULE_primaryExpression);
        try {
            let alternative: number;
            this.state = 399;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.IntegerLiteral:
            case CPP14Parser.CharacterLiteral:
            case CPP14Parser.FloatingLiteral:
            case CPP14Parser.StringLiteral:
            case CPP14Parser.BooleanLiteral:
            case CPP14Parser.PointerLiteral:
            case CPP14Parser.UserDefinedLiteral:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 388;
                this.errorHandler.sync(this);
                alternative = 1;
                do {
                    switch (alternative) {
                    case 1:
                        {
                        {
                        this.state = 387;
                        this.literal();
                        }
                        }
                        break;
                    default:
                        throw new antlr.NoViableAltException(this);
                    }
                    this.state = 390;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 1, this.context);
                } while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER);
                }
                break;
            case CPP14Parser.This:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 392;
                this.match(CPP14Parser.This);
                }
                break;
            case CPP14Parser.LeftParen:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 393;
                this.match(CPP14Parser.LeftParen);
                this.state = 394;
                this.expression();
                this.state = 395;
                this.match(CPP14Parser.RightParen);
                }
                break;
            case CPP14Parser.Decltype:
            case CPP14Parser.Operator:
            case CPP14Parser.Tilde:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Identifier:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 397;
                this.idExpression();
                }
                break;
            case CPP14Parser.LeftBracket:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 398;
                this.lambdaExpression();
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
    public idExpression(): IdExpressionContext {
        let localContext = new IdExpressionContext(this.context, this.state);
        this.enterRule(localContext, 4, CPP14Parser.RULE_idExpression);
        try {
            this.state = 403;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 3, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 401;
                this.unqualifiedId();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 402;
                this.qualifiedId();
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
    public unqualifiedId(): UnqualifiedIdContext {
        let localContext = new UnqualifiedIdContext(this.context, this.state);
        this.enterRule(localContext, 6, CPP14Parser.RULE_unqualifiedId);
        try {
            this.state = 415;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 5, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 405;
                this.match(CPP14Parser.Identifier);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 406;
                this.operatorFunctionId();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 407;
                this.conversionFunctionId();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 408;
                this.literalOperatorId();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 409;
                this.match(CPP14Parser.Tilde);
                this.state = 412;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case CPP14Parser.Identifier:
                    {
                    this.state = 410;
                    this.className();
                    }
                    break;
                case CPP14Parser.Decltype:
                    {
                    this.state = 411;
                    this.decltypeSpecifier();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 414;
                this.templateId();
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
    public qualifiedId(): QualifiedIdContext {
        let localContext = new QualifiedIdContext(this.context, this.state);
        this.enterRule(localContext, 8, CPP14Parser.RULE_qualifiedId);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 417;
            this.nestedNameSpecifier(0);
            this.state = 419;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 68) {
                {
                this.state = 418;
                this.match(CPP14Parser.Template);
                }
            }

            this.state = 421;
            this.unqualifiedId();
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

    public nestedNameSpecifier(): NestedNameSpecifierContext;
    public nestedNameSpecifier(_p: number): NestedNameSpecifierContext;
    public nestedNameSpecifier(_p?: number): NestedNameSpecifierContext {
        if (_p === undefined) {
            _p = 0;
        }

        let parentContext = this.context;
        let parentState = this.state;
        let localContext = new NestedNameSpecifierContext(this.context, parentState);
        let previousContext = localContext;
        let _startState = 10;
        this.enterRecursionRule(localContext, 10, CPP14Parser.RULE_nestedNameSpecifier, _p);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            {
            this.state = 427;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 7, this.context) ) {
            case 1:
                {
                this.state = 424;
                this.theTypeName();
                }
                break;
            case 2:
                {
                this.state = 425;
                this.namespaceName();
                }
                break;
            case 3:
                {
                this.state = 426;
                this.decltypeSpecifier();
                }
                break;
            }
            this.state = 429;
            this.match(CPP14Parser.Doublecolon);
            }
            this.context!.stop = this.tokenStream.LT(-1);
            this.state = 442;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 10, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    if (this.parseListeners != null) {
                        this.triggerExitRuleEvent();
                    }
                    previousContext = localContext;
                    {
                    {
                    localContext = new NestedNameSpecifierContext(parentContext, parentState);
                    this.pushNewRecursionContext(localContext, _startState, CPP14Parser.RULE_nestedNameSpecifier);
                    this.state = 431;
                    if (!(this.precpred(this.context, 1))) {
                        throw this.createFailedPredicateException("this.precpred(this.context, 1)");
                    }
                    this.state = 437;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 9, this.context) ) {
                    case 1:
                        {
                        this.state = 432;
                        this.match(CPP14Parser.Identifier);
                        }
                        break;
                    case 2:
                        {
                        this.state = 434;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if (_la === 68) {
                            {
                            this.state = 433;
                            this.match(CPP14Parser.Template);
                            }
                        }

                        this.state = 436;
                        this.simpleTemplateId();
                        }
                        break;
                    }
                    this.state = 439;
                    this.match(CPP14Parser.Doublecolon);
                    }
                    }
                }
                this.state = 444;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 10, this.context);
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
    public lambdaExpression(): LambdaExpressionContext {
        let localContext = new LambdaExpressionContext(this.context, this.state);
        this.enterRule(localContext, 12, CPP14Parser.RULE_lambdaExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 445;
            this.lambdaIntroducer();
            this.state = 447;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 85) {
                {
                this.state = 446;
                this.lambdaDeclarator();
                }
            }

            this.state = 449;
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
    public lambdaIntroducer(): LambdaIntroducerContext {
        let localContext = new LambdaIntroducerContext(this.context, this.state);
        this.enterRule(localContext, 14, CPP14Parser.RULE_lambdaIntroducer);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 451;
            this.match(CPP14Parser.LeftBracket);
            this.state = 453;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 69 || _la === 97 || _la === 101 || _la === 132) {
                {
                this.state = 452;
                this.lambdaCapture();
                }
            }

            this.state = 455;
            this.match(CPP14Parser.RightBracket);
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
    public lambdaCapture(): LambdaCaptureContext {
        let localContext = new LambdaCaptureContext(this.context, this.state);
        this.enterRule(localContext, 16, CPP14Parser.RULE_lambdaCapture);
        let _la: number;
        try {
            this.state = 463;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 14, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 457;
                this.captureList();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 458;
                this.captureDefault();
                this.state = 461;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 122) {
                    {
                    this.state = 459;
                    this.match(CPP14Parser.Comma);
                    this.state = 460;
                    this.captureList();
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
    public captureDefault(): CaptureDefaultContext {
        let localContext = new CaptureDefaultContext(this.context, this.state);
        this.enterRule(localContext, 18, CPP14Parser.RULE_captureDefault);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 465;
            _la = this.tokenStream.LA(1);
            if(!(_la === 97 || _la === 101)) {
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
    public captureList(): CaptureListContext {
        let localContext = new CaptureListContext(this.context, this.state);
        this.enterRule(localContext, 20, CPP14Parser.RULE_captureList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 467;
            this.capture();
            this.state = 472;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 122) {
                {
                {
                this.state = 468;
                this.match(CPP14Parser.Comma);
                this.state = 469;
                this.capture();
                }
                }
                this.state = 474;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 476;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 131) {
                {
                this.state = 475;
                this.match(CPP14Parser.Ellipsis);
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
    public capture(): CaptureContext {
        let localContext = new CaptureContext(this.context, this.state);
        this.enterRule(localContext, 22, CPP14Parser.RULE_capture);
        try {
            this.state = 480;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 17, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 478;
                this.simpleCapture();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 479;
                this.initcapture();
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
    public simpleCapture(): SimpleCaptureContext {
        let localContext = new SimpleCaptureContext(this.context, this.state);
        this.enterRule(localContext, 24, CPP14Parser.RULE_simpleCapture);
        let _la: number;
        try {
            this.state = 487;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.And:
            case CPP14Parser.Identifier:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 483;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 97) {
                    {
                    this.state = 482;
                    this.match(CPP14Parser.And);
                    }
                }

                this.state = 485;
                this.match(CPP14Parser.Identifier);
                }
                break;
            case CPP14Parser.This:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 486;
                this.match(CPP14Parser.This);
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
    public initcapture(): InitcaptureContext {
        let localContext = new InitcaptureContext(this.context, this.state);
        this.enterRule(localContext, 26, CPP14Parser.RULE_initcapture);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 490;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 97) {
                {
                this.state = 489;
                this.match(CPP14Parser.And);
                }
            }

            this.state = 492;
            this.match(CPP14Parser.Identifier);
            this.state = 493;
            this.initializer();
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
    public lambdaDeclarator(): LambdaDeclaratorContext {
        let localContext = new LambdaDeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 28, CPP14Parser.RULE_lambdaDeclarator);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 495;
            this.match(CPP14Parser.LeftParen);
            this.state = 497;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1157391360) !== 0) || ((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1493203275) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2350353) !== 0) || _la === 127 || _la === 132) {
                {
                this.state = 496;
                this.parameterDeclarationClause();
                }
            }

            this.state = 499;
            this.match(CPP14Parser.RightParen);
            this.state = 501;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 47) {
                {
                this.state = 500;
                this.match(CPP14Parser.Mutable);
                }
            }

            this.state = 504;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 50 || _la === 71) {
                {
                this.state = 503;
                this.exceptionSpecification();
                }
            }

            this.state = 507;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 87) {
                {
                this.state = 506;
                this.attributeSpecifierSeq();
                }
            }

            this.state = 510;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 124) {
                {
                this.state = 509;
                this.trailingReturnType();
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

    public postfixExpression(): PostfixExpressionContext;
    public postfixExpression(_p: number): PostfixExpressionContext;
    public postfixExpression(_p?: number): PostfixExpressionContext {
        if (_p === undefined) {
            _p = 0;
        }

        let parentContext = this.context;
        let parentState = this.state;
        let localContext = new PostfixExpressionContext(this.context, parentState);
        let previousContext = localContext;
        let _startState = 30;
        this.enterRecursionRule(localContext, 30, CPP14Parser.RULE_postfixExpression, _p);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 542;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 30, this.context) ) {
            case 1:
                {
                this.state = 513;
                this.primaryExpression();
                }
                break;
            case 2:
                {
                this.state = 516;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case CPP14Parser.Auto:
                case CPP14Parser.Bool:
                case CPP14Parser.Char:
                case CPP14Parser.Char16:
                case CPP14Parser.Char32:
                case CPP14Parser.Decltype:
                case CPP14Parser.Double:
                case CPP14Parser.Float:
                case CPP14Parser.Int:
                case CPP14Parser.Long:
                case CPP14Parser.Short:
                case CPP14Parser.Signed:
                case CPP14Parser.Unsigned:
                case CPP14Parser.Void:
                case CPP14Parser.Wchar:
                case CPP14Parser.Doublecolon:
                case CPP14Parser.Identifier:
                    {
                    this.state = 514;
                    this.simpleTypeSpecifier();
                    }
                    break;
                case CPP14Parser.Typename_:
                    {
                    this.state = 515;
                    this.typeNameSpecifier();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 524;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case CPP14Parser.LeftParen:
                    {
                    this.state = 518;
                    this.match(CPP14Parser.LeftParen);
                    this.state = 520;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3575408894) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 1156066497) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1014322353) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 4227) !== 0)) {
                        {
                        this.state = 519;
                        this.expressionList();
                        }
                    }

                    this.state = 522;
                    this.match(CPP14Parser.RightParen);
                    }
                    break;
                case CPP14Parser.LeftBrace:
                    {
                    this.state = 523;
                    this.bracedInitList();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                break;
            case 3:
                {
                this.state = 526;
                _la = this.tokenStream.LA(1);
                if(!(_la === 24 || _la === 31 || _la === 58 || _la === 65)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 527;
                this.match(CPP14Parser.Less);
                this.state = 528;
                this.theTypeId();
                this.state = 529;
                this.match(CPP14Parser.Greater);
                this.state = 530;
                this.match(CPP14Parser.LeftParen);
                this.state = 531;
                this.expression();
                this.state = 532;
                this.match(CPP14Parser.RightParen);
                }
                break;
            case 4:
                {
                this.state = 534;
                this.typeIdOfTheTypeId();
                this.state = 535;
                this.match(CPP14Parser.LeftParen);
                this.state = 538;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 29, this.context) ) {
                case 1:
                    {
                    this.state = 536;
                    this.expression();
                    }
                    break;
                case 2:
                    {
                    this.state = 537;
                    this.theTypeId();
                    }
                    break;
                }
                this.state = 540;
                this.match(CPP14Parser.RightParen);
                }
                break;
            }
            this.context!.stop = this.tokenStream.LT(-1);
            this.state = 571;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 36, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    if (this.parseListeners != null) {
                        this.triggerExitRuleEvent();
                    }
                    previousContext = localContext;
                    {
                    this.state = 569;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 35, this.context) ) {
                    case 1:
                        {
                        localContext = new PostfixExpressionContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CPP14Parser.RULE_postfixExpression);
                        this.state = 544;
                        if (!(this.precpred(this.context, 7))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 7)");
                        }
                        this.state = 545;
                        this.match(CPP14Parser.LeftBracket);
                        this.state = 548;
                        this.errorHandler.sync(this);
                        switch (this.tokenStream.LA(1)) {
                        case CPP14Parser.IntegerLiteral:
                        case CPP14Parser.CharacterLiteral:
                        case CPP14Parser.FloatingLiteral:
                        case CPP14Parser.StringLiteral:
                        case CPP14Parser.BooleanLiteral:
                        case CPP14Parser.PointerLiteral:
                        case CPP14Parser.UserDefinedLiteral:
                        case CPP14Parser.Alignof:
                        case CPP14Parser.Auto:
                        case CPP14Parser.Bool:
                        case CPP14Parser.Char:
                        case CPP14Parser.Char16:
                        case CPP14Parser.Char32:
                        case CPP14Parser.Const_cast:
                        case CPP14Parser.Decltype:
                        case CPP14Parser.Delete:
                        case CPP14Parser.Double:
                        case CPP14Parser.Dynamic_cast:
                        case CPP14Parser.Float:
                        case CPP14Parser.Int:
                        case CPP14Parser.Long:
                        case CPP14Parser.New:
                        case CPP14Parser.Noexcept:
                        case CPP14Parser.Operator:
                        case CPP14Parser.Reinterpret_cast:
                        case CPP14Parser.Short:
                        case CPP14Parser.Signed:
                        case CPP14Parser.Sizeof:
                        case CPP14Parser.Static_cast:
                        case CPP14Parser.This:
                        case CPP14Parser.Throw:
                        case CPP14Parser.Typeid_:
                        case CPP14Parser.Typename_:
                        case CPP14Parser.Unsigned:
                        case CPP14Parser.Void:
                        case CPP14Parser.Wchar:
                        case CPP14Parser.LeftParen:
                        case CPP14Parser.LeftBracket:
                        case CPP14Parser.Plus:
                        case CPP14Parser.Minus:
                        case CPP14Parser.Star:
                        case CPP14Parser.And:
                        case CPP14Parser.Or:
                        case CPP14Parser.Tilde:
                        case CPP14Parser.Not:
                        case CPP14Parser.PlusPlus:
                        case CPP14Parser.MinusMinus:
                        case CPP14Parser.Doublecolon:
                        case CPP14Parser.Identifier:
                            {
                            this.state = 546;
                            this.expression();
                            }
                            break;
                        case CPP14Parser.LeftBrace:
                            {
                            this.state = 547;
                            this.bracedInitList();
                            }
                            break;
                        default:
                            throw new antlr.NoViableAltException(this);
                        }
                        this.state = 550;
                        this.match(CPP14Parser.RightBracket);
                        }
                        break;
                    case 2:
                        {
                        localContext = new PostfixExpressionContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CPP14Parser.RULE_postfixExpression);
                        this.state = 552;
                        if (!(this.precpred(this.context, 6))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 6)");
                        }
                        this.state = 553;
                        this.match(CPP14Parser.LeftParen);
                        this.state = 555;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3575408894) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 1156066497) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1014322353) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 4227) !== 0)) {
                            {
                            this.state = 554;
                            this.expressionList();
                            }
                        }

                        this.state = 557;
                        this.match(CPP14Parser.RightParen);
                        }
                        break;
                    case 3:
                        {
                        localContext = new PostfixExpressionContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CPP14Parser.RULE_postfixExpression);
                        this.state = 558;
                        if (!(this.precpred(this.context, 4))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 4)");
                        }
                        this.state = 559;
                        _la = this.tokenStream.LA(1);
                        if(!(_la === 124 || _la === 129)) {
                        this.errorHandler.recoverInline(this);
                        }
                        else {
                            this.errorHandler.reportMatch(this);
                            this.consume();
                        }
                        this.state = 565;
                        this.errorHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this.tokenStream, 34, this.context) ) {
                        case 1:
                            {
                            this.state = 561;
                            this.errorHandler.sync(this);
                            _la = this.tokenStream.LA(1);
                            if (_la === 68) {
                                {
                                this.state = 560;
                                this.match(CPP14Parser.Template);
                                }
                            }

                            this.state = 563;
                            this.idExpression();
                            }
                            break;
                        case 2:
                            {
                            this.state = 564;
                            this.pseudoDestructorName();
                            }
                            break;
                        }
                        }
                        break;
                    case 4:
                        {
                        localContext = new PostfixExpressionContext(parentContext, parentState);
                        this.pushNewRecursionContext(localContext, _startState, CPP14Parser.RULE_postfixExpression);
                        this.state = 567;
                        if (!(this.precpred(this.context, 3))) {
                            throw this.createFailedPredicateException("this.precpred(this.context, 3)");
                        }
                        this.state = 568;
                        _la = this.tokenStream.LA(1);
                        if(!(_la === 120 || _la === 121)) {
                        this.errorHandler.recoverInline(this);
                        }
                        else {
                            this.errorHandler.reportMatch(this);
                            this.consume();
                        }
                        }
                        break;
                    }
                    }
                }
                this.state = 573;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 36, this.context);
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
    public typeIdOfTheTypeId(): TypeIdOfTheTypeIdContext {
        let localContext = new TypeIdOfTheTypeIdContext(this.context, this.state);
        this.enterRule(localContext, 32, CPP14Parser.RULE_typeIdOfTheTypeId);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 574;
            this.match(CPP14Parser.Typeid_);
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
    public expressionList(): ExpressionListContext {
        let localContext = new ExpressionListContext(this.context, this.state);
        this.enterRule(localContext, 34, CPP14Parser.RULE_expressionList);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 576;
            this.initializerList();
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
    public pseudoDestructorName(): PseudoDestructorNameContext {
        let localContext = new PseudoDestructorNameContext(this.context, this.state);
        this.enterRule(localContext, 36, CPP14Parser.RULE_pseudoDestructorName);
        let _la: number;
        try {
            this.state = 597;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 39, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 579;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 37, this.context) ) {
                case 1:
                    {
                    this.state = 578;
                    this.nestedNameSpecifier(0);
                    }
                    break;
                }
                this.state = 584;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 132) {
                    {
                    this.state = 581;
                    this.theTypeName();
                    this.state = 582;
                    this.match(CPP14Parser.Doublecolon);
                    }
                }

                this.state = 586;
                this.match(CPP14Parser.Tilde);
                this.state = 587;
                this.theTypeName();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 588;
                this.nestedNameSpecifier(0);
                this.state = 589;
                this.match(CPP14Parser.Template);
                this.state = 590;
                this.simpleTemplateId();
                this.state = 591;
                this.match(CPP14Parser.Doublecolon);
                this.state = 592;
                this.match(CPP14Parser.Tilde);
                this.state = 593;
                this.theTypeName();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 595;
                this.match(CPP14Parser.Tilde);
                this.state = 596;
                this.decltypeSpecifier();
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
    public unaryExpression(): UnaryExpressionContext {
        let localContext = new UnaryExpressionContext(this.context, this.state);
        this.enterRule(localContext, 38, CPP14Parser.RULE_unaryExpression);
        try {
            this.state = 626;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 42, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 599;
                this.postfixExpression(0);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 604;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case CPP14Parser.PlusPlus:
                    {
                    this.state = 600;
                    this.match(CPP14Parser.PlusPlus);
                    }
                    break;
                case CPP14Parser.MinusMinus:
                    {
                    this.state = 601;
                    this.match(CPP14Parser.MinusMinus);
                    }
                    break;
                case CPP14Parser.Plus:
                case CPP14Parser.Minus:
                case CPP14Parser.Star:
                case CPP14Parser.And:
                case CPP14Parser.Or:
                case CPP14Parser.Tilde:
                case CPP14Parser.Not:
                    {
                    this.state = 602;
                    this.unaryOperator();
                    }
                    break;
                case CPP14Parser.Sizeof:
                    {
                    this.state = 603;
                    this.match(CPP14Parser.Sizeof);
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 606;
                this.unaryExpression();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 607;
                this.match(CPP14Parser.Sizeof);
                this.state = 616;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case CPP14Parser.LeftParen:
                    {
                    this.state = 608;
                    this.match(CPP14Parser.LeftParen);
                    this.state = 609;
                    this.theTypeId();
                    this.state = 610;
                    this.match(CPP14Parser.RightParen);
                    }
                    break;
                case CPP14Parser.Ellipsis:
                    {
                    this.state = 612;
                    this.match(CPP14Parser.Ellipsis);
                    this.state = 613;
                    this.match(CPP14Parser.LeftParen);
                    this.state = 614;
                    this.match(CPP14Parser.Identifier);
                    this.state = 615;
                    this.match(CPP14Parser.RightParen);
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 618;
                this.match(CPP14Parser.Alignof);
                this.state = 619;
                this.match(CPP14Parser.LeftParen);
                this.state = 620;
                this.theTypeId();
                this.state = 621;
                this.match(CPP14Parser.RightParen);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 623;
                this.noExceptExpression();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 624;
                this.newExpression_();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 625;
                this.deleteExpression();
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
    public unaryOperator(): UnaryOperatorContext {
        let localContext = new UnaryOperatorContext(this.context, this.state);
        this.enterRule(localContext, 40, CPP14Parser.RULE_unaryOperator);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 628;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 91)) & ~0x1F) === 0 && ((1 << (_la - 91)) & 967) !== 0))) {
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
    public newExpression_(): NewExpression_Context {
        let localContext = new NewExpression_Context(this.context, this.state);
        this.enterRule(localContext, 42, CPP14Parser.RULE_newExpression_);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 631;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 127) {
                {
                this.state = 630;
                this.match(CPP14Parser.Doublecolon);
                }
            }

            this.state = 633;
            this.match(CPP14Parser.New);
            this.state = 635;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 44, this.context) ) {
            case 1:
                {
                this.state = 634;
                this.newPlacement();
                }
                break;
            }
            this.state = 642;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Auto:
            case CPP14Parser.Bool:
            case CPP14Parser.Char:
            case CPP14Parser.Char16:
            case CPP14Parser.Char32:
            case CPP14Parser.Class:
            case CPP14Parser.Const:
            case CPP14Parser.Decltype:
            case CPP14Parser.Double:
            case CPP14Parser.Enum:
            case CPP14Parser.Float:
            case CPP14Parser.Int:
            case CPP14Parser.Long:
            case CPP14Parser.Short:
            case CPP14Parser.Signed:
            case CPP14Parser.Struct:
            case CPP14Parser.Typename_:
            case CPP14Parser.Union:
            case CPP14Parser.Unsigned:
            case CPP14Parser.Void:
            case CPP14Parser.Volatile:
            case CPP14Parser.Wchar:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Identifier:
                {
                this.state = 637;
                this.newTypeId();
                }
                break;
            case CPP14Parser.LeftParen:
                {
                this.state = 638;
                this.match(CPP14Parser.LeftParen);
                this.state = 639;
                this.theTypeId();
                this.state = 640;
                this.match(CPP14Parser.RightParen);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.state = 645;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 85 || _la === 89) {
                {
                this.state = 644;
                this.newInitializer_();
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
    public newPlacement(): NewPlacementContext {
        let localContext = new NewPlacementContext(this.context, this.state);
        this.enterRule(localContext, 44, CPP14Parser.RULE_newPlacement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 647;
            this.match(CPP14Parser.LeftParen);
            this.state = 648;
            this.expressionList();
            this.state = 649;
            this.match(CPP14Parser.RightParen);
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
    public newTypeId(): NewTypeIdContext {
        let localContext = new NewTypeIdContext(this.context, this.state);
        this.enterRule(localContext, 46, CPP14Parser.RULE_newTypeId);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 651;
            this.typeSpecifierSeq();
            this.state = 653;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 47, this.context) ) {
            case 1:
                {
                this.state = 652;
                this.newDeclarator_();
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
    public newDeclarator_(): NewDeclarator_Context {
        let localContext = new NewDeclarator_Context(this.context, this.state);
        this.enterRule(localContext, 48, CPP14Parser.RULE_newDeclarator_);
        try {
            this.state = 660;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Decltype:
            case CPP14Parser.Star:
            case CPP14Parser.And:
            case CPP14Parser.AndAnd:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Identifier:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 655;
                this.pointerOperator();
                this.state = 657;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 48, this.context) ) {
                case 1:
                    {
                    this.state = 656;
                    this.newDeclarator_();
                    }
                    break;
                }
                }
                break;
            case CPP14Parser.LeftBracket:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 659;
                this.noPointerNewDeclarator(0);
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

    public noPointerNewDeclarator(): NoPointerNewDeclaratorContext;
    public noPointerNewDeclarator(_p: number): NoPointerNewDeclaratorContext;
    public noPointerNewDeclarator(_p?: number): NoPointerNewDeclaratorContext {
        if (_p === undefined) {
            _p = 0;
        }

        let parentContext = this.context;
        let parentState = this.state;
        let localContext = new NoPointerNewDeclaratorContext(this.context, parentState);
        let previousContext = localContext;
        let _startState = 50;
        this.enterRecursionRule(localContext, 50, CPP14Parser.RULE_noPointerNewDeclarator, _p);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            {
            this.state = 663;
            this.match(CPP14Parser.LeftBracket);
            this.state = 664;
            this.expression();
            this.state = 665;
            this.match(CPP14Parser.RightBracket);
            this.state = 667;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 50, this.context) ) {
            case 1:
                {
                this.state = 666;
                this.attributeSpecifierSeq();
                }
                break;
            }
            }
            this.context!.stop = this.tokenStream.LT(-1);
            this.state = 678;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 52, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    if (this.parseListeners != null) {
                        this.triggerExitRuleEvent();
                    }
                    previousContext = localContext;
                    {
                    {
                    localContext = new NoPointerNewDeclaratorContext(parentContext, parentState);
                    this.pushNewRecursionContext(localContext, _startState, CPP14Parser.RULE_noPointerNewDeclarator);
                    this.state = 669;
                    if (!(this.precpred(this.context, 1))) {
                        throw this.createFailedPredicateException("this.precpred(this.context, 1)");
                    }
                    this.state = 670;
                    this.match(CPP14Parser.LeftBracket);
                    this.state = 671;
                    this.constantExpression();
                    this.state = 672;
                    this.match(CPP14Parser.RightBracket);
                    this.state = 674;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 51, this.context) ) {
                    case 1:
                        {
                        this.state = 673;
                        this.attributeSpecifierSeq();
                        }
                        break;
                    }
                    }
                    }
                }
                this.state = 680;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 52, this.context);
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
    public newInitializer_(): NewInitializer_Context {
        let localContext = new NewInitializer_Context(this.context, this.state);
        this.enterRule(localContext, 52, CPP14Parser.RULE_newInitializer_);
        let _la: number;
        try {
            this.state = 687;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.LeftParen:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 681;
                this.match(CPP14Parser.LeftParen);
                this.state = 683;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3575408894) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 1156066497) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1014322353) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 4227) !== 0)) {
                    {
                    this.state = 682;
                    this.expressionList();
                    }
                }

                this.state = 685;
                this.match(CPP14Parser.RightParen);
                }
                break;
            case CPP14Parser.LeftBrace:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 686;
                this.bracedInitList();
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
    public deleteExpression(): DeleteExpressionContext {
        let localContext = new DeleteExpressionContext(this.context, this.state);
        this.enterRule(localContext, 54, CPP14Parser.RULE_deleteExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 690;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 127) {
                {
                this.state = 689;
                this.match(CPP14Parser.Doublecolon);
                }
            }

            this.state = 692;
            this.match(CPP14Parser.Delete);
            this.state = 695;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 56, this.context) ) {
            case 1:
                {
                this.state = 693;
                this.match(CPP14Parser.LeftBracket);
                this.state = 694;
                this.match(CPP14Parser.RightBracket);
                }
                break;
            }
            this.state = 697;
            this.castExpression();
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
    public noExceptExpression(): NoExceptExpressionContext {
        let localContext = new NoExceptExpressionContext(this.context, this.state);
        this.enterRule(localContext, 56, CPP14Parser.RULE_noExceptExpression);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 699;
            this.match(CPP14Parser.Noexcept);
            this.state = 700;
            this.match(CPP14Parser.LeftParen);
            this.state = 701;
            this.expression();
            this.state = 702;
            this.match(CPP14Parser.RightParen);
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
        this.enterRule(localContext, 58, CPP14Parser.RULE_castExpression);
        try {
            this.state = 710;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 57, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 704;
                this.unaryExpression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 705;
                this.match(CPP14Parser.LeftParen);
                this.state = 706;
                this.theTypeId();
                this.state = 707;
                this.match(CPP14Parser.RightParen);
                this.state = 708;
                this.castExpression();
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
    public pointerMemberExpression(): PointerMemberExpressionContext {
        let localContext = new PointerMemberExpressionContext(this.context, this.state);
        this.enterRule(localContext, 60, CPP14Parser.RULE_pointerMemberExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 712;
            this.castExpression();
            this.state = 717;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 123 || _la === 130) {
                {
                {
                this.state = 713;
                _la = this.tokenStream.LA(1);
                if(!(_la === 123 || _la === 130)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 714;
                this.castExpression();
                }
                }
                this.state = 719;
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
    public multiplicativeExpression(): MultiplicativeExpressionContext {
        let localContext = new MultiplicativeExpressionContext(this.context, this.state);
        this.enterRule(localContext, 62, CPP14Parser.RULE_multiplicativeExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 720;
            this.pointerMemberExpression();
            this.state = 725;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (((((_la - 93)) & ~0x1F) === 0 && ((1 << (_la - 93)) & 7) !== 0)) {
                {
                {
                this.state = 721;
                _la = this.tokenStream.LA(1);
                if(!(((((_la - 93)) & ~0x1F) === 0 && ((1 << (_la - 93)) & 7) !== 0))) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 722;
                this.pointerMemberExpression();
                }
                }
                this.state = 727;
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
        this.enterRule(localContext, 64, CPP14Parser.RULE_additiveExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 728;
            this.multiplicativeExpression();
            this.state = 733;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 91 || _la === 92) {
                {
                {
                this.state = 729;
                _la = this.tokenStream.LA(1);
                if(!(_la === 91 || _la === 92)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 730;
                this.multiplicativeExpression();
                }
                }
                this.state = 735;
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
        this.enterRule(localContext, 66, CPP14Parser.RULE_shiftExpression);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 736;
            this.additiveExpression();
            this.state = 742;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 61, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 737;
                    this.shiftOperator();
                    this.state = 738;
                    this.additiveExpression();
                    }
                    }
                }
                this.state = 744;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 61, this.context);
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
    public shiftOperator(): ShiftOperatorContext {
        let localContext = new ShiftOperatorContext(this.context, this.state);
        this.enterRule(localContext, 68, CPP14Parser.RULE_shiftOperator);
        try {
            this.state = 749;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Greater:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 745;
                this.match(CPP14Parser.Greater);
                this.state = 746;
                this.match(CPP14Parser.Greater);
                }
                break;
            case CPP14Parser.Less:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 747;
                this.match(CPP14Parser.Less);
                this.state = 748;
                this.match(CPP14Parser.Less);
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
    public relationalExpression(): RelationalExpressionContext {
        let localContext = new RelationalExpressionContext(this.context, this.state);
        this.enterRule(localContext, 70, CPP14Parser.RULE_relationalExpression);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 751;
            this.shiftExpression();
            this.state = 756;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 63, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 752;
                    _la = this.tokenStream.LA(1);
                    if(!(((((_la - 102)) & ~0x1F) === 0 && ((1 << (_la - 102)) & 49155) !== 0))) {
                    this.errorHandler.recoverInline(this);
                    }
                    else {
                        this.errorHandler.reportMatch(this);
                        this.consume();
                    }
                    this.state = 753;
                    this.shiftExpression();
                    }
                    }
                }
                this.state = 758;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 63, this.context);
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
        this.enterRule(localContext, 72, CPP14Parser.RULE_equalityExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 759;
            this.relationalExpression();
            this.state = 764;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 114 || _la === 115) {
                {
                {
                this.state = 760;
                _la = this.tokenStream.LA(1);
                if(!(_la === 114 || _la === 115)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 761;
                this.relationalExpression();
                }
                }
                this.state = 766;
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
        this.enterRule(localContext, 74, CPP14Parser.RULE_andExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 767;
            this.equalityExpression();
            this.state = 772;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 97) {
                {
                {
                this.state = 768;
                this.match(CPP14Parser.And);
                this.state = 769;
                this.equalityExpression();
                }
                }
                this.state = 774;
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
        this.enterRule(localContext, 76, CPP14Parser.RULE_exclusiveOrExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 775;
            this.andExpression();
            this.state = 780;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 96) {
                {
                {
                this.state = 776;
                this.match(CPP14Parser.Caret);
                this.state = 777;
                this.andExpression();
                }
                }
                this.state = 782;
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
        this.enterRule(localContext, 78, CPP14Parser.RULE_inclusiveOrExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 783;
            this.exclusiveOrExpression();
            this.state = 788;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 98) {
                {
                {
                this.state = 784;
                this.match(CPP14Parser.Or);
                this.state = 785;
                this.exclusiveOrExpression();
                }
                }
                this.state = 790;
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
        this.enterRule(localContext, 80, CPP14Parser.RULE_logicalAndExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 791;
            this.inclusiveOrExpression();
            this.state = 796;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 118) {
                {
                {
                this.state = 792;
                this.match(CPP14Parser.AndAnd);
                this.state = 793;
                this.inclusiveOrExpression();
                }
                }
                this.state = 798;
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
        this.enterRule(localContext, 82, CPP14Parser.RULE_logicalOrExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 799;
            this.logicalAndExpression();
            this.state = 804;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 119) {
                {
                {
                this.state = 800;
                this.match(CPP14Parser.OrOr);
                this.state = 801;
                this.logicalAndExpression();
                }
                }
                this.state = 806;
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
        this.enterRule(localContext, 84, CPP14Parser.RULE_conditionalExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 807;
            this.logicalOrExpression();
            this.state = 813;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 125) {
                {
                this.state = 808;
                this.match(CPP14Parser.Question);
                this.state = 809;
                this.expression();
                this.state = 810;
                this.match(CPP14Parser.Colon);
                this.state = 811;
                this.assignmentExpression();
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
        this.enterRule(localContext, 86, CPP14Parser.RULE_assignmentExpression);
        try {
            this.state = 821;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 71, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 815;
                this.conditionalExpression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 816;
                this.logicalOrExpression();
                this.state = 817;
                this.assignmentOperator();
                this.state = 818;
                this.initializerClause();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 820;
                this.throwExpression();
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
        this.enterRule(localContext, 88, CPP14Parser.RULE_assignmentOperator);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 823;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 101)) & ~0x1F) === 0 && ((1 << (_la - 101)) & 8185) !== 0))) {
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
        this.enterRule(localContext, 90, CPP14Parser.RULE_expression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 825;
            this.assignmentExpression();
            this.state = 830;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 122) {
                {
                {
                this.state = 826;
                this.match(CPP14Parser.Comma);
                this.state = 827;
                this.assignmentExpression();
                }
                }
                this.state = 832;
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
        this.enterRule(localContext, 92, CPP14Parser.RULE_constantExpression);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 833;
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
    public statement(): StatementContext {
        let localContext = new StatementContext(this.context, this.state);
        this.enterRule(localContext, 94, CPP14Parser.RULE_statement);
        try {
            this.state = 848;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 75, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 835;
                this.labeledStatement();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 836;
                this.declarationStatement();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 838;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 73, this.context) ) {
                case 1:
                    {
                    this.state = 837;
                    this.attributeSpecifierSeq();
                    }
                    break;
                }
                this.state = 846;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case CPP14Parser.IntegerLiteral:
                case CPP14Parser.CharacterLiteral:
                case CPP14Parser.FloatingLiteral:
                case CPP14Parser.StringLiteral:
                case CPP14Parser.BooleanLiteral:
                case CPP14Parser.PointerLiteral:
                case CPP14Parser.UserDefinedLiteral:
                case CPP14Parser.Alignof:
                case CPP14Parser.Auto:
                case CPP14Parser.Bool:
                case CPP14Parser.Char:
                case CPP14Parser.Char16:
                case CPP14Parser.Char32:
                case CPP14Parser.Const_cast:
                case CPP14Parser.Decltype:
                case CPP14Parser.Delete:
                case CPP14Parser.Double:
                case CPP14Parser.Dynamic_cast:
                case CPP14Parser.Float:
                case CPP14Parser.Int:
                case CPP14Parser.Long:
                case CPP14Parser.New:
                case CPP14Parser.Noexcept:
                case CPP14Parser.Operator:
                case CPP14Parser.Reinterpret_cast:
                case CPP14Parser.Short:
                case CPP14Parser.Signed:
                case CPP14Parser.Sizeof:
                case CPP14Parser.Static_cast:
                case CPP14Parser.This:
                case CPP14Parser.Throw:
                case CPP14Parser.Typeid_:
                case CPP14Parser.Typename_:
                case CPP14Parser.Unsigned:
                case CPP14Parser.Void:
                case CPP14Parser.Wchar:
                case CPP14Parser.LeftParen:
                case CPP14Parser.LeftBracket:
                case CPP14Parser.Plus:
                case CPP14Parser.Minus:
                case CPP14Parser.Star:
                case CPP14Parser.And:
                case CPP14Parser.Or:
                case CPP14Parser.Tilde:
                case CPP14Parser.Not:
                case CPP14Parser.PlusPlus:
                case CPP14Parser.MinusMinus:
                case CPP14Parser.Doublecolon:
                case CPP14Parser.Semi:
                case CPP14Parser.Identifier:
                    {
                    this.state = 840;
                    this.expressionStatement();
                    }
                    break;
                case CPP14Parser.LeftBrace:
                    {
                    this.state = 841;
                    this.compoundStatement();
                    }
                    break;
                case CPP14Parser.If:
                case CPP14Parser.Switch:
                    {
                    this.state = 842;
                    this.selectionStatement();
                    }
                    break;
                case CPP14Parser.Do:
                case CPP14Parser.For:
                case CPP14Parser.While:
                    {
                    this.state = 843;
                    this.iterationStatement();
                    }
                    break;
                case CPP14Parser.Break:
                case CPP14Parser.Continue:
                case CPP14Parser.Goto:
                case CPP14Parser.Return:
                    {
                    this.state = 844;
                    this.jumpStatement();
                    }
                    break;
                case CPP14Parser.Try:
                    {
                    this.state = 845;
                    this.tryBlock();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
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
    public labeledStatement(): LabeledStatementContext {
        let localContext = new LabeledStatementContext(this.context, this.state);
        this.enterRule(localContext, 96, CPP14Parser.RULE_labeledStatement);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 851;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 87) {
                {
                this.state = 850;
                this.attributeSpecifierSeq();
                }
            }

            this.state = 857;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Identifier:
                {
                this.state = 853;
                this.match(CPP14Parser.Identifier);
                }
                break;
            case CPP14Parser.Case:
                {
                this.state = 854;
                this.match(CPP14Parser.Case);
                this.state = 855;
                this.constantExpression();
                }
                break;
            case CPP14Parser.Default:
                {
                this.state = 856;
                this.match(CPP14Parser.Default);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.state = 859;
            this.match(CPP14Parser.Colon);
            this.state = 860;
            this.statement();
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
        this.enterRule(localContext, 98, CPP14Parser.RULE_expressionStatement);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 863;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3575408894) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 1156066497) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1014060209) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 4227) !== 0)) {
                {
                this.state = 862;
                this.expression();
                }
            }

            this.state = 865;
            this.match(CPP14Parser.Semi);
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
        this.enterRule(localContext, 100, CPP14Parser.RULE_compoundStatement);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 867;
            this.match(CPP14Parser.LeftBrace);
            this.state = 869;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294835454) !== 0) || ((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 4278976459) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 492830583) !== 0) || ((((_la - 97)) & ~0x1F) === 0 && ((1 << (_la - 97)) & 3248488463) !== 0) || _la === 131 || _la === 132) {
                {
                this.state = 868;
                this.statementSeq();
                }
            }

            this.state = 871;
            this.match(CPP14Parser.RightBrace);
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
    public statementSeq(): StatementSeqContext {
        let localContext = new StatementSeqContext(this.context, this.state);
        this.enterRule(localContext, 102, CPP14Parser.RULE_statementSeq);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 874;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 873;
                this.statement();
                }
                }
                this.state = 876;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294835454) !== 0) || ((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 4278976459) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 492830583) !== 0) || ((((_la - 97)) & ~0x1F) === 0 && ((1 << (_la - 97)) & 3248488463) !== 0) || _la === 131 || _la === 132);
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
        this.enterRule(localContext, 104, CPP14Parser.RULE_selectionStatement);
        try {
            this.state = 893;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.If:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 878;
                this.match(CPP14Parser.If);
                this.state = 879;
                this.match(CPP14Parser.LeftParen);
                this.state = 880;
                this.condition();
                this.state = 881;
                this.match(CPP14Parser.RightParen);
                this.state = 882;
                this.statement();
                this.state = 885;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 81, this.context) ) {
                case 1:
                    {
                    this.state = 883;
                    this.match(CPP14Parser.Else);
                    this.state = 884;
                    this.statement();
                    }
                    break;
                }
                }
                break;
            case CPP14Parser.Switch:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 887;
                this.match(CPP14Parser.Switch);
                this.state = 888;
                this.match(CPP14Parser.LeftParen);
                this.state = 889;
                this.condition();
                this.state = 890;
                this.match(CPP14Parser.RightParen);
                this.state = 891;
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
    public condition(): ConditionContext {
        let localContext = new ConditionContext(this.context, this.state);
        this.enterRule(localContext, 106, CPP14Parser.RULE_condition);
        let _la: number;
        try {
            this.state = 906;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 85, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 895;
                this.expression();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 897;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 10 || _la === 87) {
                    {
                    this.state = 896;
                    this.attributeSpecifierSeq();
                    }
                }

                this.state = 899;
                this.declSpecifierSeq();
                this.state = 900;
                this.declarator();
                this.state = 904;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case CPP14Parser.Assign:
                    {
                    this.state = 901;
                    this.match(CPP14Parser.Assign);
                    this.state = 902;
                    this.initializerClause();
                    }
                    break;
                case CPP14Parser.LeftBrace:
                    {
                    this.state = 903;
                    this.bracedInitList();
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
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
    public iterationStatement(): IterationStatementContext {
        let localContext = new IterationStatementContext(this.context, this.state);
        this.enterRule(localContext, 108, CPP14Parser.RULE_iterationStatement);
        let _la: number;
        try {
            this.state = 941;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.While:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 908;
                this.match(CPP14Parser.While);
                this.state = 909;
                this.match(CPP14Parser.LeftParen);
                this.state = 910;
                this.condition();
                this.state = 911;
                this.match(CPP14Parser.RightParen);
                this.state = 912;
                this.statement();
                }
                break;
            case CPP14Parser.Do:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 914;
                this.match(CPP14Parser.Do);
                this.state = 915;
                this.statement();
                this.state = 916;
                this.match(CPP14Parser.While);
                this.state = 917;
                this.match(CPP14Parser.LeftParen);
                this.state = 918;
                this.expression();
                this.state = 919;
                this.match(CPP14Parser.RightParen);
                this.state = 920;
                this.match(CPP14Parser.Semi);
                }
                break;
            case CPP14Parser.For:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 922;
                this.match(CPP14Parser.For);
                this.state = 923;
                this.match(CPP14Parser.LeftParen);
                this.state = 936;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 88, this.context) ) {
                case 1:
                    {
                    this.state = 924;
                    this.forInitStatement();
                    this.state = 926;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3590089982) !== 0) || ((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 2064349515) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 475512435) !== 0) || ((((_la - 97)) & ~0x1F) === 0 && ((1 << (_la - 97)) & 1098907663) !== 0) || _la === 132) {
                        {
                        this.state = 925;
                        this.condition();
                        }
                    }

                    this.state = 928;
                    this.match(CPP14Parser.Semi);
                    this.state = 930;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3575408894) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 1156066497) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1014060209) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 4227) !== 0)) {
                        {
                        this.state = 929;
                        this.expression();
                        }
                    }

                    }
                    break;
                case 2:
                    {
                    this.state = 932;
                    this.forRangeDeclaration();
                    this.state = 933;
                    this.match(CPP14Parser.Colon);
                    this.state = 934;
                    this.forRangeInitializer();
                    }
                    break;
                }
                this.state = 938;
                this.match(CPP14Parser.RightParen);
                this.state = 939;
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
    public forInitStatement(): ForInitStatementContext {
        let localContext = new ForInitStatementContext(this.context, this.state);
        this.enterRule(localContext, 110, CPP14Parser.RULE_forInitStatement);
        try {
            this.state = 945;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 90, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 943;
                this.expressionStatement();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 944;
                this.simpleDeclaration();
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
    public forRangeDeclaration(): ForRangeDeclarationContext {
        let localContext = new ForRangeDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 112, CPP14Parser.RULE_forRangeDeclaration);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 948;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 87) {
                {
                this.state = 947;
                this.attributeSpecifierSeq();
                }
            }

            this.state = 950;
            this.declSpecifierSeq();
            this.state = 951;
            this.declarator();
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
    public forRangeInitializer(): ForRangeInitializerContext {
        let localContext = new ForRangeInitializerContext(this.context, this.state);
        this.enterRule(localContext, 114, CPP14Parser.RULE_forRangeInitializer);
        try {
            this.state = 955;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.IntegerLiteral:
            case CPP14Parser.CharacterLiteral:
            case CPP14Parser.FloatingLiteral:
            case CPP14Parser.StringLiteral:
            case CPP14Parser.BooleanLiteral:
            case CPP14Parser.PointerLiteral:
            case CPP14Parser.UserDefinedLiteral:
            case CPP14Parser.Alignof:
            case CPP14Parser.Auto:
            case CPP14Parser.Bool:
            case CPP14Parser.Char:
            case CPP14Parser.Char16:
            case CPP14Parser.Char32:
            case CPP14Parser.Const_cast:
            case CPP14Parser.Decltype:
            case CPP14Parser.Delete:
            case CPP14Parser.Double:
            case CPP14Parser.Dynamic_cast:
            case CPP14Parser.Float:
            case CPP14Parser.Int:
            case CPP14Parser.Long:
            case CPP14Parser.New:
            case CPP14Parser.Noexcept:
            case CPP14Parser.Operator:
            case CPP14Parser.Reinterpret_cast:
            case CPP14Parser.Short:
            case CPP14Parser.Signed:
            case CPP14Parser.Sizeof:
            case CPP14Parser.Static_cast:
            case CPP14Parser.This:
            case CPP14Parser.Throw:
            case CPP14Parser.Typeid_:
            case CPP14Parser.Typename_:
            case CPP14Parser.Unsigned:
            case CPP14Parser.Void:
            case CPP14Parser.Wchar:
            case CPP14Parser.LeftParen:
            case CPP14Parser.LeftBracket:
            case CPP14Parser.Plus:
            case CPP14Parser.Minus:
            case CPP14Parser.Star:
            case CPP14Parser.And:
            case CPP14Parser.Or:
            case CPP14Parser.Tilde:
            case CPP14Parser.Not:
            case CPP14Parser.PlusPlus:
            case CPP14Parser.MinusMinus:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Identifier:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 953;
                this.expression();
                }
                break;
            case CPP14Parser.LeftBrace:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 954;
                this.bracedInitList();
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
    public jumpStatement(): JumpStatementContext {
        let localContext = new JumpStatementContext(this.context, this.state);
        this.enterRule(localContext, 116, CPP14Parser.RULE_jumpStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 966;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Break:
                {
                this.state = 957;
                this.match(CPP14Parser.Break);
                }
                break;
            case CPP14Parser.Continue:
                {
                this.state = 958;
                this.match(CPP14Parser.Continue);
                }
                break;
            case CPP14Parser.Return:
                {
                this.state = 959;
                this.match(CPP14Parser.Return);
                this.state = 962;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case CPP14Parser.IntegerLiteral:
                case CPP14Parser.CharacterLiteral:
                case CPP14Parser.FloatingLiteral:
                case CPP14Parser.StringLiteral:
                case CPP14Parser.BooleanLiteral:
                case CPP14Parser.PointerLiteral:
                case CPP14Parser.UserDefinedLiteral:
                case CPP14Parser.Alignof:
                case CPP14Parser.Auto:
                case CPP14Parser.Bool:
                case CPP14Parser.Char:
                case CPP14Parser.Char16:
                case CPP14Parser.Char32:
                case CPP14Parser.Const_cast:
                case CPP14Parser.Decltype:
                case CPP14Parser.Delete:
                case CPP14Parser.Double:
                case CPP14Parser.Dynamic_cast:
                case CPP14Parser.Float:
                case CPP14Parser.Int:
                case CPP14Parser.Long:
                case CPP14Parser.New:
                case CPP14Parser.Noexcept:
                case CPP14Parser.Operator:
                case CPP14Parser.Reinterpret_cast:
                case CPP14Parser.Short:
                case CPP14Parser.Signed:
                case CPP14Parser.Sizeof:
                case CPP14Parser.Static_cast:
                case CPP14Parser.This:
                case CPP14Parser.Throw:
                case CPP14Parser.Typeid_:
                case CPP14Parser.Typename_:
                case CPP14Parser.Unsigned:
                case CPP14Parser.Void:
                case CPP14Parser.Wchar:
                case CPP14Parser.LeftParen:
                case CPP14Parser.LeftBracket:
                case CPP14Parser.Plus:
                case CPP14Parser.Minus:
                case CPP14Parser.Star:
                case CPP14Parser.And:
                case CPP14Parser.Or:
                case CPP14Parser.Tilde:
                case CPP14Parser.Not:
                case CPP14Parser.PlusPlus:
                case CPP14Parser.MinusMinus:
                case CPP14Parser.Doublecolon:
                case CPP14Parser.Identifier:
                    {
                    this.state = 960;
                    this.expression();
                    }
                    break;
                case CPP14Parser.LeftBrace:
                    {
                    this.state = 961;
                    this.bracedInitList();
                    }
                    break;
                case CPP14Parser.Semi:
                    break;
                default:
                    break;
                }
                }
                break;
            case CPP14Parser.Goto:
                {
                this.state = 964;
                this.match(CPP14Parser.Goto);
                this.state = 965;
                this.match(CPP14Parser.Identifier);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.state = 968;
            this.match(CPP14Parser.Semi);
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
    public declarationStatement(): DeclarationStatementContext {
        let localContext = new DeclarationStatementContext(this.context, this.state);
        this.enterRule(localContext, 118, CPP14Parser.RULE_declarationStatement);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 970;
            this.blockDeclaration();
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
    public declarationseq(): DeclarationseqContext {
        let localContext = new DeclarationseqContext(this.context, this.state);
        this.enterRule(localContext, 120, CPP14Parser.RULE_declarationseq);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 973;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 972;
                this.declaration();
                }
                }
                this.state = 975;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 2777759517) !== 0) || ((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & 1163600159) !== 0) || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 10619647) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 26113) !== 0));
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
        this.enterRule(localContext, 122, CPP14Parser.RULE_declaration);
        try {
            this.state = 986;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 96, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 977;
                this.blockDeclaration();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 978;
                this.functionDefinition();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 979;
                this.templateDeclaration();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 980;
                this.explicitInstantiation();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 981;
                this.explicitSpecialization();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 982;
                this.linkageSpecification();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 983;
                this.namespaceDefinition();
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 984;
                this.emptyDeclaration_();
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 985;
                this.attributeDeclaration();
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
    public blockDeclaration(): BlockDeclarationContext {
        let localContext = new BlockDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 124, CPP14Parser.RULE_blockDeclaration);
        try {
            this.state = 996;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 97, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 988;
                this.simpleDeclaration();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 989;
                this.asmDefinition();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 990;
                this.namespaceAliasDefinition();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 991;
                this.usingDeclaration();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 992;
                this.usingDirective();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 993;
                this.staticAssertDeclaration();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 994;
                this.aliasDeclaration();
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 995;
                this.opaqueEnumDeclaration();
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
    public aliasDeclaration(): AliasDeclarationContext {
        let localContext = new AliasDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 126, CPP14Parser.RULE_aliasDeclaration);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 998;
            this.match(CPP14Parser.Using);
            this.state = 999;
            this.match(CPP14Parser.Identifier);
            this.state = 1001;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 87) {
                {
                this.state = 1000;
                this.attributeSpecifierSeq();
                }
            }

            this.state = 1003;
            this.match(CPP14Parser.Assign);
            this.state = 1004;
            this.theTypeId();
            this.state = 1005;
            this.match(CPP14Parser.Semi);
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
    public simpleDeclaration(): SimpleDeclarationContext {
        let localContext = new SimpleDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 128, CPP14Parser.RULE_simpleDeclaration);
        let _la: number;
        try {
            this.state = 1021;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Auto:
            case CPP14Parser.Bool:
            case CPP14Parser.Char:
            case CPP14Parser.Char16:
            case CPP14Parser.Char32:
            case CPP14Parser.Class:
            case CPP14Parser.Const:
            case CPP14Parser.Constexpr:
            case CPP14Parser.Decltype:
            case CPP14Parser.Double:
            case CPP14Parser.Enum:
            case CPP14Parser.Explicit:
            case CPP14Parser.Extern:
            case CPP14Parser.Float:
            case CPP14Parser.Friend:
            case CPP14Parser.Inline:
            case CPP14Parser.Int:
            case CPP14Parser.Long:
            case CPP14Parser.Mutable:
            case CPP14Parser.Operator:
            case CPP14Parser.Register:
            case CPP14Parser.Short:
            case CPP14Parser.Signed:
            case CPP14Parser.Static:
            case CPP14Parser.Struct:
            case CPP14Parser.Thread_local:
            case CPP14Parser.Typedef:
            case CPP14Parser.Typename_:
            case CPP14Parser.Union:
            case CPP14Parser.Unsigned:
            case CPP14Parser.Virtual:
            case CPP14Parser.Void:
            case CPP14Parser.Volatile:
            case CPP14Parser.Wchar:
            case CPP14Parser.LeftParen:
            case CPP14Parser.Star:
            case CPP14Parser.And:
            case CPP14Parser.Tilde:
            case CPP14Parser.AndAnd:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Semi:
            case CPP14Parser.Ellipsis:
            case CPP14Parser.Identifier:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1008;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 99, this.context) ) {
                case 1:
                    {
                    this.state = 1007;
                    this.declSpecifierSeq();
                    }
                    break;
                }
                this.state = 1011;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 26 || _la === 52 || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 20737) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 25089) !== 0)) {
                    {
                    this.state = 1010;
                    this.initDeclaratorList();
                    }
                }

                this.state = 1013;
                this.match(CPP14Parser.Semi);
                }
                break;
            case CPP14Parser.Alignas:
            case CPP14Parser.LeftBracket:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1014;
                this.attributeSpecifierSeq();
                this.state = 1016;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 101, this.context) ) {
                case 1:
                    {
                    this.state = 1015;
                    this.declSpecifierSeq();
                    }
                    break;
                }
                this.state = 1018;
                this.initDeclaratorList();
                this.state = 1019;
                this.match(CPP14Parser.Semi);
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
        this.enterRule(localContext, 130, CPP14Parser.RULE_staticAssertDeclaration);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1023;
            this.match(CPP14Parser.Static_assert);
            this.state = 1024;
            this.match(CPP14Parser.LeftParen);
            this.state = 1025;
            this.constantExpression();
            this.state = 1026;
            this.match(CPP14Parser.Comma);
            this.state = 1027;
            this.match(CPP14Parser.StringLiteral);
            this.state = 1028;
            this.match(CPP14Parser.RightParen);
            this.state = 1029;
            this.match(CPP14Parser.Semi);
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
    public emptyDeclaration_(): EmptyDeclaration_Context {
        let localContext = new EmptyDeclaration_Context(this.context, this.state);
        this.enterRule(localContext, 132, CPP14Parser.RULE_emptyDeclaration_);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1031;
            this.match(CPP14Parser.Semi);
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
    public attributeDeclaration(): AttributeDeclarationContext {
        let localContext = new AttributeDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 134, CPP14Parser.RULE_attributeDeclaration);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1033;
            this.attributeSpecifierSeq();
            this.state = 1034;
            this.match(CPP14Parser.Semi);
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
    public declSpecifier(): DeclSpecifierContext {
        let localContext = new DeclSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 136, CPP14Parser.RULE_declSpecifier);
        try {
            this.state = 1042;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Extern:
            case CPP14Parser.Mutable:
            case CPP14Parser.Register:
            case CPP14Parser.Static:
            case CPP14Parser.Thread_local:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1036;
                this.storageClassSpecifier();
                }
                break;
            case CPP14Parser.Auto:
            case CPP14Parser.Bool:
            case CPP14Parser.Char:
            case CPP14Parser.Char16:
            case CPP14Parser.Char32:
            case CPP14Parser.Class:
            case CPP14Parser.Const:
            case CPP14Parser.Decltype:
            case CPP14Parser.Double:
            case CPP14Parser.Enum:
            case CPP14Parser.Float:
            case CPP14Parser.Int:
            case CPP14Parser.Long:
            case CPP14Parser.Short:
            case CPP14Parser.Signed:
            case CPP14Parser.Struct:
            case CPP14Parser.Typename_:
            case CPP14Parser.Union:
            case CPP14Parser.Unsigned:
            case CPP14Parser.Void:
            case CPP14Parser.Volatile:
            case CPP14Parser.Wchar:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Identifier:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1037;
                this.typeSpecifier();
                }
                break;
            case CPP14Parser.Explicit:
            case CPP14Parser.Inline:
            case CPP14Parser.Virtual:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1038;
                this.functionSpecifier();
                }
                break;
            case CPP14Parser.Friend:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 1039;
                this.match(CPP14Parser.Friend);
                }
                break;
            case CPP14Parser.Typedef:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 1040;
                this.match(CPP14Parser.Typedef);
                }
                break;
            case CPP14Parser.Constexpr:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 1041;
                this.match(CPP14Parser.Constexpr);
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
    public declSpecifierSeq(): DeclSpecifierSeqContext {
        let localContext = new DeclSpecifierSeqContext(this.context, this.state);
        this.enterRule(localContext, 138, CPP14Parser.RULE_declSpecifierSeq);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1045;
            this.errorHandler.sync(this);
            alternative = 1 + 1;
            do {
                switch (alternative) {
                case 1 + 1:
                    {
                    {
                    this.state = 1044;
                    this.declSpecifier();
                    }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 1047;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 104, this.context);
            } while (alternative !== 1 && alternative !== antlr.ATN.INVALID_ALT_NUMBER);
            this.state = 1050;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 105, this.context) ) {
            case 1:
                {
                this.state = 1049;
                this.attributeSpecifierSeq();
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
    public storageClassSpecifier(): StorageClassSpecifierContext {
        let localContext = new StorageClassSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 140, CPP14Parser.RULE_storageClassSpecifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1052;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 36)) & ~0x1F) === 0 && ((1 << (_la - 36)) & 136316929) !== 0) || _la === 70)) {
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
        this.enterRule(localContext, 142, CPP14Parser.RULE_functionSpecifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1054;
            _la = this.tokenStream.LA(1);
            if(!(_la === 34 || _la === 44 || _la === 80)) {
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
    public typedefName(): TypedefNameContext {
        let localContext = new TypedefNameContext(this.context, this.state);
        this.enterRule(localContext, 144, CPP14Parser.RULE_typedefName);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1056;
            this.match(CPP14Parser.Identifier);
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
        this.enterRule(localContext, 146, CPP14Parser.RULE_typeSpecifier);
        try {
            this.state = 1061;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 106, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1058;
                this.trailingTypeSpecifier();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1059;
                this.classSpecifier();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1060;
                this.enumSpecifier();
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
    public trailingTypeSpecifier(): TrailingTypeSpecifierContext {
        let localContext = new TrailingTypeSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 148, CPP14Parser.RULE_trailingTypeSpecifier);
        try {
            this.state = 1067;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Auto:
            case CPP14Parser.Bool:
            case CPP14Parser.Char:
            case CPP14Parser.Char16:
            case CPP14Parser.Char32:
            case CPP14Parser.Decltype:
            case CPP14Parser.Double:
            case CPP14Parser.Float:
            case CPP14Parser.Int:
            case CPP14Parser.Long:
            case CPP14Parser.Short:
            case CPP14Parser.Signed:
            case CPP14Parser.Unsigned:
            case CPP14Parser.Void:
            case CPP14Parser.Wchar:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Identifier:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1063;
                this.simpleTypeSpecifier();
                }
                break;
            case CPP14Parser.Class:
            case CPP14Parser.Enum:
            case CPP14Parser.Struct:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1064;
                this.elaboratedTypeSpecifier();
                }
                break;
            case CPP14Parser.Typename_:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1065;
                this.typeNameSpecifier();
                }
                break;
            case CPP14Parser.Const:
            case CPP14Parser.Volatile:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 1066;
                this.cvQualifier();
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
    public typeSpecifierSeq(): TypeSpecifierSeqContext {
        let localContext = new TypeSpecifierSeqContext(this.context, this.state);
        this.enterRule(localContext, 150, CPP14Parser.RULE_typeSpecifierSeq);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1070;
            this.errorHandler.sync(this);
            alternative = 1;
            do {
                switch (alternative) {
                case 1:
                    {
                    {
                    this.state = 1069;
                    this.typeSpecifier();
                    }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 1072;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 108, this.context);
            } while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER);
            this.state = 1075;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 109, this.context) ) {
            case 1:
                {
                this.state = 1074;
                this.attributeSpecifierSeq();
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
    public trailingTypeSpecifierSeq(): TrailingTypeSpecifierSeqContext {
        let localContext = new TrailingTypeSpecifierSeqContext(this.context, this.state);
        this.enterRule(localContext, 152, CPP14Parser.RULE_trailingTypeSpecifierSeq);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1078;
            this.errorHandler.sync(this);
            alternative = 1;
            do {
                switch (alternative) {
                case 1:
                    {
                    {
                    this.state = 1077;
                    this.trailingTypeSpecifier();
                    }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 1080;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 110, this.context);
            } while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER);
            this.state = 1083;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 87) {
                {
                this.state = 1082;
                this.attributeSpecifierSeq();
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
    public simpleTypeLengthModifier(): SimpleTypeLengthModifierContext {
        let localContext = new SimpleTypeLengthModifierContext(this.context, this.state);
        this.enterRule(localContext, 154, CPP14Parser.RULE_simpleTypeLengthModifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1085;
            _la = this.tokenStream.LA(1);
            if(!(_la === 46 || _la === 60)) {
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
    public simpleTypeSignednessModifier(): SimpleTypeSignednessModifierContext {
        let localContext = new SimpleTypeSignednessModifierContext(this.context, this.state);
        this.enterRule(localContext, 156, CPP14Parser.RULE_simpleTypeSignednessModifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1087;
            _la = this.tokenStream.LA(1);
            if(!(_la === 61 || _la === 78)) {
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
    public simpleTypeSpecifier(): SimpleTypeSpecifierContext {
        let localContext = new SimpleTypeSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 158, CPP14Parser.RULE_simpleTypeSpecifier);
        try {
            this.state = 1113;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 113, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1090;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 112, this.context) ) {
                case 1:
                    {
                    this.state = 1089;
                    this.nestedNameSpecifier(0);
                    }
                    break;
                }
                this.state = 1092;
                this.theTypeName();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1093;
                this.nestedNameSpecifier(0);
                this.state = 1094;
                this.match(CPP14Parser.Template);
                this.state = 1095;
                this.simpleTemplateId();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1097;
                this.match(CPP14Parser.Char);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 1098;
                this.match(CPP14Parser.Char16);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 1099;
                this.match(CPP14Parser.Char32);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 1100;
                this.match(CPP14Parser.Wchar);
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 1101;
                this.match(CPP14Parser.Bool);
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 1102;
                this.match(CPP14Parser.Short);
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 1103;
                this.match(CPP14Parser.Int);
                }
                break;
            case 10:
                this.enterOuterAlt(localContext, 10);
                {
                this.state = 1104;
                this.match(CPP14Parser.Long);
                }
                break;
            case 11:
                this.enterOuterAlt(localContext, 11);
                {
                this.state = 1105;
                this.match(CPP14Parser.Float);
                }
                break;
            case 12:
                this.enterOuterAlt(localContext, 12);
                {
                this.state = 1106;
                this.match(CPP14Parser.Signed);
                }
                break;
            case 13:
                this.enterOuterAlt(localContext, 13);
                {
                this.state = 1107;
                this.match(CPP14Parser.Unsigned);
                }
                break;
            case 14:
                this.enterOuterAlt(localContext, 14);
                {
                this.state = 1108;
                this.match(CPP14Parser.Float);
                }
                break;
            case 15:
                this.enterOuterAlt(localContext, 15);
                {
                this.state = 1109;
                this.match(CPP14Parser.Double);
                }
                break;
            case 16:
                this.enterOuterAlt(localContext, 16);
                {
                this.state = 1110;
                this.match(CPP14Parser.Void);
                }
                break;
            case 17:
                this.enterOuterAlt(localContext, 17);
                {
                this.state = 1111;
                this.match(CPP14Parser.Auto);
                }
                break;
            case 18:
                this.enterOuterAlt(localContext, 18);
                {
                this.state = 1112;
                this.decltypeSpecifier();
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
    public theTypeName(): TheTypeNameContext {
        let localContext = new TheTypeNameContext(this.context, this.state);
        this.enterRule(localContext, 160, CPP14Parser.RULE_theTypeName);
        try {
            this.state = 1119;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 114, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1115;
                this.className();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1116;
                this.enumName();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1117;
                this.typedefName();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 1118;
                this.simpleTemplateId();
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
    public decltypeSpecifier(): DecltypeSpecifierContext {
        let localContext = new DecltypeSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 162, CPP14Parser.RULE_decltypeSpecifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1121;
            this.match(CPP14Parser.Decltype);
            this.state = 1122;
            this.match(CPP14Parser.LeftParen);
            this.state = 1125;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 115, this.context) ) {
            case 1:
                {
                this.state = 1123;
                this.expression();
                }
                break;
            case 2:
                {
                this.state = 1124;
                this.match(CPP14Parser.Auto);
                }
                break;
            }
            this.state = 1127;
            this.match(CPP14Parser.RightParen);
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
    public elaboratedTypeSpecifier(): ElaboratedTypeSpecifierContext {
        let localContext = new ElaboratedTypeSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 164, CPP14Parser.RULE_elaboratedTypeSpecifier);
        let _la: number;
        try {
            this.state = 1151;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Class:
            case CPP14Parser.Struct:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1129;
                this.classKey();
                this.state = 1144;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 119, this.context) ) {
                case 1:
                    {
                    this.state = 1131;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 10 || _la === 87) {
                        {
                        this.state = 1130;
                        this.attributeSpecifierSeq();
                        }
                    }

                    this.state = 1134;
                    this.errorHandler.sync(this);
                    switch (this.interpreter.adaptivePredict(this.tokenStream, 117, this.context) ) {
                    case 1:
                        {
                        this.state = 1133;
                        this.nestedNameSpecifier(0);
                        }
                        break;
                    }
                    this.state = 1136;
                    this.match(CPP14Parser.Identifier);
                    }
                    break;
                case 2:
                    {
                    this.state = 1137;
                    this.simpleTemplateId();
                    }
                    break;
                case 3:
                    {
                    this.state = 1138;
                    this.nestedNameSpecifier(0);
                    this.state = 1140;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 68) {
                        {
                        this.state = 1139;
                        this.match(CPP14Parser.Template);
                        }
                    }

                    this.state = 1142;
                    this.simpleTemplateId();
                    }
                    break;
                }
                }
                break;
            case CPP14Parser.Enum:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1146;
                this.match(CPP14Parser.Enum);
                this.state = 1148;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 120, this.context) ) {
                case 1:
                    {
                    this.state = 1147;
                    this.nestedNameSpecifier(0);
                    }
                    break;
                }
                this.state = 1150;
                this.match(CPP14Parser.Identifier);
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
    public enumName(): EnumNameContext {
        let localContext = new EnumNameContext(this.context, this.state);
        this.enterRule(localContext, 166, CPP14Parser.RULE_enumName);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1153;
            this.match(CPP14Parser.Identifier);
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
        this.enterRule(localContext, 168, CPP14Parser.RULE_enumSpecifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1155;
            this.enumHead();
            this.state = 1156;
            this.match(CPP14Parser.LeftBrace);
            this.state = 1161;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 132) {
                {
                this.state = 1157;
                this.enumeratorList();
                this.state = 1159;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 122) {
                    {
                    this.state = 1158;
                    this.match(CPP14Parser.Comma);
                    }
                }

                }
            }

            this.state = 1163;
            this.match(CPP14Parser.RightBrace);
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
    public enumHead(): EnumHeadContext {
        let localContext = new EnumHeadContext(this.context, this.state);
        this.enterRule(localContext, 170, CPP14Parser.RULE_enumHead);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1165;
            this.enumkey();
            this.state = 1167;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 87) {
                {
                this.state = 1166;
                this.attributeSpecifierSeq();
                }
            }

            this.state = 1173;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 26 || _la === 127 || _la === 132) {
                {
                this.state = 1170;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 125, this.context) ) {
                case 1:
                    {
                    this.state = 1169;
                    this.nestedNameSpecifier(0);
                    }
                    break;
                }
                this.state = 1172;
                this.match(CPP14Parser.Identifier);
                }
            }

            this.state = 1176;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 126) {
                {
                this.state = 1175;
                this.enumbase();
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
    public opaqueEnumDeclaration(): OpaqueEnumDeclarationContext {
        let localContext = new OpaqueEnumDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 172, CPP14Parser.RULE_opaqueEnumDeclaration);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1178;
            this.enumkey();
            this.state = 1180;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 87) {
                {
                this.state = 1179;
                this.attributeSpecifierSeq();
                }
            }

            this.state = 1182;
            this.match(CPP14Parser.Identifier);
            this.state = 1184;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 126) {
                {
                this.state = 1183;
                this.enumbase();
                }
            }

            this.state = 1186;
            this.match(CPP14Parser.Semi);
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
    public enumkey(): EnumkeyContext {
        let localContext = new EnumkeyContext(this.context, this.state);
        this.enterRule(localContext, 174, CPP14Parser.RULE_enumkey);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1188;
            this.match(CPP14Parser.Enum);
            this.state = 1190;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 21 || _la === 66) {
                {
                this.state = 1189;
                _la = this.tokenStream.LA(1);
                if(!(_la === 21 || _la === 66)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
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
    public enumbase(): EnumbaseContext {
        let localContext = new EnumbaseContext(this.context, this.state);
        this.enterRule(localContext, 176, CPP14Parser.RULE_enumbase);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1192;
            this.match(CPP14Parser.Colon);
            this.state = 1193;
            this.typeSpecifierSeq();
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
        this.enterRule(localContext, 178, CPP14Parser.RULE_enumeratorList);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1195;
            this.enumeratorDefinition();
            this.state = 1200;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 131, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 1196;
                    this.match(CPP14Parser.Comma);
                    this.state = 1197;
                    this.enumeratorDefinition();
                    }
                    }
                }
                this.state = 1202;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 131, this.context);
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
    public enumeratorDefinition(): EnumeratorDefinitionContext {
        let localContext = new EnumeratorDefinitionContext(this.context, this.state);
        this.enterRule(localContext, 180, CPP14Parser.RULE_enumeratorDefinition);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1203;
            this.enumerator();
            this.state = 1206;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 101) {
                {
                this.state = 1204;
                this.match(CPP14Parser.Assign);
                this.state = 1205;
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
    public enumerator(): EnumeratorContext {
        let localContext = new EnumeratorContext(this.context, this.state);
        this.enterRule(localContext, 182, CPP14Parser.RULE_enumerator);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1208;
            this.match(CPP14Parser.Identifier);
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
    public namespaceName(): NamespaceNameContext {
        let localContext = new NamespaceNameContext(this.context, this.state);
        this.enterRule(localContext, 184, CPP14Parser.RULE_namespaceName);
        try {
            this.state = 1212;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 133, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1210;
                this.originalNamespaceName();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1211;
                this.namespaceAlias();
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
    public originalNamespaceName(): OriginalNamespaceNameContext {
        let localContext = new OriginalNamespaceNameContext(this.context, this.state);
        this.enterRule(localContext, 186, CPP14Parser.RULE_originalNamespaceName);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1214;
            this.match(CPP14Parser.Identifier);
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
    public namespaceDefinition(): NamespaceDefinitionContext {
        let localContext = new NamespaceDefinitionContext(this.context, this.state);
        this.enterRule(localContext, 188, CPP14Parser.RULE_namespaceDefinition);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1217;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 44) {
                {
                this.state = 1216;
                this.match(CPP14Parser.Inline);
                }
            }

            this.state = 1219;
            this.match(CPP14Parser.Namespace);
            this.state = 1222;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 135, this.context) ) {
            case 1:
                {
                this.state = 1220;
                this.match(CPP14Parser.Identifier);
                }
                break;
            case 2:
                {
                this.state = 1221;
                this.originalNamespaceName();
                }
                break;
            }
            this.state = 1224;
            this.match(CPP14Parser.LeftBrace);
            this.state = 1226;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 2777759517) !== 0) || ((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & 1163600159) !== 0) || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 10619647) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 26113) !== 0)) {
                {
                this.state = 1225;
                localContext._namespaceBody = this.declarationseq();
                }
            }

            this.state = 1228;
            this.match(CPP14Parser.RightBrace);
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
    public namespaceAlias(): NamespaceAliasContext {
        let localContext = new NamespaceAliasContext(this.context, this.state);
        this.enterRule(localContext, 190, CPP14Parser.RULE_namespaceAlias);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1230;
            this.match(CPP14Parser.Identifier);
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
    public namespaceAliasDefinition(): NamespaceAliasDefinitionContext {
        let localContext = new NamespaceAliasDefinitionContext(this.context, this.state);
        this.enterRule(localContext, 192, CPP14Parser.RULE_namespaceAliasDefinition);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1232;
            this.match(CPP14Parser.Namespace);
            this.state = 1233;
            this.match(CPP14Parser.Identifier);
            this.state = 1234;
            this.match(CPP14Parser.Assign);
            this.state = 1235;
            this.qualifiednamespacespecifier();
            this.state = 1236;
            this.match(CPP14Parser.Semi);
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
    public qualifiednamespacespecifier(): QualifiednamespacespecifierContext {
        let localContext = new QualifiednamespacespecifierContext(this.context, this.state);
        this.enterRule(localContext, 194, CPP14Parser.RULE_qualifiednamespacespecifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1239;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 137, this.context) ) {
            case 1:
                {
                this.state = 1238;
                this.nestedNameSpecifier(0);
                }
                break;
            }
            this.state = 1241;
            this.namespaceName();
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
    public usingDeclaration(): UsingDeclarationContext {
        let localContext = new UsingDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 196, CPP14Parser.RULE_usingDeclaration);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1243;
            this.match(CPP14Parser.Using);
            this.state = 1249;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 139, this.context) ) {
            case 1:
                {
                this.state = 1245;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 76) {
                    {
                    this.state = 1244;
                    this.match(CPP14Parser.Typename_);
                    }
                }

                this.state = 1247;
                this.nestedNameSpecifier(0);
                }
                break;
            case 2:
                {
                this.state = 1248;
                this.match(CPP14Parser.Doublecolon);
                }
                break;
            }
            this.state = 1251;
            this.unqualifiedId();
            this.state = 1252;
            this.match(CPP14Parser.Semi);
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
    public usingDirective(): UsingDirectiveContext {
        let localContext = new UsingDirectiveContext(this.context, this.state);
        this.enterRule(localContext, 198, CPP14Parser.RULE_usingDirective);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1255;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 87) {
                {
                this.state = 1254;
                this.attributeSpecifierSeq();
                }
            }

            this.state = 1257;
            this.match(CPP14Parser.Using);
            this.state = 1258;
            this.match(CPP14Parser.Namespace);
            this.state = 1260;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 141, this.context) ) {
            case 1:
                {
                this.state = 1259;
                this.nestedNameSpecifier(0);
                }
                break;
            }
            this.state = 1262;
            this.namespaceName();
            this.state = 1263;
            this.match(CPP14Parser.Semi);
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
    public asmDefinition(): AsmDefinitionContext {
        let localContext = new AsmDefinitionContext(this.context, this.state);
        this.enterRule(localContext, 200, CPP14Parser.RULE_asmDefinition);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1265;
            this.match(CPP14Parser.Asm);
            this.state = 1266;
            this.match(CPP14Parser.LeftParen);
            this.state = 1267;
            this.match(CPP14Parser.StringLiteral);
            this.state = 1268;
            this.match(CPP14Parser.RightParen);
            this.state = 1269;
            this.match(CPP14Parser.Semi);
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
    public linkageSpecification(): LinkageSpecificationContext {
        let localContext = new LinkageSpecificationContext(this.context, this.state);
        this.enterRule(localContext, 202, CPP14Parser.RULE_linkageSpecification);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1271;
            this.match(CPP14Parser.Extern);
            this.state = 1272;
            this.match(CPP14Parser.StringLiteral);
            this.state = 1279;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.LeftBrace:
                {
                this.state = 1273;
                this.match(CPP14Parser.LeftBrace);
                this.state = 1275;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 2777759517) !== 0) || ((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & 1163600159) !== 0) || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 10619647) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 26113) !== 0)) {
                    {
                    this.state = 1274;
                    this.declarationseq();
                    }
                }

                this.state = 1277;
                this.match(CPP14Parser.RightBrace);
                }
                break;
            case CPP14Parser.Alignas:
            case CPP14Parser.Asm:
            case CPP14Parser.Auto:
            case CPP14Parser.Bool:
            case CPP14Parser.Char:
            case CPP14Parser.Char16:
            case CPP14Parser.Char32:
            case CPP14Parser.Class:
            case CPP14Parser.Const:
            case CPP14Parser.Constexpr:
            case CPP14Parser.Decltype:
            case CPP14Parser.Double:
            case CPP14Parser.Enum:
            case CPP14Parser.Explicit:
            case CPP14Parser.Extern:
            case CPP14Parser.Float:
            case CPP14Parser.Friend:
            case CPP14Parser.Inline:
            case CPP14Parser.Int:
            case CPP14Parser.Long:
            case CPP14Parser.Mutable:
            case CPP14Parser.Namespace:
            case CPP14Parser.Operator:
            case CPP14Parser.Register:
            case CPP14Parser.Short:
            case CPP14Parser.Signed:
            case CPP14Parser.Static:
            case CPP14Parser.Static_assert:
            case CPP14Parser.Struct:
            case CPP14Parser.Template:
            case CPP14Parser.Thread_local:
            case CPP14Parser.Typedef:
            case CPP14Parser.Typename_:
            case CPP14Parser.Union:
            case CPP14Parser.Unsigned:
            case CPP14Parser.Using:
            case CPP14Parser.Virtual:
            case CPP14Parser.Void:
            case CPP14Parser.Volatile:
            case CPP14Parser.Wchar:
            case CPP14Parser.LeftParen:
            case CPP14Parser.LeftBracket:
            case CPP14Parser.Star:
            case CPP14Parser.And:
            case CPP14Parser.Tilde:
            case CPP14Parser.AndAnd:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Semi:
            case CPP14Parser.Ellipsis:
            case CPP14Parser.Identifier:
                {
                this.state = 1278;
                this.declaration();
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
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext {
        let localContext = new AttributeSpecifierSeqContext(this.context, this.state);
        this.enterRule(localContext, 204, CPP14Parser.RULE_attributeSpecifierSeq);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1282;
            this.errorHandler.sync(this);
            alternative = 1;
            do {
                switch (alternative) {
                case 1:
                    {
                    {
                    this.state = 1281;
                    this.attributeSpecifier();
                    }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 1284;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 144, this.context);
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
    public attributeSpecifier(): AttributeSpecifierContext {
        let localContext = new AttributeSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 206, CPP14Parser.RULE_attributeSpecifier);
        let _la: number;
        try {
            this.state = 1294;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.LeftBracket:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1286;
                this.match(CPP14Parser.LeftBracket);
                this.state = 1287;
                this.match(CPP14Parser.LeftBracket);
                this.state = 1289;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 132) {
                    {
                    this.state = 1288;
                    this.attributeList();
                    }
                }

                this.state = 1291;
                this.match(CPP14Parser.RightBracket);
                this.state = 1292;
                this.match(CPP14Parser.RightBracket);
                }
                break;
            case CPP14Parser.Alignas:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1293;
                this.alignmentspecifier();
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
    public alignmentspecifier(): AlignmentspecifierContext {
        let localContext = new AlignmentspecifierContext(this.context, this.state);
        this.enterRule(localContext, 208, CPP14Parser.RULE_alignmentspecifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1296;
            this.match(CPP14Parser.Alignas);
            this.state = 1297;
            this.match(CPP14Parser.LeftParen);
            this.state = 1300;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 147, this.context) ) {
            case 1:
                {
                this.state = 1298;
                this.theTypeId();
                }
                break;
            case 2:
                {
                this.state = 1299;
                this.constantExpression();
                }
                break;
            }
            this.state = 1303;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 131) {
                {
                this.state = 1302;
                this.match(CPP14Parser.Ellipsis);
                }
            }

            this.state = 1305;
            this.match(CPP14Parser.RightParen);
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
    public attributeList(): AttributeListContext {
        let localContext = new AttributeListContext(this.context, this.state);
        this.enterRule(localContext, 210, CPP14Parser.RULE_attributeList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1307;
            this.attribute();
            this.state = 1312;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 122) {
                {
                {
                this.state = 1308;
                this.match(CPP14Parser.Comma);
                this.state = 1309;
                this.attribute();
                }
                }
                this.state = 1314;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 1316;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 131) {
                {
                this.state = 1315;
                this.match(CPP14Parser.Ellipsis);
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
    public attribute(): AttributeContext {
        let localContext = new AttributeContext(this.context, this.state);
        this.enterRule(localContext, 212, CPP14Parser.RULE_attribute);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1321;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 151, this.context) ) {
            case 1:
                {
                this.state = 1318;
                this.attributeNamespace();
                this.state = 1319;
                this.match(CPP14Parser.Doublecolon);
                }
                break;
            }
            this.state = 1323;
            this.match(CPP14Parser.Identifier);
            this.state = 1325;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 85) {
                {
                this.state = 1324;
                this.attributeArgumentClause();
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
    public attributeNamespace(): AttributeNamespaceContext {
        let localContext = new AttributeNamespaceContext(this.context, this.state);
        this.enterRule(localContext, 214, CPP14Parser.RULE_attributeNamespace);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1327;
            this.match(CPP14Parser.Identifier);
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
    public attributeArgumentClause(): AttributeArgumentClauseContext {
        let localContext = new AttributeArgumentClauseContext(this.context, this.state);
        this.enterRule(localContext, 216, CPP14Parser.RULE_attributeArgumentClause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1329;
            this.match(CPP14Parser.LeftParen);
            this.state = 1331;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967294) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294967295) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 4206886911) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 4294967295) !== 0) || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 262143) !== 0)) {
                {
                this.state = 1330;
                this.balancedTokenSeq();
                }
            }

            this.state = 1333;
            this.match(CPP14Parser.RightParen);
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
    public balancedTokenSeq(): BalancedTokenSeqContext {
        let localContext = new BalancedTokenSeqContext(this.context, this.state);
        this.enterRule(localContext, 218, CPP14Parser.RULE_balancedTokenSeq);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1336;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 1335;
                this.balancedtoken();
                }
                }
                this.state = 1338;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while ((((_la) & ~0x1F) === 0 && ((1 << _la) & 4294967294) !== 0) || ((((_la - 32)) & ~0x1F) === 0 && ((1 << (_la - 32)) & 4294967295) !== 0) || ((((_la - 64)) & ~0x1F) === 0 && ((1 << (_la - 64)) & 4206886911) !== 0) || ((((_la - 96)) & ~0x1F) === 0 && ((1 << (_la - 96)) & 4294967295) !== 0) || ((((_la - 128)) & ~0x1F) === 0 && ((1 << (_la - 128)) & 262143) !== 0));
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
    public balancedtoken(): BalancedtokenContext {
        let localContext = new BalancedtokenContext(this.context, this.state);
        this.enterRule(localContext, 220, CPP14Parser.RULE_balancedtoken);
        let _la: number;
        try {
            let alternative: number;
            this.state = 1357;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.LeftParen:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1340;
                this.match(CPP14Parser.LeftParen);
                this.state = 1341;
                this.balancedTokenSeq();
                this.state = 1342;
                this.match(CPP14Parser.RightParen);
                }
                break;
            case CPP14Parser.LeftBracket:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1344;
                this.match(CPP14Parser.LeftBracket);
                this.state = 1345;
                this.balancedTokenSeq();
                this.state = 1346;
                this.match(CPP14Parser.RightBracket);
                }
                break;
            case CPP14Parser.LeftBrace:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1348;
                this.match(CPP14Parser.LeftBrace);
                this.state = 1349;
                this.balancedTokenSeq();
                this.state = 1350;
                this.match(CPP14Parser.RightBrace);
                }
                break;
            case CPP14Parser.IntegerLiteral:
            case CPP14Parser.CharacterLiteral:
            case CPP14Parser.FloatingLiteral:
            case CPP14Parser.StringLiteral:
            case CPP14Parser.BooleanLiteral:
            case CPP14Parser.PointerLiteral:
            case CPP14Parser.UserDefinedLiteral:
            case CPP14Parser.MultiLineMacro:
            case CPP14Parser.Directive:
            case CPP14Parser.Alignas:
            case CPP14Parser.Alignof:
            case CPP14Parser.Asm:
            case CPP14Parser.Auto:
            case CPP14Parser.Bool:
            case CPP14Parser.Break:
            case CPP14Parser.Case:
            case CPP14Parser.Catch:
            case CPP14Parser.Char:
            case CPP14Parser.Char16:
            case CPP14Parser.Char32:
            case CPP14Parser.Class:
            case CPP14Parser.Const:
            case CPP14Parser.Constexpr:
            case CPP14Parser.Const_cast:
            case CPP14Parser.Continue:
            case CPP14Parser.Decltype:
            case CPP14Parser.Default:
            case CPP14Parser.Delete:
            case CPP14Parser.Do:
            case CPP14Parser.Double:
            case CPP14Parser.Dynamic_cast:
            case CPP14Parser.Else:
            case CPP14Parser.Enum:
            case CPP14Parser.Explicit:
            case CPP14Parser.Export:
            case CPP14Parser.Extern:
            case CPP14Parser.False_:
            case CPP14Parser.Final:
            case CPP14Parser.Float:
            case CPP14Parser.For:
            case CPP14Parser.Friend:
            case CPP14Parser.Goto:
            case CPP14Parser.If:
            case CPP14Parser.Inline:
            case CPP14Parser.Int:
            case CPP14Parser.Long:
            case CPP14Parser.Mutable:
            case CPP14Parser.Namespace:
            case CPP14Parser.New:
            case CPP14Parser.Noexcept:
            case CPP14Parser.Nullptr:
            case CPP14Parser.Operator:
            case CPP14Parser.Override:
            case CPP14Parser.Private:
            case CPP14Parser.Protected:
            case CPP14Parser.Public:
            case CPP14Parser.Register:
            case CPP14Parser.Reinterpret_cast:
            case CPP14Parser.Return:
            case CPP14Parser.Short:
            case CPP14Parser.Signed:
            case CPP14Parser.Sizeof:
            case CPP14Parser.Static:
            case CPP14Parser.Static_assert:
            case CPP14Parser.Static_cast:
            case CPP14Parser.Struct:
            case CPP14Parser.Switch:
            case CPP14Parser.Template:
            case CPP14Parser.This:
            case CPP14Parser.Thread_local:
            case CPP14Parser.Throw:
            case CPP14Parser.True_:
            case CPP14Parser.Try:
            case CPP14Parser.Typedef:
            case CPP14Parser.Typeid_:
            case CPP14Parser.Typename_:
            case CPP14Parser.Union:
            case CPP14Parser.Unsigned:
            case CPP14Parser.Using:
            case CPP14Parser.Virtual:
            case CPP14Parser.Void:
            case CPP14Parser.Volatile:
            case CPP14Parser.Wchar:
            case CPP14Parser.While:
            case CPP14Parser.Plus:
            case CPP14Parser.Minus:
            case CPP14Parser.Star:
            case CPP14Parser.Div:
            case CPP14Parser.Mod:
            case CPP14Parser.Caret:
            case CPP14Parser.And:
            case CPP14Parser.Or:
            case CPP14Parser.Tilde:
            case CPP14Parser.Not:
            case CPP14Parser.Assign:
            case CPP14Parser.Less:
            case CPP14Parser.Greater:
            case CPP14Parser.PlusAssign:
            case CPP14Parser.MinusAssign:
            case CPP14Parser.StarAssign:
            case CPP14Parser.DivAssign:
            case CPP14Parser.ModAssign:
            case CPP14Parser.XorAssign:
            case CPP14Parser.AndAssign:
            case CPP14Parser.OrAssign:
            case CPP14Parser.LeftShiftAssign:
            case CPP14Parser.RightShiftAssign:
            case CPP14Parser.Equal:
            case CPP14Parser.NotEqual:
            case CPP14Parser.LessEqual:
            case CPP14Parser.GreaterEqual:
            case CPP14Parser.AndAnd:
            case CPP14Parser.OrOr:
            case CPP14Parser.PlusPlus:
            case CPP14Parser.MinusMinus:
            case CPP14Parser.Comma:
            case CPP14Parser.ArrowStar:
            case CPP14Parser.Arrow:
            case CPP14Parser.Question:
            case CPP14Parser.Colon:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Semi:
            case CPP14Parser.Dot:
            case CPP14Parser.DotStar:
            case CPP14Parser.Ellipsis:
            case CPP14Parser.Identifier:
            case CPP14Parser.DecimalLiteral:
            case CPP14Parser.OctalLiteral:
            case CPP14Parser.HexadecimalLiteral:
            case CPP14Parser.BinaryLiteral:
            case CPP14Parser.Integersuffix:
            case CPP14Parser.UserDefinedIntegerLiteral:
            case CPP14Parser.UserDefinedFloatingLiteral:
            case CPP14Parser.UserDefinedStringLiteral:
            case CPP14Parser.UserDefinedCharacterLiteral:
            case CPP14Parser.Whitespace:
            case CPP14Parser.Newline:
            case CPP14Parser.BlockComment:
            case CPP14Parser.LineComment:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 1353;
                this.errorHandler.sync(this);
                alternative = 1;
                do {
                    switch (alternative) {
                    case 1:
                        {
                        {
                        this.state = 1352;
                        _la = this.tokenStream.LA(1);
                        if(_la<=0 || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 63) !== 0)) {
                        this.errorHandler.recoverInline(this);
                        }
                        else {
                            this.errorHandler.reportMatch(this);
                            this.consume();
                        }
                        }
                        }
                        break;
                    default:
                        throw new antlr.NoViableAltException(this);
                    }
                    this.state = 1355;
                    this.errorHandler.sync(this);
                    alternative = this.interpreter.adaptivePredict(this.tokenStream, 155, this.context);
                } while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER);
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
    public initDeclaratorList(): InitDeclaratorListContext {
        let localContext = new InitDeclaratorListContext(this.context, this.state);
        this.enterRule(localContext, 222, CPP14Parser.RULE_initDeclaratorList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1359;
            this.initDeclarator();
            this.state = 1364;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 122) {
                {
                {
                this.state = 1360;
                this.match(CPP14Parser.Comma);
                this.state = 1361;
                this.initDeclarator();
                }
                }
                this.state = 1366;
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
        this.enterRule(localContext, 224, CPP14Parser.RULE_initDeclarator);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1367;
            this.declarator();
            this.state = 1369;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 65553) !== 0)) {
                {
                this.state = 1368;
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
    public declarator(): DeclaratorContext {
        let localContext = new DeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 226, CPP14Parser.RULE_declarator);
        try {
            this.state = 1376;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 159, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1371;
                this.pointerDeclarator();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1372;
                this.noPointerDeclarator(0);
                this.state = 1373;
                this.parametersAndQualifiers();
                this.state = 1374;
                this.trailingReturnType();
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
    public pointerDeclarator(): PointerDeclaratorContext {
        let localContext = new PointerDeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 228, CPP14Parser.RULE_pointerDeclarator);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1384;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 161, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 1378;
                    this.pointerOperator();
                    this.state = 1380;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 22) {
                        {
                        this.state = 1379;
                        this.match(CPP14Parser.Const);
                        }
                    }

                    }
                    }
                }
                this.state = 1386;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 161, this.context);
            }
            this.state = 1387;
            this.noPointerDeclarator(0);
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

    public noPointerDeclarator(): NoPointerDeclaratorContext;
    public noPointerDeclarator(_p: number): NoPointerDeclaratorContext;
    public noPointerDeclarator(_p?: number): NoPointerDeclaratorContext {
        if (_p === undefined) {
            _p = 0;
        }

        let parentContext = this.context;
        let parentState = this.state;
        let localContext = new NoPointerDeclaratorContext(this.context, parentState);
        let previousContext = localContext;
        let _startState = 230;
        this.enterRecursionRule(localContext, 230, CPP14Parser.RULE_noPointerDeclarator, _p);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1398;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Decltype:
            case CPP14Parser.Operator:
            case CPP14Parser.Tilde:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Ellipsis:
            case CPP14Parser.Identifier:
                {
                this.state = 1390;
                this.declaratorid();
                this.state = 1392;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 162, this.context) ) {
                case 1:
                    {
                    this.state = 1391;
                    this.attributeSpecifierSeq();
                    }
                    break;
                }
                }
                break;
            case CPP14Parser.LeftParen:
                {
                this.state = 1394;
                this.match(CPP14Parser.LeftParen);
                this.state = 1395;
                this.pointerDeclarator();
                this.state = 1396;
                this.match(CPP14Parser.RightParen);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.context!.stop = this.tokenStream.LT(-1);
            this.state = 1414;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 167, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    if (this.parseListeners != null) {
                        this.triggerExitRuleEvent();
                    }
                    previousContext = localContext;
                    {
                    {
                    localContext = new NoPointerDeclaratorContext(parentContext, parentState);
                    this.pushNewRecursionContext(localContext, _startState, CPP14Parser.RULE_noPointerDeclarator);
                    this.state = 1400;
                    if (!(this.precpred(this.context, 2))) {
                        throw this.createFailedPredicateException("this.precpred(this.context, 2)");
                    }
                    this.state = 1410;
                    this.errorHandler.sync(this);
                    switch (this.tokenStream.LA(1)) {
                    case CPP14Parser.LeftParen:
                        {
                        this.state = 1401;
                        this.parametersAndQualifiers();
                        }
                        break;
                    case CPP14Parser.LeftBracket:
                        {
                        this.state = 1402;
                        this.match(CPP14Parser.LeftBracket);
                        this.state = 1404;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3575408894) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 1156066497) !== 0) || ((((_la - 75)) & ~0x1F) === 0 && ((1 << (_la - 75)) & 63378763) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 4227) !== 0)) {
                            {
                            this.state = 1403;
                            this.constantExpression();
                            }
                        }

                        this.state = 1406;
                        this.match(CPP14Parser.RightBracket);
                        this.state = 1408;
                        this.errorHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this.tokenStream, 165, this.context) ) {
                        case 1:
                            {
                            this.state = 1407;
                            this.attributeSpecifierSeq();
                            }
                            break;
                        }
                        }
                        break;
                    default:
                        throw new antlr.NoViableAltException(this);
                    }
                    }
                    }
                }
                this.state = 1416;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 167, this.context);
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
    public parametersAndQualifiers(): ParametersAndQualifiersContext {
        let localContext = new ParametersAndQualifiersContext(this.context, this.state);
        this.enterRule(localContext, 232, CPP14Parser.RULE_parametersAndQualifiers);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1417;
            this.match(CPP14Parser.LeftParen);
            this.state = 1419;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1157391360) !== 0) || ((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 1493203275) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 2350353) !== 0) || _la === 127 || _la === 132) {
                {
                this.state = 1418;
                this.parameterDeclarationClause();
                }
            }

            this.state = 1421;
            this.match(CPP14Parser.RightParen);
            this.state = 1423;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 169, this.context) ) {
            case 1:
                {
                this.state = 1422;
                this.cvqualifierseq();
                }
                break;
            }
            this.state = 1426;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 170, this.context) ) {
            case 1:
                {
                this.state = 1425;
                this.refqualifier();
                }
                break;
            }
            this.state = 1429;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 171, this.context) ) {
            case 1:
                {
                this.state = 1428;
                this.exceptionSpecification();
                }
                break;
            }
            this.state = 1432;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 172, this.context) ) {
            case 1:
                {
                this.state = 1431;
                this.attributeSpecifierSeq();
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
    public trailingReturnType(): TrailingReturnTypeContext {
        let localContext = new TrailingReturnTypeContext(this.context, this.state);
        this.enterRule(localContext, 234, CPP14Parser.RULE_trailingReturnType);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1434;
            this.match(CPP14Parser.Arrow);
            this.state = 1435;
            this.trailingTypeSpecifierSeq();
            this.state = 1437;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 173, this.context) ) {
            case 1:
                {
                this.state = 1436;
                this.abstractDeclarator();
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
    public pointerOperator(): PointerOperatorContext {
        let localContext = new PointerOperatorContext(this.context, this.state);
        this.enterRule(localContext, 236, CPP14Parser.RULE_pointerOperator);
        let _la: number;
        try {
            this.state = 1453;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.And:
            case CPP14Parser.AndAnd:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1439;
                _la = this.tokenStream.LA(1);
                if(!(_la === 97 || _la === 118)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 1441;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 174, this.context) ) {
                case 1:
                    {
                    this.state = 1440;
                    this.attributeSpecifierSeq();
                    }
                    break;
                }
                }
                break;
            case CPP14Parser.Decltype:
            case CPP14Parser.Star:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Identifier:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1444;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 26 || _la === 127 || _la === 132) {
                    {
                    this.state = 1443;
                    this.nestedNameSpecifier(0);
                    }
                }

                this.state = 1446;
                this.match(CPP14Parser.Star);
                this.state = 1448;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 176, this.context) ) {
                case 1:
                    {
                    this.state = 1447;
                    this.attributeSpecifierSeq();
                    }
                    break;
                }
                this.state = 1451;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 177, this.context) ) {
                case 1:
                    {
                    this.state = 1450;
                    this.cvqualifierseq();
                    }
                    break;
                }
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
    public cvqualifierseq(): CvqualifierseqContext {
        let localContext = new CvqualifierseqContext(this.context, this.state);
        this.enterRule(localContext, 238, CPP14Parser.RULE_cvqualifierseq);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1456;
            this.errorHandler.sync(this);
            alternative = 1;
            do {
                switch (alternative) {
                case 1:
                    {
                    {
                    this.state = 1455;
                    this.cvQualifier();
                    }
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                this.state = 1458;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 179, this.context);
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
    public cvQualifier(): CvQualifierContext {
        let localContext = new CvQualifierContext(this.context, this.state);
        this.enterRule(localContext, 240, CPP14Parser.RULE_cvQualifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1460;
            _la = this.tokenStream.LA(1);
            if(!(_la === 22 || _la === 82)) {
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
    public refqualifier(): RefqualifierContext {
        let localContext = new RefqualifierContext(this.context, this.state);
        this.enterRule(localContext, 242, CPP14Parser.RULE_refqualifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1462;
            _la = this.tokenStream.LA(1);
            if(!(_la === 97 || _la === 118)) {
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
    public declaratorid(): DeclaratoridContext {
        let localContext = new DeclaratoridContext(this.context, this.state);
        this.enterRule(localContext, 244, CPP14Parser.RULE_declaratorid);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1465;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 131) {
                {
                this.state = 1464;
                this.match(CPP14Parser.Ellipsis);
                }
            }

            this.state = 1467;
            this.idExpression();
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
    public theTypeId(): TheTypeIdContext {
        let localContext = new TheTypeIdContext(this.context, this.state);
        this.enterRule(localContext, 246, CPP14Parser.RULE_theTypeId);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1469;
            this.typeSpecifierSeq();
            this.state = 1471;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 181, this.context) ) {
            case 1:
                {
                this.state = 1470;
                this.abstractDeclarator();
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
    public abstractDeclarator(): AbstractDeclaratorContext {
        let localContext = new AbstractDeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 248, CPP14Parser.RULE_abstractDeclarator);
        try {
            this.state = 1481;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 183, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1473;
                this.pointerAbstractDeclarator();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1475;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 182, this.context) ) {
                case 1:
                    {
                    this.state = 1474;
                    this.noPointerAbstractDeclarator();
                    }
                    break;
                }
                this.state = 1477;
                this.parametersAndQualifiers();
                this.state = 1478;
                this.trailingReturnType();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1480;
                this.abstractPackDeclarator();
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
    public pointerAbstractDeclarator(): PointerAbstractDeclaratorContext {
        let localContext = new PointerAbstractDeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 250, CPP14Parser.RULE_pointerAbstractDeclarator);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1486;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 184, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 1483;
                    this.pointerOperator();
                    }
                    }
                }
                this.state = 1488;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 184, this.context);
            }
            this.state = 1491;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.LeftParen:
                {
                this.state = 1489;
                this.noPointerAbstractDeclarator();
                }
                break;
            case CPP14Parser.Decltype:
            case CPP14Parser.Star:
            case CPP14Parser.And:
            case CPP14Parser.AndAnd:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Identifier:
                {
                this.state = 1490;
                this.pointerOperator();
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
    public noPointerAbstractDeclarator(): NoPointerAbstractDeclaratorContext {
        let localContext = new NoPointerAbstractDeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 252, CPP14Parser.RULE_noPointerAbstractDeclarator);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1498;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 186, this.context) ) {
            case 1:
                {
                this.state = 1493;
                this.parametersAndQualifiers();
                }
                break;
            case 2:
                {
                this.state = 1494;
                this.match(CPP14Parser.LeftParen);
                this.state = 1495;
                this.pointerAbstractDeclarator();
                this.state = 1496;
                this.match(CPP14Parser.RightParen);
                }
                break;
            }
            this.state = 1511;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 190, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    this.state = 1509;
                    this.errorHandler.sync(this);
                    switch (this.tokenStream.LA(1)) {
                    case CPP14Parser.LeftParen:
                        {
                        this.state = 1500;
                        this.parametersAndQualifiers();
                        }
                        break;
                    case CPP14Parser.LeftBracket:
                        {
                        this.state = 1501;
                        this.match(CPP14Parser.LeftBracket);
                        this.state = 1503;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3575408894) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 1156066497) !== 0) || ((((_la - 75)) & ~0x1F) === 0 && ((1 << (_la - 75)) & 63378763) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 4227) !== 0)) {
                            {
                            this.state = 1502;
                            this.constantExpression();
                            }
                        }

                        this.state = 1505;
                        this.match(CPP14Parser.RightBracket);
                        this.state = 1507;
                        this.errorHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this.tokenStream, 188, this.context) ) {
                        case 1:
                            {
                            this.state = 1506;
                            this.attributeSpecifierSeq();
                            }
                            break;
                        }
                        }
                        break;
                    default:
                        throw new antlr.NoViableAltException(this);
                    }
                    }
                }
                this.state = 1513;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 190, this.context);
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
    public abstractPackDeclarator(): AbstractPackDeclaratorContext {
        let localContext = new AbstractPackDeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 254, CPP14Parser.RULE_abstractPackDeclarator);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1517;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 26 || ((((_la - 93)) & ~0x1F) === 0 && ((1 << (_la - 93)) & 33554449) !== 0) || _la === 127 || _la === 132) {
                {
                {
                this.state = 1514;
                this.pointerOperator();
                }
                }
                this.state = 1519;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            }
            this.state = 1520;
            this.noPointerAbstractPackDeclarator();
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
    public noPointerAbstractPackDeclarator(): NoPointerAbstractPackDeclaratorContext {
        let localContext = new NoPointerAbstractPackDeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 256, CPP14Parser.RULE_noPointerAbstractPackDeclarator);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1522;
            this.match(CPP14Parser.Ellipsis);
            this.state = 1534;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 195, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    this.state = 1532;
                    this.errorHandler.sync(this);
                    switch (this.tokenStream.LA(1)) {
                    case CPP14Parser.LeftParen:
                        {
                        this.state = 1523;
                        this.parametersAndQualifiers();
                        }
                        break;
                    case CPP14Parser.LeftBracket:
                        {
                        this.state = 1524;
                        this.match(CPP14Parser.LeftBracket);
                        this.state = 1526;
                        this.errorHandler.sync(this);
                        _la = this.tokenStream.LA(1);
                        if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3575408894) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 1156066497) !== 0) || ((((_la - 75)) & ~0x1F) === 0 && ((1 << (_la - 75)) & 63378763) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 4227) !== 0)) {
                            {
                            this.state = 1525;
                            this.constantExpression();
                            }
                        }

                        this.state = 1528;
                        this.match(CPP14Parser.RightBracket);
                        this.state = 1530;
                        this.errorHandler.sync(this);
                        switch (this.interpreter.adaptivePredict(this.tokenStream, 193, this.context) ) {
                        case 1:
                            {
                            this.state = 1529;
                            this.attributeSpecifierSeq();
                            }
                            break;
                        }
                        }
                        break;
                    default:
                        throw new antlr.NoViableAltException(this);
                    }
                    }
                }
                this.state = 1536;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 195, this.context);
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
    public parameterDeclarationClause(): ParameterDeclarationClauseContext {
        let localContext = new ParameterDeclarationClauseContext(this.context, this.state);
        this.enterRule(localContext, 258, CPP14Parser.RULE_parameterDeclarationClause);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1537;
            this.parameterDeclarationList();
            this.state = 1542;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 122 || _la === 131) {
                {
                this.state = 1539;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 122) {
                    {
                    this.state = 1538;
                    this.match(CPP14Parser.Comma);
                    }
                }

                this.state = 1541;
                this.match(CPP14Parser.Ellipsis);
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
    public parameterDeclarationList(): ParameterDeclarationListContext {
        let localContext = new ParameterDeclarationListContext(this.context, this.state);
        this.enterRule(localContext, 260, CPP14Parser.RULE_parameterDeclarationList);
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1544;
            this.parameterDeclaration();
            this.state = 1549;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 198, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 1545;
                    this.match(CPP14Parser.Comma);
                    this.state = 1546;
                    this.parameterDeclaration();
                    }
                    }
                }
                this.state = 1551;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 198, this.context);
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
        this.enterRule(localContext, 262, CPP14Parser.RULE_parameterDeclaration);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1553;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 87) {
                {
                this.state = 1552;
                this.attributeSpecifierSeq();
                }
            }

            this.state = 1555;
            this.declSpecifierSeq();
            this.state = 1560;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 201, this.context) ) {
            case 1:
                {
                this.state = 1556;
                this.declarator();
                }
                break;
            case 2:
                {
                this.state = 1558;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 200, this.context) ) {
                case 1:
                    {
                    this.state = 1557;
                    this.abstractDeclarator();
                    }
                    break;
                }
                }
                break;
            }
            this.state = 1564;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 101) {
                {
                this.state = 1562;
                this.match(CPP14Parser.Assign);
                this.state = 1563;
                this.initializerClause();
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
    public functionDefinition(): FunctionDefinitionContext {
        let localContext = new FunctionDefinitionContext(this.context, this.state);
        this.enterRule(localContext, 264, CPP14Parser.RULE_functionDefinition);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1567;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 87) {
                {
                this.state = 1566;
                this.attributeSpecifierSeq();
                }
            }

            this.state = 1570;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 204, this.context) ) {
            case 1:
                {
                this.state = 1569;
                this.declSpecifierSeq();
                }
                break;
            }
            this.state = 1572;
            this.declarator();
            this.state = 1574;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 38 || _la === 53) {
                {
                this.state = 1573;
                this.virtualSpecifierSeq();
                }
            }

            this.state = 1576;
            this.functionBody();
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
    public functionBody(): FunctionBodyContext {
        let localContext = new FunctionBodyContext(this.context, this.state);
        this.enterRule(localContext, 266, CPP14Parser.RULE_functionBody);
        let _la: number;
        try {
            this.state = 1586;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.LeftBrace:
            case CPP14Parser.Colon:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1579;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 126) {
                    {
                    this.state = 1578;
                    this.constructorInitializer();
                    }
                }

                this.state = 1581;
                this.compoundStatement();
                }
                break;
            case CPP14Parser.Try:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1582;
                this.functionTryBlock();
                }
                break;
            case CPP14Parser.Assign:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1583;
                this.match(CPP14Parser.Assign);
                this.state = 1584;
                _la = this.tokenStream.LA(1);
                if(!(_la === 27 || _la === 28)) {
                this.errorHandler.recoverInline(this);
                }
                else {
                    this.errorHandler.reportMatch(this);
                    this.consume();
                }
                this.state = 1585;
                this.match(CPP14Parser.Semi);
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
    public initializer(): InitializerContext {
        let localContext = new InitializerContext(this.context, this.state);
        this.enterRule(localContext, 268, CPP14Parser.RULE_initializer);
        try {
            this.state = 1593;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.LeftBrace:
            case CPP14Parser.Assign:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1588;
                this.braceOrEqualInitializer();
                }
                break;
            case CPP14Parser.LeftParen:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1589;
                this.match(CPP14Parser.LeftParen);
                this.state = 1590;
                this.expressionList();
                this.state = 1591;
                this.match(CPP14Parser.RightParen);
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
    public braceOrEqualInitializer(): BraceOrEqualInitializerContext {
        let localContext = new BraceOrEqualInitializerContext(this.context, this.state);
        this.enterRule(localContext, 270, CPP14Parser.RULE_braceOrEqualInitializer);
        try {
            this.state = 1598;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Assign:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1595;
                this.match(CPP14Parser.Assign);
                this.state = 1596;
                this.initializerClause();
                }
                break;
            case CPP14Parser.LeftBrace:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1597;
                this.bracedInitList();
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
    public initializerClause(): InitializerClauseContext {
        let localContext = new InitializerClauseContext(this.context, this.state);
        this.enterRule(localContext, 272, CPP14Parser.RULE_initializerClause);
        try {
            this.state = 1602;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.IntegerLiteral:
            case CPP14Parser.CharacterLiteral:
            case CPP14Parser.FloatingLiteral:
            case CPP14Parser.StringLiteral:
            case CPP14Parser.BooleanLiteral:
            case CPP14Parser.PointerLiteral:
            case CPP14Parser.UserDefinedLiteral:
            case CPP14Parser.Alignof:
            case CPP14Parser.Auto:
            case CPP14Parser.Bool:
            case CPP14Parser.Char:
            case CPP14Parser.Char16:
            case CPP14Parser.Char32:
            case CPP14Parser.Const_cast:
            case CPP14Parser.Decltype:
            case CPP14Parser.Delete:
            case CPP14Parser.Double:
            case CPP14Parser.Dynamic_cast:
            case CPP14Parser.Float:
            case CPP14Parser.Int:
            case CPP14Parser.Long:
            case CPP14Parser.New:
            case CPP14Parser.Noexcept:
            case CPP14Parser.Operator:
            case CPP14Parser.Reinterpret_cast:
            case CPP14Parser.Short:
            case CPP14Parser.Signed:
            case CPP14Parser.Sizeof:
            case CPP14Parser.Static_cast:
            case CPP14Parser.This:
            case CPP14Parser.Throw:
            case CPP14Parser.Typeid_:
            case CPP14Parser.Typename_:
            case CPP14Parser.Unsigned:
            case CPP14Parser.Void:
            case CPP14Parser.Wchar:
            case CPP14Parser.LeftParen:
            case CPP14Parser.LeftBracket:
            case CPP14Parser.Plus:
            case CPP14Parser.Minus:
            case CPP14Parser.Star:
            case CPP14Parser.And:
            case CPP14Parser.Or:
            case CPP14Parser.Tilde:
            case CPP14Parser.Not:
            case CPP14Parser.PlusPlus:
            case CPP14Parser.MinusMinus:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Identifier:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1600;
                this.assignmentExpression();
                }
                break;
            case CPP14Parser.LeftBrace:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1601;
                this.bracedInitList();
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
        this.enterRule(localContext, 274, CPP14Parser.RULE_initializerList);
        let _la: number;
        try {
            let alternative: number;
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1604;
            this.initializerClause();
            this.state = 1606;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 131) {
                {
                this.state = 1605;
                this.match(CPP14Parser.Ellipsis);
                }
            }

            this.state = 1615;
            this.errorHandler.sync(this);
            alternative = this.interpreter.adaptivePredict(this.tokenStream, 213, this.context);
            while (alternative !== 2 && alternative !== antlr.ATN.INVALID_ALT_NUMBER) {
                if (alternative === 1) {
                    {
                    {
                    this.state = 1608;
                    this.match(CPP14Parser.Comma);
                    this.state = 1609;
                    this.initializerClause();
                    this.state = 1611;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 131) {
                        {
                        this.state = 1610;
                        this.match(CPP14Parser.Ellipsis);
                        }
                    }

                    }
                    }
                }
                this.state = 1617;
                this.errorHandler.sync(this);
                alternative = this.interpreter.adaptivePredict(this.tokenStream, 213, this.context);
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
    public bracedInitList(): BracedInitListContext {
        let localContext = new BracedInitListContext(this.context, this.state);
        this.enterRule(localContext, 276, CPP14Parser.RULE_bracedInitList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1618;
            this.match(CPP14Parser.LeftBrace);
            this.state = 1623;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3575408894) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 1156066497) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1014322353) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 4227) !== 0)) {
                {
                this.state = 1619;
                this.initializerList();
                this.state = 1621;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 122) {
                    {
                    this.state = 1620;
                    this.match(CPP14Parser.Comma);
                    }
                }

                }
            }

            this.state = 1625;
            this.match(CPP14Parser.RightBrace);
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
    public className(): ClassNameContext {
        let localContext = new ClassNameContext(this.context, this.state);
        this.enterRule(localContext, 278, CPP14Parser.RULE_className);
        try {
            this.state = 1629;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 216, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1627;
                this.match(CPP14Parser.Identifier);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1628;
                this.simpleTemplateId();
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
    public classSpecifier(): ClassSpecifierContext {
        let localContext = new ClassSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 280, CPP14Parser.RULE_classSpecifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1631;
            this.classHead();
            this.state = 1632;
            this.match(CPP14Parser.LeftBrace);
            this.state = 1634;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 2777759513) !== 0) || ((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & 1163607311) !== 0) || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 10619647) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 26369) !== 0)) {
                {
                this.state = 1633;
                this.memberSpecification();
                }
            }

            this.state = 1636;
            this.match(CPP14Parser.RightBrace);
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
    public classHead(): ClassHeadContext {
        let localContext = new ClassHeadContext(this.context, this.state);
        this.enterRule(localContext, 282, CPP14Parser.RULE_classHead);
        let _la: number;
        try {
            this.state = 1661;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Class:
            case CPP14Parser.Struct:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1638;
                this.classKey();
                this.state = 1640;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 10 || _la === 87) {
                    {
                    this.state = 1639;
                    this.attributeSpecifierSeq();
                    }
                }

                this.state = 1646;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 26 || _la === 127 || _la === 132) {
                    {
                    this.state = 1642;
                    this.classHeadName();
                    this.state = 1644;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 38) {
                        {
                        this.state = 1643;
                        this.classVirtSpecifier();
                        }
                    }

                    }
                }

                this.state = 1649;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 126) {
                    {
                    this.state = 1648;
                    this.baseClause();
                    }
                }

                }
                break;
            case CPP14Parser.Union:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1651;
                this.match(CPP14Parser.Union);
                this.state = 1653;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 10 || _la === 87) {
                    {
                    this.state = 1652;
                    this.attributeSpecifierSeq();
                    }
                }

                this.state = 1659;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 26 || _la === 127 || _la === 132) {
                    {
                    this.state = 1655;
                    this.classHeadName();
                    this.state = 1657;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 38) {
                        {
                        this.state = 1656;
                        this.classVirtSpecifier();
                        }
                    }

                    }
                }

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
    public classHeadName(): ClassHeadNameContext {
        let localContext = new ClassHeadNameContext(this.context, this.state);
        this.enterRule(localContext, 284, CPP14Parser.RULE_classHeadName);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1664;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 226, this.context) ) {
            case 1:
                {
                this.state = 1663;
                this.nestedNameSpecifier(0);
                }
                break;
            }
            this.state = 1666;
            this.className();
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
    public classVirtSpecifier(): ClassVirtSpecifierContext {
        let localContext = new ClassVirtSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 286, CPP14Parser.RULE_classVirtSpecifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1668;
            this.match(CPP14Parser.Final);
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
    public classKey(): ClassKeyContext {
        let localContext = new ClassKeyContext(this.context, this.state);
        this.enterRule(localContext, 288, CPP14Parser.RULE_classKey);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1670;
            _la = this.tokenStream.LA(1);
            if(!(_la === 21 || _la === 66)) {
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
    public memberSpecification(): MemberSpecificationContext {
        let localContext = new MemberSpecificationContext(this.context, this.state);
        this.enterRule(localContext, 290, CPP14Parser.RULE_memberSpecification);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1676;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                this.state = 1676;
                this.errorHandler.sync(this);
                switch (this.tokenStream.LA(1)) {
                case CPP14Parser.Alignas:
                case CPP14Parser.Auto:
                case CPP14Parser.Bool:
                case CPP14Parser.Char:
                case CPP14Parser.Char16:
                case CPP14Parser.Char32:
                case CPP14Parser.Class:
                case CPP14Parser.Const:
                case CPP14Parser.Constexpr:
                case CPP14Parser.Decltype:
                case CPP14Parser.Double:
                case CPP14Parser.Enum:
                case CPP14Parser.Explicit:
                case CPP14Parser.Extern:
                case CPP14Parser.Float:
                case CPP14Parser.Friend:
                case CPP14Parser.Inline:
                case CPP14Parser.Int:
                case CPP14Parser.Long:
                case CPP14Parser.Mutable:
                case CPP14Parser.Operator:
                case CPP14Parser.Register:
                case CPP14Parser.Short:
                case CPP14Parser.Signed:
                case CPP14Parser.Static:
                case CPP14Parser.Static_assert:
                case CPP14Parser.Struct:
                case CPP14Parser.Template:
                case CPP14Parser.Thread_local:
                case CPP14Parser.Typedef:
                case CPP14Parser.Typename_:
                case CPP14Parser.Union:
                case CPP14Parser.Unsigned:
                case CPP14Parser.Using:
                case CPP14Parser.Virtual:
                case CPP14Parser.Void:
                case CPP14Parser.Volatile:
                case CPP14Parser.Wchar:
                case CPP14Parser.LeftParen:
                case CPP14Parser.LeftBracket:
                case CPP14Parser.Star:
                case CPP14Parser.And:
                case CPP14Parser.Tilde:
                case CPP14Parser.AndAnd:
                case CPP14Parser.Colon:
                case CPP14Parser.Doublecolon:
                case CPP14Parser.Semi:
                case CPP14Parser.Ellipsis:
                case CPP14Parser.Identifier:
                    {
                    this.state = 1672;
                    this.memberdeclaration();
                    }
                    break;
                case CPP14Parser.Private:
                case CPP14Parser.Protected:
                case CPP14Parser.Public:
                    {
                    this.state = 1673;
                    this.accessSpecifier();
                    this.state = 1674;
                    this.match(CPP14Parser.Colon);
                    }
                    break;
                default:
                    throw new antlr.NoViableAltException(this);
                }
                }
                this.state = 1678;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (((((_la - 10)) & ~0x1F) === 0 && ((1 << (_la - 10)) & 2777759513) !== 0) || ((((_la - 44)) & ~0x1F) === 0 && ((1 << (_la - 44)) & 1163607311) !== 0) || ((((_la - 76)) & ~0x1F) === 0 && ((1 << (_la - 76)) & 10619647) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 26369) !== 0));
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
    public memberdeclaration(): MemberdeclarationContext {
        let localContext = new MemberdeclarationContext(this.context, this.state);
        this.enterRule(localContext, 292, CPP14Parser.RULE_memberdeclaration);
        let _la: number;
        try {
            this.state = 1696;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 232, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1681;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 229, this.context) ) {
                case 1:
                    {
                    this.state = 1680;
                    this.attributeSpecifierSeq();
                    }
                    break;
                }
                this.state = 1684;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 230, this.context) ) {
                case 1:
                    {
                    this.state = 1683;
                    this.declSpecifierSeq();
                    }
                    break;
                }
                this.state = 1687;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 10 || _la === 26 || _la === 52 || ((((_la - 85)) & ~0x1F) === 0 && ((1 << (_la - 85)) & 20741) !== 0) || ((((_la - 118)) & ~0x1F) === 0 && ((1 << (_la - 118)) & 25345) !== 0)) {
                    {
                    this.state = 1686;
                    this.memberDeclaratorList();
                    }
                }

                this.state = 1689;
                this.match(CPP14Parser.Semi);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1690;
                this.functionDefinition();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1691;
                this.usingDeclaration();
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 1692;
                this.staticAssertDeclaration();
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 1693;
                this.templateDeclaration();
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 1694;
                this.aliasDeclaration();
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 1695;
                this.emptyDeclaration_();
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
    public memberDeclaratorList(): MemberDeclaratorListContext {
        let localContext = new MemberDeclaratorListContext(this.context, this.state);
        this.enterRule(localContext, 294, CPP14Parser.RULE_memberDeclaratorList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1698;
            this.memberDeclarator();
            this.state = 1703;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 122) {
                {
                {
                this.state = 1699;
                this.match(CPP14Parser.Comma);
                this.state = 1700;
                this.memberDeclarator();
                }
                }
                this.state = 1705;
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
    public memberDeclarator(): MemberDeclaratorContext {
        let localContext = new MemberDeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 296, CPP14Parser.RULE_memberDeclarator);
        let _la: number;
        try {
            this.state = 1723;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 238, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1706;
                this.declarator();
                this.state = 1713;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 235, this.context) ) {
                case 1:
                    {
                    this.state = 1707;
                    this.virtualSpecifierSeq();
                    this.state = 1709;
                    this.errorHandler.sync(this);
                    _la = this.tokenStream.LA(1);
                    if (_la === 101) {
                        {
                        this.state = 1708;
                        this.pureSpecifier();
                        }
                    }

                    }
                    break;
                case 2:
                    {
                    this.state = 1711;
                    this.pureSpecifier();
                    }
                    break;
                case 3:
                    {
                    this.state = 1712;
                    this.braceOrEqualInitializer();
                    }
                    break;
                }
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1716;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 132) {
                    {
                    this.state = 1715;
                    this.match(CPP14Parser.Identifier);
                    }
                }

                this.state = 1719;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 10 || _la === 87) {
                    {
                    this.state = 1718;
                    this.attributeSpecifierSeq();
                    }
                }

                this.state = 1721;
                this.match(CPP14Parser.Colon);
                this.state = 1722;
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
    public virtualSpecifierSeq(): VirtualSpecifierSeqContext {
        let localContext = new VirtualSpecifierSeqContext(this.context, this.state);
        this.enterRule(localContext, 298, CPP14Parser.RULE_virtualSpecifierSeq);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1726;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 1725;
                this.virtualSpecifier();
                }
                }
                this.state = 1728;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 38 || _la === 53);
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
    public virtualSpecifier(): VirtualSpecifierContext {
        let localContext = new VirtualSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 300, CPP14Parser.RULE_virtualSpecifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1730;
            _la = this.tokenStream.LA(1);
            if(!(_la === 38 || _la === 53)) {
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
    public pureSpecifier(): PureSpecifierContext {
        let localContext = new PureSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 302, CPP14Parser.RULE_pureSpecifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1732;
            this.match(CPP14Parser.Assign);
            this.state = 1733;
            this.match(CPP14Parser.IntegerLiteral);
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
    public baseClause(): BaseClauseContext {
        let localContext = new BaseClauseContext(this.context, this.state);
        this.enterRule(localContext, 304, CPP14Parser.RULE_baseClause);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1735;
            this.match(CPP14Parser.Colon);
            this.state = 1736;
            this.baseSpecifierList();
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
    public baseSpecifierList(): BaseSpecifierListContext {
        let localContext = new BaseSpecifierListContext(this.context, this.state);
        this.enterRule(localContext, 306, CPP14Parser.RULE_baseSpecifierList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1738;
            this.baseSpecifier();
            this.state = 1740;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 131) {
                {
                this.state = 1739;
                this.match(CPP14Parser.Ellipsis);
                }
            }

            this.state = 1749;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 122) {
                {
                {
                this.state = 1742;
                this.match(CPP14Parser.Comma);
                this.state = 1743;
                this.baseSpecifier();
                this.state = 1745;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 131) {
                    {
                    this.state = 1744;
                    this.match(CPP14Parser.Ellipsis);
                    }
                }

                }
                }
                this.state = 1751;
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
    public baseSpecifier(): BaseSpecifierContext {
        let localContext = new BaseSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 308, CPP14Parser.RULE_baseSpecifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1753;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 10 || _la === 87) {
                {
                this.state = 1752;
                this.attributeSpecifierSeq();
                }
            }

            this.state = 1767;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Decltype:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Identifier:
                {
                this.state = 1755;
                this.baseTypeSpecifier();
                }
                break;
            case CPP14Parser.Virtual:
                {
                this.state = 1756;
                this.match(CPP14Parser.Virtual);
                this.state = 1758;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (((((_la - 54)) & ~0x1F) === 0 && ((1 << (_la - 54)) & 7) !== 0)) {
                    {
                    this.state = 1757;
                    this.accessSpecifier();
                    }
                }

                this.state = 1760;
                this.baseTypeSpecifier();
                }
                break;
            case CPP14Parser.Private:
            case CPP14Parser.Protected:
            case CPP14Parser.Public:
                {
                this.state = 1761;
                this.accessSpecifier();
                this.state = 1763;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 80) {
                    {
                    this.state = 1762;
                    this.match(CPP14Parser.Virtual);
                    }
                }

                this.state = 1765;
                this.baseTypeSpecifier();
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
    public classOrDeclType(): ClassOrDeclTypeContext {
        let localContext = new ClassOrDeclTypeContext(this.context, this.state);
        this.enterRule(localContext, 310, CPP14Parser.RULE_classOrDeclType);
        try {
            this.state = 1774;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 248, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1770;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 247, this.context) ) {
                case 1:
                    {
                    this.state = 1769;
                    this.nestedNameSpecifier(0);
                    }
                    break;
                }
                this.state = 1772;
                this.className();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1773;
                this.decltypeSpecifier();
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
    public baseTypeSpecifier(): BaseTypeSpecifierContext {
        let localContext = new BaseTypeSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 312, CPP14Parser.RULE_baseTypeSpecifier);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1776;
            this.classOrDeclType();
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
    public accessSpecifier(): AccessSpecifierContext {
        let localContext = new AccessSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 314, CPP14Parser.RULE_accessSpecifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1778;
            _la = this.tokenStream.LA(1);
            if(!(((((_la - 54)) & ~0x1F) === 0 && ((1 << (_la - 54)) & 7) !== 0))) {
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
    public conversionFunctionId(): ConversionFunctionIdContext {
        let localContext = new ConversionFunctionIdContext(this.context, this.state);
        this.enterRule(localContext, 316, CPP14Parser.RULE_conversionFunctionId);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1780;
            this.match(CPP14Parser.Operator);
            this.state = 1781;
            this.conversionTypeId();
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
    public conversionTypeId(): ConversionTypeIdContext {
        let localContext = new ConversionTypeIdContext(this.context, this.state);
        this.enterRule(localContext, 318, CPP14Parser.RULE_conversionTypeId);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1783;
            this.typeSpecifierSeq();
            this.state = 1785;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 249, this.context) ) {
            case 1:
                {
                this.state = 1784;
                this.conversionDeclarator();
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
    public conversionDeclarator(): ConversionDeclaratorContext {
        let localContext = new ConversionDeclaratorContext(this.context, this.state);
        this.enterRule(localContext, 320, CPP14Parser.RULE_conversionDeclarator);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1787;
            this.pointerOperator();
            this.state = 1789;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 250, this.context) ) {
            case 1:
                {
                this.state = 1788;
                this.conversionDeclarator();
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
    public constructorInitializer(): ConstructorInitializerContext {
        let localContext = new ConstructorInitializerContext(this.context, this.state);
        this.enterRule(localContext, 322, CPP14Parser.RULE_constructorInitializer);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1791;
            this.match(CPP14Parser.Colon);
            this.state = 1792;
            this.memInitializerList();
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
    public memInitializerList(): MemInitializerListContext {
        let localContext = new MemInitializerListContext(this.context, this.state);
        this.enterRule(localContext, 324, CPP14Parser.RULE_memInitializerList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1794;
            this.memInitializer();
            this.state = 1796;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 131) {
                {
                this.state = 1795;
                this.match(CPP14Parser.Ellipsis);
                }
            }

            this.state = 1805;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 122) {
                {
                {
                this.state = 1798;
                this.match(CPP14Parser.Comma);
                this.state = 1799;
                this.memInitializer();
                this.state = 1801;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 131) {
                    {
                    this.state = 1800;
                    this.match(CPP14Parser.Ellipsis);
                    }
                }

                }
                }
                this.state = 1807;
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
    public memInitializer(): MemInitializerContext {
        let localContext = new MemInitializerContext(this.context, this.state);
        this.enterRule(localContext, 326, CPP14Parser.RULE_memInitializer);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1808;
            this.meminitializerid();
            this.state = 1815;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.LeftParen:
                {
                this.state = 1809;
                this.match(CPP14Parser.LeftParen);
                this.state = 1811;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3575408894) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 1156066497) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1014322353) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 4227) !== 0)) {
                    {
                    this.state = 1810;
                    this.expressionList();
                    }
                }

                this.state = 1813;
                this.match(CPP14Parser.RightParen);
                }
                break;
            case CPP14Parser.LeftBrace:
                {
                this.state = 1814;
                this.bracedInitList();
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
    public meminitializerid(): MeminitializeridContext {
        let localContext = new MeminitializeridContext(this.context, this.state);
        this.enterRule(localContext, 328, CPP14Parser.RULE_meminitializerid);
        try {
            this.state = 1819;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 256, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1817;
                this.classOrDeclType();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1818;
                this.match(CPP14Parser.Identifier);
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
    public operatorFunctionId(): OperatorFunctionIdContext {
        let localContext = new OperatorFunctionIdContext(this.context, this.state);
        this.enterRule(localContext, 330, CPP14Parser.RULE_operatorFunctionId);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1821;
            this.match(CPP14Parser.Operator);
            this.state = 1822;
            this.theOperator();
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
    public literalOperatorId(): LiteralOperatorIdContext {
        let localContext = new LiteralOperatorIdContext(this.context, this.state);
        this.enterRule(localContext, 332, CPP14Parser.RULE_literalOperatorId);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1824;
            this.match(CPP14Parser.Operator);
            this.state = 1828;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.StringLiteral:
                {
                this.state = 1825;
                this.match(CPP14Parser.StringLiteral);
                this.state = 1826;
                this.match(CPP14Parser.Identifier);
                }
                break;
            case CPP14Parser.UserDefinedStringLiteral:
                {
                this.state = 1827;
                this.match(CPP14Parser.UserDefinedStringLiteral);
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
    public templateDeclaration(): TemplateDeclarationContext {
        let localContext = new TemplateDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 334, CPP14Parser.RULE_templateDeclaration);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1830;
            this.match(CPP14Parser.Template);
            this.state = 1831;
            this.match(CPP14Parser.Less);
            this.state = 1832;
            this.templateparameterList();
            this.state = 1833;
            this.match(CPP14Parser.Greater);
            this.state = 1834;
            this.declaration();
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
    public templateparameterList(): TemplateparameterListContext {
        let localContext = new TemplateparameterListContext(this.context, this.state);
        this.enterRule(localContext, 336, CPP14Parser.RULE_templateparameterList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1836;
            this.templateParameter();
            this.state = 1841;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 122) {
                {
                {
                this.state = 1837;
                this.match(CPP14Parser.Comma);
                this.state = 1838;
                this.templateParameter();
                }
                }
                this.state = 1843;
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
    public templateParameter(): TemplateParameterContext {
        let localContext = new TemplateParameterContext(this.context, this.state);
        this.enterRule(localContext, 338, CPP14Parser.RULE_templateParameter);
        try {
            this.state = 1846;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 259, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1844;
                this.typeParameter();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1845;
                this.parameterDeclaration();
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
    public typeParameter(): TypeParameterContext {
        let localContext = new TypeParameterContext(this.context, this.state);
        this.enterRule(localContext, 340, CPP14Parser.RULE_typeParameter);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1857;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Class:
            case CPP14Parser.Template:
                {
                this.state = 1853;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 68) {
                    {
                    this.state = 1848;
                    this.match(CPP14Parser.Template);
                    this.state = 1849;
                    this.match(CPP14Parser.Less);
                    this.state = 1850;
                    this.templateparameterList();
                    this.state = 1851;
                    this.match(CPP14Parser.Greater);
                    }
                }

                this.state = 1855;
                this.match(CPP14Parser.Class);
                }
                break;
            case CPP14Parser.Typename_:
                {
                this.state = 1856;
                this.match(CPP14Parser.Typename_);
                }
                break;
            default:
                throw new antlr.NoViableAltException(this);
            }
            this.state = 1870;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 265, this.context) ) {
            case 1:
                {
                this.state = 1860;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 131) {
                    {
                    this.state = 1859;
                    this.match(CPP14Parser.Ellipsis);
                    }
                }

                this.state = 1863;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 132) {
                    {
                    this.state = 1862;
                    this.match(CPP14Parser.Identifier);
                    }
                }

                }
                break;
            case 2:
                {
                this.state = 1866;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 132) {
                    {
                    this.state = 1865;
                    this.match(CPP14Parser.Identifier);
                    }
                }

                this.state = 1868;
                this.match(CPP14Parser.Assign);
                this.state = 1869;
                this.theTypeId();
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
    public simpleTemplateId(): SimpleTemplateIdContext {
        let localContext = new SimpleTemplateIdContext(this.context, this.state);
        this.enterRule(localContext, 342, CPP14Parser.RULE_simpleTemplateId);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1872;
            this.templateName();
            this.state = 1873;
            this.match(CPP14Parser.Less);
            this.state = 1875;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3581700350) !== 0) || ((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 973811777) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 475479059) !== 0) || ((((_la - 97)) & ~0x1F) === 0 && ((1 << (_la - 97)) & 1098907663) !== 0) || _la === 132) {
                {
                this.state = 1874;
                this.templateArgumentList();
                }
            }

            this.state = 1877;
            this.match(CPP14Parser.Greater);
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
    public templateId(): TemplateIdContext {
        let localContext = new TemplateIdContext(this.context, this.state);
        this.enterRule(localContext, 344, CPP14Parser.RULE_templateId);
        let _la: number;
        try {
            this.state = 1890;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Identifier:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1879;
                this.simpleTemplateId();
                }
                break;
            case CPP14Parser.Operator:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1882;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 267, this.context) ) {
                case 1:
                    {
                    this.state = 1880;
                    this.operatorFunctionId();
                    }
                    break;
                case 2:
                    {
                    this.state = 1881;
                    this.literalOperatorId();
                    }
                    break;
                }
                this.state = 1884;
                this.match(CPP14Parser.Less);
                this.state = 1886;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3581700350) !== 0) || ((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 973811777) !== 0) || ((((_la - 65)) & ~0x1F) === 0 && ((1 << (_la - 65)) & 475479059) !== 0) || ((((_la - 97)) & ~0x1F) === 0 && ((1 << (_la - 97)) & 1098907663) !== 0) || _la === 132) {
                    {
                    this.state = 1885;
                    this.templateArgumentList();
                    }
                }

                this.state = 1888;
                this.match(CPP14Parser.Greater);
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
    public templateName(): TemplateNameContext {
        let localContext = new TemplateNameContext(this.context, this.state);
        this.enterRule(localContext, 346, CPP14Parser.RULE_templateName);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1892;
            this.match(CPP14Parser.Identifier);
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
    public templateArgumentList(): TemplateArgumentListContext {
        let localContext = new TemplateArgumentListContext(this.context, this.state);
        this.enterRule(localContext, 348, CPP14Parser.RULE_templateArgumentList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1894;
            this.templateArgument();
            this.state = 1896;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 131) {
                {
                this.state = 1895;
                this.match(CPP14Parser.Ellipsis);
                }
            }

            this.state = 1905;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 122) {
                {
                {
                this.state = 1898;
                this.match(CPP14Parser.Comma);
                this.state = 1899;
                this.templateArgument();
                this.state = 1901;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 131) {
                    {
                    this.state = 1900;
                    this.match(CPP14Parser.Ellipsis);
                    }
                }

                }
                }
                this.state = 1907;
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
    public templateArgument(): TemplateArgumentContext {
        let localContext = new TemplateArgumentContext(this.context, this.state);
        this.enterRule(localContext, 350, CPP14Parser.RULE_templateArgument);
        try {
            this.state = 1911;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 273, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1908;
                this.theTypeId();
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1909;
                this.constantExpression();
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 1910;
                this.idExpression();
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
    public typeNameSpecifier(): TypeNameSpecifierContext {
        let localContext = new TypeNameSpecifierContext(this.context, this.state);
        this.enterRule(localContext, 352, CPP14Parser.RULE_typeNameSpecifier);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1913;
            this.match(CPP14Parser.Typename_);
            this.state = 1914;
            this.nestedNameSpecifier(0);
            this.state = 1920;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 275, this.context) ) {
            case 1:
                {
                this.state = 1915;
                this.match(CPP14Parser.Identifier);
                }
                break;
            case 2:
                {
                this.state = 1917;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 68) {
                    {
                    this.state = 1916;
                    this.match(CPP14Parser.Template);
                    }
                }

                this.state = 1919;
                this.simpleTemplateId();
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
    public explicitInstantiation(): ExplicitInstantiationContext {
        let localContext = new ExplicitInstantiationContext(this.context, this.state);
        this.enterRule(localContext, 354, CPP14Parser.RULE_explicitInstantiation);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1923;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 36) {
                {
                this.state = 1922;
                this.match(CPP14Parser.Extern);
                }
            }

            this.state = 1925;
            this.match(CPP14Parser.Template);
            this.state = 1926;
            this.declaration();
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
    public explicitSpecialization(): ExplicitSpecializationContext {
        let localContext = new ExplicitSpecializationContext(this.context, this.state);
        this.enterRule(localContext, 356, CPP14Parser.RULE_explicitSpecialization);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1928;
            this.match(CPP14Parser.Template);
            this.state = 1929;
            this.match(CPP14Parser.Less);
            this.state = 1930;
            this.match(CPP14Parser.Greater);
            this.state = 1931;
            this.declaration();
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
    public tryBlock(): TryBlockContext {
        let localContext = new TryBlockContext(this.context, this.state);
        this.enterRule(localContext, 358, CPP14Parser.RULE_tryBlock);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1933;
            this.match(CPP14Parser.Try);
            this.state = 1934;
            this.compoundStatement();
            this.state = 1935;
            this.handlerSeq();
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
    public functionTryBlock(): FunctionTryBlockContext {
        let localContext = new FunctionTryBlockContext(this.context, this.state);
        this.enterRule(localContext, 360, CPP14Parser.RULE_functionTryBlock);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1937;
            this.match(CPP14Parser.Try);
            this.state = 1939;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 126) {
                {
                this.state = 1938;
                this.constructorInitializer();
                }
            }

            this.state = 1941;
            this.compoundStatement();
            this.state = 1942;
            this.handlerSeq();
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
    public handlerSeq(): HandlerSeqContext {
        let localContext = new HandlerSeqContext(this.context, this.state);
        this.enterRule(localContext, 362, CPP14Parser.RULE_handlerSeq);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1945;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            do {
                {
                {
                this.state = 1944;
                this.handler();
                }
                }
                this.state = 1947;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
            } while (_la === 17);
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
    public handler(): HandlerContext {
        let localContext = new HandlerContext(this.context, this.state);
        this.enterRule(localContext, 364, CPP14Parser.RULE_handler);
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1949;
            this.match(CPP14Parser.Catch);
            this.state = 1950;
            this.match(CPP14Parser.LeftParen);
            this.state = 1951;
            this.exceptionDeclaration();
            this.state = 1952;
            this.match(CPP14Parser.RightParen);
            this.state = 1953;
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
    public exceptionDeclaration(): ExceptionDeclarationContext {
        let localContext = new ExceptionDeclarationContext(this.context, this.state);
        this.enterRule(localContext, 366, CPP14Parser.RULE_exceptionDeclaration);
        let _la: number;
        try {
            this.state = 1964;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Alignas:
            case CPP14Parser.Auto:
            case CPP14Parser.Bool:
            case CPP14Parser.Char:
            case CPP14Parser.Char16:
            case CPP14Parser.Char32:
            case CPP14Parser.Class:
            case CPP14Parser.Const:
            case CPP14Parser.Decltype:
            case CPP14Parser.Double:
            case CPP14Parser.Enum:
            case CPP14Parser.Float:
            case CPP14Parser.Int:
            case CPP14Parser.Long:
            case CPP14Parser.Short:
            case CPP14Parser.Signed:
            case CPP14Parser.Struct:
            case CPP14Parser.Typename_:
            case CPP14Parser.Union:
            case CPP14Parser.Unsigned:
            case CPP14Parser.Void:
            case CPP14Parser.Volatile:
            case CPP14Parser.Wchar:
            case CPP14Parser.LeftBracket:
            case CPP14Parser.Doublecolon:
            case CPP14Parser.Identifier:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1956;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 10 || _la === 87) {
                    {
                    this.state = 1955;
                    this.attributeSpecifierSeq();
                    }
                }

                this.state = 1958;
                this.typeSpecifierSeq();
                this.state = 1961;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 280, this.context) ) {
                case 1:
                    {
                    this.state = 1959;
                    this.declarator();
                    }
                    break;
                case 2:
                    {
                    this.state = 1960;
                    this.abstractDeclarator();
                    }
                    break;
                }
                }
                break;
            case CPP14Parser.Ellipsis:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1963;
                this.match(CPP14Parser.Ellipsis);
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
    public throwExpression(): ThrowExpressionContext {
        let localContext = new ThrowExpressionContext(this.context, this.state);
        this.enterRule(localContext, 368, CPP14Parser.RULE_throwExpression);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1966;
            this.match(CPP14Parser.Throw);
            this.state = 1968;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 3575408894) !== 0) || ((((_la - 39)) & ~0x1F) === 0 && ((1 << (_la - 39)) & 1156066497) !== 0) || ((((_la - 71)) & ~0x1F) === 0 && ((1 << (_la - 71)) & 1014060209) !== 0) || ((((_la - 120)) & ~0x1F) === 0 && ((1 << (_la - 120)) & 4227) !== 0)) {
                {
                this.state = 1967;
                this.assignmentExpression();
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
    public exceptionSpecification(): ExceptionSpecificationContext {
        let localContext = new ExceptionSpecificationContext(this.context, this.state);
        this.enterRule(localContext, 370, CPP14Parser.RULE_exceptionSpecification);
        try {
            this.state = 1972;
            this.errorHandler.sync(this);
            switch (this.tokenStream.LA(1)) {
            case CPP14Parser.Throw:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1970;
                this.dynamicExceptionSpecification();
                }
                break;
            case CPP14Parser.Noexcept:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 1971;
                this.noeExceptSpecification();
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
    public dynamicExceptionSpecification(): DynamicExceptionSpecificationContext {
        let localContext = new DynamicExceptionSpecificationContext(this.context, this.state);
        this.enterRule(localContext, 372, CPP14Parser.RULE_dynamicExceptionSpecification);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1974;
            this.match(CPP14Parser.Throw);
            this.state = 1975;
            this.match(CPP14Parser.LeftParen);
            this.state = 1977;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if ((((_la) & ~0x1F) === 0 && ((1 << _la) & 1149001728) !== 0) || ((((_la - 33)) & ~0x1F) === 0 && ((1 << (_la - 33)) & 402665537) !== 0) || ((((_la - 66)) & ~0x1F) === 0 && ((1 << (_la - 66)) & 236545) !== 0) || _la === 127 || _la === 132) {
                {
                this.state = 1976;
                this.typeIdList();
                }
            }

            this.state = 1979;
            this.match(CPP14Parser.RightParen);
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
    public typeIdList(): TypeIdListContext {
        let localContext = new TypeIdListContext(this.context, this.state);
        this.enterRule(localContext, 374, CPP14Parser.RULE_typeIdList);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 1981;
            this.theTypeId();
            this.state = 1983;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            if (_la === 131) {
                {
                this.state = 1982;
                this.match(CPP14Parser.Ellipsis);
                }
            }

            this.state = 1992;
            this.errorHandler.sync(this);
            _la = this.tokenStream.LA(1);
            while (_la === 122) {
                {
                {
                this.state = 1985;
                this.match(CPP14Parser.Comma);
                this.state = 1986;
                this.theTypeId();
                this.state = 1988;
                this.errorHandler.sync(this);
                _la = this.tokenStream.LA(1);
                if (_la === 131) {
                    {
                    this.state = 1987;
                    this.match(CPP14Parser.Ellipsis);
                    }
                }

                }
                }
                this.state = 1994;
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
    public noeExceptSpecification(): NoeExceptSpecificationContext {
        let localContext = new NoeExceptSpecificationContext(this.context, this.state);
        this.enterRule(localContext, 376, CPP14Parser.RULE_noeExceptSpecification);
        try {
            this.state = 2001;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 288, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 1995;
                this.match(CPP14Parser.Noexcept);
                this.state = 1996;
                this.match(CPP14Parser.LeftParen);
                this.state = 1997;
                this.constantExpression();
                this.state = 1998;
                this.match(CPP14Parser.RightParen);
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 2000;
                this.match(CPP14Parser.Noexcept);
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
    public theOperator(): TheOperatorContext {
        let localContext = new TheOperatorContext(this.context, this.state);
        this.enterRule(localContext, 378, CPP14Parser.RULE_theOperator);
        try {
            this.state = 2054;
            this.errorHandler.sync(this);
            switch (this.interpreter.adaptivePredict(this.tokenStream, 291, this.context) ) {
            case 1:
                this.enterOuterAlt(localContext, 1);
                {
                this.state = 2003;
                this.match(CPP14Parser.New);
                this.state = 2006;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 289, this.context) ) {
                case 1:
                    {
                    this.state = 2004;
                    this.match(CPP14Parser.LeftBracket);
                    this.state = 2005;
                    this.match(CPP14Parser.RightBracket);
                    }
                    break;
                }
                }
                break;
            case 2:
                this.enterOuterAlt(localContext, 2);
                {
                this.state = 2008;
                this.match(CPP14Parser.Delete);
                this.state = 2011;
                this.errorHandler.sync(this);
                switch (this.interpreter.adaptivePredict(this.tokenStream, 290, this.context) ) {
                case 1:
                    {
                    this.state = 2009;
                    this.match(CPP14Parser.LeftBracket);
                    this.state = 2010;
                    this.match(CPP14Parser.RightBracket);
                    }
                    break;
                }
                }
                break;
            case 3:
                this.enterOuterAlt(localContext, 3);
                {
                this.state = 2013;
                this.match(CPP14Parser.Plus);
                }
                break;
            case 4:
                this.enterOuterAlt(localContext, 4);
                {
                this.state = 2014;
                this.match(CPP14Parser.Minus);
                }
                break;
            case 5:
                this.enterOuterAlt(localContext, 5);
                {
                this.state = 2015;
                this.match(CPP14Parser.Star);
                }
                break;
            case 6:
                this.enterOuterAlt(localContext, 6);
                {
                this.state = 2016;
                this.match(CPP14Parser.Div);
                }
                break;
            case 7:
                this.enterOuterAlt(localContext, 7);
                {
                this.state = 2017;
                this.match(CPP14Parser.Mod);
                }
                break;
            case 8:
                this.enterOuterAlt(localContext, 8);
                {
                this.state = 2018;
                this.match(CPP14Parser.Caret);
                }
                break;
            case 9:
                this.enterOuterAlt(localContext, 9);
                {
                this.state = 2019;
                this.match(CPP14Parser.And);
                }
                break;
            case 10:
                this.enterOuterAlt(localContext, 10);
                {
                this.state = 2020;
                this.match(CPP14Parser.Or);
                }
                break;
            case 11:
                this.enterOuterAlt(localContext, 11);
                {
                this.state = 2021;
                this.match(CPP14Parser.Tilde);
                }
                break;
            case 12:
                this.enterOuterAlt(localContext, 12);
                {
                this.state = 2022;
                this.match(CPP14Parser.Not);
                }
                break;
            case 13:
                this.enterOuterAlt(localContext, 13);
                {
                this.state = 2023;
                this.match(CPP14Parser.Assign);
                }
                break;
            case 14:
                this.enterOuterAlt(localContext, 14);
                {
                this.state = 2024;
                this.match(CPP14Parser.Greater);
                }
                break;
            case 15:
                this.enterOuterAlt(localContext, 15);
                {
                this.state = 2025;
                this.match(CPP14Parser.Less);
                }
                break;
            case 16:
                this.enterOuterAlt(localContext, 16);
                {
                this.state = 2026;
                this.match(CPP14Parser.GreaterEqual);
                }
                break;
            case 17:
                this.enterOuterAlt(localContext, 17);
                {
                this.state = 2027;
                this.match(CPP14Parser.PlusAssign);
                }
                break;
            case 18:
                this.enterOuterAlt(localContext, 18);
                {
                this.state = 2028;
                this.match(CPP14Parser.MinusAssign);
                }
                break;
            case 19:
                this.enterOuterAlt(localContext, 19);
                {
                this.state = 2029;
                this.match(CPP14Parser.StarAssign);
                }
                break;
            case 20:
                this.enterOuterAlt(localContext, 20);
                {
                this.state = 2030;
                this.match(CPP14Parser.ModAssign);
                }
                break;
            case 21:
                this.enterOuterAlt(localContext, 21);
                {
                this.state = 2031;
                this.match(CPP14Parser.XorAssign);
                }
                break;
            case 22:
                this.enterOuterAlt(localContext, 22);
                {
                this.state = 2032;
                this.match(CPP14Parser.AndAssign);
                }
                break;
            case 23:
                this.enterOuterAlt(localContext, 23);
                {
                this.state = 2033;
                this.match(CPP14Parser.OrAssign);
                }
                break;
            case 24:
                this.enterOuterAlt(localContext, 24);
                {
                this.state = 2034;
                this.match(CPP14Parser.Less);
                this.state = 2035;
                this.match(CPP14Parser.Less);
                }
                break;
            case 25:
                this.enterOuterAlt(localContext, 25);
                {
                this.state = 2036;
                this.match(CPP14Parser.Greater);
                this.state = 2037;
                this.match(CPP14Parser.Greater);
                }
                break;
            case 26:
                this.enterOuterAlt(localContext, 26);
                {
                this.state = 2038;
                this.match(CPP14Parser.RightShiftAssign);
                }
                break;
            case 27:
                this.enterOuterAlt(localContext, 27);
                {
                this.state = 2039;
                this.match(CPP14Parser.LeftShiftAssign);
                }
                break;
            case 28:
                this.enterOuterAlt(localContext, 28);
                {
                this.state = 2040;
                this.match(CPP14Parser.Equal);
                }
                break;
            case 29:
                this.enterOuterAlt(localContext, 29);
                {
                this.state = 2041;
                this.match(CPP14Parser.NotEqual);
                }
                break;
            case 30:
                this.enterOuterAlt(localContext, 30);
                {
                this.state = 2042;
                this.match(CPP14Parser.LessEqual);
                }
                break;
            case 31:
                this.enterOuterAlt(localContext, 31);
                {
                this.state = 2043;
                this.match(CPP14Parser.AndAnd);
                }
                break;
            case 32:
                this.enterOuterAlt(localContext, 32);
                {
                this.state = 2044;
                this.match(CPP14Parser.OrOr);
                }
                break;
            case 33:
                this.enterOuterAlt(localContext, 33);
                {
                this.state = 2045;
                this.match(CPP14Parser.PlusPlus);
                }
                break;
            case 34:
                this.enterOuterAlt(localContext, 34);
                {
                this.state = 2046;
                this.match(CPP14Parser.MinusMinus);
                }
                break;
            case 35:
                this.enterOuterAlt(localContext, 35);
                {
                this.state = 2047;
                this.match(CPP14Parser.Comma);
                }
                break;
            case 36:
                this.enterOuterAlt(localContext, 36);
                {
                this.state = 2048;
                this.match(CPP14Parser.ArrowStar);
                }
                break;
            case 37:
                this.enterOuterAlt(localContext, 37);
                {
                this.state = 2049;
                this.match(CPP14Parser.Arrow);
                }
                break;
            case 38:
                this.enterOuterAlt(localContext, 38);
                {
                this.state = 2050;
                this.match(CPP14Parser.LeftParen);
                this.state = 2051;
                this.match(CPP14Parser.RightParen);
                }
                break;
            case 39:
                this.enterOuterAlt(localContext, 39);
                {
                this.state = 2052;
                this.match(CPP14Parser.LeftBracket);
                this.state = 2053;
                this.match(CPP14Parser.RightBracket);
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
    public literal(): LiteralContext {
        let localContext = new LiteralContext(this.context, this.state);
        this.enterRule(localContext, 380, CPP14Parser.RULE_literal);
        let _la: number;
        try {
            this.enterOuterAlt(localContext, 1);
            {
            this.state = 2056;
            _la = this.tokenStream.LA(1);
            if(!((((_la) & ~0x1F) === 0 && ((1 << _la) & 254) !== 0))) {
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

    public override sempred(localContext: antlr.ParserRuleContext | null, ruleIndex: number, predIndex: number): boolean {
        switch (ruleIndex) {
        case 5:
            return this.nestedNameSpecifier_sempred(localContext as NestedNameSpecifierContext, predIndex);
        case 15:
            return this.postfixExpression_sempred(localContext as PostfixExpressionContext, predIndex);
        case 25:
            return this.noPointerNewDeclarator_sempred(localContext as NoPointerNewDeclaratorContext, predIndex);
        case 115:
            return this.noPointerDeclarator_sempred(localContext as NoPointerDeclaratorContext, predIndex);
        }
        return true;
    }
    private nestedNameSpecifier_sempred(localContext: NestedNameSpecifierContext | null, predIndex: number): boolean {
        switch (predIndex) {
        case 0:
            return this.precpred(this.context, 1);
        }
        return true;
    }
    private postfixExpression_sempred(localContext: PostfixExpressionContext | null, predIndex: number): boolean {
        switch (predIndex) {
        case 1:
            return this.precpred(this.context, 7);
        case 2:
            return this.precpred(this.context, 6);
        case 3:
            return this.precpred(this.context, 4);
        case 4:
            return this.precpred(this.context, 3);
        }
        return true;
    }
    private noPointerNewDeclarator_sempred(localContext: NoPointerNewDeclaratorContext | null, predIndex: number): boolean {
        switch (predIndex) {
        case 5:
            return this.precpred(this.context, 1);
        }
        return true;
    }
    private noPointerDeclarator_sempred(localContext: NoPointerDeclaratorContext | null, predIndex: number): boolean {
        switch (predIndex) {
        case 6:
            return this.precpred(this.context, 2);
        }
        return true;
    }

    public static readonly _serializedATN: number[] = [
        4,1,145,2059,2,0,7,0,2,1,7,1,2,2,7,2,2,3,7,3,2,4,7,4,2,5,7,5,2,6,
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
        85,7,85,2,86,7,86,2,87,7,87,2,88,7,88,2,89,7,89,2,90,7,90,2,91,7,
        91,2,92,7,92,2,93,7,93,2,94,7,94,2,95,7,95,2,96,7,96,2,97,7,97,2,
        98,7,98,2,99,7,99,2,100,7,100,2,101,7,101,2,102,7,102,2,103,7,103,
        2,104,7,104,2,105,7,105,2,106,7,106,2,107,7,107,2,108,7,108,2,109,
        7,109,2,110,7,110,2,111,7,111,2,112,7,112,2,113,7,113,2,114,7,114,
        2,115,7,115,2,116,7,116,2,117,7,117,2,118,7,118,2,119,7,119,2,120,
        7,120,2,121,7,121,2,122,7,122,2,123,7,123,2,124,7,124,2,125,7,125,
        2,126,7,126,2,127,7,127,2,128,7,128,2,129,7,129,2,130,7,130,2,131,
        7,131,2,132,7,132,2,133,7,133,2,134,7,134,2,135,7,135,2,136,7,136,
        2,137,7,137,2,138,7,138,2,139,7,139,2,140,7,140,2,141,7,141,2,142,
        7,142,2,143,7,143,2,144,7,144,2,145,7,145,2,146,7,146,2,147,7,147,
        2,148,7,148,2,149,7,149,2,150,7,150,2,151,7,151,2,152,7,152,2,153,
        7,153,2,154,7,154,2,155,7,155,2,156,7,156,2,157,7,157,2,158,7,158,
        2,159,7,159,2,160,7,160,2,161,7,161,2,162,7,162,2,163,7,163,2,164,
        7,164,2,165,7,165,2,166,7,166,2,167,7,167,2,168,7,168,2,169,7,169,
        2,170,7,170,2,171,7,171,2,172,7,172,2,173,7,173,2,174,7,174,2,175,
        7,175,2,176,7,176,2,177,7,177,2,178,7,178,2,179,7,179,2,180,7,180,
        2,181,7,181,2,182,7,182,2,183,7,183,2,184,7,184,2,185,7,185,2,186,
        7,186,2,187,7,187,2,188,7,188,2,189,7,189,2,190,7,190,1,0,3,0,384,
        8,0,1,0,1,0,1,1,4,1,389,8,1,11,1,12,1,390,1,1,1,1,1,1,1,1,1,1,1,
        1,1,1,3,1,400,8,1,1,2,1,2,3,2,404,8,2,1,3,1,3,1,3,1,3,1,3,1,3,1,
        3,3,3,413,8,3,1,3,3,3,416,8,3,1,4,1,4,3,4,420,8,4,1,4,1,4,1,5,1,
        5,1,5,1,5,3,5,428,8,5,1,5,1,5,1,5,1,5,1,5,3,5,435,8,5,1,5,3,5,438,
        8,5,1,5,5,5,441,8,5,10,5,12,5,444,9,5,1,6,1,6,3,6,448,8,6,1,6,1,
        6,1,7,1,7,3,7,454,8,7,1,7,1,7,1,8,1,8,1,8,1,8,3,8,462,8,8,3,8,464,
        8,8,1,9,1,9,1,10,1,10,1,10,5,10,471,8,10,10,10,12,10,474,9,10,1,
        10,3,10,477,8,10,1,11,1,11,3,11,481,8,11,1,12,3,12,484,8,12,1,12,
        1,12,3,12,488,8,12,1,13,3,13,491,8,13,1,13,1,13,1,13,1,14,1,14,3,
        14,498,8,14,1,14,1,14,3,14,502,8,14,1,14,3,14,505,8,14,1,14,3,14,
        508,8,14,1,14,3,14,511,8,14,1,15,1,15,1,15,1,15,3,15,517,8,15,1,
        15,1,15,3,15,521,8,15,1,15,1,15,3,15,525,8,15,1,15,1,15,1,15,1,15,
        1,15,1,15,1,15,1,15,1,15,1,15,1,15,1,15,3,15,539,8,15,1,15,1,15,
        3,15,543,8,15,1,15,1,15,1,15,1,15,3,15,549,8,15,1,15,1,15,1,15,1,
        15,1,15,3,15,556,8,15,1,15,1,15,1,15,1,15,3,15,562,8,15,1,15,1,15,
        3,15,566,8,15,1,15,1,15,5,15,570,8,15,10,15,12,15,573,9,15,1,16,
        1,16,1,17,1,17,1,18,3,18,580,8,18,1,18,1,18,1,18,3,18,585,8,18,1,
        18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,1,18,3,18,598,8,
        18,1,19,1,19,1,19,1,19,1,19,3,19,605,8,19,1,19,1,19,1,19,1,19,1,
        19,1,19,1,19,1,19,1,19,1,19,3,19,617,8,19,1,19,1,19,1,19,1,19,1,
        19,1,19,1,19,1,19,3,19,627,8,19,1,20,1,20,1,21,3,21,632,8,21,1,21,
        1,21,3,21,636,8,21,1,21,1,21,1,21,1,21,1,21,3,21,643,8,21,1,21,3,
        21,646,8,21,1,22,1,22,1,22,1,22,1,23,1,23,3,23,654,8,23,1,24,1,24,
        3,24,658,8,24,1,24,3,24,661,8,24,1,25,1,25,1,25,1,25,1,25,3,25,668,
        8,25,1,25,1,25,1,25,1,25,1,25,3,25,675,8,25,5,25,677,8,25,10,25,
        12,25,680,9,25,1,26,1,26,3,26,684,8,26,1,26,1,26,3,26,688,8,26,1,
        27,3,27,691,8,27,1,27,1,27,1,27,3,27,696,8,27,1,27,1,27,1,28,1,28,
        1,28,1,28,1,28,1,29,1,29,1,29,1,29,1,29,1,29,3,29,711,8,29,1,30,
        1,30,1,30,5,30,716,8,30,10,30,12,30,719,9,30,1,31,1,31,1,31,5,31,
        724,8,31,10,31,12,31,727,9,31,1,32,1,32,1,32,5,32,732,8,32,10,32,
        12,32,735,9,32,1,33,1,33,1,33,1,33,5,33,741,8,33,10,33,12,33,744,
        9,33,1,34,1,34,1,34,1,34,3,34,750,8,34,1,35,1,35,1,35,5,35,755,8,
        35,10,35,12,35,758,9,35,1,36,1,36,1,36,5,36,763,8,36,10,36,12,36,
        766,9,36,1,37,1,37,1,37,5,37,771,8,37,10,37,12,37,774,9,37,1,38,
        1,38,1,38,5,38,779,8,38,10,38,12,38,782,9,38,1,39,1,39,1,39,5,39,
        787,8,39,10,39,12,39,790,9,39,1,40,1,40,1,40,5,40,795,8,40,10,40,
        12,40,798,9,40,1,41,1,41,1,41,5,41,803,8,41,10,41,12,41,806,9,41,
        1,42,1,42,1,42,1,42,1,42,1,42,3,42,814,8,42,1,43,1,43,1,43,1,43,
        1,43,1,43,3,43,822,8,43,1,44,1,44,1,45,1,45,1,45,5,45,829,8,45,10,
        45,12,45,832,9,45,1,46,1,46,1,47,1,47,1,47,3,47,839,8,47,1,47,1,
        47,1,47,1,47,1,47,1,47,3,47,847,8,47,3,47,849,8,47,1,48,3,48,852,
        8,48,1,48,1,48,1,48,1,48,3,48,858,8,48,1,48,1,48,1,48,1,49,3,49,
        864,8,49,1,49,1,49,1,50,1,50,3,50,870,8,50,1,50,1,50,1,51,4,51,875,
        8,51,11,51,12,51,876,1,52,1,52,1,52,1,52,1,52,1,52,1,52,3,52,886,
        8,52,1,52,1,52,1,52,1,52,1,52,1,52,3,52,894,8,52,1,53,1,53,3,53,
        898,8,53,1,53,1,53,1,53,1,53,1,53,3,53,905,8,53,3,53,907,8,53,1,
        54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,54,1,
        54,1,54,1,54,1,54,1,54,3,54,927,8,54,1,54,1,54,3,54,931,8,54,1,54,
        1,54,1,54,1,54,3,54,937,8,54,1,54,1,54,1,54,3,54,942,8,54,1,55,1,
        55,3,55,946,8,55,1,56,3,56,949,8,56,1,56,1,56,1,56,1,57,1,57,3,57,
        956,8,57,1,58,1,58,1,58,1,58,1,58,3,58,963,8,58,1,58,1,58,3,58,967,
        8,58,1,58,1,58,1,59,1,59,1,60,4,60,974,8,60,11,60,12,60,975,1,61,
        1,61,1,61,1,61,1,61,1,61,1,61,1,61,1,61,3,61,987,8,61,1,62,1,62,
        1,62,1,62,1,62,1,62,1,62,1,62,3,62,997,8,62,1,63,1,63,1,63,3,63,
        1002,8,63,1,63,1,63,1,63,1,63,1,64,3,64,1009,8,64,1,64,3,64,1012,
        8,64,1,64,1,64,1,64,3,64,1017,8,64,1,64,1,64,1,64,3,64,1022,8,64,
        1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,65,1,66,1,66,1,67,1,67,1,67,
        1,68,1,68,1,68,1,68,1,68,1,68,3,68,1043,8,68,1,69,4,69,1046,8,69,
        11,69,12,69,1047,1,69,3,69,1051,8,69,1,70,1,70,1,71,1,71,1,72,1,
        72,1,73,1,73,1,73,3,73,1062,8,73,1,74,1,74,1,74,1,74,3,74,1068,8,
        74,1,75,4,75,1071,8,75,11,75,12,75,1072,1,75,3,75,1076,8,75,1,76,
        4,76,1079,8,76,11,76,12,76,1080,1,76,3,76,1084,8,76,1,77,1,77,1,
        78,1,78,1,79,3,79,1091,8,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,
        79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,79,1,
        79,3,79,1114,8,79,1,80,1,80,1,80,1,80,3,80,1120,8,80,1,81,1,81,1,
        81,1,81,3,81,1126,8,81,1,81,1,81,1,82,1,82,3,82,1132,8,82,1,82,3,
        82,1135,8,82,1,82,1,82,1,82,1,82,3,82,1141,8,82,1,82,1,82,3,82,1145,
        8,82,1,82,1,82,3,82,1149,8,82,1,82,3,82,1152,8,82,1,83,1,83,1,84,
        1,84,1,84,1,84,3,84,1160,8,84,3,84,1162,8,84,1,84,1,84,1,85,1,85,
        3,85,1168,8,85,1,85,3,85,1171,8,85,1,85,3,85,1174,8,85,1,85,3,85,
        1177,8,85,1,86,1,86,3,86,1181,8,86,1,86,1,86,3,86,1185,8,86,1,86,
        1,86,1,87,1,87,3,87,1191,8,87,1,88,1,88,1,88,1,89,1,89,1,89,5,89,
        1199,8,89,10,89,12,89,1202,9,89,1,90,1,90,1,90,3,90,1207,8,90,1,
        91,1,91,1,92,1,92,3,92,1213,8,92,1,93,1,93,1,94,3,94,1218,8,94,1,
        94,1,94,1,94,3,94,1223,8,94,1,94,1,94,3,94,1227,8,94,1,94,1,94,1,
        95,1,95,1,96,1,96,1,96,1,96,1,96,1,96,1,97,3,97,1240,8,97,1,97,1,
        97,1,98,1,98,3,98,1246,8,98,1,98,1,98,3,98,1250,8,98,1,98,1,98,1,
        98,1,99,3,99,1256,8,99,1,99,1,99,1,99,3,99,1261,8,99,1,99,1,99,1,
        99,1,100,1,100,1,100,1,100,1,100,1,100,1,101,1,101,1,101,1,101,3,
        101,1276,8,101,1,101,1,101,3,101,1280,8,101,1,102,4,102,1283,8,102,
        11,102,12,102,1284,1,103,1,103,1,103,3,103,1290,8,103,1,103,1,103,
        1,103,3,103,1295,8,103,1,104,1,104,1,104,1,104,3,104,1301,8,104,
        1,104,3,104,1304,8,104,1,104,1,104,1,105,1,105,1,105,5,105,1311,
        8,105,10,105,12,105,1314,9,105,1,105,3,105,1317,8,105,1,106,1,106,
        1,106,3,106,1322,8,106,1,106,1,106,3,106,1326,8,106,1,107,1,107,
        1,108,1,108,3,108,1332,8,108,1,108,1,108,1,109,4,109,1337,8,109,
        11,109,12,109,1338,1,110,1,110,1,110,1,110,1,110,1,110,1,110,1,110,
        1,110,1,110,1,110,1,110,1,110,4,110,1354,8,110,11,110,12,110,1355,
        3,110,1358,8,110,1,111,1,111,1,111,5,111,1363,8,111,10,111,12,111,
        1366,9,111,1,112,1,112,3,112,1370,8,112,1,113,1,113,1,113,1,113,
        1,113,3,113,1377,8,113,1,114,1,114,3,114,1381,8,114,5,114,1383,8,
        114,10,114,12,114,1386,9,114,1,114,1,114,1,115,1,115,1,115,3,115,
        1393,8,115,1,115,1,115,1,115,1,115,3,115,1399,8,115,1,115,1,115,
        1,115,1,115,3,115,1405,8,115,1,115,1,115,3,115,1409,8,115,3,115,
        1411,8,115,5,115,1413,8,115,10,115,12,115,1416,9,115,1,116,1,116,
        3,116,1420,8,116,1,116,1,116,3,116,1424,8,116,1,116,3,116,1427,8,
        116,1,116,3,116,1430,8,116,1,116,3,116,1433,8,116,1,117,1,117,1,
        117,3,117,1438,8,117,1,118,1,118,3,118,1442,8,118,1,118,3,118,1445,
        8,118,1,118,1,118,3,118,1449,8,118,1,118,3,118,1452,8,118,3,118,
        1454,8,118,1,119,4,119,1457,8,119,11,119,12,119,1458,1,120,1,120,
        1,121,1,121,1,122,3,122,1466,8,122,1,122,1,122,1,123,1,123,3,123,
        1472,8,123,1,124,1,124,3,124,1476,8,124,1,124,1,124,1,124,1,124,
        3,124,1482,8,124,1,125,5,125,1485,8,125,10,125,12,125,1488,9,125,
        1,125,1,125,3,125,1492,8,125,1,126,1,126,1,126,1,126,1,126,3,126,
        1499,8,126,1,126,1,126,1,126,3,126,1504,8,126,1,126,1,126,3,126,
        1508,8,126,5,126,1510,8,126,10,126,12,126,1513,9,126,1,127,5,127,
        1516,8,127,10,127,12,127,1519,9,127,1,127,1,127,1,128,1,128,1,128,
        1,128,3,128,1527,8,128,1,128,1,128,3,128,1531,8,128,5,128,1533,8,
        128,10,128,12,128,1536,9,128,1,129,1,129,3,129,1540,8,129,1,129,
        3,129,1543,8,129,1,130,1,130,1,130,5,130,1548,8,130,10,130,12,130,
        1551,9,130,1,131,3,131,1554,8,131,1,131,1,131,1,131,3,131,1559,8,
        131,3,131,1561,8,131,1,131,1,131,3,131,1565,8,131,1,132,3,132,1568,
        8,132,1,132,3,132,1571,8,132,1,132,1,132,3,132,1575,8,132,1,132,
        1,132,1,133,3,133,1580,8,133,1,133,1,133,1,133,1,133,1,133,3,133,
        1587,8,133,1,134,1,134,1,134,1,134,1,134,3,134,1594,8,134,1,135,
        1,135,1,135,3,135,1599,8,135,1,136,1,136,3,136,1603,8,136,1,137,
        1,137,3,137,1607,8,137,1,137,1,137,1,137,3,137,1612,8,137,5,137,
        1614,8,137,10,137,12,137,1617,9,137,1,138,1,138,1,138,3,138,1622,
        8,138,3,138,1624,8,138,1,138,1,138,1,139,1,139,3,139,1630,8,139,
        1,140,1,140,1,140,3,140,1635,8,140,1,140,1,140,1,141,1,141,3,141,
        1641,8,141,1,141,1,141,3,141,1645,8,141,3,141,1647,8,141,1,141,3,
        141,1650,8,141,1,141,1,141,3,141,1654,8,141,1,141,1,141,3,141,1658,
        8,141,3,141,1660,8,141,3,141,1662,8,141,1,142,3,142,1665,8,142,1,
        142,1,142,1,143,1,143,1,144,1,144,1,145,1,145,1,145,1,145,4,145,
        1677,8,145,11,145,12,145,1678,1,146,3,146,1682,8,146,1,146,3,146,
        1685,8,146,1,146,3,146,1688,8,146,1,146,1,146,1,146,1,146,1,146,
        1,146,1,146,3,146,1697,8,146,1,147,1,147,1,147,5,147,1702,8,147,
        10,147,12,147,1705,9,147,1,148,1,148,1,148,3,148,1710,8,148,1,148,
        1,148,3,148,1714,8,148,1,148,3,148,1717,8,148,1,148,3,148,1720,8,
        148,1,148,1,148,3,148,1724,8,148,1,149,4,149,1727,8,149,11,149,12,
        149,1728,1,150,1,150,1,151,1,151,1,151,1,152,1,152,1,152,1,153,1,
        153,3,153,1741,8,153,1,153,1,153,1,153,3,153,1746,8,153,5,153,1748,
        8,153,10,153,12,153,1751,9,153,1,154,3,154,1754,8,154,1,154,1,154,
        1,154,3,154,1759,8,154,1,154,1,154,1,154,3,154,1764,8,154,1,154,
        1,154,3,154,1768,8,154,1,155,3,155,1771,8,155,1,155,1,155,3,155,
        1775,8,155,1,156,1,156,1,157,1,157,1,158,1,158,1,158,1,159,1,159,
        3,159,1786,8,159,1,160,1,160,3,160,1790,8,160,1,161,1,161,1,161,
        1,162,1,162,3,162,1797,8,162,1,162,1,162,1,162,3,162,1802,8,162,
        5,162,1804,8,162,10,162,12,162,1807,9,162,1,163,1,163,1,163,3,163,
        1812,8,163,1,163,1,163,3,163,1816,8,163,1,164,1,164,3,164,1820,8,
        164,1,165,1,165,1,165,1,166,1,166,1,166,1,166,3,166,1829,8,166,1,
        167,1,167,1,167,1,167,1,167,1,167,1,168,1,168,1,168,5,168,1840,8,
        168,10,168,12,168,1843,9,168,1,169,1,169,3,169,1847,8,169,1,170,
        1,170,1,170,1,170,1,170,3,170,1854,8,170,1,170,1,170,3,170,1858,
        8,170,1,170,3,170,1861,8,170,1,170,3,170,1864,8,170,1,170,3,170,
        1867,8,170,1,170,1,170,3,170,1871,8,170,1,171,1,171,1,171,3,171,
        1876,8,171,1,171,1,171,1,172,1,172,1,172,3,172,1883,8,172,1,172,
        1,172,3,172,1887,8,172,1,172,1,172,3,172,1891,8,172,1,173,1,173,
        1,174,1,174,3,174,1897,8,174,1,174,1,174,1,174,3,174,1902,8,174,
        5,174,1904,8,174,10,174,12,174,1907,9,174,1,175,1,175,1,175,3,175,
        1912,8,175,1,176,1,176,1,176,1,176,3,176,1918,8,176,1,176,3,176,
        1921,8,176,1,177,3,177,1924,8,177,1,177,1,177,1,177,1,178,1,178,
        1,178,1,178,1,178,1,179,1,179,1,179,1,179,1,180,1,180,3,180,1940,
        8,180,1,180,1,180,1,180,1,181,4,181,1946,8,181,11,181,12,181,1947,
        1,182,1,182,1,182,1,182,1,182,1,182,1,183,3,183,1957,8,183,1,183,
        1,183,1,183,3,183,1962,8,183,1,183,3,183,1965,8,183,1,184,1,184,
        3,184,1969,8,184,1,185,1,185,3,185,1973,8,185,1,186,1,186,1,186,
        3,186,1978,8,186,1,186,1,186,1,187,1,187,3,187,1984,8,187,1,187,
        1,187,1,187,3,187,1989,8,187,5,187,1991,8,187,10,187,12,187,1994,
        9,187,1,188,1,188,1,188,1,188,1,188,1,188,3,188,2002,8,188,1,189,
        1,189,1,189,3,189,2007,8,189,1,189,1,189,1,189,3,189,2012,8,189,
        1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,
        1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,
        1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,
        1,189,1,189,1,189,1,189,1,189,1,189,1,189,1,189,3,189,2055,8,189,
        1,190,1,190,1,190,1,1047,4,10,30,50,230,191,0,2,4,6,8,10,12,14,16,
        18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58,60,
        62,64,66,68,70,72,74,76,78,80,82,84,86,88,90,92,94,96,98,100,102,
        104,106,108,110,112,114,116,118,120,122,124,126,128,130,132,134,
        136,138,140,142,144,146,148,150,152,154,156,158,160,162,164,166,
        168,170,172,174,176,178,180,182,184,186,188,190,192,194,196,198,
        200,202,204,206,208,210,212,214,216,218,220,222,224,226,228,230,
        232,234,236,238,240,242,244,246,248,250,252,254,256,258,260,262,
        264,266,268,270,272,274,276,278,280,282,284,286,288,290,292,294,
        296,298,300,302,304,306,308,310,312,314,316,318,320,322,324,326,
        328,330,332,334,336,338,340,342,344,346,348,350,352,354,356,358,
        360,362,364,366,368,370,372,374,376,378,380,0,23,2,0,97,97,101,101,
        4,0,24,24,31,31,58,58,65,65,2,0,124,124,129,129,1,0,120,121,2,0,
        91,93,97,100,2,0,123,123,130,130,1,0,93,95,1,0,91,92,2,0,102,103,
        116,117,1,0,114,115,2,0,101,101,104,113,5,0,36,36,47,47,57,57,63,
        63,70,70,3,0,34,34,44,44,80,80,2,0,46,46,60,60,2,0,61,61,78,78,2,
        0,21,21,66,66,1,0,85,90,2,0,97,97,118,118,2,0,22,22,82,82,1,0,27,
        28,2,0,38,38,53,53,1,0,54,56,1,0,1,7,2282,0,383,1,0,0,0,2,399,1,
        0,0,0,4,403,1,0,0,0,6,415,1,0,0,0,8,417,1,0,0,0,10,423,1,0,0,0,12,
        445,1,0,0,0,14,451,1,0,0,0,16,463,1,0,0,0,18,465,1,0,0,0,20,467,
        1,0,0,0,22,480,1,0,0,0,24,487,1,0,0,0,26,490,1,0,0,0,28,495,1,0,
        0,0,30,542,1,0,0,0,32,574,1,0,0,0,34,576,1,0,0,0,36,597,1,0,0,0,
        38,626,1,0,0,0,40,628,1,0,0,0,42,631,1,0,0,0,44,647,1,0,0,0,46,651,
        1,0,0,0,48,660,1,0,0,0,50,662,1,0,0,0,52,687,1,0,0,0,54,690,1,0,
        0,0,56,699,1,0,0,0,58,710,1,0,0,0,60,712,1,0,0,0,62,720,1,0,0,0,
        64,728,1,0,0,0,66,736,1,0,0,0,68,749,1,0,0,0,70,751,1,0,0,0,72,759,
        1,0,0,0,74,767,1,0,0,0,76,775,1,0,0,0,78,783,1,0,0,0,80,791,1,0,
        0,0,82,799,1,0,0,0,84,807,1,0,0,0,86,821,1,0,0,0,88,823,1,0,0,0,
        90,825,1,0,0,0,92,833,1,0,0,0,94,848,1,0,0,0,96,851,1,0,0,0,98,863,
        1,0,0,0,100,867,1,0,0,0,102,874,1,0,0,0,104,893,1,0,0,0,106,906,
        1,0,0,0,108,941,1,0,0,0,110,945,1,0,0,0,112,948,1,0,0,0,114,955,
        1,0,0,0,116,966,1,0,0,0,118,970,1,0,0,0,120,973,1,0,0,0,122,986,
        1,0,0,0,124,996,1,0,0,0,126,998,1,0,0,0,128,1021,1,0,0,0,130,1023,
        1,0,0,0,132,1031,1,0,0,0,134,1033,1,0,0,0,136,1042,1,0,0,0,138,1045,
        1,0,0,0,140,1052,1,0,0,0,142,1054,1,0,0,0,144,1056,1,0,0,0,146,1061,
        1,0,0,0,148,1067,1,0,0,0,150,1070,1,0,0,0,152,1078,1,0,0,0,154,1085,
        1,0,0,0,156,1087,1,0,0,0,158,1113,1,0,0,0,160,1119,1,0,0,0,162,1121,
        1,0,0,0,164,1151,1,0,0,0,166,1153,1,0,0,0,168,1155,1,0,0,0,170,1165,
        1,0,0,0,172,1178,1,0,0,0,174,1188,1,0,0,0,176,1192,1,0,0,0,178,1195,
        1,0,0,0,180,1203,1,0,0,0,182,1208,1,0,0,0,184,1212,1,0,0,0,186,1214,
        1,0,0,0,188,1217,1,0,0,0,190,1230,1,0,0,0,192,1232,1,0,0,0,194,1239,
        1,0,0,0,196,1243,1,0,0,0,198,1255,1,0,0,0,200,1265,1,0,0,0,202,1271,
        1,0,0,0,204,1282,1,0,0,0,206,1294,1,0,0,0,208,1296,1,0,0,0,210,1307,
        1,0,0,0,212,1321,1,0,0,0,214,1327,1,0,0,0,216,1329,1,0,0,0,218,1336,
        1,0,0,0,220,1357,1,0,0,0,222,1359,1,0,0,0,224,1367,1,0,0,0,226,1376,
        1,0,0,0,228,1384,1,0,0,0,230,1398,1,0,0,0,232,1417,1,0,0,0,234,1434,
        1,0,0,0,236,1453,1,0,0,0,238,1456,1,0,0,0,240,1460,1,0,0,0,242,1462,
        1,0,0,0,244,1465,1,0,0,0,246,1469,1,0,0,0,248,1481,1,0,0,0,250,1486,
        1,0,0,0,252,1498,1,0,0,0,254,1517,1,0,0,0,256,1522,1,0,0,0,258,1537,
        1,0,0,0,260,1544,1,0,0,0,262,1553,1,0,0,0,264,1567,1,0,0,0,266,1586,
        1,0,0,0,268,1593,1,0,0,0,270,1598,1,0,0,0,272,1602,1,0,0,0,274,1604,
        1,0,0,0,276,1618,1,0,0,0,278,1629,1,0,0,0,280,1631,1,0,0,0,282,1661,
        1,0,0,0,284,1664,1,0,0,0,286,1668,1,0,0,0,288,1670,1,0,0,0,290,1676,
        1,0,0,0,292,1696,1,0,0,0,294,1698,1,0,0,0,296,1723,1,0,0,0,298,1726,
        1,0,0,0,300,1730,1,0,0,0,302,1732,1,0,0,0,304,1735,1,0,0,0,306,1738,
        1,0,0,0,308,1753,1,0,0,0,310,1774,1,0,0,0,312,1776,1,0,0,0,314,1778,
        1,0,0,0,316,1780,1,0,0,0,318,1783,1,0,0,0,320,1787,1,0,0,0,322,1791,
        1,0,0,0,324,1794,1,0,0,0,326,1808,1,0,0,0,328,1819,1,0,0,0,330,1821,
        1,0,0,0,332,1824,1,0,0,0,334,1830,1,0,0,0,336,1836,1,0,0,0,338,1846,
        1,0,0,0,340,1857,1,0,0,0,342,1872,1,0,0,0,344,1890,1,0,0,0,346,1892,
        1,0,0,0,348,1894,1,0,0,0,350,1911,1,0,0,0,352,1913,1,0,0,0,354,1923,
        1,0,0,0,356,1928,1,0,0,0,358,1933,1,0,0,0,360,1937,1,0,0,0,362,1945,
        1,0,0,0,364,1949,1,0,0,0,366,1964,1,0,0,0,368,1966,1,0,0,0,370,1972,
        1,0,0,0,372,1974,1,0,0,0,374,1981,1,0,0,0,376,2001,1,0,0,0,378,2054,
        1,0,0,0,380,2056,1,0,0,0,382,384,3,120,60,0,383,382,1,0,0,0,383,
        384,1,0,0,0,384,385,1,0,0,0,385,386,5,0,0,1,386,1,1,0,0,0,387,389,
        3,380,190,0,388,387,1,0,0,0,389,390,1,0,0,0,390,388,1,0,0,0,390,
        391,1,0,0,0,391,400,1,0,0,0,392,400,5,69,0,0,393,394,5,85,0,0,394,
        395,3,90,45,0,395,396,5,86,0,0,396,400,1,0,0,0,397,400,3,4,2,0,398,
        400,3,12,6,0,399,388,1,0,0,0,399,392,1,0,0,0,399,393,1,0,0,0,399,
        397,1,0,0,0,399,398,1,0,0,0,400,3,1,0,0,0,401,404,3,6,3,0,402,404,
        3,8,4,0,403,401,1,0,0,0,403,402,1,0,0,0,404,5,1,0,0,0,405,416,5,
        132,0,0,406,416,3,330,165,0,407,416,3,316,158,0,408,416,3,332,166,
        0,409,412,5,99,0,0,410,413,3,278,139,0,411,413,3,162,81,0,412,410,
        1,0,0,0,412,411,1,0,0,0,413,416,1,0,0,0,414,416,3,344,172,0,415,
        405,1,0,0,0,415,406,1,0,0,0,415,407,1,0,0,0,415,408,1,0,0,0,415,
        409,1,0,0,0,415,414,1,0,0,0,416,7,1,0,0,0,417,419,3,10,5,0,418,420,
        5,68,0,0,419,418,1,0,0,0,419,420,1,0,0,0,420,421,1,0,0,0,421,422,
        3,6,3,0,422,9,1,0,0,0,423,427,6,5,-1,0,424,428,3,160,80,0,425,428,
        3,184,92,0,426,428,3,162,81,0,427,424,1,0,0,0,427,425,1,0,0,0,427,
        426,1,0,0,0,427,428,1,0,0,0,428,429,1,0,0,0,429,430,5,127,0,0,430,
        442,1,0,0,0,431,437,10,1,0,0,432,438,5,132,0,0,433,435,5,68,0,0,
        434,433,1,0,0,0,434,435,1,0,0,0,435,436,1,0,0,0,436,438,3,342,171,
        0,437,432,1,0,0,0,437,434,1,0,0,0,438,439,1,0,0,0,439,441,5,127,
        0,0,440,431,1,0,0,0,441,444,1,0,0,0,442,440,1,0,0,0,442,443,1,0,
        0,0,443,11,1,0,0,0,444,442,1,0,0,0,445,447,3,14,7,0,446,448,3,28,
        14,0,447,446,1,0,0,0,447,448,1,0,0,0,448,449,1,0,0,0,449,450,3,100,
        50,0,450,13,1,0,0,0,451,453,5,87,0,0,452,454,3,16,8,0,453,452,1,
        0,0,0,453,454,1,0,0,0,454,455,1,0,0,0,455,456,5,88,0,0,456,15,1,
        0,0,0,457,464,3,20,10,0,458,461,3,18,9,0,459,460,5,122,0,0,460,462,
        3,20,10,0,461,459,1,0,0,0,461,462,1,0,0,0,462,464,1,0,0,0,463,457,
        1,0,0,0,463,458,1,0,0,0,464,17,1,0,0,0,465,466,7,0,0,0,466,19,1,
        0,0,0,467,472,3,22,11,0,468,469,5,122,0,0,469,471,3,22,11,0,470,
        468,1,0,0,0,471,474,1,0,0,0,472,470,1,0,0,0,472,473,1,0,0,0,473,
        476,1,0,0,0,474,472,1,0,0,0,475,477,5,131,0,0,476,475,1,0,0,0,476,
        477,1,0,0,0,477,21,1,0,0,0,478,481,3,24,12,0,479,481,3,26,13,0,480,
        478,1,0,0,0,480,479,1,0,0,0,481,23,1,0,0,0,482,484,5,97,0,0,483,
        482,1,0,0,0,483,484,1,0,0,0,484,485,1,0,0,0,485,488,5,132,0,0,486,
        488,5,69,0,0,487,483,1,0,0,0,487,486,1,0,0,0,488,25,1,0,0,0,489,
        491,5,97,0,0,490,489,1,0,0,0,490,491,1,0,0,0,491,492,1,0,0,0,492,
        493,5,132,0,0,493,494,3,268,134,0,494,27,1,0,0,0,495,497,5,85,0,
        0,496,498,3,258,129,0,497,496,1,0,0,0,497,498,1,0,0,0,498,499,1,
        0,0,0,499,501,5,86,0,0,500,502,5,47,0,0,501,500,1,0,0,0,501,502,
        1,0,0,0,502,504,1,0,0,0,503,505,3,370,185,0,504,503,1,0,0,0,504,
        505,1,0,0,0,505,507,1,0,0,0,506,508,3,204,102,0,507,506,1,0,0,0,
        507,508,1,0,0,0,508,510,1,0,0,0,509,511,3,234,117,0,510,509,1,0,
        0,0,510,511,1,0,0,0,511,29,1,0,0,0,512,513,6,15,-1,0,513,543,3,2,
        1,0,514,517,3,158,79,0,515,517,3,352,176,0,516,514,1,0,0,0,516,515,
        1,0,0,0,517,524,1,0,0,0,518,520,5,85,0,0,519,521,3,34,17,0,520,519,
        1,0,0,0,520,521,1,0,0,0,521,522,1,0,0,0,522,525,5,86,0,0,523,525,
        3,276,138,0,524,518,1,0,0,0,524,523,1,0,0,0,525,543,1,0,0,0,526,
        527,7,1,0,0,527,528,5,102,0,0,528,529,3,246,123,0,529,530,5,103,
        0,0,530,531,5,85,0,0,531,532,3,90,45,0,532,533,5,86,0,0,533,543,
        1,0,0,0,534,535,3,32,16,0,535,538,5,85,0,0,536,539,3,90,45,0,537,
        539,3,246,123,0,538,536,1,0,0,0,538,537,1,0,0,0,539,540,1,0,0,0,
        540,541,5,86,0,0,541,543,1,0,0,0,542,512,1,0,0,0,542,516,1,0,0,0,
        542,526,1,0,0,0,542,534,1,0,0,0,543,571,1,0,0,0,544,545,10,7,0,0,
        545,548,5,87,0,0,546,549,3,90,45,0,547,549,3,276,138,0,548,546,1,
        0,0,0,548,547,1,0,0,0,549,550,1,0,0,0,550,551,5,88,0,0,551,570,1,
        0,0,0,552,553,10,6,0,0,553,555,5,85,0,0,554,556,3,34,17,0,555,554,
        1,0,0,0,555,556,1,0,0,0,556,557,1,0,0,0,557,570,5,86,0,0,558,559,
        10,4,0,0,559,565,7,2,0,0,560,562,5,68,0,0,561,560,1,0,0,0,561,562,
        1,0,0,0,562,563,1,0,0,0,563,566,3,4,2,0,564,566,3,36,18,0,565,561,
        1,0,0,0,565,564,1,0,0,0,566,570,1,0,0,0,567,568,10,3,0,0,568,570,
        7,3,0,0,569,544,1,0,0,0,569,552,1,0,0,0,569,558,1,0,0,0,569,567,
        1,0,0,0,570,573,1,0,0,0,571,569,1,0,0,0,571,572,1,0,0,0,572,31,1,
        0,0,0,573,571,1,0,0,0,574,575,5,75,0,0,575,33,1,0,0,0,576,577,3,
        274,137,0,577,35,1,0,0,0,578,580,3,10,5,0,579,578,1,0,0,0,579,580,
        1,0,0,0,580,584,1,0,0,0,581,582,3,160,80,0,582,583,5,127,0,0,583,
        585,1,0,0,0,584,581,1,0,0,0,584,585,1,0,0,0,585,586,1,0,0,0,586,
        587,5,99,0,0,587,598,3,160,80,0,588,589,3,10,5,0,589,590,5,68,0,
        0,590,591,3,342,171,0,591,592,5,127,0,0,592,593,5,99,0,0,593,594,
        3,160,80,0,594,598,1,0,0,0,595,596,5,99,0,0,596,598,3,162,81,0,597,
        579,1,0,0,0,597,588,1,0,0,0,597,595,1,0,0,0,598,37,1,0,0,0,599,627,
        3,30,15,0,600,605,5,120,0,0,601,605,5,121,0,0,602,605,3,40,20,0,
        603,605,5,62,0,0,604,600,1,0,0,0,604,601,1,0,0,0,604,602,1,0,0,0,
        604,603,1,0,0,0,605,606,1,0,0,0,606,627,3,38,19,0,607,616,5,62,0,
        0,608,609,5,85,0,0,609,610,3,246,123,0,610,611,5,86,0,0,611,617,
        1,0,0,0,612,613,5,131,0,0,613,614,5,85,0,0,614,615,5,132,0,0,615,
        617,5,86,0,0,616,608,1,0,0,0,616,612,1,0,0,0,617,627,1,0,0,0,618,
        619,5,11,0,0,619,620,5,85,0,0,620,621,3,246,123,0,621,622,5,86,0,
        0,622,627,1,0,0,0,623,627,3,56,28,0,624,627,3,42,21,0,625,627,3,
        54,27,0,626,599,1,0,0,0,626,604,1,0,0,0,626,607,1,0,0,0,626,618,
        1,0,0,0,626,623,1,0,0,0,626,624,1,0,0,0,626,625,1,0,0,0,627,39,1,
        0,0,0,628,629,7,4,0,0,629,41,1,0,0,0,630,632,5,127,0,0,631,630,1,
        0,0,0,631,632,1,0,0,0,632,633,1,0,0,0,633,635,5,49,0,0,634,636,3,
        44,22,0,635,634,1,0,0,0,635,636,1,0,0,0,636,642,1,0,0,0,637,643,
        3,46,23,0,638,639,5,85,0,0,639,640,3,246,123,0,640,641,5,86,0,0,
        641,643,1,0,0,0,642,637,1,0,0,0,642,638,1,0,0,0,643,645,1,0,0,0,
        644,646,3,52,26,0,645,644,1,0,0,0,645,646,1,0,0,0,646,43,1,0,0,0,
        647,648,5,85,0,0,648,649,3,34,17,0,649,650,5,86,0,0,650,45,1,0,0,
        0,651,653,3,150,75,0,652,654,3,48,24,0,653,652,1,0,0,0,653,654,1,
        0,0,0,654,47,1,0,0,0,655,657,3,236,118,0,656,658,3,48,24,0,657,656,
        1,0,0,0,657,658,1,0,0,0,658,661,1,0,0,0,659,661,3,50,25,0,660,655,
        1,0,0,0,660,659,1,0,0,0,661,49,1,0,0,0,662,663,6,25,-1,0,663,664,
        5,87,0,0,664,665,3,90,45,0,665,667,5,88,0,0,666,668,3,204,102,0,
        667,666,1,0,0,0,667,668,1,0,0,0,668,678,1,0,0,0,669,670,10,1,0,0,
        670,671,5,87,0,0,671,672,3,92,46,0,672,674,5,88,0,0,673,675,3,204,
        102,0,674,673,1,0,0,0,674,675,1,0,0,0,675,677,1,0,0,0,676,669,1,
        0,0,0,677,680,1,0,0,0,678,676,1,0,0,0,678,679,1,0,0,0,679,51,1,0,
        0,0,680,678,1,0,0,0,681,683,5,85,0,0,682,684,3,34,17,0,683,682,1,
        0,0,0,683,684,1,0,0,0,684,685,1,0,0,0,685,688,5,86,0,0,686,688,3,
        276,138,0,687,681,1,0,0,0,687,686,1,0,0,0,688,53,1,0,0,0,689,691,
        5,127,0,0,690,689,1,0,0,0,690,691,1,0,0,0,691,692,1,0,0,0,692,695,
        5,28,0,0,693,694,5,87,0,0,694,696,5,88,0,0,695,693,1,0,0,0,695,696,
        1,0,0,0,696,697,1,0,0,0,697,698,3,58,29,0,698,55,1,0,0,0,699,700,
        5,50,0,0,700,701,5,85,0,0,701,702,3,90,45,0,702,703,5,86,0,0,703,
        57,1,0,0,0,704,711,3,38,19,0,705,706,5,85,0,0,706,707,3,246,123,
        0,707,708,5,86,0,0,708,709,3,58,29,0,709,711,1,0,0,0,710,704,1,0,
        0,0,710,705,1,0,0,0,711,59,1,0,0,0,712,717,3,58,29,0,713,714,7,5,
        0,0,714,716,3,58,29,0,715,713,1,0,0,0,716,719,1,0,0,0,717,715,1,
        0,0,0,717,718,1,0,0,0,718,61,1,0,0,0,719,717,1,0,0,0,720,725,3,60,
        30,0,721,722,7,6,0,0,722,724,3,60,30,0,723,721,1,0,0,0,724,727,1,
        0,0,0,725,723,1,0,0,0,725,726,1,0,0,0,726,63,1,0,0,0,727,725,1,0,
        0,0,728,733,3,62,31,0,729,730,7,7,0,0,730,732,3,62,31,0,731,729,
        1,0,0,0,732,735,1,0,0,0,733,731,1,0,0,0,733,734,1,0,0,0,734,65,1,
        0,0,0,735,733,1,0,0,0,736,742,3,64,32,0,737,738,3,68,34,0,738,739,
        3,64,32,0,739,741,1,0,0,0,740,737,1,0,0,0,741,744,1,0,0,0,742,740,
        1,0,0,0,742,743,1,0,0,0,743,67,1,0,0,0,744,742,1,0,0,0,745,746,5,
        103,0,0,746,750,5,103,0,0,747,748,5,102,0,0,748,750,5,102,0,0,749,
        745,1,0,0,0,749,747,1,0,0,0,750,69,1,0,0,0,751,756,3,66,33,0,752,
        753,7,8,0,0,753,755,3,66,33,0,754,752,1,0,0,0,755,758,1,0,0,0,756,
        754,1,0,0,0,756,757,1,0,0,0,757,71,1,0,0,0,758,756,1,0,0,0,759,764,
        3,70,35,0,760,761,7,9,0,0,761,763,3,70,35,0,762,760,1,0,0,0,763,
        766,1,0,0,0,764,762,1,0,0,0,764,765,1,0,0,0,765,73,1,0,0,0,766,764,
        1,0,0,0,767,772,3,72,36,0,768,769,5,97,0,0,769,771,3,72,36,0,770,
        768,1,0,0,0,771,774,1,0,0,0,772,770,1,0,0,0,772,773,1,0,0,0,773,
        75,1,0,0,0,774,772,1,0,0,0,775,780,3,74,37,0,776,777,5,96,0,0,777,
        779,3,74,37,0,778,776,1,0,0,0,779,782,1,0,0,0,780,778,1,0,0,0,780,
        781,1,0,0,0,781,77,1,0,0,0,782,780,1,0,0,0,783,788,3,76,38,0,784,
        785,5,98,0,0,785,787,3,76,38,0,786,784,1,0,0,0,787,790,1,0,0,0,788,
        786,1,0,0,0,788,789,1,0,0,0,789,79,1,0,0,0,790,788,1,0,0,0,791,796,
        3,78,39,0,792,793,5,118,0,0,793,795,3,78,39,0,794,792,1,0,0,0,795,
        798,1,0,0,0,796,794,1,0,0,0,796,797,1,0,0,0,797,81,1,0,0,0,798,796,
        1,0,0,0,799,804,3,80,40,0,800,801,5,119,0,0,801,803,3,80,40,0,802,
        800,1,0,0,0,803,806,1,0,0,0,804,802,1,0,0,0,804,805,1,0,0,0,805,
        83,1,0,0,0,806,804,1,0,0,0,807,813,3,82,41,0,808,809,5,125,0,0,809,
        810,3,90,45,0,810,811,5,126,0,0,811,812,3,86,43,0,812,814,1,0,0,
        0,813,808,1,0,0,0,813,814,1,0,0,0,814,85,1,0,0,0,815,822,3,84,42,
        0,816,817,3,82,41,0,817,818,3,88,44,0,818,819,3,272,136,0,819,822,
        1,0,0,0,820,822,3,368,184,0,821,815,1,0,0,0,821,816,1,0,0,0,821,
        820,1,0,0,0,822,87,1,0,0,0,823,824,7,10,0,0,824,89,1,0,0,0,825,830,
        3,86,43,0,826,827,5,122,0,0,827,829,3,86,43,0,828,826,1,0,0,0,829,
        832,1,0,0,0,830,828,1,0,0,0,830,831,1,0,0,0,831,91,1,0,0,0,832,830,
        1,0,0,0,833,834,3,84,42,0,834,93,1,0,0,0,835,849,3,96,48,0,836,849,
        3,118,59,0,837,839,3,204,102,0,838,837,1,0,0,0,838,839,1,0,0,0,839,
        846,1,0,0,0,840,847,3,98,49,0,841,847,3,100,50,0,842,847,3,104,52,
        0,843,847,3,108,54,0,844,847,3,116,58,0,845,847,3,358,179,0,846,
        840,1,0,0,0,846,841,1,0,0,0,846,842,1,0,0,0,846,843,1,0,0,0,846,
        844,1,0,0,0,846,845,1,0,0,0,847,849,1,0,0,0,848,835,1,0,0,0,848,
        836,1,0,0,0,848,838,1,0,0,0,849,95,1,0,0,0,850,852,3,204,102,0,851,
        850,1,0,0,0,851,852,1,0,0,0,852,857,1,0,0,0,853,858,5,132,0,0,854,
        855,5,16,0,0,855,858,3,92,46,0,856,858,5,27,0,0,857,853,1,0,0,0,
        857,854,1,0,0,0,857,856,1,0,0,0,858,859,1,0,0,0,859,860,5,126,0,
        0,860,861,3,94,47,0,861,97,1,0,0,0,862,864,3,90,45,0,863,862,1,0,
        0,0,863,864,1,0,0,0,864,865,1,0,0,0,865,866,5,128,0,0,866,99,1,0,
        0,0,867,869,5,89,0,0,868,870,3,102,51,0,869,868,1,0,0,0,869,870,
        1,0,0,0,870,871,1,0,0,0,871,872,5,90,0,0,872,101,1,0,0,0,873,875,
        3,94,47,0,874,873,1,0,0,0,875,876,1,0,0,0,876,874,1,0,0,0,876,877,
        1,0,0,0,877,103,1,0,0,0,878,879,5,43,0,0,879,880,5,85,0,0,880,881,
        3,106,53,0,881,882,5,86,0,0,882,885,3,94,47,0,883,884,5,32,0,0,884,
        886,3,94,47,0,885,883,1,0,0,0,885,886,1,0,0,0,886,894,1,0,0,0,887,
        888,5,67,0,0,888,889,5,85,0,0,889,890,3,106,53,0,890,891,5,86,0,
        0,891,892,3,94,47,0,892,894,1,0,0,0,893,878,1,0,0,0,893,887,1,0,
        0,0,894,105,1,0,0,0,895,907,3,90,45,0,896,898,3,204,102,0,897,896,
        1,0,0,0,897,898,1,0,0,0,898,899,1,0,0,0,899,900,3,138,69,0,900,904,
        3,226,113,0,901,902,5,101,0,0,902,905,3,272,136,0,903,905,3,276,
        138,0,904,901,1,0,0,0,904,903,1,0,0,0,905,907,1,0,0,0,906,895,1,
        0,0,0,906,897,1,0,0,0,907,107,1,0,0,0,908,909,5,84,0,0,909,910,5,
        85,0,0,910,911,3,106,53,0,911,912,5,86,0,0,912,913,3,94,47,0,913,
        942,1,0,0,0,914,915,5,29,0,0,915,916,3,94,47,0,916,917,5,84,0,0,
        917,918,5,85,0,0,918,919,3,90,45,0,919,920,5,86,0,0,920,921,5,128,
        0,0,921,942,1,0,0,0,922,923,5,40,0,0,923,936,5,85,0,0,924,926,3,
        110,55,0,925,927,3,106,53,0,926,925,1,0,0,0,926,927,1,0,0,0,927,
        928,1,0,0,0,928,930,5,128,0,0,929,931,3,90,45,0,930,929,1,0,0,0,
        930,931,1,0,0,0,931,937,1,0,0,0,932,933,3,112,56,0,933,934,5,126,
        0,0,934,935,3,114,57,0,935,937,1,0,0,0,936,924,1,0,0,0,936,932,1,
        0,0,0,937,938,1,0,0,0,938,939,5,86,0,0,939,940,3,94,47,0,940,942,
        1,0,0,0,941,908,1,0,0,0,941,914,1,0,0,0,941,922,1,0,0,0,942,109,
        1,0,0,0,943,946,3,98,49,0,944,946,3,128,64,0,945,943,1,0,0,0,945,
        944,1,0,0,0,946,111,1,0,0,0,947,949,3,204,102,0,948,947,1,0,0,0,
        948,949,1,0,0,0,949,950,1,0,0,0,950,951,3,138,69,0,951,952,3,226,
        113,0,952,113,1,0,0,0,953,956,3,90,45,0,954,956,3,276,138,0,955,
        953,1,0,0,0,955,954,1,0,0,0,956,115,1,0,0,0,957,967,5,15,0,0,958,
        967,5,25,0,0,959,962,5,59,0,0,960,963,3,90,45,0,961,963,3,276,138,
        0,962,960,1,0,0,0,962,961,1,0,0,0,962,963,1,0,0,0,963,967,1,0,0,
        0,964,965,5,42,0,0,965,967,5,132,0,0,966,957,1,0,0,0,966,958,1,0,
        0,0,966,959,1,0,0,0,966,964,1,0,0,0,967,968,1,0,0,0,968,969,5,128,
        0,0,969,117,1,0,0,0,970,971,3,124,62,0,971,119,1,0,0,0,972,974,3,
        122,61,0,973,972,1,0,0,0,974,975,1,0,0,0,975,973,1,0,0,0,975,976,
        1,0,0,0,976,121,1,0,0,0,977,987,3,124,62,0,978,987,3,264,132,0,979,
        987,3,334,167,0,980,987,3,354,177,0,981,987,3,356,178,0,982,987,
        3,202,101,0,983,987,3,188,94,0,984,987,3,132,66,0,985,987,3,134,
        67,0,986,977,1,0,0,0,986,978,1,0,0,0,986,979,1,0,0,0,986,980,1,0,
        0,0,986,981,1,0,0,0,986,982,1,0,0,0,986,983,1,0,0,0,986,984,1,0,
        0,0,986,985,1,0,0,0,987,123,1,0,0,0,988,997,3,128,64,0,989,997,3,
        200,100,0,990,997,3,192,96,0,991,997,3,196,98,0,992,997,3,198,99,
        0,993,997,3,130,65,0,994,997,3,126,63,0,995,997,3,172,86,0,996,988,
        1,0,0,0,996,989,1,0,0,0,996,990,1,0,0,0,996,991,1,0,0,0,996,992,
        1,0,0,0,996,993,1,0,0,0,996,994,1,0,0,0,996,995,1,0,0,0,997,125,
        1,0,0,0,998,999,5,79,0,0,999,1001,5,132,0,0,1000,1002,3,204,102,
        0,1001,1000,1,0,0,0,1001,1002,1,0,0,0,1002,1003,1,0,0,0,1003,1004,
        5,101,0,0,1004,1005,3,246,123,0,1005,1006,5,128,0,0,1006,127,1,0,
        0,0,1007,1009,3,138,69,0,1008,1007,1,0,0,0,1008,1009,1,0,0,0,1009,
        1011,1,0,0,0,1010,1012,3,222,111,0,1011,1010,1,0,0,0,1011,1012,1,
        0,0,0,1012,1013,1,0,0,0,1013,1022,5,128,0,0,1014,1016,3,204,102,
        0,1015,1017,3,138,69,0,1016,1015,1,0,0,0,1016,1017,1,0,0,0,1017,
        1018,1,0,0,0,1018,1019,3,222,111,0,1019,1020,5,128,0,0,1020,1022,
        1,0,0,0,1021,1008,1,0,0,0,1021,1014,1,0,0,0,1022,129,1,0,0,0,1023,
        1024,5,64,0,0,1024,1025,5,85,0,0,1025,1026,3,92,46,0,1026,1027,5,
        122,0,0,1027,1028,5,4,0,0,1028,1029,5,86,0,0,1029,1030,5,128,0,0,
        1030,131,1,0,0,0,1031,1032,5,128,0,0,1032,133,1,0,0,0,1033,1034,
        3,204,102,0,1034,1035,5,128,0,0,1035,135,1,0,0,0,1036,1043,3,140,
        70,0,1037,1043,3,146,73,0,1038,1043,3,142,71,0,1039,1043,5,41,0,
        0,1040,1043,5,74,0,0,1041,1043,5,23,0,0,1042,1036,1,0,0,0,1042,1037,
        1,0,0,0,1042,1038,1,0,0,0,1042,1039,1,0,0,0,1042,1040,1,0,0,0,1042,
        1041,1,0,0,0,1043,137,1,0,0,0,1044,1046,3,136,68,0,1045,1044,1,0,
        0,0,1046,1047,1,0,0,0,1047,1048,1,0,0,0,1047,1045,1,0,0,0,1048,1050,
        1,0,0,0,1049,1051,3,204,102,0,1050,1049,1,0,0,0,1050,1051,1,0,0,
        0,1051,139,1,0,0,0,1052,1053,7,11,0,0,1053,141,1,0,0,0,1054,1055,
        7,12,0,0,1055,143,1,0,0,0,1056,1057,5,132,0,0,1057,145,1,0,0,0,1058,
        1062,3,148,74,0,1059,1062,3,280,140,0,1060,1062,3,168,84,0,1061,
        1058,1,0,0,0,1061,1059,1,0,0,0,1061,1060,1,0,0,0,1062,147,1,0,0,
        0,1063,1068,3,158,79,0,1064,1068,3,164,82,0,1065,1068,3,352,176,
        0,1066,1068,3,240,120,0,1067,1063,1,0,0,0,1067,1064,1,0,0,0,1067,
        1065,1,0,0,0,1067,1066,1,0,0,0,1068,149,1,0,0,0,1069,1071,3,146,
        73,0,1070,1069,1,0,0,0,1071,1072,1,0,0,0,1072,1070,1,0,0,0,1072,
        1073,1,0,0,0,1073,1075,1,0,0,0,1074,1076,3,204,102,0,1075,1074,1,
        0,0,0,1075,1076,1,0,0,0,1076,151,1,0,0,0,1077,1079,3,148,74,0,1078,
        1077,1,0,0,0,1079,1080,1,0,0,0,1080,1078,1,0,0,0,1080,1081,1,0,0,
        0,1081,1083,1,0,0,0,1082,1084,3,204,102,0,1083,1082,1,0,0,0,1083,
        1084,1,0,0,0,1084,153,1,0,0,0,1085,1086,7,13,0,0,1086,155,1,0,0,
        0,1087,1088,7,14,0,0,1088,157,1,0,0,0,1089,1091,3,10,5,0,1090,1089,
        1,0,0,0,1090,1091,1,0,0,0,1091,1092,1,0,0,0,1092,1114,3,160,80,0,
        1093,1094,3,10,5,0,1094,1095,5,68,0,0,1095,1096,3,342,171,0,1096,
        1114,1,0,0,0,1097,1114,5,18,0,0,1098,1114,5,19,0,0,1099,1114,5,20,
        0,0,1100,1114,5,83,0,0,1101,1114,5,14,0,0,1102,1114,5,60,0,0,1103,
        1114,5,45,0,0,1104,1114,5,46,0,0,1105,1114,5,39,0,0,1106,1114,5,
        61,0,0,1107,1114,5,78,0,0,1108,1114,5,39,0,0,1109,1114,5,30,0,0,
        1110,1114,5,81,0,0,1111,1114,5,13,0,0,1112,1114,3,162,81,0,1113,
        1090,1,0,0,0,1113,1093,1,0,0,0,1113,1097,1,0,0,0,1113,1098,1,0,0,
        0,1113,1099,1,0,0,0,1113,1100,1,0,0,0,1113,1101,1,0,0,0,1113,1102,
        1,0,0,0,1113,1103,1,0,0,0,1113,1104,1,0,0,0,1113,1105,1,0,0,0,1113,
        1106,1,0,0,0,1113,1107,1,0,0,0,1113,1108,1,0,0,0,1113,1109,1,0,0,
        0,1113,1110,1,0,0,0,1113,1111,1,0,0,0,1113,1112,1,0,0,0,1114,159,
        1,0,0,0,1115,1120,3,278,139,0,1116,1120,3,166,83,0,1117,1120,3,144,
        72,0,1118,1120,3,342,171,0,1119,1115,1,0,0,0,1119,1116,1,0,0,0,1119,
        1117,1,0,0,0,1119,1118,1,0,0,0,1120,161,1,0,0,0,1121,1122,5,26,0,
        0,1122,1125,5,85,0,0,1123,1126,3,90,45,0,1124,1126,5,13,0,0,1125,
        1123,1,0,0,0,1125,1124,1,0,0,0,1126,1127,1,0,0,0,1127,1128,5,86,
        0,0,1128,163,1,0,0,0,1129,1144,3,288,144,0,1130,1132,3,204,102,0,
        1131,1130,1,0,0,0,1131,1132,1,0,0,0,1132,1134,1,0,0,0,1133,1135,
        3,10,5,0,1134,1133,1,0,0,0,1134,1135,1,0,0,0,1135,1136,1,0,0,0,1136,
        1145,5,132,0,0,1137,1145,3,342,171,0,1138,1140,3,10,5,0,1139,1141,
        5,68,0,0,1140,1139,1,0,0,0,1140,1141,1,0,0,0,1141,1142,1,0,0,0,1142,
        1143,3,342,171,0,1143,1145,1,0,0,0,1144,1131,1,0,0,0,1144,1137,1,
        0,0,0,1144,1138,1,0,0,0,1145,1152,1,0,0,0,1146,1148,5,33,0,0,1147,
        1149,3,10,5,0,1148,1147,1,0,0,0,1148,1149,1,0,0,0,1149,1150,1,0,
        0,0,1150,1152,5,132,0,0,1151,1129,1,0,0,0,1151,1146,1,0,0,0,1152,
        165,1,0,0,0,1153,1154,5,132,0,0,1154,167,1,0,0,0,1155,1156,3,170,
        85,0,1156,1161,5,89,0,0,1157,1159,3,178,89,0,1158,1160,5,122,0,0,
        1159,1158,1,0,0,0,1159,1160,1,0,0,0,1160,1162,1,0,0,0,1161,1157,
        1,0,0,0,1161,1162,1,0,0,0,1162,1163,1,0,0,0,1163,1164,5,90,0,0,1164,
        169,1,0,0,0,1165,1167,3,174,87,0,1166,1168,3,204,102,0,1167,1166,
        1,0,0,0,1167,1168,1,0,0,0,1168,1173,1,0,0,0,1169,1171,3,10,5,0,1170,
        1169,1,0,0,0,1170,1171,1,0,0,0,1171,1172,1,0,0,0,1172,1174,5,132,
        0,0,1173,1170,1,0,0,0,1173,1174,1,0,0,0,1174,1176,1,0,0,0,1175,1177,
        3,176,88,0,1176,1175,1,0,0,0,1176,1177,1,0,0,0,1177,171,1,0,0,0,
        1178,1180,3,174,87,0,1179,1181,3,204,102,0,1180,1179,1,0,0,0,1180,
        1181,1,0,0,0,1181,1182,1,0,0,0,1182,1184,5,132,0,0,1183,1185,3,176,
        88,0,1184,1183,1,0,0,0,1184,1185,1,0,0,0,1185,1186,1,0,0,0,1186,
        1187,5,128,0,0,1187,173,1,0,0,0,1188,1190,5,33,0,0,1189,1191,7,15,
        0,0,1190,1189,1,0,0,0,1190,1191,1,0,0,0,1191,175,1,0,0,0,1192,1193,
        5,126,0,0,1193,1194,3,150,75,0,1194,177,1,0,0,0,1195,1200,3,180,
        90,0,1196,1197,5,122,0,0,1197,1199,3,180,90,0,1198,1196,1,0,0,0,
        1199,1202,1,0,0,0,1200,1198,1,0,0,0,1200,1201,1,0,0,0,1201,179,1,
        0,0,0,1202,1200,1,0,0,0,1203,1206,3,182,91,0,1204,1205,5,101,0,0,
        1205,1207,3,92,46,0,1206,1204,1,0,0,0,1206,1207,1,0,0,0,1207,181,
        1,0,0,0,1208,1209,5,132,0,0,1209,183,1,0,0,0,1210,1213,3,186,93,
        0,1211,1213,3,190,95,0,1212,1210,1,0,0,0,1212,1211,1,0,0,0,1213,
        185,1,0,0,0,1214,1215,5,132,0,0,1215,187,1,0,0,0,1216,1218,5,44,
        0,0,1217,1216,1,0,0,0,1217,1218,1,0,0,0,1218,1219,1,0,0,0,1219,1222,
        5,48,0,0,1220,1223,5,132,0,0,1221,1223,3,186,93,0,1222,1220,1,0,
        0,0,1222,1221,1,0,0,0,1222,1223,1,0,0,0,1223,1224,1,0,0,0,1224,1226,
        5,89,0,0,1225,1227,3,120,60,0,1226,1225,1,0,0,0,1226,1227,1,0,0,
        0,1227,1228,1,0,0,0,1228,1229,5,90,0,0,1229,189,1,0,0,0,1230,1231,
        5,132,0,0,1231,191,1,0,0,0,1232,1233,5,48,0,0,1233,1234,5,132,0,
        0,1234,1235,5,101,0,0,1235,1236,3,194,97,0,1236,1237,5,128,0,0,1237,
        193,1,0,0,0,1238,1240,3,10,5,0,1239,1238,1,0,0,0,1239,1240,1,0,0,
        0,1240,1241,1,0,0,0,1241,1242,3,184,92,0,1242,195,1,0,0,0,1243,1249,
        5,79,0,0,1244,1246,5,76,0,0,1245,1244,1,0,0,0,1245,1246,1,0,0,0,
        1246,1247,1,0,0,0,1247,1250,3,10,5,0,1248,1250,5,127,0,0,1249,1245,
        1,0,0,0,1249,1248,1,0,0,0,1250,1251,1,0,0,0,1251,1252,3,6,3,0,1252,
        1253,5,128,0,0,1253,197,1,0,0,0,1254,1256,3,204,102,0,1255,1254,
        1,0,0,0,1255,1256,1,0,0,0,1256,1257,1,0,0,0,1257,1258,5,79,0,0,1258,
        1260,5,48,0,0,1259,1261,3,10,5,0,1260,1259,1,0,0,0,1260,1261,1,0,
        0,0,1261,1262,1,0,0,0,1262,1263,3,184,92,0,1263,1264,5,128,0,0,1264,
        199,1,0,0,0,1265,1266,5,12,0,0,1266,1267,5,85,0,0,1267,1268,5,4,
        0,0,1268,1269,5,86,0,0,1269,1270,5,128,0,0,1270,201,1,0,0,0,1271,
        1272,5,36,0,0,1272,1279,5,4,0,0,1273,1275,5,89,0,0,1274,1276,3,120,
        60,0,1275,1274,1,0,0,0,1275,1276,1,0,0,0,1276,1277,1,0,0,0,1277,
        1280,5,90,0,0,1278,1280,3,122,61,0,1279,1273,1,0,0,0,1279,1278,1,
        0,0,0,1280,203,1,0,0,0,1281,1283,3,206,103,0,1282,1281,1,0,0,0,1283,
        1284,1,0,0,0,1284,1282,1,0,0,0,1284,1285,1,0,0,0,1285,205,1,0,0,
        0,1286,1287,5,87,0,0,1287,1289,5,87,0,0,1288,1290,3,210,105,0,1289,
        1288,1,0,0,0,1289,1290,1,0,0,0,1290,1291,1,0,0,0,1291,1292,5,88,
        0,0,1292,1295,5,88,0,0,1293,1295,3,208,104,0,1294,1286,1,0,0,0,1294,
        1293,1,0,0,0,1295,207,1,0,0,0,1296,1297,5,10,0,0,1297,1300,5,85,
        0,0,1298,1301,3,246,123,0,1299,1301,3,92,46,0,1300,1298,1,0,0,0,
        1300,1299,1,0,0,0,1301,1303,1,0,0,0,1302,1304,5,131,0,0,1303,1302,
        1,0,0,0,1303,1304,1,0,0,0,1304,1305,1,0,0,0,1305,1306,5,86,0,0,1306,
        209,1,0,0,0,1307,1312,3,212,106,0,1308,1309,5,122,0,0,1309,1311,
        3,212,106,0,1310,1308,1,0,0,0,1311,1314,1,0,0,0,1312,1310,1,0,0,
        0,1312,1313,1,0,0,0,1313,1316,1,0,0,0,1314,1312,1,0,0,0,1315,1317,
        5,131,0,0,1316,1315,1,0,0,0,1316,1317,1,0,0,0,1317,211,1,0,0,0,1318,
        1319,3,214,107,0,1319,1320,5,127,0,0,1320,1322,1,0,0,0,1321,1318,
        1,0,0,0,1321,1322,1,0,0,0,1322,1323,1,0,0,0,1323,1325,5,132,0,0,
        1324,1326,3,216,108,0,1325,1324,1,0,0,0,1325,1326,1,0,0,0,1326,213,
        1,0,0,0,1327,1328,5,132,0,0,1328,215,1,0,0,0,1329,1331,5,85,0,0,
        1330,1332,3,218,109,0,1331,1330,1,0,0,0,1331,1332,1,0,0,0,1332,1333,
        1,0,0,0,1333,1334,5,86,0,0,1334,217,1,0,0,0,1335,1337,3,220,110,
        0,1336,1335,1,0,0,0,1337,1338,1,0,0,0,1338,1336,1,0,0,0,1338,1339,
        1,0,0,0,1339,219,1,0,0,0,1340,1341,5,85,0,0,1341,1342,3,218,109,
        0,1342,1343,5,86,0,0,1343,1358,1,0,0,0,1344,1345,5,87,0,0,1345,1346,
        3,218,109,0,1346,1347,5,88,0,0,1347,1358,1,0,0,0,1348,1349,5,89,
        0,0,1349,1350,3,218,109,0,1350,1351,5,90,0,0,1351,1358,1,0,0,0,1352,
        1354,8,16,0,0,1353,1352,1,0,0,0,1354,1355,1,0,0,0,1355,1353,1,0,
        0,0,1355,1356,1,0,0,0,1356,1358,1,0,0,0,1357,1340,1,0,0,0,1357,1344,
        1,0,0,0,1357,1348,1,0,0,0,1357,1353,1,0,0,0,1358,221,1,0,0,0,1359,
        1364,3,224,112,0,1360,1361,5,122,0,0,1361,1363,3,224,112,0,1362,
        1360,1,0,0,0,1363,1366,1,0,0,0,1364,1362,1,0,0,0,1364,1365,1,0,0,
        0,1365,223,1,0,0,0,1366,1364,1,0,0,0,1367,1369,3,226,113,0,1368,
        1370,3,268,134,0,1369,1368,1,0,0,0,1369,1370,1,0,0,0,1370,225,1,
        0,0,0,1371,1377,3,228,114,0,1372,1373,3,230,115,0,1373,1374,3,232,
        116,0,1374,1375,3,234,117,0,1375,1377,1,0,0,0,1376,1371,1,0,0,0,
        1376,1372,1,0,0,0,1377,227,1,0,0,0,1378,1380,3,236,118,0,1379,1381,
        5,22,0,0,1380,1379,1,0,0,0,1380,1381,1,0,0,0,1381,1383,1,0,0,0,1382,
        1378,1,0,0,0,1383,1386,1,0,0,0,1384,1382,1,0,0,0,1384,1385,1,0,0,
        0,1385,1387,1,0,0,0,1386,1384,1,0,0,0,1387,1388,3,230,115,0,1388,
        229,1,0,0,0,1389,1390,6,115,-1,0,1390,1392,3,244,122,0,1391,1393,
        3,204,102,0,1392,1391,1,0,0,0,1392,1393,1,0,0,0,1393,1399,1,0,0,
        0,1394,1395,5,85,0,0,1395,1396,3,228,114,0,1396,1397,5,86,0,0,1397,
        1399,1,0,0,0,1398,1389,1,0,0,0,1398,1394,1,0,0,0,1399,1414,1,0,0,
        0,1400,1410,10,2,0,0,1401,1411,3,232,116,0,1402,1404,5,87,0,0,1403,
        1405,3,92,46,0,1404,1403,1,0,0,0,1404,1405,1,0,0,0,1405,1406,1,0,
        0,0,1406,1408,5,88,0,0,1407,1409,3,204,102,0,1408,1407,1,0,0,0,1408,
        1409,1,0,0,0,1409,1411,1,0,0,0,1410,1401,1,0,0,0,1410,1402,1,0,0,
        0,1411,1413,1,0,0,0,1412,1400,1,0,0,0,1413,1416,1,0,0,0,1414,1412,
        1,0,0,0,1414,1415,1,0,0,0,1415,231,1,0,0,0,1416,1414,1,0,0,0,1417,
        1419,5,85,0,0,1418,1420,3,258,129,0,1419,1418,1,0,0,0,1419,1420,
        1,0,0,0,1420,1421,1,0,0,0,1421,1423,5,86,0,0,1422,1424,3,238,119,
        0,1423,1422,1,0,0,0,1423,1424,1,0,0,0,1424,1426,1,0,0,0,1425,1427,
        3,242,121,0,1426,1425,1,0,0,0,1426,1427,1,0,0,0,1427,1429,1,0,0,
        0,1428,1430,3,370,185,0,1429,1428,1,0,0,0,1429,1430,1,0,0,0,1430,
        1432,1,0,0,0,1431,1433,3,204,102,0,1432,1431,1,0,0,0,1432,1433,1,
        0,0,0,1433,233,1,0,0,0,1434,1435,5,124,0,0,1435,1437,3,152,76,0,
        1436,1438,3,248,124,0,1437,1436,1,0,0,0,1437,1438,1,0,0,0,1438,235,
        1,0,0,0,1439,1441,7,17,0,0,1440,1442,3,204,102,0,1441,1440,1,0,0,
        0,1441,1442,1,0,0,0,1442,1454,1,0,0,0,1443,1445,3,10,5,0,1444,1443,
        1,0,0,0,1444,1445,1,0,0,0,1445,1446,1,0,0,0,1446,1448,5,93,0,0,1447,
        1449,3,204,102,0,1448,1447,1,0,0,0,1448,1449,1,0,0,0,1449,1451,1,
        0,0,0,1450,1452,3,238,119,0,1451,1450,1,0,0,0,1451,1452,1,0,0,0,
        1452,1454,1,0,0,0,1453,1439,1,0,0,0,1453,1444,1,0,0,0,1454,237,1,
        0,0,0,1455,1457,3,240,120,0,1456,1455,1,0,0,0,1457,1458,1,0,0,0,
        1458,1456,1,0,0,0,1458,1459,1,0,0,0,1459,239,1,0,0,0,1460,1461,7,
        18,0,0,1461,241,1,0,0,0,1462,1463,7,17,0,0,1463,243,1,0,0,0,1464,
        1466,5,131,0,0,1465,1464,1,0,0,0,1465,1466,1,0,0,0,1466,1467,1,0,
        0,0,1467,1468,3,4,2,0,1468,245,1,0,0,0,1469,1471,3,150,75,0,1470,
        1472,3,248,124,0,1471,1470,1,0,0,0,1471,1472,1,0,0,0,1472,247,1,
        0,0,0,1473,1482,3,250,125,0,1474,1476,3,252,126,0,1475,1474,1,0,
        0,0,1475,1476,1,0,0,0,1476,1477,1,0,0,0,1477,1478,3,232,116,0,1478,
        1479,3,234,117,0,1479,1482,1,0,0,0,1480,1482,3,254,127,0,1481,1473,
        1,0,0,0,1481,1475,1,0,0,0,1481,1480,1,0,0,0,1482,249,1,0,0,0,1483,
        1485,3,236,118,0,1484,1483,1,0,0,0,1485,1488,1,0,0,0,1486,1484,1,
        0,0,0,1486,1487,1,0,0,0,1487,1491,1,0,0,0,1488,1486,1,0,0,0,1489,
        1492,3,252,126,0,1490,1492,3,236,118,0,1491,1489,1,0,0,0,1491,1490,
        1,0,0,0,1492,251,1,0,0,0,1493,1499,3,232,116,0,1494,1495,5,85,0,
        0,1495,1496,3,250,125,0,1496,1497,5,86,0,0,1497,1499,1,0,0,0,1498,
        1493,1,0,0,0,1498,1494,1,0,0,0,1499,1511,1,0,0,0,1500,1510,3,232,
        116,0,1501,1503,5,87,0,0,1502,1504,3,92,46,0,1503,1502,1,0,0,0,1503,
        1504,1,0,0,0,1504,1505,1,0,0,0,1505,1507,5,88,0,0,1506,1508,3,204,
        102,0,1507,1506,1,0,0,0,1507,1508,1,0,0,0,1508,1510,1,0,0,0,1509,
        1500,1,0,0,0,1509,1501,1,0,0,0,1510,1513,1,0,0,0,1511,1509,1,0,0,
        0,1511,1512,1,0,0,0,1512,253,1,0,0,0,1513,1511,1,0,0,0,1514,1516,
        3,236,118,0,1515,1514,1,0,0,0,1516,1519,1,0,0,0,1517,1515,1,0,0,
        0,1517,1518,1,0,0,0,1518,1520,1,0,0,0,1519,1517,1,0,0,0,1520,1521,
        3,256,128,0,1521,255,1,0,0,0,1522,1534,5,131,0,0,1523,1533,3,232,
        116,0,1524,1526,5,87,0,0,1525,1527,3,92,46,0,1526,1525,1,0,0,0,1526,
        1527,1,0,0,0,1527,1528,1,0,0,0,1528,1530,5,88,0,0,1529,1531,3,204,
        102,0,1530,1529,1,0,0,0,1530,1531,1,0,0,0,1531,1533,1,0,0,0,1532,
        1523,1,0,0,0,1532,1524,1,0,0,0,1533,1536,1,0,0,0,1534,1532,1,0,0,
        0,1534,1535,1,0,0,0,1535,257,1,0,0,0,1536,1534,1,0,0,0,1537,1542,
        3,260,130,0,1538,1540,5,122,0,0,1539,1538,1,0,0,0,1539,1540,1,0,
        0,0,1540,1541,1,0,0,0,1541,1543,5,131,0,0,1542,1539,1,0,0,0,1542,
        1543,1,0,0,0,1543,259,1,0,0,0,1544,1549,3,262,131,0,1545,1546,5,
        122,0,0,1546,1548,3,262,131,0,1547,1545,1,0,0,0,1548,1551,1,0,0,
        0,1549,1547,1,0,0,0,1549,1550,1,0,0,0,1550,261,1,0,0,0,1551,1549,
        1,0,0,0,1552,1554,3,204,102,0,1553,1552,1,0,0,0,1553,1554,1,0,0,
        0,1554,1555,1,0,0,0,1555,1560,3,138,69,0,1556,1561,3,226,113,0,1557,
        1559,3,248,124,0,1558,1557,1,0,0,0,1558,1559,1,0,0,0,1559,1561,1,
        0,0,0,1560,1556,1,0,0,0,1560,1558,1,0,0,0,1561,1564,1,0,0,0,1562,
        1563,5,101,0,0,1563,1565,3,272,136,0,1564,1562,1,0,0,0,1564,1565,
        1,0,0,0,1565,263,1,0,0,0,1566,1568,3,204,102,0,1567,1566,1,0,0,0,
        1567,1568,1,0,0,0,1568,1570,1,0,0,0,1569,1571,3,138,69,0,1570,1569,
        1,0,0,0,1570,1571,1,0,0,0,1571,1572,1,0,0,0,1572,1574,3,226,113,
        0,1573,1575,3,298,149,0,1574,1573,1,0,0,0,1574,1575,1,0,0,0,1575,
        1576,1,0,0,0,1576,1577,3,266,133,0,1577,265,1,0,0,0,1578,1580,3,
        322,161,0,1579,1578,1,0,0,0,1579,1580,1,0,0,0,1580,1581,1,0,0,0,
        1581,1587,3,100,50,0,1582,1587,3,360,180,0,1583,1584,5,101,0,0,1584,
        1585,7,19,0,0,1585,1587,5,128,0,0,1586,1579,1,0,0,0,1586,1582,1,
        0,0,0,1586,1583,1,0,0,0,1587,267,1,0,0,0,1588,1594,3,270,135,0,1589,
        1590,5,85,0,0,1590,1591,3,34,17,0,1591,1592,5,86,0,0,1592,1594,1,
        0,0,0,1593,1588,1,0,0,0,1593,1589,1,0,0,0,1594,269,1,0,0,0,1595,
        1596,5,101,0,0,1596,1599,3,272,136,0,1597,1599,3,276,138,0,1598,
        1595,1,0,0,0,1598,1597,1,0,0,0,1599,271,1,0,0,0,1600,1603,3,86,43,
        0,1601,1603,3,276,138,0,1602,1600,1,0,0,0,1602,1601,1,0,0,0,1603,
        273,1,0,0,0,1604,1606,3,272,136,0,1605,1607,5,131,0,0,1606,1605,
        1,0,0,0,1606,1607,1,0,0,0,1607,1615,1,0,0,0,1608,1609,5,122,0,0,
        1609,1611,3,272,136,0,1610,1612,5,131,0,0,1611,1610,1,0,0,0,1611,
        1612,1,0,0,0,1612,1614,1,0,0,0,1613,1608,1,0,0,0,1614,1617,1,0,0,
        0,1615,1613,1,0,0,0,1615,1616,1,0,0,0,1616,275,1,0,0,0,1617,1615,
        1,0,0,0,1618,1623,5,89,0,0,1619,1621,3,274,137,0,1620,1622,5,122,
        0,0,1621,1620,1,0,0,0,1621,1622,1,0,0,0,1622,1624,1,0,0,0,1623,1619,
        1,0,0,0,1623,1624,1,0,0,0,1624,1625,1,0,0,0,1625,1626,5,90,0,0,1626,
        277,1,0,0,0,1627,1630,5,132,0,0,1628,1630,3,342,171,0,1629,1627,
        1,0,0,0,1629,1628,1,0,0,0,1630,279,1,0,0,0,1631,1632,3,282,141,0,
        1632,1634,5,89,0,0,1633,1635,3,290,145,0,1634,1633,1,0,0,0,1634,
        1635,1,0,0,0,1635,1636,1,0,0,0,1636,1637,5,90,0,0,1637,281,1,0,0,
        0,1638,1640,3,288,144,0,1639,1641,3,204,102,0,1640,1639,1,0,0,0,
        1640,1641,1,0,0,0,1641,1646,1,0,0,0,1642,1644,3,284,142,0,1643,1645,
        3,286,143,0,1644,1643,1,0,0,0,1644,1645,1,0,0,0,1645,1647,1,0,0,
        0,1646,1642,1,0,0,0,1646,1647,1,0,0,0,1647,1649,1,0,0,0,1648,1650,
        3,304,152,0,1649,1648,1,0,0,0,1649,1650,1,0,0,0,1650,1662,1,0,0,
        0,1651,1653,5,77,0,0,1652,1654,3,204,102,0,1653,1652,1,0,0,0,1653,
        1654,1,0,0,0,1654,1659,1,0,0,0,1655,1657,3,284,142,0,1656,1658,3,
        286,143,0,1657,1656,1,0,0,0,1657,1658,1,0,0,0,1658,1660,1,0,0,0,
        1659,1655,1,0,0,0,1659,1660,1,0,0,0,1660,1662,1,0,0,0,1661,1638,
        1,0,0,0,1661,1651,1,0,0,0,1662,283,1,0,0,0,1663,1665,3,10,5,0,1664,
        1663,1,0,0,0,1664,1665,1,0,0,0,1665,1666,1,0,0,0,1666,1667,3,278,
        139,0,1667,285,1,0,0,0,1668,1669,5,38,0,0,1669,287,1,0,0,0,1670,
        1671,7,15,0,0,1671,289,1,0,0,0,1672,1677,3,292,146,0,1673,1674,3,
        314,157,0,1674,1675,5,126,0,0,1675,1677,1,0,0,0,1676,1672,1,0,0,
        0,1676,1673,1,0,0,0,1677,1678,1,0,0,0,1678,1676,1,0,0,0,1678,1679,
        1,0,0,0,1679,291,1,0,0,0,1680,1682,3,204,102,0,1681,1680,1,0,0,0,
        1681,1682,1,0,0,0,1682,1684,1,0,0,0,1683,1685,3,138,69,0,1684,1683,
        1,0,0,0,1684,1685,1,0,0,0,1685,1687,1,0,0,0,1686,1688,3,294,147,
        0,1687,1686,1,0,0,0,1687,1688,1,0,0,0,1688,1689,1,0,0,0,1689,1697,
        5,128,0,0,1690,1697,3,264,132,0,1691,1697,3,196,98,0,1692,1697,3,
        130,65,0,1693,1697,3,334,167,0,1694,1697,3,126,63,0,1695,1697,3,
        132,66,0,1696,1681,1,0,0,0,1696,1690,1,0,0,0,1696,1691,1,0,0,0,1696,
        1692,1,0,0,0,1696,1693,1,0,0,0,1696,1694,1,0,0,0,1696,1695,1,0,0,
        0,1697,293,1,0,0,0,1698,1703,3,296,148,0,1699,1700,5,122,0,0,1700,
        1702,3,296,148,0,1701,1699,1,0,0,0,1702,1705,1,0,0,0,1703,1701,1,
        0,0,0,1703,1704,1,0,0,0,1704,295,1,0,0,0,1705,1703,1,0,0,0,1706,
        1713,3,226,113,0,1707,1709,3,298,149,0,1708,1710,3,302,151,0,1709,
        1708,1,0,0,0,1709,1710,1,0,0,0,1710,1714,1,0,0,0,1711,1714,3,302,
        151,0,1712,1714,3,270,135,0,1713,1707,1,0,0,0,1713,1711,1,0,0,0,
        1713,1712,1,0,0,0,1713,1714,1,0,0,0,1714,1724,1,0,0,0,1715,1717,
        5,132,0,0,1716,1715,1,0,0,0,1716,1717,1,0,0,0,1717,1719,1,0,0,0,
        1718,1720,3,204,102,0,1719,1718,1,0,0,0,1719,1720,1,0,0,0,1720,1721,
        1,0,0,0,1721,1722,5,126,0,0,1722,1724,3,92,46,0,1723,1706,1,0,0,
        0,1723,1716,1,0,0,0,1724,297,1,0,0,0,1725,1727,3,300,150,0,1726,
        1725,1,0,0,0,1727,1728,1,0,0,0,1728,1726,1,0,0,0,1728,1729,1,0,0,
        0,1729,299,1,0,0,0,1730,1731,7,20,0,0,1731,301,1,0,0,0,1732,1733,
        5,101,0,0,1733,1734,5,1,0,0,1734,303,1,0,0,0,1735,1736,5,126,0,0,
        1736,1737,3,306,153,0,1737,305,1,0,0,0,1738,1740,3,308,154,0,1739,
        1741,5,131,0,0,1740,1739,1,0,0,0,1740,1741,1,0,0,0,1741,1749,1,0,
        0,0,1742,1743,5,122,0,0,1743,1745,3,308,154,0,1744,1746,5,131,0,
        0,1745,1744,1,0,0,0,1745,1746,1,0,0,0,1746,1748,1,0,0,0,1747,1742,
        1,0,0,0,1748,1751,1,0,0,0,1749,1747,1,0,0,0,1749,1750,1,0,0,0,1750,
        307,1,0,0,0,1751,1749,1,0,0,0,1752,1754,3,204,102,0,1753,1752,1,
        0,0,0,1753,1754,1,0,0,0,1754,1767,1,0,0,0,1755,1768,3,312,156,0,
        1756,1758,5,80,0,0,1757,1759,3,314,157,0,1758,1757,1,0,0,0,1758,
        1759,1,0,0,0,1759,1760,1,0,0,0,1760,1768,3,312,156,0,1761,1763,3,
        314,157,0,1762,1764,5,80,0,0,1763,1762,1,0,0,0,1763,1764,1,0,0,0,
        1764,1765,1,0,0,0,1765,1766,3,312,156,0,1766,1768,1,0,0,0,1767,1755,
        1,0,0,0,1767,1756,1,0,0,0,1767,1761,1,0,0,0,1768,309,1,0,0,0,1769,
        1771,3,10,5,0,1770,1769,1,0,0,0,1770,1771,1,0,0,0,1771,1772,1,0,
        0,0,1772,1775,3,278,139,0,1773,1775,3,162,81,0,1774,1770,1,0,0,0,
        1774,1773,1,0,0,0,1775,311,1,0,0,0,1776,1777,3,310,155,0,1777,313,
        1,0,0,0,1778,1779,7,21,0,0,1779,315,1,0,0,0,1780,1781,5,52,0,0,1781,
        1782,3,318,159,0,1782,317,1,0,0,0,1783,1785,3,150,75,0,1784,1786,
        3,320,160,0,1785,1784,1,0,0,0,1785,1786,1,0,0,0,1786,319,1,0,0,0,
        1787,1789,3,236,118,0,1788,1790,3,320,160,0,1789,1788,1,0,0,0,1789,
        1790,1,0,0,0,1790,321,1,0,0,0,1791,1792,5,126,0,0,1792,1793,3,324,
        162,0,1793,323,1,0,0,0,1794,1796,3,326,163,0,1795,1797,5,131,0,0,
        1796,1795,1,0,0,0,1796,1797,1,0,0,0,1797,1805,1,0,0,0,1798,1799,
        5,122,0,0,1799,1801,3,326,163,0,1800,1802,5,131,0,0,1801,1800,1,
        0,0,0,1801,1802,1,0,0,0,1802,1804,1,0,0,0,1803,1798,1,0,0,0,1804,
        1807,1,0,0,0,1805,1803,1,0,0,0,1805,1806,1,0,0,0,1806,325,1,0,0,
        0,1807,1805,1,0,0,0,1808,1815,3,328,164,0,1809,1811,5,85,0,0,1810,
        1812,3,34,17,0,1811,1810,1,0,0,0,1811,1812,1,0,0,0,1812,1813,1,0,
        0,0,1813,1816,5,86,0,0,1814,1816,3,276,138,0,1815,1809,1,0,0,0,1815,
        1814,1,0,0,0,1816,327,1,0,0,0,1817,1820,3,310,155,0,1818,1820,5,
        132,0,0,1819,1817,1,0,0,0,1819,1818,1,0,0,0,1820,329,1,0,0,0,1821,
        1822,5,52,0,0,1822,1823,3,378,189,0,1823,331,1,0,0,0,1824,1828,5,
        52,0,0,1825,1826,5,4,0,0,1826,1829,5,132,0,0,1827,1829,5,140,0,0,
        1828,1825,1,0,0,0,1828,1827,1,0,0,0,1829,333,1,0,0,0,1830,1831,5,
        68,0,0,1831,1832,5,102,0,0,1832,1833,3,336,168,0,1833,1834,5,103,
        0,0,1834,1835,3,122,61,0,1835,335,1,0,0,0,1836,1841,3,338,169,0,
        1837,1838,5,122,0,0,1838,1840,3,338,169,0,1839,1837,1,0,0,0,1840,
        1843,1,0,0,0,1841,1839,1,0,0,0,1841,1842,1,0,0,0,1842,337,1,0,0,
        0,1843,1841,1,0,0,0,1844,1847,3,340,170,0,1845,1847,3,262,131,0,
        1846,1844,1,0,0,0,1846,1845,1,0,0,0,1847,339,1,0,0,0,1848,1849,5,
        68,0,0,1849,1850,5,102,0,0,1850,1851,3,336,168,0,1851,1852,5,103,
        0,0,1852,1854,1,0,0,0,1853,1848,1,0,0,0,1853,1854,1,0,0,0,1854,1855,
        1,0,0,0,1855,1858,5,21,0,0,1856,1858,5,76,0,0,1857,1853,1,0,0,0,
        1857,1856,1,0,0,0,1858,1870,1,0,0,0,1859,1861,5,131,0,0,1860,1859,
        1,0,0,0,1860,1861,1,0,0,0,1861,1863,1,0,0,0,1862,1864,5,132,0,0,
        1863,1862,1,0,0,0,1863,1864,1,0,0,0,1864,1871,1,0,0,0,1865,1867,
        5,132,0,0,1866,1865,1,0,0,0,1866,1867,1,0,0,0,1867,1868,1,0,0,0,
        1868,1869,5,101,0,0,1869,1871,3,246,123,0,1870,1860,1,0,0,0,1870,
        1866,1,0,0,0,1871,341,1,0,0,0,1872,1873,3,346,173,0,1873,1875,5,
        102,0,0,1874,1876,3,348,174,0,1875,1874,1,0,0,0,1875,1876,1,0,0,
        0,1876,1877,1,0,0,0,1877,1878,5,103,0,0,1878,343,1,0,0,0,1879,1891,
        3,342,171,0,1880,1883,3,330,165,0,1881,1883,3,332,166,0,1882,1880,
        1,0,0,0,1882,1881,1,0,0,0,1883,1884,1,0,0,0,1884,1886,5,102,0,0,
        1885,1887,3,348,174,0,1886,1885,1,0,0,0,1886,1887,1,0,0,0,1887,1888,
        1,0,0,0,1888,1889,5,103,0,0,1889,1891,1,0,0,0,1890,1879,1,0,0,0,
        1890,1882,1,0,0,0,1891,345,1,0,0,0,1892,1893,5,132,0,0,1893,347,
        1,0,0,0,1894,1896,3,350,175,0,1895,1897,5,131,0,0,1896,1895,1,0,
        0,0,1896,1897,1,0,0,0,1897,1905,1,0,0,0,1898,1899,5,122,0,0,1899,
        1901,3,350,175,0,1900,1902,5,131,0,0,1901,1900,1,0,0,0,1901,1902,
        1,0,0,0,1902,1904,1,0,0,0,1903,1898,1,0,0,0,1904,1907,1,0,0,0,1905,
        1903,1,0,0,0,1905,1906,1,0,0,0,1906,349,1,0,0,0,1907,1905,1,0,0,
        0,1908,1912,3,246,123,0,1909,1912,3,92,46,0,1910,1912,3,4,2,0,1911,
        1908,1,0,0,0,1911,1909,1,0,0,0,1911,1910,1,0,0,0,1912,351,1,0,0,
        0,1913,1914,5,76,0,0,1914,1920,3,10,5,0,1915,1921,5,132,0,0,1916,
        1918,5,68,0,0,1917,1916,1,0,0,0,1917,1918,1,0,0,0,1918,1919,1,0,
        0,0,1919,1921,3,342,171,0,1920,1915,1,0,0,0,1920,1917,1,0,0,0,1921,
        353,1,0,0,0,1922,1924,5,36,0,0,1923,1922,1,0,0,0,1923,1924,1,0,0,
        0,1924,1925,1,0,0,0,1925,1926,5,68,0,0,1926,1927,3,122,61,0,1927,
        355,1,0,0,0,1928,1929,5,68,0,0,1929,1930,5,102,0,0,1930,1931,5,103,
        0,0,1931,1932,3,122,61,0,1932,357,1,0,0,0,1933,1934,5,73,0,0,1934,
        1935,3,100,50,0,1935,1936,3,362,181,0,1936,359,1,0,0,0,1937,1939,
        5,73,0,0,1938,1940,3,322,161,0,1939,1938,1,0,0,0,1939,1940,1,0,0,
        0,1940,1941,1,0,0,0,1941,1942,3,100,50,0,1942,1943,3,362,181,0,1943,
        361,1,0,0,0,1944,1946,3,364,182,0,1945,1944,1,0,0,0,1946,1947,1,
        0,0,0,1947,1945,1,0,0,0,1947,1948,1,0,0,0,1948,363,1,0,0,0,1949,
        1950,5,17,0,0,1950,1951,5,85,0,0,1951,1952,3,366,183,0,1952,1953,
        5,86,0,0,1953,1954,3,100,50,0,1954,365,1,0,0,0,1955,1957,3,204,102,
        0,1956,1955,1,0,0,0,1956,1957,1,0,0,0,1957,1958,1,0,0,0,1958,1961,
        3,150,75,0,1959,1962,3,226,113,0,1960,1962,3,248,124,0,1961,1959,
        1,0,0,0,1961,1960,1,0,0,0,1961,1962,1,0,0,0,1962,1965,1,0,0,0,1963,
        1965,5,131,0,0,1964,1956,1,0,0,0,1964,1963,1,0,0,0,1965,367,1,0,
        0,0,1966,1968,5,71,0,0,1967,1969,3,86,43,0,1968,1967,1,0,0,0,1968,
        1969,1,0,0,0,1969,369,1,0,0,0,1970,1973,3,372,186,0,1971,1973,3,
        376,188,0,1972,1970,1,0,0,0,1972,1971,1,0,0,0,1973,371,1,0,0,0,1974,
        1975,5,71,0,0,1975,1977,5,85,0,0,1976,1978,3,374,187,0,1977,1976,
        1,0,0,0,1977,1978,1,0,0,0,1978,1979,1,0,0,0,1979,1980,5,86,0,0,1980,
        373,1,0,0,0,1981,1983,3,246,123,0,1982,1984,5,131,0,0,1983,1982,
        1,0,0,0,1983,1984,1,0,0,0,1984,1992,1,0,0,0,1985,1986,5,122,0,0,
        1986,1988,3,246,123,0,1987,1989,5,131,0,0,1988,1987,1,0,0,0,1988,
        1989,1,0,0,0,1989,1991,1,0,0,0,1990,1985,1,0,0,0,1991,1994,1,0,0,
        0,1992,1990,1,0,0,0,1992,1993,1,0,0,0,1993,375,1,0,0,0,1994,1992,
        1,0,0,0,1995,1996,5,50,0,0,1996,1997,5,85,0,0,1997,1998,3,92,46,
        0,1998,1999,5,86,0,0,1999,2002,1,0,0,0,2000,2002,5,50,0,0,2001,1995,
        1,0,0,0,2001,2000,1,0,0,0,2002,377,1,0,0,0,2003,2006,5,49,0,0,2004,
        2005,5,87,0,0,2005,2007,5,88,0,0,2006,2004,1,0,0,0,2006,2007,1,0,
        0,0,2007,2055,1,0,0,0,2008,2011,5,28,0,0,2009,2010,5,87,0,0,2010,
        2012,5,88,0,0,2011,2009,1,0,0,0,2011,2012,1,0,0,0,2012,2055,1,0,
        0,0,2013,2055,5,91,0,0,2014,2055,5,92,0,0,2015,2055,5,93,0,0,2016,
        2055,5,94,0,0,2017,2055,5,95,0,0,2018,2055,5,96,0,0,2019,2055,5,
        97,0,0,2020,2055,5,98,0,0,2021,2055,5,99,0,0,2022,2055,5,100,0,0,
        2023,2055,5,101,0,0,2024,2055,5,103,0,0,2025,2055,5,102,0,0,2026,
        2055,5,117,0,0,2027,2055,5,104,0,0,2028,2055,5,105,0,0,2029,2055,
        5,106,0,0,2030,2055,5,108,0,0,2031,2055,5,109,0,0,2032,2055,5,110,
        0,0,2033,2055,5,111,0,0,2034,2035,5,102,0,0,2035,2055,5,102,0,0,
        2036,2037,5,103,0,0,2037,2055,5,103,0,0,2038,2055,5,113,0,0,2039,
        2055,5,112,0,0,2040,2055,5,114,0,0,2041,2055,5,115,0,0,2042,2055,
        5,116,0,0,2043,2055,5,118,0,0,2044,2055,5,119,0,0,2045,2055,5,120,
        0,0,2046,2055,5,121,0,0,2047,2055,5,122,0,0,2048,2055,5,123,0,0,
        2049,2055,5,124,0,0,2050,2051,5,85,0,0,2051,2055,5,86,0,0,2052,2053,
        5,87,0,0,2053,2055,5,88,0,0,2054,2003,1,0,0,0,2054,2008,1,0,0,0,
        2054,2013,1,0,0,0,2054,2014,1,0,0,0,2054,2015,1,0,0,0,2054,2016,
        1,0,0,0,2054,2017,1,0,0,0,2054,2018,1,0,0,0,2054,2019,1,0,0,0,2054,
        2020,1,0,0,0,2054,2021,1,0,0,0,2054,2022,1,0,0,0,2054,2023,1,0,0,
        0,2054,2024,1,0,0,0,2054,2025,1,0,0,0,2054,2026,1,0,0,0,2054,2027,
        1,0,0,0,2054,2028,1,0,0,0,2054,2029,1,0,0,0,2054,2030,1,0,0,0,2054,
        2031,1,0,0,0,2054,2032,1,0,0,0,2054,2033,1,0,0,0,2054,2034,1,0,0,
        0,2054,2036,1,0,0,0,2054,2038,1,0,0,0,2054,2039,1,0,0,0,2054,2040,
        1,0,0,0,2054,2041,1,0,0,0,2054,2042,1,0,0,0,2054,2043,1,0,0,0,2054,
        2044,1,0,0,0,2054,2045,1,0,0,0,2054,2046,1,0,0,0,2054,2047,1,0,0,
        0,2054,2048,1,0,0,0,2054,2049,1,0,0,0,2054,2050,1,0,0,0,2054,2052,
        1,0,0,0,2055,379,1,0,0,0,2056,2057,7,22,0,0,2057,381,1,0,0,0,292,
        383,390,399,403,412,415,419,427,434,437,442,447,453,461,463,472,
        476,480,483,487,490,497,501,504,507,510,516,520,524,538,542,548,
        555,561,565,569,571,579,584,597,604,616,626,631,635,642,645,653,
        657,660,667,674,678,683,687,690,695,710,717,725,733,742,749,756,
        764,772,780,788,796,804,813,821,830,838,846,848,851,857,863,869,
        876,885,893,897,904,906,926,930,936,941,945,948,955,962,966,975,
        986,996,1001,1008,1011,1016,1021,1042,1047,1050,1061,1067,1072,1075,
        1080,1083,1090,1113,1119,1125,1131,1134,1140,1144,1148,1151,1159,
        1161,1167,1170,1173,1176,1180,1184,1190,1200,1206,1212,1217,1222,
        1226,1239,1245,1249,1255,1260,1275,1279,1284,1289,1294,1300,1303,
        1312,1316,1321,1325,1331,1338,1355,1357,1364,1369,1376,1380,1384,
        1392,1398,1404,1408,1410,1414,1419,1423,1426,1429,1432,1437,1441,
        1444,1448,1451,1453,1458,1465,1471,1475,1481,1486,1491,1498,1503,
        1507,1509,1511,1517,1526,1530,1532,1534,1539,1542,1549,1553,1558,
        1560,1564,1567,1570,1574,1579,1586,1593,1598,1602,1606,1611,1615,
        1621,1623,1629,1634,1640,1644,1646,1649,1653,1657,1659,1661,1664,
        1676,1678,1681,1684,1687,1696,1703,1709,1713,1716,1719,1723,1728,
        1740,1745,1749,1753,1758,1763,1767,1770,1774,1785,1789,1796,1801,
        1805,1811,1815,1819,1828,1841,1846,1853,1857,1860,1863,1866,1870,
        1875,1882,1886,1890,1896,1901,1905,1911,1917,1920,1923,1939,1947,
        1956,1961,1964,1968,1972,1977,1983,1988,1992,2001,2006,2011,2054
    ];

    private static __ATN: antlr.ATN;
    public static get _ATN(): antlr.ATN {
        if (!CPP14Parser.__ATN) {
            CPP14Parser.__ATN = new antlr.ATNDeserializer().deserialize(CPP14Parser._serializedATN);
        }

        return CPP14Parser.__ATN;
    }


    private static readonly vocabulary = new antlr.Vocabulary(CPP14Parser.literalNames, CPP14Parser.symbolicNames, []);

    public override get vocabulary(): antlr.Vocabulary {
        return CPP14Parser.vocabulary;
    }

    private static readonly decisionsToDFA = CPP14Parser._ATN.decisionToState.map( (ds: antlr.DecisionState, index: number) => new antlr.DFA(ds, index) );
}

export class TranslationUnitContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public EOF(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.EOF, 0)!;
    }
    public declarationseq(): DeclarationseqContext | null {
        return this.getRuleContext(0, DeclarationseqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_translationUnit;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTranslationUnit) {
             listener.enterTranslationUnit(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTranslationUnit) {
             listener.exitTranslationUnit(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTranslationUnit) {
            return visitor.visitTranslationUnit(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PrimaryExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public literal(): LiteralContext[];
    public literal(i: number): LiteralContext | null;
    public literal(i?: number): LiteralContext[] | LiteralContext | null {
        if (i === undefined) {
            return this.getRuleContexts(LiteralContext);
        }

        return this.getRuleContext(i, LiteralContext);
    }
    public This(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.This, 0);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftParen, 0);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightParen, 0);
    }
    public idExpression(): IdExpressionContext | null {
        return this.getRuleContext(0, IdExpressionContext);
    }
    public lambdaExpression(): LambdaExpressionContext | null {
        return this.getRuleContext(0, LambdaExpressionContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_primaryExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterPrimaryExpression) {
             listener.enterPrimaryExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitPrimaryExpression) {
             listener.exitPrimaryExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitPrimaryExpression) {
            return visitor.visitPrimaryExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class IdExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public unqualifiedId(): UnqualifiedIdContext | null {
        return this.getRuleContext(0, UnqualifiedIdContext);
    }
    public qualifiedId(): QualifiedIdContext | null {
        return this.getRuleContext(0, QualifiedIdContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_idExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterIdExpression) {
             listener.enterIdExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitIdExpression) {
             listener.exitIdExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitIdExpression) {
            return visitor.visitIdExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class UnqualifiedIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public operatorFunctionId(): OperatorFunctionIdContext | null {
        return this.getRuleContext(0, OperatorFunctionIdContext);
    }
    public conversionFunctionId(): ConversionFunctionIdContext | null {
        return this.getRuleContext(0, ConversionFunctionIdContext);
    }
    public literalOperatorId(): LiteralOperatorIdContext | null {
        return this.getRuleContext(0, LiteralOperatorIdContext);
    }
    public Tilde(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Tilde, 0);
    }
    public className(): ClassNameContext | null {
        return this.getRuleContext(0, ClassNameContext);
    }
    public decltypeSpecifier(): DecltypeSpecifierContext | null {
        return this.getRuleContext(0, DecltypeSpecifierContext);
    }
    public templateId(): TemplateIdContext | null {
        return this.getRuleContext(0, TemplateIdContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_unqualifiedId;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterUnqualifiedId) {
             listener.enterUnqualifiedId(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitUnqualifiedId) {
             listener.exitUnqualifiedId(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitUnqualifiedId) {
            return visitor.visitUnqualifiedId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class QualifiedIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext {
        return this.getRuleContext(0, NestedNameSpecifierContext)!;
    }
    public unqualifiedId(): UnqualifiedIdContext {
        return this.getRuleContext(0, UnqualifiedIdContext)!;
    }
    public Template(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Template, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_qualifiedId;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterQualifiedId) {
             listener.enterQualifiedId(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitQualifiedId) {
             listener.exitQualifiedId(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitQualifiedId) {
            return visitor.visitQualifiedId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NestedNameSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Doublecolon(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Doublecolon, 0)!;
    }
    public theTypeName(): TheTypeNameContext | null {
        return this.getRuleContext(0, TheTypeNameContext);
    }
    public namespaceName(): NamespaceNameContext | null {
        return this.getRuleContext(0, NamespaceNameContext);
    }
    public decltypeSpecifier(): DecltypeSpecifierContext | null {
        return this.getRuleContext(0, DecltypeSpecifierContext);
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext | null {
        return this.getRuleContext(0, NestedNameSpecifierContext);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public simpleTemplateId(): SimpleTemplateIdContext | null {
        return this.getRuleContext(0, SimpleTemplateIdContext);
    }
    public Template(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Template, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_nestedNameSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNestedNameSpecifier) {
             listener.enterNestedNameSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNestedNameSpecifier) {
             listener.exitNestedNameSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNestedNameSpecifier) {
            return visitor.visitNestedNameSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LambdaExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public lambdaIntroducer(): LambdaIntroducerContext {
        return this.getRuleContext(0, LambdaIntroducerContext)!;
    }
    public compoundStatement(): CompoundStatementContext {
        return this.getRuleContext(0, CompoundStatementContext)!;
    }
    public lambdaDeclarator(): LambdaDeclaratorContext | null {
        return this.getRuleContext(0, LambdaDeclaratorContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_lambdaExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterLambdaExpression) {
             listener.enterLambdaExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitLambdaExpression) {
             listener.exitLambdaExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitLambdaExpression) {
            return visitor.visitLambdaExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LambdaIntroducerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftBracket(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftBracket, 0)!;
    }
    public RightBracket(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightBracket, 0)!;
    }
    public lambdaCapture(): LambdaCaptureContext | null {
        return this.getRuleContext(0, LambdaCaptureContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_lambdaIntroducer;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterLambdaIntroducer) {
             listener.enterLambdaIntroducer(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitLambdaIntroducer) {
             listener.exitLambdaIntroducer(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitLambdaIntroducer) {
            return visitor.visitLambdaIntroducer(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LambdaCaptureContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public captureList(): CaptureListContext | null {
        return this.getRuleContext(0, CaptureListContext);
    }
    public captureDefault(): CaptureDefaultContext | null {
        return this.getRuleContext(0, CaptureDefaultContext);
    }
    public Comma(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Comma, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_lambdaCapture;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterLambdaCapture) {
             listener.enterLambdaCapture(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitLambdaCapture) {
             listener.exitLambdaCapture(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitLambdaCapture) {
            return visitor.visitLambdaCapture(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CaptureDefaultContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public And(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.And, 0);
    }
    public Assign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Assign, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_captureDefault;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterCaptureDefault) {
             listener.enterCaptureDefault(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitCaptureDefault) {
             listener.exitCaptureDefault(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitCaptureDefault) {
            return visitor.visitCaptureDefault(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CaptureListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public capture(): CaptureContext[];
    public capture(i: number): CaptureContext | null;
    public capture(i?: number): CaptureContext[] | CaptureContext | null {
        if (i === undefined) {
            return this.getRuleContexts(CaptureContext);
        }

        return this.getRuleContext(i, CaptureContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public Ellipsis(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Ellipsis, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_captureList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterCaptureList) {
             listener.enterCaptureList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitCaptureList) {
             listener.exitCaptureList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitCaptureList) {
            return visitor.visitCaptureList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CaptureContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public simpleCapture(): SimpleCaptureContext | null {
        return this.getRuleContext(0, SimpleCaptureContext);
    }
    public initcapture(): InitcaptureContext | null {
        return this.getRuleContext(0, InitcaptureContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_capture;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterCapture) {
             listener.enterCapture(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitCapture) {
             listener.exitCapture(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitCapture) {
            return visitor.visitCapture(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SimpleCaptureContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public And(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.And, 0);
    }
    public This(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.This, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_simpleCapture;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterSimpleCapture) {
             listener.enterSimpleCapture(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitSimpleCapture) {
             listener.exitSimpleCapture(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitSimpleCapture) {
            return visitor.visitSimpleCapture(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class InitcaptureContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Identifier, 0)!;
    }
    public initializer(): InitializerContext {
        return this.getRuleContext(0, InitializerContext)!;
    }
    public And(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.And, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_initcapture;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterInitcapture) {
             listener.enterInitcapture(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitInitcapture) {
             listener.exitInitcapture(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitInitcapture) {
            return visitor.visitInitcapture(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LambdaDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
    }
    public parameterDeclarationClause(): ParameterDeclarationClauseContext | null {
        return this.getRuleContext(0, ParameterDeclarationClauseContext);
    }
    public Mutable(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Mutable, 0);
    }
    public exceptionSpecification(): ExceptionSpecificationContext | null {
        return this.getRuleContext(0, ExceptionSpecificationContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public trailingReturnType(): TrailingReturnTypeContext | null {
        return this.getRuleContext(0, TrailingReturnTypeContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_lambdaDeclarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterLambdaDeclarator) {
             listener.enterLambdaDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitLambdaDeclarator) {
             listener.exitLambdaDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitLambdaDeclarator) {
            return visitor.visitLambdaDeclarator(this);
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
    public simpleTypeSpecifier(): SimpleTypeSpecifierContext | null {
        return this.getRuleContext(0, SimpleTypeSpecifierContext);
    }
    public typeNameSpecifier(): TypeNameSpecifierContext | null {
        return this.getRuleContext(0, TypeNameSpecifierContext);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftParen, 0);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightParen, 0);
    }
    public bracedInitList(): BracedInitListContext | null {
        return this.getRuleContext(0, BracedInitListContext);
    }
    public expressionList(): ExpressionListContext | null {
        return this.getRuleContext(0, ExpressionListContext);
    }
    public Less(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Less, 0);
    }
    public theTypeId(): TheTypeIdContext | null {
        return this.getRuleContext(0, TheTypeIdContext);
    }
    public Greater(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Greater, 0);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public Dynamic_cast(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Dynamic_cast, 0);
    }
    public Static_cast(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Static_cast, 0);
    }
    public Reinterpret_cast(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Reinterpret_cast, 0);
    }
    public Const_cast(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Const_cast, 0);
    }
    public typeIdOfTheTypeId(): TypeIdOfTheTypeIdContext | null {
        return this.getRuleContext(0, TypeIdOfTheTypeIdContext);
    }
    public postfixExpression(): PostfixExpressionContext | null {
        return this.getRuleContext(0, PostfixExpressionContext);
    }
    public LeftBracket(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftBracket, 0);
    }
    public RightBracket(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightBracket, 0);
    }
    public Dot(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Dot, 0);
    }
    public Arrow(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Arrow, 0);
    }
    public idExpression(): IdExpressionContext | null {
        return this.getRuleContext(0, IdExpressionContext);
    }
    public pseudoDestructorName(): PseudoDestructorNameContext | null {
        return this.getRuleContext(0, PseudoDestructorNameContext);
    }
    public Template(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Template, 0);
    }
    public PlusPlus(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.PlusPlus, 0);
    }
    public MinusMinus(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.MinusMinus, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_postfixExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterPostfixExpression) {
             listener.enterPostfixExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitPostfixExpression) {
             listener.exitPostfixExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitPostfixExpression) {
            return visitor.visitPostfixExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeIdOfTheTypeIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Typeid_(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Typeid_, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_typeIdOfTheTypeId;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTypeIdOfTheTypeId) {
             listener.enterTypeIdOfTheTypeId(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTypeIdOfTheTypeId) {
             listener.exitTypeIdOfTheTypeId(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTypeIdOfTheTypeId) {
            return visitor.visitTypeIdOfTheTypeId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExpressionListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public initializerList(): InitializerListContext {
        return this.getRuleContext(0, InitializerListContext)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_expressionList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterExpressionList) {
             listener.enterExpressionList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitExpressionList) {
             listener.exitExpressionList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitExpressionList) {
            return visitor.visitExpressionList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PseudoDestructorNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Tilde(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Tilde, 0)!;
    }
    public theTypeName(): TheTypeNameContext[];
    public theTypeName(i: number): TheTypeNameContext | null;
    public theTypeName(i?: number): TheTypeNameContext[] | TheTypeNameContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TheTypeNameContext);
        }

        return this.getRuleContext(i, TheTypeNameContext);
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext | null {
        return this.getRuleContext(0, NestedNameSpecifierContext);
    }
    public Doublecolon(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Doublecolon, 0);
    }
    public Template(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Template, 0);
    }
    public simpleTemplateId(): SimpleTemplateIdContext | null {
        return this.getRuleContext(0, SimpleTemplateIdContext);
    }
    public decltypeSpecifier(): DecltypeSpecifierContext | null {
        return this.getRuleContext(0, DecltypeSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_pseudoDestructorName;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterPseudoDestructorName) {
             listener.enterPseudoDestructorName(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitPseudoDestructorName) {
             listener.exitPseudoDestructorName(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitPseudoDestructorName) {
            return visitor.visitPseudoDestructorName(this);
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
    public unaryExpression(): UnaryExpressionContext | null {
        return this.getRuleContext(0, UnaryExpressionContext);
    }
    public PlusPlus(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.PlusPlus, 0);
    }
    public MinusMinus(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.MinusMinus, 0);
    }
    public unaryOperator(): UnaryOperatorContext | null {
        return this.getRuleContext(0, UnaryOperatorContext);
    }
    public Sizeof(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Sizeof, 0);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftParen, 0);
    }
    public theTypeId(): TheTypeIdContext | null {
        return this.getRuleContext(0, TheTypeIdContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightParen, 0);
    }
    public Ellipsis(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Ellipsis, 0);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public Alignof(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Alignof, 0);
    }
    public noExceptExpression(): NoExceptExpressionContext | null {
        return this.getRuleContext(0, NoExceptExpressionContext);
    }
    public newExpression_(): NewExpression_Context | null {
        return this.getRuleContext(0, NewExpression_Context);
    }
    public deleteExpression(): DeleteExpressionContext | null {
        return this.getRuleContext(0, DeleteExpressionContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_unaryExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterUnaryExpression) {
             listener.enterUnaryExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitUnaryExpression) {
             listener.exitUnaryExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    public Or(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Or, 0);
    }
    public Star(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Star, 0);
    }
    public And(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.And, 0);
    }
    public Plus(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Plus, 0);
    }
    public Tilde(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Tilde, 0);
    }
    public Minus(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Minus, 0);
    }
    public Not(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Not, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_unaryOperator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterUnaryOperator) {
             listener.enterUnaryOperator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitUnaryOperator) {
             listener.exitUnaryOperator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitUnaryOperator) {
            return visitor.visitUnaryOperator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NewExpression_Context extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public New(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.New, 0)!;
    }
    public newTypeId(): NewTypeIdContext | null {
        return this.getRuleContext(0, NewTypeIdContext);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftParen, 0);
    }
    public theTypeId(): TheTypeIdContext | null {
        return this.getRuleContext(0, TheTypeIdContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightParen, 0);
    }
    public Doublecolon(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Doublecolon, 0);
    }
    public newPlacement(): NewPlacementContext | null {
        return this.getRuleContext(0, NewPlacementContext);
    }
    public newInitializer_(): NewInitializer_Context | null {
        return this.getRuleContext(0, NewInitializer_Context);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_newExpression_;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNewExpression_) {
             listener.enterNewExpression_(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNewExpression_) {
             listener.exitNewExpression_(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNewExpression_) {
            return visitor.visitNewExpression_(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NewPlacementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public expressionList(): ExpressionListContext {
        return this.getRuleContext(0, ExpressionListContext)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_newPlacement;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNewPlacement) {
             listener.enterNewPlacement(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNewPlacement) {
             listener.exitNewPlacement(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNewPlacement) {
            return visitor.visitNewPlacement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NewTypeIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public typeSpecifierSeq(): TypeSpecifierSeqContext {
        return this.getRuleContext(0, TypeSpecifierSeqContext)!;
    }
    public newDeclarator_(): NewDeclarator_Context | null {
        return this.getRuleContext(0, NewDeclarator_Context);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_newTypeId;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNewTypeId) {
             listener.enterNewTypeId(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNewTypeId) {
             listener.exitNewTypeId(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNewTypeId) {
            return visitor.visitNewTypeId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NewDeclarator_Context extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public pointerOperator(): PointerOperatorContext | null {
        return this.getRuleContext(0, PointerOperatorContext);
    }
    public newDeclarator_(): NewDeclarator_Context | null {
        return this.getRuleContext(0, NewDeclarator_Context);
    }
    public noPointerNewDeclarator(): NoPointerNewDeclaratorContext | null {
        return this.getRuleContext(0, NoPointerNewDeclaratorContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_newDeclarator_;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNewDeclarator_) {
             listener.enterNewDeclarator_(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNewDeclarator_) {
             listener.exitNewDeclarator_(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNewDeclarator_) {
            return visitor.visitNewDeclarator_(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NoPointerNewDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftBracket(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftBracket, 0)!;
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public RightBracket(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightBracket, 0)!;
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public noPointerNewDeclarator(): NoPointerNewDeclaratorContext | null {
        return this.getRuleContext(0, NoPointerNewDeclaratorContext);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_noPointerNewDeclarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNoPointerNewDeclarator) {
             listener.enterNoPointerNewDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNoPointerNewDeclarator) {
             listener.exitNoPointerNewDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNoPointerNewDeclarator) {
            return visitor.visitNoPointerNewDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NewInitializer_Context extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftParen, 0);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightParen, 0);
    }
    public expressionList(): ExpressionListContext | null {
        return this.getRuleContext(0, ExpressionListContext);
    }
    public bracedInitList(): BracedInitListContext | null {
        return this.getRuleContext(0, BracedInitListContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_newInitializer_;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNewInitializer_) {
             listener.enterNewInitializer_(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNewInitializer_) {
             listener.exitNewInitializer_(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNewInitializer_) {
            return visitor.visitNewInitializer_(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeleteExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Delete(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Delete, 0)!;
    }
    public castExpression(): CastExpressionContext {
        return this.getRuleContext(0, CastExpressionContext)!;
    }
    public Doublecolon(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Doublecolon, 0);
    }
    public LeftBracket(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftBracket, 0);
    }
    public RightBracket(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightBracket, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_deleteExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterDeleteExpression) {
             listener.enterDeleteExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitDeleteExpression) {
             listener.exitDeleteExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitDeleteExpression) {
            return visitor.visitDeleteExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NoExceptExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Noexcept(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Noexcept, 0)!;
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public expression(): ExpressionContext {
        return this.getRuleContext(0, ExpressionContext)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_noExceptExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNoExceptExpression) {
             listener.enterNoExceptExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNoExceptExpression) {
             listener.exitNoExceptExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNoExceptExpression) {
            return visitor.visitNoExceptExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CastExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public unaryExpression(): UnaryExpressionContext | null {
        return this.getRuleContext(0, UnaryExpressionContext);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftParen, 0);
    }
    public theTypeId(): TheTypeIdContext | null {
        return this.getRuleContext(0, TheTypeIdContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightParen, 0);
    }
    public castExpression(): CastExpressionContext | null {
        return this.getRuleContext(0, CastExpressionContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_castExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterCastExpression) {
             listener.enterCastExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitCastExpression) {
             listener.exitCastExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitCastExpression) {
            return visitor.visitCastExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PointerMemberExpressionContext extends antlr.ParserRuleContext {
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
    public DotStar(): antlr.TerminalNode[];
    public DotStar(i: number): antlr.TerminalNode | null;
    public DotStar(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.DotStar);
    	} else {
    		return this.getToken(CPP14Parser.DotStar, i);
    	}
    }
    public ArrowStar(): antlr.TerminalNode[];
    public ArrowStar(i: number): antlr.TerminalNode | null;
    public ArrowStar(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.ArrowStar);
    	} else {
    		return this.getToken(CPP14Parser.ArrowStar, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_pointerMemberExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterPointerMemberExpression) {
             listener.enterPointerMemberExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitPointerMemberExpression) {
             listener.exitPointerMemberExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitPointerMemberExpression) {
            return visitor.visitPointerMemberExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MultiplicativeExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public pointerMemberExpression(): PointerMemberExpressionContext[];
    public pointerMemberExpression(i: number): PointerMemberExpressionContext | null;
    public pointerMemberExpression(i?: number): PointerMemberExpressionContext[] | PointerMemberExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PointerMemberExpressionContext);
        }

        return this.getRuleContext(i, PointerMemberExpressionContext);
    }
    public Star(): antlr.TerminalNode[];
    public Star(i: number): antlr.TerminalNode | null;
    public Star(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Star);
    	} else {
    		return this.getToken(CPP14Parser.Star, i);
    	}
    }
    public Div(): antlr.TerminalNode[];
    public Div(i: number): antlr.TerminalNode | null;
    public Div(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Div);
    	} else {
    		return this.getToken(CPP14Parser.Div, i);
    	}
    }
    public Mod(): antlr.TerminalNode[];
    public Mod(i: number): antlr.TerminalNode | null;
    public Mod(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Mod);
    	} else {
    		return this.getToken(CPP14Parser.Mod, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_multiplicativeExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterMultiplicativeExpression) {
             listener.enterMultiplicativeExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitMultiplicativeExpression) {
             listener.exitMultiplicativeExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    		return this.getTokens(CPP14Parser.Plus);
    	} else {
    		return this.getToken(CPP14Parser.Plus, i);
    	}
    }
    public Minus(): antlr.TerminalNode[];
    public Minus(i: number): antlr.TerminalNode | null;
    public Minus(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Minus);
    	} else {
    		return this.getToken(CPP14Parser.Minus, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_additiveExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAdditiveExpression) {
             listener.enterAdditiveExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAdditiveExpression) {
             listener.exitAdditiveExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    public shiftOperator(): ShiftOperatorContext[];
    public shiftOperator(i: number): ShiftOperatorContext | null;
    public shiftOperator(i?: number): ShiftOperatorContext[] | ShiftOperatorContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ShiftOperatorContext);
        }

        return this.getRuleContext(i, ShiftOperatorContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_shiftExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterShiftExpression) {
             listener.enterShiftExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitShiftExpression) {
             listener.exitShiftExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitShiftExpression) {
            return visitor.visitShiftExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ShiftOperatorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Greater(): antlr.TerminalNode[];
    public Greater(i: number): antlr.TerminalNode | null;
    public Greater(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Greater);
    	} else {
    		return this.getToken(CPP14Parser.Greater, i);
    	}
    }
    public Less(): antlr.TerminalNode[];
    public Less(i: number): antlr.TerminalNode | null;
    public Less(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Less);
    	} else {
    		return this.getToken(CPP14Parser.Less, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_shiftOperator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterShiftOperator) {
             listener.enterShiftOperator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitShiftOperator) {
             listener.exitShiftOperator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitShiftOperator) {
            return visitor.visitShiftOperator(this);
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
    		return this.getTokens(CPP14Parser.Less);
    	} else {
    		return this.getToken(CPP14Parser.Less, i);
    	}
    }
    public Greater(): antlr.TerminalNode[];
    public Greater(i: number): antlr.TerminalNode | null;
    public Greater(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Greater);
    	} else {
    		return this.getToken(CPP14Parser.Greater, i);
    	}
    }
    public LessEqual(): antlr.TerminalNode[];
    public LessEqual(i: number): antlr.TerminalNode | null;
    public LessEqual(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.LessEqual);
    	} else {
    		return this.getToken(CPP14Parser.LessEqual, i);
    	}
    }
    public GreaterEqual(): antlr.TerminalNode[];
    public GreaterEqual(i: number): antlr.TerminalNode | null;
    public GreaterEqual(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.GreaterEqual);
    	} else {
    		return this.getToken(CPP14Parser.GreaterEqual, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_relationalExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterRelationalExpression) {
             listener.enterRelationalExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitRelationalExpression) {
             listener.exitRelationalExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    		return this.getTokens(CPP14Parser.Equal);
    	} else {
    		return this.getToken(CPP14Parser.Equal, i);
    	}
    }
    public NotEqual(): antlr.TerminalNode[];
    public NotEqual(i: number): antlr.TerminalNode | null;
    public NotEqual(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.NotEqual);
    	} else {
    		return this.getToken(CPP14Parser.NotEqual, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_equalityExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterEqualityExpression) {
             listener.enterEqualityExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitEqualityExpression) {
             listener.exitEqualityExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    		return this.getTokens(CPP14Parser.And);
    	} else {
    		return this.getToken(CPP14Parser.And, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_andExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAndExpression) {
             listener.enterAndExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAndExpression) {
             listener.exitAndExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    		return this.getTokens(CPP14Parser.Caret);
    	} else {
    		return this.getToken(CPP14Parser.Caret, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_exclusiveOrExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterExclusiveOrExpression) {
             listener.enterExclusiveOrExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitExclusiveOrExpression) {
             listener.exitExclusiveOrExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    		return this.getTokens(CPP14Parser.Or);
    	} else {
    		return this.getToken(CPP14Parser.Or, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_inclusiveOrExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterInclusiveOrExpression) {
             listener.enterInclusiveOrExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitInclusiveOrExpression) {
             listener.exitInclusiveOrExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    		return this.getTokens(CPP14Parser.AndAnd);
    	} else {
    		return this.getToken(CPP14Parser.AndAnd, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_logicalAndExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterLogicalAndExpression) {
             listener.enterLogicalAndExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitLogicalAndExpression) {
             listener.exitLogicalAndExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    		return this.getTokens(CPP14Parser.OrOr);
    	} else {
    		return this.getToken(CPP14Parser.OrOr, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_logicalOrExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterLogicalOrExpression) {
             listener.enterLogicalOrExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitLogicalOrExpression) {
             listener.exitLogicalOrExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
        return this.getToken(CPP14Parser.Question, 0);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public Colon(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Colon, 0);
    }
    public assignmentExpression(): AssignmentExpressionContext | null {
        return this.getRuleContext(0, AssignmentExpressionContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_conditionalExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterConditionalExpression) {
             listener.enterConditionalExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitConditionalExpression) {
             listener.exitConditionalExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    public logicalOrExpression(): LogicalOrExpressionContext | null {
        return this.getRuleContext(0, LogicalOrExpressionContext);
    }
    public assignmentOperator(): AssignmentOperatorContext | null {
        return this.getRuleContext(0, AssignmentOperatorContext);
    }
    public initializerClause(): InitializerClauseContext | null {
        return this.getRuleContext(0, InitializerClauseContext);
    }
    public throwExpression(): ThrowExpressionContext | null {
        return this.getRuleContext(0, ThrowExpressionContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_assignmentExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAssignmentExpression) {
             listener.enterAssignmentExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAssignmentExpression) {
             listener.exitAssignmentExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
        return this.getToken(CPP14Parser.Assign, 0);
    }
    public StarAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.StarAssign, 0);
    }
    public DivAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.DivAssign, 0);
    }
    public ModAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.ModAssign, 0);
    }
    public PlusAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.PlusAssign, 0);
    }
    public MinusAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.MinusAssign, 0);
    }
    public RightShiftAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightShiftAssign, 0);
    }
    public LeftShiftAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftShiftAssign, 0);
    }
    public AndAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.AndAssign, 0);
    }
    public XorAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.XorAssign, 0);
    }
    public OrAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.OrAssign, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_assignmentOperator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAssignmentOperator) {
             listener.enterAssignmentOperator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAssignmentOperator) {
             listener.exitAssignmentOperator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_expression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterExpression) {
             listener.enterExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitExpression) {
             listener.exitExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
        return CPP14Parser.RULE_constantExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterConstantExpression) {
             listener.enterConstantExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitConstantExpression) {
             listener.exitConstantExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitConstantExpression) {
            return visitor.visitConstantExpression(this);
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
    public declarationStatement(): DeclarationStatementContext | null {
        return this.getRuleContext(0, DeclarationStatementContext);
    }
    public expressionStatement(): ExpressionStatementContext | null {
        return this.getRuleContext(0, ExpressionStatementContext);
    }
    public compoundStatement(): CompoundStatementContext | null {
        return this.getRuleContext(0, CompoundStatementContext);
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
    public tryBlock(): TryBlockContext | null {
        return this.getRuleContext(0, TryBlockContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_statement;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterStatement) {
             listener.enterStatement(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitStatement) {
             listener.exitStatement(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    public Colon(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Colon, 0)!;
    }
    public statement(): StatementContext {
        return this.getRuleContext(0, StatementContext)!;
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public Case(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Case, 0);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public Default(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Default, 0);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_labeledStatement;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterLabeledStatement) {
             listener.enterLabeledStatement(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitLabeledStatement) {
             listener.exitLabeledStatement(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitLabeledStatement) {
            return visitor.visitLabeledStatement(this);
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
        return this.getToken(CPP14Parser.Semi, 0)!;
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_expressionStatement;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterExpressionStatement) {
             listener.enterExpressionStatement(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitExpressionStatement) {
             listener.exitExpressionStatement(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitExpressionStatement) {
            return visitor.visitExpressionStatement(this);
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
        return this.getToken(CPP14Parser.LeftBrace, 0)!;
    }
    public RightBrace(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightBrace, 0)!;
    }
    public statementSeq(): StatementSeqContext | null {
        return this.getRuleContext(0, StatementSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_compoundStatement;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterCompoundStatement) {
             listener.enterCompoundStatement(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitCompoundStatement) {
             listener.exitCompoundStatement(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitCompoundStatement) {
            return visitor.visitCompoundStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StatementSeqContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
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
        return CPP14Parser.RULE_statementSeq;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterStatementSeq) {
             listener.enterStatementSeq(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitStatementSeq) {
             listener.exitStatementSeq(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitStatementSeq) {
            return visitor.visitStatementSeq(this);
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
        return this.getToken(CPP14Parser.If, 0);
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public condition(): ConditionContext {
        return this.getRuleContext(0, ConditionContext)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
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
        return this.getToken(CPP14Parser.Else, 0);
    }
    public Switch(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Switch, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_selectionStatement;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterSelectionStatement) {
             listener.enterSelectionStatement(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitSelectionStatement) {
             listener.exitSelectionStatement(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitSelectionStatement) {
            return visitor.visitSelectionStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConditionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public declSpecifierSeq(): DeclSpecifierSeqContext | null {
        return this.getRuleContext(0, DeclSpecifierSeqContext);
    }
    public declarator(): DeclaratorContext | null {
        return this.getRuleContext(0, DeclaratorContext);
    }
    public Assign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Assign, 0);
    }
    public initializerClause(): InitializerClauseContext | null {
        return this.getRuleContext(0, InitializerClauseContext);
    }
    public bracedInitList(): BracedInitListContext | null {
        return this.getRuleContext(0, BracedInitListContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_condition;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterCondition) {
             listener.enterCondition(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitCondition) {
             listener.exitCondition(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitCondition) {
            return visitor.visitCondition(this);
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
        return this.getToken(CPP14Parser.While, 0);
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public condition(): ConditionContext | null {
        return this.getRuleContext(0, ConditionContext);
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
    }
    public statement(): StatementContext {
        return this.getRuleContext(0, StatementContext)!;
    }
    public Do(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Do, 0);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public Semi(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Semi, 0);
    }
    public For(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.For, 0);
    }
    public forInitStatement(): ForInitStatementContext | null {
        return this.getRuleContext(0, ForInitStatementContext);
    }
    public forRangeDeclaration(): ForRangeDeclarationContext | null {
        return this.getRuleContext(0, ForRangeDeclarationContext);
    }
    public Colon(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Colon, 0);
    }
    public forRangeInitializer(): ForRangeInitializerContext | null {
        return this.getRuleContext(0, ForRangeInitializerContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_iterationStatement;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterIterationStatement) {
             listener.enterIterationStatement(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitIterationStatement) {
             listener.exitIterationStatement(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitIterationStatement) {
            return visitor.visitIterationStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ForInitStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expressionStatement(): ExpressionStatementContext | null {
        return this.getRuleContext(0, ExpressionStatementContext);
    }
    public simpleDeclaration(): SimpleDeclarationContext | null {
        return this.getRuleContext(0, SimpleDeclarationContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_forInitStatement;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterForInitStatement) {
             listener.enterForInitStatement(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitForInitStatement) {
             listener.exitForInitStatement(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitForInitStatement) {
            return visitor.visitForInitStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ForRangeDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declSpecifierSeq(): DeclSpecifierSeqContext {
        return this.getRuleContext(0, DeclSpecifierSeqContext)!;
    }
    public declarator(): DeclaratorContext {
        return this.getRuleContext(0, DeclaratorContext)!;
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_forRangeDeclaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterForRangeDeclaration) {
             listener.enterForRangeDeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitForRangeDeclaration) {
             listener.exitForRangeDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitForRangeDeclaration) {
            return visitor.visitForRangeDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ForRangeInitializerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public bracedInitList(): BracedInitListContext | null {
        return this.getRuleContext(0, BracedInitListContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_forRangeInitializer;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterForRangeInitializer) {
             listener.enterForRangeInitializer(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitForRangeInitializer) {
             listener.exitForRangeInitializer(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitForRangeInitializer) {
            return visitor.visitForRangeInitializer(this);
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
        return this.getToken(CPP14Parser.Semi, 0)!;
    }
    public Break(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Break, 0);
    }
    public Continue(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Continue, 0);
    }
    public Return(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Return, 0);
    }
    public Goto(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Goto, 0);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public bracedInitList(): BracedInitListContext | null {
        return this.getRuleContext(0, BracedInitListContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_jumpStatement;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterJumpStatement) {
             listener.enterJumpStatement(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitJumpStatement) {
             listener.exitJumpStatement(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitJumpStatement) {
            return visitor.visitJumpStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclarationStatementContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public blockDeclaration(): BlockDeclarationContext {
        return this.getRuleContext(0, BlockDeclarationContext)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_declarationStatement;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterDeclarationStatement) {
             listener.enterDeclarationStatement(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitDeclarationStatement) {
             listener.exitDeclarationStatement(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitDeclarationStatement) {
            return visitor.visitDeclarationStatement(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclarationseqContext extends antlr.ParserRuleContext {
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
        return CPP14Parser.RULE_declarationseq;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterDeclarationseq) {
             listener.enterDeclarationseq(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitDeclarationseq) {
             listener.exitDeclarationseq(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitDeclarationseq) {
            return visitor.visitDeclarationseq(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public blockDeclaration(): BlockDeclarationContext | null {
        return this.getRuleContext(0, BlockDeclarationContext);
    }
    public functionDefinition(): FunctionDefinitionContext | null {
        return this.getRuleContext(0, FunctionDefinitionContext);
    }
    public templateDeclaration(): TemplateDeclarationContext | null {
        return this.getRuleContext(0, TemplateDeclarationContext);
    }
    public explicitInstantiation(): ExplicitInstantiationContext | null {
        return this.getRuleContext(0, ExplicitInstantiationContext);
    }
    public explicitSpecialization(): ExplicitSpecializationContext | null {
        return this.getRuleContext(0, ExplicitSpecializationContext);
    }
    public linkageSpecification(): LinkageSpecificationContext | null {
        return this.getRuleContext(0, LinkageSpecificationContext);
    }
    public namespaceDefinition(): NamespaceDefinitionContext | null {
        return this.getRuleContext(0, NamespaceDefinitionContext);
    }
    public emptyDeclaration_(): EmptyDeclaration_Context | null {
        return this.getRuleContext(0, EmptyDeclaration_Context);
    }
    public attributeDeclaration(): AttributeDeclarationContext | null {
        return this.getRuleContext(0, AttributeDeclarationContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_declaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterDeclaration) {
             listener.enterDeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitDeclaration) {
             listener.exitDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitDeclaration) {
            return visitor.visitDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BlockDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public simpleDeclaration(): SimpleDeclarationContext | null {
        return this.getRuleContext(0, SimpleDeclarationContext);
    }
    public asmDefinition(): AsmDefinitionContext | null {
        return this.getRuleContext(0, AsmDefinitionContext);
    }
    public namespaceAliasDefinition(): NamespaceAliasDefinitionContext | null {
        return this.getRuleContext(0, NamespaceAliasDefinitionContext);
    }
    public usingDeclaration(): UsingDeclarationContext | null {
        return this.getRuleContext(0, UsingDeclarationContext);
    }
    public usingDirective(): UsingDirectiveContext | null {
        return this.getRuleContext(0, UsingDirectiveContext);
    }
    public staticAssertDeclaration(): StaticAssertDeclarationContext | null {
        return this.getRuleContext(0, StaticAssertDeclarationContext);
    }
    public aliasDeclaration(): AliasDeclarationContext | null {
        return this.getRuleContext(0, AliasDeclarationContext);
    }
    public opaqueEnumDeclaration(): OpaqueEnumDeclarationContext | null {
        return this.getRuleContext(0, OpaqueEnumDeclarationContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_blockDeclaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterBlockDeclaration) {
             listener.enterBlockDeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitBlockDeclaration) {
             listener.exitBlockDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitBlockDeclaration) {
            return visitor.visitBlockDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AliasDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Using(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Using, 0)!;
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Identifier, 0)!;
    }
    public Assign(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Assign, 0)!;
    }
    public theTypeId(): TheTypeIdContext {
        return this.getRuleContext(0, TheTypeIdContext)!;
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Semi, 0)!;
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_aliasDeclaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAliasDeclaration) {
             listener.enterAliasDeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAliasDeclaration) {
             listener.exitAliasDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAliasDeclaration) {
            return visitor.visitAliasDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SimpleDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Semi, 0)!;
    }
    public declSpecifierSeq(): DeclSpecifierSeqContext | null {
        return this.getRuleContext(0, DeclSpecifierSeqContext);
    }
    public initDeclaratorList(): InitDeclaratorListContext | null {
        return this.getRuleContext(0, InitDeclaratorListContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_simpleDeclaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterSimpleDeclaration) {
             listener.enterSimpleDeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitSimpleDeclaration) {
             listener.exitSimpleDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitSimpleDeclaration) {
            return visitor.visitSimpleDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StaticAssertDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Static_assert(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Static_assert, 0)!;
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public constantExpression(): ConstantExpressionContext {
        return this.getRuleContext(0, ConstantExpressionContext)!;
    }
    public Comma(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Comma, 0)!;
    }
    public StringLiteral(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.StringLiteral, 0)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Semi, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_staticAssertDeclaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterStaticAssertDeclaration) {
             listener.enterStaticAssertDeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitStaticAssertDeclaration) {
             listener.exitStaticAssertDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitStaticAssertDeclaration) {
            return visitor.visitStaticAssertDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EmptyDeclaration_Context extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Semi, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_emptyDeclaration_;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterEmptyDeclaration_) {
             listener.enterEmptyDeclaration_(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitEmptyDeclaration_) {
             listener.exitEmptyDeclaration_(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitEmptyDeclaration_) {
            return visitor.visitEmptyDeclaration_(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AttributeDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext {
        return this.getRuleContext(0, AttributeSpecifierSeqContext)!;
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Semi, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_attributeDeclaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAttributeDeclaration) {
             listener.enterAttributeDeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAttributeDeclaration) {
             listener.exitAttributeDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAttributeDeclaration) {
            return visitor.visitAttributeDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public storageClassSpecifier(): StorageClassSpecifierContext | null {
        return this.getRuleContext(0, StorageClassSpecifierContext);
    }
    public typeSpecifier(): TypeSpecifierContext | null {
        return this.getRuleContext(0, TypeSpecifierContext);
    }
    public functionSpecifier(): FunctionSpecifierContext | null {
        return this.getRuleContext(0, FunctionSpecifierContext);
    }
    public Friend(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Friend, 0);
    }
    public Typedef(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Typedef, 0);
    }
    public Constexpr(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Constexpr, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_declSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterDeclSpecifier) {
             listener.enterDeclSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitDeclSpecifier) {
             listener.exitDeclSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitDeclSpecifier) {
            return visitor.visitDeclSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclSpecifierSeqContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declSpecifier(): DeclSpecifierContext[];
    public declSpecifier(i: number): DeclSpecifierContext | null;
    public declSpecifier(i?: number): DeclSpecifierContext[] | DeclSpecifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(DeclSpecifierContext);
        }

        return this.getRuleContext(i, DeclSpecifierContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_declSpecifierSeq;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterDeclSpecifierSeq) {
             listener.enterDeclSpecifierSeq(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitDeclSpecifierSeq) {
             listener.exitDeclSpecifierSeq(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitDeclSpecifierSeq) {
            return visitor.visitDeclSpecifierSeq(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class StorageClassSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Register(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Register, 0);
    }
    public Static(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Static, 0);
    }
    public Thread_local(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Thread_local, 0);
    }
    public Extern(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Extern, 0);
    }
    public Mutable(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Mutable, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_storageClassSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterStorageClassSpecifier) {
             listener.enterStorageClassSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitStorageClassSpecifier) {
             listener.exitStorageClassSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitStorageClassSpecifier) {
            return visitor.visitStorageClassSpecifier(this);
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
        return this.getToken(CPP14Parser.Inline, 0);
    }
    public Virtual(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Virtual, 0);
    }
    public Explicit(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Explicit, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_functionSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterFunctionSpecifier) {
             listener.enterFunctionSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitFunctionSpecifier) {
             listener.exitFunctionSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitFunctionSpecifier) {
            return visitor.visitFunctionSpecifier(this);
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
        return this.getToken(CPP14Parser.Identifier, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_typedefName;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTypedefName) {
             listener.enterTypedefName(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTypedefName) {
             listener.exitTypedefName(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTypedefName) {
            return visitor.visitTypedefName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public trailingTypeSpecifier(): TrailingTypeSpecifierContext | null {
        return this.getRuleContext(0, TrailingTypeSpecifierContext);
    }
    public classSpecifier(): ClassSpecifierContext | null {
        return this.getRuleContext(0, ClassSpecifierContext);
    }
    public enumSpecifier(): EnumSpecifierContext | null {
        return this.getRuleContext(0, EnumSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_typeSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTypeSpecifier) {
             listener.enterTypeSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTypeSpecifier) {
             listener.exitTypeSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTypeSpecifier) {
            return visitor.visitTypeSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TrailingTypeSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public simpleTypeSpecifier(): SimpleTypeSpecifierContext | null {
        return this.getRuleContext(0, SimpleTypeSpecifierContext);
    }
    public elaboratedTypeSpecifier(): ElaboratedTypeSpecifierContext | null {
        return this.getRuleContext(0, ElaboratedTypeSpecifierContext);
    }
    public typeNameSpecifier(): TypeNameSpecifierContext | null {
        return this.getRuleContext(0, TypeNameSpecifierContext);
    }
    public cvQualifier(): CvQualifierContext | null {
        return this.getRuleContext(0, CvQualifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_trailingTypeSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTrailingTypeSpecifier) {
             listener.enterTrailingTypeSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTrailingTypeSpecifier) {
             listener.exitTrailingTypeSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTrailingTypeSpecifier) {
            return visitor.visitTrailingTypeSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeSpecifierSeqContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public typeSpecifier(): TypeSpecifierContext[];
    public typeSpecifier(i: number): TypeSpecifierContext | null;
    public typeSpecifier(i?: number): TypeSpecifierContext[] | TypeSpecifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TypeSpecifierContext);
        }

        return this.getRuleContext(i, TypeSpecifierContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_typeSpecifierSeq;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTypeSpecifierSeq) {
             listener.enterTypeSpecifierSeq(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTypeSpecifierSeq) {
             listener.exitTypeSpecifierSeq(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTypeSpecifierSeq) {
            return visitor.visitTypeSpecifierSeq(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TrailingTypeSpecifierSeqContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public trailingTypeSpecifier(): TrailingTypeSpecifierContext[];
    public trailingTypeSpecifier(i: number): TrailingTypeSpecifierContext | null;
    public trailingTypeSpecifier(i?: number): TrailingTypeSpecifierContext[] | TrailingTypeSpecifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TrailingTypeSpecifierContext);
        }

        return this.getRuleContext(i, TrailingTypeSpecifierContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_trailingTypeSpecifierSeq;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTrailingTypeSpecifierSeq) {
             listener.enterTrailingTypeSpecifierSeq(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTrailingTypeSpecifierSeq) {
             listener.exitTrailingTypeSpecifierSeq(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTrailingTypeSpecifierSeq) {
            return visitor.visitTrailingTypeSpecifierSeq(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SimpleTypeLengthModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Short(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Short, 0);
    }
    public Long(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Long, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_simpleTypeLengthModifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterSimpleTypeLengthModifier) {
             listener.enterSimpleTypeLengthModifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitSimpleTypeLengthModifier) {
             listener.exitSimpleTypeLengthModifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitSimpleTypeLengthModifier) {
            return visitor.visitSimpleTypeLengthModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SimpleTypeSignednessModifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Unsigned(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Unsigned, 0);
    }
    public Signed(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Signed, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_simpleTypeSignednessModifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterSimpleTypeSignednessModifier) {
             listener.enterSimpleTypeSignednessModifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitSimpleTypeSignednessModifier) {
             listener.exitSimpleTypeSignednessModifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitSimpleTypeSignednessModifier) {
            return visitor.visitSimpleTypeSignednessModifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SimpleTypeSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public theTypeName(): TheTypeNameContext | null {
        return this.getRuleContext(0, TheTypeNameContext);
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext | null {
        return this.getRuleContext(0, NestedNameSpecifierContext);
    }
    public Template(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Template, 0);
    }
    public simpleTemplateId(): SimpleTemplateIdContext | null {
        return this.getRuleContext(0, SimpleTemplateIdContext);
    }
    public Char(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Char, 0);
    }
    public Char16(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Char16, 0);
    }
    public Char32(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Char32, 0);
    }
    public Wchar(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Wchar, 0);
    }
    public Bool(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Bool, 0);
    }
    public Short(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Short, 0);
    }
    public Int(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Int, 0);
    }
    public Long(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Long, 0);
    }
    public Float(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Float, 0);
    }
    public Signed(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Signed, 0);
    }
    public Unsigned(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Unsigned, 0);
    }
    public Double(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Double, 0);
    }
    public Void(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Void, 0);
    }
    public Auto(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Auto, 0);
    }
    public decltypeSpecifier(): DecltypeSpecifierContext | null {
        return this.getRuleContext(0, DecltypeSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_simpleTypeSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterSimpleTypeSpecifier) {
             listener.enterSimpleTypeSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitSimpleTypeSpecifier) {
             listener.exitSimpleTypeSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitSimpleTypeSpecifier) {
            return visitor.visitSimpleTypeSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TheTypeNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public className(): ClassNameContext | null {
        return this.getRuleContext(0, ClassNameContext);
    }
    public enumName(): EnumNameContext | null {
        return this.getRuleContext(0, EnumNameContext);
    }
    public typedefName(): TypedefNameContext | null {
        return this.getRuleContext(0, TypedefNameContext);
    }
    public simpleTemplateId(): SimpleTemplateIdContext | null {
        return this.getRuleContext(0, SimpleTemplateIdContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_theTypeName;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTheTypeName) {
             listener.enterTheTypeName(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTheTypeName) {
             listener.exitTheTypeName(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTheTypeName) {
            return visitor.visitTheTypeName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DecltypeSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Decltype(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Decltype, 0)!;
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
    }
    public expression(): ExpressionContext | null {
        return this.getRuleContext(0, ExpressionContext);
    }
    public Auto(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Auto, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_decltypeSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterDecltypeSpecifier) {
             listener.enterDecltypeSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitDecltypeSpecifier) {
             listener.exitDecltypeSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitDecltypeSpecifier) {
            return visitor.visitDecltypeSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ElaboratedTypeSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public classKey(): ClassKeyContext | null {
        return this.getRuleContext(0, ClassKeyContext);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public simpleTemplateId(): SimpleTemplateIdContext | null {
        return this.getRuleContext(0, SimpleTemplateIdContext);
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext | null {
        return this.getRuleContext(0, NestedNameSpecifierContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public Template(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Template, 0);
    }
    public Enum(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Enum, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_elaboratedTypeSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterElaboratedTypeSpecifier) {
             listener.enterElaboratedTypeSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitElaboratedTypeSpecifier) {
             listener.exitElaboratedTypeSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitElaboratedTypeSpecifier) {
            return visitor.visitElaboratedTypeSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Identifier, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_enumName;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterEnumName) {
             listener.enterEnumName(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitEnumName) {
             listener.exitEnumName(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitEnumName) {
            return visitor.visitEnumName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public enumHead(): EnumHeadContext {
        return this.getRuleContext(0, EnumHeadContext)!;
    }
    public LeftBrace(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftBrace, 0)!;
    }
    public RightBrace(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightBrace, 0)!;
    }
    public enumeratorList(): EnumeratorListContext | null {
        return this.getRuleContext(0, EnumeratorListContext);
    }
    public Comma(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Comma, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_enumSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterEnumSpecifier) {
             listener.enterEnumSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitEnumSpecifier) {
             listener.exitEnumSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitEnumSpecifier) {
            return visitor.visitEnumSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumHeadContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public enumkey(): EnumkeyContext {
        return this.getRuleContext(0, EnumkeyContext)!;
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public enumbase(): EnumbaseContext | null {
        return this.getRuleContext(0, EnumbaseContext);
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext | null {
        return this.getRuleContext(0, NestedNameSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_enumHead;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterEnumHead) {
             listener.enterEnumHead(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitEnumHead) {
             listener.exitEnumHead(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitEnumHead) {
            return visitor.visitEnumHead(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class OpaqueEnumDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public enumkey(): EnumkeyContext {
        return this.getRuleContext(0, EnumkeyContext)!;
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Identifier, 0)!;
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Semi, 0)!;
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public enumbase(): EnumbaseContext | null {
        return this.getRuleContext(0, EnumbaseContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_opaqueEnumDeclaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterOpaqueEnumDeclaration) {
             listener.enterOpaqueEnumDeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitOpaqueEnumDeclaration) {
             listener.exitOpaqueEnumDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitOpaqueEnumDeclaration) {
            return visitor.visitOpaqueEnumDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumkeyContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Enum(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Enum, 0)!;
    }
    public Class(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Class, 0);
    }
    public Struct(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Struct, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_enumkey;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterEnumkey) {
             listener.enterEnumkey(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitEnumkey) {
             listener.exitEnumkey(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitEnumkey) {
            return visitor.visitEnumkey(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumbaseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Colon(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Colon, 0)!;
    }
    public typeSpecifierSeq(): TypeSpecifierSeqContext {
        return this.getRuleContext(0, TypeSpecifierSeqContext)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_enumbase;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterEnumbase) {
             listener.enterEnumbase(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitEnumbase) {
             listener.exitEnumbase(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitEnumbase) {
            return visitor.visitEnumbase(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumeratorListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public enumeratorDefinition(): EnumeratorDefinitionContext[];
    public enumeratorDefinition(i: number): EnumeratorDefinitionContext | null;
    public enumeratorDefinition(i?: number): EnumeratorDefinitionContext[] | EnumeratorDefinitionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(EnumeratorDefinitionContext);
        }

        return this.getRuleContext(i, EnumeratorDefinitionContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_enumeratorList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterEnumeratorList) {
             listener.enterEnumeratorList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitEnumeratorList) {
             listener.exitEnumeratorList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitEnumeratorList) {
            return visitor.visitEnumeratorList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumeratorDefinitionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public enumerator(): EnumeratorContext {
        return this.getRuleContext(0, EnumeratorContext)!;
    }
    public Assign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Assign, 0);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_enumeratorDefinition;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterEnumeratorDefinition) {
             listener.enterEnumeratorDefinition(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitEnumeratorDefinition) {
             listener.exitEnumeratorDefinition(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitEnumeratorDefinition) {
            return visitor.visitEnumeratorDefinition(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class EnumeratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Identifier, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_enumerator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterEnumerator) {
             listener.enterEnumerator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitEnumerator) {
             listener.exitEnumerator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitEnumerator) {
            return visitor.visitEnumerator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NamespaceNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public originalNamespaceName(): OriginalNamespaceNameContext | null {
        return this.getRuleContext(0, OriginalNamespaceNameContext);
    }
    public namespaceAlias(): NamespaceAliasContext | null {
        return this.getRuleContext(0, NamespaceAliasContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_namespaceName;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNamespaceName) {
             listener.enterNamespaceName(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNamespaceName) {
             listener.exitNamespaceName(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNamespaceName) {
            return visitor.visitNamespaceName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class OriginalNamespaceNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Identifier, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_originalNamespaceName;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterOriginalNamespaceName) {
             listener.enterOriginalNamespaceName(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitOriginalNamespaceName) {
             listener.exitOriginalNamespaceName(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitOriginalNamespaceName) {
            return visitor.visitOriginalNamespaceName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NamespaceDefinitionContext extends antlr.ParserRuleContext {
    public _namespaceBody?: DeclarationseqContext;
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Namespace(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Namespace, 0)!;
    }
    public LeftBrace(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftBrace, 0)!;
    }
    public RightBrace(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightBrace, 0)!;
    }
    public Inline(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Inline, 0);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public originalNamespaceName(): OriginalNamespaceNameContext | null {
        return this.getRuleContext(0, OriginalNamespaceNameContext);
    }
    public declarationseq(): DeclarationseqContext | null {
        return this.getRuleContext(0, DeclarationseqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_namespaceDefinition;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNamespaceDefinition) {
             listener.enterNamespaceDefinition(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNamespaceDefinition) {
             listener.exitNamespaceDefinition(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNamespaceDefinition) {
            return visitor.visitNamespaceDefinition(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NamespaceAliasContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Identifier, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_namespaceAlias;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNamespaceAlias) {
             listener.enterNamespaceAlias(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNamespaceAlias) {
             listener.exitNamespaceAlias(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNamespaceAlias) {
            return visitor.visitNamespaceAlias(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NamespaceAliasDefinitionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Namespace(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Namespace, 0)!;
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Identifier, 0)!;
    }
    public Assign(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Assign, 0)!;
    }
    public qualifiednamespacespecifier(): QualifiednamespacespecifierContext {
        return this.getRuleContext(0, QualifiednamespacespecifierContext)!;
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Semi, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_namespaceAliasDefinition;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNamespaceAliasDefinition) {
             listener.enterNamespaceAliasDefinition(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNamespaceAliasDefinition) {
             listener.exitNamespaceAliasDefinition(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNamespaceAliasDefinition) {
            return visitor.visitNamespaceAliasDefinition(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class QualifiednamespacespecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public namespaceName(): NamespaceNameContext {
        return this.getRuleContext(0, NamespaceNameContext)!;
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext | null {
        return this.getRuleContext(0, NestedNameSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_qualifiednamespacespecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterQualifiednamespacespecifier) {
             listener.enterQualifiednamespacespecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitQualifiednamespacespecifier) {
             listener.exitQualifiednamespacespecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitQualifiednamespacespecifier) {
            return visitor.visitQualifiednamespacespecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class UsingDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Using(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Using, 0)!;
    }
    public unqualifiedId(): UnqualifiedIdContext {
        return this.getRuleContext(0, UnqualifiedIdContext)!;
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Semi, 0)!;
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext | null {
        return this.getRuleContext(0, NestedNameSpecifierContext);
    }
    public Doublecolon(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Doublecolon, 0);
    }
    public Typename_(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Typename_, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_usingDeclaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterUsingDeclaration) {
             listener.enterUsingDeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitUsingDeclaration) {
             listener.exitUsingDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitUsingDeclaration) {
            return visitor.visitUsingDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class UsingDirectiveContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Using(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Using, 0)!;
    }
    public Namespace(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Namespace, 0)!;
    }
    public namespaceName(): NamespaceNameContext {
        return this.getRuleContext(0, NamespaceNameContext)!;
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Semi, 0)!;
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext | null {
        return this.getRuleContext(0, NestedNameSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_usingDirective;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterUsingDirective) {
             listener.enterUsingDirective(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitUsingDirective) {
             listener.exitUsingDirective(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitUsingDirective) {
            return visitor.visitUsingDirective(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AsmDefinitionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Asm(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Asm, 0)!;
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public StringLiteral(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.StringLiteral, 0)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
    }
    public Semi(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Semi, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_asmDefinition;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAsmDefinition) {
             listener.enterAsmDefinition(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAsmDefinition) {
             listener.exitAsmDefinition(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAsmDefinition) {
            return visitor.visitAsmDefinition(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LinkageSpecificationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Extern(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Extern, 0)!;
    }
    public StringLiteral(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.StringLiteral, 0)!;
    }
    public LeftBrace(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftBrace, 0);
    }
    public RightBrace(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightBrace, 0);
    }
    public declaration(): DeclarationContext | null {
        return this.getRuleContext(0, DeclarationContext);
    }
    public declarationseq(): DeclarationseqContext | null {
        return this.getRuleContext(0, DeclarationseqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_linkageSpecification;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterLinkageSpecification) {
             listener.enterLinkageSpecification(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitLinkageSpecification) {
             listener.exitLinkageSpecification(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitLinkageSpecification) {
            return visitor.visitLinkageSpecification(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AttributeSpecifierSeqContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public attributeSpecifier(): AttributeSpecifierContext[];
    public attributeSpecifier(i: number): AttributeSpecifierContext | null;
    public attributeSpecifier(i?: number): AttributeSpecifierContext[] | AttributeSpecifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AttributeSpecifierContext);
        }

        return this.getRuleContext(i, AttributeSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_attributeSpecifierSeq;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAttributeSpecifierSeq) {
             listener.enterAttributeSpecifierSeq(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAttributeSpecifierSeq) {
             listener.exitAttributeSpecifierSeq(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAttributeSpecifierSeq) {
            return visitor.visitAttributeSpecifierSeq(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AttributeSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftBracket(): antlr.TerminalNode[];
    public LeftBracket(i: number): antlr.TerminalNode | null;
    public LeftBracket(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.LeftBracket);
    	} else {
    		return this.getToken(CPP14Parser.LeftBracket, i);
    	}
    }
    public RightBracket(): antlr.TerminalNode[];
    public RightBracket(i: number): antlr.TerminalNode | null;
    public RightBracket(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.RightBracket);
    	} else {
    		return this.getToken(CPP14Parser.RightBracket, i);
    	}
    }
    public attributeList(): AttributeListContext | null {
        return this.getRuleContext(0, AttributeListContext);
    }
    public alignmentspecifier(): AlignmentspecifierContext | null {
        return this.getRuleContext(0, AlignmentspecifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_attributeSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAttributeSpecifier) {
             listener.enterAttributeSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAttributeSpecifier) {
             listener.exitAttributeSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAttributeSpecifier) {
            return visitor.visitAttributeSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AlignmentspecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Alignas(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Alignas, 0)!;
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
    }
    public theTypeId(): TheTypeIdContext | null {
        return this.getRuleContext(0, TheTypeIdContext);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public Ellipsis(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Ellipsis, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_alignmentspecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAlignmentspecifier) {
             listener.enterAlignmentspecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAlignmentspecifier) {
             listener.exitAlignmentspecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAlignmentspecifier) {
            return visitor.visitAlignmentspecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AttributeListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public attribute(): AttributeContext[];
    public attribute(i: number): AttributeContext | null;
    public attribute(i?: number): AttributeContext[] | AttributeContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AttributeContext);
        }

        return this.getRuleContext(i, AttributeContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public Ellipsis(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Ellipsis, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_attributeList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAttributeList) {
             listener.enterAttributeList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAttributeList) {
             listener.exitAttributeList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAttributeList) {
            return visitor.visitAttributeList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AttributeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Identifier, 0)!;
    }
    public attributeNamespace(): AttributeNamespaceContext | null {
        return this.getRuleContext(0, AttributeNamespaceContext);
    }
    public Doublecolon(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Doublecolon, 0);
    }
    public attributeArgumentClause(): AttributeArgumentClauseContext | null {
        return this.getRuleContext(0, AttributeArgumentClauseContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_attribute;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAttribute) {
             listener.enterAttribute(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAttribute) {
             listener.exitAttribute(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAttribute) {
            return visitor.visitAttribute(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AttributeNamespaceContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Identifier, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_attributeNamespace;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAttributeNamespace) {
             listener.enterAttributeNamespace(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAttributeNamespace) {
             listener.exitAttributeNamespace(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAttributeNamespace) {
            return visitor.visitAttributeNamespace(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AttributeArgumentClauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
    }
    public balancedTokenSeq(): BalancedTokenSeqContext | null {
        return this.getRuleContext(0, BalancedTokenSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_attributeArgumentClause;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAttributeArgumentClause) {
             listener.enterAttributeArgumentClause(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAttributeArgumentClause) {
             listener.exitAttributeArgumentClause(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAttributeArgumentClause) {
            return visitor.visitAttributeArgumentClause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BalancedTokenSeqContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public balancedtoken(): BalancedtokenContext[];
    public balancedtoken(i: number): BalancedtokenContext | null;
    public balancedtoken(i?: number): BalancedtokenContext[] | BalancedtokenContext | null {
        if (i === undefined) {
            return this.getRuleContexts(BalancedtokenContext);
        }

        return this.getRuleContext(i, BalancedtokenContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_balancedTokenSeq;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterBalancedTokenSeq) {
             listener.enterBalancedTokenSeq(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitBalancedTokenSeq) {
             listener.exitBalancedTokenSeq(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitBalancedTokenSeq) {
            return visitor.visitBalancedTokenSeq(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BalancedtokenContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftParen(): antlr.TerminalNode[];
    public LeftParen(i: number): antlr.TerminalNode | null;
    public LeftParen(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.LeftParen);
    	} else {
    		return this.getToken(CPP14Parser.LeftParen, i);
    	}
    }
    public balancedTokenSeq(): BalancedTokenSeqContext | null {
        return this.getRuleContext(0, BalancedTokenSeqContext);
    }
    public RightParen(): antlr.TerminalNode[];
    public RightParen(i: number): antlr.TerminalNode | null;
    public RightParen(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.RightParen);
    	} else {
    		return this.getToken(CPP14Parser.RightParen, i);
    	}
    }
    public LeftBracket(): antlr.TerminalNode[];
    public LeftBracket(i: number): antlr.TerminalNode | null;
    public LeftBracket(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.LeftBracket);
    	} else {
    		return this.getToken(CPP14Parser.LeftBracket, i);
    	}
    }
    public RightBracket(): antlr.TerminalNode[];
    public RightBracket(i: number): antlr.TerminalNode | null;
    public RightBracket(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.RightBracket);
    	} else {
    		return this.getToken(CPP14Parser.RightBracket, i);
    	}
    }
    public LeftBrace(): antlr.TerminalNode[];
    public LeftBrace(i: number): antlr.TerminalNode | null;
    public LeftBrace(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.LeftBrace);
    	} else {
    		return this.getToken(CPP14Parser.LeftBrace, i);
    	}
    }
    public RightBrace(): antlr.TerminalNode[];
    public RightBrace(i: number): antlr.TerminalNode | null;
    public RightBrace(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.RightBrace);
    	} else {
    		return this.getToken(CPP14Parser.RightBrace, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_balancedtoken;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterBalancedtoken) {
             listener.enterBalancedtoken(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitBalancedtoken) {
             listener.exitBalancedtoken(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitBalancedtoken) {
            return visitor.visitBalancedtoken(this);
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
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_initDeclaratorList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterInitDeclaratorList) {
             listener.enterInitDeclaratorList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitInitDeclaratorList) {
             listener.exitInitDeclaratorList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
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
    public initializer(): InitializerContext | null {
        return this.getRuleContext(0, InitializerContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_initDeclarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterInitDeclarator) {
             listener.enterInitDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitInitDeclarator) {
             listener.exitInitDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitInitDeclarator) {
            return visitor.visitInitDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public pointerDeclarator(): PointerDeclaratorContext | null {
        return this.getRuleContext(0, PointerDeclaratorContext);
    }
    public noPointerDeclarator(): NoPointerDeclaratorContext | null {
        return this.getRuleContext(0, NoPointerDeclaratorContext);
    }
    public parametersAndQualifiers(): ParametersAndQualifiersContext | null {
        return this.getRuleContext(0, ParametersAndQualifiersContext);
    }
    public trailingReturnType(): TrailingReturnTypeContext | null {
        return this.getRuleContext(0, TrailingReturnTypeContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_declarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterDeclarator) {
             listener.enterDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitDeclarator) {
             listener.exitDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitDeclarator) {
            return visitor.visitDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PointerDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public noPointerDeclarator(): NoPointerDeclaratorContext {
        return this.getRuleContext(0, NoPointerDeclaratorContext)!;
    }
    public pointerOperator(): PointerOperatorContext[];
    public pointerOperator(i: number): PointerOperatorContext | null;
    public pointerOperator(i?: number): PointerOperatorContext[] | PointerOperatorContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PointerOperatorContext);
        }

        return this.getRuleContext(i, PointerOperatorContext);
    }
    public Const(): antlr.TerminalNode[];
    public Const(i: number): antlr.TerminalNode | null;
    public Const(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Const);
    	} else {
    		return this.getToken(CPP14Parser.Const, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_pointerDeclarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterPointerDeclarator) {
             listener.enterPointerDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitPointerDeclarator) {
             listener.exitPointerDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitPointerDeclarator) {
            return visitor.visitPointerDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NoPointerDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declaratorid(): DeclaratoridContext | null {
        return this.getRuleContext(0, DeclaratoridContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftParen, 0);
    }
    public pointerDeclarator(): PointerDeclaratorContext | null {
        return this.getRuleContext(0, PointerDeclaratorContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightParen, 0);
    }
    public noPointerDeclarator(): NoPointerDeclaratorContext | null {
        return this.getRuleContext(0, NoPointerDeclaratorContext);
    }
    public parametersAndQualifiers(): ParametersAndQualifiersContext | null {
        return this.getRuleContext(0, ParametersAndQualifiersContext);
    }
    public LeftBracket(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftBracket, 0);
    }
    public RightBracket(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightBracket, 0);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_noPointerDeclarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNoPointerDeclarator) {
             listener.enterNoPointerDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNoPointerDeclarator) {
             listener.exitNoPointerDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNoPointerDeclarator) {
            return visitor.visitNoPointerDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParametersAndQualifiersContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
    }
    public parameterDeclarationClause(): ParameterDeclarationClauseContext | null {
        return this.getRuleContext(0, ParameterDeclarationClauseContext);
    }
    public cvqualifierseq(): CvqualifierseqContext | null {
        return this.getRuleContext(0, CvqualifierseqContext);
    }
    public refqualifier(): RefqualifierContext | null {
        return this.getRuleContext(0, RefqualifierContext);
    }
    public exceptionSpecification(): ExceptionSpecificationContext | null {
        return this.getRuleContext(0, ExceptionSpecificationContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_parametersAndQualifiers;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterParametersAndQualifiers) {
             listener.enterParametersAndQualifiers(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitParametersAndQualifiers) {
             listener.exitParametersAndQualifiers(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitParametersAndQualifiers) {
            return visitor.visitParametersAndQualifiers(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TrailingReturnTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Arrow(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Arrow, 0)!;
    }
    public trailingTypeSpecifierSeq(): TrailingTypeSpecifierSeqContext {
        return this.getRuleContext(0, TrailingTypeSpecifierSeqContext)!;
    }
    public abstractDeclarator(): AbstractDeclaratorContext | null {
        return this.getRuleContext(0, AbstractDeclaratorContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_trailingReturnType;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTrailingReturnType) {
             listener.enterTrailingReturnType(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTrailingReturnType) {
             listener.exitTrailingReturnType(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTrailingReturnType) {
            return visitor.visitTrailingReturnType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PointerOperatorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public And(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.And, 0);
    }
    public AndAnd(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.AndAnd, 0);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public Star(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Star, 0);
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext | null {
        return this.getRuleContext(0, NestedNameSpecifierContext);
    }
    public cvqualifierseq(): CvqualifierseqContext | null {
        return this.getRuleContext(0, CvqualifierseqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_pointerOperator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterPointerOperator) {
             listener.enterPointerOperator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitPointerOperator) {
             listener.exitPointerOperator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitPointerOperator) {
            return visitor.visitPointerOperator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CvqualifierseqContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public cvQualifier(): CvQualifierContext[];
    public cvQualifier(i: number): CvQualifierContext | null;
    public cvQualifier(i?: number): CvQualifierContext[] | CvQualifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(CvQualifierContext);
        }

        return this.getRuleContext(i, CvQualifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_cvqualifierseq;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterCvqualifierseq) {
             listener.enterCvqualifierseq(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitCvqualifierseq) {
             listener.exitCvqualifierseq(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitCvqualifierseq) {
            return visitor.visitCvqualifierseq(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class CvQualifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Const(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Const, 0);
    }
    public Volatile(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Volatile, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_cvQualifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterCvQualifier) {
             listener.enterCvQualifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitCvQualifier) {
             listener.exitCvQualifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitCvQualifier) {
            return visitor.visitCvQualifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class RefqualifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public And(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.And, 0);
    }
    public AndAnd(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.AndAnd, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_refqualifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterRefqualifier) {
             listener.enterRefqualifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitRefqualifier) {
             listener.exitRefqualifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitRefqualifier) {
            return visitor.visitRefqualifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DeclaratoridContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public idExpression(): IdExpressionContext {
        return this.getRuleContext(0, IdExpressionContext)!;
    }
    public Ellipsis(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Ellipsis, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_declaratorid;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterDeclaratorid) {
             listener.enterDeclaratorid(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitDeclaratorid) {
             listener.exitDeclaratorid(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitDeclaratorid) {
            return visitor.visitDeclaratorid(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TheTypeIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public typeSpecifierSeq(): TypeSpecifierSeqContext {
        return this.getRuleContext(0, TypeSpecifierSeqContext)!;
    }
    public abstractDeclarator(): AbstractDeclaratorContext | null {
        return this.getRuleContext(0, AbstractDeclaratorContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_theTypeId;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTheTypeId) {
             listener.enterTheTypeId(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTheTypeId) {
             listener.exitTheTypeId(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTheTypeId) {
            return visitor.visitTheTypeId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AbstractDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public pointerAbstractDeclarator(): PointerAbstractDeclaratorContext | null {
        return this.getRuleContext(0, PointerAbstractDeclaratorContext);
    }
    public parametersAndQualifiers(): ParametersAndQualifiersContext | null {
        return this.getRuleContext(0, ParametersAndQualifiersContext);
    }
    public trailingReturnType(): TrailingReturnTypeContext | null {
        return this.getRuleContext(0, TrailingReturnTypeContext);
    }
    public noPointerAbstractDeclarator(): NoPointerAbstractDeclaratorContext | null {
        return this.getRuleContext(0, NoPointerAbstractDeclaratorContext);
    }
    public abstractPackDeclarator(): AbstractPackDeclaratorContext | null {
        return this.getRuleContext(0, AbstractPackDeclaratorContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_abstractDeclarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAbstractDeclarator) {
             listener.enterAbstractDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAbstractDeclarator) {
             listener.exitAbstractDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAbstractDeclarator) {
            return visitor.visitAbstractDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PointerAbstractDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public noPointerAbstractDeclarator(): NoPointerAbstractDeclaratorContext | null {
        return this.getRuleContext(0, NoPointerAbstractDeclaratorContext);
    }
    public pointerOperator(): PointerOperatorContext[];
    public pointerOperator(i: number): PointerOperatorContext | null;
    public pointerOperator(i?: number): PointerOperatorContext[] | PointerOperatorContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PointerOperatorContext);
        }

        return this.getRuleContext(i, PointerOperatorContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_pointerAbstractDeclarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterPointerAbstractDeclarator) {
             listener.enterPointerAbstractDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitPointerAbstractDeclarator) {
             listener.exitPointerAbstractDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitPointerAbstractDeclarator) {
            return visitor.visitPointerAbstractDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NoPointerAbstractDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public parametersAndQualifiers(): ParametersAndQualifiersContext[];
    public parametersAndQualifiers(i: number): ParametersAndQualifiersContext | null;
    public parametersAndQualifiers(i?: number): ParametersAndQualifiersContext[] | ParametersAndQualifiersContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ParametersAndQualifiersContext);
        }

        return this.getRuleContext(i, ParametersAndQualifiersContext);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftParen, 0);
    }
    public pointerAbstractDeclarator(): PointerAbstractDeclaratorContext | null {
        return this.getRuleContext(0, PointerAbstractDeclaratorContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightParen, 0);
    }
    public LeftBracket(): antlr.TerminalNode[];
    public LeftBracket(i: number): antlr.TerminalNode | null;
    public LeftBracket(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.LeftBracket);
    	} else {
    		return this.getToken(CPP14Parser.LeftBracket, i);
    	}
    }
    public RightBracket(): antlr.TerminalNode[];
    public RightBracket(i: number): antlr.TerminalNode | null;
    public RightBracket(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.RightBracket);
    	} else {
    		return this.getToken(CPP14Parser.RightBracket, i);
    	}
    }
    public constantExpression(): ConstantExpressionContext[];
    public constantExpression(i: number): ConstantExpressionContext | null;
    public constantExpression(i?: number): ConstantExpressionContext[] | ConstantExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ConstantExpressionContext);
        }

        return this.getRuleContext(i, ConstantExpressionContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext[];
    public attributeSpecifierSeq(i: number): AttributeSpecifierSeqContext | null;
    public attributeSpecifierSeq(i?: number): AttributeSpecifierSeqContext[] | AttributeSpecifierSeqContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AttributeSpecifierSeqContext);
        }

        return this.getRuleContext(i, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_noPointerAbstractDeclarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNoPointerAbstractDeclarator) {
             listener.enterNoPointerAbstractDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNoPointerAbstractDeclarator) {
             listener.exitNoPointerAbstractDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNoPointerAbstractDeclarator) {
            return visitor.visitNoPointerAbstractDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AbstractPackDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public noPointerAbstractPackDeclarator(): NoPointerAbstractPackDeclaratorContext {
        return this.getRuleContext(0, NoPointerAbstractPackDeclaratorContext)!;
    }
    public pointerOperator(): PointerOperatorContext[];
    public pointerOperator(i: number): PointerOperatorContext | null;
    public pointerOperator(i?: number): PointerOperatorContext[] | PointerOperatorContext | null {
        if (i === undefined) {
            return this.getRuleContexts(PointerOperatorContext);
        }

        return this.getRuleContext(i, PointerOperatorContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_abstractPackDeclarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAbstractPackDeclarator) {
             listener.enterAbstractPackDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAbstractPackDeclarator) {
             listener.exitAbstractPackDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAbstractPackDeclarator) {
            return visitor.visitAbstractPackDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NoPointerAbstractPackDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Ellipsis(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Ellipsis, 0)!;
    }
    public parametersAndQualifiers(): ParametersAndQualifiersContext[];
    public parametersAndQualifiers(i: number): ParametersAndQualifiersContext | null;
    public parametersAndQualifiers(i?: number): ParametersAndQualifiersContext[] | ParametersAndQualifiersContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ParametersAndQualifiersContext);
        }

        return this.getRuleContext(i, ParametersAndQualifiersContext);
    }
    public LeftBracket(): antlr.TerminalNode[];
    public LeftBracket(i: number): antlr.TerminalNode | null;
    public LeftBracket(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.LeftBracket);
    	} else {
    		return this.getToken(CPP14Parser.LeftBracket, i);
    	}
    }
    public RightBracket(): antlr.TerminalNode[];
    public RightBracket(i: number): antlr.TerminalNode | null;
    public RightBracket(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.RightBracket);
    	} else {
    		return this.getToken(CPP14Parser.RightBracket, i);
    	}
    }
    public constantExpression(): ConstantExpressionContext[];
    public constantExpression(i: number): ConstantExpressionContext | null;
    public constantExpression(i?: number): ConstantExpressionContext[] | ConstantExpressionContext | null {
        if (i === undefined) {
            return this.getRuleContexts(ConstantExpressionContext);
        }

        return this.getRuleContext(i, ConstantExpressionContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext[];
    public attributeSpecifierSeq(i: number): AttributeSpecifierSeqContext | null;
    public attributeSpecifierSeq(i?: number): AttributeSpecifierSeqContext[] | AttributeSpecifierSeqContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AttributeSpecifierSeqContext);
        }

        return this.getRuleContext(i, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_noPointerAbstractPackDeclarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNoPointerAbstractPackDeclarator) {
             listener.enterNoPointerAbstractPackDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNoPointerAbstractPackDeclarator) {
             listener.exitNoPointerAbstractPackDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNoPointerAbstractPackDeclarator) {
            return visitor.visitNoPointerAbstractPackDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParameterDeclarationClauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public parameterDeclarationList(): ParameterDeclarationListContext {
        return this.getRuleContext(0, ParameterDeclarationListContext)!;
    }
    public Ellipsis(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Ellipsis, 0);
    }
    public Comma(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Comma, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_parameterDeclarationClause;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterParameterDeclarationClause) {
             listener.enterParameterDeclarationClause(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitParameterDeclarationClause) {
             listener.exitParameterDeclarationClause(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitParameterDeclarationClause) {
            return visitor.visitParameterDeclarationClause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParameterDeclarationListContext extends antlr.ParserRuleContext {
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
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_parameterDeclarationList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterParameterDeclarationList) {
             listener.enterParameterDeclarationList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitParameterDeclarationList) {
             listener.exitParameterDeclarationList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitParameterDeclarationList) {
            return visitor.visitParameterDeclarationList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ParameterDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declSpecifierSeq(): DeclSpecifierSeqContext {
        return this.getRuleContext(0, DeclSpecifierSeqContext)!;
    }
    public declarator(): DeclaratorContext | null {
        return this.getRuleContext(0, DeclaratorContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public Assign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Assign, 0);
    }
    public initializerClause(): InitializerClauseContext | null {
        return this.getRuleContext(0, InitializerClauseContext);
    }
    public abstractDeclarator(): AbstractDeclaratorContext | null {
        return this.getRuleContext(0, AbstractDeclaratorContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_parameterDeclaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterParameterDeclaration) {
             listener.enterParameterDeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitParameterDeclaration) {
             listener.exitParameterDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitParameterDeclaration) {
            return visitor.visitParameterDeclaration(this);
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
    public functionBody(): FunctionBodyContext {
        return this.getRuleContext(0, FunctionBodyContext)!;
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public declSpecifierSeq(): DeclSpecifierSeqContext | null {
        return this.getRuleContext(0, DeclSpecifierSeqContext);
    }
    public virtualSpecifierSeq(): VirtualSpecifierSeqContext | null {
        return this.getRuleContext(0, VirtualSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_functionDefinition;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterFunctionDefinition) {
             listener.enterFunctionDefinition(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitFunctionDefinition) {
             listener.exitFunctionDefinition(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitFunctionDefinition) {
            return visitor.visitFunctionDefinition(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FunctionBodyContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public compoundStatement(): CompoundStatementContext | null {
        return this.getRuleContext(0, CompoundStatementContext);
    }
    public constructorInitializer(): ConstructorInitializerContext | null {
        return this.getRuleContext(0, ConstructorInitializerContext);
    }
    public functionTryBlock(): FunctionTryBlockContext | null {
        return this.getRuleContext(0, FunctionTryBlockContext);
    }
    public Assign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Assign, 0);
    }
    public Semi(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Semi, 0);
    }
    public Default(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Default, 0);
    }
    public Delete(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Delete, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_functionBody;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterFunctionBody) {
             listener.enterFunctionBody(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitFunctionBody) {
             listener.exitFunctionBody(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitFunctionBody) {
            return visitor.visitFunctionBody(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class InitializerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public braceOrEqualInitializer(): BraceOrEqualInitializerContext | null {
        return this.getRuleContext(0, BraceOrEqualInitializerContext);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftParen, 0);
    }
    public expressionList(): ExpressionListContext | null {
        return this.getRuleContext(0, ExpressionListContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightParen, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_initializer;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterInitializer) {
             listener.enterInitializer(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitInitializer) {
             listener.exitInitializer(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitInitializer) {
            return visitor.visitInitializer(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BraceOrEqualInitializerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Assign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Assign, 0);
    }
    public initializerClause(): InitializerClauseContext | null {
        return this.getRuleContext(0, InitializerClauseContext);
    }
    public bracedInitList(): BracedInitListContext | null {
        return this.getRuleContext(0, BracedInitListContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_braceOrEqualInitializer;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterBraceOrEqualInitializer) {
             listener.enterBraceOrEqualInitializer(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitBraceOrEqualInitializer) {
             listener.exitBraceOrEqualInitializer(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitBraceOrEqualInitializer) {
            return visitor.visitBraceOrEqualInitializer(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class InitializerClauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public assignmentExpression(): AssignmentExpressionContext | null {
        return this.getRuleContext(0, AssignmentExpressionContext);
    }
    public bracedInitList(): BracedInitListContext | null {
        return this.getRuleContext(0, BracedInitListContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_initializerClause;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterInitializerClause) {
             listener.enterInitializerClause(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitInitializerClause) {
             listener.exitInitializerClause(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitInitializerClause) {
            return visitor.visitInitializerClause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class InitializerListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public initializerClause(): InitializerClauseContext[];
    public initializerClause(i: number): InitializerClauseContext | null;
    public initializerClause(i?: number): InitializerClauseContext[] | InitializerClauseContext | null {
        if (i === undefined) {
            return this.getRuleContexts(InitializerClauseContext);
        }

        return this.getRuleContext(i, InitializerClauseContext);
    }
    public Ellipsis(): antlr.TerminalNode[];
    public Ellipsis(i: number): antlr.TerminalNode | null;
    public Ellipsis(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Ellipsis);
    	} else {
    		return this.getToken(CPP14Parser.Ellipsis, i);
    	}
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_initializerList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterInitializerList) {
             listener.enterInitializerList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitInitializerList) {
             listener.exitInitializerList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitInitializerList) {
            return visitor.visitInitializerList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BracedInitListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public LeftBrace(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftBrace, 0)!;
    }
    public RightBrace(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightBrace, 0)!;
    }
    public initializerList(): InitializerListContext | null {
        return this.getRuleContext(0, InitializerListContext);
    }
    public Comma(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Comma, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_bracedInitList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterBracedInitList) {
             listener.enterBracedInitList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitBracedInitList) {
             listener.exitBracedInitList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitBracedInitList) {
            return visitor.visitBracedInitList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ClassNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public simpleTemplateId(): SimpleTemplateIdContext | null {
        return this.getRuleContext(0, SimpleTemplateIdContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_className;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterClassName) {
             listener.enterClassName(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitClassName) {
             listener.exitClassName(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitClassName) {
            return visitor.visitClassName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ClassSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public classHead(): ClassHeadContext {
        return this.getRuleContext(0, ClassHeadContext)!;
    }
    public LeftBrace(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftBrace, 0)!;
    }
    public RightBrace(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightBrace, 0)!;
    }
    public memberSpecification(): MemberSpecificationContext | null {
        return this.getRuleContext(0, MemberSpecificationContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_classSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterClassSpecifier) {
             listener.enterClassSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitClassSpecifier) {
             listener.exitClassSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitClassSpecifier) {
            return visitor.visitClassSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ClassHeadContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public classKey(): ClassKeyContext | null {
        return this.getRuleContext(0, ClassKeyContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public classHeadName(): ClassHeadNameContext | null {
        return this.getRuleContext(0, ClassHeadNameContext);
    }
    public baseClause(): BaseClauseContext | null {
        return this.getRuleContext(0, BaseClauseContext);
    }
    public classVirtSpecifier(): ClassVirtSpecifierContext | null {
        return this.getRuleContext(0, ClassVirtSpecifierContext);
    }
    public Union(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Union, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_classHead;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterClassHead) {
             listener.enterClassHead(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitClassHead) {
             listener.exitClassHead(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitClassHead) {
            return visitor.visitClassHead(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ClassHeadNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public className(): ClassNameContext {
        return this.getRuleContext(0, ClassNameContext)!;
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext | null {
        return this.getRuleContext(0, NestedNameSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_classHeadName;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterClassHeadName) {
             listener.enterClassHeadName(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitClassHeadName) {
             listener.exitClassHeadName(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitClassHeadName) {
            return visitor.visitClassHeadName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ClassVirtSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Final(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Final, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_classVirtSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterClassVirtSpecifier) {
             listener.enterClassVirtSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitClassVirtSpecifier) {
             listener.exitClassVirtSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitClassVirtSpecifier) {
            return visitor.visitClassVirtSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ClassKeyContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Class(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Class, 0);
    }
    public Struct(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Struct, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_classKey;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterClassKey) {
             listener.enterClassKey(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitClassKey) {
             listener.exitClassKey(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitClassKey) {
            return visitor.visitClassKey(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MemberSpecificationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public memberdeclaration(): MemberdeclarationContext[];
    public memberdeclaration(i: number): MemberdeclarationContext | null;
    public memberdeclaration(i?: number): MemberdeclarationContext[] | MemberdeclarationContext | null {
        if (i === undefined) {
            return this.getRuleContexts(MemberdeclarationContext);
        }

        return this.getRuleContext(i, MemberdeclarationContext);
    }
    public accessSpecifier(): AccessSpecifierContext[];
    public accessSpecifier(i: number): AccessSpecifierContext | null;
    public accessSpecifier(i?: number): AccessSpecifierContext[] | AccessSpecifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(AccessSpecifierContext);
        }

        return this.getRuleContext(i, AccessSpecifierContext);
    }
    public Colon(): antlr.TerminalNode[];
    public Colon(i: number): antlr.TerminalNode | null;
    public Colon(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Colon);
    	} else {
    		return this.getToken(CPP14Parser.Colon, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_memberSpecification;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterMemberSpecification) {
             listener.enterMemberSpecification(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitMemberSpecification) {
             listener.exitMemberSpecification(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitMemberSpecification) {
            return visitor.visitMemberSpecification(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MemberdeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Semi(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Semi, 0);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public declSpecifierSeq(): DeclSpecifierSeqContext | null {
        return this.getRuleContext(0, DeclSpecifierSeqContext);
    }
    public memberDeclaratorList(): MemberDeclaratorListContext | null {
        return this.getRuleContext(0, MemberDeclaratorListContext);
    }
    public functionDefinition(): FunctionDefinitionContext | null {
        return this.getRuleContext(0, FunctionDefinitionContext);
    }
    public usingDeclaration(): UsingDeclarationContext | null {
        return this.getRuleContext(0, UsingDeclarationContext);
    }
    public staticAssertDeclaration(): StaticAssertDeclarationContext | null {
        return this.getRuleContext(0, StaticAssertDeclarationContext);
    }
    public templateDeclaration(): TemplateDeclarationContext | null {
        return this.getRuleContext(0, TemplateDeclarationContext);
    }
    public aliasDeclaration(): AliasDeclarationContext | null {
        return this.getRuleContext(0, AliasDeclarationContext);
    }
    public emptyDeclaration_(): EmptyDeclaration_Context | null {
        return this.getRuleContext(0, EmptyDeclaration_Context);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_memberdeclaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterMemberdeclaration) {
             listener.enterMemberdeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitMemberdeclaration) {
             listener.exitMemberdeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitMemberdeclaration) {
            return visitor.visitMemberdeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MemberDeclaratorListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public memberDeclarator(): MemberDeclaratorContext[];
    public memberDeclarator(i: number): MemberDeclaratorContext | null;
    public memberDeclarator(i?: number): MemberDeclaratorContext[] | MemberDeclaratorContext | null {
        if (i === undefined) {
            return this.getRuleContexts(MemberDeclaratorContext);
        }

        return this.getRuleContext(i, MemberDeclaratorContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_memberDeclaratorList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterMemberDeclaratorList) {
             listener.enterMemberDeclaratorList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitMemberDeclaratorList) {
             listener.exitMemberDeclaratorList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitMemberDeclaratorList) {
            return visitor.visitMemberDeclaratorList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MemberDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public declarator(): DeclaratorContext | null {
        return this.getRuleContext(0, DeclaratorContext);
    }
    public virtualSpecifierSeq(): VirtualSpecifierSeqContext | null {
        return this.getRuleContext(0, VirtualSpecifierSeqContext);
    }
    public pureSpecifier(): PureSpecifierContext | null {
        return this.getRuleContext(0, PureSpecifierContext);
    }
    public braceOrEqualInitializer(): BraceOrEqualInitializerContext | null {
        return this.getRuleContext(0, BraceOrEqualInitializerContext);
    }
    public Colon(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Colon, 0);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_memberDeclarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterMemberDeclarator) {
             listener.enterMemberDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitMemberDeclarator) {
             listener.exitMemberDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitMemberDeclarator) {
            return visitor.visitMemberDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class VirtualSpecifierSeqContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public virtualSpecifier(): VirtualSpecifierContext[];
    public virtualSpecifier(i: number): VirtualSpecifierContext | null;
    public virtualSpecifier(i?: number): VirtualSpecifierContext[] | VirtualSpecifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(VirtualSpecifierContext);
        }

        return this.getRuleContext(i, VirtualSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_virtualSpecifierSeq;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterVirtualSpecifierSeq) {
             listener.enterVirtualSpecifierSeq(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitVirtualSpecifierSeq) {
             listener.exitVirtualSpecifierSeq(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitVirtualSpecifierSeq) {
            return visitor.visitVirtualSpecifierSeq(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class VirtualSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Override(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Override, 0);
    }
    public Final(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Final, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_virtualSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterVirtualSpecifier) {
             listener.enterVirtualSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitVirtualSpecifier) {
             listener.exitVirtualSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitVirtualSpecifier) {
            return visitor.visitVirtualSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class PureSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Assign(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Assign, 0)!;
    }
    public IntegerLiteral(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.IntegerLiteral, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_pureSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterPureSpecifier) {
             listener.enterPureSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitPureSpecifier) {
             listener.exitPureSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitPureSpecifier) {
            return visitor.visitPureSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BaseClauseContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Colon(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Colon, 0)!;
    }
    public baseSpecifierList(): BaseSpecifierListContext {
        return this.getRuleContext(0, BaseSpecifierListContext)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_baseClause;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterBaseClause) {
             listener.enterBaseClause(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitBaseClause) {
             listener.exitBaseClause(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitBaseClause) {
            return visitor.visitBaseClause(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BaseSpecifierListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public baseSpecifier(): BaseSpecifierContext[];
    public baseSpecifier(i: number): BaseSpecifierContext | null;
    public baseSpecifier(i?: number): BaseSpecifierContext[] | BaseSpecifierContext | null {
        if (i === undefined) {
            return this.getRuleContexts(BaseSpecifierContext);
        }

        return this.getRuleContext(i, BaseSpecifierContext);
    }
    public Ellipsis(): antlr.TerminalNode[];
    public Ellipsis(i: number): antlr.TerminalNode | null;
    public Ellipsis(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Ellipsis);
    	} else {
    		return this.getToken(CPP14Parser.Ellipsis, i);
    	}
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_baseSpecifierList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterBaseSpecifierList) {
             listener.enterBaseSpecifierList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitBaseSpecifierList) {
             listener.exitBaseSpecifierList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitBaseSpecifierList) {
            return visitor.visitBaseSpecifierList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BaseSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public baseTypeSpecifier(): BaseTypeSpecifierContext | null {
        return this.getRuleContext(0, BaseTypeSpecifierContext);
    }
    public Virtual(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Virtual, 0);
    }
    public accessSpecifier(): AccessSpecifierContext | null {
        return this.getRuleContext(0, AccessSpecifierContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_baseSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterBaseSpecifier) {
             listener.enterBaseSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitBaseSpecifier) {
             listener.exitBaseSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitBaseSpecifier) {
            return visitor.visitBaseSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ClassOrDeclTypeContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public className(): ClassNameContext | null {
        return this.getRuleContext(0, ClassNameContext);
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext | null {
        return this.getRuleContext(0, NestedNameSpecifierContext);
    }
    public decltypeSpecifier(): DecltypeSpecifierContext | null {
        return this.getRuleContext(0, DecltypeSpecifierContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_classOrDeclType;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterClassOrDeclType) {
             listener.enterClassOrDeclType(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitClassOrDeclType) {
             listener.exitClassOrDeclType(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitClassOrDeclType) {
            return visitor.visitClassOrDeclType(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class BaseTypeSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public classOrDeclType(): ClassOrDeclTypeContext {
        return this.getRuleContext(0, ClassOrDeclTypeContext)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_baseTypeSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterBaseTypeSpecifier) {
             listener.enterBaseTypeSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitBaseTypeSpecifier) {
             listener.exitBaseTypeSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitBaseTypeSpecifier) {
            return visitor.visitBaseTypeSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class AccessSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Private(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Private, 0);
    }
    public Protected(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Protected, 0);
    }
    public Public(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Public, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_accessSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterAccessSpecifier) {
             listener.enterAccessSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitAccessSpecifier) {
             listener.exitAccessSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitAccessSpecifier) {
            return visitor.visitAccessSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConversionFunctionIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Operator(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Operator, 0)!;
    }
    public conversionTypeId(): ConversionTypeIdContext {
        return this.getRuleContext(0, ConversionTypeIdContext)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_conversionFunctionId;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterConversionFunctionId) {
             listener.enterConversionFunctionId(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitConversionFunctionId) {
             listener.exitConversionFunctionId(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitConversionFunctionId) {
            return visitor.visitConversionFunctionId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConversionTypeIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public typeSpecifierSeq(): TypeSpecifierSeqContext {
        return this.getRuleContext(0, TypeSpecifierSeqContext)!;
    }
    public conversionDeclarator(): ConversionDeclaratorContext | null {
        return this.getRuleContext(0, ConversionDeclaratorContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_conversionTypeId;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterConversionTypeId) {
             listener.enterConversionTypeId(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitConversionTypeId) {
             listener.exitConversionTypeId(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitConversionTypeId) {
            return visitor.visitConversionTypeId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConversionDeclaratorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public pointerOperator(): PointerOperatorContext {
        return this.getRuleContext(0, PointerOperatorContext)!;
    }
    public conversionDeclarator(): ConversionDeclaratorContext | null {
        return this.getRuleContext(0, ConversionDeclaratorContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_conversionDeclarator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterConversionDeclarator) {
             listener.enterConversionDeclarator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitConversionDeclarator) {
             listener.exitConversionDeclarator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitConversionDeclarator) {
            return visitor.visitConversionDeclarator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ConstructorInitializerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Colon(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Colon, 0)!;
    }
    public memInitializerList(): MemInitializerListContext {
        return this.getRuleContext(0, MemInitializerListContext)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_constructorInitializer;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterConstructorInitializer) {
             listener.enterConstructorInitializer(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitConstructorInitializer) {
             listener.exitConstructorInitializer(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitConstructorInitializer) {
            return visitor.visitConstructorInitializer(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MemInitializerListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public memInitializer(): MemInitializerContext[];
    public memInitializer(i: number): MemInitializerContext | null;
    public memInitializer(i?: number): MemInitializerContext[] | MemInitializerContext | null {
        if (i === undefined) {
            return this.getRuleContexts(MemInitializerContext);
        }

        return this.getRuleContext(i, MemInitializerContext);
    }
    public Ellipsis(): antlr.TerminalNode[];
    public Ellipsis(i: number): antlr.TerminalNode | null;
    public Ellipsis(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Ellipsis);
    	} else {
    		return this.getToken(CPP14Parser.Ellipsis, i);
    	}
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_memInitializerList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterMemInitializerList) {
             listener.enterMemInitializerList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitMemInitializerList) {
             listener.exitMemInitializerList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitMemInitializerList) {
            return visitor.visitMemInitializerList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MemInitializerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public meminitializerid(): MeminitializeridContext {
        return this.getRuleContext(0, MeminitializeridContext)!;
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftParen, 0);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightParen, 0);
    }
    public bracedInitList(): BracedInitListContext | null {
        return this.getRuleContext(0, BracedInitListContext);
    }
    public expressionList(): ExpressionListContext | null {
        return this.getRuleContext(0, ExpressionListContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_memInitializer;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterMemInitializer) {
             listener.enterMemInitializer(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitMemInitializer) {
             listener.exitMemInitializer(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitMemInitializer) {
            return visitor.visitMemInitializer(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class MeminitializeridContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public classOrDeclType(): ClassOrDeclTypeContext | null {
        return this.getRuleContext(0, ClassOrDeclTypeContext);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_meminitializerid;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterMeminitializerid) {
             listener.enterMeminitializerid(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitMeminitializerid) {
             listener.exitMeminitializerid(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitMeminitializerid) {
            return visitor.visitMeminitializerid(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class OperatorFunctionIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Operator(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Operator, 0)!;
    }
    public theOperator(): TheOperatorContext {
        return this.getRuleContext(0, TheOperatorContext)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_operatorFunctionId;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterOperatorFunctionId) {
             listener.enterOperatorFunctionId(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitOperatorFunctionId) {
             listener.exitOperatorFunctionId(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitOperatorFunctionId) {
            return visitor.visitOperatorFunctionId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LiteralOperatorIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Operator(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Operator, 0)!;
    }
    public StringLiteral(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.StringLiteral, 0);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public UserDefinedStringLiteral(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.UserDefinedStringLiteral, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_literalOperatorId;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterLiteralOperatorId) {
             listener.enterLiteralOperatorId(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitLiteralOperatorId) {
             listener.exitLiteralOperatorId(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitLiteralOperatorId) {
            return visitor.visitLiteralOperatorId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemplateDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Template(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Template, 0)!;
    }
    public Less(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Less, 0)!;
    }
    public templateparameterList(): TemplateparameterListContext {
        return this.getRuleContext(0, TemplateparameterListContext)!;
    }
    public Greater(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Greater, 0)!;
    }
    public declaration(): DeclarationContext {
        return this.getRuleContext(0, DeclarationContext)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_templateDeclaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTemplateDeclaration) {
             listener.enterTemplateDeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTemplateDeclaration) {
             listener.exitTemplateDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTemplateDeclaration) {
            return visitor.visitTemplateDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemplateparameterListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public templateParameter(): TemplateParameterContext[];
    public templateParameter(i: number): TemplateParameterContext | null;
    public templateParameter(i?: number): TemplateParameterContext[] | TemplateParameterContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TemplateParameterContext);
        }

        return this.getRuleContext(i, TemplateParameterContext);
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_templateparameterList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTemplateparameterList) {
             listener.enterTemplateparameterList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTemplateparameterList) {
             listener.exitTemplateparameterList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTemplateparameterList) {
            return visitor.visitTemplateparameterList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemplateParameterContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public typeParameter(): TypeParameterContext | null {
        return this.getRuleContext(0, TypeParameterContext);
    }
    public parameterDeclaration(): ParameterDeclarationContext | null {
        return this.getRuleContext(0, ParameterDeclarationContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_templateParameter;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTemplateParameter) {
             listener.enterTemplateParameter(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTemplateParameter) {
             listener.exitTemplateParameter(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTemplateParameter) {
            return visitor.visitTemplateParameter(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeParameterContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Class(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Class, 0);
    }
    public Typename_(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Typename_, 0);
    }
    public Assign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Assign, 0);
    }
    public theTypeId(): TheTypeIdContext | null {
        return this.getRuleContext(0, TheTypeIdContext);
    }
    public Template(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Template, 0);
    }
    public Less(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Less, 0);
    }
    public templateparameterList(): TemplateparameterListContext | null {
        return this.getRuleContext(0, TemplateparameterListContext);
    }
    public Greater(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Greater, 0);
    }
    public Ellipsis(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Ellipsis, 0);
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_typeParameter;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTypeParameter) {
             listener.enterTypeParameter(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTypeParameter) {
             listener.exitTypeParameter(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTypeParameter) {
            return visitor.visitTypeParameter(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class SimpleTemplateIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public templateName(): TemplateNameContext {
        return this.getRuleContext(0, TemplateNameContext)!;
    }
    public Less(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Less, 0)!;
    }
    public Greater(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Greater, 0)!;
    }
    public templateArgumentList(): TemplateArgumentListContext | null {
        return this.getRuleContext(0, TemplateArgumentListContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_simpleTemplateId;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterSimpleTemplateId) {
             listener.enterSimpleTemplateId(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitSimpleTemplateId) {
             listener.exitSimpleTemplateId(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitSimpleTemplateId) {
            return visitor.visitSimpleTemplateId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemplateIdContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public simpleTemplateId(): SimpleTemplateIdContext | null {
        return this.getRuleContext(0, SimpleTemplateIdContext);
    }
    public Less(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Less, 0);
    }
    public Greater(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Greater, 0);
    }
    public operatorFunctionId(): OperatorFunctionIdContext | null {
        return this.getRuleContext(0, OperatorFunctionIdContext);
    }
    public literalOperatorId(): LiteralOperatorIdContext | null {
        return this.getRuleContext(0, LiteralOperatorIdContext);
    }
    public templateArgumentList(): TemplateArgumentListContext | null {
        return this.getRuleContext(0, TemplateArgumentListContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_templateId;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTemplateId) {
             listener.enterTemplateId(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTemplateId) {
             listener.exitTemplateId(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTemplateId) {
            return visitor.visitTemplateId(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemplateNameContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Identifier(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Identifier, 0)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_templateName;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTemplateName) {
             listener.enterTemplateName(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTemplateName) {
             listener.exitTemplateName(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTemplateName) {
            return visitor.visitTemplateName(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemplateArgumentListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public templateArgument(): TemplateArgumentContext[];
    public templateArgument(i: number): TemplateArgumentContext | null;
    public templateArgument(i?: number): TemplateArgumentContext[] | TemplateArgumentContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TemplateArgumentContext);
        }

        return this.getRuleContext(i, TemplateArgumentContext);
    }
    public Ellipsis(): antlr.TerminalNode[];
    public Ellipsis(i: number): antlr.TerminalNode | null;
    public Ellipsis(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Ellipsis);
    	} else {
    		return this.getToken(CPP14Parser.Ellipsis, i);
    	}
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_templateArgumentList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTemplateArgumentList) {
             listener.enterTemplateArgumentList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTemplateArgumentList) {
             listener.exitTemplateArgumentList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTemplateArgumentList) {
            return visitor.visitTemplateArgumentList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TemplateArgumentContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public theTypeId(): TheTypeIdContext | null {
        return this.getRuleContext(0, TheTypeIdContext);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public idExpression(): IdExpressionContext | null {
        return this.getRuleContext(0, IdExpressionContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_templateArgument;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTemplateArgument) {
             listener.enterTemplateArgument(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTemplateArgument) {
             listener.exitTemplateArgument(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTemplateArgument) {
            return visitor.visitTemplateArgument(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeNameSpecifierContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Typename_(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Typename_, 0)!;
    }
    public nestedNameSpecifier(): NestedNameSpecifierContext {
        return this.getRuleContext(0, NestedNameSpecifierContext)!;
    }
    public Identifier(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Identifier, 0);
    }
    public simpleTemplateId(): SimpleTemplateIdContext | null {
        return this.getRuleContext(0, SimpleTemplateIdContext);
    }
    public Template(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Template, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_typeNameSpecifier;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTypeNameSpecifier) {
             listener.enterTypeNameSpecifier(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTypeNameSpecifier) {
             listener.exitTypeNameSpecifier(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTypeNameSpecifier) {
            return visitor.visitTypeNameSpecifier(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExplicitInstantiationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Template(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Template, 0)!;
    }
    public declaration(): DeclarationContext {
        return this.getRuleContext(0, DeclarationContext)!;
    }
    public Extern(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Extern, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_explicitInstantiation;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterExplicitInstantiation) {
             listener.enterExplicitInstantiation(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitExplicitInstantiation) {
             listener.exitExplicitInstantiation(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitExplicitInstantiation) {
            return visitor.visitExplicitInstantiation(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExplicitSpecializationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Template(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Template, 0)!;
    }
    public Less(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Less, 0)!;
    }
    public Greater(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Greater, 0)!;
    }
    public declaration(): DeclarationContext {
        return this.getRuleContext(0, DeclarationContext)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_explicitSpecialization;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterExplicitSpecialization) {
             listener.enterExplicitSpecialization(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitExplicitSpecialization) {
             listener.exitExplicitSpecialization(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitExplicitSpecialization) {
            return visitor.visitExplicitSpecialization(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TryBlockContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Try(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Try, 0)!;
    }
    public compoundStatement(): CompoundStatementContext {
        return this.getRuleContext(0, CompoundStatementContext)!;
    }
    public handlerSeq(): HandlerSeqContext {
        return this.getRuleContext(0, HandlerSeqContext)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_tryBlock;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTryBlock) {
             listener.enterTryBlock(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTryBlock) {
             listener.exitTryBlock(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTryBlock) {
            return visitor.visitTryBlock(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class FunctionTryBlockContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Try(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Try, 0)!;
    }
    public compoundStatement(): CompoundStatementContext {
        return this.getRuleContext(0, CompoundStatementContext)!;
    }
    public handlerSeq(): HandlerSeqContext {
        return this.getRuleContext(0, HandlerSeqContext)!;
    }
    public constructorInitializer(): ConstructorInitializerContext | null {
        return this.getRuleContext(0, ConstructorInitializerContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_functionTryBlock;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterFunctionTryBlock) {
             listener.enterFunctionTryBlock(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitFunctionTryBlock) {
             listener.exitFunctionTryBlock(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitFunctionTryBlock) {
            return visitor.visitFunctionTryBlock(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class HandlerSeqContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public handler(): HandlerContext[];
    public handler(i: number): HandlerContext | null;
    public handler(i?: number): HandlerContext[] | HandlerContext | null {
        if (i === undefined) {
            return this.getRuleContexts(HandlerContext);
        }

        return this.getRuleContext(i, HandlerContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_handlerSeq;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterHandlerSeq) {
             listener.enterHandlerSeq(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitHandlerSeq) {
             listener.exitHandlerSeq(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitHandlerSeq) {
            return visitor.visitHandlerSeq(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class HandlerContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Catch(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Catch, 0)!;
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public exceptionDeclaration(): ExceptionDeclarationContext {
        return this.getRuleContext(0, ExceptionDeclarationContext)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
    }
    public compoundStatement(): CompoundStatementContext {
        return this.getRuleContext(0, CompoundStatementContext)!;
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_handler;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterHandler) {
             listener.enterHandler(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitHandler) {
             listener.exitHandler(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitHandler) {
            return visitor.visitHandler(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExceptionDeclarationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public typeSpecifierSeq(): TypeSpecifierSeqContext | null {
        return this.getRuleContext(0, TypeSpecifierSeqContext);
    }
    public attributeSpecifierSeq(): AttributeSpecifierSeqContext | null {
        return this.getRuleContext(0, AttributeSpecifierSeqContext);
    }
    public declarator(): DeclaratorContext | null {
        return this.getRuleContext(0, DeclaratorContext);
    }
    public abstractDeclarator(): AbstractDeclaratorContext | null {
        return this.getRuleContext(0, AbstractDeclaratorContext);
    }
    public Ellipsis(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Ellipsis, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_exceptionDeclaration;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterExceptionDeclaration) {
             listener.enterExceptionDeclaration(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitExceptionDeclaration) {
             listener.exitExceptionDeclaration(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitExceptionDeclaration) {
            return visitor.visitExceptionDeclaration(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ThrowExpressionContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Throw(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Throw, 0)!;
    }
    public assignmentExpression(): AssignmentExpressionContext | null {
        return this.getRuleContext(0, AssignmentExpressionContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_throwExpression;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterThrowExpression) {
             listener.enterThrowExpression(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitThrowExpression) {
             listener.exitThrowExpression(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitThrowExpression) {
            return visitor.visitThrowExpression(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class ExceptionSpecificationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public dynamicExceptionSpecification(): DynamicExceptionSpecificationContext | null {
        return this.getRuleContext(0, DynamicExceptionSpecificationContext);
    }
    public noeExceptSpecification(): NoeExceptSpecificationContext | null {
        return this.getRuleContext(0, NoeExceptSpecificationContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_exceptionSpecification;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterExceptionSpecification) {
             listener.enterExceptionSpecification(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitExceptionSpecification) {
             listener.exitExceptionSpecification(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitExceptionSpecification) {
            return visitor.visitExceptionSpecification(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class DynamicExceptionSpecificationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Throw(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Throw, 0)!;
    }
    public LeftParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.LeftParen, 0)!;
    }
    public RightParen(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.RightParen, 0)!;
    }
    public typeIdList(): TypeIdListContext | null {
        return this.getRuleContext(0, TypeIdListContext);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_dynamicExceptionSpecification;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterDynamicExceptionSpecification) {
             listener.enterDynamicExceptionSpecification(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitDynamicExceptionSpecification) {
             listener.exitDynamicExceptionSpecification(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitDynamicExceptionSpecification) {
            return visitor.visitDynamicExceptionSpecification(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TypeIdListContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public theTypeId(): TheTypeIdContext[];
    public theTypeId(i: number): TheTypeIdContext | null;
    public theTypeId(i?: number): TheTypeIdContext[] | TheTypeIdContext | null {
        if (i === undefined) {
            return this.getRuleContexts(TheTypeIdContext);
        }

        return this.getRuleContext(i, TheTypeIdContext);
    }
    public Ellipsis(): antlr.TerminalNode[];
    public Ellipsis(i: number): antlr.TerminalNode | null;
    public Ellipsis(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Ellipsis);
    	} else {
    		return this.getToken(CPP14Parser.Ellipsis, i);
    	}
    }
    public Comma(): antlr.TerminalNode[];
    public Comma(i: number): antlr.TerminalNode | null;
    public Comma(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Comma);
    	} else {
    		return this.getToken(CPP14Parser.Comma, i);
    	}
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_typeIdList;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTypeIdList) {
             listener.enterTypeIdList(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTypeIdList) {
             listener.exitTypeIdList(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTypeIdList) {
            return visitor.visitTypeIdList(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class NoeExceptSpecificationContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public Noexcept(): antlr.TerminalNode {
        return this.getToken(CPP14Parser.Noexcept, 0)!;
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftParen, 0);
    }
    public constantExpression(): ConstantExpressionContext | null {
        return this.getRuleContext(0, ConstantExpressionContext);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightParen, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_noeExceptSpecification;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterNoeExceptSpecification) {
             listener.enterNoeExceptSpecification(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitNoeExceptSpecification) {
             listener.exitNoeExceptSpecification(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitNoeExceptSpecification) {
            return visitor.visitNoeExceptSpecification(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class TheOperatorContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public New(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.New, 0);
    }
    public LeftBracket(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftBracket, 0);
    }
    public RightBracket(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightBracket, 0);
    }
    public Delete(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Delete, 0);
    }
    public Plus(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Plus, 0);
    }
    public Minus(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Minus, 0);
    }
    public Star(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Star, 0);
    }
    public Div(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Div, 0);
    }
    public Mod(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Mod, 0);
    }
    public Caret(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Caret, 0);
    }
    public And(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.And, 0);
    }
    public Or(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Or, 0);
    }
    public Tilde(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Tilde, 0);
    }
    public Not(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Not, 0);
    }
    public Assign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Assign, 0);
    }
    public Greater(): antlr.TerminalNode[];
    public Greater(i: number): antlr.TerminalNode | null;
    public Greater(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Greater);
    	} else {
    		return this.getToken(CPP14Parser.Greater, i);
    	}
    }
    public Less(): antlr.TerminalNode[];
    public Less(i: number): antlr.TerminalNode | null;
    public Less(i?: number): antlr.TerminalNode | null | antlr.TerminalNode[] {
    	if (i === undefined) {
    		return this.getTokens(CPP14Parser.Less);
    	} else {
    		return this.getToken(CPP14Parser.Less, i);
    	}
    }
    public GreaterEqual(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.GreaterEqual, 0);
    }
    public PlusAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.PlusAssign, 0);
    }
    public MinusAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.MinusAssign, 0);
    }
    public StarAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.StarAssign, 0);
    }
    public ModAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.ModAssign, 0);
    }
    public XorAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.XorAssign, 0);
    }
    public AndAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.AndAssign, 0);
    }
    public OrAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.OrAssign, 0);
    }
    public RightShiftAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightShiftAssign, 0);
    }
    public LeftShiftAssign(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftShiftAssign, 0);
    }
    public Equal(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Equal, 0);
    }
    public NotEqual(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.NotEqual, 0);
    }
    public LessEqual(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LessEqual, 0);
    }
    public AndAnd(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.AndAnd, 0);
    }
    public OrOr(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.OrOr, 0);
    }
    public PlusPlus(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.PlusPlus, 0);
    }
    public MinusMinus(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.MinusMinus, 0);
    }
    public Comma(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Comma, 0);
    }
    public ArrowStar(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.ArrowStar, 0);
    }
    public Arrow(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.Arrow, 0);
    }
    public LeftParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.LeftParen, 0);
    }
    public RightParen(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.RightParen, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_theOperator;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterTheOperator) {
             listener.enterTheOperator(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitTheOperator) {
             listener.exitTheOperator(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitTheOperator) {
            return visitor.visitTheOperator(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}


export class LiteralContext extends antlr.ParserRuleContext {
    public constructor(parent: antlr.ParserRuleContext | null, invokingState: number) {
        super(parent, invokingState);
    }
    public IntegerLiteral(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.IntegerLiteral, 0);
    }
    public CharacterLiteral(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.CharacterLiteral, 0);
    }
    public FloatingLiteral(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.FloatingLiteral, 0);
    }
    public StringLiteral(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.StringLiteral, 0);
    }
    public BooleanLiteral(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.BooleanLiteral, 0);
    }
    public PointerLiteral(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.PointerLiteral, 0);
    }
    public UserDefinedLiteral(): antlr.TerminalNode | null {
        return this.getToken(CPP14Parser.UserDefinedLiteral, 0);
    }
    public override get ruleIndex(): number {
        return CPP14Parser.RULE_literal;
    }
    public override enterRule(listener: CPP14ParserListener): void {
        if(listener.enterLiteral) {
             listener.enterLiteral(this);
        }
    }
    public override exitRule(listener: CPP14ParserListener): void {
        if(listener.exitLiteral) {
             listener.exitLiteral(this);
        }
    }
    public override accept<Result>(visitor: CPP14ParserVisitor<Result>): Result | null {
        if (visitor.visitLiteral) {
            return visitor.visitLiteral(this);
        } else {
            return visitor.visitChildren(this);
        }
    }
}
