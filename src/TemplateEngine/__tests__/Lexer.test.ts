import { describe, expect, test, vi, MockInstance } from "vitest";

import Lexer from "../Lexer";
import Compiler from "../Compiler";

const compileString = (str: string): MockInstance => {
    const compiler = {
        syntaxError: vi.fn(),
    };

    const lexer = new Lexer(str, compiler as any as Compiler);
    lexer.scanTokens();

    return compiler.syntaxError;
};

test("valid string", () => {
    const errorFn = compileString("{{ foo }}");
    expect(errorFn).not.toHaveBeenCalled();
});

test("should handle empty string", () => {
    const errorFn = compileString("");
    expect(errorFn).not.toHaveBeenCalled();
});

describe("lexing errors", () => {
    test('terminating " is not found', () => {
        const template = '{{ "foo }}';
        const errorFn = compileString(template);
        const line = 1;
        const col = [4, 11];
        expect(errorFn).toHaveBeenCalledWith(expect.any(String), line, col);
    });

    test("& is not followed by another &", () => {
        const template = "{{ if(cond &= foo) }}";
        const errorFn = compileString(template);
        const line = 1;
        const col = 13;
        expect(errorFn).toHaveBeenCalledWith(expect.any(String), line, col);
    });

    test("= is not followed by another =", () => {
        const template = "{{ if(cond =$ foo) }}";
        const errorFn = compileString(template);
        const line = 1;
        const col = 13;
        expect(errorFn).toHaveBeenCalledWith(expect.any(String), line, col);
    });

    test("unsupported character", () => {
        const template = "{{ if(cond * foo) }}";
        const errorFn = compileString(template);
        const line = 1;
        const col = 12;
        expect(errorFn).toHaveBeenCalledWith(expect.any(String), line, col);
    });

    test("} is not followed by another |", () => {
        const template = "{{ if(cond |$ foo) }}";
        const errorFn = compileString(template);
        const line = 1;
        const col = 13;
        expect(errorFn).toHaveBeenCalledWith(expect.any(String), line, col);
    });
});
