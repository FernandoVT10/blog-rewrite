import { Response } from "express";
import fs from "fs";
import path from "path";

export function map<T>(arr: T[], cb: (v: T, i: number) => void): string {
    let res = "";

    for(let i = 0; i < arr.length; i++) {
        res += cb(arr[i], i);
    }

    return res;
}

export function cssFile(url: string): string {
    return `<link rel="stylesheet" href="${url}"/>`;
}

export function sendView(res: Response, viewStr: string): void {
    res.setHeader("Content-Type", "text/html");
    res.send(viewStr);
}

class Lexer {
    private buffer: string;
    private cursor = 0;

    constructor(buffer: string) {
        this.buffer = buffer;
    }

    public isAtTheEnd(): boolean {
        return this.cursor >= this.buffer.length;
    }

    public advance(): string {
        return this.buffer[this.cursor++];
    }

    public peek(): string {
        return this.buffer[this.cursor];
    }

    public match(c: string): boolean {
        if(this.peek() === c) {
            this.advance();
            return true;
        }

        return false;
    }

    public skipSpaces(): void {
        while(this.match(" "));
    }

    public getCursorPos(): number {
        return this.cursor;
    }

    public getBufferSlice(start: number, end: number): string {
        return this.buffer.slice(start, end);
    }

    public isNextTerminal(): boolean {
        return this.isAtTheEnd() || this.peek() === "\n";
    }
}

enum Node2Types {
    LITERAL,
    VAR,
};

type LiteralNode = {
    type: Node2Types.LITERAL;
    contents: string;
}

type VarNode = {
    type: Node2Types.VAR;
    name: string;
}

type Node2 = LiteralNode | VarNode;
const VariableNameRegex = /^[^0-9][A-Za-z0-9_]+/;

class Parser {
    private lexer: Lexer;

    private nodes: Node2[] = [];

    constructor(buffer: string) {
        this.lexer = new Lexer(buffer);
    }

    private literal(c: string): void {
        if(this.nodes.length === 0
            || this.nodes[this.nodes.length - 1].type !== Node2Types.LITERAL) {
            this.nodes.push({
                type: Node2Types.LITERAL,
                contents: "",
            });
        }

        const node = this.nodes[this.nodes.length - 1] as LiteralNode;

        node.contents += c;
    }


    private literalSlice(start: number, end: number): void {
        if(this.nodes.length === 0
            || this.nodes[this.nodes.length - 1].type !== Node2Types.LITERAL) {
            this.nodes.push({
                type: Node2Types.LITERAL,
                contents: "",
            });
        }

        const node = this.nodes[this.nodes.length - 1] as LiteralNode;

        node.contents += this.lexer.getBufferSlice(start, end);
    }

    private variable(): void {
        const initialPos = this.lexer.getCursorPos() - 1;

        if(!this.lexer.match("{")) return;

        this.lexer.skipSpaces();

        let varName = "";
        while(this.lexer.peek() !== "}" && !this.lexer.isNextTerminal()) {
            varName += this.lexer.advance();
        }
        console.log(`[INFO] Varname: "${varName}"`)

        this.lexer.skipSpaces();

        if(!VariableNameRegex.test(varName) || !this.lexer.match("}") || !this.lexer.match("}")) {
            this.literalSlice(initialPos, this.lexer.getCursorPos());
            return;
        }

        this.nodes.push({
            type: Node2Types.VAR,
            name: varName,
        });
    }

    public parse(): void {
        while(!this.lexer.isAtTheEnd()) {
            let c = this.lexer.advance();

            if(c === "{") {
                this.variable();
            } else {
                this.literal(c);
            }
        }
    }

    public getNodes(): Node2[] {
        return this.nodes;
    }
}

function compile(nodes: Node2[], args: any): string {
    let res = "";
    for(const node of nodes) {
        switch(node.type) {
            case Node2Types.LITERAL: {
                res += node.contents;
            } break;
            case Node2Types.VAR: {
                if(node.name in args) {
                    res += args[node.name].toString();
                } else {
                    res += "undefined";
                    console.error(`[ERROR] "${node.name}" variable wasn't provided`);
                }
            } break;
        }
    }
    return res;
}

type TemplateFn = (args: any) => string;

async function parseFile(filePath: string): Promise<TemplateFn> {
    const file = await fs.promises.readFile(filePath, { encoding: "utf8" });
    const contents = file.toString();

    const parser = new Parser(contents);
    parser.parse();
    return (args) => compile(parser.getNodes(), args);
}

export async function compileView(): Promise<TemplateFn> {
    return parseFile(path.resolve(__dirname, "./views/test.html"));
}
