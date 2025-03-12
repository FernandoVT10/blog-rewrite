import fs from "fs";
import { Response } from "express";

const MAX_OBJECT_DEPTH = 10;

enum NodeTypes {
    LITERAL,
    VAR,
};

type LiteralNode = {
    type: NodeTypes.LITERAL;
    contents: string;
};

type VarNode = {
    type: NodeTypes.VAR;
    path: string[];
};

type TemplateNode = LiteralNode | VarNode;

type TemplateViewArgs = any;
type TemplateView = (args: TemplateViewArgs) => string;

// FORMAL GRAMMAR
// Expression = "{{" Spaces Variable Spaces "}}"
// Spaces = " "+
// Variable = VarName ("." VarName)?
// VarName = [A-Za-z_$] [A-Za-z_$0-9]+

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


    public setCursorPos(pos: number): void {
        this.cursor = pos;
    }

    public getCursorPos(): number {
        return this.cursor;
    }

    public getBufferSlice(start: number, end: number): string {
        return this.buffer.slice(start, end);
    }
}

class Parser {
    private lexer: Lexer;

    private nodes: TemplateNode[] = [];

    constructor(buffer: string) {
        this.lexer = new Lexer(buffer);
    }

    // if the last node is literal this returns it else it creates a new one and returns it
    private getOrCreateLiteralNode(): LiteralNode {
        const len = this.nodes.length;
        if(len === 0 || this.nodes[len - 1].type !== NodeTypes.LITERAL) {
            this.nodes.push({
                type: NodeTypes.LITERAL,
                contents: "",
            });
        }
        return this.nodes[this.nodes.length - 1] as LiteralNode;
    }

    // this function always consumes at least one char
    private literal(): void {
        const node = this.getOrCreateLiteralNode();

        node.contents += this.lexer.advance();
        while(this.lexer.peek() !== "{" && !this.lexer.isAtTheEnd()) {
            node.contents += this.lexer.advance();
        }
    }

    private variable(): VarNode | null {
        const varPath: string[] = [];

        let pathIndex = 0;
        while(pathIndex < MAX_OBJECT_DEPTH) {
            if(pathIndex > 0) {
                if(!this.lexer.match(".")) break;
            }

            if(!/[A-Za-z_$]/.test(this.lexer.peek())) return null;

            varPath[pathIndex] = this.lexer.advance();

            while(/[A-Za-z_$0-9]/.test(this.lexer.peek())) {
                varPath[pathIndex] += this.lexer.advance();
            }

            pathIndex++;
        }

        return {
            type: NodeTypes.VAR,
            path: varPath,
        };
    }

    private expression(): boolean {
        if(!this.lexer.match("{") || !this.lexer.match("{")) return false;

        this.lexer.skipSpaces();

        const node = this.variable();
        if(node === null) return false;

        this.lexer.skipSpaces();

        if(!this.lexer.match("}") || !this.lexer.match("}")) return false;

        this.nodes.push(node);
        return true;
    }

    public parse(): TemplateNode[] {
        while(!this.lexer.isAtTheEnd()) {
            const initialPos = this.lexer.getCursorPos();
            if(this.expression()) continue;

            this.lexer.setCursorPos(initialPos);
            this.literal();
        }

        return this.nodes;
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

        const parser = new Parser(contents);
        const templateNodes = parser.parse();
        return (args) => this.compileNodes(templateNodes, args);
    }

    private compileVariable(node: VarNode, args: TemplateViewArgs): string {
        let currentPath = "";
        let currentObj: any = args;

        for(let i = 0; i < node.path.length; i++) {
            const name = node.path[i];

            if(typeof currentObj !== "object") {
                console.error(`[ERROR] Can't use "${name}" in "${currentPath}" since "${currentPath}" is a "${typeof currentObj}"`);
                return "undefined";
            }

            if(i > 0) {
                currentPath += `.${name}`;
            } else {
                currentPath = name;
            }

            if(currentObj[name] !== undefined) {
                if(i === node.path.length - 1) {
                    return currentObj[name].toString();
                } else {
                    currentObj = currentObj[name];
                }
            } else {
                console.error(`[ERROR] "${currentPath}" is undefined`);
                return "undefined";
            }
        }

        return "undefined";
    }

    private compileNodes(nodes: TemplateNode[], args: TemplateViewArgs): string {
        let res = "";
        for(const node of nodes) {
            switch(node.type) {
                case NodeTypes.LITERAL: {
                    res += node.contents;
                } break;
                case NodeTypes.VAR: {
                    res += this.compileVariable(node, args);
                } break;
            }
        }
        return res;
    }
}

export default new TemplateEngine();
