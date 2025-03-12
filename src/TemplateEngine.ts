import fs from "fs";
import { Response } from "express";

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
    // this stores all the indexes in order. "foo.bar[2]" will output ["foo", "bar", "2"]
    keys: string[];
};

type TemplateNode = LiteralNode | VarNode;

type TemplateViewArgs = any;
type TemplateView = (args: TemplateViewArgs) => string;

// FORMAL GRAMMAR
// Expression = "{{" Spaces Variable Spaces "}}"
// Spaces = " "+
// Variable = VarName (("." VarName) | ("[" Number+ "]"))?
// VarName = [A-Za-z_$] [A-Za-z_$0-9]+
// Number [0-9]

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

    public isNextNumber(): boolean {
        return /[0-9]/.test(this.peek());
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

    private getVariableKey(): string | null {
        if(!/[A-Za-z_$]/.test(this.lexer.peek())) return null;

        let key = "";
        key = this.lexer.advance();

        while(/[A-Za-z_$0-9]/.test(this.lexer.peek())) {
            key += this.lexer.advance();
        }

        return key;
    }

    private variable(): VarNode | null {
        const varKeys: string[] = [];

        const varKey = this.getVariableKey();
        if(varKey === null) return null;
        varKeys.push(varKey);

        let c = this.lexer.peek();
        while(c === "." || c === "[") {
            if(this.lexer.match(".")) {
                const varKey = this.getVariableKey();
                if(varKey === null) return null;
                varKeys.push(varKey);
            } else if(this.lexer.match("[")) {
                let varKey = "";

                while(this.lexer.isNextNumber()) {
                    varKey += this.lexer.advance();
                }

                if(!this.lexer.match("]")) return null;

                varKeys.push(varKey);
            }

            c = this.lexer.peek();
        }

        return {
            type: NodeTypes.VAR,
            keys: varKeys,
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
                    return currentObj[key].toString();
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
