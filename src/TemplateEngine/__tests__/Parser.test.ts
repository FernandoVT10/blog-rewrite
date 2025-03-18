import { test, expect, describe, vi, MockInstance } from "vitest";

import Parser from "../Parser";
import Lexer from "../Lexer";
import Compiler from "../Compiler";

type CompilerMock = { syntaxError: MockInstance, syntaxErrorToken: MockInstance };

const compileString = (str: string): CompilerMock => {
    const compiler: CompilerMock = {
        syntaxError: vi.fn(),
        syntaxErrorToken: vi.fn(),
    };

    const lexer = new Lexer(str, {} as any as Compiler);
    const tokens = lexer.scanTokens();
    const parser = new Parser(tokens, compiler as any as Compiler);
    parser.parse();

    return compiler;
};

describe("parsing errors", () => {
    test("variable starts with a number", () => {
        const template = "{{ 123message }}";
        const mock = compileString(template);
        expect(mock.syntaxErrorToken).toHaveBeenCalledOnce();
    });

    test("expression is not closed with }}", () => {
        const template = "{{ message";
        const mock = compileString(template);
        const line = 1;
        const col = 11;
        expect(mock.syntaxError).toHaveBeenCalledWith(
            expect.any(String), line, col
        );
    });

    describe("variables", () => {
        test("dot is ont followed by identifier", () => {
            const template = "{{ hello. }}";
            const mock = compileString(template);
            const line = 1;
            const col = 10;
            expect(mock.syntaxError).toHaveBeenCalledWith(
                expect.any(String), line, col
            );
        });

        test("array without index", () => {
            const template = "{{ hello[] }}";
            const mock = compileString(template);
            const line = 1;
            const col = 10;
            expect(mock.syntaxError).toHaveBeenCalledWith(
                expect.any(String), line, col
            );
        });

        test("array without closing bracket", () => {
            const template = "{{ hello[0 }}";
            const mock = compileString(template);
            const line = 1;
            const col = 11;
            expect(mock.syntaxError).toHaveBeenCalledWith(
                expect.any(String), line, col
            );
        });
    });

    describe("if", () => {
        test("( is not added", () => {
            const template = "{{ if hello }}";
            const mock = compileString(template);
            const line = 1;
            const col = 6;
            expect(mock.syntaxError).toHaveBeenCalledWith(
                expect.any(String), line, col
            );
        });

        test(") is not added", () => {
            const template = "{{ if(foo }}";
            const mock = compileString(template);
            const line = 1;
            const col = 10;
            expect(mock.syntaxError).toHaveBeenCalledWith(
                expect.any(String), line, col
            );
        });
    });

    test("only a number inside", () => {
        const template = "{{ 17 }}";
        const mock = compileString(template);
        expect(mock.syntaxErrorToken).toHaveBeenCalledOnce();
    });

    test("empty expression", () => {
        const template = "{{ }}";
        const mock = compileString(template);
        const line = 1;
        const col = 3;
        expect(mock.syntaxError).toHaveBeenCalledWith(
            expect.any(String), line, col
        );
    });
});
