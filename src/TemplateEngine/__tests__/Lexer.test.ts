import { expect, test } from "vitest";

import Lexer from "../Lexer";

const compileString = (str: string) => {
    const lexer = new Lexer(str, "");
    lexer.scanTokens();
};

test('should throw when terminating " is not found', () => {
    const template = '{{ "foo }}';
    expect(() => compileString(template)).toThrowError();
});

test("should throw when & is not followed by another &", () => {
    const template = "{{ if(cond &= foo) }}";
    expect(() => compileString(template)).toThrowError();
});

test("should throw when = is not followed by another =", () => {
    const template = "{{ if(cond =$ foo) }}";
    expect(() => compileString(template)).toThrowError();
});

test("should throw when a unsupported character is given", () => {
    const template = "{{ if(cond * foo) }}";
    expect(() => compileString(template)).toThrowError();
});
