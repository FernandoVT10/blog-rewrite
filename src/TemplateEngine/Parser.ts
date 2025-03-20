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
    TokenAndOperators
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
        return this.cursor >= this.tokens.length;
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

    private variable(): VarNode {
        const keys: string[] = [];

        if(!this.isNext(TokenType.IDENTIFIER)) {
            this.error("Expected identifier");
        }

        keys.push(this.advance().lexeme);

        while(this.isNext(TokenType.DOT) || this.isNext(TokenType.OPEN_BRACKET)) {
            const prevToken = this.advance();

            if(prevToken.type === TokenType.DOT) {
                if(!this.isNext(TokenType.IDENTIFIER)) {
                    this.error("Expected identifier");
                    break;
                }

                keys.push(this.advance().lexeme);
            } else if(prevToken.type === TokenType.OPEN_BRACKET) {
                if(!this.isNext(TokenType.NUMBER)) {
                    this.error("Expected number");
                    break;
                }

                keys.push(this.advance().lexeme);

                if(!this.match(TokenType.CLOSE_BRACKET)) {
                    this.error('Expected "]"');
                    break;
                }
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
        const ifToken = this.prev();

        if(!this.match(TokenType.OPEN_PAREN)) {
            this.error('Expected "("');
        }

        const condition = this.condition();

        if(!this.match(TokenType.CLOSE_PAREN)) {
            if(!this.isNext(TokenType.CLOSE_EXPR)) {
                this.error("Expected operator");
                this.advance();
            } else {
                this.error('Expected ")"');
            }
        }

        if(!this.match(TokenType.CLOSE_EXPR)) {
            this.error('Expected "}}"');
        }

        const nodes = this.parse(() => {
            return !(this.isNext(TokenType.OPEN_EXPR) && this.isNext(TokenType.ENDIF, 1));
        });

        if(!this.match(TokenType.OPEN_EXPR) || !this.match(TokenType.ENDIF)) {
            this.compiler.syntaxErrorToken("Unterminated if", ifToken);
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
                    switch(this.peek().type) {
                        case TokenType.IDENTIFIER:
                            nodes.push(this.variable());
                            break;
                        case TokenType.IF:
                            nodes.push(this.ifStatement());
                            break;
                        case TokenType.NUMBER:
                            this.compiler.syntaxErrorToken("Expected identifier before number", this.advance());
                            continue;
                        case TokenType.CLOSE_EXPR:
                            this.error("Empty expression");
                            break;
                    }

                    if(!this.match(TokenType.CLOSE_EXPR)) {
                        this.error('Expected "}}"');
                    }
                } break;
            }
        }

        return nodes;
    }

    private error(message: string): void {
        const line = this.prev().line;
        const col = this.prev().col[1];
        this.compiler.syntaxError(message, line, col);
    }
}
