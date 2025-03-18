import { expect, test, vi, MockInstance } from "vitest";

import Lexer from "../Lexer";
import Compiler from "../Compiler";

const compileString = (str: string): MockInstance => {
    const compiler = {
        lexingError: vi.fn(),
    };

    const lexer = new Lexer(str, compiler as any as Compiler);
    lexer.scanTokens();

    return compiler.lexingError;
};

test('creates an error when terminating " is not found', () => {
    const template = '{{ "foo }}';
    const errorFn = compileString(template);
    const line = 1;
    const col = [4, 11];
    expect(errorFn).toHaveBeenCalledWith(expect.any(String), line, col);
});

test("creates an error when & is not followed by another &", () => {
    const template = "{{ if(cond &= foo) }}";
    const errorFn = compileString(template);
    const line = 1;
    const col = 13;
    expect(errorFn).toHaveBeenCalledWith(expect.any(String), line, col);
});

test("creates an error when = is not followed by another =", () => {
    const template = "{{ if(cond =$ foo) }}";
    const errorFn = compileString(template);
    const line = 1;
    const col = 13;
    expect(errorFn).toHaveBeenCalledWith(expect.any(String), line, col);
});

test("creates an error when a unsupported character is given", () => {
    const template = "{{ if(cond * foo) }}";
    const errorFn = compileString(template);
    const line = 1;
    const col = 12;
    expect(errorFn).toHaveBeenCalledWith(expect.any(String), line, col);
});
