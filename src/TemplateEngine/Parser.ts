import Compiler from "./Compiler";
import {
    Token,
    TokenType,
    NodeTypes,
    VarNode,
    UnaryNode,
    BinaryNode,
    LogicExpr,
    TemplateNode,
    IfNode,
    Operators,
    TokenAndOperators,
    ForNode
} from "./types";

export default class Parser {
    private tokens: Token[];
    private cursor = 0;
    private compiler: Compiler;

    constructor(tokens: Token[], compiler: Compiler) {
        this.tokens = tokens;
        this.compiler = compiler;
    }

    private isAtTheEnd(): boolean {
        return this.peek().type === TokenType.EOF;
    }

    private advance(): Token {
        return this.tokens[this.cursor++];
    }

    private isNext(type: TokenType, offset = 0): boolean {
        if(this.cursor + offset >= this.tokens.length) return false;
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

    private prev(): Token {
        const pos = this.cursor > 0 ? this.cursor - 1 : 0;
        return this.tokens[pos];
    }

    private consume(type: TokenType, message: string): Token {
        if(!this.match(type)) {
            throw this.errorAfter(this.prev(), message);
        }

        return this.prev();
    }

    private variable(): VarNode {
        const keys: string[] = [];

        const token = this.consume(TokenType.IDENTIFIER, "Expected variable name");

        keys.push(token.lexeme);

        while(this.isNext(TokenType.DOT) || this.isNext(TokenType.OPEN_BRACKET)) {
            const prevToken = this.advance();

            if(prevToken.type === TokenType.DOT) {
                const tkn = this.consume(TokenType.IDENTIFIER, 'Expected property name after "."');
                keys.push(tkn.lexeme);
            } else if(prevToken.type === TokenType.OPEN_BRACKET) {
                const tkn = this.consume(TokenType.NUMBER, 'Expected array index after "["');
                keys.push(tkn.lexeme);
                this.consume(TokenType.CLOSE_BRACKET, 'Expected "]" after index');
            }
        }

        return {
            type: NodeTypes.VAR,
            keys,
        };
    }

    private primary(): VarNode | string | number {
        switch(this.peek().type) {
            case TokenType.NUMBER:
                return parseInt(this.advance().lexeme);
            case TokenType.STRING:
                return this.advance().lexeme;
            case TokenType.IDENTIFIER:
                return this.variable();
        }

        throw this.errorAfter(this.prev(), "Expected expression");
    }

    private unary(): UnaryNode {
        let negated = false;

        if(this.match(TokenType.BANG)) {
            negated = true;
        }

        const value = this.primary();

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
        const ifToken = this.prev();

        this.consume(TokenType.OPEN_PAREN, 'Expected "(" after "if"');

        const condition = this.condition();

        if(!this.match(TokenType.CLOSE_PAREN)) {
            if(!this.isNext(TokenType.CLOSE_EXPR)) {
                throw this.errorAfter(this.prev(), "Expected operator after expression");
            } else {
                throw this.errorAfter(this.prev(), 'Expected ")" after condition');
            }
        }

        this.consume(TokenType.CLOSE_EXPR, 'Expected "}}" after "if" statement');

        const nodes = this.parse(() => {
            return !(this.isNext(TokenType.OPEN_EXPR) && this.isNext(TokenType.ENDIF, 1));
        });

        if(!this.match(TokenType.OPEN_EXPR) || !this.match(TokenType.ENDIF)) {
            throw this.error(ifToken, "Unterminated if statement");
        }

        return {
            type: NodeTypes.IF,
            condition,
            nodes,
        };
    }

    private forStatement(): ForNode {
        const forToken = this.advance();

        this.consume(TokenType.OPEN_PAREN, 'Expected "(" after "for"');

        const nameToken = this.consume(TokenType.IDENTIFIER, 'Expected declaration after "("');
        const itemName = nameToken.lexeme;

        this.consume(TokenType.IN, 'Expected "in" keyword after declaration');

        if(!this.isNext(TokenType.IDENTIFIER)) {
            throw this.errorAfter(this.prev(), 'Expected variable after "in"');
        }

        const arrayVar = this.variable();

        this.consume(TokenType.CLOSE_PAREN, 'Expected ")" after expression');
        this.consume(TokenType.CLOSE_EXPR, 'Expected "}}" after "for" statement');

        const nodes = this.parse(() => {
            return !(this.isNext(TokenType.OPEN_EXPR) && this.isNext(TokenType.ENDFOR, 1));
        });

        if(!this.match(TokenType.OPEN_EXPR) || !this.match(TokenType.ENDFOR)) {
            throw this.error(forToken, "Unterminated for statement");
        }

        return {
            type: NodeTypes.FOR,
            arrayVar,
            itemName,
            nodes,
        };
    }

    private parseExpr(): TemplateNode | null {
        try {
            switch(this.peek().type) {
                case TokenType.IDENTIFIER: return this.variable();
                case TokenType.IF: return this.ifStatement();
                case TokenType.NUMBER:
                    throw this.error(this.advance(), "Expected expression before number");
                case TokenType.CLOSE_EXPR:
                    this.error(this.advance(), "Invalid empty expression");
                    return null;
                case TokenType.FOR: return this.forStatement();
            }
        } catch {
            while(!this.isAtTheEnd()) {
                switch(this.peek().type) {
                    case TokenType.OPEN_EXPR:
                    case TokenType.CLOSE_EXPR:
                    case TokenType.LITERAL:
                        return null;
                }

                this.advance();
            }
        }

        return null;
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
                    const expr = this.parseExpr();

                    if(expr) {
                        nodes.push(expr);

                        if(!this.match(TokenType.CLOSE_EXPR)) {
                            this.errorAfter(this.prev(), 'Expected closing "}}"');
                        }
                    }
                } break;
            }
        }

        return nodes;
    }

    private error(token: Token, message: string): Error {
        this.compiler.syntaxError(message, token.line, token.col);
        return new Error;
    }

    // sets the marker of the error after the token
    private errorAfter(token: Token, message: string): Error {
        const line = token.line;
        const col = token.col[1];
        this.compiler.syntaxError(message, line, col);
        return new Error;
    }
}
