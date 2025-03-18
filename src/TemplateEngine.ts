import { Response } from "express";
import Compiler from "./TemplateEngine/Compiler";

import { TokenType, Token } from "./TemplateEngine/types";

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

const TokenAndOperators = new Map<TokenType, Operators>();
TokenAndOperators.set(TokenType.DOUBLE_EQUAL, Operators.EQUAL);
TokenAndOperators.set(TokenType.BANG_EQUAL, Operators.NOT_EQUAL);
TokenAndOperators.set(TokenType.GREATHER, Operators.GREATHER);
TokenAndOperators.set(TokenType.LESS, Operators.LESS);
TokenAndOperators.set(TokenType.GREATHER_OR_EQ, Operators.GREATHER_OR_EQ);
TokenAndOperators.set(TokenType.LESS_OR_EQ, Operators.LESS_OR_EQ);
TokenAndOperators.set(TokenType.DOUBLE_AND, Operators.AND);

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

    private isNext(type: TokenType, offset = 0): boolean {
        return this.tokens[this.cursor + offset].type === type;
    }

    private match(type: TokenType): boolean {
        if(this.isAtTheEnd()) return false;

        if(this.isNext(type)) {
            this.advance();
            return true;
        }

        return false;
    }

    private peek(): Token {
        return this.tokens[this.cursor];
    }

    private variable(): VarNode {
        const keys: string[] = [];
        keys.push(this.advance().lexeme);

        while(this.isNext(TokenType.DOT) || this.isNext(TokenType.OPEN_BRACKET)) {
            const prevToken = this.advance();

            if(prevToken.type === TokenType.DOT) {
                if(!this.isNext(TokenType.IDENTIFIER)) {
                    throw new Error("Invalid syntax");
                }

                keys.push(this.advance().lexeme);
            } else if(prevToken.type === TokenType.OPEN_BRACKET) {
                if(!this.isNext(TokenType.NUMBER)) {
                    throw this.parseError("Expected number", this.advance());
                }

                keys.push(this.advance().lexeme);

                if(!this.match(TokenType.CLOSE_BRACKET)) {
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

        if(this.match(TokenType.BANG)) {
            negated = true;
        }

        let value: UnaryNode["value"];

        if(this.isNext(TokenType.NUMBER)) {
            value = parseInt(this.advance().lexeme);
        } else if(this.isNext(TokenType.STRING)) {
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

        while(TokenAndOperators.has(this.peek().type)) {
            expr = this.binary(expr);
        }

        return expr;
    }

    private ifStatement(): IfNode {
        this.match(TokenType.IF);

        if(!this.match(TokenType.OPEN_PAREN)) {
            throw this.parseError(`Expected "("`, this.peek());
        }

        const condition = this.condition();

        if(!this.match(TokenType.CLOSE_PAREN)) {
            throw this.parseError(`Expected ")"`, this.peek());
        }

        if(!this.match(TokenType.CLOSE_EXPR)) {
            throw this.parseError(`Expected "}}"`, this.peek());
        }

        const nodes = this.parse(() => {
            return !(this.isNext(TokenType.OPEN_EXPR) && this.isNext(TokenType.ENDIF, 1));
        });

        if(!this.match(TokenType.OPEN_EXPR) || !this.match(TokenType.ENDIF)) {
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
                    const nextToken = this.peek();

                    switch(this.peek().type) {
                        case TokenType.IDENTIFIER:
                            nodes.push(this.variable());
                            break;
                        case TokenType.IF:
                            nodes.push(this.ifStatement());
                            break;
                        case TokenType.NUMBER:
                            throw this.parseError("Unexpected number", nextToken);
                    }

                    if(!this.match(TokenType.CLOSE_EXPR)) {
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
            details = `at line:${token.line} col:${token.col})`;
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
            try {
                const view = await this.parseFile(path);
                this.views.set(key, view);
            } catch(e) {
                if(e instanceof Error) {
                    console.log(e.message);
                } else {
                    console.error(e);
                }
            }
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
        const compiler = new Compiler();
        await compiler.compileFile(filePath);
        // const file = await fs.promises.readFile(filePath, { encoding: "utf8" });
        // const contents = file.toString();
        //
        // const lexer = new Lexer(contents, filePath);
        // const tokens: Token[] = lexer.scanTokens();
        // if(lexer.errors.length > 0) {
        //     for(const e of lexer.errors) {
        //         console.log(e.message);
        //     }
        // }
        //
        // const parser = new Parser(tokens);
        // const templateNodes = parser.parse();
        return (args) => this.compileNodes([], args);
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
