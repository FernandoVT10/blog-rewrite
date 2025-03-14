import fs from "fs";
import { Response } from "express";

enum NodeTypes {
    LITERAL, VAR, IF, UNARY, BINARY
};

type LiteralNode = {
    type: NodeTypes.LITERAL;
    contents: string;
};

type VarNode = {
    type: NodeTypes.VAR;
    // this stores all the indexes in order. "foo.bar[2]" will output ["foo", "bar", "2"]
    keys: string[];
};

type UnaryNode = {
    type: NodeTypes.UNARY;
    value: VarNode | number | string;
    negated: boolean;
};

enum Operators {
    EQUAL, NOT_EQUAL, GREATHER, LESS,
    GREATHER_OR_EQ, LESS_OR_EQ, AND
};

type BinaryNode = {
    type: NodeTypes.BINARY;
    operator: Operators;
    left: LogicExpr;
    right: LogicExpr;
};

type LogicExpr = UnaryNode | BinaryNode;

type IfNode = {
    type: NodeTypes.IF;
    condition: LogicExpr;
    nodes: TemplateNode[];
};

type TemplateNode = LiteralNode | VarNode | IfNode;

type TemplateViewArgs = any;
type TemplateView = (args: TemplateViewArgs) => string;

// FORMAL GRAMMAR
// Expr = If | OpenExpr Variable CloseExpr
// Variable = VarName (("." VarName) | ("[" Number+ "]"))?
// VarName = [A-Za-z_$] [A-Za-z_$0-9]+
//
// If = IfStart Literal IfEnd
// IfStart = OpenExpr "if" Spaces "(" Spaces Condition Spaces ")" CloseExpr
// IfStart = OpenExpr "endif" CloseExpr
// LogicExpr = Bynary | Unary
// Binary = (Binary | Unary) Operation (Binary | Unary)
// Operation = "==" | ">" | "<" | ">=" | "<=" | "!="
// Unary = "!"? (Variable | String | Number)
// String = "\"" * "\""
// Number [0-9]
//
// OpenExpr = "{{" Spaces
// CloseExpr = Spaces "}}"
// Spaces = " "+
// Literal = !OpenExpr *

enum TokenType {
    LITERAL,
    OPEN_EXPR, CLOSE_EXPR, // "{{" and "}}"
    OPEN_BRACKET, CLOSE_BRACKET, // "[" and "]"
    OPEN_PAREN, CLOSE_PAREN, // "(" and ")"
    IDENTIFIER,
    DOT,
    NUMBER,
    IF,
    ENDIF,
    BANG, // "!"
    DOUBLE_EQUAL, BANG_EQUAL, // "==" and "!="
    GREATHER, LESS, // ">" and "<"
    GREATHER_OR_EQ, LESS_OR_EQ, // ">=" and "<="
    STRING,
    DOUBLE_AND, // "&&"
};

type Token = {
    type: TokenType;
    lexeme: string;
    line: number;
    column: number
};

const TokenAndOperators = new Map<TokenType, Operators>();
TokenAndOperators.set(TokenType.DOUBLE_EQUAL, Operators.EQUAL);
TokenAndOperators.set(TokenType.BANG_EQUAL, Operators.NOT_EQUAL);
TokenAndOperators.set(TokenType.GREATHER, Operators.GREATHER);
TokenAndOperators.set(TokenType.LESS, Operators.LESS);
TokenAndOperators.set(TokenType.GREATHER_OR_EQ, Operators.GREATHER_OR_EQ);
TokenAndOperators.set(TokenType.LESS_OR_EQ, Operators.LESS_OR_EQ);
TokenAndOperators.set(TokenType.DOUBLE_AND, Operators.AND);

export class Lexer {
    private buffer: string;
    private cursor = 0;
    private line = 0;
    private column = 0;
    private tokens: Token[] = [];
    private keywords: Map<string, TokenType> = new Map;

    constructor(buffer: string) {
        this.buffer = buffer;
        this.keywords.set("if", TokenType.IF);
        this.keywords.set("endif", TokenType.ENDIF);
    }

    private isAtTheEnd(): boolean {
        return this.cursor >= this.buffer.length;
    }

    private advance(): string {
        this.column++;

        if(this.buffer[this.cursor] == "\n") {
            this.column = 0;
            this.line = 0;
        }

        return this.buffer[this.cursor++];
    }

    private match(c: string): boolean {
        if(this.peek() === c) {
            this.advance();
            return true;
        }

        return false;
    }

    private peek(): string {
        return this.buffer[this.cursor];
    }

    private addToken(type: TokenType, lexeme = ""): void {
        this.tokens.push({ type, lexeme, line: this.line, column: this.column });
    }

    private identifier(c: string): void {
        let lexeme = c;
        while(/[A-Za-z$_0-9]/.test(this.peek()))
            lexeme += this.advance();

        const type = this.keywords.get(lexeme);

        if(type === undefined) {
            this.addToken(TokenType.IDENTIFIER, lexeme);
        } else {
            this.addToken(type);
        }
    }

    private number(c: string): void {
        let lexeme = c;
        while(/[0-9]/.test(this.peek()))
            lexeme += this.advance();
        this.addToken(TokenType.NUMBER, lexeme);
    }

    private string(): void {
        let lexeme = "";
        while(this.peek() !== '"' && !this.isAtTheEnd())
            lexeme += this.advance();

        if(!this.match('"')) {
            throw new Error("Not closing string found");
        }

        this.addToken(TokenType.STRING, lexeme);
    }

    private scanExpr(): void {
        while(this.peek() !== "}" && this.peek() !== "\n") {
            const c = this.advance();

            switch(c) {
                case ".": this.addToken(TokenType.DOT); break;
                case "[": this.addToken(TokenType.OPEN_BRACKET); break;
                case "]": this.addToken(TokenType.CLOSE_BRACKET); break;
                case "(": this.addToken(TokenType.OPEN_PAREN); break;
                case ")": this.addToken(TokenType.CLOSE_PAREN); break;
                case "!":
                    this.addToken(this.match("=") ? TokenType.BANG_EQUAL : TokenType.BANG);
                    break;
                case "=":
                    if(this.match("=")) {
                        this.addToken(TokenType.DOUBLE_EQUAL);
                    } else {
                        throw new Error("Unexpected character");
                    }

                    break;
                case ">":
                    this.addToken(
                        this.match("=") ? TokenType.GREATHER_OR_EQ : TokenType.GREATHER
                    );
                    break;
                case "<":
                    this.addToken(
                        this.match("=") ? TokenType.LESS_OR_EQ : TokenType.LESS
                    );
                    break;
                case "\"": this.string(); break;
                case "&":
                    if(this.match("&")) {
                        this.addToken(TokenType.DOUBLE_AND);
                    } else {
                        throw new Error("Unexpected character");
                    }
                    break;
                // ignore spaces
                case " ": break;
                default: {
                    if(/[0-9]/.test(c)) {
                        this.number(c);
                    } else if(/[A-Za-z$_]/.test(c)) {
                        this.identifier(c);
                    } else {
                        throw new Error("Unexpected character");
                    }
                }
            }
        }

        if(this.match("}") && this.match("}")) {
            this.addToken(TokenType.CLOSE_EXPR);
        }
    }

    private scanLiteral(c: string): void {
        let token: Token;
        const len = this.tokens.length;
        if(len > 0 && this.tokens[len - 1].type === TokenType.LITERAL) {
            token = this.tokens[this.tokens.length - 1];
        } else {
            this.addToken(TokenType.LITERAL, "");
            token = this.tokens[this.tokens.length - 1];
        }

        token.lexeme += c;

        while(this.peek() !== "{" && !this.isAtTheEnd()) {
            token.lexeme += this.advance();
        }
    }

    public scanTokens(): Token[] {
        while(!this.isAtTheEnd()) {
            let c = this.advance();

            if(c === "{" && this.match("{")) {
                this.addToken(TokenType.OPEN_EXPR);
                this.scanExpr();
            } else {
                this.scanLiteral(c);
            }
        }

        return this.tokens;
    }
}

export class Parser {
    private tokens: Token[];

    private cursor = 0;

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    private isAtTheEnd(): boolean {
        return this.cursor >= this.tokens.length;
    }

    private advance(): Token {
        return this.tokens[this.cursor++];
    }

    private isNextToken(type: TokenType, offset = 0): boolean {
        return this.tokens[this.cursor + offset].type === type;
    }

    private matchToken(type: TokenType): boolean {
        if(this.isAtTheEnd()) return false;

        if(this.isNextToken(type)) {
            this.advance();
            return true;
        }

        return false;
    }

    private peekToken(): Token {
        return this.tokens[this.cursor];
    }

    private variable(): VarNode {
        const keys: string[] = [];
        keys.push(this.advance().lexeme);

        while(this.isNextToken(TokenType.DOT) || this.isNextToken(TokenType.OPEN_BRACKET)) {
            const prevToken = this.advance();

            if(prevToken.type === TokenType.DOT) {
                if(!this.isNextToken(TokenType.IDENTIFIER)) {
                    throw new Error("Invalid syntax");
                }

                keys.push(this.advance().lexeme);
            } else if(prevToken.type === TokenType.OPEN_BRACKET) {
                if(!this.isNextToken(TokenType.NUMBER)) {
                    throw this.parseError("Expected number", this.advance());
                }

                keys.push(this.advance().lexeme);

                if(!this.matchToken(TokenType.CLOSE_BRACKET)) {
                    throw new Error("Invalid syntax");
                }
            } else {
                throw new Error("Invalid syntax");
            }
        }

        return {
            type: NodeTypes.VAR,
            keys,
        };
    }

    private unary(): UnaryNode {
        let negated = false;

        if(this.matchToken(TokenType.BANG)) {
            negated = true;
        }

        let value: UnaryNode["value"];

        if(this.isNextToken(TokenType.NUMBER)) {
            value = parseInt(this.advance().lexeme);
        } else if(this.isNextToken(TokenType.STRING)) {
            value = this.advance().lexeme;
        } else {
            value = this.variable();
        }

        return {
            type: NodeTypes.UNARY,
            value,
            negated,
        };
    }

    private binary(left: LogicExpr): BinaryNode {
        const operator = TokenAndOperators.get(this.advance().type) as Operators;
        const right = this.unary();

        return {
            type: NodeTypes.BINARY,
            operator,
            left,
            right,
        };
    }

    private condition(): LogicExpr {
        let expr: LogicExpr = this.unary();

        while(TokenAndOperators.has(this.peekToken().type)) {
            expr = this.binary(expr);
        }

        return expr;
    }

    private ifStatement(): IfNode {
        this.matchToken(TokenType.IF);

        if(!this.matchToken(TokenType.OPEN_PAREN)) {
            throw this.parseError(`Expected "("`, this.peekToken());
        }

        const condition = this.condition();

        if(!this.matchToken(TokenType.CLOSE_PAREN)) {
            throw this.parseError(`Expected ")"`, this.peekToken());
        }

        if(!this.matchToken(TokenType.CLOSE_EXPR)) {
            throw this.parseError(`Expected "}}"`, this.peekToken());
        }

        const nodes = this.parse(() => {
            return !(this.isNextToken(TokenType.OPEN_EXPR) && this.isNextToken(TokenType.ENDIF, 1));
        });

        if(!this.matchToken(TokenType.OPEN_EXPR) || !this.matchToken(TokenType.ENDIF)) {
            throw this.parseError("endif expected");
        }

        return {
            type: NodeTypes.IF,
            condition,
            nodes,
        };
    }

    public parse(predicate?: () => boolean): TemplateNode[] {
        const nodes: TemplateNode[] = [];

        while(!this.isAtTheEnd()) {
            if(predicate && !predicate()) {
                return nodes;
            }

            const token = this.advance();

            switch(token.type) {
                case TokenType.LITERAL: {
                    nodes.push({
                        type: NodeTypes.LITERAL,
                        contents: token.lexeme,
                    });
                } break;
                case TokenType.OPEN_EXPR: {
                    const nextToken = this.peekToken();

                    switch(this.peekToken().type) {
                        case TokenType.IDENTIFIER:
                            nodes.push(this.variable());
                            break;
                        case TokenType.IF:
                            nodes.push(this.ifStatement());
                            break;
                        case TokenType.NUMBER:
                            throw this.parseError("Unexpected number", nextToken);
                    }


                    if(!this.matchToken(TokenType.CLOSE_EXPR)) {
                        throw new Error("Invalid Syntax");
                    }
                } break;
            }
        }

        return nodes;
    }

    private parseError(msg: string, token?: Token): Error {
        // make this better!
        let details = "";

        if(token) {
            details = `at ${token.line}:${token.column}`;
        }
        return new Error(`${msg} ${details}`);
    }
}

type InitOpts = {
    views: Record<string, string>;
    debug?: boolean;
};

class TemplateEngine {
    private views: Map<string, TemplateView> = new Map;

    public async init(opts: InitOpts): Promise<void> {
        console.info(`[INFO] Compiling views`);
        for(const [key, path] of Object.entries(opts.views)) {
            if(opts.debug) console.info(`[INFO] Compiling "${key}" view`);
            this.views.set(key, await this.parseFile(path));
        }
    }

    public sendView(res: Response, viewName: string, args: TemplateViewArgs): void {
        const view = this.views.get(viewName);
        if(!view) {
            console.error(`[ERROR] There is no view with name "${viewName}"`);
            return;
        }

        res.setHeader("Content-Type", "text/html");
        res.send(view(args));
    }

    private async parseFile(filePath: string): Promise<TemplateView> {
        const file = await fs.promises.readFile(filePath, { encoding: "utf8" });
        const contents = file.toString();

        const lexer = new Lexer(contents);
        const parser = new Parser(lexer.scanTokens());
        const templateNodes = parser.parse();
        return (args) => this.compileNodes(templateNodes, args);
    }

    private getVariableValue(node: VarNode, args: TemplateViewArgs): any {
        let currentPath = "";
        let currentObj: any = args;

        for(let i = 0; i < node.keys.length; i++) {
            const key = node.keys[i];

            if(typeof currentObj !== "object") {
                console.error(`[ERROR] "${key}" can't be found in "${currentPath}"`);
                return "undefined";
            }

            if(i > 0) {
                // if the "key" starts with a number, it means it's an index
                if(/[0-9]/.test(key[0])) {
                    currentPath += `[${key}]`;
                } else {
                    currentPath += `.${key}`;
                }
            } else {
                currentPath = key;
            }

            if(currentObj[key] !== undefined) {
                // if it's the last key we return it's value stringified
                if(i === node.keys.length - 1) {
                    return currentObj[key];
                } else {
                    currentObj = currentObj[key];
                }
            } else {
                console.error(`[ERROR] "${currentPath}" is undefined`);
                return "undefined";
            }
        }

        return "undefined";
    }

    private compileUnary(unary: UnaryNode, args: TemplateViewArgs): any {
        let val: any;
        switch(typeof(unary.value)) {
            case "number":
            case "string":
                val = unary.value;
                break;
            default:
                val = this.getVariableValue(unary.value, args);
        }
        return unary.negated ? !val : val;
    }

    private compileLogicExpr(logicExpr: LogicExpr, args: TemplateViewArgs): any {
        if(logicExpr.type === NodeTypes.UNARY) {
            return this.compileUnary(logicExpr, args);
        } else if(logicExpr.type === NodeTypes.BINARY) {
            const v1 = this.compileLogicExpr(logicExpr.left, args);
            const v2 = this.compileLogicExpr(logicExpr.right, args);

            switch(logicExpr.operator) {
                case Operators.EQUAL: return v1 === v2;
                case Operators.NOT_EQUAL: return v1 !== v2;
                case Operators.GREATHER: return v1 > v2;
                case Operators.LESS: return v1 < v2;
                case Operators.GREATHER_OR_EQ: return v1 >= v2;
                case Operators.LESS_OR_EQ: return v1 <= v2;
                case Operators.AND: return v1 && v2;
            }
        }

        return false;
    }

    private compileIf(node: IfNode, args: TemplateViewArgs): string {
        if(this.compileLogicExpr(node.condition, args)) {
            return this.compileNodes(node.nodes, args);
        }

        return "";
    }

    public compileNodes(nodes: TemplateNode[], args: TemplateViewArgs): string {
        let res = "";
        for(const node of nodes) {
            switch(node.type) {
                case NodeTypes.LITERAL: {
                    res += node.contents;
                } break;
                case NodeTypes.VAR: {
                    res += this.getVariableValue(node, args).toString();
                } break;
                case NodeTypes.IF: {
                    res += this.compileIf(node, args);
                } break;
            }
        }
        return res;
    }
}

export default new TemplateEngine();
