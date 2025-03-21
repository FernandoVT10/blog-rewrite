import fs from "fs";

import Lexer from "./Lexer";
import Parser from "./Parser";

import {
    Token,
    View,
    ViewArgs,
    Stmt,
    StmtTypes,
    ExprTypes,
    VarStmt,
    IfStmt,
    ForStmt,
    LogicExpr,
    Operators
} from "./types";

export enum ANSIColor {
    RED = "\x1b[31m",
    BLUE = "\x1b[34m",
    GRAY = "\x1b[90m",
};

export function formatString(color: ANSIColor, msg: string): string {
    return `${color}${msg}\x1b[0m`;
}

function getVarValue(stmt: VarStmt, args: ViewArgs): any {
    let currentPath = "";
    let currentObj: any = args;

    for(let i = 0; i < stmt.keys.length; i++) {
        const key = stmt.keys[i];

        if(typeof currentObj !== "object") {
            console.error(`[ERROR] "${key}" can't be found in "${currentPath}"`);
            return undefined;
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
            if(i === stmt.keys.length - 1) {
                return currentObj[key];
            } else {
                currentObj = currentObj[key];
            }
        } else {
            console.error(`[ERROR] "${currentPath}" is undefined`);
            return undefined;
        }
    }

    return undefined;
}

function compileLogicExpr(logicExpr: LogicExpr, args: ViewArgs): any {
    if(logicExpr.type === ExprTypes.UNARY) {
        let val: any;
        switch(typeof(logicExpr.value)) {
            case "number":
            case "string":
                val = logicExpr.value;
                break;
            default:
                val = getVarValue(logicExpr.value, args);
        }
        return logicExpr.negated ? !val : val;
    } else if(logicExpr.type === ExprTypes.BINARY) {
        const v1 = compileLogicExpr(logicExpr.left, args);
        const v2 = compileLogicExpr(logicExpr.right, args);

        switch(logicExpr.operator) {
            case Operators.EQUAL: return v1 === v2;
            case Operators.NOT_EQUAL: return v1 !== v2;
            case Operators.GREATHER: return v1 > v2;
            case Operators.LESS: return v1 < v2;
            case Operators.GREATHER_OR_EQ: return v1 >= v2;
            case Operators.LESS_OR_EQ: return v1 <= v2;
            case Operators.AND: return v1 && v2;
            case Operators.OR: return v1 || v2;
        }
    }

    return false;
}

function compileIf(ifStmt: IfStmt, args: ViewArgs): string {
    if(compileLogicExpr(ifStmt.condition, args)) {
        return compileStatements(ifStmt.stmts, args);
    }

    return "";
}

function compileFor(forStmt: ForStmt, args: ViewArgs): string {
    const array = getVarValue(forStmt.arrayVar, args);

    if(!array) return "";

    if(!Array.isArray(array)) {
        // TODO: improve this message
        console.error(`[ERROR] given var is not an array`);
        return "";
    }

    let res = "";

    for(const item of array) {
        res += compileStatements(
            forStmt.stmts, {...args, [forStmt.itemName]: item }
        );
    }

    return res;
}

function compileStatements(statements: Stmt[], args: ViewArgs): string {
    let res = "";
    for(const stmt of statements) {
        switch(stmt.type) {
            case StmtTypes.LITERAL: {
                res += stmt.contents;
            } break;
            case StmtTypes.VAR: {
                res += String(getVarValue(stmt, args));
            } break;
            case StmtTypes.IF: {
                res += compileIf(stmt, args);
            } break;
            case StmtTypes.FOR: {
                res += compileFor(stmt, args);
            } break;
        }
    }
    return res;
}

export type Logger = {
    error: (msg: string) => void;
};

export default class Compiler {
    private buffer = "";
    private hadErrors = false;
    private filePath: string;
    private logger: Logger;

    constructor(logger?: Logger) {
        if(logger) {
            this.logger = logger;
        } else {
            this.logger = console;
        }
    }

    public async compileFile(filePath: string): Promise<View | null> {
        const file = await fs.promises.readFile(filePath, { encoding: "utf8" });
        this.filePath = filePath;
        this.buffer = file.toString();

        const lexer = new Lexer(this.buffer, this);
        const tokens = lexer.scanTokens();

        const parser = new Parser(tokens, this);
        const statements = parser.parse();

        if(this.hadErrors) {
            return null;
        }

        return (args: ViewArgs) => compileStatements(statements, args);
    }

    private getBufLine(line: number): string {
        let start = 0;

        let x = 0;
        while(line > 1 && x < this.buffer.length) {
            if(this.buffer[x] === "\n") line--;
            start++;
            x++;
        }

        let end = start;

        while(end < this.buffer.length && this.buffer[end] !== '\n') end++;

        return this.buffer.slice(start, end);
    }

    public syntaxError(message: string, line: number, col: number | number[]): void {
        const bufLine = this.getBufLine(line);

        let error = "";

        const spaces = (n: number): string => "".padStart(n, " ");

        const colNumber = Array.isArray(col) ? col[0] : col;
        // filepath:line
        error += formatString(ANSIColor.RED, `${this.filePath}:${line}:${colNumber}`) + "\n";

        // ERROR: message
        error += `${formatString(ANSIColor.RED, "ERROR:")} ${message}\n`;

        let errorStart: number, errorEnd: number;

        if(Array.isArray(col)) {
            errorStart = col[0] - 1;
            errorEnd = col[1] - 1;
        } else {
            errorStart = col - 1;
            errorEnd = col;
        }

        // the line of code where the error is
        const left = bufLine.slice(0, errorStart);
        const highlightedCode = formatString(ANSIColor.RED, bufLine.slice(errorStart, errorEnd));
        const right = bufLine.slice(errorEnd);
        error += `${spaces(4)}${line} |${left}${highlightedCode}${right}\n`;

        // A mark pointing the exact place where the error was found
        const lineLen = line.toString().length;
        const errorMark = "^".padEnd(errorEnd - errorStart, "~");
        error += `${spaces(4 + lineLen)} |${spaces(errorStart)}${formatString(ANSIColor.RED, errorMark)}`;

        this.logger.error(error);
        this.hadErrors = true;
    }

    public syntaxErrorToken(message: string, token: Token): void {
        this.syntaxError(message, token.line, token.col);
    }
}
